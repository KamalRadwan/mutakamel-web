import type { Language } from "@/i18n/I18nContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { DashboardGroupAlert, DashboardMetric } from "@/types/dashboard";
import { humanizeDashboardField } from "./dashboard-groups";

/**
 * Puts the rest of Core's authored copy into the reader's language.
 *
 * Charts go through `localize-visual.ts`; this covers everything else a group
 * tab renders from the response — headline metric names and their captions,
 * alert sentences, and the field names in the exact-value table. Core writes
 * all of it in English because a backend cannot know who is reading, and the
 * portal defaults to Arabic, so without this a tab was Arabic chrome around
 * English content.
 *
 * Every lookup falls back to what Core sent, so a metric or alert added
 * tomorrow shows in English rather than disappearing.
 */

export function resolveMetricLabel(
  card: DashboardMetric,
  lang: Language,
  t: Dictionary,
): string {
  if (lang === "en") return card.label;
  const labels = t.dashboard.metricLabels as Record<string, string | undefined>;
  return labels[card.key] ?? card.label;
}

export function resolveMetricDescription(
  card: DashboardMetric,
  lang: Language,
  t: Dictionary,
): string {
  if (lang === "en" || !card.description) return card.description;
  const descriptions = t.dashboard.metricDescriptions as Record<
    string,
    string | undefined
  >;
  return (
    descriptions[card.key] ??
    resolveComposedDescription(card.description, t) ??
    card.description
  );
}

/**
 * Core composes a few captions at runtime — "30% of total", "Across 227
 * affected records". The number is already formatted for the request, so only
 * the frame around it is translated.
 */
function resolveComposedDescription(
  description: string,
  t: Dictionary,
): string | undefined {
  const patterns = t.dashboard.metricPatterns;
  const rules: Array<[RegExp, string]> = [
    [/^(.+?) of total capacity$/, patterns.percentOfCapacity],
    [/^(.+?) of total$/, patterns.percentOfTotal],
    [/^Across (.+?) affected records?$/, patterns.affectedRecords],
    [/^(.+?) in progress$/, patterns.inProgress],
  ];

  if (description === "No open alerts") return patterns.noOpenAlerts;
  for (const [pattern, frame] of rules) {
    const match = pattern.exec(description);
    if (match) return frame.replace("{value}", match[1]);
  }
  return undefined;
}

export function resolveAlertMessage(
  alert: DashboardGroupAlert,
  lang: Language,
  t: Dictionary,
): string {
  if (lang === "en") return alert.message;
  const messages = t.dashboard.alertMessages as Record<string, string | undefined>;
  const translated = messages[alert.key];
  if (!translated) return alert.message;
  if (!translated.includes("{n}")) return translated;
  // Core interpolated a window length into the sentence; carry it across.
  const number = /\d+/.exec(alert.message)?.[0] ?? "";
  return translated.replace("{n}", number);
}

/**
 * A field path is joined from raw names (`byteUsage`, `maximumBytes`). Each
 * segment resolves on its own so a nested path translates end to end, and a
 * segment that is a status value falls through to the shared chart terms.
 */
export function resolveFieldLabel(
  segments: string[],
  lang: Language,
  t: Dictionary,
): string {
  return segments
    .map((segment) => resolveFieldSegment(segment, lang, t))
    .join(" · ");
}

function resolveFieldSegment(
  segment: string,
  lang: Language,
  t: Dictionary,
): string {
  const humanized = humanizeSegment(segment);
  if (lang === "en") return humanized;
  const fields = t.dashboard.fieldLabels as Record<string, string | undefined>;
  const terms = t.dashboard.visualTerms as Record<string, string | undefined>;
  return fields[segment] ?? terms[humanized] ?? humanized;
}

/**
 * A breakdown's leaves are wire enums, not field names, so a path can end in
 * `PROVISIONING_FAILED`. `humanizeDashboardField` only splits camel case and
 * leaves those screaming, which reads badly in English and misses the shared
 * term table in Arabic — both languages want "Provisioning Failed".
 */
function humanizeSegment(segment: string): string {
  if (/^[A-Z][A-Z0-9_]*$/.test(segment)) {
    return segment
      .toLowerCase()
      .replace(/_+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
  return humanizeDashboardField(segment);
}
