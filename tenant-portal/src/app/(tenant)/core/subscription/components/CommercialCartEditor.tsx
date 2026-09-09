"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, ErrorState, Field, Input, Pagination, Skeleton, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { OwnerGate } from "../../components/OwnerGate";
import { canSelectCommercialOffer, commercialOfferKey } from "../commercial-cart";
import type { SubscriptionView } from "../subscription-read";
import { useCommercialCart } from "../hooks/useCommercialCart";
import type { useCommercialChange } from "../hooks/useCommercialChange";
import { useSubscriptionOffers } from "../hooks/useSubscriptionOffers";
import { CommercialChangeList } from "./CommercialChangeList";
import { SubscriptionOfferCard } from "./SubscriptionOfferCard";

export function CommercialCartEditor({ view, change }: { view: SubscriptionView; change: ReturnType<typeof useCommercialChange> }) {
  const { t, lang, dir } = useI18n();
  const copy = t.commercialPurchase;
  const offers = useSubscriptionOffers();
  const form = useCommercialCart(view, change.canStart && !offers.denied, offers.data?.items ?? []);
  return <OwnerGate denied={offers.denied}><div className="flex min-w-0 flex-col gap-4">
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.currentItems}>
      <h2 className="text-sm font-semibold">{copy.currentItems}</h2>
      <p className="text-xs text-muted-foreground">{copy.quantityNotice}</p>
      {view.baseItems.map((item) => <Field key={item.id} label={`${item.applicationName ?? item.applicationKey} · ${item.tierName ?? item.tierKey}`}>
        <Input type="text" inputMode="numeric" maxLength={6} placeholder={formatNumber(item.seats, lang)} value={form.cart.quantities[item.id]?.seats ?? ""}
          disabled={!change.canStart} onChange={(event) => form.quantity(item.id, event.target.value)} />
      </Field>)}
      {view.addonSelections.map((item) => <Field key={item.id} label={item.addonKey}>
        <Input type="text" inputMode="numeric" maxLength={6} placeholder={formatNumber(item.seats, lang)} value={form.cart.quantities[item.id]?.seats ?? ""}
          disabled={!change.canStart} onChange={(event) => form.quantity(item.id, event.target.value)} />
      </Field>)}
    </section>
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.selected}>
      <h2 className="text-sm font-semibold">{copy.selected}</h2>
      {form.cart.offers.length === 0 && <p className="text-xs text-muted-foreground">{copy.noneSelected}</p>}
      {form.cart.offers.map((row) => <div className="flex min-w-0 flex-col gap-2 border-b border-border pb-3" key={row.selectionKey}>
        <p className="text-sm">{row.offer.application.name} · {row.offer.sourceKind === "APPLICATION" ? row.offer.tier.name : row.offer.addon.name}</p>
        {(row.offer.sourceKind === "ADDON" || !view.baseItems.some((item) => item.applicationId === row.offer.application.id)) && <Field label={t.coreBilling.seats}>
          <Input type="text" inputMode="numeric" maxLength={6} value={row.seats}
            disabled={!change.canStart} onChange={(event) => form.offerQuantity(row.selectionKey, event.target.value)} />
        </Field>}
        <div><Button variant="ghost" size="sm" disabled={!change.canStart} onClick={() => form.remove(row.selectionKey)}>{copy.removeDraft}</Button></div>
      </div>)}
      <Field label={copy.reason}><Textarea maxLength={256} value={form.cart.reason}
        disabled={!change.canStart} onChange={(event) => form.reason(event.target.value)} /></Field>
      {form.invalid && <p role="alert" className="text-sm text-destructive">{copy.invalidCart}</p>}
      <div><Button variant="outline" disabled={!change.canStart} onClick={form.review}>{copy.review}</Button></div>
    </section>
    <section className="flex min-w-0 flex-col gap-3" aria-label={t.subscriptionOffers.title}>
      <h2 className="text-sm font-semibold">{t.subscriptionOffers.title}</h2>
      <p className="text-xs text-muted-foreground">{copy.offerNotice}</p>
      {offers.selectedTier && <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{offers.selectedTier}</p><Button variant="outline" onClick={offers.reset}>{t.subscriptionOffers.all}</Button></div>}
      {offers.loading ? <Skeleton className="h-48 w-full" /> : offers.error ? <ErrorState title={t.subscriptionOffers.loadFailed} onRetry={offers.reload} retryLabel={t.common.retry} />
        : offers.data && <>
          {offers.data.items.length === 0 && <EmptyState title={t.subscriptionOffers.empty} />}
          {offers.data.items.map((offer) => <div className="flex min-w-0 flex-col gap-2" key={`${commercialOfferKey(offer)}:${offer.sourceKind === "APPLICATION" ? offer.tier.id : offer.addon.definitionVersionId}`}>
            <SubscriptionOfferCard offer={offer} onSelectTier={offers.selectTier} />
            <div><Button variant="outline" disabled={!change.canStart || !canSelectCommercialOffer(offer, view)} onClick={() => form.select(offer)}>{copy.selectOffer}</Button></div>
          </div>)}
          <Pagination page={offers.data.meta} onPageChange={offers.changePage} labels={offers.paginationLabels} className="flex-wrap" />
        </>}
    </section>
    <Dialog open={!!form.request && change.canStart} onOpenChange={form.closeReview}>
      <DialogContent dir={dir} className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{copy.review}</DialogTitle><DialogDescription>{copy.prepareNotice}</DialogDescription></DialogHeader>
        {form.request && <CommercialChangeList request={form.request} />}
        <DialogFooter><Button variant="outline" onClick={form.closeReview}>{t.common.cancel}</Button>
          <Button variant="outline" disabled={!change.canStart || !form.request} onClick={() => form.request && void change.start(form.request)}>{copy.prepare}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div></OwnerGate>;
}
