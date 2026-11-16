"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, X } from "lucide-react";
import { Button, DegradedBanner } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { widgetUsagePath, type WidgetUsage } from "../../dashboards/widget-contract";
import { parseWidgetLibraryDetail } from "../../dashboards/widget-library-contract";
import { useWidgetSafety } from "../hooks/useWidgetSafety";
import { WIDGET_READ, assertWidgetStatus } from "../hooks/widget-requests";

export function WidgetUsagePanel({ id, widgetId, widgetName, initialUsage, onClose }: {
  id?: string;
  widgetId: string;
  widgetName: string;
  initialUsage?: WidgetUsage;
  onClose?: () => void;
}) {
  const { t, lang } = useI18n();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const fromLibrary = onClose !== undefined;
  const { scope, busy, startRead, currentRead } = useWidgetSafety(`widget-usage:${widgetId}`);
  const [page, setPage] = useState<{ cursors: Array<string | null>; request: number }>({ cursors: [null], request: 0 });
  const [receipt, setReceipt] = useState<{ scope: string; request: number; usage: WidgetUsage | null } | null>(null);
  const { cursors, request } = page;
  const cursor = cursors.at(-1) ?? null;
  const fromDetail = request === 0 && initialUsage !== undefined;
  const current = receipt?.scope === scope && receipt.request === request ? receipt : null;
  const usage = fromDetail ? initialUsage : current?.usage;
  const failed = current?.usage === null;

  useEffect(() => { if (fromLibrary) heading.current?.focus(); }, [fromLibrary]);

  useEffect(() => {
    if (fromDetail || busy) return;
    const controller = new AbortController();
    const read = async () => {
      const ticket = startRead();
      if (!ticket) return;
      try {
        const response = await axiosClient.get<unknown>(widgetUsagePath(widgetId, cursor), { ...WIDGET_READ, signal: controller.signal });
        if (controller.signal.aborted || !currentRead(ticket)) return;
        assertWidgetStatus(response, 200);
        const detail = parseWidgetLibraryDetail(response.data);
        if (detail.id !== widgetId || !detail.usage || (cursor && detail.usage.placements.some(row => row.placementId >= cursor))) {
          throw new Error("Widget usage response does not match the requested page.");
        }
        setReceipt({ scope, request, usage: detail.usage });
      } catch {
        if (!controller.signal.aborted && currentRead(ticket)) setReceipt({ scope, request, usage: null });
      }
    };
    void read();
    return () => controller.abort();
  }, [widgetId, cursor, scope, request, fromDetail, busy, startRead, currentRead]);

  const navigate = (next: Array<string | null>) => setPage({ cursors: next, request: request + 1 });
  const copy = t.crmWidgets;
  return <section id={id} aria-labelledby={headingId} className="space-y-3 rounded-lg border border-border bg-card p-4">
    <header className="flex items-start justify-between gap-2 border-b border-border pb-3">
      <div className="min-w-0"><h2 ref={heading} id={headingId} tabIndex={fromLibrary ? -1 : undefined} className="text-sm font-semibold">{copy.usageTitle}</h2>
        <p className="truncate text-sm text-muted-foreground">{widgetName || copy.lifecycle.untitledDraft}</p></div>
      {onClose && <Button variant="ghost" size="sm" onClick={onClose} aria-label={t.common.close}><X className="size-4" aria-hidden="true" /></Button>}
    </header>
    {failed ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-destructive">{copy.usageLoadFailed}</p>
      <Button variant="outline" size="sm" onClick={() => navigate(cursors)}>{t.common.retry}</Button></div>
      : !usage ? <p role="status" className="text-sm text-muted-foreground">{t.common.loading}</p>
      : <>
        <p className="text-sm text-muted-foreground">{formatTemplate(copy.usageSummary, {
          placements: formatNumber(usage.placementCount, lang), dashboards: formatNumber(usage.dashboardCount, lang),
        })}</p>
        {usage.placements.length ? <ul className="flex flex-wrap gap-2">{usage.placements.map(placement => <li key={placement.placementId}>
          <Button asChild variant="outline" size="sm"><Link href={`${TENANT_ROUTES.crmDashboards}/${placement.dashboardId}`}>
            <LayoutGrid className="size-4" aria-hidden="true" />{placement.dashboardName}
          </Link></Button>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">{copy.noVisibleUsage}</p>}
        {usage.hiddenPlacementCount > 0 && <DegradedBanner message={formatTemplate(copy.hiddenPlacements, { count: formatNumber(usage.hiddenPlacementCount, lang) })} />}
      </>}
    {(cursors.length > 1 || usage?.nextCursor) && <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy || cursors.length < 2} onClick={() => navigate(cursors.slice(0, -1))}>{t.common.previousPage}</Button>
      <Button size="sm" variant="outline" disabled={busy || !usage?.nextCursor}
        onClick={() => { if (usage?.nextCursor) navigate([...cursors, usage.nextCursor]); }}>{t.common.nextPage}</Button>
    </div>}
  </section>;
}
