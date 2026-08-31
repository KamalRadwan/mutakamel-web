"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CopyButton,
  DateTime,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { dkimRecordHost, type EmailConfig } from "../email-config-contract";

interface EmailDnsPanelProps {
  config: EmailConfig;
}

/**
 * The values a tenant has to paste into their DNS zone.
 *
 * Only the record **host** is derivable from the API: the server looks up
 * `${dkimSelector}._domainkey.${senderDomain}` and compares it against a
 * deployment-side proof registry (`TENANT_EMAIL_DKIM_PROOFS_V1_JSON`) that is
 * never returned to the browser. The expected record value is therefore not
 * shown — see docs/build/OPEN-QUESTIONS.md#q22. Nor is any SPF value: the
 * verifier reads DKIM only, so an SPF line here would be invented.
 */
export function EmailDnsPanel({ config }: EmailDnsPanelProps) {
  const { t, lang } = useI18n();
  const host = dkimRecordHost(config);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.coreSettings.emailDnsTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={config.dkimVerified ? "positive" : "caution"}>
            {config.dkimVerified
              ? t.coreSettings.emailDkimVerified
              : t.coreSettings.emailDkimUnverified}
          </Badge>
          {config.verifiedAt ? (
            <span className="text-xs text-muted-foreground">
              <DateTime value={config.verifiedAt} precision="datetime" language={lang} />
            </span>
          ) : null}
        </div>

        <DnsRow label={t.coreSettings.emailSenderDomain} value={config.senderDomain} />
        <DnsRow label={t.coreSettings.emailDkimSelector} value={config.dkimSelector} />
        <DnsRow label={t.coreSettings.emailDkimHost} value={host} />

        <p className="text-xs text-muted-foreground">{t.coreSettings.emailDnsValueNote}</p>
      </CardContent>
    </Card>
  );
}

function DnsRow({ label, value }: { label: string; value: string | null }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === null ? (
        <span className="text-xs text-muted-foreground">{t.coreSettings.emailNotConfigured}</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-xs text-foreground" dir="ltr">
            {value}
          </span>
          <CopyButton
            value={value}
            copyLabel={t.coreSettings.emailCopyValue}
            copiedLabel={t.coreSettings.emailCopied}
            failedLabel={t.coreSettings.emailCopyFailed}
          />
        </span>
      )}
    </div>
  );
}
