"use client";

import { use } from "react";
import { RefreshCw } from "lucide-react";
import { Button, DegradedBanner, DetailHeader, ErrorState, NotFoundState, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmScopeGate } from "../../shared/components/CrmScopeGate";
import { useOutboundEmailDetailScreen } from "../hooks/useOutboundEmailDetailScreen";
import { OutboundEmailDetailContent } from "../components/OutboundEmailDetailContent";
import { EmailStatusBadge } from "../components/EmailStatusBadge";
import { RetryEmailModal } from "../components/RetryEmailModal";

const EMAILS_HREF = "/crm/outbound-emails";

export default function OutboundEmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const screen = useOutboundEmailDetailScreen(id);
  const detail = screen.detail;
  const email = detail.detail;
  const copy = t.crmOutboundEmails;
  return <PermissionGate require="crm.activities.read" scoped>
    <div className="flex flex-col gap-3">
      {detail.queryError?.status === 403 && detail.queryError.code === "CRM_FEATURE_DISABLED" ?
        <ErrorState title={copy.featureDisabledTitle} description={copy.featureDisabledDescription} /> :
        detail.queryError?.status === 403 ? <CrmScopeGate /> :
        detail.notFound ? <NotFoundState title={copy.notFoundTitle} description={copy.notFoundDescription} backLabel={copy.backToList} backHref={EMAILS_HREF} /> :
        detail.queryError ? <ErrorState title={copy.loadFailed} description={copy.loadFailedHint} retryLabel={t.common.retry} onRetry={detail.reload} /> :
        detail.isLoading && !email ? <div className="flex flex-col gap-3"><Skeleton className="h-7 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div> :
        email ? <>
          <DetailHeader title={email.content.state === "AVAILABLE" ? email.content.subject : copy.redactedSubject}
            subtitle={email.recipient.displayName + " · " + email.recipient.maskedAddress}
            status={<EmailStatusBadge status={email.status} />}
            backLabel={copy.backToList} backHref={EMAILS_HREF}
            primaryAction={detail.canRetry ? { label: copy.retry, onClick: screen.openRetry } : undefined}
            secondaryActions={<Button size="sm" variant="outline" onClick={detail.reload} disabled={detail.isLoading || detail.isRetrying}>
              <RefreshCw className="size-4" aria-hidden="true" />{copy.reload}
            </Button>} />
          {detail.isPending && <DegradedBanner message={copy.pendingBanner} />}
          {detail.retainedError && <div className="flex flex-col items-start gap-2"><DegradedBanner message={copy.refreshFailed} />
            <Button size="sm" variant="outline" onClick={detail.reload} disabled={detail.isLoading}>{t.common.retry}</Button></div>}
          {!detail.canSend && <p className="text-xs text-muted-foreground">{copy.historyOnly}</p>}
          <OutboundEmailDetailContent email={email} />
          <RetryEmailModal screen={screen} />
        </> : null}
    </div>
  </PermissionGate>;
}
