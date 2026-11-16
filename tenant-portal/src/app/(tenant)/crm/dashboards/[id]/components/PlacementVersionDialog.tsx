"use client";

import { GitBranch, Pin } from "lucide-react";
import { useId } from "react";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Label, PermissionGate, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { usePlacementVersion } from "../hooks/usePlacementVersion";

export function PlacementVersionDialog({ state }: { state: ReturnType<typeof usePlacementVersion> }) {
  const { t, lang } = useI18n();
  const choiceId = useId();
  const { active, allowed, busy } = state;
  if (!active) return null;
  const { current, choice, impact, error, uncertain, history, historyError } = active;
  const labels = t.crmDashboards.placementVersion;
  const policies = t.crmWidgets.governance.policies;
  const number = (value: number) => formatNumber(value, lang);
  const version = (value: number) => formatTemplate(labels.version, { number: number(value) });
  const box = (position: NonNullable<typeof current>["placement"]) => formatTemplate(labels.box, {
    column: number(position.x + 1), row: number(position.y + 1),
    width: number(position.width), height: number(position.height),
  });
  const stale = error?.status === 409;
  const denied = error?.status === 403;
  const editable = !!current && !stale && !uncertain && !denied;
  return <Dialog open onOpenChange={(open) => { if (!open) state.close(); }}>
    <DialogContent size="xl" showCloseButton={!busy} onCloseAutoFocus={state.restoreFocus} className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><GitBranch className="size-5 text-primary" aria-hidden="true" />{labels.title}</DialogTitle>
        <DialogDescription>{formatTemplate(labels.description, { name: active.target.name })}</DialogDescription>
      </DialogHeader>
      {!current && busy && <div role="status" aria-label={labels.loading}><Skeleton className="h-24 w-full" /></div>}
      {denied ? <PermissionGate require="crm.dashboards.update" scoped denied>{null}</PermissionGate>
        : error && <p role="alert" className="text-sm text-destructive">{uncertain ? labels.uncertain : stale ? labels.stale : labels.failed}</p>}
      {current && <dl className="grid gap-3 rounded-md border border-border bg-muted p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">{labels.current}</dt>
          <dd className="flex flex-wrap items-center gap-2 font-medium">{version(current.selectedVersionNumber)}<Badge tone="neutral">{policies[current.versionPolicy]}</Badge></dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.active}</dt><dd className="font-medium">{version(current.activeVersionNumber)}</dd></div>
      </dl>}
      {editable && choice && <div className="space-y-2">
        <Label htmlFor={choiceId}>{labels.choice}</Label>
        <Select value={choice.pinnedVersionNumber === null ? "follow" : String(choice.pinnedVersionNumber)} onValueChange={state.select} disabled={!allowed}>
          <SelectTrigger id={choiceId}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="follow">{policies.FOLLOW_ACTIVE}</SelectItem>
            {state.options.map((value) => <SelectItem key={value} value={String(value)}>
              {formatTemplate(labels.pin, { version: version(value) })}
            </SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{choice.versionPolicy === "PINNED" ? labels.pinnedHelp : labels.followHelp}</p>
        {state.canReadHistory && history?.nextBeforeVersion !== null && historyError?.status !== 403
          && <Button variant="outline" size="sm" onClick={state.loadHistory} disabled={!allowed}>
            {history ? labels.moreHistory : labels.history}
          </Button>}
        {historyError && <p role="status" className="text-xs text-muted-foreground">{historyError.status === 403 ? labels.historyDenied : labels.historyFailed}</p>}
      </div>}
      {editable && impact && <section aria-label={labels.impact} className="space-y-2 rounded-md border border-border p-3 text-sm">
        <h3 className="flex items-center gap-2 font-medium"><Pin className="size-4" aria-hidden="true" />{labels.impact}</h3>
        <p role="status" className="text-muted-foreground">{!impact.changed ? labels.noChange : impact.layoutChanged ? labels.moves : labels.keepsLayout}</p>
        {impact.changed && <dl className="space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><dt>{labels.selected}</dt><dd className="font-medium">{version(impact.selectedVersionNumber)} · {t.crmDashboards.visualizations[impact.visualizationType]}</dd></div>
          {impact.layoutChanged && <>
            <div className="flex flex-wrap justify-between gap-2"><dt>{labels.currentBox}</dt><dd>{box(current.placement)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt>{labels.proposedBox}</dt><dd className="font-medium">{box(impact.placement)}</dd></div>
          </>}
        </dl>}
      </section>}
      <DialogFooter>
        <Button variant="outline" onClick={state.close} disabled={!!busy}>{uncertain ? t.common.close : t.common.cancel}</Button>
        {(stale || !current && error && !denied || historyError && historyError.status !== 403)
          && <Button variant="outline" onClick={state.retry} disabled={!allowed}>{labels.reload}</Button>}
        {editable && (!impact || impact.changed) && <Button variant="secondary" loading={busy === "save"} disabled={!allowed}
          onClick={impact ? () => void state.confirm() : state.review}>{impact ? labels.confirm : labels.review}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
