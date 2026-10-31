export type TransactionalSendInput = {
  appEnv: "development" | "test" | "staging" | "production";
  emailTransactionalEnabled: boolean;
  /** When true with the transactional flag, staging may deliver. Defaults to off. */
  stagingSend?: boolean;
};

/** Production sends when transactional email is on. Staging sends only when both staging flags are on. Development and test only preview. */
export function transactionalSendDecision(input: TransactionalSendInput): {
  allowed: boolean;
  previewOnly: boolean;
  reason: string;
} {
  if (input.appEnv === "production" && input.emailTransactionalEnabled) {
    return { allowed: true, previewOnly: false, reason: "Transactional email is allowed in production." };
  }
  if (input.appEnv === "staging" && input.emailTransactionalEnabled && input.stagingSend === true) {
    return { allowed: true, previewOnly: false, reason: "Transactional email is allowed on staging." };
  }
  if (input.appEnv === "production") {
    return { allowed: false, previewOnly: true, reason: "EMAIL_TRANSACTIONAL_ENABLED is false." };
  }
  if (input.appEnv === "staging") {
    return { allowed: false, previewOnly: true, reason: "staging only previews transactional email until EMAIL_STAGING_SEND is true." };
  }
  return { allowed: false, previewOnly: true, reason: `${input.appEnv} only previews transactional email.` };
}

/**
 * Empty allowlist means every recipient may be sent on staging.
 * A set list accepts full addresses and domains, with or without a leading @.
 */
export function stagingRecipientAllowed(email: string, allowlist: string | undefined): { allowed: boolean; reason?: string } {
  const entries = (allowlist ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return { allowed: true };
  const recipient = email.trim().toLowerCase();
  const domain = recipient.split("@")[1] ?? "";
  const match = entries.some((entry) => {
    const domainOnly = entry.startsWith("@") || !entry.includes("@");
    if (!domainOnly) return recipient === entry;
    const domainEntry = entry.startsWith("@") ? entry.slice(1) : entry;
    return domainEntry.length > 0 && domain === domainEntry;
  });
  if (match) return { allowed: true };
  return { allowed: false, reason: "Recipient is not on the staging allowlist." };
}

export function inviteEmailNotice(input: { recipient: string; mode: "send" | "preview" | "skip"; delivered: boolean; reason?: string }) {
  if (input.delivered) return `Invite emailed to ${input.recipient}`;
  if (input.mode === "preview") return "Invite logged only (staging/not allowlisted)";
  return `Invite email failed: ${input.reason ?? "The email could not be sent."}`;
}

export function renderTransactionalPreview(input: { subject: string; body: string; address: string }) {
  return {
    subject: input.subject,
    body: input.body.replaceAll("{{address}}", input.address),
  };
}

/** Sends when the decision allows it and a provider is configured. Production without the flag skips. Development and test preview. */
export function transactionalDeliveryPlan(
  input: TransactionalSendInput & { providerConfigured: boolean },
): "send" | "preview" | "skip" {
  const decision = transactionalSendDecision(input);
  if (decision.allowed) return input.providerConfigured ? "send" : "skip";
  if (input.appEnv === "production") return "skip";
  return "preview";
}
