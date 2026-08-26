"use client";

import { AlertCircle, DatabaseZap } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardUnavailableReason } from "@/types/dashboard";

interface DashboardUnavailableState {
  reasonCode?: DashboardUnavailableReason | "PROJECTION_NOT_ACTIVE";
  message?: string;
}

interface DashboardDataStateProps {
  title: string;
  dataset?: DashboardUnavailableState;
  className?: string;
}

export function UnavailableDashboardPanel({
  title,
  dataset,
  className = "",
}: DashboardDataStateProps) {
  const { lang } = useI18n();

  return (
    <section
      className={`min-h-52 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/60 ${className}`}
      aria-label={title}
    >
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
        <span className="rounded-xl bg-slate-200/70 p-2 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <DatabaseZap className="size-5" aria-hidden="true" />
        </span>
        <div className="max-w-sm space-y-1">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {lang === "ar"
              ? unavailableMessage(dataset?.reasonCode)
              : dataset?.message ?? "This data source is not available."}
          </p>
        </div>
        {dataset?.reasonCode && (
          <code className="rounded-md bg-slate-200/80 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {dataset.reasonCode}
          </code>
        )}
      </div>
    </section>
  );
}

export function EmptyDashboardPanel({
  title,
  className = "",
}: Omit<DashboardDataStateProps, "dataset">) {
  const { lang } = useI18n();

  return (
    <section
      className={`min-h-52 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      aria-label={title}
    >
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
        <AlertCircle
          className="size-5 text-slate-400"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === "ar"
              ? "لا توجد سجلات ضمن الفترة المحددة."
              : "No records were found for the selected period."}
          </p>
        </div>
      </div>
    </section>
  );
}

function unavailableMessage(
  reasonCode: DashboardUnavailableState["reasonCode"],
) {
  switch (reasonCode) {
    case "TARGET_NOT_CONFIGURED":
      return "لم يتم إعداد القيمة المستهدفة في لوحة التحكم بعد.";
    case "HISTORICAL_DATA_NOT_STORED":
      return "لا يحتفظ النظام حاليًا بالسجل التاريخي اللازم لهذا المؤشر.";
    case "PROJECTION_NOT_ACTIVE":
      return "عرض البيانات الموثوق لهذا التقرير غير مفعل حاليًا.";
    default:
      return "مصدر البيانات المطلوب غير متصل بواجهة لوحة التحكم حاليًا.";
  }
}
