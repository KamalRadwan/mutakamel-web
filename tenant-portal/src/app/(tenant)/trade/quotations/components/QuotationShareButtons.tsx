"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import {
  Button,
  ContactChannelIcon,
  DropdownMenuItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { partyDisplayName } from "../../documents/trade-document-contract";
import {
  extractPartyContactCoordinates,
  type Quotation,
} from "../quotation-contract";
import {
  buildQuotationEmailHref,
  buildQuotationTelegramHref,
  buildQuotationWhatsAppHref,
  type QuotationShareContext,
} from "../quotation-share-links";

export interface QuotationShareButtonsProps {
  quotation: Pick<
    Quotation,
    | "id"
    | "documentNumber"
    | "draftReference"
    | "currencyCode"
    | "grandTotal"
    | "partySnapshot"
  >;
  className?: string;
  presentation?: "buttons" | "menu";
}

/**
 * Icons-Only Quotation Channel Dispatch Cluster (`Email`, `WhatsApp`, `Telegram`).
 *
 * Strictly renders icon-only buttons (zero visible text labels) with accessible
 * `aria-label` attributes and downward tooltips so tooltips never clip against
 * modal or page top edges.
 */
export function QuotationShareButtons({
  quotation,
  className,
  presentation = "buttons",
}: QuotationShareButtonsProps) {
  const { t } = useI18n();
  const qCopy = t.tradeDocuments.quotations;
  const [busyChannel, setBusyChannel] = React.useState<"email" | "whatsapp" | "telegram" | null>(
    null,
  );

  const coordinates = React.useMemo(
    () => extractPartyContactCoordinates(quotation.partySnapshot),
    [quotation.partySnapshot],
  );

  const resolveShareContext = React.useCallback((): QuotationShareContext => {
    const reference =
      quotation.documentNumber ?? quotation.draftReference ?? quotation.id.slice(0, 8);
    const customerName =
      partyDisplayName(quotation.partySnapshot) ?? t.tradeDocuments.customer;

    return {
      reference,
      customerName,
      currencyCode: quotation.currencyCode,
      grandTotal: quotation.grandTotal,
      recipientEmail: coordinates.email,
      recipientPhone: coordinates.phone,
      subjectTemplate: qCopy.shareSubjectTemplate,
      bodyTemplate: qCopy.shareSummaryTemplate,
    };
  }, [
    quotation.id,
    quotation.documentNumber,
    quotation.draftReference,
    quotation.partySnapshot,
    quotation.currencyCode,
    quotation.grandTotal,
    coordinates.email,
    coordinates.phone,
    qCopy.shareSubjectTemplate,
    qCopy.shareSummaryTemplate,
    t.tradeDocuments.customer,
  ]);

  const dispatch = React.useCallback(
    (channel: "email" | "whatsapp" | "telegram") => {
      if (busyChannel !== null) return;
      setBusyChannel(channel);
      try {
        const ctx = resolveShareContext();
        const href =
          channel === "email"
            ? buildQuotationEmailHref(ctx)
            : channel === "whatsapp"
              ? buildQuotationWhatsAppHref(ctx)
              : buildQuotationTelegramHref(ctx);

        if (channel === "email") {
          window.location.assign(href);
        } else {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      } finally {
        setBusyChannel(null);
      }
    },
    [busyChannel, resolveShareContext],
  );

  if (presentation === "menu") return <>
    <DropdownMenuItem disabled={busyChannel !== null} onSelect={() => dispatch("email")}>
      <Mail className="size-4" aria-hidden="true" />{qCopy.shareEmailTooltip}
    </DropdownMenuItem>
    <DropdownMenuItem disabled={busyChannel !== null} onSelect={() => dispatch("whatsapp")}>
      <ContactChannelIcon channel="whatsapp" className="size-4" />{qCopy.shareWhatsAppTooltip}
    </DropdownMenuItem>
    <DropdownMenuItem disabled={busyChannel !== null} onSelect={() => dispatch("telegram")}>
      <ContactChannelIcon channel="telegram" className="size-4" />{qCopy.shareTelegramTooltip}
    </DropdownMenuItem>
  </>;

  return (
    <div
      role="group"
      aria-label={qCopy.shareGroupLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={qCopy.shareEmailTooltip}
            disabled={busyChannel !== null}
            loading={busyChannel === "email"}
            onClick={() => void dispatch("email")}
            className="size-8 cursor-pointer rounded-md border-border/80 bg-card px-0 text-primary hover:border-primary/40 hover:bg-primary/5"
          >
            <Mail className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{qCopy.shareEmailTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={qCopy.shareWhatsAppTooltip}
            disabled={busyChannel !== null}
            loading={busyChannel === "whatsapp"}
            onClick={() => void dispatch("whatsapp")}
            className="size-8 cursor-pointer rounded-md border-border/80 bg-card px-0 hover:border-success/40 hover:bg-success-subtle/40"
          >
            <ContactChannelIcon channel="whatsapp" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{qCopy.shareWhatsAppTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={qCopy.shareTelegramTooltip}
            disabled={busyChannel !== null}
            loading={busyChannel === "telegram"}
            onClick={() => void dispatch("telegram")}
            className="size-8 cursor-pointer rounded-md border-border/80 bg-card px-0 hover:border-primary/40 hover:bg-primary/5"
          >
            <ContactChannelIcon channel="telegram" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{qCopy.shareTelegramTooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
