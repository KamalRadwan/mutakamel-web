"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  IdentifierText,
  Money,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeGet } from "../../trade-api";
import {
  TRADE_DOCUMENT_RESPONSE_BYTES,
  partyDisplayName,
  tradeDocumentPath,
} from "../../documents/trade-document-contract";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import {
  QUOTATIONS_PATH,
  computePriceLockStatus,
  parseQuotationDetail,
  type Quotation,
  type QuotationDetail,
} from "../quotation-contract";
import { QuotationShareButtons } from "./QuotationShareButtons";

export interface QuotationMiniViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Quotation[];
  activeId: string | null;
  onSelectId: (id: string) => void;
  headers: Record<string, string>;
}

/**
 * Centered Quick Inspect ("Mini View") Modal (`Dialog` — Image 04).
 *
 * Lazily loads `GET /quotations/:id` when opened so users can inspect the
 * current revision's priced lines, structured terms, price-lock window, and
 * dispatch via icons-only Email/WhatsApp/Telegram without leaving the list.
 */
export function QuotationMiniViewModal({
  open,
  onOpenChange,
  items,
  activeId,
  onSelectId,
  headers,
}: QuotationMiniViewModalProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  const currentIndex = React.useMemo(
    () => (activeId ? items.findIndex((entry) => entry.id === activeId) : -1),
    [items, activeId],
  );
  const summary = currentIndex >= 0 ? items[currentIndex] : null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const [fetched, setFetched] = React.useState<{
    id: string;
    detail: QuotationDetail | null;
  } | null>(null);

  React.useEffect(() => {
    if (!open || !activeId) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await tradeGet(tradeDocumentPath(QUOTATIONS_PATH, activeId), {
          signal: controller.signal,
          headers,
          maxResponseBytes: TRADE_DOCUMENT_RESPONSE_BYTES,
        });
        if (!controller.signal.aborted) {
          setFetched({ id: activeId, detail: parseQuotationDetail(res.data) });
        }
      } catch {
        if (!controller.signal.aborted) {
          setFetched({ id: activeId, detail: null });
        }
      }
    })();
    return () => controller.abort();
  }, [open, activeId, headers]);

  const isLoadingDetail = Boolean(open && activeId && fetched?.id !== activeId);
  const detail = open && activeId && fetched?.id === activeId ? fetched.detail : null;

  if (!summary) return null;

  const currentRevision =
    detail?.revisions.find((r) => r.id === detail.currentRevisionId) ?? null;
  const lockStatus = computePriceLockStatus(summary.lifecycleStatus, currentRevision);
  const customerName = partyDisplayName(summary.partySnapshot) ?? td.notRecorded;
  const initials = customerName.slice(0, 2).toUpperCase();

  const lifecycleSteps = [
    { key: "DRAFT", label: t.statusValues["TradeQuotationStatus.DRAFT"] ?? "Draft" },
    { key: "SENT", label: t.statusValues["TradeQuotationStatus.SENT"] ?? "Sent" },
    { key: "ACCEPTED", label: t.statusValues["TradeQuotationStatus.ACCEPTED"] ?? "Accepted" },
  ];
  const activeStepIdx = lifecycleSteps.findIndex((s) => s.key === summary.lifecycleStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-w-4xl gap-0 overflow-hidden p-0 sm:p-0">
        {/* Header Band */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3.5 pe-14">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-bold">
                  <IdentifierText>
                    {summary.documentNumber ?? qCopy.unnumberedDraft}
                  </IdentifierText>
                </DialogTitle>
                <TradeStatusBadge
                  kind="TradeQuotationStatus"
                  value={summary.lifecycleStatus}
                />
                <Badge tone="brand" size="sm">
                  <IdentifierText>{`v${summary.version}`}</IdentifierText>
                </Badge>
              </div>
              <DialogDescription className="truncate text-xs text-muted-foreground">
                {customerName}
                {summary.draftReference ? ` · ${summary.draftReference}` : ""}
              </DialogDescription>
            </div>
          </div>

          {/* Record Stepper < 1 / N > */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!hasPrev}
              aria-label={td.executive.prevRecord}
              onClick={() => hasPrev && onSelectId(items[currentIndex - 1].id)}
              className="size-7 cursor-pointer px-0"
            >
              <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
            <span className="px-2 text-xs font-semibold text-foreground tabular-nums">
              <IdentifierText>{`${currentIndex + 1} / ${items.length}`}</IdentifierText>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={!hasNext}
              aria-label={td.executive.nextRecord}
              onClick={() => hasNext && onSelectId(items[currentIndex + 1].id)}
              className="size-7 cursor-pointer px-0"
            >
              <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Lifecycle Track Ribbon */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/25 px-5 py-2.5">
          <span className="text-badge font-bold uppercase tracking-wider text-muted-foreground">
            {td.executive.lifecycleTrack}
          </span>
          <div className="flex flex-1 items-center gap-2">
            {lifecycleSteps.map((step, idx) => {
              const isCurrent = step.key === summary.lifecycleStatus;
              const isDone = activeStepIdx > idx;
              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isDone
                        ? "border-success/35 bg-success-subtle text-success-subtle-foreground"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span>{`${idx + 1}. ${step.label}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex max-h-[65dvh] flex-col gap-4 overflow-y-auto p-5">
          {/* 4 KPI Summary Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <span className="block text-badge text-muted-foreground">
                {qCopy.currentRevision}
              </span>
              <span className="mt-0.5 block text-xs font-bold text-foreground">
                <IdentifierText>
                  {currentRevision ? `Revision #${currentRevision.revisionNumber}` : "—"}
                </IdentifierText>
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <span className="block text-badge text-muted-foreground">{td.validUntil}</span>
              <span className="mt-0.5 block text-xs font-bold text-foreground">
                <IdentifierText>
                  {currentRevision?.validUntil ?? summary.businessDate}
                </IdentifierText>
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <span className="block text-badge text-muted-foreground">
                {qCopy.priceLockExpires}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <Lock className="size-3 text-primary" aria-hidden="true" />
                {lockStatus.state === "pinned"
                  ? qCopy.priceLockPinned
                  : lockStatus.state === "active"
                    ? formatTemplate(qCopy.priceLockActive, {
                        hours: lockStatus.hoursLeft ?? 0,
                      })
                    : lockStatus.state === "expiring"
                      ? formatTemplate(qCopy.priceLockExpiring, {
                          hours: lockStatus.hoursLeft ?? 0,
                        })
                      : lockStatus.state === "expired"
                        ? qCopy.priceLockExpired
                        : qCopy.priceLockNone}
              </span>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <span className="block text-badge text-muted-foreground">{td.grandTotal}</span>
              <span className="mt-0.5 block text-sm font-bold text-primary tabular-nums">
                <Money
                  value={summary.grandTotal}
                  currency={summary.currencyCode}
                  minimumFractionDigits={2}
                  maximumFractionDigits={8}
                />
              </span>
            </div>
          </div>

          {/* Priced Lines Snapshot */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3.5 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Layers className="size-3.5 text-primary" aria-hidden="true" />
                {qCopy.currentLines}
              </span>
              {detail ? (
                <Badge tone="neutral" size="sm">
                  <IdentifierText>{String(detail.currentLines.length)}</IdentifierText>
                </Badge>
              ) : null}
            </div>
            <div className="p-3">
              {isLoadingDetail ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : detail && detail.currentLines.length > 0 ? (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2 py-1.5">#</TableHead>
                      <TableHead className="px-2 py-1.5">{td.item}</TableHead>
                      <TableHead className="px-2 py-1.5 text-end">{td.quantity}</TableHead>
                      <TableHead className="px-2 py-1.5 text-end">{td.unitPrice}</TableHead>
                      <TableHead className="px-2 py-1.5 text-end">{td.lineTotal}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.currentLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="px-2 py-2">
                          <IdentifierText>{String(line.printLineNumber)}</IdentifierText>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate px-2 py-2 font-medium text-foreground">
                          {line.descriptionSnapshot}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-end tabular-nums">
                          <Money
                            value={line.quantity}
                            minimumFractionDigits={0}
                            maximumFractionDigits={8}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 text-end tabular-nums">
                          <Money
                            value={line.unitPrice}
                            currency={summary.currencyCode}
                            minimumFractionDigits={2}
                            maximumFractionDigits={8}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2 text-end font-semibold tabular-nums">
                          <Money
                            value={line.lineTotal}
                            currency={summary.currencyCode}
                            minimumFractionDigits={2}
                            maximumFractionDigits={8}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground">{qCopy.noLines}</p>
              )}
            </div>
          </div>

          {/* Commercial Terms Preview */}
          {currentRevision && Object.keys(currentRevision.termsSnapshot).length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                <span>{td.executive.structuredTermsTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(currentRevision.termsSnapshot).map(([key, val]) => (
                  <div
                    key={key}
                    className="rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="block text-micro text-muted-foreground">
                      <IdentifierText>{key}</IdentifierText>
                    </span>
                    <span className="font-medium text-foreground">
                      <IdentifierText>{String(val)}</IdentifierText>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer: Icons-Only Share + Open Full Dossier */}
        <DialogFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 sm:justify-between">
          <QuotationShareButtons quotation={summary} />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              {t.common.close}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              asChild
              className="cursor-pointer gap-1.5"
            >
              <Link href={`${TENANT_ROUTES.tradeQuotations}/${summary.id}`}>
                <span>{td.executive.openFullDossier}</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
