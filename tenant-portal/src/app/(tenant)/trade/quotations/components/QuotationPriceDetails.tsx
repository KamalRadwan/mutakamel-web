"use client";

import { Info, ShieldCheck } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, IdentifierText, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TradePriceDecision } from "../../documents/trade-lookup-contract";

export function QuotationPriceDetails({ decision }: { decision: TradePriceDecision }) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="xs" className="size-6 px-0 text-primary" aria-label={copy.priceDetails}><Info className="size-3.5" aria-hidden="true" /></Button></DialogTrigger>
    <DialogContent size="lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />{copy.priceDetails}</DialogTitle><DialogDescription>{copy.priceDetailsDescription}</DialogDescription></DialogHeader>
      <dl className="divide-y divide-border text-sm">
        <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{copy.unitPrice}</dt><dd className="font-semibold"><Money value={decision.unitPrice} currency={decision.currencyCode} maximumFractionDigits={8} /></dd></div>
        <div className="space-y-1 py-3"><dt className="text-muted-foreground">{copy.priceSource}</dt><dd className="wrap-anywhere"><IdentifierText>{decision.priceBookId}</IdentifierText></dd></div>
        {decision.priceBookVersion !== undefined ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{copy.bookVersion}</dt><dd><IdentifierText>{String(decision.priceBookVersion)}</IdentifierText></dd></div> : null}
        {decision.baselineUnitPrice !== undefined ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{copy.baselinePrice}</dt><dd><Money value={decision.baselineUnitPrice} currency={decision.currencyCode} maximumFractionDigits={8} /></dd></div> : null}
        {decision.minimumAllowedPrice !== null ? <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{copy.minimumPrice}</dt><dd><Money value={decision.minimumAllowedPrice} currency={decision.currencyCode} maximumFractionDigits={8} /></dd></div> : null}
        <div className="space-y-2 py-3"><dt className="text-muted-foreground">{copy.promotion}</dt><dd>{decision.matchedPromotions?.length ? decision.matchedPromotions.map((promotion) => <div key={promotion.code} className="flex justify-between gap-4"><IdentifierText>{promotion.code}</IdentifierText><Money value={promotion.discountAmount} currency={decision.currencyCode} maximumFractionDigits={8} /></div>) : copy.noPromotion}</dd></div>
      </dl><p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{copy.priceNotLocked}</p>
    </DialogContent>
  </Dialog>;
}
