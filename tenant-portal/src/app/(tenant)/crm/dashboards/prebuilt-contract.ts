// Wire contract for the seven prebuilt CRM reports.
//
// Transcribed from crm-app/src/crm/dashboards/dashboards.controller.ts and
// dashboards.service.ts. These seven routes predate the dashboard builder and
// share nothing with it but a permission: each returns a **fixed, named set of
// widgets** with a bespoke shape per widget, not a generic widget result.
//
// Every widget key and every column name below is copied from the SELECT that
// produces it. Two consequences are load-bearing:
//
//   * `repWorkload` aliases its count `AS openTasks` **unquoted**, so
//     PostgreSQL folds it and the JSON key is `opentasks`. Reading `openTasks`
//     yields `undefined` on every row. See docs/api/crm-dashboards.md.
//   * Every money aggregate is cast `::float`, so it is a JSON number.

import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  record,
  timestamp,
} from "./dashboard-parse";

const PREBUILT_ROOT = "/api/tenant/crm/v1/dashboards";

const PREBUILT_REPORT_KEYS = [
  "overview",
  "sales-pipeline",
  "leads",
  "activities-productivity",
  "customer-intelligence",
  "data-quality",
  "action-center",
] as const;
export type PrebuiltReportKey = (typeof PREBUILT_REPORT_KEYS)[number];

/**
 * How one prebuilt widget's payload is shaped.
 *
 * `COUNT` — a bare JSON number (`DashboardsService.scalar`).
 * `MONEY_TOTALS` — `currencyTotals`: `{ value?, currencyCode?, byCurrency[], warnings[] }`.
 * `CONVERSION` — `{ total, converted, rate }`.
 * `CALENDAR` — `{ count, minutes }`.
 * `MISSING_OWNER` — `{ opportunities, leads, customerProfiles }`.
 * `TABLE` — an array of rows with the listed columns.
 */
type PrebuiltWidgetKind =
  | "COUNT"
  | "MONEY_TOTALS"
  | "CONVERSION"
  | "CALENDAR"
  | "MISSING_OWNER"
  | "TABLE";

export interface PrebuiltWidgetSpec {
  key: string;
  kind: PrebuiltWidgetKind;
  /** Exactly the columns the SELECT projects, in its own order. */
  columns?: readonly string[];
}

const STALE_DEAL_COLUMNS = ["title", "ownerUserId", "value", "currencyCode", "updatedAt"] as const;
const UNTOUCHED_LEAD_COLUMNS = ["displayName", "ownerUserId", "createdAt"] as const;
const OVERDUE_TASK_COLUMNS = ["title", "status", "dueAt", "ownerUserId"] as const;

export const PREBUILT_REPORTS: ReadonlyArray<{
  key: PrebuiltReportKey;
  path: string;
  widgets: readonly PrebuiltWidgetSpec[];
}> = [
  {
    key: "overview",
    path: `${PREBUILT_ROOT}/overview`,
    widgets: [
      { key: "pipelineValue", kind: "MONEY_TOTALS" },
      { key: "wonValue", kind: "MONEY_TOTALS" },
      { key: "activeDeals", kind: "COUNT" },
      { key: "newLeads", kind: "COUNT" },
      { key: "overdueWork", kind: "COUNT" },
      { key: "winLossSummary", kind: "TABLE", columns: ["status", "currencyCode", "count", "value"] },
      { key: "topReps", kind: "TABLE", columns: ["ownerUserId", "currencyCode", "value", "count"] },
      { key: "staleDeals", kind: "TABLE", columns: STALE_DEAL_COLUMNS },
    ],
  },
  {
    key: "sales-pipeline",
    path: `${PREBUILT_ROOT}/sales-pipeline`,
    widgets: [
      { key: "stageDistribution", kind: "TABLE", columns: ["stageId", "currencyCode", "count", "value"] },
      { key: "lostReasons", kind: "TABLE", columns: ["reason", "count"] },
      { key: "multiPipelineComparison", kind: "TABLE", columns: ["pipelineId", "currencyCode", "count", "value"] },
      { key: "currencyBreakdown", kind: "TABLE", columns: ["currencyCode", "count", "value"] },
      { key: "staleDeals", kind: "TABLE", columns: STALE_DEAL_COLUMNS },
    ],
  },
  {
    key: "leads",
    path: `${PREBUILT_ROOT}/leads`,
    widgets: [
      { key: "conversionRate", kind: "CONVERSION" },
      { key: "leadSources", kind: "TABLE", columns: ["source", "count"] },
      { key: "sourceToValue", kind: "TABLE", columns: ["source", "currencyCode", "value", "opportunities"] },
      { key: "ownerBalance", kind: "TABLE", columns: ["ownerUserId", "count"] },
      { key: "untouchedLeads", kind: "TABLE", columns: UNTOUCHED_LEAD_COLUMNS },
    ],
  },
  {
    key: "activities-productivity",
    path: `${PREBUILT_ROOT}/activities-productivity`,
    widgets: [
      { key: "calendarUtilization", kind: "CALENDAR" },
      { key: "activityMix", kind: "TABLE", columns: ["type", "count"] },
      { key: "reminderSummary", kind: "TABLE", columns: ["status", "count"] },
      // `opentasks`, lower-cased by PostgreSQL — see the file header.
      { key: "repWorkload", kind: "TABLE", columns: ["ownerUserId", "opentasks"] },
      { key: "overdueTasks", kind: "TABLE", columns: OVERDUE_TASK_COLUMNS },
    ],
  },
  {
    key: "customer-intelligence",
    path: `${PREBUILT_ROOT}/customer-intelligence`,
    widgets: [
      { key: "customerStatusMix", kind: "TABLE", columns: ["status", "count"] },
      { key: "contactDepth", kind: "TABLE", columns: ["displayName", "contactPeople"] },
      { key: "engagementSummary", kind: "TABLE", columns: ["displayName", "activities"] },
    ],
  },
  {
    key: "data-quality",
    path: `${PREBUILT_ROOT}/data-quality`,
    widgets: [
      { key: "missingOwner", kind: "MISSING_OWNER" },
      { key: "missingAmount", kind: "COUNT" },
      { key: "missingCurrency", kind: "COUNT" },
      { key: "missingContact", kind: "COUNT" },
      { key: "missingCommercialData", kind: "COUNT" },
      { key: "duplicateSignals", kind: "TABLE", columns: ["mobile", "parties"] },
    ],
  },
  {
    key: "action-center",
    path: `${PREBUILT_ROOT}/action-center`,
    widgets: [
      { key: "staleOpportunities", kind: "TABLE", columns: STALE_DEAL_COLUMNS },
      { key: "untouchedLeads", kind: "TABLE", columns: UNTOUCHED_LEAD_COLUMNS },
      { key: "overdueTasks", kind: "TABLE", columns: OVERDUE_TASK_COLUMNS },
      { key: "dataCleanupItems", kind: "TABLE", columns: ["title", "ownerUserId", "reason"] },
    ],
  },
];

interface CurrencyTotal {
  currencyCode: string;
  value: number;
}

export type PrebuiltWidgetValue =
  | { kind: "COUNT"; value: number }
  | { kind: "MONEY_TOTALS"; total: CurrencyTotal | null; byCurrency: CurrencyTotal[]; warnings: string[] }
  | { kind: "CONVERSION"; total: number; converted: number; rate: number }
  | { kind: "CALENDAR"; count: number; minutes: number }
  | { kind: "MISSING_OWNER"; opportunities: number; leads: number; customerProfiles: number }
  | { kind: "TABLE"; rows: Array<Record<string, unknown>> }
  | { kind: "UNAVAILABLE" };

export interface PrebuiltReportResult {
  generatedAt: string;
  dateFrom: string | null;
  dateTo: string | null;
  widgets: Record<string, PrebuiltWidgetValue>;
}

export function prebuiltReportQuery(branchId: string | null): string {
  // `DashboardQueryDto` carries no `datePreset` and no `compare` — the seven
  // prebuilt routes take `dateFrom`/`dateTo`/`branchId`/`ownerUserId`/
  // `pipelineId`/`currencyCode`/`staleDays`/`limit` and nothing else.
  return branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
}

export function isPrebuiltReportKey(value: unknown): value is PrebuiltReportKey {
  return PREBUILT_REPORT_KEYS.includes(value as PrebuiltReportKey);
}

export function parsePrebuiltReport(
  payload: unknown,
  specs: readonly PrebuiltWidgetSpec[],
): PrebuiltReportResult {
  const source = record(payload);
  const widgets = record(source?.widgets);
  if (!source || !widgets || !timestamp(source.generatedAt)) {
    invalidResponse("prebuilt dashboard");
  }
  const filters = record(source.filters) ?? {};
  return {
    generatedAt: source.generatedAt,
    dateFrom: timestamp(filters.dateFrom) ? filters.dateFrom : null,
    dateTo: timestamp(filters.dateTo) ? filters.dateTo : null,
    widgets: Object.fromEntries(
      specs.map((spec) => [spec.key, parseWidgetValue(spec, widgets[spec.key])]),
    ),
  };
}

function parseWidgetValue(spec: PrebuiltWidgetSpec, payload: unknown): PrebuiltWidgetValue {
  if (payload === undefined || payload === null) return { kind: "UNAVAILABLE" };
  switch (spec.kind) {
    case "COUNT":
      return finiteNumber(payload) ? { kind: "COUNT", value: payload } : { kind: "UNAVAILABLE" };
    case "MONEY_TOTALS": {
      const source = record(payload);
      if (!source || !boundedArray(source.byCurrency, 64)) return { kind: "UNAVAILABLE" };
      const byCurrency = source.byCurrency.flatMap(parseCurrencyTotal);
      return {
        kind: "MONEY_TOTALS",
        // `currencyTotals` sets `value`/`currencyCode` only for a single
        // currency; with two it emits `MULTI_CURRENCY_SPLIT` and no total.
        total:
          finiteNumber(source.value) && nonEmptyString(source.currencyCode)
            ? { currencyCode: source.currencyCode, value: source.value }
            : null,
        byCurrency,
        warnings: Array.isArray(source.warnings)
          ? source.warnings.filter((warning): warning is string => typeof warning === "string")
          : [],
      };
    }
    case "CONVERSION": {
      const source = record(payload);
      if (!source || !finiteNumber(source.total) || !finiteNumber(source.converted)) {
        return { kind: "UNAVAILABLE" };
      }
      return {
        kind: "CONVERSION",
        total: source.total,
        converted: source.converted,
        // A ratio in 0..1, not a percentage — `converted / total`.
        rate: finiteNumber(source.rate) ? source.rate : 0,
      };
    }
    case "CALENDAR": {
      const source = record(payload);
      if (!source || !finiteNumber(source.count) || !finiteNumber(source.minutes)) {
        return { kind: "UNAVAILABLE" };
      }
      return { kind: "CALENDAR", count: source.count, minutes: source.minutes };
    }
    case "MISSING_OWNER": {
      const source = record(payload);
      if (
        !source ||
        !finiteNumber(source.opportunities) ||
        !finiteNumber(source.leads) ||
        !finiteNumber(source.customerProfiles)
      ) {
        return { kind: "UNAVAILABLE" };
      }
      return {
        kind: "MISSING_OWNER",
        opportunities: source.opportunities,
        leads: source.leads,
        customerProfiles: source.customerProfiles,
      };
    }
    case "TABLE":
      return boundedArray(payload, 1000)
        ? {
            kind: "TABLE",
            rows: payload.flatMap((row) => {
              const parsed = record(row);
              return parsed ? [parsed] : [];
            }),
          }
        : { kind: "UNAVAILABLE" };
  }
}

function parseCurrencyTotal(payload: unknown): CurrencyTotal[] {
  const source = record(payload);
  if (!source || !nonEmptyString(source.currencyCode) || !finiteNumber(source.value)) return [];
  return [{ currencyCode: source.currencyCode, value: source.value }];
}
