"use client";

import { Button, Card, CardContent, CardHeader, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { SubscriptionOffer } from "../subscription-offers";
import { OfferPricingLadder } from "./OfferPricingLadder";

export function SubscriptionOfferCard({ offer, onSelectTier }: { offer: SubscriptionOffer; onSelectTier: (offer: SubscriptionOffer) => void }) {
  const { t } = useI18n();
  const copy = t.subscriptionOffers;
  const source = offer.sourceKind === "APPLICATION" ? offer.tier : offer.addon;
  return <Card className="min-w-0">
    <CardHeader>
      <p className="text-xs text-muted-foreground">{offer.application.name} · {offer.sourceKind === "APPLICATION" ? copy.applicationTier : copy.addon}</p>
      <h2 className="break-words text-base font-medium">{source.name}</h2>
      <IdentifierText className="text-xs text-muted-foreground">{source.key}</IdentifierText>
      <p className="text-xs text-muted-foreground">{copy.status[offer.status]}</p>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {offer.ladders.map((ladder) => <OfferPricingLadder key={ladder.billingCycle} ladder={ladder} />)}
      </div>
      {offer.sourceKind === "APPLICATION" && <div>
        <Button variant="outline" size="sm" onClick={() => onSelectTier(offer)}>{copy.filter}</Button>
      </div>}
    </CardContent>
  </Card>;
}
