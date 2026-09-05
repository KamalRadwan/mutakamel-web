"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n, type Language } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { cn } from "../../lib/cn";

export type StatTone = "brand" | "warn" | "danger" | "neutral";

const TONE_ICON: Record<StatTone, string> = {
  brand: "border border-success/30 bg-success-subtle text-success",
  warn: "border border-warning/30 bg-warning-subtle text-warning",
  danger: "border border-destructive/30 bg-destructive-subtle text-destructive",
  neutral: "border border-border bg-muted text-muted-foreground",
};

/** The sparkline takes the card's own accent so it reads as part of it. */
const TONE_TREND: Record<StatTone, string> = {
  brand: "text-success",
  warn: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

export interface StatTrend {
  label: string;
  kind: "line" | "bar";
  points: number[];
}

const TONE_TOP_BORDER: Record<StatTone, string> = {
  brand: "border-t-2 border-t-success",
  warn: "border-t-2 border-t-warning",
  danger: "border-t-2 border-t-destructive",
  neutral: "border-t-2 border-t-border",
};

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  trend,
  compact = false,
  className,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  /** Optional semantic accent (top border + icon badge). Omit for the plain neutral-icon look. */
  tone?: StatTone;
  /**
   * A small chart under the number. It carries its own label because it is
   * usually a related series rather than this value's own history.
   */
  trend?: StatTrend;
  /** Tighter padding and a smaller number, for a dense grid of many cards. */
  compact?: boolean;
  className?: string;
}) {
  const { lang } = useI18n();
  const displayValue = typeof value === "number" ? formatLocaleNumber(lang, value) : value;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        compact ? "p-3" : "p-4",
        tone && TONE_TOP_BORDER[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "inline-flex shrink-0 rounded-lg p-1.5",
              tone ? TONE_ICON[tone] : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "font-semibold tabular-nums text-foreground",
          compact ? "mt-1.5 text-xl" : "mt-2 text-2xl",
        )}
      >
        {displayValue}
      </p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {trend && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">{trend.label}</p>
          <Sparkline trend={trend} tone={tone ?? "neutral"} lang={lang} />
        </div>
      )}
    </div>
  );
}

/** Drawing box, in SVG user units. Scaled to the card by `viewBox`. */
const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 24;
const BAR_GAP = 2;

/**
 * A chart small enough to sit under a number, drawn as plain SVG.
 *
 * Deliberately not the charting library: six of these render on the overview,
 * and none of them needs axes, a tooltip, or a legend. What they do need is a
 * text alternative, because a shape this size carries no readable labels — so
 * the range is spoken through `aria-label` and the picture itself is hidden.
 */
function Sparkline({
  trend,
  tone,
  lang,
}: {
  trend: StatTrend;
  tone: StatTone;
  lang: Language;
}) {
  const points = trend.points.filter((value) => Number.isFinite(value));
  if (points.length === 0) return null;

  const highest = Math.max(...points, 0);
  const lowest = Math.min(...points, 0);
  // A flat series would divide by zero and collapse to the baseline; giving it
  // a span of 1 draws it as the straight line it honestly is.
  const span = highest - lowest || 1;
  const y = (value: number) =>
    SPARK_HEIGHT - ((value - lowest) / span) * SPARK_HEIGHT;

  const summary = `${trend.label}: ${points
    .map((value) => formatLocaleNumber(lang, Math.round(value * 100) / 100))
    .join(", ")}`;

  return (
    <svg
      role="img"
      aria-label={summary}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("mt-1 h-6 w-full", TONE_TREND[tone])}
    >
      {trend.kind === "line" ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          points={points
            .map((value, index) => {
              const x =
                points.length === 1
                  ? SPARK_WIDTH / 2
                  : (index / (points.length - 1)) * SPARK_WIDTH;
              return `${x},${y(value)}`;
            })
            .join(" ")}
        />
      ) : (
        points.map((value, index) => {
          const slot = SPARK_WIDTH / points.length;
          const height = Math.max(SPARK_HEIGHT - y(value), 1);
          return (
            <rect
              key={index}
              x={index * slot}
              y={SPARK_HEIGHT - height}
              width={Math.max(slot - BAR_GAP, 1)}
              height={height}
              fill="currentColor"
              opacity={0.75}
            />
          );
        })
      )}
    </svg>
  );
}
