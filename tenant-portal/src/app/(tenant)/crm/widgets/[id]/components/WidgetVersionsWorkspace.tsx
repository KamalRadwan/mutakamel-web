"use client";

import { useId } from "react";
import { GitCompareArrows, History, Info } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Label, PageHeader, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { DashboardCatalog } from "../../../dashboards/dashboard-catalog-contract";
import { WidgetSelect } from "../../components/WidgetSelect";
import type { useWidgetVersionComparison } from "../hooks/useWidgetVersionComparison";
import { WidgetVersionDiffTable } from "./WidgetVersionDiffTable";
import { WidgetVersionHistory } from "./WidgetVersionHistory";

type Versions = ReturnType<typeof useWidgetVersionComparison>;
function focusHeading(heading: HTMLHeadingElement | null) { heading?.focus(); }

function VersionComparisonDialog({ state, catalog, name }: { state: Versions; catalog: DashboardCatalog | null; name: string }) {
  const { t, lang } = useI18n();
  const ackId = useId();
  if (!state.active) return null;
  const { comparison, loading, saving, source, acknowledged, error } = state.active;
  const labels = t.crmWidgets.versionComparison;
  const stale = error?.status === 409;
  const draftExists = error?.code === "CRM_WIDGET_VERSION_RESTORE_DRAFT_EXISTS";
  return <Dialog open onOpenChange={(open) => { if (!open) state.close(); }}>
    <DialogContent size="2xl" onCloseAutoFocus={state.restoreFocus} showCloseButton={!saving}
      className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><GitCompareArrows className="size-5 text-primary" aria-hidden="true" />{labels.title}</DialogTitle>
        <DialogDescription>{name}</DialogDescription>
      </DialogHeader>
      {loading && <div role="status" aria-label={labels.loading}><Skeleton className="h-44 w-full" /></div>}
      {error?.status === 403 ? <PermissionGate require="crm.widgets.read" denied>{null}</PermissionGate>
        : error && <p role="alert" className="text-sm text-destructive">{draftExists ? labels.draftExists : stale ? labels.stale : labels.failed}</p>}
      {comparison && <>
        <WidgetVersionDiffTable comparison={comparison} catalog={catalog} />
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>{comparison.restoreState === "DRAFT_EXISTS" ? labels.draftExists
            : !comparison.proof || !state.canChooseRestore && !saving ? labels.readOnly : labels.description}</p>
        </div>
        {comparison.proof && (state.canChooseRestore || saving) && <div className="space-y-3">
          <div className="sm:max-w-sm"><WidgetSelect label={labels.chooseSource} value={source === undefined ? "" : String(source)}
            disabled={!!saving} onChange={state.selectSource}
            options={[comparison.left, comparison.right].map((item) => ({
              value: String(item.versionNumber), label: `${t.crmWidgets.lifecycle.history.version} ${formatNumber(item.versionNumber, lang)}`,
            }))} /></div>
          <div className="flex items-start gap-2"><Checkbox id={ackId} checked={acknowledged === true} disabled={!!saving}
            onCheckedChange={(checked) => state.acknowledge(checked === true)} /><Label htmlFor={ackId}>{labels.acknowledge}</Label></div>
        </div>}
      </>}
      <DialogFooter className="border-t border-border pt-3">
        <Button variant="outline" disabled={!!saving} onClick={state.close}>{t.common.cancel}</Button>
        {error && error.status !== 403 && <Button variant="outline" onClick={state.retry}>{labels.refreshComparison}</Button>}
        {comparison?.proof && (state.canChooseRestore || saving) && <Button variant="secondary" disabled={!state.ready}
          loading={saving} onClick={() => void state.confirm()}>{labels.confirm}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function WidgetVersionsWorkspace({ state, name, activeVersion, catalog, reload }: {
  state: Versions; name: string; activeVersion: number; catalog: DashboardCatalog | null; reload: () => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.versionComparison;
  const options = state.history.items.map((item) => ({ value: String(item.versionNumber),
    label: `${t.crmWidgets.lifecycle.history.version} ${formatNumber(item.versionNumber, lang)} · ${item.name}` }));
  return <div className="flex min-w-0 flex-col gap-4">
    <PageHeader title={labels.openHistory} description={labels.historyDescription} headingRef={focusHeading}
      leading={<History className="size-6" aria-hidden="true" />}
      secondaryActions={<Button variant="outline" onClick={state.closeHistory}>{labels.back}</Button>} />
    {state.history.items.length > 1 && <section aria-label={labels.compare} className="grid items-end gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
      <WidgetSelect label={labels.left} value={state.left === undefined ? "" : String(state.left)} options={options} onChange={(value) => state.pick("left", value)} />
      <WidgetSelect label={labels.right} value={state.right === undefined ? "" : String(state.right)} options={options} onChange={(value) => state.pick("right", value)} />
      <Button variant="outline" disabled={!state.canCompare} onClick={(event) => state.compare(event.currentTarget)}>
        <GitCompareArrows className="size-4" aria-hidden="true" />{labels.compare}
      </Button>
    </section>}
    <WidgetVersionHistory history={{ ...state.history, retry: () => { void reload().then((ok) => { if (ok) state.history.retry(); }); } }}
      activeVersion={activeVersion} />
    <VersionComparisonDialog state={state} catalog={catalog} name={name} />
  </div>;
}
