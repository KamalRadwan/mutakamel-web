/**
 * Conversions for the "Evidence cutoff (UTC)" `datetime-local` field.
 *
 * FE-G02. The field is labelled UTC and was neither read nor written as UTC.
 * The ISO instant was shifted by the browser's offset before rendering, and the
 * bare `datetime-local` string was parsed by `new Date`, which reads it as
 * local. The round trip was self-consistent, so nothing looked wrong - but an
 * operator in UTC+3 who read the label, typed 10:00 and expected a 10:00 UTC
 * boundary got 07:00 UTC. On an evidence cutoff that is three hours of
 * discovery silently included or excluded.
 */

/** Renders an ISO instant into the field, in UTC. */
export function isoToUtcInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 19);
}

/** Reads the field back as UTC. */
export function utcInputToIso(value: string): string {
  if (!value) return "";
  // `datetime-local` yields no zone designator, and `new Date` would read that
  // as local. The Z is what makes the typed digits mean what the label says.
  const parsed = new Date(`${value}Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}
