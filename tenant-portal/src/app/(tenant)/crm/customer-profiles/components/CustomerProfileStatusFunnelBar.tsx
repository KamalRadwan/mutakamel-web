"use client";

import {
  Ban,
  CheckCircle2,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";

export interface CustomerProfileStatusFunnelBarProps {
  statusTotals: ReadonlyMap<CustomerProfileStatus, number>;
  items?: readonly CustomerProfileItem[];
  activeStatus: CustomerProfileStatus | null;
  onSelect: (status: CustomerProfileStatus | null) => void;
  disabled?: boolean;
}

export function getCustomerStatusVisual(status: CustomerProfileStatus) {
  switch (status) {
    case "ACTIVE_CUSTOMER":
      return {
        accentHex: "#10b981",
        dotClass: "bg-emerald-500",
        barClass: "bg-gradient-to-r from-emerald-600 to-teal-400",
        activeBg: "bg-emerald-500/[0.08] border-emerald-500/50",
        badgeClass:
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        icon: CheckCircle2,
      };
    case "INACTIVE":
      return {
        accentHex: "#f59e0b",
        dotClass: "bg-amber-500",
        barClass: "bg-gradient-to-r from-amber-500 to-yellow-400",
        activeBg: "bg-amber-500/[0.08] border-amber-500/50",
        badgeClass:
          "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
        icon: PauseCircle,
      };
    case "BLACKLISTED":
      return {
        accentHex: "#ef4444",
        dotClass: "bg-red-500",
        barClass: "bg-gradient-to-r from-red-600 to-rose-400",
        activeBg: "bg-red-500/[0.08] border-red-500/50",
        badgeClass:
          "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
        icon: Ban,
      };
    case "PROSPECT":
    default:
      return {
        accentHex: "#3b82f6",
        dotClass: "bg-blue-500",
        barClass: "bg-gradient-to-r from-blue-600 to-sky-400",
        activeBg: "bg-blue-500/[0.08] border-blue-500/50",
        badgeClass:
          "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        icon: Sparkles,
      };
  }
}

/**
 * Full-width segmented Status Funnel Ribbon for Card View & Table View
 * matching Leads `LeadStageFunnelBar` (`All Customers | Prospect | Active Customer | Inactive | Blacklisted`).
 */
export function CustomerProfileStatusFunnelBar({
  statusTotals,
  items = [],
  activeStatus,
  onSelect,
  disabled,
}: CustomerProfileStatusFunnelBarProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const countByStatus = new Map<CustomerProfileStatus, number>();
  for (const status of CUSTOMER_PROFILE_BOARD_STATUSES) {
    const fromTotals = statusTotals.get(status);
    if (fromTotals !== undefined) {
      countByStatus.set(status, fromTotals);
    } else {
      countByStatus.set(
        status,
        items.filter((item) => item.status === status).length,
      );
    }
  }

  const totalFromMap = CUSTOMER_PROFILE_BOARD_STATUSES.reduce(
    (sum, status) => sum + (countByStatus.get(status) ?? 0),
    0,
  );
  const totalCount = Math.max(totalFromMap, items.length);
  const isAllActive = activeStatus === null;

  return (
    <div
      role="navigation"
      aria-label={isAr ? "تصفية حسب حالة العميل" : "Customer status funnel filter"}
      className="flex w-full items-stretch divide-x divide-slate-200 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelect(null)}
        className={cn(
          "flex min-w-32 flex-1 items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-blue-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
        )}
      >
        <span className="truncate">{isAr ? "كل العملاء" : "All Customers"}</span>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
            isAllActive
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {totalCount}
        </span>
      </button>

      {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
        const isActive = activeStatus === status;
        const count = countByStatus.get(status) ?? 0;
        const label = statusLabels[`CustomerStatus.${status}`] ?? status;
        const topAccent =
          status === "ACTIVE_CUSTOMER"
            ? "border-t-2 border-t-emerald-500"
            : status === "BLACKLISTED"
              ? "border-t-2 border-t-red-500"
              : status === "INACTIVE"
                ? "border-t-2 border-t-amber-500"
                : "border-t-2 border-t-blue-500";

        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : status)}
            className={cn(
              "flex min-w-28 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-blue-600 text-white"
                : status === "ACTIVE_CUSTOMER"
                  ? "bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : status === "BLACKLISTED"
                    ? "bg-white text-slate-700 hover:bg-red-50/40 dark:bg-slate-900 dark:text-slate-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
            )}
          >
            <span className="truncate">{label}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : status === "ACTIVE_CUSTOMER"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                    : status === "BLACKLISTED"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
