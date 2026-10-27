"use client";

import Link from "next/link";
import { ArrowUpRight, CheckSquare, Eye, Square } from "lucide-react";
import { Button, IdentifierText, Money } from "@/design-system";
import { TradeStatusBadge } from "./TradeStatusBadge";
import type {
  TradeExecutiveRecordItem,
  TradeExecutiveTagChip,
} from "./TradeDocumentExecutiveBoard";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeDocumentExecutiveCardsProps {
  records: TradeExecutiveRecordItem[];
  selectedIds: Set<string>;
  onToggleSelect: (recordId: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onQuickInspect: (recordId: string) => void;
}

const TAG_TONE_CLASS: Record<NonNullable<TradeExecutiveTagChip["tone"]>, string> = {
  purple: "dossier-tag-purple",
  rose: "dossier-tag-rose",
  emerald: "dossier-tag-emerald",
  amber: "dossier-tag-amber",
  indigo: "dossier-tag-indigo",
};

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "TD";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function TradeDocumentExecutiveCards({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAllVisible,
  onClearSelection,
  onQuickInspect,
}: TradeDocumentExecutiveCardsProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const allVisibleSelected =
    records.length > 0 && records.every((r) => selectedIds.has(r.id));

  return (
    <div className="space-y-3" role="region" aria-label={td.executive.viewCards}>
      <div className="trade-bento-toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={allVisibleSelected ? onClearSelection : onSelectAllVisible}
          >
            {allVisibleSelected ? (
              <CheckSquare className="me-1.5 h-4 w-4 text-primary" aria-hidden />
            ) : (
              <Square className="me-1.5 h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            {td.executive.selectAllVisible}
          </Button>
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="dossier-tag dossier-tag-indigo">
                <IdentifierText>{String(selectedIds.size)}</IdentifierText>{" "}
                {td.executive.selectedCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="text-xs text-muted-foreground"
              >
                {td.executive.clearSelection}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          <IdentifierText>{String(records.length)}</IdentifierText>{" "}
          {td.executive.kpiAll}
        </div>
      </div>

      <div className="trade-bento-grid">
        {records.map((rec) => {
          const isSelected = selectedIds.has(rec.id);
          return (
            <div
              key={rec.id}
              className={`trade-bento-card ${
                isSelected ? "trade-bento-card-selected" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onToggleSelect(rec.id)}
                    aria-pressed={isSelected}
                    aria-label={rec.documentNumber}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" aria-hidden />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </Button>
                  <div className="trade-bento-avatar" aria-hidden>
                    {initialsFromName(rec.counterpartyName)}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={rec.detailHref}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      <IdentifierText>{rec.documentNumber}</IdentifierText>
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {rec.counterpartyName}
                    </p>
                  </div>
                </div>
                <TradeStatusBadge kind={rec.statusKind} value={rec.status} />
              </div>

              {rec.tags && rec.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {rec.tags.map((tag, idx) => (
                    <span
                      key={`${rec.id}-bento-tag-${idx}`}
                      className={`dossier-tag ${
                        tag.tone ? TAG_TONE_CLASS[tag.tone] : "dossier-tag-indigo"
                      }`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="trade-bento-meta-box">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{td.grandTotal}</span>
                  <Money
                    value={rec.grandTotal}
                    currency={rec.currencyCode}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                    className="text-sm font-semibold text-foreground"
                  />
                </div>
                {rec.secondaryAmountLabel && rec.secondaryAmount ? (
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {rec.secondaryAmountLabel}
                    </span>
                    <Money
                      value={rec.secondaryAmount}
                      currency={rec.currencyCode}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                      className="font-medium text-foreground"
                    />
                  </div>
                ) : null}
                {rec.dateWindowLabel && rec.dateWindowFormatted ? (
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{rec.dateWindowLabel}</span>
                    <IdentifierText className="text-muted-foreground">
                      {rec.dateWindowFormatted}
                    </IdentifierText>
                  </div>
                ) : null}
              </div>

              {rec.axes && rec.axes.length > 0 ? (
                <div className="trade-bento-axes-grid">
                  {rec.axes.map((ax, idx) => (
                    <div key={`${rec.id}-bento-ax-${idx}`} className="trade-bento-axis-cell">
                      <span className="block truncate text-xs text-muted-foreground">
                        {ax.label}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {ax.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="trade-bento-footer">
                <span className="text-xs text-muted-foreground">
                  {td.executive.versionBadge}{" "}
                  <IdentifierText>{`v${rec.version}`}</IdentifierText> ·{" "}
                  <IdentifierText>{rec.updatedAtFormatted}</IdentifierText>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onQuickInspect(rec.id)}
                  >
                    <Eye className="me-1 h-3.5 w-3.5" aria-hidden />
                    {td.executive.quickInspect}
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
        })}
      </div>
    </div>
  );
}
