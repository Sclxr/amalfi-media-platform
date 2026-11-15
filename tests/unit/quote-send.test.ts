import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { quoteMessage } from "@/lib/email-messages";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { transactionalDeliveryPlan } from "@/lib/transactional-email";
import { markZellePaid, reverseZellePayment } from "@/server/services/billing";
import { listQuoteChoices, sendQuote } from "@/server/services/quotes";

const prisma = new PrismaClient();

function admin(user: { id: string; email: string; name: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: "ADMIN" as const,
    clientId: null,
    permissions: new Set(ROLE_PERMISSIONS.ADMIN),
  };
}

describe("quote email", () => {
  it("shows the address, card total, and Zelle price in light and dark", () => {
    const message = quoteMessage({
      to: "maya@example.com",
      name: "Maya",
      address: "1842 Lake Conway Shore",
      lines: [{ description: "Introductory photography", totalCents: 12000 }],
      totalCents: 12000,
      cardFeeCents: 389,
      cardTotalCents: 12389,
      note: "Saturday works.",
      payUrl: "https://app.example/portal/login?next=%2Fportal%2Finvoices%2F1",
    });
    expect(message.subject).toContain("1842 Lake Conway Shore");
    expect(message.text).toContain("Card total: $123.89");
    expect(message.text).toContain("Zelle: $120.00");
    expect(message.text).toContain("Saturday works.");
    expect(message.html).toContain("prefers-color-scheme: dark");
    expect(message.html).toContain("#111111");
    expect(message.html).toContain("#d4bc8c");
    expect(message.html).toContain("1842 Lake Conway Shore");
  });

  it("previews on staging until EMAIL_STAGING_SEND is on, and sends when it is", () => {
    expect(
      transactionalDeliveryPlan({
        appEnv: "staging",
        emailTransactionalEnabled: true,
        stagingSend: false,
        providerConfigured: true,
      }),
    ).toBe("preview");
    expect(
      transactionalDeliveryPlan({
        appEnv: "staging",
        emailTransactionalEnabled: true,
        stagingSend: true,
        providerConfigured: true,
      }),
    ).toBe("send");
    expect(
      transactionalDeliveryPlan({
        appEnv: "test",
        emailTransactionalEnabled: true,
        stagingSend: true,
        providerConfigured: true,
      }),
    ).toBe("preview");
  });
});

describe("send quote", () => {
  it("marks a draft sent only when send is called, and refuses a paid invoice", async () => {
    const stamp = `quote-${Date.now()}`;
    const user = await prisma.user.create({ data: { name: "Quoter", email: `${stamp}@example.com`, role: "ADMIN" } });
    const actor = admin(user);
    const client = await prisma.client.create({
      data: { firstName: "Maya", lastName: "Ellison", email: `${stamp}-maya@example.com` },
    });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Quote St`, city: "Orlando", zip: "32801", propertyType: "SINGLE_FAMILY" },
    });
    const order = await prisma.order.create({
      data: { clientId: client.id, propertyId: property.id, status: "SCHEDULED", subtotalCents: 12000, totalCents: 12000 },
    });
    const draft = await prisma.invoice.create({
      data: {
        number: `${stamp}-draft`,
        clientId: client.id,
        orderId: order.id,
        status: "DRAFT",
        subtotalCents: 12000,
        totalCents: 12000,
        lineItems: { create: { description: "Introductory photography", quantity: 1, unitPriceCents: 12000, totalCents: 12000 } },
      },
    });
    const choices = await listQuoteChoices(actor);
    expect(choices.some((choice) => choice.invoiceId === draft.id)).toBe(true);
    expect((await prisma.invoice.findUnique({ where: { id: draft.id } }))?.quoteSentAt).toBeNull();

    const sent = await sendQuote(actor, draft.id, "See you Saturday.");
    expect(sent).toMatchObject({ ok: true, delivered: false, mode: "preview", sentTo: `${stamp}-maya@example.com` });
    const stored = await prisma.invoice.findUnique({ where: { id: draft.id } });
    expect(stored?.status).toBe("OPEN");
    expect(stored?.quoteSentAt).toBeTruthy();
    expect(stored?.quoteSentTo).toBe(`${stamp}-maya@example.com`);

    const paid = await prisma.invoice.create({
      data: {
        number: `${stamp}-paid`,
        clientId: client.id,
        orderId: order.id,
        status: "PAID",
        subtotalCents: 12000,
        totalCents: 12000,
        amountPaidCents: 12000,
      },
    });
    const blocked = await sendQuote(actor, paid.id, "");
    expect(blocked).toEqual({ error: "This quote is already paid." });
    expect((await prisma.invoice.findUnique({ where: { id: paid.id } }))?.quoteSentAt).toBeNull();
  });

  it("marks Zelle paid from the listing price and undoes it", async () => {
    const stamp = `zelle-today-${Date.now()}`;
    const user = await prisma.user.create({ data: { name: "Zelle", email: `${stamp}@example.com`, role: "ADMIN" } });
    const actor = admin(user);
    const client = await prisma.client.create({
      data: { firstName: "Riley", lastName: "Cho", email: `${stamp}@example.com`.replace("@", "-c@") },
    });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Zelle St`, city: "Orlando", zip: "32801", propertyType: "SINGLE_FAMILY" },
    });
    const order = await prisma.order.create({
      data: { clientId: client.id, propertyId: property.id, status: "DELIVERED", subtotalCents: 12000, totalCents: 12000 },
    });
    const invoice = await prisma.invoice.create({
      data: {
        number: `${stamp}-open`,
        clientId: client.id,
        orderId: order.id,
        status: "OPEN",
        subtotalCents: 12000,
        totalCents: 12000,
      },
    });
    const recorded = await markZellePaid(actor, invoice.id, 12000, "Marked paid from Today.");
    expect(recorded).toEqual({ ok: true });
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.status).toBe("PAID");
    const undone = await reverseZellePayment(actor, invoice.id, "Undone from Today.");
    expect(undone).toEqual({ ok: true });
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.status).toBe("OPEN");
  });
});
