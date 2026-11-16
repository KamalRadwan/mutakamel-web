import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { EmailConfigFormValues } from "./email-config-contract";
import type { EmailConfigFieldErrors } from "./email-config-messages";

export type EmailModalKind = "sender" | "provider" | "smtp" | "dns" | "limits" | "probe";
export type EmailConfigFieldKey = keyof EmailConfigFormValues;

export interface EmailErrorSummaryItem {
  field: EmailConfigFieldKey;
  anchorId: string;
  label: string;
  message: string;
}

export const ORDERED_EMAIL_FIELDS: readonly EmailConfigFieldKey[] = [
  "fromName",
  "fromAddress",
  "replyTo",
  "senderDomain",
  "providerDriver",
  "status",
  "smtpHost",
  "smtpPort",
  "smtpUsername",
  "smtpProtocol",
  "smtpPassword",
  "smtpSecure",
  "dkimSelector",
  "dailyQuota",
  "rateLimitPerMin",
];

export function emailFieldAnchorId(field: EmailConfigFieldKey): string {
  return `email-field-${field}`;
}

export function modalForEmailField(
  field: EmailConfigFieldKey,
  currentModal: EmailModalKind | null,
): EmailModalKind {
  switch (field) {
    case "dkimSelector":
      return "dns";
    case "dailyQuota":
    case "rateLimitPerMin":
      return "limits";
    case "smtpHost":
    case "smtpPort":
    case "smtpUsername":
    case "smtpProtocol":
    case "smtpPassword":
    case "smtpSecure":
      return "smtp";
    case "status":
      return "provider";
    case "providerDriver":
      return currentModal === "provider" ? "provider" : "sender";
    default:
      return "sender";
  }
}

export function focusEmailField(anchorId: string): void {
  if (typeof document === "undefined") return;
  const container = document.getElementById(anchorId);
  if (!container) return;
  const focusTarget = container.querySelector<HTMLElement>(
    'input, button, [role="combobox"], [role="switch"], [tabindex]:not([tabindex="-1"])',
  );
  focusTarget?.focus({ preventScroll: true });
  (focusTarget ?? container).scrollIntoView?.({ block: "nearest" });
}

export function buildEmailErrorSummaryItems(
  errors: EmailConfigFieldErrors,
  fields: readonly EmailConfigFieldKey[],
  t: Dictionary,
): EmailErrorSummaryItem[] {
  const labels: Record<EmailConfigFieldKey, string> = {
    fromName: t.coreSettings.emailFromName,
    fromAddress: t.coreSettings.emailFromAddress,
    replyTo: t.coreSettings.emailReplyTo,
    senderDomain: t.coreSettings.emailSenderDomain,
    providerDriver: t.coreSettings.emailProvider,
    status: t.coreSettings.emailDeliveryStatusTitle,
    smtpHost: t.coreSettings.emailSmtpHost,
    smtpPort: t.coreSettings.emailSmtpPort,
    smtpUsername: t.coreSettings.emailSmtpUsername,
    smtpProtocol: t.coreSettings.emailSmtpProtocol,
    smtpPassword: t.coreSettings.emailSmtpPassword,
    smtpSecure: t.coreSettings.emailSmtpSecure,
    dkimSelector: t.coreSettings.emailDkimSelector,
    dailyQuota: t.coreSettings.emailCustomDailyLimitLabel,
    rateLimitPerMin: t.coreSettings.emailCustomPerMinuteLimitLabel,
  };

  const items: EmailErrorSummaryItem[] = [];
  for (const field of fields) {
    const message = errors[field];
    if (!message) continue;
    items.push({
      field,
      anchorId: emailFieldAnchorId(field),
      label: labels[field],
      message,
    });
  }
  return items;
}
