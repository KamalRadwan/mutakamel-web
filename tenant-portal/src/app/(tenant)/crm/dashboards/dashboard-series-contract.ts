import { boundedArray, finiteNumber, invalidResponse, nonEmptyString, optionalString, record } from "./dashboard-parse";
import { isMetricUnit, type CrmMetricUnit } from "./widget-contract";

export interface WidgetPoint {
  key: string;
  label: string;
  value: number | null;
  secondaryValue: number | null;
  size?: number | null;
  previousValue?: number | null;
  previousKey?: string | null;
  previousStart?: string | null;
  previousEnd?: string | null;
  start: string | null;
  end: string | null;
  meta: Record<string, unknown>;
}

export interface WidgetSeries {
  key: string;
  label: string;
  unit: CrmMetricUnit | null;
  axis: "LEFT" | "RIGHT";
  currency: string | null;
  points: WidgetPoint[];
}

export interface WidgetCurrencyValue {
  currencyCode: string;
  value: number;
}

export interface WidgetScalarComparison {
  type: "PREVIOUS_PERIOD" | "PREVIOUS_YEAR";
  previousValue: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  previousWindow: { from: string; to: string; fromInstant: string; toInstant: string };
}

function nullableNumber(value: unknown): number | null {
  if (value === null) return null;
  if (!finiteNumber(value)) invalidResponse("widget numeric value");
  return value;
}

export function parseWidgetSeries(payload: unknown): WidgetSeries {
  const source = record(payload);
  if (!source || !nonEmptyString(source.key) || !boundedArray(source.points, 2000)) invalidResponse("widget series");
  return {
    key: source.key,
    label: nonEmptyString(source.label) ? source.label : source.key,
    unit: isMetricUnit(source.unit) ? source.unit : null,
    axis: source.axis === "RIGHT" ? "RIGHT" : "LEFT",
    currency: optionalString(source.currency),
    points: source.points.map(parsePoint),
  };
}

function parsePoint(payload: unknown): WidgetPoint {
  const source = record(payload);
  if (!source || !nonEmptyString(source.key)) invalidResponse("widget point");
  // toPoints preserves null; pairSeriesPoints attaches the matched period to
  // this point, rather than appending another series (engine/period-resolver.ts).
  return {
    key: source.key,
    label: nonEmptyString(source.label) ? source.label : source.key,
    value: nullableNumber(source.value),
    secondaryValue: source.secondaryValue === undefined ? null : nullableNumber(source.secondaryValue),
    ...(source.size === undefined ? {} : { size: nullableNumber(source.size) }),
    ...(source.previousValue === undefined ? {} : { previousValue: nullableNumber(source.previousValue) }),
    ...(source.previousKey === undefined ? {} : { previousKey: optionalString(source.previousKey) }),
    ...(source.previousStart === undefined ? {} : { previousStart: optionalString(source.previousStart) }),
    ...(source.previousEnd === undefined ? {} : { previousEnd: optionalString(source.previousEnd) }),
    start: optionalString(source.start),
    end: optionalString(source.end),
    meta: record(source.meta) ?? {},
  };
}

export function parseCurrencyValues(payload: unknown): WidgetCurrencyValue[] {
  if (payload === undefined) return [];
  if (!boundedArray(payload, 256)) invalidResponse("widget currencies");
  return payload.map((item) => {
    const source = record(item);
    if (!source || typeof source.currencyCode !== "string" || !/^[A-Z]{3}$/u.test(source.currencyCode) || !finiteNumber(source.value)) invalidResponse("widget currency");
    return { currencyCode: source.currencyCode, value: source.value };
  });
}

export function parseScalarComparison(payload: unknown): WidgetScalarComparison | undefined {
  if (payload === undefined) return undefined;
  const source = record(payload);
  const window = record(source?.previousWindow);
  if (!source || !["PREVIOUS_PERIOD", "PREVIOUS_YEAR"].includes(String(source.type)) || !window
    || ["from", "to", "fromInstant", "toInstant"].some((key) => typeof window[key] !== "string")) invalidResponse("widget comparison");
  return {
    type: source.type as WidgetScalarComparison["type"],
    previousValue: nullableNumber(source.previousValue),
    absoluteChange: nullableNumber(source.absoluteChange),
    percentChange: nullableNumber(source.percentChange),
    previousWindow: { from: window.from as string, to: window.to as string, fromInstant: window.fromInstant as string, toInstant: window.toInstant as string },
  };
}
