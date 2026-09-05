"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { Card } from "@/design-system";
import type { DashboardResponse } from "@/types/dashboard";
import { getAuthorizedDashboardGroups } from "../utils/dashboard-groups";
import { DashboardOverviewCharts } from "./DashboardOverviewCharts";

interface DashboardGroupsOverviewProps {
  data: DashboardResponse;
  forceRenderCharts?: boolean;
  printChartsReady?: boolean;
  onOperationalChartsReady?: () => void;
  onBillingChartsReady?: () => void;
}

export function DashboardGroupsOverview({
  data,
  forceRenderCharts = false,
  printChartsReady = false,
  onOperationalChartsReady,
  onBillingChartsReady,
}: DashboardGroupsOverviewProps) {
  const { t } = useI18n();
  const groups = getAuthorizedDashboardGroups(data);
  const available = groups.filter(([, group]) => group.available).length;
  const unavailable = groups.length - available;
  const alerts = groups.reduce(
    (count, [, group]) => count + group.alerts.length,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ScopeMetric
          label={t.dashboard.authorizedGroups}
          value={groups.length}
          icon={ShieldCheck}
          tone="neutral"
        />
        <ScopeMetric
          label={t.dashboard.availableSources}
          value={available}
          icon={CheckCircle2}
          tone="success"
        />
        <ScopeMetric
          label={t.dashboard.unavailableSources}
          value={unavailable}
          icon={Unplug}
          tone="neutral"
        />
        <ScopeMetric
          label={t.dashboard.openAlertSignals}
          value={alerts}
          icon={AlertTriangle}
          tone={alerts > 0 ? "warn" : "success"}
        />
      </div>

      <DashboardOverviewCharts
        data={data}
        forceRenderLazyCharts={forceRenderCharts}
        printChartsReady={printChartsReady}
        onOperationalChartsReady={onOperationalChartsReady}
        onBillingChartsReady={onBillingChartsReady}
      />
    </div>
  );
}

function ScopeMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
  tone: "neutral" | "success" | "warn";
}) {
  const tones = {
    neutral: {
      icon: "text-muted-foreground",
      bg: "border-border bg-muted",
      topBorder: "border-t-2 border-t-border",
    },
    success: {
      icon: "text-success",
      bg: "border-success/30 bg-success-subtle",
      topBorder: "border-t-2 border-t-success",
    },
    warn: {
      icon: "text-warning",
      bg: "border-warning/30 bg-warning-subtle",
      topBorder: "border-t-2 border-t-warning",
    },
  };

  const current = tones[tone];
  const { lang } = useI18n();

  return (
    <Card className={`p-4 ${current.topBorder}`}>
      <div className={`inline-flex rounded-lg border p-2.5 ${current.bg} ${current.icon}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
        {formatLocaleNumber(lang, value)}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">
        {label}
      </p>
    </Card>
  );
}
