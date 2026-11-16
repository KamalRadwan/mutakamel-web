"use client";

import { Button, DegradedBanner, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardCatalog } from "../../../dashboards/dashboard-catalog-contract";
import { WidgetPreview } from "../../components/WidgetPreview";
import type { useWidgetPreview } from "../../hooks/useWidgetPreview";
import type { WidgetAuthoringInput } from "../../widget-form";

interface Props {
  input: WidgetAuthoringInput | null;
  state: ReturnType<typeof useWidgetPreview>;
  catalog: DashboardCatalog | null;
  canPreview: boolean;
  publishing: boolean;
}

export function WidgetReviewPreview({ input, state, catalog, canPreview, publishing }: Props) {
  const { t } = useI18n();
  const title = t.crmWidgets.lifecycle.savedDraftPreview;
  return <section aria-label={title} className="min-w-0 space-y-3 rounded-card border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {canPreview && input && <Button variant="outline" size="sm" loading={state.busy} disabled={publishing || state.busy}
        onClick={() => void state.run(input)}>{t.crmWidgets.preview}</Button>}
    </div>
    {!canPreview && <DegradedBanner message={t.crmWidgets.review.previewDenied} />}
    {state.busy && <div role="status" aria-label={t.crmWidgets.builder.previewLoading}><Skeleton className="h-40 w-full" /></div>}
    {state.error && <p role="alert" className="text-sm text-destructive">{t.crmWidgets.previewFailed}</p>}
    {input && state.result && <WidgetPreview result={state.result} catalog={catalog} {...input} />}
    {canPreview && input && !state.busy && !state.result && !state.error &&
      <p className="text-sm text-muted-foreground">{t.crmWidgets.lifecycle.savedDraftPreviewHint}</p>}
  </section>;
}
