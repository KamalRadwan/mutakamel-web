"use client";

import { Mail, RefreshCw } from "lucide-react";
import {
  Button, DegradedBanner, ErrorState, Field, PageHeader, PermissionGate,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/design-system";
import { OUTBOUND_EMAIL_STATUSES } from "./outbound-email-contract";
import { useOutboundEmailPage } from "./hooks/useOutboundEmailPage";
import { ComposeEmailDrawer } from "./components/ComposeEmailDrawer";
import { OutboundEmailHistory } from "./components/OutboundEmailHistory";

export default function OutboundEmailsPage() {
  const page = useOutboundEmailPage();
  const { t, history, composer } = page;
  const copy = t.crmOutboundEmails;
  if (history.queryError?.status === 403 && history.queryError.code === "CRM_FEATURE_DISABLED") {
    return <PermissionGate require="crm.activities.read" scoped><ErrorState title={copy.featureDisabledTitle} description={copy.featureDisabledDescription} /></PermissionGate>;
  }
  return <PermissionGate require="crm.activities.read" scoped denied={history.queryError?.status === 403}>
    <div className="flex flex-col gap-3">
      <PageHeader title={t.nav.outboundEmails} description={copy.subtitle}
        primaryAction={history.canSend ? {
          label: copy.compose, icon: <Mail className="size-4" aria-hidden="true" />,
          onClick: page.openComposer, disabled: composer.isSending || composer.uncertain,
        } : undefined}
        secondaryActions={<Button size="sm" variant="outline" onClick={history.reload} disabled={history.isLoading}>
          <RefreshCw className="size-4" aria-hidden="true" />{copy.reload}
        </Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <Field showLabel label={t.common.status} className="w-48">
          <Select value={history.status || "ALL"} onValueChange={(value) => history.setStatus(value === "ALL" ? "" : value as typeof history.status)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">{copy.allStatuses}</SelectItem>
              {OUTBOUND_EMAIL_STATUSES.map((status) => <SelectItem key={status} value={status}>{copy.statusValues[status]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <p className="pb-1 text-xs text-muted-foreground">{copy.refreshHint}</p>
      </div>
      {!history.canSend && history.hasLoaded && <p className="text-xs text-muted-foreground">{copy.historyOnly}</p>}
      <OutboundEmailHistory history={history} onOpen={page.openDetail} />
      {history.retainedError && <div className="flex flex-col items-start gap-2" role="status">
        <DegradedBanner message={history.hasNext ? copy.loadMoreFailed : copy.refreshFailed} />
        <Button size="sm" variant="outline" onClick={history.hasNext ? history.loadMore : history.reload}>{t.common.retry}</Button>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{copy.pendingHint}</p>
        {history.hasNext && <Button size="sm" variant="outline" onClick={history.loadMore} disabled={history.isLoading || history.isLoadingMore} loading={history.isLoadingMore}>{copy.loadMore}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{copy.sentMeaning}</p>
      <ComposeEmailDrawer key={page.session} open={page.isComposeOpen} onOpenChange={page.closeComposer}
        composer={composer} error={page.composeError} onSend={page.send} onReconcile={page.reconcile} onSelectionChange={page.clearComposeError} />
    </div>
  </PermissionGate>;
}
