"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  DASHBOARD_LIMITS,
  DASHBOARD_VISUALIZATION_TYPES,
  type DashboardCatalog,
  type DashboardVisualizationType,
} from "../../dashboards/analytics-contract";
import type { WidgetSeriesInput } from "../../dashboards/analytics-requests";

interface CreateWidgetModalProps {
  catalog: DashboardCatalog | null;
  catalogUnavailable: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    name: string,
    visualizationType: DashboardVisualizationType,
    series: readonly WidgetSeriesInput[],
    displayTitle: string,
  ) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

const EMPTY_SERIES: WidgetSeriesInput = { metricKey: "", label: "" };

/**
 * All twenty visualization types are offered.
 *
 * Offering fewer would silently hide the metrics whose only compatible
 * visualization is missing — the catalogue states compatibility per metric and
 * the server enforces it with 422
 * `TRADE.DASHBOARD.VISUALIZATION_INCOMPATIBLE`.
 *
 * Metric keys come from the catalogue, never free text: `metricKey` must match
 * `^trade\.[a-z0-9_.]+$` and be registered, or the create is a 422.
 */
export function CreateWidgetModal({
  catalog,
  catalogUnavailable,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateWidgetModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [visualizationType, setVisualizationType] =
    useState<DashboardVisualizationType>("METRIC_CARD");
  const [series, setSeries] = useState<WidgetSeriesInput[]>([EMPTY_SERIES]);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setName("");
          setDisplayTitle("");
          setSeries([EMPTY_SERIES]);
          onClose();
        }
      }}
      title={t.tradeAnalytics.widgetCreateTitle}
      description={t.tradeAnalytics.widgetCreateDescription}
      isDirty={name.length > 0 || series.some((entry) => entry.metricKey.length > 0)}
      isSubmitting={isSubmitting}
      submitDisabled={catalogUnavailable}
      onSubmit={() => void onSubmit(name, visualizationType, series, displayTitle)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t.tradeAnalytics.widgetName} required>
          <Input
            value={name}
            maxLength={DASHBOARD_LIMITS.nameMaxLength}
            disabled={isSubmitting}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={t.tradeAnalytics.visualizationType} required>
          <Select
            value={visualizationType}
            disabled={isSubmitting}
            onValueChange={(next) => setVisualizationType(next as DashboardVisualizationType)}
          >
            <SelectTrigger aria-label={t.tradeAnalytics.visualizationType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_VISUALIZATION_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.tradeAnalytics.displayTitle}>
          <Input
            value={displayTitle}
            maxLength={DASHBOARD_LIMITS.nameMaxLength}
            disabled={isSubmitting}
            onChange={(event) => setDisplayTitle(event.target.value)}
          />
        </Field>

        <p className="text-sm font-medium text-foreground">{t.tradeAnalytics.series}</p>
        {series.map((entry, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2">
            <Field label={t.tradeAnalytics.metricKey} required>
              <Select
                value={entry.metricKey === "" ? undefined : entry.metricKey}
                disabled={isSubmitting || catalogUnavailable}
                onValueChange={(next) =>
                  setSeries((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, metricKey: next } : item,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label={t.tradeAnalytics.metricKey}>
                  <SelectValue placeholder={t.tradeAnalytics.metricPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {(catalog?.metrics ?? []).map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.tradeAnalytics.seriesLabel}>
              <Input
                value={entry.label}
                maxLength={80}
                disabled={isSubmitting}
                onChange={(event) =>
                  setSeries((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
            </Field>
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSubmitting || series.length >= DASHBOARD_LIMITS.maxWidgetSeries}
            onClick={() => setSeries((current) => [...current, EMPTY_SERIES])}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.tradeAnalytics.addSeries}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSubmitting || series.length <= 1}
            onClick={() => setSeries((current) => current.slice(0, -1))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t.tradeAnalytics.removeSeries}
          </Button>
        </div>
      </div>
    </FormDrawer>
  );
}
