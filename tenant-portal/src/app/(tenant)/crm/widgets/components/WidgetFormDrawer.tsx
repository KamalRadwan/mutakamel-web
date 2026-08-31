"use client";

import { useState } from "react";
import {
  Button,
  ErrorState,
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import type { WidgetResult } from "../../dashboards/dashboard-run-contract";
import { TIME_GRAINS, WIDGET_NAME_MAX_LENGTH, type CrmVisualization } from "../../dashboards/widget-contract";
import {
  EMPTY_WIDGET_FORM,
  buildQuerySpec,
  buildableVisualizations,
  findMetric,
  findVisualization,
  grainsFor,
  metricsFor,
  validateWidgetForm,
  type WidgetFormState,
} from "../widget-form";
import { WidgetPreview } from "./WidgetPreview";

interface WidgetFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initial?: WidgetFormState;
  catalog: DashboardCatalog | null;
  isSubmitting: boolean;
  error?: string;
  canPreview: boolean;
  preview: WidgetResult | null;
  previewError: NormalizedApiError | null;
  isPreviewing: boolean;
  onPreview: (input: { name: string; visualizationType: CrmVisualization; querySpec: ReturnType<typeof buildQuerySpec> }) => void;
  /**
   * The second argument is the raw form state. The edit path needs it to decide
   * whether the query changed at all, because a `PATCH` that omits `querySpec`
   * is the only one that leaves the stored spec alone — see `buildWidgetUpdate`
   * and D23. Creation ignores it.
   */
  onSubmit: (
    input: { name: string; visualizationType: CrmVisualization; querySpec: ReturnType<typeof buildQuerySpec> },
    form: WidgetFormState,
  ) => void;
}

export function WidgetFormDrawer({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  catalog,
  isSubmitting,
  error,
  canPreview,
  preview,
  previewError,
  isPreviewing,
  onPreview,
  onSubmit,
}: WidgetFormDrawerProps) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<WidgetFormState>(initial ?? EMPTY_WIDGET_FORM);
  const [touched, setTouched] = useState(false);

  const visualization = findVisualization(catalog, form.visualizationType);
  const metric = findMetric(catalog, form.metricKey);
  const grains = grainsFor(catalog, form.dimensionKey);
  const formError = validateWidgetForm(form, catalog);
  const message = touched && formError ? t.crmWidgets.formErrors[formError] : undefined;

  function update(next: Partial<WidgetFormState>): void {
    setTouched(true);
    setForm((current) => {
      const merged = { ...current, ...next };
      // Changing the visualization can invalidate the metric, and changing the
      // metric can invalidate the dimension — both are server rules, so the
      // form clears rather than carrying an impossible pair to a 422.
      if (next.visualizationType !== undefined) {
        const allowed = metricsFor(catalog, findVisualization(catalog, merged.visualizationType));
        if (!allowed.some((candidate) => candidate.key === merged.metricKey)) {
          merged.metricKey = "";
          merged.dimensionKey = "none";
        }
        const capability = findVisualization(catalog, merged.visualizationType);
        if (capability?.requiresTarget) merged.comparison = "TARGET";
      }
      if (next.metricKey !== undefined) {
        const chosen = findMetric(catalog, merged.metricKey);
        if (!chosen?.dimensions.includes(merged.dimensionKey)) {
          merged.dimensionKey = chosen?.dimensions[0] ?? "none";
        }
      }
      return merged;
    });
  }

  function payload() {
    return {
      name: form.name,
      visualizationType: form.visualizationType as CrmVisualization,
      querySpec: buildQuerySpec(form),
    };
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t.crmWidgets.formDescription}
      isDirty={JSON.stringify(form) !== JSON.stringify(initial ?? EMPTY_WIDGET_FORM)}
      isSubmitting={isSubmitting}
      submitDisabled={formError !== null}
      onSubmit={() => {
        setTouched(true);
        if (formError === null) onSubmit(payload(), form);
      }}
      error={error ?? message}
      footerLeading={
        canPreview ? (
          <Button
            variant="outline"
            disabled={formError !== null || isPreviewing}
            loading={isPreviewing}
            onClick={() => {
              setTouched(true);
              if (formError === null) onPreview(payload());
            }}
          >
            {t.crmWidgets.preview}
          </Button>
        ) : undefined
      }
      labels={{
        submit: submitLabel,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {catalog === null ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.catalogueUnavailable}
        </p>
      ) : null}

      <Field label={t.crmWidgets.name} required>
        <Input
          value={form.name}
          maxLength={WIDGET_NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => update({ name: event.target.value })}
        />
      </Field>

      <Field label={t.crmWidgets.visualization} hint={t.crmWidgets.visualizationHint} required>
        <Select
          value={form.visualizationType}
          disabled={catalog === null}
          onValueChange={(next) => update({ visualizationType: next as CrmVisualization })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmWidgets.selectVisualization} />
          </SelectTrigger>
          <SelectContent>
            {buildableVisualizations(catalog).map((capability) => (
              <SelectItem key={capability.key} value={capability.key}>
                {t.crmDashboards.visualizations[capability.key] ?? capability.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmWidgets.metric} required>
        <Select
          value={form.metricKey}
          disabled={!visualization}
          onValueChange={(next) => update({ metricKey: next })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t.crmWidgets.selectMetric} />
          </SelectTrigger>
          <SelectContent>
            {metricsFor(catalog, visualization).map((candidate) => (
              <SelectItem key={candidate.key} value={candidate.key}>
                {localizedName(candidate, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.crmWidgets.dimension}>
        <Select
          value={form.dimensionKey}
          disabled={!metric}
          onValueChange={(next) => update({ dimensionKey: next })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(metric?.dimensions ?? ["none"]).map((dimension) => (
              <SelectItem key={dimension} value={dimension}>
                {t.crmWidgets.dimensions[dimension] ?? dimension}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {grains.length > 0 ? (
        <Field label={t.crmWidgets.grain} hint={t.crmWidgets.grainHint} required>
          <Select value={form.grain} onValueChange={(next) => update({ grain: next as WidgetFormState["grain"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_GRAINS.filter((grain) => grains.includes(grain)).map((grain) => (
                <SelectItem key={grain} value={grain}>
                  {t.crmWidgets.grains[grain]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field label={t.crmWidgets.comparison} hint={t.crmWidgets.comparisonHint}>
        <Select
          value={form.comparison}
          disabled={visualization?.requiresTarget}
          onValueChange={(next) => update({ comparison: next as WidgetFormState["comparison"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{t.crmWidgets.comparisonValues.NONE}</SelectItem>
            <SelectItem value="TARGET">{t.crmWidgets.comparisonValues.TARGET}</SelectItem>
            <SelectItem value="PREVIOUS_PERIOD">
              {t.crmWidgets.comparisonValues.PREVIOUS_PERIOD}
            </SelectItem>
            <SelectItem value="PREVIOUS_YEAR">
              {t.crmWidgets.comparisonValues.PREVIOUS_YEAR}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {form.comparison === "TARGET" ? (
        <Field label={t.crmWidgets.target} hint={t.crmWidgets.targetHint} required>
          <Input
            value={form.target}
            inputMode="decimal"
            onChange={(event) => update({ target: event.target.value })}
          />
        </Field>
      ) : null}

      {isPreviewing ? <Skeleton className="h-24 w-full" /> : null}
      {previewError ? (
        <ErrorState
          title={t.crmWidgets.previewFailed}
          description={
            t.crmDashboards.errors[previewError.code ?? ""] ?? t.crmDashboards.actionFailed
          }
        />
      ) : null}
      {preview && !isPreviewing ? <WidgetPreview result={preview} /> : null}
    </FormDrawer>
  );
}
