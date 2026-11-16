"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  DateTime,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IdentifierText,
  Money,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { addFixedDecimal, DECIMAL_ZERO } from "../../documents/fixed-decimal";
import { partyDisplayName } from "../../documents/trade-document-contract";
import {
  QUOTATION_LIFECYCLE_STATUSES,
  type Quotation,
  type QuotationLifecycleStatus,
} from "../quotation-contract";

export interface QuotationBoardViewProps {
  items: Quotation[];
  onQuickInspect: (id: string) => void;
  onRequestDelete: (quotation: Quotation) => void;
}

const COLUMN_ACCENT_BAR: Record<QuotationLifecycleStatus, string> = {
  DRAFT: "bg-muted-foreground/45",
  SENT: "bg-primary",
  ACCEPTED: "bg-success",
  REJECTED: "bg-destructive/80",
  CANCELLED: "bg-destructive/55",
  EXPIRED: "bg-muted-foreground/45",
};

const CARD_RING_ACCENT: Record<QuotationLifecycleStatus, string> = {
  DRAFT: "hover:border-primary/40",
  SENT: "border-primary/25 hover:border-primary/55",
  ACCEPTED: "border-success/30 hover:border-success/60",
  REJECTED: "border-destructive/20 hover:border-destructive/45",
  CANCELLED: "border-border hover:border-muted-foreground/40 opacity-90",
  EXPIRED: "border-border hover:border-muted-foreground/40 opacity-90",
};

function sumByPrimaryCurrency(rows: Quotation[]): { currency: string; total: string } | null {
  if (rows.length === 0) return null;
  const currency = rows[0].currencyCode;
  let sum = DECIMAL_ZERO;
  for (const row of rows) {
    if (row.currencyCode === currency) {
      sum = addFixedDecimal(sum, row.grandTotal);
    }
  }
  return { currency, total: sum };
}

/**
 * Ocean Navy v3 Kanban Board View for Quotations (`/trade/quotations`).
 *
 * Renders each supported quotation list status as a column, including EXPIRED.
 */
export function QuotationBoardView({
  items,
  onQuickInspect,
  onRequestDelete,
}: QuotationBoardViewProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  const [collapsed, setCollapsed] = React.useState<Set<QuotationLifecycleStatus>>(
    () => new Set(),
  );
  const [expandedCards, setExpandedCards] = React.useState<Set<string>>(() => new Set());

  const toggleCollapse = (status: QuotationLifecycleStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const toggleCardExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = React.useMemo(() => {
    const map = new Map<QuotationLifecycleStatus, Quotation[]>();
    for (const status of QUOTATION_LIFECYCLE_STATUSES) {
      map.set(status, []);
    }
    for (const item of items) {
      const bucket = map.get(item.lifecycleStatus as QuotationLifecycleStatus);
      if (bucket) bucket.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="flex min-h-[540px] gap-3 overflow-x-auto pb-2">
      {QUOTATION_LIFECYCLE_STATUSES.map((status) => {
        const stageItems = grouped.get(status) ?? [];
        const isCollapsed = collapsed.has(status);
        const stageLabel = t.statusValues[`TradeQuotationStatus.${status}`] ?? status;
        const stageSum = sumByPrimaryCurrency(stageItems);

        if (isCollapsed) {
          return (
            <section
              key={status}
              className="flex w-12 shrink-0 flex-col items-center gap-3 rounded-column border border-border bg-muted/40 py-3"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => toggleCollapse(status)}
                aria-label={stageLabel}
                className="size-7 cursor-pointer"
              >
                <ChevronsRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </Button>
              <Badge tone="neutral" size="sm">
                <IdentifierText>{String(stageItems.length)}</IdentifierText>
              </Badge>
              <span className="mt-2 [writing-mode:vertical-rl] text-xs font-semibold text-muted-foreground">
                {stageLabel}
              </span>
            </section>
          );
        }

        return (
          <section
            key={status}
            className="flex min-w-[292px] flex-1 flex-col rounded-column border border-border bg-muted/35"
          >
            {/* Column Header */}
            <div className="flex flex-col gap-2 rounded-t-column border-b border-border/80 bg-card/75 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{stageLabel}</span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-badge font-semibold text-muted-foreground tabular-nums">
                    <IdentifierText>{String(stageItems.length)}</IdentifierText>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={stageLabel}
                    onClick={() => toggleCollapse(status)}
                    className="size-6 cursor-pointer rounded-md text-muted-foreground"
                  >
                    <ChevronsLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-badge text-muted-foreground">
                <span>{qCopy.stagePipelineTotal}</span>
                {stageSum ? (
                  <span className="font-semibold text-foreground tabular-nums">
                    <Money
                      value={stageSum.total}
                      currency={stageSum.currency}
                    />
                  </span>
                ) : (
                  <IdentifierText>0.00</IdentifierText>
                )}
              </div>

              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    COLUMN_ACCENT_BAR[status],
                    stageItems.length === 0 ? "w-0" : "w-full",
                  )}
                />
              </div>
            </div>

            {/* Column Cards Body */}
            <div className="flex flex-1 flex-col gap-2.5 p-2.5">
              {stageItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-8">
                  <EmptyState
                    title={td.executive.boardEmptyStage}
                    className="py-4 text-center"
                  />
                </div>
              ) : (
                stageItems.map((quotation) => {
                  const customerName =
                    partyDisplayName(quotation.partySnapshot) ?? td.notRecorded;
                  const isExpanded = expandedCards.has(quotation.id);
                  const isCommercial =
                    quotation.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT";
                  const initials = customerName.slice(0, 2).toUpperCase();

                  return (
                    <article
                      key={quotation.id}
                      className={cn(
                        "flex flex-col gap-2.5 rounded-card border bg-card p-3 shadow-2xs transition-colors",
                        CARD_RING_ACCENT[status],
                      )}
                    >
                      {/* Card Top: Customer & Doc Reference */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 text-primary"
                          >
                            <Building2 className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`${TENANT_ROUTES.tradeQuotations}/${quotation.id}`}
                              className="block truncate text-xs font-bold text-foreground hover:text-primary hover:underline"
                            >
                              {customerName}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-badge text-muted-foreground">
                              <IdentifierText>
                                {quotation.documentNumber ?? qCopy.unnumberedDraft}
                              </IdentifierText>
                              <span>·</span>
                              <IdentifierText>{`v${quotation.version}`}</IdentifierText>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label={qCopy.expandCard}
                            aria-expanded={isExpanded}
                            onClick={() => toggleCardExpand(quotation.id)}
                            className="size-6 cursor-pointer rounded-md text-muted-foreground"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="size-3.5" aria-hidden="true" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                aria-label={t.common.actions}
                                className="size-6 cursor-pointer rounded-md text-muted-foreground"
                              >
                                <MoreHorizontal className="size-3.5" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`${TENANT_ROUTES.tradeQuotations}/${quotation.id}`}>
                                  <ArrowUpRight className="me-1.5 size-3.5" aria-hidden="true" />
                                  {qCopy.openViewOne}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => onQuickInspect(quotation.id)}>
                                <Eye className="me-1.5 size-3.5" aria-hidden="true" />
                                {td.executive.quickInspect}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => onRequestDelete(quotation)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="me-1.5 size-3.5" aria-hidden="true" />
                                {qCopy.deleteAction}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Badges & Draft Ref Row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={isCommercial ? "brand" : "neutral"} size="sm">
                          {isCommercial
                            ? qCopy.commercialAccountBadge
                            : qCopy.crmProspectBadge}
                        </Badge>
                        {quotation.draftReference ? (
                          <span className="truncate rounded bg-muted px-1.5 py-0.5 text-micro text-muted-foreground">
                            <IdentifierText>{quotation.draftReference}</IdentifierText>
                          </span>
                        ) : null}
                      </div>

                      {/* Inline Expanded Details */}
                      {isExpanded ? (
                        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-muted/35 px-2.5 py-2 text-badge">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{td.businessDate}:</span>
                            <IdentifierText>{quotation.businessDate}</IdentifierText>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{td.updatedAt}:</span>
                            <DateTime value={quotation.updatedAt} precision="date" />
                          </div>
                        </div>
                      ) : null}

                      {/* Card Footer: Money + Quick Inspect Eye + Avatar */}
                      <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-2">
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          <Money
                            value={quotation.grandTotal}
                            currency={quotation.currencyCode}
                            minimumFractionDigits={2}
                            maximumFractionDigits={8}
                          />
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                aria-label={td.executive.quickInspect}
                                onClick={() => onQuickInspect(quotation.id)}
                                className="size-6 cursor-pointer rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {td.executive.quickInspect}
                            </TooltipContent>
                          </Tooltip>
                          <span
                            aria-hidden="true"
                            className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-micro font-bold text-primary-foreground"
                          >
                            {initials}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
