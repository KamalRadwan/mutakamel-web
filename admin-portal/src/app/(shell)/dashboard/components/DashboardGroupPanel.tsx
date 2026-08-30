"use client";

import { useMemo } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type {
  DashboardGroup,
  DashboardGroupAlert,
  DashboardGroupKey,
} from "@/types/dashboard";
import { UnavailableDashboardPanel } from "./DashboardDataState";
import { DashboardVisualCard } from "./visuals/DashboardVisualCard";
import { GroupExactValues } from "./visuals/GroupExactValues";
import {
  GroupHeadlineStats,
  selectHeadlineCards,
} from "./visuals/GroupHeadlineStats";
import { inferGroupVisuals } from "./visuals/infer-visuals";
import { getDashboardGroupLabel } from "../utils/dashboard-groups";
import { resolveAlertMessage } from "../utils/dashboard-copy";

interface DashboardGroupPanelProps {
  groupKey: DashboardGroupKey;
  group: DashboardGroup;
  rangeLabel: string;
}

/**
 * Alerts, then at most three headline numbers, then charts, then one
 * collapsed exact-value table. The panel this replaced printed every field
 * of the response into its own bordered tile — around 150 of them across the
 * thirteen group tabs, and not one chart.
 */
export function DashboardGroupPanel({
  groupKey,
  group,
  rangeLabel,
}: DashboardGroupPanelProps) {
  const { t, lang } = useI18n();
  const title = getDashboardGroupLabel(groupKey, lang);
  const inferenceCopy = useMemo(
    () => ({
      snapshotLabel: t.dashboard.currentSnapshotTitle,
      periodLabel: t.dashboard.selectedPeriodTitle,
    }),
    [t],
  );

  // Core-authored visuals win; the client-side inference is the bridge that
  // keeps a tab charted until its provider emits them.
  const visuals = useMemo(() => {
    if (!group.available) return [];
    return group.visuals?.length
      ? group.visuals
      : inferGroupVisuals(group, inferenceCopy);
  }, [group, inferenceCopy]);

  if (!group.available) {
    return (
      <div className="space-y-4">
        <UnavailableDashboardPanel title={title} dataset={group} />
      </div>
    );
  }

  const headline = selectHeadlineCards(group.cards);

  return (
    <div className="animate-in space-y-5 fade-in duration-150 motion-reduce:animate-none">
      {group.alerts.length > 0 && <ReportAlerts alerts={group.alerts} />}

      <GroupHeadlineStats cards={headline} />

      {visuals.length > 0 ? (
        <section
          aria-label={t.dashboard.visuals.chartsAriaLabel}
          className="grid grid-cols-1 gap-4 xl:grid-cols-2"
        >
          {visuals.map((visual) => (
            <DashboardVisualCard key={visual.key} visual={visual} />
          ))}
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted p-4 text-xs text-muted-foreground">
          {t.dashboard.visuals.noVisuals}
        </p>
      )}

      <div>
        <p className="mb-2 px-1 text-xs text-muted-foreground">{rangeLabel}</p>
        <GroupExactValues group={group} />
      </div>
    </div>
  );
}

function ReportAlerts({ alerts }: { alerts: DashboardGroupAlert[] }) {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return (
    <section aria-label={t.dashboard.reportAlertsAriaLabel}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const style = alertStyle(alert.severity);
          const Icon = style.icon;
          return (
            <div
              key={alert.key}
              className={`flex items-start gap-3 rounded-lg border p-4 ${style.className}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {new Intl.NumberFormat(locale).format(alert.count)}{" "}
                  {t.dashboard.needAttentionSuffix}
                </p>
                <p className="mt-0.5 text-xs leading-5 opacity-85">
                  {resolveAlertMessage(alert, lang, t)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function alertStyle(severity: DashboardGroupAlert["severity"]): {
  icon: typeof Info;
  className: string;
} {
  if (severity === "critical") {
    return {
      icon: CircleAlert,
      className:
        "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground",
    };
  }
  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
    };
  }
  return {
    icon: Info,
    className: "border-info/30 bg-info-subtle text-info-subtle-foreground",
  };
}
