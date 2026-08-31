import type { Language } from "@/i18n/I18nContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { DashboardVisual, DashboardVisualPoint } from "@/types/dashboard";

/**
 * Puts Core's charts into the reader's language.
 *
 * Core authors every visual with an English title and English series, stage,
 * and row labels, because a backend cannot know who is reading. The portal
 * has always owned ar/en copy, and it owns this too — the dashboard defaults
 * to Arabic, so before this every chart on every tab was an English island
 * inside an Arabic page.
 *
 * Titles resolve by `visual.key`, which is the stable namespace Core emits
 * for exactly this purpose. Everything else resolves by its English string:
 * those strings are a small controlled vocabulary, shared across groups
 * ("Succeeded", "All time", "Collected"), so one term table covers series
 * labels, funnel stages, bullet rows, waterfall steps, and the humanised
 * status values that arrive as category names.
 *
 * Anything without an entry falls through unchanged, so a visual Core adds
 * tomorrow renders in English rather than breaking.
 */
export function localizeVisual(
  visual: DashboardVisual,
  lang: Language,
  t: Dictionary,
): DashboardVisual {
  if (lang === "en") return visual;

  const titles = t.dashboard.visualTitles as Record<string, string | undefined>;
  const terms = t.dashboard.visualTerms as Record<string, string | undefined>;
  const term = (value: string) => terms[value] ?? value;

  const base = {
    ...visual,
    title: titles[visual.key] ?? term(visual.title),
    subtitle: visual.subtitle ? term(visual.subtitle) : visual.subtitle,
  };

  switch (base.kind) {
    case "donut":
    case "bar":
    case "pareto":
    case "funnel":
      return {
        ...base,
        data: { categories: base.data.categories.map((point) => label(point, term)) },
      };
    case "line":
    case "area":
      // Bucket labels are formatted dates, not vocabulary; leave them alone.
      return base;
    case "comparison":
    case "diverging":
    case "stacked":
    case "dual-axis":
      return {
        ...base,
        data: {
          primaryLabel: term(base.data.primaryLabel),
          secondaryLabel: term(base.data.secondaryLabel),
          pairs: base.data.pairs.map((pair) => ({
            ...pair,
            label: term(pair.label),
          })),
        },
      };
    case "bullet":
      return {
        ...base,
        data: {
          rows: base.data.rows.map((row) => ({ ...row, label: term(row.label) })),
        },
      };
    case "waterfall":
      return {
        ...base,
        data: {
          steps: base.data.steps.map((step) => ({ ...step, label: term(step.label) })),
        },
      };
    case "heatmap":
      return {
        ...base,
        data: {
          columns: base.data.columns.map(term),
          rows: base.data.rows.map((row) => ({ ...row, label: term(row.label) })),
        },
      };
    case "gauge":
      return base;
  }
}

function label(
  point: DashboardVisualPoint,
  term: (value: string) => string,
): DashboardVisualPoint {
  return { ...point, label: term(point.label) };
}
