"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import type { Language } from "@/i18n/I18nContext";
import type { DashboardMetricTone } from "@/types/dashboard";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";

export const CHART_COLORS = {
  action: "var(--chart-action)",
  success: "var(--chart-success)",
  warning: "var(--chart-warning)",
  danger: "var(--chart-danger)",
  neutral: "var(--chart-axis)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  qualitative: [
    "var(--chart-qualitative-1)",
    "var(--chart-qualitative-2)",
    "var(--chart-qualitative-3)",
    "var(--chart-qualitative-4)",
    "var(--chart-qualitative-5)",
    "var(--chart-qualitative-6)",
  ],
} as const;

/** Keep visual SVGs bounded; exact-value tables retain every source item. */
export const DASHBOARD_CHART_VISUAL_ITEM_LIMIT = 12;

export function dashboardChartVisualItems<T>(items: readonly T[]): T[] {
  return items.slice(0, DASHBOARD_CHART_VISUAL_ITEM_LIMIT);
}

export const STATUS_TONE_COLOR: Record<DashboardMetricTone, string> = {
  green: CHART_COLORS.success,
  amber: CHART_COLORS.warning,
  red: CHART_COLORS.danger,
  blue: CHART_COLORS.neutral,
  cyan: CHART_COLORS.neutral,
  purple: CHART_COLORS.neutral,
};

export interface ChartLegendItem {
  key: string;
  label: string;
  color: string;
  value?: string;
}

export interface ChartTableRow {
  key: string;
  cells: string[];
}

interface ChartFigureProps {
  title: string;
  summary: string;
  lang: Language;
  height: number;
  legend?: ChartLegendItem[];
  columns: string[];
  rows: ChartTableRow[];
  /**
   * An SVG chart is decorative — the summary and the exact-value table carry
   * everything it says — so the body is hidden from assistive technology by
   * default. A body made of real content rather than marks, and especially one
   * containing links, must pass `false`: `aria-hidden` over a focusable
   * element hides it from a screen reader without taking it out of the tab
   * order, which is worse than not hiding it at all.
   */
  bodyHidden?: boolean;
  children: ReactNode;
}

const CHART_COPY = {
  en: {
    legend: "Chart legend",
    exactValues: "Exact values",
    noData: "No data is available for this chart.",
    category: "Category",
    value: "Value",
    total: "Total",
    period: "Period",
    percentage: "Percentage",
    server: "Server",
    utilization: "Utilization",
  },
  ar: {
    legend: "مفتاح الرسم البياني",
    exactValues: "القيم الدقيقة",
    noData: "لا توجد بيانات متاحة لهذا الرسم البياني.",
    category: "الفئة",
    value: "القيمة",
    total: "الإجمالي",
    period: "الفترة",
    percentage: "النسبة",
    server: "السيرفر",
    utilization: "معدل الاستخدام",
  },
} as const;

export function ChartFigure({
  title,
  summary,
  lang,
  height,
  legend = [],
  columns,
  rows,
  bodyHidden = true,
  children,
}: ChartFigureProps) {
  const titleId = useId();
  const summaryId = useId();
  const copy = CHART_COPY[lang];

  return (
    <figure aria-labelledby={titleId} aria-describedby={summaryId} className="space-y-3">
      <figcaption>
        <span id={titleId} className="sr-only">
          {title}
        </span>
        <p id={summaryId} className="text-xs leading-relaxed text-muted-foreground">
          {summary}
        </p>
      </figcaption>

      {legend.length > 0 && (
        <ul aria-label={copy.legend} className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground">
          {legend.map((item) => (
            <li key={item.key} className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-xs border border-current"
                style={{ color: item.color, backgroundColor: item.color }}
              />
              <span className="min-w-0">
                {item.label}
                {item.value !== undefined && (
                  <span className="ms-1 font-mono font-semibold tabular-nums text-foreground" dir="auto">
                    {item.value}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div aria-hidden={bodyHidden || undefined} className="w-full" style={{ height }}>
        {children}
      </div>

      <details className="rounded-md border border-border bg-muted/50">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs font-semibold text-foreground">
          {copy.exactValues}
        </summary>
        <div
          role="region"
          aria-label={`${copy.exactValues}: ${title}`}
          tabIndex={0}
          className="max-h-56 overflow-auto border-t border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Table className="min-w-max border-collapse text-xs">
            <TableCaption className="sr-only">{title}</TableCaption>
            <TableHeader className="sticky top-0 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                {columns.map((column, index) => (
                  <TableHead
                    key={`${column}-${index}`}
                    scope="col"
                    className={index === 0 ? "px-3 py-2 text-start font-semibold" : "px-3 py-2 text-end font-semibold"}
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border bg-card text-foreground">
              {rows.map((row) => (
                <TableRow key={row.key} className="hover:bg-transparent">
                  {row.cells.map((cell, index) => (
                    <TableCell
                      key={`${row.key}-${index}`}
                      className={index === 0 ? "px-3 py-2 text-start" : "px-3 py-2 text-end font-mono tabular-nums"}
                      dir={index === 0 ? undefined : "auto"}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </figure>
  );
}

export function ChartEmptyState({ title, lang, height = 192 }: { title: string; lang: Language; height?: number }) {
  return (
    <div
      role="status"
      aria-label={title}
      className="flex w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/50 p-4 text-center text-xs text-muted-foreground"
      style={{ minHeight: height }}
    >
      {CHART_COPY[lang].noData}
    </div>
  );
}

export function qualitativeColor(index: number): string {
  return CHART_COLORS.qualitative[index % CHART_COLORS.qualitative.length];
}

export function getChartCopy(lang: Language) {
  return CHART_COPY[lang];
}

export function chartLocale(lang: Language): "ar-EG" | "en-US" {
  return lang === "ar" ? "ar-EG" : "en-US";
}

export function formatChartNumber(
  lang: Language,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(chartLocale(lang), options).format(value);
}

export function formatChartPercent(lang: Language, ratio: number, maximumFractionDigits = 1): string {
  return formatChartNumber(lang, clampRatio(ratio), {
    style: "percent",
    maximumFractionDigits,
  });
}

export function formatChartCurrency(lang: Language, value: number, currencyCode: string): string {
  try {
    return formatChartNumber(lang, value, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    });
  } catch {
    return `${formatChartNumber(lang, value)} ${currencyCode}`;
  }
}

export function summarizeChartValues(
  title: string,
  values: Array<{ label: string; value: string }>,
  lang: Language,
): string {
  const separator = lang === "ar" ? "، " : ", ";
  return `${title}: ${values.map((item) => `${item.label}: ${item.value}`).join(separator)}.`;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
