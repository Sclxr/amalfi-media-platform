import { brokerageNameKey } from "@/schemas/brokerage";
import { LEAD_STATUSES } from "@/schemas/lead";
import { normalizeEmail } from "@/lib/email";
import { normalizePhoneE164 } from "@/lib/phone";

export const IMPORT_FIELDS = [
  "skip",
  "firstName",
  "lastName",
  "email",
  "phone",
  "brokerage",
  "city",
  "status",
  "tags",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ImportMapping = Record<string, ImportField>;

export type ExistingContact = {
  emailNormalized: string | null;
  phoneE164: string | null;
};

const HEADER_ALIASES: Record<string, ImportField> = {
  first: "firstName",
  firstname: "firstName",
  "first name": "firstName",
  last: "lastName",
  lastname: "lastName",
  "last name": "lastName",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  telephone: "phone",
  brokerage: "brokerage",
  company: "brokerage",
  office: "brokerage",
  city: "city",
  status: "status",
  tags: "tags",
  tag: "tags",
};

export function guessImportMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<ImportField>();
  for (const header of headers) {
    const alias = HEADER_ALIASES[header.trim().toLowerCase()];
    if (!alias || used.has(alias)) {
      mapping[header] = "skip";
      continue;
    }
    used.add(alias);
    mapping[header] = alias;
  }
  return mapping;
}

export type PreviewRow = {
  rowNumber: number;
  action: "create" | "merge" | "error";
  errors: string[];
  warnings: string[];
  emailNormalized: string | null;
  phoneE164: string | null;
  brokerageName: string | null;
  brokerageNameKey: string | null;
  values: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    status: string;
    tags: string[];
  };
};

function cell(headers: string[], row: string[], mapping: ImportMapping, field: ImportField) {
  for (let index = 0; index < headers.length; index += 1) {
    if (mapping[headers[index] ?? ""] === field) return (row[index] ?? "").trim();
  }
  return "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function previewImport(input: {
  headers: string[];
  rows: string[][];
  mapping: ImportMapping;
  existing: ExistingContact[];
  existingBrokerageKeys: string[];
}): { rows: PreviewRow[]; createdBrokerages: string[]; summary: { create: number; merge: number; error: number } } {
  const emailOwners = new Map<string, number>();
  const phoneOwners = new Map<string, number>();
  for (const contact of input.existing) {
    if (contact.emailNormalized) emailOwners.set(contact.emailNormalized, -1);
    if (contact.phoneE164) phoneOwners.set(contact.phoneE164, -1);
  }
  const brokerageKeys = new Set(input.existingBrokerageKeys);
  const createdBrokerages: string[] = [];
  const rows: PreviewRow[] = [];

  input.rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    if (raw.every((value) => value.trim() === "")) return;
    const errors: string[] = [];
    const warnings: string[] = [];
    const firstName = cell(input.headers, raw, input.mapping, "firstName");
    const lastName = cell(input.headers, raw, input.mapping, "lastName");
    const emailRaw = cell(input.headers, raw, input.mapping, "email");
    const phoneRaw = cell(input.headers, raw, input.mapping, "phone");
    const brokerageName = cell(input.headers, raw, input.mapping, "brokerage");
    const city = cell(input.headers, raw, input.mapping, "city");
    const statusRaw = cell(input.headers, raw, input.mapping, "status").toUpperCase().replace(/\s+/g, "_");
    const tags = cell(input.headers, raw, input.mapping, "tags")
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!firstName || !lastName) errors.push("First and last name are required.");
    let emailNormalized: string | null = null;
    if (emailRaw) {
      if (!isEmail(emailRaw)) errors.push(`Email "${emailRaw}" is not valid.`);
      else emailNormalized = normalizeEmail(emailRaw);
    }
    const phoneE164 = phoneRaw ? normalizePhoneE164(phoneRaw) : null;
    if (phoneRaw && !phoneE164) warnings.push("Phone was not a recognizable number and will not be stored.");
    if (!emailNormalized && !phoneE164) errors.push("Row needs a valid email or a recognizable phone number.");

    let status = "NEW";
    if (statusRaw) {
      if ((LEAD_STATUSES as readonly string[]).includes(statusRaw)) status = statusRaw;
      else errors.push(`Status "${statusRaw}" is not a known realtor status.`);
    }

    const brokerageKey = brokerageName ? brokerageNameKey(brokerageName) : null;
    if (brokerageKey && !brokerageKeys.has(brokerageKey)) {
      warnings.push(`Brokerage "${brokerageName}" will be created.`);
    }

    let action: PreviewRow["action"] = errors.length > 0 ? "error" : "create";
    if (action !== "error") {
      const emailHit = emailNormalized ? emailOwners.get(emailNormalized) : undefined;
      const phoneHit = phoneE164 ? phoneOwners.get(phoneE164) : undefined;
      if (emailHit !== undefined || phoneHit !== undefined) {
        action = "merge";
        warnings.push(
          emailHit === -1 || phoneHit === -1
            ? "Matches a realtor already on file. Empty fields will be filled. Existing values stay."
            : "Duplicate of an earlier row in this file. It will merge into that row.",
        );
      }
    }

    if (action !== "error") {
      if (emailNormalized && !emailOwners.has(emailNormalized)) emailOwners.set(emailNormalized, rowNumber);
      if (phoneE164 && !phoneOwners.has(phoneE164)) phoneOwners.set(phoneE164, rowNumber);
      if (brokerageKey && !brokerageKeys.has(brokerageKey)) {
        brokerageKeys.add(brokerageKey);
        createdBrokerages.push(brokerageName);
      }
    }

    rows.push({
      rowNumber,
      action,
      errors,
      warnings,
      emailNormalized,
      phoneE164,
      brokerageName: brokerageName || null,
      brokerageNameKey: brokerageKey,
      values: {
        firstName,
        lastName,
        email: emailNormalized,
        phone: phoneE164 ? phoneRaw : null,
        city: city || null,
        status,
        tags,
      },
    });
  });

  return {
    rows,
    createdBrokerages,
    summary: {
      create: rows.filter((row) => row.action === "create").length,
      merge: rows.filter((row) => row.action === "merge").length,
      error: rows.filter((row) => row.action === "error").length,
    },
  };
}
