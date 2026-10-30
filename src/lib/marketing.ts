export type AppEnvironment = "development" | "test" | "staging" | "production";

export type MarketingSendInput = {
  appEnv: AppEnvironment;
  emailMarketingEnabled: boolean;
};

/**
 * Marketing and campaign email is hard-disabled outside production, even if
 * EMAIL_MARKETING_ENABLED is mistakenly set. Production still requires the flag.
 */
export function marketingSendDecision(input: MarketingSendInput): {
  allowed: boolean;
  reason: string;
} {
  if (input.appEnv !== "production") {
    return {
      allowed: false,
      reason: "Marketing email is disabled outside production.",
    };
  }
  if (!input.emailMarketingEnabled) {
    return {
      allowed: false,
      reason: "EMAIL_MARKETING_ENABLED is false.",
    };
  }
  return { allowed: true, reason: "Marketing email is allowed in production." };
}

export function assertMarketingSendAllowed(input: MarketingSendInput): void {
  const decision = marketingSendDecision(input);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}
