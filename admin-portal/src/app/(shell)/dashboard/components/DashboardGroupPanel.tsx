"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CircleAlert,
  Info,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type {
  DashboardGroup,
  DashboardGroupAlert,
  DashboardGroupKey,
} from "@/types/dashboard";
import { KpiCard } from "./KpiCard";
import { UnavailableDashboardPanel } from "./DashboardDataState";
import {
  getDashboardGroupLabel,
  humanizeDashboardField,
  isUnavailableProjection,
} from "../utils/dashboard-groups";

interface DashboardGroupPanelProps {
  groupKey: DashboardGroupKey;
  group: DashboardGroup;
  rangeLabel: string;
}

export function DashboardGroupPanel({
  groupKey,
  group,
  rangeLabel,
}: DashboardGroupPanelProps) {
  const { lang } = useI18n();
  const title = getDashboardGroupLabel(groupKey, lang);

  if (!group.available) {
    return (
      <div className="space-y-4">
        <UnavailableDashboardPanel title={title} dataset={group} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">

      {group.alerts.length > 0 && <ReportAlerts alerts={group.alerts} />}

      {group.cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {group.cards.map((card) => (
            <KpiCard key={card.key} card={card} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportObject
          title={lang === "ar" ? "اللقطة الحالية" : "Current snapshot"}
          subtitle={lang === "ar" ? "الحالة الحالية" : "Current state"}
          value={group.snapshot}
        />
        <ReportObject
          title={lang === "ar" ? "الفترة المحددة" : "Selected period"}
          subtitle={rangeLabel}
          value={group.period}
        />
      </div>

      <ReportObject
        title={lang === "ar" ? "التوزيعات" : "Breakdowns"}
        subtitle={
          lang === "ar"
            ? "تفاصيل مجمعة من المصدر الموثوق"
            : "Grouped detail from the authoritative source"
        }
        value={group.breakdowns}
        wide
      />
    </div>
  );
}

function ReportAlerts({ alerts }: { alerts: DashboardGroupAlert[] }) {
  const { lang } = useI18n();
  return (
    <section aria-label={lang === "ar" ? "تنبيهات التقرير" : "Report alerts"}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const style = alertStyle(alert.severity);
          const Icon = style.icon;
          return (
            <div
              key={alert.key}
              className={`flex items-start gap-3 rounded-xl border p-4 ${style.className}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-bold">
                  {alert.count.toLocaleString()} {lang === "ar" ? "تحتاج متابعة" : "need attention"}
                </p>
                <p className="mt-0.5 text-xs leading-5 opacity-85">{alert.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReportObject({
  title,
  subtitle,
  value,
  wide = false,
}: {
  title: string;
  subtitle: string;
  value: Record<string, unknown>;
  wide?: boolean;
}) {
  const entries = Object.entries(value);
  const { lang } = useI18n();
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 ${wide ? "xl:col-span-2" : ""}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          {lang === "ar" ? "لا توجد قيم إضافية لهذه الفترة." : "No additional values for this period."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map(([key, entryValue]) => (
            <ReportValue key={key} fieldKey={key} value={entryValue} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const { lang } = useI18n();
  const label = humanizeDashboardField(fieldKey);

  if (isUnavailableProjection(value)) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {lang === "ar" ? "غير متاح" : "Unavailable"}
        </p>
        {value.message && <p className="mt-1 text-[11px] leading-5 text-slate-500">{value.message}</p>}
        {value.reasonCode && <code className="mt-2 inline-block text-[10px] text-slate-400">{value.reasonCode}</code>}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40 sm:col-span-2">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {value.length === 0 ? (
          <p className="text-xs text-slate-400">—</p>
        ) : (
          <div className="space-y-2">
            {value.map((item, index) => (
              <div key={`${fieldKey}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                {renderScalarOrObject(item, lang)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isRecord(value)) {
    return (
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40 sm:col-span-2">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <div key={nestedKey} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{humanizeDashboardField(nestedKey)}</span>
              <span className="max-w-[60%] text-end text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {renderScalarOrObject(nestedValue, lang)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-950 dark:text-white">
        {formatValue(fieldKey, value, lang)}
      </p>
    </div>
  );
}

function renderScalarOrObject(value: unknown, lang: "ar" | "en"): ReactNode {
  if (isRecord(value)) {
    return (
      <span className="space-y-1">
        {Object.entries(value).map(([key, item]) => (
          <span key={key} className="flex justify-between gap-3">
            <span className="text-slate-500">{humanizeDashboardField(key)}</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatValue(key, item, lang)}
            </span>
          </span>
        ))}
      </span>
    );
  }
  return formatValue("value", value, lang);
}

function formatValue(fieldKey: string, value: unknown, lang: "ar" | "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") {
    return value ? (lang === "ar" ? "نعم" : "Yes") : lang === "ar" ? "لا" : "No";
  }
  if (typeof value === "number") {
    const normalizedKey = fieldKey.toLowerCase();
    if (
      value >= 0 &&
      value <= 1 &&
      /(ratio|rate|utilization|concentration)/.test(normalizedKey)
    ) {
      return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
    }
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(value);
  }
  if (typeof value === "string" && /usd$/i.test(fieldKey)) return `$${value}`;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function alertStyle(severity: DashboardGroupAlert["severity"]): {
  icon: typeof Info;
  className: string;
} {
  if (severity === "critical") {
    return { icon: CircleAlert, className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300" };
  }
  if (severity === "warning") {
    return { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300" };
  }
  return { icon: Info, className: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300" };
}
