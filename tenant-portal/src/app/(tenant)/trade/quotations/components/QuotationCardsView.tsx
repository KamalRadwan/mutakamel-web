"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, Eye, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  IdentifierText,
  Money,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { partyDisplayName } from "../../documents/trade-document-contract";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import type { Quotation } from "../quotation-contract";
import { QuotationShareButtons } from "./QuotationShareButtons";

export interface QuotationCardsViewProps {
  items: Quotation[];
  onQuickInspect: (id: string) => void;
  onRequestDelete: (quotation: Quotation) => void;
}

/**
 * Ocean Navy v3 Executive Cards View for Quotations (`/trade/quotations`).
 */
export function QuotationCardsView({
  items,
  onQuickInspect,
  onRequestDelete,
}: QuotationCardsViewProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  if (items.length === 0) {
    return <EmptyState title={qCopy.empty} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((quotation) => {
        const customerName = partyDisplayName(quotation.partySnapshot) ?? td.notRecorded;
        const isCommercial =
          quotation.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT";

        return (
          <article
            key={quotation.id}
            className="flex flex-col justify-between gap-3 rounded-card border border-border bg-card p-4 shadow-2xs transition-colors hover:border-primary/45"
          >
            <div className="flex flex-col gap-3">
              {/* Top Identity */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
                  >
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`${TENANT_ROUTES.tradeQuotations}/${quotation.id}`}
                      className="block truncate text-sm font-bold text-foreground hover:text-primary hover:underline"
                    >
                      <IdentifierText>
                        {quotation.documentNumber ?? qCopy.unnumberedDraft}
                      </IdentifierText>
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{customerName}</p>
                  </div>
                </div>
                <TradeStatusBadge
                  kind="TradeQuotationStatus"
                  value={quotation.lifecycleStatus}
                />
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-muted/30 p-2.5 text-xs">
                <div>
                  <span className="block text-badge text-muted-foreground">
                    {td.businessDate}
                  </span>
                  <span className="font-medium text-foreground">
                    <IdentifierText>{quotation.businessDate}</IdentifierText>
                  </span>
                </div>
                <div>
                  <span className="block text-badge text-muted-foreground">
                    {td.draftReference}
                  </span>
                  <span className="block truncate font-medium text-foreground">
                    <IdentifierText>
                      {quotation.draftReference ?? td.notRecorded}
                    </IdentifierText>
                  </span>
                </div>
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={isCommercial ? "brand" : "neutral"} size="sm">
                    {isCommercial ? qCopy.commercialAccountBadge : qCopy.crmProspectBadge}
                  </Badge>
                  <Badge tone="neutral" size="sm">
                    <IdentifierText>{`v${quotation.version}`}</IdentifierText>
                  </Badge>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">
                  <Money
                    value={quotation.grandTotal}
                    currency={quotation.currencyCode}
                    minimumFractionDigits={2}
                    maximumFractionDigits={8}
                  />
                </span>
              </div>
            </div>

            {/* Footer Actions: Icons-Only Share + Eye Inspect + Open Dossier */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <QuotationShareButtons quotation={quotation} />

              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={td.executive.quickInspect}
                      onClick={() => onQuickInspect(quotation.id)}
                      className="size-8 cursor-pointer rounded-md px-0"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{td.executive.quickInspect}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={qCopy.deleteAction}
                      onClick={() => onRequestDelete(quotation)}
                      className="size-8 cursor-pointer rounded-md px-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{qCopy.deleteAction}</TooltipContent>
                </Tooltip>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer gap-1"
                >
                  <Link href={`${TENANT_ROUTES.tradeQuotations}/${quotation.id}`}>
                    <span>{td.executive.openDossier}</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
