import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import {
  compareEmailConfigConflict,
  hasServerConfigChanged,
  mergeDraftOntoLatestConfig,
} from "./email-config-conflict";
import {
  DEPENDENCY_UNAVAILABLE_CODE,
  EMAIL_CONFIG_PATH,
  SELECTABLE_EMAIL_PROVIDER_DRIVERS,
  SMTP_CONNECTION_FAILED_CODE,
  buildPatchEmailConfigRequest,
  canSelectEmailConfigStatus,
  dkimRecordHost,
  hasEmailConfigChanges,
  ifMatchHeaderValue,
  readRevisionFromEtag,
  toEmailConfigForm,
  willResetVerificationTuple,
} from "./email-config-contract";
import {
  describeEmailConfigApiError,
  validateEmailConfigDraft,
} from "./email-config-messages";
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
  feedbackProfile: "CRM_FEEDBACK_V1",
  dkimSelector: "s1",
  dkimVerified: false,
  verifiedAt: null,
  planDailyQuota: 2000,
  planRateLimitPerMin: 120,
  planQuotaRevision: 2,
  dailyQuota: 1000,
  rateLimitPerMin: 60,
  effectiveDailyQuota: 1000,
  effectiveRateLimitPerMin: 60,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

describe("Core email-config contract", () => {
  it("uses the canonical Gateway path", () => {
    expect(EMAIL_CONFIG_PATH).toBe("/api/tenant/core/v1/email-config");
  });

  it("projects and validates all 28 safe GET fields including plan caps, overrides, and feedbackProfile", () => {
    const parsed = parseEmailConfigResponse(config);
    expect(parsed.feedbackProfile).toBe("CRM_FEEDBACK_V1");
    expect(parsed.planDailyQuota).toBe(2000);
    expect(parsed.planRateLimitPerMin).toBe(120);
    expect(parsed.planQuotaRevision).toBe(2);
    expect(parsed.dailyQuota).toBe(1000);
    expect(parsed.rateLimitPerMin).toBe(60);

    const nullOverrides = parseEmailConfigResponse({
      ...config,
      feedbackProfile: null,
      dailyQuota: null,
      rateLimitPerMin: null,
    });
    expect(nullOverrides.feedbackProfile).toBeNull();
    expect(nullOverrides.dailyQuota).toBeNull();
    expect(nullOverrides.rateLimitPerMin).toBeNull();

    for (const invalidPatch of [
      { feedbackProfile: "RAW_FEEDBACK" },
      { planDailyQuota: 0 },
      { planDailyQuota: 1_000_001 },
      { planRateLimitPerMin: 0 },
      { planRateLimitPerMin: 10_001 },
      { planQuotaRevision: 0 },
      { dailyQuota: 0 },
      { dailyQuota: 1_000_001 },
      { rateLimitPerMin: 0 },
      { rateLimitPerMin: 10_001 },
    ]) {
      expect(() => parseEmailConfigResponse({ ...config, ...invalidPatch })).toThrow(
        "Invalid Core email-config response.",
      );
    }
  });

  it("never includes plan fields, effective caps, or feedbackProfile in PATCH payloads", () => {
    const parsed = parseEmailConfigResponse(config);
    const request = buildPatchEmailConfigRequest(parsed, {
      ...toEmailConfigForm(parsed),
      fromName: "Acme Accounts",
      dailyQuota: "1500",
      rateLimitPerMin: "",
    });
    expect(request).toEqual({
      fromName: "Acme Accounts",
      smtpSecure: true,
      smtpProtocol: "smtp",
      dailyQuota: 1500,
      rateLimitPerMin: null,
    });
    expect("feedbackProfile" in request).toBe(false);
    expect("planDailyQuota" in request).toBe(false);
    expect("planRateLimitPerMin" in request).toBe(false);
    expect("planQuotaRevision" in request).toBe(false);
    expect("effectiveDailyQuota" in request).toBe(false);
    expect("effectiveRateLimitPerMin" in request).toBe(false);
  });

  it("keeps equivalent integer quota input clean while distinguishing inherited limits", () => {
    const saved = parseEmailConfigResponse(config);
    const equivalent = { ...toEmailConfigForm(saved), dailyQuota: "001000", rateLimitPerMin: "00060" };
    expect(validateEmailConfigDraft(saved, equivalent, en)).toEqual({});
    expect(hasEmailConfigChanges(saved, equivalent)).toBe(false);
    expect(buildPatchEmailConfigRequest(saved, equivalent)).toEqual({
      smtpSecure: true,
      smtpProtocol: "smtp",
    });
    expect(hasEmailConfigChanges(saved, { ...equivalent, dailyQuota: "" })).toBe(true);
    expect(hasEmailConfigChanges(saved, { ...equivalent, dailyQuota: "invalid" })).toBe(true);
  });

  it("treats null inherit-plan and explicit cap-equal integer overrides as independent distinct states and rejects invalid or over-cap values", () => {
    const inherited = parseEmailConfigResponse({
      ...config,
      dailyQuota: null,
      rateLimitPerMin: null,
      effectiveDailyQuota: 2000,
      effectiveRateLimitPerMin: 120,
    });
    const baseInheritedForm = toEmailConfigForm(inherited);
    expect(baseInheritedForm.dailyQuota).toBe("");
    expect(baseInheritedForm.rateLimitPerMin).toBe("");
    expect(hasEmailConfigChanges(inherited, baseInheritedForm)).toBe(false);

    // Explicit integer equal to planDailyQuota (2000) is dirty relative to null inherit-plan.
    const explicitCapEqual = { ...baseInheritedForm, dailyQuota: "2000" };
    expect(hasEmailConfigChanges(inherited, explicitCapEqual)).toBe(true);
    expect(buildPatchEmailConfigRequest(inherited, explicitCapEqual)).toEqual({
      dailyQuota: 2000,
      smtpSecure: true,
      smtpProtocol: "smtp",
    });

    // Clearing an explicit cap-equal integer back to "" emits null without touching rateLimitPerMin.
    const explicitSaved = parseEmailConfigResponse({
      ...config,
      dailyQuota: 2000,
      rateLimitPerMin: 120,
      effectiveDailyQuota: 2000,
      effectiveRateLimitPerMin: 120,
    });
    const resetDailyOnly = { ...toEmailConfigForm(explicitSaved), dailyQuota: "" };
    expect(hasEmailConfigChanges(explicitSaved, resetDailyOnly)).toBe(true);
    expect(buildPatchEmailConfigRequest(explicitSaved, resetDailyOnly)).toEqual({
      dailyQuota: null,
      smtpSecure: true,
      smtpProtocol: "smtp",
    });

    for (const invalidDaily of ["0", "-1", "10.5", "abc", "1000001"]) {
      expect(() =>
        buildPatchEmailConfigRequest(inherited, { ...baseInheritedForm, dailyQuota: invalidDaily }),
      ).toThrow("EMAIL_FORM_DAILY_QUOTA");
    }
    expect(() =>
      buildPatchEmailConfigRequest(inherited, { ...baseInheritedForm, dailyQuota: "2001" }),
    ).toThrow("EMAIL_FORM_DAILY_QUOTA_EXCEEDS_PLAN");

    for (const invalidRate of ["0", "-5", "1.2", "xyz", "10001"]) {
      expect(() =>
        buildPatchEmailConfigRequest(inherited, {
          ...baseInheritedForm,
          rateLimitPerMin: invalidRate,
        }),
      ).toThrow("EMAIL_FORM_RATE_LIMIT");
    }
    expect(() =>
      buildPatchEmailConfigRequest(inherited, { ...baseInheritedForm, rateLimitPerMin: "121" }),
    ).toThrow("EMAIL_FORM_RATE_LIMIT_EXCEEDS_PLAN");
  });

  it("detects server plan cap changes and preserves over-cap user quota drafts during conflict merge without clamping", () => {
    const baseline = parseEmailConfigResponse({
      ...config,
      dailyQuota: null,
      rateLimitPerMin: 60,
    });
    const draft = {
      ...toEmailConfigForm(baseline),
      dailyQuota: "1500",
    };
    const loweredPlanLatest = parseEmailConfigResponse({
      ...config,
      revision: 11,
      planDailyQuota: 1000,
      planQuotaRevision: 3,
      dailyQuota: null,
      rateLimitPerMin: 40,
      effectiveDailyQuota: 1000,
      effectiveRateLimitPerMin: 40,
    });

    expect(hasServerConfigChanged(baseline, loweredPlanLatest)).toBe(true);
    const diffRows = compareEmailConfigConflict(baseline, draft, loweredPlanLatest, en, "en");
    expect(diffRows.map((row) => row.key)).toEqual(["dailyQuota", "rateLimitPerMin"]);
    expect(diffRows[0]?.draftValue).toBe("1,500");
    expect(diffRows[0]?.latestValue).toBe(
      en.coreSettings.emailLimitPlanDefaultValue.replace("{max}", "1,000"),
    );

    const merged = mergeDraftOntoLatestConfig(baseline, draft, loweredPlanLatest);
    expect(merged.dailyQuota).toBe("1500");
    expect(merged.rateLimitPerMin).toBe("40");
  });

  it("offers only providers that can be configured without a versioned reference", () => {
    expect(SELECTABLE_EMAIL_PROVIDER_DRIVERS).toEqual(["smtp", "platform-shared"]);
    const parsed = parseEmailConfigResponse(config);
    expect(
      buildPatchEmailConfigRequest(parsed, {
        ...toEmailConfigForm(parsed),
        providerDriver: "platform-shared",
      }),
    ).toEqual({ providerDriver: "platform-shared" });
  });

  it.each(["ses", "sendgrid"] as const)(
    "rejects switching to %s but preserves existing configurations",
    (driver) => {
      const parsed = parseEmailConfigResponse(config);
      expect(() =>
        buildPatchEmailConfigRequest(parsed, {
          ...toEmailConfigForm(parsed),
          providerDriver: driver,
        }),
      ).toThrow("EMAIL_FORM_PROVIDER");

      const existing = parseEmailConfigResponse({ ...config, providerDriver: driver });
      expect(toEmailConfigForm(existing).providerDriver).toBe(driver);
      expect(
        buildPatchEmailConfigRequest(existing, {
          ...toEmailConfigForm(existing),
          fromName: "Updated sender",
        }),
      ).toEqual({ fromName: "Updated sender" });
    },
  );

  it.each([false, true])(
    "allows activation only with verified DKIM (verified: %s)",
    (dkimVerified) => {
      const parsed = parseEmailConfigResponse({ ...config, status: "SUSPENDED", dkimVerified });
      expect(canSelectEmailConfigStatus(parsed, "ACTIVE")).toBe(dkimVerified);
      expect(canSelectEmailConfigStatus(parsed, "SUSPENDED")).toBe(true);
      const activate = () =>
        buildPatchEmailConfigRequest(parsed, {
          ...toEmailConfigForm(parsed),
          status: "ACTIVE",
        });
      if (dkimVerified) {
        expect(activate()).toEqual({ status: "ACTIVE", smtpSecure: true, smtpProtocol: "smtp" });
      } else {
        expect(activate).toThrow("EMAIL_FORM_DKIM_REQUIRED");
        expect(
          buildPatchEmailConfigRequest(parsed, {
            ...toEmailConfigForm(parsed),
            fromName: "Updated sender",
          }),
        ).toEqual({ fromName: "Updated sender", smtpSecure: true, smtpProtocol: "smtp" });
      }
    },
  );

  it("permits suspension without verified DKIM", () => {
    const parsed = parseEmailConfigResponse(config);
    expect(
      buildPatchEmailConfigRequest(parsed, {
        ...toEmailConfigForm(parsed),
        status: "SUSPENDED",
      }),
    ).toEqual({ status: "SUSPENDED", smtpSecure: true, smtpProtocol: "smtp" });
  });

  it("enforces fromAddress/senderDomain alignment and smtps encrypted transport", () => {
    const parsed = parseEmailConfigResponse(config);
    expect(() =>
      buildPatchEmailConfigRequest(parsed, {
        ...toEmailConfigForm(parsed),
        fromAddress: "billing@other.example",
      }),
    ).toThrow("EMAIL_FORM_DOMAIN_MISMATCH");

    expect(() =>
      buildPatchEmailConfigRequest(parsed, {
        ...toEmailConfigForm(parsed),
        smtpProtocol: "smtps",
        smtpSecure: false,
      }),
    ).toThrow("EMAIL_FORM_SMTPS_SECURE");
  });

  it("detects verification-tuple changes accurately", () => {
    const parsed = parseEmailConfigResponse({ ...config, dkimVerified: true });
    const base = toEmailConfigForm(parsed);
    expect(willResetVerificationTuple(parsed, { ...base, fromName: "Renamed" })).toBe(false);
    expect(willResetVerificationTuple(parsed, { ...base, replyTo: "ops@acme.example" })).toBe(false);
    expect(willResetVerificationTuple(parsed, { ...base, senderDomain: "mail.acme.example" })).toBe(true);
    expect(willResetVerificationTuple(parsed, { ...base, dkimSelector: "s2" })).toBe(true);
    expect(willResetVerificationTuple(parsed, { ...base, providerDriver: "platform-shared" })).toBe(true);
  });

  it.each(["platform-shared", "ses", "sendgrid"] as const)(
    "requires a password when switching from %s to SMTP without a stored password",
    (driver) => {
      const parsed = parseEmailConfigResponse({
        ...config,
        providerDriver: driver,
        smtpPasswordConfigured: false,
      });
      const form = { ...toEmailConfigForm(parsed), providerDriver: "smtp" as const };
      expect(() => buildPatchEmailConfigRequest(parsed, form)).toThrow(
        "EMAIL_FORM_SMTP_PASSWORD_REQUIRED",
      );
      expect(
        buildPatchEmailConfigRequest(parsed, { ...form, smtpPassword: "new-secret" }),
      ).toEqual({
        providerDriver: "smtp",
        smtpPassword: "new-secret",
        smtpSecure: true,
        smtpProtocol: "smtp",
      });
    },
  );

  it("preserves a stored SMTP password when switching providers", () => {
    const parsed = parseEmailConfigResponse({ ...config, providerDriver: "platform-shared" });
    expect(
      buildPatchEmailConfigRequest(parsed, {
        ...toEmailConfigForm(parsed),
        providerDriver: "smtp",
      }),
    ).toEqual({ providerDriver: "smtp", smtpSecure: true, smtpProtocol: "smtp" });
  });

  it.each(["platform-shared", "ses", "sendgrid"] as const)(
    "sends SMTP defaults when switching from %s with null saved settings",
    (driver) => {
      const parsed = parseEmailConfigResponse({
        ...config,
        providerDriver: driver,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: null,
        smtpProtocol: null,
        smtpUsername: null,
        smtpPasswordConfigured: false,
      });
      const form = {
        ...toEmailConfigForm(parsed),
        providerDriver: "smtp" as const,
        smtpHost: "smtp.acme.example",
        smtpPort: "587",
        smtpUsername: "acme",
        smtpPassword: "new-secret",
      };

      expect(form.smtpSecure).toBe(false);
      expect(form.smtpProtocol).toBe("smtp");
      expect(buildPatchEmailConfigRequest(parsed, form)).toEqual({
        providerDriver: "smtp",
        smtpHost: "smtp.acme.example",
        smtpPort: 587,
        smtpSecure: false,
        smtpProtocol: "smtp",
        smtpUsername: "acme",
        smtpPassword: "new-secret",
      });
    },
  );

  it("never pre-fills the write-only password, and never clears it on save", () => {
    const parsed = parseEmailConfigResponse(config);
    const form = toEmailConfigForm(parsed);
    expect(form.smtpPassword).toBe("");
    const request = buildPatchEmailConfigRequest(parsed, { ...form, fromName: "Acme Invoicing" });
    expect(request).toEqual({ fromName: "Acme Invoicing", smtpSecure: true, smtpProtocol: "smtp" });
    expect("smtpPassword" in request).toBe(false);
  });

  it("accepts only an exact strong ETag and emits exact strong If-Match", () => {
    expect(readRevisionFromEtag(new Headers({ ETag: '"7"' }))).toBe(7);
    expect(readRevisionFromEtag(new Headers({ ETag: 'W/"7"' }))).toBeNull();
    expect(readRevisionFromEtag(new Headers({ ETag: "7" }))).toBeNull();
    expect(ifMatchHeaderValue(7)).toBe('"7"');
    expect(() => ifMatchHeaderValue(0)).toThrow("EMAIL_FORM_REVISION");
  });

  it("derives the DKIM host, clears replyTo with null, and validates verify-connection result", () => {
    const parsed = parseEmailConfigResponse({ ...config, replyTo: "reply@acme.example" });
    expect(dkimRecordHost(parsed)).toBe("s1._domainkey.acme.example");
    expect(dkimRecordHost({ ...parsed, dkimSelector: null })).toBeNull();
    expect(
      buildPatchEmailConfigRequest(parsed, { ...toEmailConfigForm(parsed), replyTo: "" }),
    ).toEqual({ replyTo: null, smtpSecure: true, smtpProtocol: "smtp" });
    expect(parseVerifyConnectionResponse({ verified: true })).toBe(true);
    expect(() => parseVerifyConnectionResponse({ verified: false })).toThrow(
      "Invalid Core email-config response.",
    );
  });

  it("diffs conflict changes without exposing secrets and merges unedited server fields cleanly", () => {
    const baseline = parseEmailConfigResponse(config);
    const draft = {
      ...toEmailConfigForm(baseline),
      fromName: "Draft Billing",
      smtpPassword: "super-secret-password",
    };
    const latest = parseEmailConfigResponse({
      ...config,
      revision: 9,
      replyTo: "accounts@acme.example",
      providerCredentialsVersion: 4,
    });

    expect(hasServerConfigChanged(baseline, latest)).toBe(true);
    const rows = compareEmailConfigConflict(baseline, draft, latest, en, "en");
    expect(rows.map((row) => row.key)).toEqual(["fromName", "replyTo", "smtpPassword"]);
    const passwordRow = rows.find((row) => row.key === "smtpPassword");
    expect(passwordRow?.draftValue).toBe(en.coreSettings.emailConflictPasswordUpdated);
    expect(passwordRow?.latestValue).toBe(en.coreSettings.emailConflictCredentialsChanged);
    expect(JSON.stringify(rows)).not.toContain("super-secret-password");
    expect(JSON.stringify(rows)).not.toContain('"fp"');

    const merged = mergeDraftOntoLatestConfig(baseline, draft, latest);
    expect(merged.fromName).toBe("Draft Billing");
    expect(merged.replyTo).toBe("accounts@acme.example");
    expect(merged.smtpPassword).toBe("super-secret-password");
    expect(hasEmailConfigChanges(latest, merged)).toBe(true);
  });

  it.each(["en", "ar"] as const)(
    "maps field and API errors to localized copy with correlation ID in %s",
    (language) => {
      const t = { en, ar }[language];
      const parsed = parseEmailConfigResponse({
        ...config,
        providerDriver: "platform-shared",
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPasswordConfigured: false,
      });
      const invalidDraft = {
        ...toEmailConfigForm(parsed),
        fromAddress: "",
        replyTo: "not-a-valid-email",
        dkimSelector: "INVALID CAPS",
        providerDriver: "smtp" as const,
      };
      expect(validateEmailConfigDraft(parsed, invalidDraft, t)).toEqual({
        fromAddress: t.coreSettings.emailFormFromAddress,
        replyTo: t.coreSettings.emailFormReplyTo,
        dkimSelector: t.coreSettings.emailFormDkimSelector,
        smtpHost: t.coreSettings.emailFormSmtpHost,
        smtpPort: t.coreSettings.emailFormSmtpPort,
        smtpUsername: t.coreSettings.emailFormSmtpUsername,
        smtpPassword: t.coreSettings.emailSmtpPasswordRequired,
      });

      const smtpFailed = describeEmailConfigApiError(
        {
          status: 422,
          code: SMTP_CONNECTION_FAILED_CODE,
          message: "raw english server error",
          correlationId: "corr-1",
        },
        t,
      );
      expect(smtpFailed).toContain(t.coreSettings.emailSmtpConnectionFailed);
      expect(smtpFailed).toContain("corr-1");
      expect(smtpFailed).not.toContain("raw english server error");

      const depFailed = describeEmailConfigApiError(
        { status: 503, code: DEPENDENCY_UNAVAILABLE_CODE, message: "upstream down", correlationId: "corr-2" },
        t,
      );
      expect(depFailed).toContain(t.coreSettings.emailDependencyUnavailable);
      expect(depFailed).toContain("corr-2");
    },
  );
});
