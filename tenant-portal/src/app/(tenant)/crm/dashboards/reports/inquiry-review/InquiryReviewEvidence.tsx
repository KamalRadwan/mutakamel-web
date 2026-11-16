"use client";

import { ExternalLink, UserRound } from "lucide-react";
import { Badge, Button, Card, DateTime, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { InquiryContext, InquirySelection } from "./contract";

export function InquiryReviewError({ error, retry }: { error: NormalizedApiError; retry?: () => void }) {
  const { t } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  if (error.status === 403) return <PermissionGate require={[]} denied>{null}</PermissionGate>;
  const message = error.code === "REFERENCE_CHANGED" ? copy.changedReference
    : error.status === 409 ? copy.conflict
    : error.status === 404 ? copy.missing
    : error.status === 422 ? copy.invalid
    : error.status === 503 ? copy.unavailable : copy.failed;
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
    <p>{message}</p>
    {retry && <Button size="sm" variant="outline" onClick={retry}>{t.common.retry}</Button>}
  </div>;
}

export function InquiryRecordCard({ context, selection, label, linkLabel, branchName }: {
  context: InquiryContext;
  selection: InquirySelection;
  label: string;
  linkLabel?: string;
  branchName?: string;
}) {
  const { t } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  return <Card className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <UserRound className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-semibold"><bdi>{context.name || t.common.nameUnavailable}</bdi></p>
          <Badge tone={context.state === "REVIEWED" ? "positive" : "neutral"}>{copy.states[context.state]}</Badge>
        </div>
        <p className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {branchName && <bdi>{branchName}</bdi>}
          {selection.createdAt && <DateTime value={selection.createdAt} />}
        </p>
      </div>
    </div>
    <Button asChild variant="outline" size="sm">
      <a href={`/crm/leads/${selection.id}`} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" aria-hidden="true" />{linkLabel ?? copy.openLead}
      </a>
    </Button>
  </Card>;
}

export function InquiryReviewHistory({ context, earlier, disabled, navigate }: {
  context: InquiryContext;
  earlier: boolean;
  disabled: boolean;
  navigate: (before?: number) => void;
}) {
  const { t } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  return <details className="rounded-lg border border-border p-3" open={earlier || undefined}>
    <summary className="cursor-pointer text-sm font-semibold">{copy.history}</summary>
    <div className="mt-2 space-y-2">
      {context.history.length ? <ul className="divide-y divide-border">
        {context.history.map(decision => <li key={decision.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>{copy.reasons[decision.reason]}</span><DateTime value={decision.decidedAt} />
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{copy.noHistory}</p>}
      {(earlier || context.nextBeforeRevision !== null) && <div className="flex flex-wrap gap-2">
        {earlier && <Button size="sm" variant="outline" disabled={disabled} onClick={() => navigate()}>{copy.latest}</Button>}
        {context.nextBeforeRevision !== null && <Button size="sm" variant="outline" disabled={disabled}
          onClick={() => navigate(context.nextBeforeRevision!)}>{copy.older}</Button>}
      </div>}
    </div>
  </details>;
}
