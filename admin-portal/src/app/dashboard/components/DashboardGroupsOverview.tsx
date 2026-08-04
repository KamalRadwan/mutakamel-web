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
import type { DashboardGroupKey, DashboardResponse } from "@/types/dashboard";
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
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-2xs dark:border-slate-800">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-y-0 end-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.28),transparent_70%)]" />
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">
              {lang === "ar" ? "نطاق التقارير المصرح" : "Authorized report scope"}
            </p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
              {lang === "ar" ? "مركز عمليات مستوى التحكم" : "Control-plane operations desk"}
            </h2>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              {lang === "ar"
                ? "تعرض هذه الصفحة فقط مجموعات البيانات المسموح بها لحسابك. المجموعة غير المتاحة تعني أن المصدر الموثوق غير نشط، وليس أن قيمتها صفر."
                : "This page exposes only the report groups authorized for your account. An unavailable group means its authoritative source is not active, not that its values are zero."}
            </p>
          </div>
        </div>
      </section>

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
            <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">
              {lang === "ar" ? "مجموعات التقارير" : "Report groups"}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {data.range.label}
            </p>
          </div>
          <Layers3 className="size-5 text-slate-400" aria-hidden="true" />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {lang === "ar" ? "لا توجد مجموعات تقارير مصرح بها." : "No report groups are authorized."}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {lang === "ar" ? "صلاحية فتح لوحة التحكم وحدها لا تمنح بيانات أي مجموعة." : "Dashboard access alone does not grant any group data."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(([key, group]) => (
              <GroupSummary
                key={key}
                groupKey={key}
                available={group.available}
                cardCount={group.cards.length}
                alertCount={group.alerts.length}
                onOpen={() => onOpenGroup(key)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GroupSummary({
  groupKey,
  available,
  cardCount,
  alertCount,
  onOpen,
}: {
  groupKey: DashboardGroupKey;
  available: boolean;
  cardCount: number;
  alertCount: number;
  onOpen: () => void;
}) {
  const { lang } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-2xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${available ? "bg-emerald-500" : "bg-slate-400"}`} />
            <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
              {getDashboardGroupLabel(groupKey, lang)}
            </h3>
          </div>
          <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {getDashboardGroupDescription(groupKey, lang)}
          </p>
        </div>
        <ChevronRight className={`size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 ${lang === "ar" ? "rotate-180" : ""}`} aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
        <span className={`rounded-md px-2 py-1 ${available ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
          {available ? (lang === "ar" ? "متاح" : "Available") : lang === "ar" ? "غير متاح" : "Unavailable"}
        </span>
        {available && <span className="text-slate-400">{cardCount} {lang === "ar" ? "مؤشرات" : "metrics"}</span>}
        {alertCount > 0 && <span className="text-amber-600 dark:text-amber-400">{alertCount} {lang === "ar" ? "تنبيهات" : "alerts"}</span>}
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
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <div className={`inline-flex rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums text-slate-950 dark:text-white">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </section>
  );
}
