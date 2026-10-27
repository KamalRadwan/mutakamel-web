"use client";

import {
  Ban,
  CheckCircle2,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../hooks/useCustomerProfileBoard";
import type { CustomerProfileStatus } from "../hooks/useCustomerProfiles";

export interface CustomerProfileStatusFunnelBarProps {
  statusTotals: ReadonlyMap<CustomerProfileStatus, number>;
  activeStatus: CustomerProfileStatus | null;
  onSelect: (status: CustomerProfileStatus | null) => void;
  disabled?: boolean;
}

export function getCustomerStatusVisual(status: CustomerProfileStatus) {
  switch (status) {
    case "ACTIVE_CUSTOMER":
      return {
        accentHex: "#10b981",
        dotClass: "bg-swatch-green",
        barClass: "bg-swatch-green",
        activeBg: "bg-swatch-green-soft border-swatch-green",
        badgeClass:
          "bg-swatch-green-soft text-swatch-green-deep border-swatch-green",
        icon: CheckCircle2,
      };
    case "INACTIVE":
      return {
        accentHex: "#f59e0b",
        dotClass: "bg-swatch-amber",
        barClass: "bg-swatch-amber",
        activeBg: "bg-swatch-amber-soft border-swatch-amber",
        badgeClass:
          "bg-swatch-amber-soft text-swatch-amber-deep border-swatch-amber",
        icon: PauseCircle,
      };
    case "BLACKLISTED":
      return {
        accentHex: "#ef4444",
        dotClass: "bg-swatch-red",
        barClass: "bg-swatch-red",
        activeBg: "bg-swatch-red-soft border-swatch-red",
        badgeClass:
          "bg-swatch-red-soft text-swatch-red-deep border-swatch-red",
        icon: Ban,
      };
    case "PROSPECT":
    default:
      return {
        accentHex: "#3b82f6",
        dotClass: "bg-swatch-blue",
        barClass: "bg-swatch-blue",
        activeBg: "bg-swatch-blue-soft border-swatch-blue",
        badgeClass:
          "bg-swatch-blue-soft text-swatch-blue-deep border-swatch-blue",
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
  activeStatus,
  onSelect,
  disabled,
}: CustomerProfileStatusFunnelBarProps) {
  const { t } = useI18n();
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  const hasTotals = CUSTOMER_PROFILE_BOARD_STATUSES.every((status) =>
    statusTotals.has(status),
  );
  const totalCount = hasTotals
    ? CUSTOMER_PROFILE_BOARD_STATUSES.reduce(
        (sum, status) => sum + (statusTotals.get(status) ?? 0),
        0,
      )
    : undefined;
  const isAllActive = activeStatus === null;

  return (
    <div
      role="navigation"
      aria-label={t.crmCustomerProfiles.ui.statusFunnel.ariaLabel}
      className="flex w-full items-stretch divide-x divide-border overflow-x-auto rounded-lg border border-border bg-card shadow-2xs"
    >
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelect(null)}
        className={cn(
          "flex h-auto min-w-32 flex-1 items-center justify-center gap-2 rounded-none px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            : "bg-card text-foreground hover:bg-muted",
        )}
      >
        <span className="truncate">{t.crmCustomerProfiles.ui.statusFunnel.allCustomers}</span>
        {totalCount !== undefined && (
          <>
            {" "}
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                isAllActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {totalCount}
            </span>
          </>
        )}
      </Button>

      {CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => {
        const isActive = activeStatus === status;
        const count = statusTotals.get(status);
        const label = statusLabels[`CustomerStatus.${status}`] ?? status;
        const topAccent =
          status === "ACTIVE_CUSTOMER"
            ? "border-t-2 border-t-swatch-green"
            : status === "BLACKLISTED"
              ? "border-t-2 border-t-swatch-red"
              : status === "INACTIVE"
                ? "border-t-2 border-t-swatch-amber"
                : "border-t-2 border-t-swatch-blue";

        return (
          <Button
            key={status}
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? null : status)}
            className={cn(
              "flex h-auto min-w-28 flex-1 items-center justify-center gap-1.5 rounded-none px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : status === "ACTIVE_CUSTOMER"
                  ? "bg-swatch-green-soft/40 text-swatch-green-deep hover:bg-swatch-green-soft/80"
                  : status === "BLACKLISTED"
                    ? "bg-card text-foreground hover:bg-swatch-red-soft/40"
                    : "bg-card text-foreground hover:bg-muted",
            )}
          >
            <span className="truncate">{label}</span>
            {count !== undefined && (
              <>
                {" "}
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : status === "ACTIVE_CUSTOMER"
                        ? "bg-swatch-green-soft text-swatch-green-deep"
                        : status === "BLACKLISTED"
                          ? "bg-swatch-red-soft text-swatch-red-deep"
                          : "bg-muted text-foreground",
                  )}
                >
                  {count}
                </span>
              </>
            )}
          </Button>
        );
      })}
    </div>
  );
}
