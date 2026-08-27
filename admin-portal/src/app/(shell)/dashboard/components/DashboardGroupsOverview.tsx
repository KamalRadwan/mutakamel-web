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
import { Badge, Card } from "@/design-system";
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
}

export function DashboardGroupsOverview({
  data,
  onOpenGroup,
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
    <div className="space-y-5 animate-in fade-in duration-150">
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
          tone="brand"
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
          tone={alerts > 0 ? "warn" : "brand"}
        />
      </div>

      <DashboardOverviewCharts data={data} />

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
  const cardCount = group.cards.length;

  return (
    <Card className="p-0 transition-colors hover:border-brand-400 dark:hover:border-brand-500">
      <button
        type="button"
        onClick={onClick}
        className="group relative flex h-full w-full cursor-pointer flex-col justify-between p-4 text-start transition-all hover:shadow-md"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-400">
              {label}
            </h3>
            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-brand-600 rtl:rotate-180" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide">
          <Badge tone={available ? "brand" : "neutral"}>
            {available ? t.dashboard.availableBadge : t.dashboard.unavailableLabel}
          </Badge>
          {available && (
            <span className="font-mono text-muted-foreground">
              {cardCount} {t.dashboard.metricsSuffix}
            </span>
          )}
          {alertCount > 0 && (
            <span className="font-mono text-warn-700 dark:text-warn-400">
              {alertCount} {t.dashboard.alertsSuffix}
            </span>
          )}
        </div>
      </button>
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
  tone: "neutral" | "brand" | "warn";
}) {
  const tones = {
    neutral: {
      icon: "text-muted-foreground",
      bg: "bg-ink-100 dark:bg-ink-800 border-border",
      topBorder: "border-t-2 border-t-ink-400",
    },
    brand: {
      icon: "text-brand-600 dark:text-brand-400",
      bg: "bg-brand-50 dark:bg-brand-950/40 border-brand-200/60 dark:border-brand-900/50",
      topBorder: "border-t-2 border-t-brand-500",
    },
    warn: {
      icon: "text-warn-600 dark:text-warn-400",
      bg: "bg-warn-50 dark:bg-warn-950/40 border-warn-200/60 dark:border-warn-900/50",
      topBorder: "border-t-2 border-t-warn-500",
    },
  };

  const current = tones[tone];

  return (
    <Card className={`p-4 ${current.topBorder}`}>
      <div className={`inline-flex rounded-lg border p-2.5 ${current.bg} ${current.icon}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </Card>
  );
}
