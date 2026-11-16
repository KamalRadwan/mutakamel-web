"use client";

import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import type { WidgetFormState } from "../widget-form";
import { metricChoiceAllowed, metricVisualizations } from "../widget-metric-picker";

interface Options {
  form: WidgetFormState;
  index: number;
  catalog: DashboardCatalog | null;
  disabled: boolean;
  onChoose: (key: string) => void;
}

export function useWidgetMetricPicker({ form, index, catalog, disabled, onChoose }: Options) {
  const { t } = useI18n();
  const labels = t.crmWidgets.metricPicker;
  const id = useId();
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stagedKey, setStagedKey] = useState("");
  const currentKey = form.series[index]?.metricKey ?? "";
  const metrics = catalog?.metrics ?? [];
  const selected = metrics.find((metric) => metric.key === stagedKey);
  const currentMetric = metrics.find((metric) => metric.key === currentKey);
  const query = search.trim().normalize("NFKC").toLowerCase();
  const filtered = metrics.filter((metric) => [metric.nameAr, metric.nameEn, metric.key,
    t.crmDashboards.metricUnits[metric.unit], labels.dateFields[metric.dateField ?? "UNKNOWN"],
    ...(metric.accessResources ?? []).map((resource) => labels.resources[resource]),
  ].some((text) => text.normalize("NFKC").toLowerCase().includes(query)));
  const allowed = (metric: typeof metrics[number]) => metricChoiceAllowed(metric, form, index, catalog);
  const canChoose = !disabled && !!selected && !!form.series[index] && allowed(selected);
  const onOpenChange = (next: boolean) => {
    if (next && disabled) return;
    if (next) { setSearch(""); setStagedKey(currentKey); }
    setOpen(next);
  };
  const choose = () => {
    if (!canChoose || !selected) return;
    if (selected.key !== currentKey) onChoose(selected.key);
    setOpen(false);
  };
  return { id, open, onOpenChange, search, setSearch, searchInput, selected, currentMetric, filtered, allowed, canChoose,
    setStagedKey: (key: string) => { if (!disabled) setStagedKey(key); },
    stagedKey, choose, visualizations: selected ? metricVisualizations(selected, catalog) : [],
    focusSearch: (event: Event) => { event.preventDefault(); searchInput.current?.focus(); },
  };
}
