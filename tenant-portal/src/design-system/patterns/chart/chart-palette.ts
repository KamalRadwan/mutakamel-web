/**
 * The chart palette, and the two rules that make it the only one.
 *
 * `docs/design/tokens.md#charts` is explicit: **there is no generic 5-slot
 * categorical chart palette, and one must not be invented.** The system has
 * four hues; four hues cannot encode an arbitrary categorical breakdown, and
 * cycling or generating more produces exactly the unvalidated rainbow the
 * design system exists to prevent.
 *
 * So there are exactly two ways to colour a series, and every chart takes one:
 *
 * 1. **A status breakdown** — `byStatus`, win/loss, stage outcome — uses the
 *    four roles directly, through `STATUS_FILL`.
 * 2. **A qualitative breakdown** — `bySource`, `byOwner`, `byCountry` — uses
 *    top-N plus "Other" on the single-hue `brand-200 … brand-800` ramp, through
 *    `topNWithOther` and `QUALITATIVE_RAMP`. **Order carries the meaning, not
 *    hue.**
 *
 * Colours are CSS `var()` references, not resolved values, so a chart repaints
 * with the theme flip and with a tenant's runtime brand override (6.17) without
 * re-rendering.
 */

export type ChartRole = "brand" | "positive" | "caution" | "negative";

export const STATUS_FILL: Record<ChartRole, string> = {
  brand: "var(--color-brand-600)",
  positive: "var(--color-positive-600)",
  caution: "var(--color-caution-600)",
  negative: "var(--color-negative-600)",
};

/**
 * The canonical order status segments are drawn in.
 *
 * `caution` and `negative` sit ~30° apart and fail the perceptual-distance
 * floor for **normal** vision, which a secondary encoding does not excuse. This
 * order puts `brand` between them, so in any breakdown carrying three or more
 * roles they are never adjacent fills — by construction, not by review.
 *
 * A two-role `{caution, negative}` breakdown has nowhere to put a separator,
 * and reordering cannot help. That case is handled by `SEGMENT_SEPARATOR`
 * instead: a background-coloured stroke between segments, which makes them two
 * objects rather than one gradient.
 */
export const STATUS_DRAW_ORDER: readonly ChartRole[] = ["positive", "caution", "brand", "negative"];

/** Painted between adjacent fills, so no two ever meet edge to edge. */
export const SEGMENT_SEPARATOR = "var(--card)";

/**
 * `brand-200 … brand-800`, darkest first.
 *
 * Seven steps, so a qualitative breakdown supports **six** real categories plus
 * "Other". Past that the chart is not readable anyway and the answer is a
 * table, not more colours.
 */
export const QUALITATIVE_RAMP: readonly string[] = [
  "var(--color-brand-800)",
  "var(--color-brand-700)",
  "var(--color-brand-600)",
  "var(--color-brand-500)",
  "var(--color-brand-400)",
  "var(--color-brand-300)",
  "var(--color-brand-200)",
];

export const MAX_QUALITATIVE_CATEGORIES = QUALITATIVE_RAMP.length - 1;

export interface QualitativeSlice {
  key: string;
  /** Already translated. */
  label: string;
  /** Kept as the decimal string it arrived as; the chart parses only for geometry. */
  value: number;
  fill: string;
  isOther: boolean;
}

export interface TopNInput {
  key: string;
  label: string;
  value: number;
}

/**
 * Collapses a qualitative breakdown to top-N plus "Other", and assigns the
 * single-hue ramp in descending order.
 *
 * The largest slice is the darkest. That is the whole encoding: a reader who
 * cannot distinguish two adjacent blues can still read the order, which is what
 * a sequential ramp buys and a categorical rainbow does not.
 *
 * `otherLabel` arrives translated — this module never reads the dictionary.
 */
export function topNWithOther(
  data: TopNInput[],
  otherLabel: string,
  limit = MAX_QUALITATIVE_CATEGORIES,
): QualitativeSlice[] {
  const capped = Math.max(1, Math.min(limit, MAX_QUALITATIVE_CATEGORIES));
  const sorted = [...data].sort((left, right) => right.value - left.value);
  const head = sorted.slice(0, capped);
  const tail = sorted.slice(capped);

  const slices: QualitativeSlice[] = head.map((entry, index) => ({
    ...entry,
    fill: QUALITATIVE_RAMP[index],
    isOther: false,
  }));

  if (tail.length > 0) {
    slices.push({
      key: "__other__",
      label: otherLabel,
      value: tail.reduce((total, entry) => total + entry.value, 0),
      // Always the lightest step, whatever N is — "Other" is the residual and
      // reads as the least of the set no matter how many categories precede it.
      fill: QUALITATIVE_RAMP[QUALITATIVE_RAMP.length - 1],
      isOther: true,
    });
  }

  return slices;
}

/** Sorts status series into `STATUS_DRAW_ORDER`. Unknown roles keep their relative order, last. */
export function orderStatusRoles<T extends { role: ChartRole }>(series: T[]): T[] {
  return [...series].sort(
    (left, right) => STATUS_DRAW_ORDER.indexOf(left.role) - STATUS_DRAW_ORDER.indexOf(right.role),
  );
}

/** True when the drawn order would put `caution` and `negative` edge to edge. */
export function hasAdjacentCautionNegative(roles: readonly ChartRole[]): boolean {
  return roles.some(
    (role, index) =>
      index > 0 &&
      ((role === "caution" && roles[index - 1] === "negative") ||
        (role === "negative" && roles[index - 1] === "caution")),
  );
}
