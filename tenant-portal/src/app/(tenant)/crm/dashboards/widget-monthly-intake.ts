import { finiteNumber, record } from "./dashboard-parse";
import type { WidgetResult } from "./dashboard-run-contract";

export function readMonthlyIntake(result: WidgetResult | undefined) {
  const series = result?.series[0];
  const evidence = record(result?.details?.monthlyIntake);
  if (result?.state !== "READY" || result.errorCode !== null || result.shape !== "TIME_SERIES" || result.series.length !== 1
    || series?.key !== "crm.leads.created.trend" || series.unit !== "COUNT" || series.points.length !== 3
    || !evidence) return null;
  const values = series.points.map(point => point.value);
  if (!values.every((value): value is number => value !== null && Number.isSafeInteger(value) && value >= 0)) return null;
  const total = values.reduce((sum, count) => sum + count, 0);
  const absoluteChange = values[2] - values[1];
  const growthPercent = evidence.growthPercent;
  if (evidence.total !== total || evidence.absoluteChange !== absoluteChange
    || (values[1] === 0 ? growthPercent !== null : !finiteNumber(growthPercent) || growthPercent < -100)) return null;
  return { total, absoluteChange, growthPercent: growthPercent as number | null };
}
