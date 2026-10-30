export type GmailMessage = {
  to: string;
  subject: string;
  html: string;
  headers: Record<string, string>;
};

export type GmailSendResult = {
  sent: false;
  liveCall: false;
  reason: string;
};

/**
 * Gmail is not called. `enabled` only changes the message so a future OAuth
 * client can be swapped in without changing campaign code. See docs/GMAIL_OAUTH.md.
 */
export function sendViaGmail(_message: GmailMessage, options: { enabled: boolean }): GmailSendResult {
  if (!options.enabled) {
    return { sent: false, liveCall: false, reason: "Gmail API is off. No live call was made." };
  }
  return {
    sent: false,
    liveCall: false,
    reason: "Gmail API is stubbed. No live call was made.",
  };
}
