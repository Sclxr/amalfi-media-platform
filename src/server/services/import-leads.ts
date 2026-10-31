import "server-only";
import type { LeadStatus, Prisma } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { parseCsv } from "@/lib/csv";
import { previewImport, guessImportMapping, type ImportMapping } from "@/lib/import-preview";
import { can } from "@/lib/permissions";
import { LEAD_STATUSES } from "@/schemas/lead";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

function asStatus(value: string): LeadStatus {
  if ((LEAD_STATUSES as readonly string[]).includes(value)) return value as LeadStatus;
  return "NEW";
}

export async function buildImportPreview(actor: Actor, csv: string, mapping?: ImportMapping) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const parsed = parseCsv(csv);
  if (!parsed.ok) return { error: parsed.error as string };
  const chosen = mapping ?? guessImportMapping(parsed.table.headers);
  const [existing, brokerages] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null },
      select: { emailNormalized: true, phoneE164: true },
    }),
    prisma.brokerage.findMany({ select: { nameKey: true } }),
  ]);
  const preview = previewImport({
    headers: parsed.table.headers,
    rows: parsed.table.rows,
    mapping: chosen,
    existing,
    existingBrokerageKeys: brokerages.map((brokerage) => brokerage.nameKey),
  });
  return { headers: parsed.table.headers, mapping: chosen, preview };
}

export async function commitImport(actor: Actor, csv: string, mapping: ImportMapping, fileName = "paste.csv") {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const built = await buildImportPreview(actor, csv, mapping);
  if ("error" in built) return { error: built.error };
  const { preview } = built;

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({
      data: {
        fileName,
        fileKey: `inline/${Date.now()}`,
        mapping: mapping as Prisma.InputJsonValue,
        totalRows: preview.rows.length,
        errors: preview.rows
          .filter((row) => row.action === "error")
          .map((row) => ({ rowNumber: row.rowNumber, errors: row.errors })) as Prisma.InputJsonValue,
        createdById: actor.id,
      },
    });
    let createdRows = 0;
    let mergedRows = 0;
    const brokerageIds = new Map<string, string>();
    const brokerages = await tx.brokerage.findMany({ select: { id: true, nameKey: true } });
    for (const brokerage of brokerages) brokerageIds.set(brokerage.nameKey, brokerage.id);

    for (const row of preview.rows) {
      if (row.action === "error") continue;
      let brokerageId: string | null = null;
      if (row.brokerageNameKey && row.brokerageName) {
        brokerageId = brokerageIds.get(row.brokerageNameKey) ?? null;
        if (!brokerageId) {
          const brokerage = await tx.brokerage.create({
            data: { name: row.brokerageName, nameKey: row.brokerageNameKey },
          });
          brokerageId = brokerage.id;
          brokerageIds.set(row.brokerageNameKey, brokerage.id);
        }
      }
      const match = row.emailNormalized
        ? await tx.lead.findUnique({ where: { emailNormalized: row.emailNormalized } })
        : row.phoneE164
          ? await tx.lead.findFirst({ where: { phoneE164: row.phoneE164, deletedAt: null } })
          : null;
      if (!match) {
        const lead = await tx.lead.create({
          data: {
            firstName: row.values.firstName,
            lastName: row.values.lastName,
            email: row.values.email,
            emailNormalized: row.emailNormalized,
            phone: row.values.phone,
            phoneE164: row.phoneE164,
            city: row.values.city,
            status: asStatus(row.values.status),
            tags: row.values.tags,
            brokerageId,
            ownerId: actor.id,
            importBatchId: created.id,
          },
        });
        await tx.leadActivity.create({
          data: { leadId: lead.id, actorId: actor.id, type: "IMPORTED", summary: `Imported from ${fileName}` },
        });
        createdRows += 1;
        continue;
      }
      const tags = [...new Set([...match.tags, ...row.values.tags])];
      await tx.lead.update({
        where: { id: match.id },
        data: {
          phone: match.phone ?? row.values.phone,
          phoneE164: match.phoneE164 ?? row.phoneE164,
          city: match.city ?? row.values.city,
          brokerageId: match.brokerageId ?? brokerageId,
          tags,
          importBatchId: match.importBatchId ?? created.id,
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId: match.id,
          actorId: actor.id,
          type: "IMPORTED",
          summary: `Merged from ${fileName}. Existing name, email, and status were kept.`,
        },
      });
      mergedRows += 1;
    }
    return tx.importBatch.update({
      where: { id: created.id },
      data: { createdRows, mergedRows, skippedRows: preview.summary.error },
    });
  });

  await writeAudit({
    actorId: actor.id,
    action: "lead.import",
    entityType: "ImportBatch",
    entityId: batch.id,
    after: { createdRows: batch.createdRows, mergedRows: batch.mergedRows, skippedRows: batch.skippedRows },
  });
  return { id: batch.id, createdRows: batch.createdRows, mergedRows: batch.mergedRows, skippedRows: batch.skippedRows };
}

export async function listImportBatches(actor: Actor, view?: string) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  return prisma.importBatch.findMany({
    where: { archivedAt: view === "archived" ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
