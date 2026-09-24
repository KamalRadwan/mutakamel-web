"use client";

import { StatCard, StatGrid } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ActivitySummary } from "../activity-contract";

export interface ActivityKpiStripProps {
  summary: ActivitySummary | null;
  /** The counts could not be read. The strip says so in its values and never holds the views up. */
  failed: boolean;
}

/**
 * Overdue, due today, upcoming and completed today — `GET activities/summary`
 * for the viewer's own day, under the same filters as the views bar status and
 * "overdue only", which would otherwise zero the other three.
 */
export function ActivityKpiStrip({ summary, failed }: ActivityKpiStripProps) {
  const { t } = useI18n();
  const kpis = t.activities.workspace.kpis;
  // A count is only claimed once Core has answered: an ellipsis holds its place
  // until then, and a dash says it is not coming.
  const pending = failed ? "—" : "…";

  return (
    <StatGrid className="sm:grid-cols-4">
      <StatCard label={kpis.overdue} value={summary?.overdue ?? pending} tone="danger" />
      <StatCard label={kpis.today} value={summary?.today ?? pending} tone="warn" />
      <StatCard label={kpis.upcoming} value={summary?.upcoming ?? pending} tone="neutral" />
      <StatCard label={kpis.completedToday} value={summary?.completedToday ?? pending} tone="brand" />
    </StatGrid>
  );
}
