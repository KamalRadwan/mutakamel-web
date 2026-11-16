"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DateTime,
  IdentifierText,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type {
  EmailConfig,
  EmailConfigFormValues,
  EmailConfigStatus,
} from "../email-config-contract";
import type { EmailModalKind } from "../email-form-navigation";

interface EmailSummaryRowsProps {
  config: EmailConfig;
  draft: EmailConfigFormValues;
  canManage: boolean;
  isDirty: boolean;
  disabled: boolean;
  pending: "save" | "verify" | "probe" | null;
  onOpenModal: (modal: EmailModalKind) => void;
  onVerify: () => void;
  onSetDeliveryStatus: (nextStatus: EmailConfigStatus) => void;
  /** Extension slot reserved for T08 Sending Limits modal trigger. */
  limitsAction?: ReactNode;
}

export function EmailSummaryRows({
  config,
  draft,
  canManage,
  isDirty,
  disabled,
  pending,
  onOpenModal,
  onVerify,
  onSetDeliveryStatus,
  limitsAction,
}: EmailSummaryRowsProps) {
  const { t, lang } = useI18n();
  const smtpEndpoint =
    config.providerDriver === "smtp" && config.smtpHost
      ? config.smtpPort !== null
        ? `${config.smtpHost}:${config.smtpPort}`
        : config.smtpHost
      : null;
  const providerModalTarget: EmailModalKind =
    draft.providerDriver === "smtp" ? "smtp" : "provider";

  return (
    <Card className="divide-y divide-border overflow-hidden">
      <SummaryRow
        titleId="email-sender-title"
        title={t.coreSettings.emailSenderTitle}
        description={t.coreSettings.emailSenderSummaryDescription}
        action={
          canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenModal("sender")}
              disabled={disabled}
            >
              {t.coreSettings.emailEditAction}
            </Button>
          ) : null
        }
      >
        <span className="font-medium text-foreground">{config.fromName}</span>
        <IdentifierText className="text-xs text-foreground">{config.fromAddress}</IdentifierText>
        <span className="text-muted-foreground">
          {`${t.coreSettings.emailReplyTo}: `}
          {config.replyTo ? (
            <IdentifierText className="text-xs text-foreground">{config.replyTo}</IdentifierText>
          ) : (
            t.coreSettings.emailReplyToSameAsFrom
          )}
        </span>
      </SummaryRow>

      <SummaryRow
        titleId="email-provider-title"
        title={t.coreSettings.emailProviderTitle}
        description={t.coreSettings.emailProviderSummaryDescription}
        action={
          canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenModal(providerModalTarget)}
              disabled={disabled}
            >
              {t.coreSettings.emailEditAction}
            </Button>
          ) : null
        }
      >
        <span className="font-medium text-foreground">
          {t.coreSettings.emailProviderNames[config.providerDriver]}
        </span>
        {smtpEndpoint ? (
          <IdentifierText className="text-xs text-muted-foreground">{smtpEndpoint}</IdentifierText>
        ) : null}
        {config.providerDriver !== "platform-shared" ? (
          <Badge tone={config.providerCredentialsConfigured ? "positive" : "caution"} size="sm">
            {config.providerCredentialsConfigured
              ? t.coreSettings.emailConfigured
              : t.coreSettings.emailNotConfigured}
          </Badge>
        ) : null}
      </SummaryRow>

      <SummaryRow
        titleId="email-verification-title"
        title={t.coreSettings.emailVerificationTitle}
        description={t.coreSettings.emailVerificationSummaryDescription}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenModal("dns")}
              disabled={disabled}
            >
              {t.coreSettings.emailDnsDetailsAction}
            </Button>
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onVerify}
                disabled={disabled || isDirty}
                loading={pending === "verify"}
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {t.coreSettings.emailVerify}
              </Button>
            ) : null}
          </div>
        }
      >
        <IdentifierText className="text-xs font-medium text-foreground">
          {config.senderDomain}
        </IdentifierText>
        <Badge tone={config.dkimVerified ? "positive" : "caution"} size="sm">
          {config.dkimVerified
            ? t.coreSettings.emailDkimVerified
            : t.coreSettings.emailDkimUnverified}
        </Badge>
        {config.verifiedAt ? (
          <span className="text-xs text-muted-foreground">
            <DateTime value={config.verifiedAt} precision="datetime" language={lang} />
          </span>
        ) : null}
      </SummaryRow>

      <SummaryRow
        titleId="email-delivery-status-title"
        title={t.coreSettings.emailDeliveryStatusTitle}
        description={t.coreSettings.emailDeliveryStatusDescription}
        action={
          canManage ? (
            <Switch
              aria-label={t.coreSettings.emailDeliveryStatusTitle}
              checked={config.status === "ACTIVE"}
              disabled={
                disabled || isDirty || (config.status !== "ACTIVE" && !config.dkimVerified)
              }
              onCheckedChange={(checked) =>
                onSetDeliveryStatus(checked ? "ACTIVE" : "SUSPENDED")
              }
            />
          ) : null
        }
      >
        <Badge tone={config.status === "ACTIVE" ? "positive" : "neutral"} size="sm">
          {t.coreSettings.emailStatusNames[config.status]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {config.dkimVerified
            ? t.coreSettings.emailStatusHint
            : t.coreSettings.emailActivationRequiresDkim}
        </span>
      </SummaryRow>

      <SummaryRow
        titleId="email-limits-title"
        title={t.coreSettings.emailLimitsTitle}
        description={t.coreSettings.emailLimitsSummaryDescription}
        action={limitsAction ?? null}
      >
        <span className="text-xs text-muted-foreground">
          {`${t.coreSettings.emailDailyLimitLabel}: `}
          <span className="font-medium text-foreground tabular-nums">
            {formatNumber(config.effectiveDailyQuota, lang)}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {`${t.coreSettings.emailPerMinuteLimitLabel}: `}
          <span className="font-medium text-foreground tabular-nums">
            {formatNumber(config.effectiveRateLimitPerMin, lang)}
          </span>
        </span>
      </SummaryRow>
    </Card>
  );
}

interface SummaryRowProps {
  titleId: string;
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}

function SummaryRow({ titleId, title, description, action, children }: SummaryRowProps) {
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <h3 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">{children}</div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </section>
  );
}
