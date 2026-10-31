import { formatCents } from "@/lib/money";

export type MailMessage = { to: string; subject: string; text: string };

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
  receiptUrl: string | null;
  galleryUrl: string | null;
}): MailMessage {
  const lines = [`Payment received for ${input.number} (${formatCents(input.totalCents)}).`];
  if (input.receiptUrl) lines.push(`Stripe receipt: ${input.receiptUrl}`);
  if (input.galleryUrl) lines.push(`Gallery: ${input.galleryUrl}`);
  return {
    to: input.to,
    subject: `Receipt for ${input.number}`,
    text: `${lines.join("\n")}\n`,
  };
}
