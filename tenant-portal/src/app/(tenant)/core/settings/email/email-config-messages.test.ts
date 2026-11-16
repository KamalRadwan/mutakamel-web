import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import {
  CONFIG_INVALID_CODE,
  DKIM_PROOF_NOT_REGISTERED_CODE,
  QUOTA_EXCEEDS_PLAN_CODE,
  SMTP_CONNECTION_FAILED_CODE,
  toEmailConfigForm,
} from "./email-config-contract";
import { emailConfigMessage, validateEmailConfigDraft } from "./email-config-messages";
import { buildEmailErrorSummaryItems, modalForEmailField } from "./email-form-navigation";
import { parseEmailConfigResponse } from "./email-config-response";

const baseConfig = parseEmailConfigResponse({
  revision: 3,
  fromAddress: "support@acme.example",
  fromName: "Acme",
  replyTo: null,
  senderDomain: "acme.example",
  providerDriver: "smtp",
  credentialsMode: "TENANT_ENCRYPTED_SMTP",
  providerCredentialsConfigured: true,
  providerCredentialsVersion: 1,
  providerCredentialsRefFingerprint: null,
  smtpHost: "smtp.acme.example",
  smtpPort: 465,
  smtpSecure: true,
  smtpProtocol: "smtps",
  smtpUsername: "mailer",
  smtpPasswordConfigured: true,
  feedbackProfile: null,
  dkimSelector: "s1",
  dkimVerified: true,
  verifiedAt: "2026-10-20T09:00:00.000Z",
  planDailyQuota: 2000,
  planRateLimitPerMin: 120,
  planQuotaRevision: 1,
  dailyQuota: null,
  rateLimitPerMin: null,
  effectiveDailyQuota: 2000,
  effectiveRateLimitPerMin: 120,
  status: "ACTIVE",
  updatedAt: "2026-10-20T09:05:00.000Z",
});

describe.each([
  { language: "ar", t: ar },
  { language: "en", t: en },
])("email configuration messages in $language", ({ t }) => {
  it("maps invalid configuration to translated corrective guidance", () => {
    expect(CONFIG_INVALID_CODE).toBe("TENANT_EMAIL_CONFIG_INVALID");
    expect(emailConfigMessage("TENANT_EMAIL_CONFIG_INVALID", t)).toBe(t.coreSettings.emailConfigInvalid);
    expect(t.coreSettings.emailConfigInvalid.length).toBeGreaterThan(0);
  });

  it("distinguishes an access policy refusal from missing provisioning", () => {
    expect(emailConfigMessage("ACCESS_POLICY_BLOCKED", t)).toBe(t.coreSettings.emailAccessBlocked);
    expect(t.coreSettings.emailNotEntitledTitle).not.toBe(t.coreSettings.emailNotReadyTitle);
  });

  it("maps the tenant SMTP failure and quota-exceeds-plan code to localized guidance", () => {
    expect(SMTP_CONNECTION_FAILED_CODE).toBe("TENANT_SMTP_CONNECTION_FAILED");
    expect(emailConfigMessage("TENANT_SMTP_CONNECTION_FAILED", t)).toBe(
      t.coreSettings.emailSmtpConnectionFailed,
    );
    expect(QUOTA_EXCEEDS_PLAN_CODE).toBe("TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN");
    expect(emailConfigMessage(QUOTA_EXCEEDS_PLAN_CODE, t)).toBe(
      t.coreSettings.emailQuotaExceedsPlan,
    );
  });

  it("maps an unregistered DKIM tuple to registration guidance", () => {
    expect(DKIM_PROOF_NOT_REGISTERED_CODE).toBe("TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED");
    expect(emailConfigMessage("TENANT_EMAIL_CONFIG_DKIM_PROOF_NOT_REGISTERED", t)).toBe(
      t.coreSettings.emailDkimProofNotRegistered,
    );
  });

  it("keeps dependency failures and provisioning state distinct", () => {
    expect(emailConfigMessage("TENANT_EMAIL_CONFIG_DEPENDENCY_UNAVAILABLE", t)).toBe(
      t.coreSettings.emailDependencyUnavailable,
    );
    expect(emailConfigMessage("TENANT_EMAIL_CONFIG_NOT_READY", t)).toBe(
      t.coreSettings.emailNotReadyDescription,
    );
    expect(emailConfigMessage("SMTP_CONNECTION_VERIFICATION_FAILED", t)).toBeUndefined();
  });

  it("validates domain mismatch and SMTPS secure requirement and routes fields to modals", () => {
    const errors = validateEmailConfigDraft(
      baseConfig,
      {
        ...toEmailConfigForm(baseConfig),
        fromAddress: "support@other.example",
        smtpProtocol: "smtps",
        smtpSecure: false,
      },
      t,
    );
    expect(errors).toEqual({
      fromAddress: formatTemplate(t.coreSettings.emailFormDomainMismatch, {
        domain: "acme.example",
      }),
      smtpSecure: t.coreSettings.emailFormSmtpsRequiresSecure,
    });

    const summary = buildEmailErrorSummaryItems(errors, ["fromAddress", "smtpSecure"], t);
    expect(summary).toHaveLength(2);
    expect(summary[0]?.anchorId).toBe("email-field-fromAddress");
    expect(modalForEmailField("smtpHost", "sender")).toBe("smtp");
    expect(modalForEmailField("dkimSelector", "sender")).toBe("dns");
    expect(modalForEmailField("dailyQuota", "sender")).toBe("limits");
    expect(modalForEmailField("rateLimitPerMin", "sender")).toBe("limits");
  });

  it("validates whole-number and plan-cap quota constraints with localized messages", () => {
    const nonWholeErrors = validateEmailConfigDraft(
      baseConfig,
      {
        ...toEmailConfigForm(baseConfig),
        dailyQuota: "0",
        rateLimitPerMin: "12.5",
      },
      t,
    );
    expect(nonWholeErrors).toEqual({
      dailyQuota: formatTemplate(t.coreSettings.emailFormLimitWholeNumber, { max: "2,000" }),
      rateLimitPerMin: formatTemplate(t.coreSettings.emailFormLimitWholeNumber, { max: "120" }),
    });

    const overPlanErrors = validateEmailConfigDraft(
      baseConfig,
      {
        ...toEmailConfigForm(baseConfig),
        dailyQuota: "2001",
        rateLimitPerMin: "121",
      },
      t,
    );
    expect(overPlanErrors).toEqual({
      dailyQuota: formatTemplate(t.coreSettings.emailFormLimitExceedsPlan, { max: "2,000" }),
      rateLimitPerMin: formatTemplate(t.coreSettings.emailFormLimitExceedsPlan, { max: "120" }),
    });

    const summary = buildEmailErrorSummaryItems(
      overPlanErrors,
      ["dailyQuota", "rateLimitPerMin"],
      t,
    );
    expect(summary.map((item) => item.anchorId)).toEqual([
      "email-field-dailyQuota",
      "email-field-rateLimitPerMin",
    ]);
  });
});
