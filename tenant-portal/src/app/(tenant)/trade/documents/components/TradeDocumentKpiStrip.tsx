"use client";

import * as React from "react";
import { Download, Kanban, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export type TradeExecutiveViewMode = "board" | "cards" | "table";

export type TradeKpiTone =
  | "blue"
  | "amber"
  | "emerald"
  | "violet"
  | "rose"
  | "cyan";

export interface TradeKpiPillItem {
  id: string;
  label: string;
  count: number;
  tone: TradeKpiTone;
  statusFilterValue: string;
  subtitle?: string;
}

export interface TradeDocumentKpiStripProps {
  pills: TradeKpiPillItem[];
  activeStatusFilter: string;
  onSelectStatusFilter: (statusFilterValue: string) => void;
  viewMode: TradeExecutiveViewMode;
  onChangeViewMode: (mode: TradeExecutiveViewMode) => void;
  onExportCsv?: () => void;
  totalValueSummary?: string;
}

const TONE_CLASS: Record<TradeKpiTone, string> = {
  blue: "trade-kpi-pill-blue",
  amber: "trade-kpi-pill-amber",
  emerald: "trade-kpi-pill-emerald",
  violet: "trade-kpi-pill-violet",
  rose: "trade-kpi-pill-rose",
  cyan: "trade-kpi-pill-cyan",
};

export function TradeDocumentKpiStrip({
  pills,
  activeStatusFilter,
  onSelectStatusFilter,
  viewMode,
  onChangeViewMode,
  onExportCsv,
  totalValueSummary,
}: TradeDocumentKpiStripProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="trade-kpi-strip" role="group" aria-label={td.executive.funnelTitle}>
        {pills.map((pill) => {
          const isActive = activeStatusFilter === pill.statusFilterValue;
          return (
            <Button
              key={pill.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onSelectStatusFilter(
                  isActive && pill.statusFilterValue !== "" ? "" : pill.statusFilterValue,
                )
              }
              aria-pressed={isActive}
              className={`trade-kpi-pill ${TONE_CLASS[pill.tone]} ${isActive ? "active" : ""}`}
            >
              <span>{pill.label}</span>
              <span className="trade-kpi-count">
                <IdentifierText>{String(pill.count)}</IdentifierText>
              </span>
              {pill.subtitle ? (
                <span className="text-xs opacity-80">
                  <IdentifierText>{pill.subtitle}</IdentifierText>
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {totalValueSummary ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">{td.executive.kpiValue}:</span>
            <IdentifierText className="font-semibold text-foreground">
              {totalValueSummary}
            </IdentifierText>
          </div>
        ) : null}

        <div
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1"
          role="group"
          aria-label={td.statusTitle}
        >
          <Button
            type="button"
            size="sm"
            variant={viewMode === "board" ? "primary" : "ghost"}
            onClick={() => onChangeViewMode("board")}
            aria-pressed={viewMode === "board"}
          >
            <Kanban className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {td.executive.viewBoard}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "cards" ? "primary" : "ghost"}
            onClick={() => onChangeViewMode("cards")}
            aria-pressed={viewMode === "cards"}
          >
            <LayoutGrid className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {td.executive.viewCards}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "table" ? "primary" : "ghost"}
            onClick={() => onChangeViewMode("table")}
            aria-pressed={viewMode === "table"}
          >
            <TableIcon className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {td.executive.viewTable}
          </Button>
        </div>

        {onExportCsv ? (
          <Button type="button" size="sm" variant="outline" onClick={onExportCsv}>
            <Download className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {td.executive.exportCsv}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
