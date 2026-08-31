"use client";

import { useDirection, useLanguage, type Language } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { cn } from "../../lib/cn";

/**
 * **Mount animation is off, everywhere.**
 *
 * recharts animates a series in over 1500ms by default. `docs/design/motion.md`
 * budgets motion for three jobs — explain where something came from, hold
 * attention across a state change, encode "in progress" — and a chart drawing
 * itself does none of them. It also delays the number the user opened the
 * screen to read. MASTER-PLAN 1.42 records the budget extension that keeps
 * this at zero rather than adding a chart-mount entry.
 */
export const CHART_ANIMATION = { isAnimationActive: false } as const;

export const AXIS_TICK = { fill: "var(--color-ink-600)", fontSize: 11 } as const;
export const GRID_STROKE = "var(--border)";

export interface ChartAxisDirection {
  /** Categories run right-to-left in Arabic, so the x axis is reversed. */
  reversed: boolean;
  /** The value axis moves to the reading-end side. */
  valueAxisOrientation: "left" | "right";
  legendAlign: "left" | "right";
  dir: "rtl" | "ltr";
}

/**
 * RTL mirroring for a chart.
 *
 * recharts takes **physical** props — `reversed`, `orientation`, `align` — the
 * same third-party-physical-API situation `docs/design/theming.md#third-party-physical-apis`
 * describes for Radix. It is computed from `dir`, never branched on language.
 */
export function useChartDirection(): ChartAxisDirection {
  const dir = useDirection();
  const rtl = dir === "rtl";
  return {
    reversed: rtl,
    valueAxisOrientation: rtl ? "right" : "left",
    legendAlign: rtl ? "right" : "left",
    dir,
  };
}

export interface ChartNumberFormat {
  lang: Language;
  /** Axis ticks and tooltip values. Compact by default — an axis is not the place for 12 digits. */
  format: (value: number) => string;
}

export function useChartNumberFormat(options?: Intl.NumberFormatOptions): ChartNumberFormat {
  const lang = useLanguage();
  return {
    lang,
    // The locale is always explicit. `Intl` with undefined resolves to the
    // runtime default, which differs between a laptop and CI — the same trap
    // Money and DateTime are built to avoid.
    format: (value: number) => formatNumber(value, lang, options),
  };
}

export interface ChartTooltipEntry {
  label: string;
  value: string;
  fill?: string;
}

export function ChartTooltipCard({
  title,
  entries,
  dir,
}: {
  title?: string;
  entries: ChartTooltipEntry[];
  dir: "rtl" | "ltr";
}) {
  return (
    // recharts renders the tooltip into its own absolutely-positioned wrapper
    // outside the app's dir context, so the direction is set explicitly here.
    <div
      dir={dir}
      className="rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-pop"
    >
      {title && <p className="pb-1 font-medium">{title}</p>}
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            {entry.fill && (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-xs"
                style={{ background: entry.fill }}
              />
            )}
            <span className="text-muted-foreground">{entry.label}</span>
            <span className="ms-auto tabular-nums">
              <bdi>{entry.value}</bdi>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ChartFrameProps {
  /** Accessible name. A chart with no name announces as an unlabelled graphic. */
  label: string;
  /**
   * The same numbers in words — the accessible fallback for a canvas of shapes.
   *
   * Required, not optional: an SVG chart is unreadable to a screen reader
   * whatever ARIA is bolted onto it, and `docs/design/accessibility.md` treats a
   * visual-only figure as an information loss, not a styling choice.
   */
  summary: string;
  height?: number;
  className?: string;
  children: React.ReactNode;
}

export function ChartFrame({ label, summary, height = 240, className, children }: ChartFrameProps) {
  return (
    <figure className={cn("flex w-full flex-col gap-1", className)} style={{ height }}>
      <div role="img" aria-label={label} className="min-h-0 flex-1">
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
