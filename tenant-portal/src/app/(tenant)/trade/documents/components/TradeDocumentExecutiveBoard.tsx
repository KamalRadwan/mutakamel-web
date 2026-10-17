"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Eye } from "lucide-react";
import { Button, IdentifierText, Money } from "@/design-system";
import { TradeStatusBadge } from "./TradeStatusBadge";
import type { TradeStatusKind } from "../trade-document-status";
import { useI18n } from "@/i18n/I18nContext";

export type TradeBoardColumnTone =
  | "blue"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "cyan";

export interface TradeExecutiveAxisChip {
  label: string;
  value: string;
}

export interface TradeExecutiveTagChip {
  label: string;
  tone?: "purple" | "rose" | "emerald" | "amber" | "indigo";
}

export interface TradeExecutiveRecordItem {
  id: string;
  documentNumber: string;
  counterpartyName: string;
  counterpartyCode?: string | null;
  status: string;
  statusKind: TradeStatusKind;
  currencyCode: string;
  grandTotal: string;
  secondaryAmountLabel?: string;
  secondaryAmount?: string;
  version: number;
  updatedAtFormatted: string;
  dateWindowLabel?: string;
  dateWindowFormatted?: string;
  linesCount?: number;
  clausesCount?: number;
  axes?: TradeExecutiveAxisChip[];
  tags?: TradeExecutiveTagChip[];
  detailHref: string;
}

export interface TradeBoardColumnSpec {
  id: string;
  title: string;
  tone: TradeBoardColumnTone;
  statuses: string[];
  totalSummary?: string;
}

export interface TradeDocumentExecutiveBoardProps {
  columns: TradeBoardColumnSpec[];
  records: TradeExecutiveRecordItem[];
  selectedIds?: Set<string>;
  onQuickInspect: (recordId: string) => void;
}

const COLUMN_TONE_CLASS: Record<TradeBoardColumnTone, string> = {
  blue: "trade-board-col-blue",
  indigo: "trade-board-col-indigo",
  emerald: "trade-board-col-emerald",
  amber: "trade-board-col-amber",
  rose: "trade-board-col-rose",
  violet: "trade-board-col-violet",
  cyan: "trade-board-col-cyan",
};

const TAG_TONE_CLASS: Record<NonNullable<TradeExecutiveTagChip["tone"]>, string> = {
  purple: "dossier-tag-purple",
  rose: "dossier-tag-rose",
  emerald: "dossier-tag-emerald",
  amber: "dossier-tag-amber",
  indigo: "dossier-tag-indigo",
};

export function TradeDocumentExecutiveBoard({
  columns,
  records,
  selectedIds,
  onQuickInspect,
}: TradeDocumentExecutiveBoardProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const totalCount = Math.max(records.length, 1);

  return (
    <div className="trade-board-grid" role="region" aria-label={td.executive.viewBoard}>
      {columns.map((col) => {
        const colRecords = records.filter((r) => col.statuses.includes(r.status));
        const fillPercent = Math.min(100, Math.round((colRecords.length / totalCount) * 100));

        return (
          <div
            key={col.id}
            className={`trade-board-col ${COLUMN_TONE_CLASS[col.tone]}`}
          >
            <div className="trade-board-col-head">
              <div className="trade-board-col-title-row">
                <span className="trade-board-col-title">{col.title}</span>
                <span className="trade-kpi-count">
                  <IdentifierText>{String(colRecords.length)}</IdentifierText>
                </span>
              </div>
              {col.totalSummary ? (
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{td.executive.kpiValue}</span>
                  <IdentifierText className="font-semibold text-foreground">
                    {col.totalSummary}
                  </IdentifierText>
                </div>
              ) : null}
              <div className="trade-board-col-bar" aria-hidden>
                <div
                  className="trade-board-col-bar-fill"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>

            <div className="trade-board-col-body">
              {colRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {td.executive.boardEmptyStage}
                </div>
              ) : (
                colRecords.map((rec) => {
                  const isSelected = selectedIds?.has(rec.id) ?? false;
                  return (
                    <div
                      key={rec.id}
                      className={`trade-board-card ${
                        isSelected ? "trade-board-card-selected" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={rec.detailHref}
                            className="text-sm font-semibold text-foreground hover:underline"
                          >
                            <IdentifierText>{rec.documentNumber}</IdentifierText>
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {rec.counterpartyName}
                          </p>
                        </div>
                        <TradeStatusBadge kind={rec.statusKind} value={rec.status} />
                      </div>

                      {rec.tags && rec.tags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rec.tags.map((tag, idx) => (
                            <span
                              key={`${rec.id}-tag-${idx}`}
                              className={`dossier-tag ${
                                tag.tone ? TAG_TONE_CLASS[tag.tone] : "dossier-tag-indigo"
                              }`}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {rec.axes && rec.axes.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
                          {rec.axes.map((ax, idx) => (
                            <div key={`${rec.id}-ax-${idx}`} className="min-w-0">
                              <span className="block truncate text-muted-foreground">
                                {ax.label}
                              </span>
                              <span className="font-medium text-foreground">
                                {ax.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                        <div>
                          <span className="block text-muted-foreground">
                            {td.grandTotal}
                          </span>
                          <Money
                            value={rec.grandTotal}
                            currency={rec.currencyCode}
                            minimumFractionDigits={2}
                            maximumFractionDigits={8}
                            className="text-sm font-semibold text-foreground"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onQuickInspect(rec.id)}
                            title={td.executive.quickInspect}
                          >
                            <Eye className="me-1 h-3.5 w-3.5" aria-hidden />
                            <span className="text-xs">360°</span>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={rec.detailHref} title={td.executive.openDossier}>
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
