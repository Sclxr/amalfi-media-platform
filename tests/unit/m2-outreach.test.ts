import { describe, expect, it, vi } from "vitest";
import { assertDraftOnlyScopes, botAllows, generateApiKey, hashApiKey, apiKeyMatches } from "@/lib/api-key";
import { campaignSendPlan, campaignTransition } from "@/lib/campaign-flow";
import {
  CAN_SPAM_ADDRESS_LINES,
  listUnsubscribeHeaders,
  readUnsubscribeToken,
  renderCampaignHtml,
  signUnsubscribeToken,
} from "@/lib/canspam";
import { parseCsv } from "@/lib/csv";
import { sendViaGmail } from "@/lib/gmail";
import { guessImportMapping, previewImport } from "@/lib/import-preview";
import { marketingSendDecision } from "@/lib/marketing";
import { leadMatchesSegment } from "@/lib/segments";
import { stagingGate } from "@/lib/staging-gate";

describe("csv import", () => {
  const csv = [
    "First name,Last name,Email,Phone,Brokerage,City",
    "Riley,Stone,Riley.Stone@example.com,(321) 555-0101,Lakeside Realty,Orlando",
    "Maya,Ellison,maya.ellison@example.com,321-555-0198,Lakeside Realty,Orlando",
    "Bad,Row,not-an-email,,,",
    "Ada,Lovelace,ada@example.com,321-555-0101,New Office,Tampa",
  ].join("\n");

  it("maps columns and reports duplicates and errors before anything is written", () => {
    const table = parseCsv(csv);
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    const mapping = guessImportMapping(table.table.headers);
    expect(mapping.Email).toBe("email");
    const preview = previewImport({
      headers: table.table.headers,
      rows: table.table.rows,
      mapping,
      existing: [{ emailNormalized: "maya.ellison@example.com", phoneE164: "+13215550198" }],
      existingBrokerageKeys: ["lakeside-realty"],
    });
    expect(preview.summary).toEqual({ create: 1, merge: 2, error: 1 });
    expect(preview.rows[0]?.action).toBe("create");
    expect(preview.rows[0]?.phoneE164).toBe("+13215550101");
    expect(preview.rows[1]?.action).toBe("merge");
    expect(preview.rows[2]?.errors.join(" ")).toContain("not valid");
    expect(preview.rows[3]?.action).toBe("merge");
    expect(preview.rows[3]?.warnings.join(" ")).toContain("earlier row");
    expect(preview.createdBrokerages).toEqual(["New Office"]);
  });
});

describe("campaign approval and the marketing kill switch", () => {
  it("keeps the production kill switch and blocks send outside production", () => {
    expect(
      marketingSendDecision({ appEnv: "staging", emailMarketingEnabled: false }).allowed,
    ).toBe(false);
    const plan = campaignSendPlan({
      status: "APPROVED",
      appEnv: "staging",
      emailMarketingEnabled: false,
    });
    expect(plan.deliver).toBe(false);
    if (!plan.deliver) expect(plan.reason).toBe("Marketing email is disabled outside production.");
  });

  it("requires approval before a stub send, and still does not call Gmail", () => {
    expect(campaignTransition({ status: "DRAFT", action: "submit", canApprove: false }).ok).toBe(true);
    const denied = campaignTransition({ status: "PENDING_APPROVAL", action: "approve", canApprove: false });
    expect(denied.ok).toBe(false);
    const approved = campaignTransition({ status: "PENDING_APPROVAL", action: "approve", canApprove: true });
    expect(approved.ok).toBe(true);
    const live = campaignSendPlan({ status: "APPROVED", appEnv: "production", emailMarketingEnabled: true });
    expect(live.deliver).toBe(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const gmail = sendViaGmail(
      { to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", headers: {} },
      { enabled: true },
    );
    expect(gmail.liveCall).toBe(false);
    expect(gmail.reason).toContain("No live call");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("renders the Orlando address, unsubscribe link, and one-click header", () => {
    const token = signUnsubscribeToken("Maya.Ellison@example.com", "test-only-encryption-key-32chars!");
    expect(readUnsubscribeToken(token, "test-only-encryption-key-32chars!")).toBe("maya.ellison@example.com");
    const html = renderCampaignHtml({ body: "Hello", unsubscribeHref: "https://app.example/api/unsubscribe?token=1" });
    expect(html).toContain("Orlando, FL");
    expect(html).toContain("Unsubscribe");
    expect(CAN_SPAM_ADDRESS_LINES).toContain("Orlando, FL");
    expect(listUnsubscribeHeaders("https://app.example/api/unsubscribe?token=1")["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("drops do-not-contact realtors from a segment", () => {
    expect(
      leadMatchesSegment(
        { status: "DO_NOT_CONTACT", city: "Orlando", tags: [], emailNormalized: "a@example.com" },
        {},
      ),
    ).toBe(false);
    expect(
      leadMatchesSegment(
        { status: "ENGAGED", city: "Orlando", tags: ["vip"], emailNormalized: "a@example.com" },
        { cities: ["orlando"], tags: ["VIP"] },
      ),
    ).toBe(true);
  });
});

describe("marketing bot keys", () => {
  it("issues draft scopes and refuses a send scope", () => {
    expect(assertDraftOnlyScopes(["leads:write", "campaigns:draft"])).toEqual(["leads:write", "campaigns:draft"]);
    expect(() => assertDraftOnlyScopes(["campaigns:send"])).toThrow(/draft-only/);
    expect(botAllows(["leads:write", "campaigns:send"], "campaigns:send")).toBe(false);
    const key = generateApiKey();
    expect(key.token.startsWith(`amalfi_${key.prefix}_`)).toBe(true);
    expect(apiKeyMatches(key.token, hashApiKey(key.token))).toBe(true);
    expect(apiKeyMatches("amalfi_other", key.hash)).toBe(false);
  });
});

describe("staging unsubscribe", () => {
  it("lets the unsubscribe link through the staging gate", () => {
    expect(
      stagingGate({
        appEnv: "staging",
        basicAuth: "preview:secret",
        authorizationHeader: null,
        pathname: "/api/unsubscribe",
      }).action,
    ).toBe("allow");
  });
});
