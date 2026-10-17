"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Layers,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  IdentifierText,
  Money,
} from "@/design-system";
import { TradeStatusBadge } from "./TradeStatusBadge";
import type { TradeExecutiveRecordItem } from "./TradeDocumentExecutiveBoard";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeQuickInspectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: TradeExecutiveRecordItem[];
  activeRecordId: string | null;
  onSelectRecordId: (recordId: string) => void;
  stageSteps?: Array<{ status: string; label: string }>;
}

export function TradeQuickInspectModal({
  open,
  onOpenChange,
  records,
  activeRecordId,
  onSelectRecordId,
  stageSteps,
}: TradeQuickInspectModalProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;

  const currentIndex = React.useMemo(() => {
    if (!activeRecordId) return -1;
    return records.findIndex((r) => r.id === activeRecordId);
  }, [records, activeRecordId]);

  const record = currentIndex >= 0 ? records[currentIndex] : null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < records.length - 1;

  if (!record) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <div className="dossier-header">
          <div className="dossier-header-left">
            <div className="dossier-avatar" aria-hidden>
              {record.counterpartyName.slice(0, 2).toUpperCase()}
            </div>
            <div className="dossier-meta">
              <div className="dossier-meta-row1">
                <DialogTitle className="dossier-name">
                  <IdentifierText>{record.documentNumber}</IdentifierText>
                </DialogTitle>
                <TradeStatusBadge kind={record.statusKind} value={record.status} />
                <span className="dossier-tag dossier-tag-indigo">
                  {td.executive.versionBadge}{" "}
                  <IdentifierText>{`v${record.version}`}</IdentifierText>
                </span>
              </div>
              <DialogDescription className="dossier-meta-row2">
                <span>{record.counterpartyName}</span>
                {record.counterpartyCode ? (
                  <>
                    <span className="dossier-sep">·</span>
                    <IdentifierText>{record.counterpartyCode}</IdentifierText>
                  </>
                ) : null}
                <span className="dossier-sep">·</span>
                <IdentifierText>{record.updatedAtFormatted}</IdentifierText>
              </DialogDescription>
            </div>
          </div>

          <div className="dossier-header-right">
            <div className="dossier-nav-pill">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!hasPrev}
                onClick={() => {
                  if (hasPrev) onSelectRecordId(records[currentIndex - 1].id);
                }}
                aria-label={td.executive.prevRecord}
              >
                <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              </Button>
              <span className="dossier-nav-count">
                <IdentifierText>
                  {`${currentIndex + 1} / ${records.length}`}
                </IdentifierText>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!hasNext}
                onClick={() => {
                  if (hasNext) onSelectRecordId(records[currentIndex + 1].id);
                }}
                aria-label={td.executive.nextRecord}
              >
                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              aria-label={td.executive.closeQuickModal}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {stageSteps && stageSteps.length > 0 ? (
          <div className="dossier-stage-bar">
            <span className="dossier-stage-label">{td.executive.lifecycleTrack}</span>
            <div className="dossier-stage-track">
              {stageSteps.map((step, idx) => {
                const activeIdx = stageSteps.findIndex(
                  (s) => s.status === record.status,
                );
                const stateClass =
                  step.status === record.status
                    ? "active"
                    : activeIdx > idx
                      ? "done"
                      : "";
                return (
                  <div
                    key={step.status}
                    className={`dossier-stage-cell ${stateClass}`}
                  >
                    <span className="dossier-stage-dot" aria-hidden />
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="dossier-body">
          <div className="dossier-grid">
            <div className="dossier-col">
              <div className="dossier-card dossier-card-indigo">
                <div className="dossier-card-header">
                  <div className="dossier-card-title">
                    <span className="dossier-icon-pill dossier-ip-indigo" aria-hidden>
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span>{td.executive.dossierOverview}</span>
                  </div>
                </div>
                <div className="dossier-fields-grid">
                  <div className="dossier-field-box">
                    <span className="dossier-lbl">{td.documentNumber}</span>
                    <span className="dossier-val">
                      <IdentifierText>{record.documentNumber}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-field-box">
                    <span className="dossier-lbl">{td.executive.counterparty}</span>
                    <span className="dossier-val">{record.counterpartyName}</span>
                  </div>
                  <div className="dossier-field-box">
                    <span className="dossier-lbl">{td.executive.currencyBadge}</span>
                    <span className="dossier-val">
                      <IdentifierText>{record.currencyCode}</IdentifierText>
                    </span>
                  </div>
                  <div className="dossier-field-box">
                    <span className="dossier-lbl">{td.updatedAt}</span>
                    <span className="dossier-val">
                      <IdentifierText>{record.updatedAtFormatted}</IdentifierText>
                    </span>
                  </div>
                </div>
              </div>

              {record.axes && record.axes.length > 0 ? (
                <div className="dossier-card dossier-card-violet">
                  <div className="dossier-card-header">
                    <div className="dossier-card-title">
                      <span className="dossier-icon-pill dossier-ip-violet" aria-hidden>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>{td.executive.multiAxisStatus}</span>
                    </div>
                  </div>
                  <div className="dossier-fields-grid">
                    {record.axes.map((ax, idx) => (
                      <div key={`qm-ax-${idx}`} className="dossier-field-box">
                        <span className="dossier-lbl">{ax.label}</span>
                        <span className="dossier-val">{ax.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="dossier-col">
              <div className="dossier-card dossier-card-emerald">
                <div className="dossier-card-header">
                  <div className="dossier-card-title">
                    <span className="dossier-icon-pill dossier-ip-emerald" aria-hidden>
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <span>{td.executive.financialSummary}</span>
                  </div>
                </div>
                <div className="dossier-fields-grid">
                  <div className="dossier-field-box dossier-span-all">
                    <span className="dossier-lbl">{td.grandTotal}</span>
                    <span className="dossier-val text-base">
                      <Money
                        value={record.grandTotal}
                        currency={record.currencyCode}
                        minimumFractionDigits={2}
                        maximumFractionDigits={8}
                      />
                    </span>
                  </div>
                  {record.secondaryAmountLabel && record.secondaryAmount ? (
                    <div className="dossier-field-box dossier-span-all">
                      <span className="dossier-lbl">{record.secondaryAmountLabel}</span>
                      <span className="dossier-val">
                        <Money
                          value={record.secondaryAmount}
                          currency={record.currencyCode}
                          minimumFractionDigits={2}
                          maximumFractionDigits={8}
                        />
                      </span>
                    </div>
                  ) : null}
                  {record.dateWindowLabel && record.dateWindowFormatted ? (
                    <div className="dossier-field-box dossier-span-all">
                      <span className="dossier-lbl">{record.dateWindowLabel}</span>
                      <span className="dossier-val">
                        <IdentifierText>{record.dateWindowFormatted}</IdentifierText>
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="dossier-card dossier-card-amber">
                <div className="dossier-card-header">
                  <div className="dossier-card-title">
                    <span className="dossier-icon-pill dossier-ip-amber" aria-hidden>
                      <Layers className="h-4 w-4" />
                    </span>
                    <span>{td.executive.linesPreview}</span>
                  </div>
                </div>
                <div className="dossier-fields-grid">
                  {typeof record.linesCount === "number" ? (
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.executive.linesCount}</span>
                      <span className="dossier-val">
                        <IdentifierText>{String(record.linesCount)}</IdentifierText>
                      </span>
                    </div>
                  ) : null}
                  {typeof record.clausesCount === "number" ? (
                    <div className="dossier-field-box">
                      <span className="dossier-lbl">{td.executive.clausesCount}</span>
                      <span className="dossier-val">
                        <IdentifierText>{String(record.clausesCount)}</IdentifierText>
                      </span>
                    </div>
                  ) : null}
                  <div className="dossier-field-box">
                    <span className="dossier-lbl">{td.executive.versionBadge}</span>
                    <span className="dossier-val">
                      <IdentifierText>{`v${record.version}`}</IdentifierText>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dossier-footer">
          <div className="dossier-footer-info">
            <span>{td.executive.quickInspectSubtitle}</span>
          </div>
          <div className="dossier-footer-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {td.executive.closeQuickModal}
            </Button>
            <Button asChild size="sm">
              <Link href={record.detailHref}>
                <ArrowUpRight className="me-1.5 h-4 w-4" aria-hidden />
                {td.executive.openFullDossier}
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
