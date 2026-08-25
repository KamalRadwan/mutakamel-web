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
import type { DashboardGroup, DashboardGroupKey, DashboardResponse } from "@/types/dashboard";
import type { DashboardTabKey } from "../hooks/useDashboardData";
import {
  getAuthorizedDashboardGroups,
  getDashboardGroupDescription,
  getDashboardGroupLabel,
} from "../utils/dashboard-groups";

interface DashboardGroupsOverviewProps {
  data: DashboardResponse;
  onOpenGroup: (group: DashboardTabKey) => void;
}

export function DashboardGroupsOverview({
  data,
  onOpenGroup,
}: DashboardGroupsOverviewProps) {
  const { lang } = useI18n();
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
          label={lang === "ar" ? "المجموعات المصرح بها" : "Authorized groups"}
          value={groups.length}
          icon={ShieldCheck}
          tone="blue"
        />
        <ScopeMetric
          label={lang === "ar" ? "مصادر متاحة" : "Available sources"}
          value={available}
          icon={CheckCircle2}
          tone="green"
        />
        <ScopeMetric
          label={lang === "ar" ? "مصادر غير متاحة" : "Unavailable sources"}
          value={unavailable}
          icon={Unplug}
          tone="slate"
        />
        <ScopeMetric
          label={lang === "ar" ? "تنبيهات مفتوحة" : "Open alert signals"}
          value={alerts}
          icon={AlertTriangle}
          tone={alerts > 0 ? "amber" : "green"}
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {lang === "ar" ? "مجموعات التقارير" : "Report groups"}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {data.range.label}
            </p>
          </div>
          <Layers3 className="size-5 text-indigo-500" aria-hidden="true" />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              {lang === "ar"
                ? "لا توجد مجموعات تقارير مصرح بها لحسابك."
                : "No authorized report groups available."}
            </p>
          </div>
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
  const label = getDashboardGroupLabel(groupKey, lang);
  const description = getDashboardGroupDescription(groupKey, lang);
  const available = group.available;
  const alertCount = group.alerts.length;
  const cardCount = group.cards.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-xs transition-all hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500 cursor-pointer"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {label}
          </h3>
          <ChevronRight className="size-4 text-slate-400 group-hover:text-indigo-500 transition-colors rtl:rotate-180" />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
          {description}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
        <span
          className={`rounded-md px-2 py-0.5 border ${
            available
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
              : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          }`}
        >
          {available ? (lang === "ar" ? "متاح" : "Available") : lang === "ar" ? "غير متاح" : "Unavailable"}
        </span>
        {available && (
          <span className="text-slate-500 font-mono">
            {cardCount} {lang === "ar" ? "مؤشرات" : "metrics"}
          </span>
        )}
        {alertCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-mono">
            {alertCount} {lang === "ar" ? "تنبيهات" : "alerts"}
          </span>
        )}
      </div>
    </button>
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
  tone: "blue" | "green" | "amber" | "slate";
}) {
  const tones = {
    blue: {
      icon: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/50",
      topBorder: "border-t-2 border-t-blue-500",
    },
    green: {
      icon: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/50",
      topBorder: "border-t-2 border-t-emerald-500",
    },
    amber: {
      icon: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/50",
      topBorder: "border-t-2 border-t-amber-500",
    },
    slate: {
      icon: "text-slate-500 dark:text-slate-400",
      bg: "bg-slate-100 dark:bg-slate-800 border-slate-200/60 dark:border-slate-700/50",
      topBorder: "border-t-2 border-t-slate-400",
    },
  };

  const current = tones[tone];

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 ${current.topBorder}`}
    >
      <div className={`inline-flex rounded-xl p-2.5 border ${current.bg} ${current.icon}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xl sm:text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </section>
  );
}
