import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  toEmailConfigForm,
  type EmailConfig,
  type EmailConfigFormValues,
} from "./email-config-contract";
import { formatConflictQuotaValue } from "./email-quota-contract";

export interface EmailConflictDiffRow {
  key: string;
  label: string;
  draftValue: string;
  latestValue: string;
  isIdentifier?: boolean;
}

export interface EmailConflictReview {
  latestConfig: EmailConfig;
  latestRevision: number;
  diffRows: EmailConflictDiffRow[];
}

function formatBooleanLabel(value: boolean, t: Dictionary): string {
  return value ? t.crmShared.booleanYes : t.crmShared.booleanNo;
}

function formatOptionalValue(value: string, emptyFallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : emptyFallback;
}

/** True when another session modified any persisted config field relative to `baseline`. */
export function hasServerConfigChanged(baseline: EmailConfig, latest: EmailConfig): boolean {
  return (
    baseline.fromName !== latest.fromName ||
    baseline.fromAddress !== latest.fromAddress ||
    baseline.replyTo !== latest.replyTo ||
    baseline.senderDomain !== latest.senderDomain ||
    baseline.providerDriver !== latest.providerDriver ||
    baseline.smtpHost !== latest.smtpHost ||
    baseline.smtpPort !== latest.smtpPort ||
    baseline.smtpSecure !== latest.smtpSecure ||
    baseline.smtpProtocol !== latest.smtpProtocol ||
    baseline.smtpUsername !== latest.smtpUsername ||
    baseline.smtpPasswordConfigured !== latest.smtpPasswordConfigured ||
    baseline.providerCredentialsVersion !== latest.providerCredentialsVersion ||
    baseline.dkimSelector !== latest.dkimSelector ||
    baseline.dkimVerified !== latest.dkimVerified ||
    baseline.status !== latest.status ||
    baseline.planDailyQuota !== latest.planDailyQuota ||
    baseline.planRateLimitPerMin !== latest.planRateLimitPerMin ||
    baseline.planQuotaRevision !== latest.planQuotaRevision ||
    baseline.dailyQuota !== latest.dailyQuota ||
    baseline.rateLimitPerMin !== latest.rateLimitPerMin ||
    baseline.effectiveDailyQuota !== latest.effectiveDailyQuota ||
    baseline.effectiveRateLimitPerMin !== latest.effectiveRateLimitPerMin
  );
}

/**
 * Compares user draft edits against `baseline` AND server `latest` against `baseline`,
 * surfacing every field that changed on either side without exposing secrets or raw enums.
 */
export function compareEmailConfigConflict(
  baseline: EmailConfig,
  draft: EmailConfigFormValues,
  latest: EmailConfig,
  t: Dictionary,
  lang: "en" | "ar",
): EmailConflictDiffRow[] {
  const baseForm = toEmailConfigForm(baseline);
  const latestForm = toEmailConfigForm(latest);
  const rows: EmailConflictDiffRow[] = [];
  const notConfigured = t.coreSettings.emailNotConfigured;

  const pushIfChanged = (
    key: string,
    changed: boolean,
    label: string,
    draftValue: string,
    latestValue: string,
    isIdentifier?: boolean,
  ) => {
    if (!changed) return;
    rows.push({ key, label, draftValue, latestValue, isIdentifier });
  };

  pushIfChanged(
    "fromName",
    draft.fromName.trim() !== baseForm.fromName || latestForm.fromName !== baseForm.fromName,
    t.coreSettings.emailFromName,
    formatOptionalValue(draft.fromName, notConfigured),
    formatOptionalValue(latestForm.fromName, notConfigured),
  );
  pushIfChanged(
    "fromAddress",
    draft.fromAddress.trim() !== baseForm.fromAddress || latestForm.fromAddress !== baseForm.fromAddress,
    t.coreSettings.emailFromAddress,
    formatOptionalValue(draft.fromAddress, notConfigured),
    formatOptionalValue(latestForm.fromAddress, notConfigured),
    true,
  );
  pushIfChanged(
    "replyTo",
    draft.replyTo.trim() !== baseForm.replyTo || latestForm.replyTo !== baseForm.replyTo,
    t.coreSettings.emailReplyTo,
    formatOptionalValue(draft.replyTo, t.coreSettings.emailReplyToSameAsFrom),
    formatOptionalValue(latestForm.replyTo, t.coreSettings.emailReplyToSameAsFrom),
    true,
  );
  pushIfChanged(
    "senderDomain",
    draft.senderDomain.trim() !== baseForm.senderDomain ||
      latestForm.senderDomain !== baseForm.senderDomain,
    t.coreSettings.emailSenderDomain,
    formatOptionalValue(draft.senderDomain, notConfigured),
    formatOptionalValue(latestForm.senderDomain, notConfigured),
    true,
  );
  pushIfChanged(
    "providerDriver",
    draft.providerDriver !== baseForm.providerDriver ||
      latestForm.providerDriver !== baseForm.providerDriver,
    t.coreSettings.emailProvider,
    t.coreSettings.emailProviderNames[draft.providerDriver],
    t.coreSettings.emailProviderNames[latestForm.providerDriver],
  );
  pushIfChanged(
    "smtpHost",
    draft.smtpHost.trim() !== baseForm.smtpHost || latestForm.smtpHost !== baseForm.smtpHost,
    t.coreSettings.emailSmtpHost,
    formatOptionalValue(draft.smtpHost, notConfigured),
    formatOptionalValue(latestForm.smtpHost, notConfigured),
    true,
  );
  pushIfChanged(
    "smtpPort",
    draft.smtpPort.trim() !== baseForm.smtpPort || latestForm.smtpPort !== baseForm.smtpPort,
    t.coreSettings.emailSmtpPort,
    formatOptionalValue(draft.smtpPort, notConfigured),
    formatOptionalValue(latestForm.smtpPort, notConfigured),
    true,
  );
  pushIfChanged(
    "smtpProtocol",
    draft.smtpProtocol !== baseForm.smtpProtocol || latestForm.smtpProtocol !== baseForm.smtpProtocol,
    t.coreSettings.emailSmtpProtocol,
    t.coreSettings.emailSmtpProtocolNames[draft.smtpProtocol],
    t.coreSettings.emailSmtpProtocolNames[latestForm.smtpProtocol],
  );
  pushIfChanged(
    "smtpSecure",
    draft.smtpSecure !== baseForm.smtpSecure || latest.smtpSecure !== baseline.smtpSecure,
    t.coreSettings.emailSmtpSecure,
    formatBooleanLabel(draft.smtpSecure, t),
    formatBooleanLabel(latestForm.smtpSecure, t),
  );
  pushIfChanged(
    "smtpUsername",
    draft.smtpUsername.trim() !== baseForm.smtpUsername ||
      latestForm.smtpUsername !== baseForm.smtpUsername,
    t.coreSettings.emailSmtpUsername,
    formatOptionalValue(draft.smtpUsername, notConfigured),
    formatOptionalValue(latestForm.smtpUsername, notConfigured),
    true,
  );

  const serverCredentialsChanged =
    latest.providerCredentialsVersion !== baseline.providerCredentialsVersion ||
    latest.smtpPasswordConfigured !== baseline.smtpPasswordConfigured;
  pushIfChanged(
    "smtpPassword",
    draft.smtpPassword.length > 0 || serverCredentialsChanged,
    t.coreSettings.emailSmtpPassword,
    draft.smtpPassword.length > 0
      ? t.coreSettings.emailConflictPasswordUpdated
      : baseline.smtpPasswordConfigured
        ? t.coreSettings.emailConfigured
        : notConfigured,
    serverCredentialsChanged
      ? t.coreSettings.emailConflictCredentialsChanged
      : latest.smtpPasswordConfigured
        ? t.coreSettings.emailConfigured
        : notConfigured,
  );

  pushIfChanged(
    "dkimSelector",
    draft.dkimSelector.trim() !== baseForm.dkimSelector ||
      latestForm.dkimSelector !== baseForm.dkimSelector,
    t.coreSettings.emailDkimSelector,
    formatOptionalValue(draft.dkimSelector, notConfigured),
    formatOptionalValue(latestForm.dkimSelector, notConfigured),
    true,
  );
  pushIfChanged(
    "dkimVerified",
    latest.dkimVerified !== baseline.dkimVerified,
    t.coreSettings.emailVerificationTitle,
    baseline.dkimVerified ? t.coreSettings.emailDkimVerified : t.coreSettings.emailDkimUnverified,
    latest.dkimVerified ? t.coreSettings.emailDkimVerified : t.coreSettings.emailDkimUnverified,
  );
  pushIfChanged(
    "status",
    draft.status !== baseForm.status || latestForm.status !== baseForm.status,
    t.coreSettings.emailDeliveryStatusTitle,
    t.coreSettings.emailStatusNames[draft.status],
    t.coreSettings.emailStatusNames[latestForm.status],
  );
  pushIfChanged(
    "dailyQuota",
    draft.dailyQuota.trim() !== baseForm.dailyQuota ||
      latestForm.dailyQuota !== baseForm.dailyQuota ||
      latest.planDailyQuota !== baseline.planDailyQuota ||
      latest.effectiveDailyQuota !== baseline.effectiveDailyQuota,
    t.coreSettings.emailDailyLimitLabel,
    formatConflictQuotaValue(draft.dailyQuota, baseline.planDailyQuota, t, lang),
    formatConflictQuotaValue(latestForm.dailyQuota, latest.planDailyQuota, t, lang),
  );
  pushIfChanged(
    "rateLimitPerMin",
    draft.rateLimitPerMin.trim() !== baseForm.rateLimitPerMin ||
      latestForm.rateLimitPerMin !== baseForm.rateLimitPerMin ||
      latest.planRateLimitPerMin !== baseline.planRateLimitPerMin ||
      latest.effectiveRateLimitPerMin !== baseline.effectiveRateLimitPerMin,
    t.coreSettings.emailPerMinuteLimitLabel,
    formatConflictQuotaValue(draft.rateLimitPerMin, baseline.planRateLimitPerMin, t, lang),
    formatConflictQuotaValue(latestForm.rateLimitPerMin, latest.planRateLimitPerMin, t, lang),
  );

  return rows;
}

/**
 * Adopts `latest` for fields the user did NOT touch relative to `baseline` while
 * preserving every field edited in `draft` (including custom quota overrides and `smtpPassword`).
 */
export function mergeDraftOntoLatestConfig(
  baseline: EmailConfig,
  draft: EmailConfigFormValues,
  latest: EmailConfig,
): EmailConfigFormValues {
  const baseForm = toEmailConfigForm(baseline);
  const latestForm = toEmailConfigForm(latest);

  return {
    fromAddress:
      draft.fromAddress.trim() !== baseForm.fromAddress ? draft.fromAddress : latestForm.fromAddress,
    fromName: draft.fromName.trim() !== baseForm.fromName ? draft.fromName : latestForm.fromName,
    replyTo: draft.replyTo.trim() !== baseForm.replyTo ? draft.replyTo : latestForm.replyTo,
    senderDomain:
      draft.senderDomain.trim() !== baseForm.senderDomain
        ? draft.senderDomain
        : latestForm.senderDomain,
    dkimSelector:
      draft.dkimSelector.trim() !== baseForm.dkimSelector
        ? draft.dkimSelector
        : latestForm.dkimSelector,
    providerDriver:
      draft.providerDriver !== baseForm.providerDriver
        ? draft.providerDriver
        : latestForm.providerDriver,
    smtpHost: draft.smtpHost.trim() !== baseForm.smtpHost ? draft.smtpHost : latestForm.smtpHost,
    smtpPort: draft.smtpPort.trim() !== baseForm.smtpPort ? draft.smtpPort : latestForm.smtpPort,
    smtpSecure: draft.smtpSecure !== baseForm.smtpSecure ? draft.smtpSecure : latestForm.smtpSecure,
    smtpProtocol:
      draft.smtpProtocol !== baseForm.smtpProtocol ? draft.smtpProtocol : latestForm.smtpProtocol,
    smtpUsername:
      draft.smtpUsername.trim() !== baseForm.smtpUsername
        ? draft.smtpUsername
        : latestForm.smtpUsername,
    smtpPassword: draft.smtpPassword,
    status: draft.status !== baseForm.status ? draft.status : latestForm.status,
    dailyQuota:
      draft.dailyQuota.trim() !== baseForm.dailyQuota ? draft.dailyQuota : latestForm.dailyQuota,
    rateLimitPerMin:
      draft.rateLimitPerMin.trim() !== baseForm.rateLimitPerMin
        ? draft.rateLimitPerMin
        : latestForm.rateLimitPerMin,
  };
}
