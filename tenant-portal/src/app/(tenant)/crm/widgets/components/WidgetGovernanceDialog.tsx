"use client";

import { Archive, ArchiveRestore, Plus, Send } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Badge, Button, Checkbox, DateTime, DegradedBanner, Field, Skeleton,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { useWidgetGovernance } from "../hooks/useWidgetGovernance";
import { WIDGET_ARCHIVE_REASON_LIMIT } from "../widget-governance-contract";

export function WidgetGovernanceDialog({ state }: { state: ReturnType<typeof useWidgetGovernance> }) {
  const { t, lang } = useI18n();
  if (!state.active) return null;
  const { stage, action } = state.active;
  const labels = t.crmWidgets.governance;
  const archiving = action === "ARCHIVE";
  const Icon = archiving ? Archive : ArchiveRestore;
  const title = archiving ? labels.archive : labels.restore;
  const formatVersion = (number: number | null) => number === null ? labels.noVersion : formatNumber(number, lang);
  const failure = stage.kind === "failed" ? stage.error : null;
  const failureMessage = failure?.status === 403 ? t.crmWidgets.review.writeDenied
    : failure?.code === "CRM_WIDGET_LIFECYCLE_IMPACT_STALE" ? labels.stale : labels.failed;
  const { review } = state;
  return <AlertDialog open onOpenChange={(open) => { if (!open) state.close(); }}>
    <AlertDialogContent onCloseAutoFocus={state.restoreFocus} className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2"><Icon className="size-5 text-primary" aria-hidden="true" />{title}</AlertDialogTitle>
        <AlertDialogDescription>{archiving ? labels.archiveDescription : labels.restoreDescription}</AlertDialogDescription>
      </AlertDialogHeader>
      {stage.kind === "loading" && <div role="status" aria-label={labels.loading} className="space-y-2">
        <Skeleton className="h-14 w-full" /><Skeleton className="h-36 w-full" />
      </div>}
      {failure && <p role="alert" className="text-sm text-destructive">{failureMessage}</p>}
      {stage.kind === "uncertain" && <p role="alert" className="text-sm text-muted-foreground">{labels.uncertain}</p>}
      {stage.kind === "checked" && <div role="status" className="space-y-1 rounded-md border border-border bg-muted p-3 text-sm">
        {stage.unconfirmed && <p>{labels.uncertain}</p>}
        <p>{formatTemplate(labels.currentStatus, { status: t.crmWidgets.lifecycle.statuses[stage.status] })}</p>
      </div>}
      {review && <>
        <div className="grid gap-3 rounded-md border border-border bg-muted p-3 sm:grid-cols-3">
          <div className="min-w-0"><p className="text-xs text-muted-foreground">{t.crmWidgets.name}</p>
            <p className="break-words text-sm font-semibold">{review.head.name || t.crmWidgets.lifecycle.untitledDraft}</p></div>
          <div><p className="text-xs text-muted-foreground">{t.crmWidgets.lifecycle.currentVersion}</p>
            <p className="text-sm font-semibold">{formatVersion(review.head.versionNumber)}</p></div>
          <div><p className="text-xs text-muted-foreground">{labels.usages}</p>
            <p className="text-sm font-semibold">{formatNumber(review.impact.placements.length + review.impact.hiddenPlacementCount, lang)}</p></div>
        </div>
        {review.head.hasDraft && <p className="text-xs text-muted-foreground">{labels.retainedDraft}</p>}
        {review.impact.placements.length > 0 ? <div className="rounded-md border border-border">
          <Table aria-label={labels.impact}>
            <TableHeader><TableRow>
              <TableHead scope="col">{labels.dashboard}</TableHead>
              <TableHead scope="col">{labels.policy}</TableHead>
              <TableHead scope="col">{labels.effect}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{review.impact.placements.slice(0, state.shown).map((placement) => <TableRow key={placement.placementId}>
              <TableCell>{placement.dashboardName}</TableCell>
              <TableCell>
                <p>{labels.policies[placement.versionPolicy]}</p>
                <p className="text-xs text-muted-foreground">{formatVersion(placement.versionNumber)}</p>
              </TableCell>
              <TableCell><Badge tone={!archiving && placement.eligibleToResume ? "positive" : "neutral"}>
                {archiving ? labels.suspended : placement.eligibleToResume ? labels.eligible : labels.unavailable}
              </Badge></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div> : <p className="text-sm text-muted-foreground">{labels.noVisibleUsages}</p>}
        {review.impact.placements.length > state.shown && <div><Button variant="outline" size="sm" onClick={state.loadMore}>{labels.more}</Button></div>}
        {review.impact.hiddenPlacementCount > 0 && <DegradedBanner message={formatTemplate(labels.hidden, {
          count: formatNumber(review.impact.hiddenPlacementCount, lang),
        })} />}
        {archiving && <ul className="divide-y divide-border rounded-md border border-border text-sm">
          <li className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2"><Plus className="size-4" aria-hidden="true" />{labels.newUses}</span>
            <Badge tone="neutral">{labels.blocked}</Badge>
          </li>
          <li className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="flex items-center gap-2"><Send className="size-4" aria-hidden="true" />{labels.publishDraft}</span>
            <Badge tone="neutral">{labels.blocked}</Badge>
          </li>
        </ul>}
        {archiving && <Field showLabel required label={labels.reason}>
          <Textarea value={state.reason} maxLength={WIDGET_ARCHIVE_REASON_LIMIT} disabled={state.busy} onChange={(event) => state.setReason(event.target.value)} />
        </Field>}
        <label className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <Checkbox checked={state.acknowledged} disabled={state.busy} onCheckedChange={(checked) => state.setAcknowledged(checked === true)} />
          {labels.acknowledge}
        </label>
        <p className="text-xs text-muted-foreground">{t.crmWidgets.lifecycle.expires} <DateTime value={review.impact.expiresAt} /></p>
      </>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={state.busy}>{stage.kind === "checked" ? t.common.close : t.common.cancel}</AlertDialogCancel>
        {failure && <Button variant="outline" disabled={state.busy} onClick={state.retry}>{t.common.retry}</Button>}
        {stage.kind === "uncertain" && <Button variant="outline" loading={state.busy} disabled={state.busy} onClick={() => void state.checkCurrent()}>{t.crmWidgets.review.checkCurrent}</Button>}
        {review && <Button variant={archiving ? "destructive" : "outline"} loading={state.busy} disabled={!state.canConfirm} onClick={() => void state.confirm()}>{title}</Button>}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
