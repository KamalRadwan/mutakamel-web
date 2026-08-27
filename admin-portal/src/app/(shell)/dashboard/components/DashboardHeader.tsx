"use client";

import { RotateCw, Calendar, Printer, Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { DateRangePreset } from "../hooks/useDashboardData";

export type AutoRefreshInterval = "off" | "30s" | "60s" | "5m";

interface DashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  rangePreset: DateRangePreset;
  onRangeChange: (preset: DateRangePreset) => void;
  customRange?: { from?: string; to?: string };
  onCustomRangeChange?: (range: { from?: string; to?: string }) => void;
  autoRefreshInterval?: AutoRefreshInterval;
  onAutoRefreshChange?: (interval: AutoRefreshInterval) => void;
  onPrintReport?: () => void;
}

export function DashboardHeader({
  isRefreshing,
  onRefresh,
  rangePreset,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  autoRefreshInterval = "off",
  onAutoRefreshChange,
  onPrintReport,
}: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <PageHeader
      title={t.dashboard.title}
      description={t.dashboard.welcome}
      status={<Badge tone="neutral">{t.dashboard.liveBadge}</Badge>}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-ink-100 p-1 text-xs dark:bg-ink-900">
            <Calendar className="ms-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
            <Button type="button" variant={rangePreset === "thisMonth" ? "primary" : "ghost"} size="sm" onClick={() => onRangeChange("thisMonth")}>
              {t.dashboard.thisMonth}
            </Button>
            <Button type="button" variant={rangePreset === "lastMonth" ? "primary" : "ghost"} size="sm" onClick={() => onRangeChange("lastMonth")}>
              {t.dashboard.lastMonth}
            </Button>
            <Button type="button" variant={rangePreset === "custom" ? "primary" : "ghost"} size="sm" onClick={() => onRangeChange("custom")}>
              {t.dashboard.customRangeLabel}
            </Button>
          </div>

          {rangePreset === "custom" && onCustomRangeChange && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-ink-100 p-1 text-xs dark:bg-ink-900">
              <Input
                type="date"
                value={customRange?.from ?? ""}
                onChange={(event) =>
                  onCustomRangeChange({ ...customRange, from: event.target.value || undefined })
                }
                aria-label={t.dashboard.fromDateLabel}
                className="h-7 w-auto px-2 text-xs"
              />
              <span className="text-muted-foreground" aria-hidden="true">–</span>
              <Input
                type="date"
                value={customRange?.to ?? ""}
                min={customRange?.from}
                onChange={(event) =>
                  onCustomRangeChange({ ...customRange, to: event.target.value || undefined })
                }
                aria-label={t.dashboard.toDateLabel}
                className="h-7 w-auto px-2 text-xs"
              />
            </div>
          )}

          {onAutoRefreshChange && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-ink-100 p-1 text-xs dark:bg-ink-900">
              <Clock className="ms-1 size-3.5 text-muted-foreground" aria-hidden="true" />
              <Select value={autoRefreshInterval} onValueChange={(value) => onAutoRefreshChange(value as AutoRefreshInterval)}>
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

          <Button type="button" variant="outline" size="sm" onClick={onPrintReport || (() => window.print())} title={t.dashboard.printPdfReport}>
            <Printer className="size-4" aria-hidden="true" />
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} title={t.dashboard.refresh}>
            <RotateCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </Button>
        </div>
      }
    />
  );
}
