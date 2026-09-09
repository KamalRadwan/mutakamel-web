"use client";

import Link from "next/link";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { OwnerGate } from "../../components/OwnerGate";
import { useSubscriptionOffers } from "../hooks/useSubscriptionOffers";
import { SubscriptionOfferCard } from "./SubscriptionOfferCard";

export function SubscriptionOffersWorkspace() {
  const { t, data, loading, denied, error, selectedTier, selectTier, changePage, reload, reset, paginationLabels } = useSubscriptionOffers();
  const copy = t.subscriptionOffers;
  return <OwnerGate denied={denied}>
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} description={copy.description} secondaryActions={<>
        <Button variant="outline" asChild><Link href={TENANT_ROUTES.coreSubscriptionChange}>{t.commercialPurchase.title}</Link></Button>
        <Button variant="outline" asChild><Link href={TENANT_ROUTES.coreSubscription}>{copy.back}</Link></Button>
        <Button variant="outline" onClick={reload} disabled={loading}>{t.coreBilling.reload}</Button>
      </>} />
      <p className="text-sm text-muted-foreground">{copy.notice}</p>
      <p className="text-xs text-muted-foreground">{copy.graduated}</p>
      {selectedTier && <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">{copy.filtered}: {selectedTier}</p>
        <Button variant="outline" onClick={reset}>{copy.all}</Button>
      </div>}
      {loading ? <Skeleton className="h-56 w-full" /> : error ? <ErrorState title={copy.loadFailed} description={copy.unavailable} onRetry={reload} retryLabel={t.common.retry} />
        : data && <>
          {data.items.length === 0 ? <EmptyState title={copy.empty} /> : <div className="flex min-w-0 flex-col gap-4">
            {data.items.map((offer) => <SubscriptionOfferCard key={`${offer.sourceKind}:${offer.sourceKind === "APPLICATION" ? offer.tier.id : offer.addon.id}`}
              offer={offer} onSelectTier={selectTier} />)}
          </div>}
          <Pagination page={data.meta} onPageChange={changePage} labels={paginationLabels} className="flex-wrap" />
        </>}
    </div>
  </OwnerGate>;
}
