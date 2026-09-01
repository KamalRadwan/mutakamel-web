"use client";

import { RotateCw, Printer, Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import type { DateRange } from "../utils/date-range-presets";
import { DashboardRangePicker } from "./DashboardRangePicker";
import type { DashboardPrintFallbackReason } from "../hooks/useDashboardPrint";

export type AutoRefreshInterval = "off" | "30s" | "60s" | "5m";

interface DashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  autoRefreshInterval?: AutoRefreshInterval;
  autoRefreshPaused?: boolean;
  onAutoRefreshChange?: (interval: AutoRefreshInterval) => void;
  onAutoRefreshMenuOpenChange?: (open: boolean) => void;
  onPrintReport?: () => void;
  isPreparingPrint?: boolean;
  printFallbackReason?: DashboardPrintFallbackReason | null;
}

export function DashboardHeader({
  isRefreshing,
  onRefresh,
  range,
  onRangeChange,
  autoRefreshInterval = "off",
  autoRefreshPaused = false,
  onAutoRefreshChange,
  onAutoRefreshMenuOpenChange,
  onPrintReport,
  isPreparingPrint = false,
  printFallbackReason = null,
}: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <PageHeader
      title={t.dashboard.title}
      description={t.dashboard.welcome}
      status={
        <Badge
          tone={
            autoRefreshInterval === "off"
              ? "neutral"
              : autoRefreshPaused
                ? "warn"
                : "info"
          }
        >
          {autoRefreshInterval === "off"
            ? t.dashboard.autoRefreshOff
            : autoRefreshPaused
              ? t.dashboard.autoRefreshPausedTitle
              : t.dashboard.autoRefreshActiveTitle}
        </Badge>
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <DashboardRangePicker value={range} onChange={onRangeChange} />

          {onAutoRefreshChange && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted p-1 text-xs">
              <Clock className="ms-1 size-3.5 text-muted-foreground" aria-hidden="true" />
              <Select
                value={autoRefreshInterval}
                onValueChange={(value) => onAutoRefreshChange(value as AutoRefreshInterval)}
                onOpenChange={onAutoRefreshMenuOpenChange}
              >
                <SelectTrigger aria-label={t.dashboard.refresh} className="h-7 border-0 bg-transparent px-1.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">{t.dashboard.autoRefreshOff}</SelectItem>
                  <SelectItem value="30s">{t.dashboard.autoRefresh30s}</SelectItem>
                  <SelectItem value="60s">{t.dashboard.autoRefresh60s}</SelectItem>
                  <SelectItem value="5m">{t.dashboard.autoRefresh5m}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrintReport || (() => window.print())}
            disabled={isPreparingPrint}
            aria-busy={isPreparingPrint || undefined}
            aria-label={
              isPreparingPrint
                ? t.dashboard.preparingPdfReport
                : t.dashboard.printPdfReport
            }
            title={
              isPreparingPrint
                ? t.dashboard.preparingPdfReport
                : t.dashboard.printPdfReport
            }
          >
            <Printer className="size-4" aria-hidden="true" />
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} title={t.dashboard.refresh}>
            <RotateCw className={`size-4 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
          </Button>

          {printFallbackReason && (
            <p
              role="status"
              aria-live="polite"
              className="w-full max-w-2xl text-end text-xs leading-5 text-warning-subtle-foreground print:hidden"
            >
              {printFallbackReason === "charts-unavailable"
                ? t.dashboard.printFallbackChartsUnavailable
                : t.dashboard.printFallbackReadinessTimeout}
            </p>
          )}
        </div>
      }
    />
  );
}
