import { formatTemplate } from "./template";

/**
 * Every code this process has already reported, so a 200-row table does not
 * emit 200 identical warnings. Module scope on purpose: the interesting event
 * is "this build met a code it has no label for", which happens once.
 */
const reported = new Set<string>();

/**
 * Resolves a backend wire value to a translated label — and **never falls back
 * to the wire value itself.**
 *
 * `labels[value] ?? value` is the pattern this replaces. It reads as safe and
 * is not: the day the backend adds an enum member, that member reaches an
 * Arabic-speaking user as a bare English SCREAMING_CASE code, in a UI that
 * otherwise contains no English. Worse, it fails silently — nothing in the
 * build, the tests or the logs says a label is missing, so the only detection
 * channel is a user complaining.
 *
 * This makes both halves explicit:
 *
 *   * The user sees a **translated** sentence naming the code as an unknown
 *     value. The code stays visible inside it because it is the evidence a
 *     support ticket needs — the same reasoning `StatusBadge` and `WidgetTile`
 *     already apply to an unmapped status.
 *   * `console.warn` fires once per unseen code, which is the signal that a
 *     dictionary entry is owed. Deduped by `${group}.${value}` so a list of
 *     rows reports once, not per row.
 *
 * @param labels     the dictionary map for this enum, e.g. `t.status.*`
 * @param value      the wire value
 * @param unknown    translated template carrying `{code}`
 * @param group      dictionary path, for the warning only
 */
export function wireLabel(
  labels: Readonly<Record<string, string | undefined>>,
  value: string,
  unknown: string,
  group: string,
): string {
  const label = labels[value];
  if (label !== undefined) return label;

  const key = `${group}.${value}`;
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(
      `Untranslated wire value: ${key}. Add it to both dictionaries — see docs/design/i18n.md#enum-labels-are-dictionary-entries.`,
    );
  }
  return formatTemplate(unknown, { code: value });
}

/** Test seam. The dedupe set is process-wide by design. */
export function resetWireLabelWarnings(): void {
  reported.clear();
}
