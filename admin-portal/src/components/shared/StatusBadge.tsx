"use client";

import { useI18n } from "@/i18n/I18nContext";

export interface StatusBadgeProps {
  status: string;
  enumType?: "tenant" | "user" | "subscription" | "invoice" | "operation" | "db-server";
  customLabelEn?: string;
  customLabelAr?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  showDot = true,
  size = "sm",
}: StatusBadgeProps) {
  const { lang } = useI18n();

  const getTone = (st: string) => {
    switch (st?.toUpperCase()) {
      case "ACTIVE":
      case "PAID":
      case "SUCCEEDED":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/60",
          text: "text-emerald-700 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-800/80",
          dot: "bg-emerald-500",
          labelAr: "نشط",
          labelEn: "Active",
        };
      case "PROVISIONING":
      case "RUNNING":
      case "PARTIALLY_PAID":
      case "TRIAL":
        return {
          bg: "bg-blue-50 dark:bg-blue-950/60",
          text: "text-blue-700 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-800/80",
          dot: "bg-blue-500 animate-pulse",
          labelAr: "جاري التجهيز",
          labelEn: "Provisioning",
        };
      case "SUSPENDED":
      case "ISSUED":
      case "DRAINING":
      case "PENDING":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/60",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-200 dark:border-amber-800/80",
          dot: "bg-amber-500",
          labelAr: "معلق",
          labelEn: "Suspended",
        };
      case "FAILED":
      case "PROVISIONING_FAILED":
      case "OVERDUE":
      case "OFFLINE":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/60",
          text: "text-rose-700 dark:text-rose-400",
          border: "border-rose-200 dark:border-rose-800/80",
          dot: "bg-rose-500",
          labelAr: "فشل / متأخر",
          labelEn: "Failed / Overdue",
        };
      case "DELETED":
      case "CANCELLED":
      case "VOID":
      case "OFF":
        return {
          bg: "bg-slate-100 dark:bg-slate-800/60",
          text: "text-slate-600 dark:text-slate-400",
          border: "border-slate-200 dark:border-slate-700",
          dot: "bg-slate-400",
          labelAr: "ملغى / محذوف",
          labelEn: "Deleted / Void",
        };
      default:
        return {
          bg: "bg-slate-100 dark:bg-slate-800/60",
          text: "text-slate-600 dark:text-slate-400",
          border: "border-slate-200 dark:border-slate-700",
          dot: "bg-slate-400",
          labelAr: status,
          labelEn: status,
        };
    }
  };

  const tone = getTone(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold rounded-full ${tone.bg} ${tone.text} ${tone.border} ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />}
      <span>{lang === "ar" ? tone.labelAr : tone.labelEn}</span>
    </span>
  );
}
