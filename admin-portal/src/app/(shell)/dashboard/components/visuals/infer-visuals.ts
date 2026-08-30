import type {
  DashboardGroup,
  DashboardVisual,
  DashboardVisualPair,
  DashboardVisualPoint,
  DashboardVisualUnit,
} from "@/types/dashboard";
import { humanizeDashboardField } from "../../utils/dashboard-groups";

/**
 * TEMPORARY BRIDGE — delete when every provider emits `visuals[]`.
 *
 * `snapshot`, `period`, and `breakdowns` are `Record<string, unknown>`, so
 * this is the only way to draw them without a Core release: infer the shape
 * from the value's structure, and the unit from the key's spelling. That
 * spelling rule is exactly the guesswork the visuals contract exists to
 * remove, which is why this file is pure, unit-tested, and self-contained —
 * `DashboardGroupPanel` prefers `group.visuals` whenever Core supplies it,
 * and this runs only as the fallback.
 */

export interface InferenceCopy {
  snapshotLabel: string;
  periodLabel: string;
}

/** Gauges read as noise past a couple per tab; ranked bars do not. */
const MAX_GAUGES = 3;
const MAX_VISUALS = 9;
const DONUT_MAX_SLICES = 6;

export function inferGroupVisuals(
  group: DashboardGroup,
  copy: InferenceCopy,
): DashboardVisual[] {
  if (!group.available) return [];

  const visuals: DashboardVisual[] = [
    ...inferFromBreakdowns(group.breakdowns, group.key),
    ...inferFromPeriodComparison(group.snapshot, group.period, group.key, copy),
    ...inferFromScalars(group.snapshot, `${group.key}.snapshot`),
    ...inferFromScalars(group.period, `${group.key}.period`),
    ...inferFromNestedRecords(group.snapshot, `${group.key}.snapshot`),
    ...inferFromNestedRecords(group.period, `${group.key}.period`),
  ];

  let gauges = 0;
  return visuals
    .filter((visual) => {
      if (visual.kind !== "gauge") return true;
      gauges += 1;
      return gauges <= MAX_GAUGES;
    })
    .slice(0, MAX_VISUALS);
}

/* -------------------------------------------------------------- rules -- */

/** A breakdown is always a grouping, so it is always a composition or a rank. */
function inferFromBreakdowns(
  breakdowns: Record<string, unknown>,
  groupKey: string,
): DashboardVisual[] {
  return Object.entries(breakdowns).flatMap(([field, value]) => {
    const key = `${groupKey}.breakdowns.${field}`;
    const title = humanizeDashboardField(field);

    const flat = readNumberMap(value);
    if (flat && flat.length >= 2) {
      return [categoryVisual(key, title, flat, unitOf(field))];
    }

    const nested = readNestedNumberMap(value);
    if (nested) return nestedVisual(key, title, nested);

    const rows = readObjectArray(value);
    if (rows && rows.length >= 2) {
      return [categoryVisual(key, title, rows, unitOf(field))];
    }

    return [];
  });
}

/**
 * A field reported in both bags is the one genuine comparison the current
 * payload makes: all-time state against the selected window.
 */
function inferFromPeriodComparison(
  snapshot: Record<string, unknown>,
  period: Record<string, unknown>,
  groupKey: string,
  copy: InferenceCopy,
): DashboardVisual[] {
  const shared = Object.keys(snapshot).filter((field) => {
    const unit = unitOf(field);
    return (
      unit !== "ratio" &&
      isNumeric(snapshot[field]) &&
      isNumeric(period[field])
    );
  });
  if (shared.length < 2) return [];

  const units = new Set(shared.map(unitOf));
  if (units.size > 1) return [];

  const pairs: DashboardVisualPair[] = shared.map((field) => ({
    key: field,
    label: humanizeDashboardField(field),
    primary: toNumber(snapshot[field]),
    secondary: toNumber(period[field]),
  }));

  return [
    {
      key: `${groupKey}.snapshotVsPeriod`,
      kind: "comparison",
      title: `${copy.snapshotLabel} · ${copy.periodLabel}`,
      unit: shared.map(unitOf)[0],
      emphasis: "primary",
      data: {
        pairs,
        primaryLabel: copy.snapshotLabel,
        secondaryLabel: copy.periodLabel,
      },
    },
  ];
}

/** A ratio has an implicit ceiling of 1, which is a real gauge maximum. */
function inferFromScalars(
  bag: Record<string, unknown>,
  keyPrefix: string,
): DashboardVisual[] {
  return Object.entries(bag).flatMap(([field, value]) => {
    if (unitOf(field) !== "ratio" || !isNumeric(value)) return [];
    const ratio = toNumber(value);
    if (ratio < 0 || ratio > 1) return [];
    return [
      {
        key: `${keyPrefix}.${field}`,
        kind: "gauge" as const,
        title: humanizeDashboardField(field),
        unit: "ratio" as const,
        data: { value: ratio, maximum: 1 },
      },
    ];
  });
}

/**
 * `storage.snapshot.byteUsage` and `.operations` are sub-bags, not measures.
 * Same rules one level down, with two deliberate narrowings: never a donut
 * (nothing guarantees these leaves sum to a whole) and, when the sub-bag
 * carries its own ceiling, a real gauge against it rather than a bare ratio.
 */
function inferFromNestedRecords(
  bag: Record<string, unknown>,
  keyPrefix: string,
): DashboardVisual[] {
  return Object.entries(bag).flatMap(([field, value]) => {
    if (!isRecord(value)) return [];
    const entries = readPartialNumberMap(value);
    if (entries.length < 2) return [];

    const label = humanizeDashboardField(field);
    const byUnit = new Map<DashboardVisualUnit, DashboardVisualPoint[]>();
    entries.forEach((entry) => {
      const unit = unitOf(entry.key);
      byUnit.set(unit, [...(byUnit.get(unit) ?? []), entry]);
    });

    return [...byUnit.entries()].flatMap<DashboardVisual>(([unit, points]) => {
      if (unit === "ratio") {
        return points
          .filter((point) => point.value > 0 && point.value <= 1)
          .map((point) => ({
            key: `${keyPrefix}.${field}.${point.key}`,
            kind: "gauge",
            title: `${label} · ${point.label}`,
            unit: "ratio",
            data: { value: point.value, maximum: 1 },
          }));
      }

      const ceiling = points.find((point) => /^maximum/i.test(point.key));
      const rest = points.filter((point) => point !== ceiling && point.value > 0);
      if (rest.length === 0) return [];

      if (ceiling && ceiling.value > 0) {
        const used = rest.find((point) => /^(utilized|used|current|assigned)/i.test(point.key));
        return [
          ...(used
            ? [
                {
                  key: `${keyPrefix}.${field}.${used.key}`,
                  kind: "gauge" as const,
                  title: `${label} · ${used.label}`,
                  unit,
                  data: { value: used.value, maximum: ceiling.value },
                },
              ]
            : []),
          {
            key: `${keyPrefix}.${field}.${unit}`,
            kind: "bar" as const,
            title: label,
            unit,
            data: { categories: rest },
          },
        ];
      }

      if (rest.length < 2) return [];
      return [
        {
          key: `${keyPrefix}.${field}.${unit}`,
          kind: "bar",
          title: label,
          unit,
          data: { categories: rest },
        },
      ];
    });
  });
}

/* ------------------------------------------------------------ helpers -- */

function categoryVisual(
  key: string,
  title: string,
  points: DashboardVisualPoint[],
  unit: DashboardVisualUnit,
): DashboardVisual {
  const populated = points.filter((point) => point.value > 0);
  const usable = populated.length > 0 ? populated : points;
  const kind = usable.length <= DONUT_MAX_SLICES ? "donut" : "bar";
  return { key, kind, title, unit, data: { categories: usable } };
}

/**
 * A map of objects carries two measures per category. Same unit reads as a
 * grouped comparison; different units need the second on its own axis.
 */
function nestedVisual(
  key: string,
  title: string,
  nested: NestedMap,
): DashboardVisual[] {
  const { primaryField, secondaryField, rows } = nested;
  const primaryUnit = unitOf(primaryField);
  const secondaryUnit = unitOf(secondaryField);
  return [
    {
      key,
      kind: primaryUnit === secondaryUnit ? "comparison" : "dual-axis",
      title,
      unit: primaryUnit,
      secondaryUnit,
      emphasis: "primary",
      data: {
        pairs: rows,
        primaryLabel: humanizeDashboardField(primaryField),
        secondaryLabel: humanizeDashboardField(secondaryField),
      },
    },
  ];
}

interface NestedMap {
  primaryField: string;
  secondaryField: string;
  rows: DashboardVisualPair[];
}

function readNumberMap(value: unknown): DashboardVisualPoint[] | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;
  if (!entries.every(([, entry]) => isNumeric(entry))) return undefined;
  return entries.map(([field, entry]) => ({
    key: field,
    label: humanizeDashboardField(field),
    value: toNumber(entry),
  }));
}

/** Ignores non-numeric leaves (`byteUsage.available` is a boolean flag). */
function readPartialNumberMap(value: Record<string, unknown>): DashboardVisualPoint[] {
  return Object.entries(value)
    .filter(([, entry]) => isNumeric(entry))
    .map(([field, entry]) => ({
      key: field,
      label: humanizeDashboardField(field),
      value: toNumber(entry),
    }));
}

function readNestedNumberMap(value: unknown): NestedMap | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length < 2) return undefined;
  if (!entries.every(([, entry]) => isRecord(entry))) return undefined;

  const first = entries[0][1] as Record<string, unknown>;
  const numericFields = Object.keys(first).filter((field) =>
    entries.every(([, entry]) => isNumeric((entry as Record<string, unknown>)[field])),
  );
  if (numericFields.length < 2) return undefined;

  const [primaryField, secondaryField] = numericFields;
  return {
    primaryField,
    secondaryField,
    rows: entries.map(([field, entry]) => {
      const record = entry as Record<string, unknown>;
      return {
        key: field,
        label: humanizeDashboardField(field),
        primary: toNumber(record[primaryField]),
        secondary: toNumber(record[secondaryField]),
      };
    }),
  };
}

const LABEL_FIELDS = ["label", "name", "countryName", "title", "key"] as const;
const VALUE_FIELDS = ["value", "count", "total", "amount"] as const;

function readObjectArray(value: unknown): DashboardVisualPoint[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (!value.every(isRecord)) return undefined;

  const rows = value as Array<Record<string, unknown>>;
  const labelField = LABEL_FIELDS.find((field) =>
    rows.every((row) => typeof row[field] === "string"),
  );
  const valueField = VALUE_FIELDS.find((field) =>
    rows.every((row) => isNumeric(row[field])),
  );
  if (!labelField || !valueField) return undefined;

  return rows.map((row, index) => ({
    key: String(row.key ?? row[labelField] ?? index),
    label: String(row[labelField]),
    value: toNumber(row[valueField]),
  }));
}

/**
 * Unit from the key's spelling. Mirrors the suffix convention Core's
 * providers already follow (`*Usd`, `*Seconds`, `*Bytes`, `*Ratio`).
 */
export function unitOf(field: string): DashboardVisualUnit {
  if (/usd$/i.test(field)) return "usd";
  if (/seconds$/i.test(field)) return "seconds";
  if (/bytes$/i.test(field)) return "bytes";
  if (/(ratio|rate|utilization|concentration)$/i.test(field)) return "ratio";
  return "count";
}

/** Money arrives as a fixed-point string from `toDashboardDecimal`. */
function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }
  return false;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
