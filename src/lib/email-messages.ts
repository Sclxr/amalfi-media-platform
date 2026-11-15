import { formatCents } from "@/lib/money";

export type MailMessage = { to: string; subject: string; text: string; html?: string };

export function galleryInviteMessage(input: { to: string; name: string; address: string; url: string }): MailMessage {
  const name = input.name.trim() || "there";
  return {
    to: input.to,
    subject: `Your photos for ${input.address}`,
    text: `${name}, your gallery for ${input.address} is ready.\n\nOpen this link to view the watermarked previews. It works once and expires in 7 days.\n${input.url}\n`,
  };
}

export function passwordResetMessage(input: { to: string; url: string }): MailMessage {
  return {
    to: input.to,
    subject: "Reset your Amalfi Media password",
    text: `Reset your password with this link. It expires in 30 minutes.\n${input.url}\n`,
  };
}

export function loginCodeMessage(input: { to: string; code: string }): MailMessage {
  return {
    to: input.to,
    subject: "Your Amalfi Media sign-in code",
    text: `Your sign-in code is ${input.code}. It expires in 10 minutes. If you did not ask for this, you can ignore this email.\n`,
  };
}

export function verificationMessage(input: { to: string; url: string }): MailMessage {
  return {
    to: input.to,
    subject: "Confirm your email for Amalfi Media",
    text: `Confirm your email with this link.\n${input.url}\n`,
  };
}

export function receiptMessage(input: {
  to: string;
  number: string;
  totalCents: number;
  baseCents?: number;
  feeCents?: number;
  method?: string;
  receiptUrl: string | null;
  galleryUrl: string | null;
}): MailMessage {
  const lines = [`Payment received for ${input.number} (${formatCents(input.totalCents)}).`];
  if (input.feeCents && input.feeCents > 0 && input.baseCents !== undefined) {
    lines.push(`Listing price ${formatCents(input.baseCents)}. Card processing fee ${formatCents(input.feeCents)}.`);
  }
  if (input.method === "zelle") lines.push("Paid by Zelle. No card processing fee.");
  if (input.receiptUrl) lines.push(`Stripe receipt: ${input.receiptUrl}`);
  if (input.galleryUrl) lines.push(`Gallery: ${input.galleryUrl}`);
  return {
    to: input.to,
    subject: `Receipt for ${input.number}`,
    text: `${lines.join("\n")}\n`,
  };
}

export function quoteMessage(input: {
  to: string;
  name: string;
  address: string;
  lines: { description: string; totalCents: number }[];
  totalCents: number;
  cardFeeCents: number;
  cardTotalCents: number;
  note?: string;
  payUrl: string;
}): MailMessage {
  const name = input.name.trim() || "there";
  const note = input.note?.trim();
  const lineText = input.lines.map((line) => `${line.description}: ${formatCents(line.totalCents)}`).join("\n");
  const text = [
    `${name}, here is the quote for ${input.address}.`,
    note ? `\n${note}\n` : "",
    lineText,
    `Listing total: ${formatCents(input.totalCents)}`,
    `Card total: ${formatCents(input.cardTotalCents)} (includes a ${formatCents(input.cardFeeCents)} card fee).`,
    `Zelle: ${formatCents(input.totalCents)}. No card fee.`,
    `Review and pay: ${input.payUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const rows = input.lines
    .map(
      (line) =>
        `<tr><td style="padding:8px 0;color:#111111;" class="ink">${escapeHtml(line.description)}</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;color:#111111;" class="ink">${formatCents(line.totalCents)}</td></tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {
    .page { background:#111111 !important; }
    .card { background:#1c1c1c !important; }
    .ink { color:#f7f5f0 !important; }
    .muted { color:#bdb7ae !important; }
    .line { border-color:#2a2a2a !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#f7f5f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="page" style="background:#f7f5f0;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="background:#111111;padding:28px 24px;">
          <p style="margin:0;font-family:Georgia,serif;letter-spacing:0.16em;font-size:14px;color:#d4bc8c;">AMALFI MEDIA</p>
        </td></tr>
        <tr><td class="card" style="background:#ffffff;padding:28px 24px;font-family:Georgia,serif;color:#111111;">
          <p class="ink" style="margin:0 0 8px;font-size:22px;line-height:1.3;">Quote for ${escapeHtml(input.address)}</p>
          <p class="muted" style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#6f6a62;">${escapeHtml(name)}, this is ready when you are.</p>
          ${note ? `<p class="ink" style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(note)}</p>` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e7e2d8;" class="line">${rows}</table>
          <p class="ink" style="margin:16px 0 4px;font-size:16px;">Listing total <strong>${formatCents(input.totalCents)}</strong></p>
          <p class="ink" style="margin:0 0 4px;font-size:16px;">Card total <strong style="color:#b8956c;">${formatCents(input.cardTotalCents)}</strong> <span class="muted" style="color:#6f6a62;">including a ${formatCents(input.cardFeeCents)} card fee</span></p>
          <p class="ink" style="margin:0 0 20px;font-size:16px;">Zelle <strong>${formatCents(input.totalCents)}</strong> <span class="muted" style="color:#6f6a62;">no card fee</span></p>
          <a href="${escapeHtml(input.payUrl)}" style="display:inline-block;background:#111111;color:#d4bc8c;text-decoration:none;font-family:Georgia,serif;font-size:16px;padding:14px 22px;border-radius:12px;">Review and pay</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return {
    to: input.to,
    subject: `Quote for ${input.address}`,
    text,
    html,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
