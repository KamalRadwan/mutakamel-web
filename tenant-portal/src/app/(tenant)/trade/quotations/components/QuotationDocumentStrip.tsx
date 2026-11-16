"use client";

import type { ReactNode } from "react";
import { CalendarDays, Coins, FileText } from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function QuotationDocumentStrip({
  channel,
  customer,
  contact,
  currency,
  reference,
  validity,
  footer,
  compact = false,
  embedded = false,
}: {
  /** Channel control for the embedded two-column layout; rendered first in the start column. */
  channel?: ReactNode;
  customer: ReactNode;
  contact?: ReactNode;
  currency: ReactNode;
  reference: ReactNode;
  validity: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  if (embedded) {
    // Two logical columns: start = Channel, Customer, Contact; end = Reference, Currency, Valid until.
    // Grid columns follow the writing direction, so Arabic RTL mirrors automatically; narrow widths stack.
    return <div role="group" aria-label={t.quotationExperience.customerSection} className="min-w-0 space-y-1.5">
      <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 content-start gap-1.5">
          {channel ? <div className="min-w-0">{channel}</div> : null}
          <div className="min-w-0">{customer}</div>
          {contact ? <div className="min-w-0">{contact}</div> : null}
        </div>
        <div className="grid min-w-0 content-start gap-1.5">
          <div className="min-w-0">{reference}</div>
          <div className="min-w-0">{currency}</div>
          <div className="min-w-0">{validity}</div>
        </div>
      </div>
      {footer ? <div className="pt-0.5">{footer}</div> : null}
    </div>;
  }

  return <section aria-label={t.quotationExperience.customerSection}
    className={cn("rounded-lg border border-border bg-card", compact ? "px-3 py-2" : "px-3.5 py-2.5")}>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-12 xl:items-center">
      <div className={cn("min-w-0", contact ? "xl:col-span-4" : "xl:col-span-5")}>{customer}</div>
      {contact ? <div className="min-w-0 xl:col-span-2 xl:border-s xl:border-border xl:ps-3">{contact}</div> : null}
      <div className="min-w-0 space-y-1 xl:col-span-2 xl:border-s xl:border-border xl:ps-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="size-3.5" aria-hidden="true" />{t.tradeDocuments.currency}</p>
        {currency}
      </div>
      <div className={cn("min-w-0 space-y-1 xl:border-s xl:border-border xl:ps-3", contact ? "xl:col-span-2" : "xl:col-span-3")}>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" aria-hidden="true" />{t.quotationFlow.documentReference}</p>
        {reference}
      </div>
      <div className="min-w-0 space-y-1 xl:col-span-2 xl:border-s xl:border-border xl:ps-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden="true" />{t.quotationExperience.validity}</p>
        {validity}
      </div>
    </div>
    {footer ? <div className="mt-2 border-t border-border pt-2">{footer}</div> : null}
  </section>;
}
