"use client";

import { Clock3, Pause, Play } from "lucide-react";
import { Badge, Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OperatorRefreshPauseReason } from "@/shared/hooks/useOperatorRefreshGuard";
import type { AutoRefreshInterval } from "./DashboardHeader";

interface DashboardRefreshPauseControlProps {
  interval: AutoRefreshInterval;
  isPaused: boolean;
  operatorPaused: boolean;
  pauseReasons: readonly OperatorRefreshPauseReason[];
  onOperatorPausedChange: (paused: boolean) => void;
}

export function DashboardRefreshPauseControl({
  interval,
  isPaused,
  operatorPaused,
  pauseReasons,
  onOperatorPausedChange,
}: DashboardRefreshPauseControlProps) {
  const { t } = useI18n();
  if (interval === "off") return null;

  const actionLabel = operatorPaused
    ? t.dashboard.resumeAutoRefresh
    : isPaused
      ? t.dashboard.keepAutoRefreshPaused
      : t.dashboard.pauseAutoRefresh;
  const ActionIcon = operatorPaused ? Play : Pause;

  return (
    <section
      aria-label={t.dashboard.autoRefreshStatusLabel}
      className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
        isPaused
          ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
          : "border-info/30 bg-info-subtle text-info-subtle-foreground"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              {isPaused
                ? t.dashboard.autoRefreshPausedTitle
                : t.dashboard.autoRefreshActiveTitle}
            </p>
            <Badge tone={isPaused ? "warn" : "info"}>
              {refreshIntervalLabel(interval, t.dashboard)}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5">
            {isPaused
              ? pausedDescription(pauseReasons, t.dashboard)
              : t.dashboard.autoRefreshActiveDescription}
          </p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={operatorPaused}
        onClick={() => onOperatorPausedChange(!operatorPaused)}
        className="shrink-0"
      >
        <ActionIcon className="size-3.5" aria-hidden="true" />
        {actionLabel}
      </Button>
    </section>
  );
}

function refreshIntervalLabel(
  interval: Exclude<AutoRefreshInterval, "off">,
  copy: ReturnType<typeof useI18n>["t"]["dashboard"],
): string {
  if (interval === "30s") return copy.autoRefresh30s;
  if (interval === "60s") return copy.autoRefresh60s;
  return copy.autoRefresh5m;
}

function pausedDescription(
  reasons: readonly OperatorRefreshPauseReason[],
  copy: ReturnType<typeof useI18n>["t"]["dashboard"],
): string {
  if (reasons.includes("operator")) return copy.autoRefreshPausedByOperator;
  if (reasons.includes("active-call")) return copy.autoRefreshPausedForCall;
  if (reasons.includes("modal-or-menu")) {
    return copy.autoRefreshPausedForOverlay;
  }
  if (reasons.includes("page-hidden")) {
    return copy.autoRefreshPausedForHiddenPage;
  }
  return copy.autoRefreshPausedForInteraction;
}
