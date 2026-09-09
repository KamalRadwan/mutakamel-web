"use client";

import { DetailSection, IdentifierText, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { SubscriptionView } from "../subscription-read";
import { AcceptedPricingDetails } from "./AcceptedPricingDetails";

export function SubscriptionAddonSelections({ view }: { view: SubscriptionView }) {
  const { t, lang } = useI18n();
  const copy = t.subscriptionAddons;
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title={copy.recurringTotals} description={copy.acceptedNotice} fields={[
        { label: copy.baseRecurring, value: <Money value={view.totals.baseRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.addonRecurring, value: <Money value={view.totals.addonRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.combinedRecurring, value: <Money value={view.totals.combinedRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.baseUsers, value: formatNumber(view.baseAllowance.effectiveAllowedUsers, lang) },
      ]} />
      <section aria-label={copy.addons} className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{copy.addons}</h2>
        <p className="text-xs text-muted-foreground">{copy.separateSeats}</p>
        {view.addonSelections.length === 0 ? <p className="text-xs text-muted-foreground">{copy.noAddons}</p> : null}
        {view.addonSelections.map((addon) => (
          <DetailSection key={addon.id} title={addon.addonKey} description={t.applicationAccess.notOperational} fields={[
            { label: copy.parent, value: <IdentifierText>{view.baseItems.find((item) => item.id === addon.parentItemId)?.applicationKey}</IdentifierText> },
            { label: t.coreBilling.seats, value: formatNumber(addon.seats, lang) },
            { label: copy.amount, value: <Money value={addon.acceptedPricing.recurringAmountUsd} currency="USD" maximumFractionDigits={4} /> },
            { label: copy.definition, value: <IdentifierText>{addon.definitionVersionId}</IdentifierText> },
            { label: t.applicationAccess.definition, value: t.applicationAccess.status[addon.effectiveState.definitionState] },
            { label: t.applicationAccess.addonLifecycle, value: addon.effectiveState.addonLifecycleStatus ? t.applicationAccess.status[addon.effectiveState.addonLifecycleStatus] : t.detail.notRecorded },
          ]}>
            <AcceptedPricingDetails pricing={addon.acceptedPricing} />
          </DetailSection>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">{copy.projectionNotObserved}</p>
    </div>
  );
}
