import type { WidgetResult, WidgetSeries } from "./dashboard-run-contract";
import type { WidgetCell, WidgetTableModel } from "./widget-view";
import { record } from "./dashboard-parse";
import { cohortMaturityCell, type CohortMaturityReason } from "./widget-cohort-maturity";
import { datasetComparisonDetails, datasetPointEvidence, type DatasetComparisonLabels } from "./widget-dataset-comparison";
import { LEAD_SOURCE_GROWTH_METRIC, readSourceGrowth } from "./widget-source-growth";
import { readMonthlyIntake } from "./widget-monthly-intake";
import { readSourceMix } from "./widget-source-mix";
import { readCurrentRatingMix, readInquiryClassification, readMissingSourceShare } from "./widget-acquisition-quality";
import { leadLifecycleTable, readLeadLifecycle, type LeadLifecycleTableLabels } from "./widget-lead-lifecycle";

export interface WidgetTableHeaders {
  label: string;
  value: string;
  previousValue?: string;
  previousKey?: string;
  probability?: string;
  amount?: string;
  ageDays?: string;
  target?: string;
  governedTarget?: { actual: string; target: string; remaining: string; attainment: string; dailyPace: string; workdays: string; calendarRevision: string;
    trajectory?: { date: string; dailyWon: string; observed: string; plan: string; workday: string } };
  currentValue?: string;
  cohortConverted?: string;
  cohortEligible?: string;
  maturity?: { month: string; eligible: string; converted: string; status: string; mature: string; reasons: Record<CohortMaturityReason, string> };
  datasets?: DatasetComparisonLabels;
  sourceGrowth?: { source: string; previous: string; current: string; change: string; rate: string; total: string };
  monthlyIntake?: { month: string; leads: string; total: string };
  sourceMix?: { source: string; leads: string; share: string; total: string };
  acquisitionQuality?: { measure: string; leads: string; missing: string; total: string; rating: string; share: string; classification?: string };
  leadLifecycle?: LeadLifecycleTableLabels;
  typed?: Record<string, string>;
}

function valueCell(value: number | null | undefined, series: Pick<WidgetSeries, "unit" | "currency">, result: WidgetResult): WidgetCell {
  if (value === null || value === undefined) return { kind: "missing" };
  return series.unit === "MONEY"
    ? { kind: "money", value, currency: series.currency ?? result.currency }
    : { kind: "number", value, ...(series.unit && series.unit !== "COUNT" && result.shape !== "INTERVAL" ? { unit: series.unit } : {}) };
}

export function seriesTableModel(result: WidgetResult, headers: WidgetTableHeaders): WidgetTableModel {
  const lifecycle = headers.leadLifecycle && readLeadLifecycle(result);
  if (lifecycle && headers.leadLifecycle) return leadLifecycleTable(lifecycle, headers.leadLifecycle);
  const series = result.series;
  const quality = headers.acquisitionQuality;
  const share = readMissingSourceShare(result);
  if (share && quality) return { compactMissing: true,
    columns: [{ key: "measure", label: quality.measure, numeric: false }, { key: "count", label: quality.leads, numeric: true }],
    rows: [
      { key: "missing", cells: [{ kind: "text", text: quality.missing }, { kind: "number", value: share.numerator }] },
      { key: "total", total: true, cells: [{ kind: "text", text: quality.total }, { kind: "number", value: share.denominator }] },
    ],
  };
  const rating = readCurrentRatingMix(result);
  if (rating && quality) return { compactMissing: true,
    columns: [{ key: "rating", label: quality.rating, numeric: false }, { key: "count", label: quality.leads, numeric: true }, { key: "share", label: quality.share, numeric: true }],
    rows: [...rating.rows, { key: "total", label: quality.total, count: rating.total, sharePercent: rating.total ? 100 : null }].map(row => ({
      key: row.key, ...(row.key === "total" ? { total: true } : {}), cells: [
        { kind: "text", text: row.label }, { kind: "number", value: row.count },
        row.sharePercent === null ? { kind: "missing" } : { kind: "number", value: row.sharePercent, unit: "PERCENT" },
      ],
    })),
  };
  const classification = readInquiryClassification(result);
  if (classification?.total && quality) return {
    columns: [{ key: "category", label: quality.classification ?? headers.label, numeric: false }, { key: "count", label: quality.leads, numeric: true }],
    rows: [
      ...classification.rows.map(row => ({ key: row.key, cells: [
        { kind: "text" as const, text: row.label }, { kind: "number" as const, value: row.count },
      ] })),
      { key: "total", total: true, cells: [{ kind: "text", text: quality.total }, { kind: "number", value: classification.total }] },
    ],
  };
  const mix = readSourceMix(result);
  if (mix && headers.sourceMix && !series.some(row => row.points.some(point => point.previousValue !== undefined))) {
    const labels = headers.sourceMix;
    const entries = [...mix.rows, { key: "__total__", label: labels.total, count: mix.total, sharePercent: mix.total ? 100 : null }];
    return { compactMissing: true,
      columns: [
        { key: "source", label: labels.source, numeric: false },
        { key: "leads", label: labels.leads, numeric: true },
        { key: "share", label: labels.share, numeric: true },
      ],
      rows: entries.map(row => ({ key: row.key, ...(row.key === "__total__" ? { total: true } : {}),
        cells: [
          { kind: "text", text: row.label },
          { kind: "number", value: row.count },
          row.sharePercent === null ? { kind: "missing" } : { kind: "number", value: row.sharePercent, unit: "PERCENT" },
        ],
      })),
    };
  }
  if (series[0]?.key === LEAD_SOURCE_GROWTH_METRIC && headers.sourceGrowth) {
    const growth = readSourceGrowth(result);
    const labels = headers.sourceGrowth;
    if (!growth?.rows.length) return { columns: [], rows: [] };
    const entries = [...growth.rows, { ...growth.totals, key: "__total__", label: labels.total }];
    return {
      compactMissing: true,
      columns: (["source", "previous", "current", "change", "rate"] as const)
        .map(key => ({ key, label: labels[key], numeric: key !== "source" })),
      rows: entries.map((entry) => ({
        key: entry.key,
        ...(entry.key === "__total__" ? { total: true } : {}),
        cells: [
          { kind: "text", text: entry.label },
          { kind: "number", value: entry.previousCount },
          { kind: "number", value: entry.currentCount },
          { kind: "number", value: entry.absoluteChange, signed: true },
          entry.growthPercent === null ? { kind: "missing" }
            : { kind: "number", value: entry.growthPercent, unit: "PERCENT", signed: true },
        ],
      })),
    };
  }
  if (result.shape === "SCALAR" && series.length <= 1 && result.value !== null) {
    const unit = { unit: series[0]?.unit ?? result.unit, currency: series[0]?.currency ?? result.currency };
    const window = result.comparison?.previousWindow;
    const previousWindow = window?.from && window.to ? `${window.from} – ${window.to}` : null;
    return { columns: [
      { key: "__label__", label: headers.label, numeric: false },
      { key: "__value__", label: series[0]?.label ?? headers.value, numeric: true },
      ...(result.previousValue !== null ? [{ key: "__previous__", label: headers.previousValue ?? headers.value, numeric: true }] : []),
      ...(previousWindow ? [{ key: "__window__", label: headers.previousKey ?? headers.label, numeric: false }] : []),
      ...(result.target !== null ? [{ key: "__target__", label: headers.target ?? headers.value, numeric: true }] : []),
    ], rows: [{ key: series[0]?.points[0]?.key ?? "__scalar__", cells: [
      { kind: "text", text: headers.currentValue ?? headers.value }, valueCell(result.value, unit, result),
      ...(result.previousValue !== null ? [valueCell(result.previousValue, unit, result)] : []),
      ...(previousWindow ? [{ kind: "text" as const, text: previousWindow }] : []),
      ...(result.target !== null ? [valueCell(result.target, unit, result)] : []),
    ] }] };
  }
  if (series.length === 0) return { columns: [], rows: [] };
  const points = new Map<string, string>();
  const branchRate = record(result.details?.cohortProgress)?.groupBy === "branch" && series.some(({ unit }) => unit === "PERCENT");
  const cohort = Boolean(record(result.details?.sourceCohort)) || branchRate;
  const evidence = new Map<string, [number, number]>();
  for (const entry of series) for (const point of entry.points) {
    if (!points.has(point.key)) points.set(point.key, point.label);
    const { numerator, denominator } = point.meta;
    if (cohort && !evidence.has(point.key) && typeof numerator === "number" && typeof denominator === "number"
      && Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator)
      && numerator >= 0 && denominator > 0 && numerator <= denominator) evidence.set(point.key, [numerator, denominator]);
  }
  const indexed = series.map((entry) => ({ entry, compared: entry.points.some((point) => point.previousValue !== undefined), byKey: new Map(entry.points.map((point) => [point.key, point])) }));
  const dataset = headers.datasets ? datasetComparisonDetails(result.details) : null;
  if (dataset && headers.datasets) {
    const labels = headers.datasets;
    const periods = dataset.basis === "PERIOD";
    return { compactMissing: true, columns: [
      { key: "bucket", label: periods ? labels.bucket : headers.label, numeric: false },
      ...series.flatMap((entry, index) => [
        { key: entry.key, label: `${entry.label}${index === 0 ? ` · ${labels.baseline}` : ""}`, numeric: true },
        ...(periods ? [{ key: `${entry.key}:date`, label: `${entry.label} · ${labels.date}`, numeric: false }] : []),
        ...(index > 0 ? [{ key: `${entry.key}:delta`, label: `${entry.label} · ${labels.delta}`, numeric: true }] : []),
      ]),
    ], rows: [...points].map(([key, label]) => ({ key, cells: [
      { kind: "text", text: label },
      ...indexed.flatMap(({ entry, byKey }, index): WidgetCell[] => {
        const point = byKey.get(key);
        const evidence = datasetPointEvidence(point?.meta ?? {});
        const text = evidence?.sourceKey ? `${evidence.sourceKey}${evidence.complete ? "" : ` · ${labels.partial}`}`
          : evidence?.reason === "UNAVAILABLE" ? labels.unavailable : evidence?.reason === "UNOBSERVED" ? labels.unobserved : labels.unmatched;
        return [valueCell(point?.value, entry, result), ...(periods ? [{ kind: "text" as const, text }] : []),
          ...(index > 0 ? [valueCell(evidence?.absoluteChange, entry, result)] : [])];
      }),
    ] })) };
  }
  if (headers.maturity && record(result.details?.cohortMaturity)) {
    const labels = headers.maturity;
    const number = (value: number | null | undefined): WidgetCell => value == null ? { kind: "missing" } : { kind: "number", value };
    return {
      compactMissing: true,
      columns: [
        { key: "month", label: labels.month, numeric: false }, { key: "eligible", label: labels.eligible, numeric: true },
        ...series.flatMap((entry) => [
          { key: entry.key, label: `${entry.label} (%)`, numeric: true },
          { key: `${entry.key}:n`, label: `${entry.label} · ${labels.converted}`, numeric: true },
          { key: `${entry.key}:status`, label: `${entry.label} · ${labels.status}`, numeric: false },
        ]),
      ],
      rows: [...points].map(([key, label]) => ({ key, cells: [
        { kind: "text", text: label }, number(cohortMaturityCell(indexed[0].byKey.get(key)?.meta ?? {})?.denominator),
        ...indexed.flatMap(({ entry, byKey }): WidgetCell[] => {
          const point = byKey.get(key);
          const evidence = cohortMaturityCell(point?.meta ?? {});
          return [valueCell(point?.value, entry, result), number(evidence?.numerator),
            evidence ? { kind: "text", text: evidence.reason ? labels.reasons[evidence.reason] : labels.mature } : { kind: "missing" }];
        }),
      ] })),
    };
  }
  const cohortMetricPrefix = `crm.leads.cohort.${branchRate ? "by_branch" : "by_source"}`;
  const evidenceColumns = evidence.size ? [
    { key: "__cohort_converted__", label: headers.cohortConverted ?? headers.value, metric: `${cohortMetricPrefix}.converted.count`, index: 0 },
    { key: "__cohort_eligible__", label: headers.cohortEligible ?? headers.value, metric: `${cohortMetricPrefix}.eligible.count`, index: 1 },
  ].filter(({ metric }) => !series.some(({ key }) => key === metric || key.startsWith(`${metric}:`))) : [];
  const interval = result.shape === "INTERVAL";
  const previousIntervals = series.some((entry) => entry.points.some((point) => point.previousStart || point.previousEnd));
  const columnLabel = (entry: WidgetSeries) => entry.unit === "MONEY" && (entry.currency ?? result.currency) && !entry.label.endsWith(`(${entry.currency ?? result.currency})`)
    ? `${entry.label} (${entry.currency ?? result.currency})` : entry.unit === "PERCENT" ? `${entry.label} (%)` : entry.label;
  const monthly = headers.monthlyIntake && indexed.every(({ compared }) => !compared) ? readMonthlyIntake(result) : null;
  const monthlyLabels = monthly ? headers.monthlyIntake : undefined;
  return {
    columns: [
      { key: "__label__", label: monthlyLabels?.month ?? headers.label, numeric: false },
      ...evidenceColumns.map(({ key, label }) => ({ key, label, numeric: true })),
      ...indexed.flatMap(({ entry, compared }) => {
        if (result.shape === "XY") return [
          { key: entry.key, label: headers.probability ?? headers.value, numeric: true },
          { key: `${entry.key}:y`, label: headers.amount ?? headers.value, numeric: true },
          { key: `${entry.key}:size`, label: headers.ageDays ?? headers.value, numeric: true },
        ];
        return [
          { key: entry.key, label: monthlyLabels?.leads ?? (interval ? headers.typed?.durationMs ?? columnLabel(entry) : columnLabel(entry)), numeric: true },
          ...(interval ? [{ key: `${entry.key}:start`, label: headers.typed?.startAt ?? headers.label, numeric: false }, { key: `${entry.key}:end`, label: headers.typed?.endAt ?? headers.label, numeric: false }] : []),
          ...(compared ? [
            { key: `${entry.key}:previous`, label: `${columnLabel(entry)} · ${headers.previousValue ?? headers.value}`, numeric: true },
            { key: `${entry.key}:previousKey`, label: `${entry.label} · ${headers.previousKey ?? headers.label}`, numeric: false },
            ...(previousIntervals ? [{ key: `${entry.key}:previousStart`, label: headers.typed?.previousStart ?? headers.label, numeric: false }, { key: `${entry.key}:previousEnd`, label: headers.typed?.previousEnd ?? headers.label, numeric: false }] : []),
          ] : []),
        ];
      }),
    ],
    rows: [...Array.from(points, ([pointKey, label]): WidgetTableModel["rows"][number] => ({
      key: pointKey,
      cells: [
        { kind: "text", text: label },
        ...evidenceColumns.map(({ index }): WidgetCell => {
          const value = evidence.get(pointKey)?.[index];
          return value === undefined ? { kind: "missing" } : { kind: "number", value };
        }),
        ...indexed.flatMap(({ entry, byKey, compared }): WidgetCell[] => {
          const point = byKey.get(pointKey);
          // XY's primary value is probability; the metric's MONEY unit belongs
          // to secondaryValue. Size is opportunity age in days in the executor.
          if (result.shape === "XY") return [
            point?.value == null ? { kind: "missing" } : { kind: "number", value: point.value },
            valueCell(point?.secondaryValue, entry, result),
            point?.size == null ? { kind: "missing" } : { kind: "number", value: point.size },
          ];
          const instant = (value: string | null | undefined): WidgetCell => value ? { kind: "datetime", value } : { kind: "missing" };
          return [valueCell(point?.value, entry, result), ...(interval ? [instant(point?.start), instant(point?.end)] : []), ...(compared ? [
            valueCell(point?.previousValue, entry, result),
            point?.previousKey ? { kind: "text" as const, text: point.previousKey } : { kind: "missing" as const },
            ...(previousIntervals ? [instant(point?.previousStart), instant(point?.previousEnd)] : []),
          ] : [])];
        }),
      ],
    })), ...(monthly && monthlyLabels ? [{
      key: "__total__", total: true, cells: [
        { kind: "text" as const, text: monthlyLabels.total },
        { kind: "number" as const, value: monthly.total },
      ],
    }] : [])],
  };
}
