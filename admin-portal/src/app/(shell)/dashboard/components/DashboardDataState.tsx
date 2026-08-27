"use client";

import { DatabaseZap } from "lucide-react";
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
  const { t, lang } = useI18n();

  return (
    <section
      className={`min-h-52 rounded-lg border border-dashed border-border bg-ink-100/70 p-5 dark:bg-ink-900/40 ${className}`}
      aria-label={title}
    >
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
        <span className="rounded-lg bg-ink-200/70 p-2 text-muted-foreground dark:bg-ink-800">
          <DatabaseZap className="size-5" aria-hidden="true" />
        </span>
        <div className="max-w-sm space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            {lang === "ar"
              ? unavailableMessage(dataset?.reasonCode, t)
              : dataset?.message ?? t.dashboard.unavailableGeneric}
          </p>
        </div>
        {dataset?.reasonCode && (
          <code className="rounded-md bg-ink-200/80 px-2 py-1 text-xs text-muted-foreground dark:bg-ink-800">
            {dataset.reasonCode}
          </code>
        )}
      </div>
    </section>
  );
}

function unavailableMessage(
  reasonCode: DashboardUnavailableState["reasonCode"],
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (reasonCode) {
    case "TARGET_NOT_CONFIGURED":
      return t.dashboard.unavailableReasons.targetNotConfigured;
    case "HISTORICAL_DATA_NOT_STORED":
      return t.dashboard.unavailableReasons.historicalDataNotStored;
    case "PROJECTION_NOT_ACTIVE":
      return t.dashboard.unavailableReasons.projectionNotActive;
    default:
      return t.dashboard.unavailableReasons.default;
  }
}
