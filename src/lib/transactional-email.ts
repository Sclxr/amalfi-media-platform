export type TransactionalSendInput = {
  appEnv: "development" | "test" | "staging" | "production";
  emailTransactionalEnabled: boolean;
};

/** Staging and every non-production environment can preview a template and cannot send it. */
export function transactionalSendDecision(input: TransactionalSendInput): {
  allowed: boolean;
  previewOnly: boolean;
  reason: string;
} {
  if (input.appEnv !== "production" || !input.emailTransactionalEnabled) {
    const where = input.appEnv === "production" ? "EMAIL_TRANSACTIONAL_ENABLED is false." : `${input.appEnv} only previews transactional email.`;
    return { allowed: false, previewOnly: true, reason: where };
  }
  return { allowed: true, previewOnly: false, reason: "Transactional email is allowed in production." };
}

export function renderTransactionalPreview(input: { subject: string; body: string; address: string }) {
  return {
    subject: input.subject,
    body: input.body.replaceAll("{{address}}", input.address),
  };
}

/** Production sends only when the flag is on and a provider is configured. Everywhere else is a preview. */
export function transactionalDeliveryPlan(
  input: TransactionalSendInput & { providerConfigured: boolean },
): "send" | "preview" | "skip" {
  const decision = transactionalSendDecision(input);
  if (decision.allowed) return input.providerConfigured ? "send" : "skip";
  if (input.appEnv === "production") return "skip";
  return "preview";
}
