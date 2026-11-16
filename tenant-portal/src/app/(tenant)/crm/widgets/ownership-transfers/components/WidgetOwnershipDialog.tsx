"use client";

import { useId } from "react";
import { Info, Layers3 } from "lucide-react";
import { Badge, Button, Checkbox, Combobox, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, Label, PermissionGate, Skeleton, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { CRM_WIDGET_TRANSFER_PERMISSION } from "@/lib/navigation/tenant-routes";
import { WIDGET_TRANSFER_REASON_LIMIT } from "../../widget-ownership-transfer-contract";
import type { useWidgetOwnershipTransfer } from "../hooks/useWidgetOwnershipTransfer";

export function WidgetOwnershipDialog({ transfer }: { transfer: ReturnType<typeof useWidgetOwnershipTransfer> }) {
  const { t, lang } = useI18n();
  const targetId = useId();
  const reasonId = useId();
  const ackId = useId();
  const { active, targetPage, canEdit, busy } = transfer;
  if (!active) return null;
  const labels = t.crmWidgets.ownership;
  const { widget, impact, target, error, phase } = active;
  const denied = error?.status === 403;
  const stale = error?.status === 409;
  const missing = error?.status === 404;
  const targetInvalid = error?.code === "CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE" || error?.code === "CRM_WIDGET_OWNER_LIMIT";
  const version = (value: number | null) => value === null ? "—" : formatNumber(value, lang);
  const facts = impact ? [
    [labels.affected, impact.affectedPlacementCount],
    [labels.retained, impact.retainedShareCount],
    [labels.accessLost, impact.dashboardOwnerAccessLostCount],
    [labels.accessRestored, impact.dashboardOwnerAccessRestoredCount],
    [labels.readersMayNeedShare, impact.dashboardReadersMayNeedShareCount],
  ] as const : [];
  return <Dialog open onOpenChange={(open) => { if (!open) transfer.close(); }}>
    <DialogContent size="2xl" onCloseAutoFocus={transfer.restoreFocus} showCloseButton={phase !== "saving"}
      className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{labels.open}</DialogTitle>
        <DialogDescription>{labels.description}</DialogDescription>
      </DialogHeader>
      {phase === "loading" && <div role="status" aria-label={labels.loading}><Skeleton className="h-32 w-full" /></div>}
      {denied && <PermissionGate require={CRM_WIDGET_TRANSFER_PERMISSION} denied>{null}</PermissionGate>}
      {error && !denied && <p role="alert" className="text-sm text-destructive">
        {targetInvalid ? labels.targetInvalid : stale ? labels.stale : missing ? labels.deleted : labels.failed}
      </p>}
      {widget && !denied && !missing && <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-accent text-primary"><Layers3 className="size-5" aria-hidden="true" /></span>
          <p className="min-w-0 break-words text-sm font-semibold">{widget.name}</p>
          <Badge tone="neutral">{labels.metadataOnly}</Badge>
        </div>
        <div className="grid items-start gap-2 md:grid-cols-4 md:gap-3">
          <p className="text-sm font-medium md:py-2">{labels.currentOwner}</p>
          <p className="min-w-0 break-words rounded-md border border-border bg-muted px-3 py-2 text-sm md:col-span-3">{widget.ownerName ?? labels.unknownOwner}</p>
          <Label htmlFor={targetId} className="md:py-2">{labels.newOwner}</Label>
          <div className="space-y-1.5 md:col-span-3">
            <Combobox id={targetId} className="w-full" size="md" value={target?.id} selectedLabel={target?.name}
              options={targetPage?.items.map((item) => ({ value: item.id, label: item.name })) ?? []}
              onValueChange={transfer.select} onSearch={transfer.searchTargets} loading={targetPage?.loading}
              disabled={!canEdit} placeholder={labels.chooseOwner} searchPlaceholder={labels.searchOwners}
              loadingLabel={labels.loading} emptyLabel={labels.noOwners} wrapLabels
              errorContent={targetPage?.error ? <div className="space-y-2 p-2">
                {targetPage.error.status === 403 ? <PermissionGate require={CRM_WIDGET_TRANSFER_PERMISSION} denied>{null}</PermissionGate>
                  : <><p role="alert" className="text-xs text-destructive">{labels.ownerLoadFailed}</p>
                    <Button size="sm" variant="outline" onClick={transfer.retryTargets}>{t.common.retry}</Button></>}
              </div> : undefined}
              footer={targetPage?.cursor && !targetPage.error ? <Button size="sm" variant="outline" disabled={targetPage.loading} onClick={transfer.moreTargets}>
                {labels.more}
              </Button> : undefined} />
            {target && !targetInvalid && <Badge tone="positive">{labels.eligible}</Badge>}
          </div>
          <Label htmlFor={reasonId} className="md:py-2">{labels.reason}</Label>
          <Textarea id={reasonId} value={active.reason} onChange={(event) => transfer.setReason(event.target.value)}
            disabled={!canEdit} required maxLength={WIDGET_TRANSFER_REASON_LIMIT} placeholder={labels.reasonPlaceholder}
            className="min-h-20 md:col-span-3" />
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-sm">
          <div className="flex items-center gap-2"><dt>{t.crmWidgets.lifecycle.currentVersion}</dt><dd><Badge tone="neutral">{version(widget.activeVersionNumber)}</Badge></dd></div>
          <div className="flex items-center gap-2"><dt>{t.crmWidgets.lifecycle.statuses.DRAFT}</dt><dd><Badge tone="neutral">{version(widget.draftRevision)}</Badge></dd></div>
        </dl>
        <section aria-label={labels.impact} className="space-y-2 rounded-md border border-border bg-muted p-3 text-sm">
          <div className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div><p>{labels.sharePolicy}</p><p className="text-muted-foreground">{labels.sourcePolicy}</p></div>
          </div>
          {impact && <dl className="divide-y divide-border border-t border-border" aria-live="polite">
            {facts.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-1.5">
              <dt>{label}</dt><dd className="font-medium tabular-nums">{formatNumber(value, lang)}</dd>
            </div>)}
          </dl>}
        </section>
        {impact && <div className="flex items-start gap-2">
          <Checkbox id={ackId} checked={active.acknowledged} onCheckedChange={(value) => transfer.acknowledge(value === true)} disabled={!canEdit} />
          <Label htmlFor={ackId}>{labels.reviewed}</Label>
        </div>}
      </>}
      <DialogFooter className="border-t border-border pt-3">
        <Button variant="outline" onClick={transfer.close} disabled={phase === "saving"}>{t.common.cancel}</Button>
        {error && !denied && (stale || !widget) && <Button variant="outline" disabled={busy} onClick={transfer.reload}>{labels.reload}</Button>}
        {widget && !denied && !missing && !stale && <Button variant="secondary" loading={busy}
          disabled={impact ? !transfer.canConfirm : !transfer.canReview}
          onClick={impact ? () => void transfer.confirm() : () => void transfer.inspect()}>{impact ? labels.confirm : labels.review}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
