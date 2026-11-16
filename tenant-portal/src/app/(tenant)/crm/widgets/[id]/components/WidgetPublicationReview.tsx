"use client";

import type { ReactNode } from "react";
import { Grid2X2, Layers3, PanelsTopLeft, Send } from "lucide-react";
import { Badge, Button, DateTime, DetailSection, PageHeader, Pagination, StatCard } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetImpact } from "../../widget-publication-contract";
import type { useWidgetHistory } from "../hooks/useWidgetHistory";
import { WidgetVersionHistory } from "./WidgetVersionHistory";

interface Props {
  name: string;
  impact: WidgetImpact;
  history: ReturnType<typeof useWidgetHistory>;
  preview: ReactNode;
  draftUpdatedAt?: string;
  unconfirmed: boolean;
  error?: string;
  pending: boolean;
  blocked: boolean;
  page: number;
  onPage: (page: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZE = 20;

function focusHeading(heading: HTMLHeadingElement | null) {
  heading?.focus();
}

export function WidgetPublicationReview({ name, impact, history, preview, draftUpdatedAt, unconfirmed, error, pending, blocked, page, onPage, onBack, onConfirm }: Props) {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.lifecycle;
  const { nextVersionNumber, dashboards, layoutAdjustments } = impact;
  const currentVersion = nextVersionNumber > 1 ? nextVersionNumber - 1 : null;
  const nextVersion = formatNumber(nextVersionNumber, lang);
  const affected = dashboards.filter((dashboard) => dashboard.affected).length;
  const adjustmentsByDashboard = new Map<string, WidgetImpact["layoutAdjustments"]>();
  for (const adjustment of layoutAdjustments) {
    const group = adjustmentsByDashboard.get(adjustment.dashboardId);
    if (group) group.push(adjustment);
    else adjustmentsByDashboard.set(adjustment.dashboardId, [adjustment]);
  }
  const visibleRows = dashboards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="flex min-w-0 flex-col gap-4">
    <PageHeader title={labels.reviewPublication} headingRef={focusHeading} description={labels.publicationDescription}
      leading={<Layers3 className="size-7 shrink-0" aria-hidden="true" />}
      primaryAction={{ label: unconfirmed ? labels.retryPublication : formatTemplate(labels.publish, { version: nextVersion }),
        icon: <Send className="size-4" aria-hidden="true" />, disabled: blocked || pending, loading: pending, onClick: onConfirm }}
      secondaryActions={<Button variant="outline" disabled={pending || unconfirmed} onClick={onBack}>{labels.backToDraft}</Button>} />
    {error && <p role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive">{error}</p>}
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      <StatCard label={labels.visibleDashboards} value={dashboards.length} icon={PanelsTopLeft} />
      <StatCard label={labels.affectedDashboards} value={affected} icon={Layers3} />
      <StatCard label={labels.layoutAdjustments} value={layoutAdjustments.length} icon={Grid2X2} />
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_2fr]">
      <div className="min-w-0 space-y-4">
        <DetailSection title={name || labels.untitledDraft} fields={[
          { label: labels.currentVersion, value: currentVersion === null ? labels.firstVersion : formatNumber(currentVersion, lang) },
          { label: labels.nextVersion, value: <Badge tone="neutral">{nextVersion}</Badge> },
          { label: labels.expires, value: <DateTime value={impact.expiresAt} /> },
        ]} />
        {preview}
      </div>
      <section aria-label={labels.dashboardList} className="min-w-0 space-y-3 rounded-card border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{labels.dashboardList}</h2>
        {visibleRows.length ? <ul className="divide-y divide-border rounded-md border border-border">
          {visibleRows.map((dashboard) => {
            const adjustments = adjustmentsByDashboard.get(dashboard.id) ?? [];
            return <li key={dashboard.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-medium">{dashboard.name}</span>
                <Badge tone={dashboard.affected ? "positive" : "neutral"}>{dashboard.affected ? labels.updates : labels.unchanged}</Badge>
              </div>
              {adjustments.length > 0 && <details className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">{formatTemplate(labels.layoutCount, { count: formatNumber(adjustments.length, lang) })}</summary>
                <ul className="mt-2 space-y-1 ps-3">
                  {adjustments.map((adjustment) => <li key={adjustment.placementId}>{formatTemplate(labels.placementGeometry, {
                    column: formatNumber(adjustment.x + 1, lang), row: formatNumber(adjustment.y + 1, lang),
                    width: formatNumber(adjustment.width, lang), height: formatNumber(adjustment.height, lang),
                  })}</li>)}
                </ul>
              </details>}
            </li>;
          })}
        </ul> : <p className="text-sm text-muted-foreground">{labels.noDashboards}</p>}
        {dashboards.length > PAGE_SIZE && <Pagination page={{ page, limit: PAGE_SIZE, total: dashboards.length }}
          onPageChange={onPage} labels={{ previous: t.common.previousPage, next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(labels.pagination, {
              from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang),
            }) }} />}
      </section>
    </div>
    <WidgetVersionHistory history={history} activeVersion={currentVersion} draftVersion={nextVersionNumber} draftName={name} draftUpdatedAt={draftUpdatedAt} />
  </div>;
}
