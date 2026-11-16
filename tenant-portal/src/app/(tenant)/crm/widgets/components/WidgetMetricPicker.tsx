"use client";

import { ChartNoAxesColumn, Check, Search, X } from "lucide-react";
import { Badge, Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, Field, Input, RadioGroup, RadioGroupItem, cn, useFieldControl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import type { WidgetFormState } from "../widget-form";
import { useWidgetMetricPicker } from "../hooks/useWidgetMetricPicker";
import { WidgetMetricDetails } from "./WidgetMetricDetails";

interface Props {
  form: WidgetFormState;
  index: number;
  catalog: DashboardCatalog | null;
  disabled: boolean;
  error?: string;
  onChoose: (key: string) => void;
}

export function WidgetMetricPicker(props: Props) {
  const { t, lang, dir } = useI18n();
  const labels = t.crmWidgets.metricPicker;
  const { id, open, onOpenChange, search, setSearch, searchInput, selected, currentMetric, filtered, allowed,
    canChoose, setStagedKey, stagedKey, choose, visualizations, focusSearch } = useWidgetMetricPicker(props);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <Field showLabel label={t.crmWidgets.metric} required error={props.error}>
      <WidgetMetricTrigger disabled={props.disabled} label={currentMetric ? localizedName(currentMetric, lang) : t.crmWidgets.selectMetric} />
    </Field>
    <DialogContent size="2xl" dir={dir} closeLabel={t.common.close} onOpenAutoFocus={focusSearch}
      className="grid max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:p-0">
      <DialogHeader className="border-b border-border p-5 pe-14">
        <DialogTitle className="flex items-center gap-2"><ChartNoAxesColumn className="size-5" aria-hidden="true" />{labels.title}</DialogTitle>
        <DialogDescription>{labels.description}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
        <Field showLabel label={labels.search}>
          <Input ref={searchInput} type="search" value={search} placeholder={labels.searchPlaceholder}
            disabled={props.disabled} onChange={(event) => setSearch(event.target.value)} />
        </Field>
        <div className="overflow-hidden rounded-lg border border-border">
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_7rem_11rem_10rem] gap-3 bg-muted px-3 py-2 text-sm font-medium sm:grid">
            <span>{t.crmWidgets.metric}</span><span>{labels.unit}</span><span>{labels.dateBasis}</span><span>{labels.compatibility}</span>
          </div>
          <RadioGroup value={stagedKey} onValueChange={setStagedKey} aria-label={labels.selection} orientation="vertical"
            disabled={props.disabled} className="max-h-64 gap-0 overflow-y-auto">
            {filtered.map((metric, index) => {
              const compatible = allowed(metric);
              const optionId = `${id}-${index}`;
              return <label key={metric.key} htmlFor={optionId} className={cn(
                "grid cursor-pointer gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_11rem_10rem] sm:items-center sm:gap-3",
                metric.key === stagedKey ? "bg-primary/5 ring-1 ring-inset ring-primary" : "hover:bg-muted/40",
              )}>
                <span className="flex min-w-0 items-center gap-2"><RadioGroupItem id={optionId} value={metric.key} aria-labelledby={`${optionId}-name`} aria-describedby={`${optionId}-unit ${optionId}-metadata ${optionId}-compatibility`} />
                  <span id={`${optionId}-name`} className="min-w-0 text-sm font-medium">{localizedName(metric, lang)}</span></span>
                <span id={`${optionId}-unit`} className="text-sm text-muted-foreground"><span className="sm:sr-only">{labels.unit}:</span>{" "}{t.crmDashboards.metricUnits[metric.unit]}</span>
                <span id={`${optionId}-metadata`} className="text-sm text-muted-foreground"><span className="sm:sr-only">{labels.dateBasis}:</span>{" "}{labels.dateFields[metric.dateField ?? "UNKNOWN"]}</span>
                <Badge id={`${optionId}-compatibility`} tone={compatible ? "positive" : "neutral"}>{compatible ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                  {compatible ? labels.compatible : labels.incompatible}</Badge>
              </label>;
            })}
          </RadioGroup>
          {filtered.length === 0 && <p role="status" className="p-6 text-center text-sm text-muted-foreground">{labels.noResults}</p>}
        </div>
        {selected ? <WidgetMetricDetails metric={selected} compatible={allowed(selected)} visualizations={visualizations} />
          : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{labels.inspectHint}</p>}
      </div>
      <DialogFooter className="border-t border-border p-4">
        <DialogClose asChild><Button type="button" variant="outline">{t.common.cancel}</Button></DialogClose>
        <Button type="button" variant="primary" disabled={!canChoose} onClick={choose}><Check className="size-4" aria-hidden="true" />{labels.choose}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function WidgetMetricTrigger({ disabled, label }: { disabled: boolean; label: string }) {
  const control = useFieldControl();
  return <DialogTrigger asChild><Button {...control} type="button" variant="outline" disabled={disabled}
    className="w-full justify-between font-normal">
    <span className="truncate">{label}</span><Search className="size-4 shrink-0" aria-hidden="true" />
  </Button></DialogTrigger>;
}
