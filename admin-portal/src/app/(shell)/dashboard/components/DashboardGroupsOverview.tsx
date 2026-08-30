"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Layers3,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatLocaleNumber, pluralize } from "@/i18n/locale";
import { Badge, Button, Card } from "@/design-system";
import type { DashboardGroup, DashboardGroupKey, DashboardResponse } from "@/types/dashboard";
import type { DashboardTabKey } from "../hooks/useDashboardData";
import {
  getAuthorizedDashboardGroups,
  getDashboardGroupDescription,
  getDashboardGroupLabel,
} from "../utils/dashboard-groups";
import { DashboardOverviewCharts } from "./DashboardOverviewCharts";

interface DashboardGroupsOverviewProps {
  data: DashboardResponse;
  onOpenGroup: (group: DashboardTabKey) => void;
  forceRenderCharts?: boolean;
  printChartsReady?: boolean;
  onOperationalChartsReady?: () => void;
  onBillingChartsReady?: () => void;
}

export function DashboardGroupsOverview({
  data,
  onOpenGroup,
  forceRenderCharts = false,
  printChartsReady = false,
  onOperationalChartsReady,
  onBillingChartsReady,
}: DashboardGroupsOverviewProps) {
  const { t, lang } = useI18n();
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

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t.dashboard.reportGroupsTitle}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.range.label}
            </p>
          </div>
          <Layers3 className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>

        {groups.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              {t.dashboard.noAuthorizedGroups}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(([key, group]) => (
              <GroupCard
                key={key}
                groupKey={key}
                group={group}
                lang={lang}
                onClick={() => onOpenGroup(key)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GroupCard({
  groupKey,
  group,
  lang,
  onClick,
}: {
  groupKey: DashboardGroupKey;
  group: DashboardGroup;
  lang: "ar" | "en";
  onClick: () => void;
}) {
  const { t } = useI18n();
  const label = getDashboardGroupLabel(groupKey, lang);
  const description = getDashboardGroupDescription(groupKey, lang);
  const available = group.available;
  const alertCount = group.alerts.length;

  return (
    <Card className="p-0 transition-colors hover:border-primary/40 motion-reduce:transition-none">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onClick}
        className="group relative h-full w-full flex-col items-stretch justify-between whitespace-normal rounded-[inherit] p-4 text-start"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary motion-reduce:transition-none">
              {label}
            </h3>
            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary motion-reduce:transition-none rtl:rotate-180" aria-hidden="true" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {/* This card exists to answer two questions: can I open this group,
            and does it need me. A metric count answered neither, and once
            every group settled on three headline metrics it printed
            "3 METRICS" on all thirteen of them. */}
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide rtl:normal-case rtl:tracking-normal">
          <Badge tone={available ? "success" : "neutral"}>
            {available ? t.dashboard.availableBadge : t.dashboard.unavailableLabel}
          </Badge>
          {alertCount > 0 && (
            <span className="font-mono text-warning">
              {formatLocaleNumber(lang, alertCount)}{" "}
              {pluralize(lang, alertCount, t.dashboard.alertsCount)}
            </span>
          )}
        </div>
      </Button>
    </Card>
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
