import { describe, expect, it } from "vitest";
import {
  EMAIL_CONFIG_PATH,
  buildPatchEmailConfigRequest,
  dkimRecordHost,
  ifMatchHeaderValue,
  readRevisionFromEtag,
  toEmailConfigForm,
} from "./email-config-contract";
import {
  parseEmailConfigResponse,
  parseVerifyConnectionResponse,
} from "./email-config-response";

const config = {
  revision: 7,
  fromAddress: "billing@acme.example",
  fromName: "Acme Billing",
  replyTo: null,
  senderDomain: "acme.example",
  providerDriver: "smtp",
  credentialsMode: "TENANT_ENCRYPTED_SMTP",
  providerCredentialsConfigured: true,
  providerCredentialsVersion: 3,
  providerCredentialsRefFingerprint: "fp",
  smtpHost: "smtp.acme.example",
  smtpPort: 587,
  smtpSecure: true,
  smtpProtocol: "smtp",
  smtpUsername: "acme",
  smtpPasswordConfigured: true,
  feedbackProfile: null,
  dkimSelector: "s1",
  dkimVerified: false,
  verifiedAt: null,
  planDailyQuota: 1000,
  planRateLimitPerMin: 60,
  planQuotaRevision: 2,
  dailyQuota: null,
  rateLimitPerMin: null,
  effectiveDailyQuota: 1000,
  effectiveRateLimitPerMin: 60,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core email-config contract", () => {
  it("uses the canonical Gateway path", () => {
    expect(EMAIL_CONFIG_PATH).toBe("/api/tenant/core/v1/email-config");
  });

  it("accepts only an exact strong ETag — never a weak one", () => {
    expect(readRevisionFromEtag(new Headers({ ETag: '"7"' }))).toBe(7);
    expect(readRevisionFromEtag(new Headers({ ETag: 'W/"7"' }))).toBeNull();
    expect(readRevisionFromEtag(new Headers({ ETag: "7" }))).toBeNull();
    expect(readRevisionFromEtag(new Headers({ ETag: '"0"' }))).toBeNull();
    expect(readRevisionFromEtag(new Headers())).toBeNull();
  });

  it("emits the exact strong If-Match the controller parses", () => {
    expect(ifMatchHeaderValue(7)).toBe('"7"');
    expect(() => ifMatchHeaderValue(0)).toThrow("EMAIL_FORM_REVISION");
    expect(() => ifMatchHeaderValue(-1)).toThrow("EMAIL_FORM_REVISION");
  });

  it("never pre-fills the write-only password, and never clears it on save", () => {
    const parsed = parseEmailConfigResponse(config);
    const form = toEmailConfigForm(parsed);

    // A masked placeholder would be a value the client never received.
    expect(form.smtpPassword).toBe("");

    const request = buildPatchEmailConfigRequest(parsed, { ...form, fromName: "Acme Invoicing" });
    expect(request).toEqual({ fromName: "Acme Invoicing" });
    expect("smtpPassword" in request).toBe(false);
  });

  it("sends the password only when it was actually retyped", () => {
    const parsed = parseEmailConfigResponse(config);
    const form = toEmailConfigForm(parsed);

    expect(
      buildPatchEmailConfigRequest(parsed, { ...form, smtpPassword: "new-secret" }),
    ).toEqual({ smtpPassword: "new-secret" });
  });

  it("sends nothing at all when nothing changed", () => {
    const parsed = parseEmailConfigResponse(config);
    expect(buildPatchEmailConfigRequest(parsed, toEmailConfigForm(parsed))).toEqual({});
  });

  it("rejects an SMTP port outside SMTP_ALLOWED_PORTS", () => {
    const parsed = parseEmailConfigResponse(config);
    const form = toEmailConfigForm(parsed);

    expect(() => buildPatchEmailConfigRequest(parsed, { ...form, smtpPort: "26" })).toThrow(
      "EMAIL_FORM_SMTP_PORT",
    );
    expect(
      buildPatchEmailConfigRequest(parsed, { ...form, smtpPort: "465" }),
    ).toEqual({ smtpPort: 465 });
  });

  it("clears replyTo with an explicit null rather than an empty string", () => {
    const parsed = parseEmailConfigResponse({ ...config, replyTo: "reply@acme.example" });
    const form = toEmailConfigForm(parsed);

    expect(buildPatchEmailConfigRequest(parsed, { ...form, replyTo: "" })).toEqual({
      replyTo: null,
    });
  });

  it("derives the DKIM host exactly as the verification adapter looks it up", () => {
    const parsed = parseEmailConfigResponse(config);
    expect(dkimRecordHost(parsed)).toBe("s1._domainkey.acme.example");
    expect(dkimRecordHost({ ...parsed, dkimSelector: null })).toBeNull();
  });

  it("rejects a projection that carries an unknown provider driver", () => {
    expect(() => parseEmailConfigResponse({ ...config, providerDriver: "mailgun" })).toThrow(
      "Invalid Core email-config response.",
    );
  });

  it("accepts only the exact verify-connection result", () => {
    expect(parseVerifyConnectionResponse({ verified: true })).toBe(true);
    expect(() => parseVerifyConnectionResponse({ verified: false })).toThrow(
      "Invalid Core email-config response.",
    );
  });
});
