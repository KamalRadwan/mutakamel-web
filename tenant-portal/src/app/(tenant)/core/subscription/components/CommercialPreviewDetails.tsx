"use client";

import { DateTime, DetailSection, IdentifierText, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import type { CommercialPreview } from "../commercial-preview";
import { AcceptedPricingDetails } from "./AcceptedPricingDetails";

export function CommercialPreviewDetails({ preview }: { preview: CommercialPreview }) {
  const { t, lang } = useI18n();
  const copy = t.commercialPurchase, financial = preview.financial;
  return <div className="flex min-w-0 flex-col gap-4">
    <DetailSection title={financial.walletStatus === "NOT_APPLICABLE" ? t.commercialAdoption.preview : copy.quote}
      description={financial.walletStatus === "NOT_APPLICABLE" ? t.commercialAdoption.previewNotice : copy.quoteNotice} fields={[
      { label: t.commercialReceipt.preview, value: <IdentifierText>{preview.previewId}</IdentifierText> },
      { label: t.commercialReceipt.operation, value: <IdentifierText>{preview.operationId}</IdentifierText> },
      { label: t.commercialReceipt.preparation, value: <IdentifierText>{preview.preparation.preparationId}</IdentifierText> },
      { label: t.commercialReceipt.revision, value: <IdentifierText>{preview.subscriptionRevision}</IdentifierText> },
      { label: copy.pricedAt, value: <DateTime value={preview.pricedAt} /> },
      { label: copy.expiresAt, value: <DateTime value={preview.expiresAt} /> },
      { label: t.coreBilling.billingCycle, value: copy.status[preview.billingCycle] },
    ]} />
    {preview.changes.map((row) => <section key={row.selectionKey} className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.status[row.sourceKind]}>
      <DetailSection title={copy.status[row.sourceKind]} emptyValueLabel={t.detail.notRecorded} fields={[
        { label: t.commercialReceipt.change, value: copy.status[row.operation] },
        { label: t.commercialReceipt.selectionKey, value: <IdentifierText>{row.selectionKey}</IdentifierText> },
        { label: copy.applicationId, value: <IdentifierText>{row.applicationId}</IdentifierText> },
        { label: copy.itemId, value: row.itemId && <IdentifierText>{row.itemId}</IdentifierText> },
        { label: copy.addonId, value: row.addonId && <IdentifierText>{row.addonId}</IdentifierText> },
        { label: t.commercialReceipt.selection, value: row.addonSelectionId && <IdentifierText>{row.addonSelectionId}</IdentifierText> },
        { label: copy.parentItem, value: row.parentItemId && <IdentifierText>{row.parentItemId}</IdentifierText> },
        { label: copy.parentSelection, value: row.parentSelectionKey && <IdentifierText>{row.parentSelectionKey}</IdentifierText> },
        { label: copy.fromSeats, value: row.fromSeats !== null && formatNumber(row.fromSeats, lang) },
        { label: copy.toSeats, value: row.toSeats !== null && formatNumber(row.toSeats, lang) },
        { label: copy.fromTier, value: row.fromTierId && <IdentifierText>{row.fromTierId}</IdentifierText> },
        { label: copy.toTier, value: row.toTierId && <IdentifierText>{row.toTierId}</IdentifierText> },
        { label: copy.fromDefinition, value: row.fromDefinitionVersionId && <IdentifierText>{row.fromDefinitionVersionId}</IdentifierText> },
        { label: copy.toDefinition, value: row.toDefinitionVersionId && <IdentifierText>{row.toDefinitionVersionId}</IdentifierText> },
        { label: copy.previous, value: <Money value={row.previousAmountUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.next, value: <Money value={row.nextAmountUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.fullDelta, value: <Money value={row.fullPeriodDeltaUsd} currency="USD" maximumFractionDigits={4} /> },
        { label: copy.allocation, value: <Money value={row.proratedAllocationUsd} currency="USD" maximumFractionDigits={4} /> },
      ]} />
      {row.acceptedPricingBefore && <div><h3 className="mb-2 text-xs font-medium">{copy.beforePricing}</h3><AcceptedPricingDetails pricing={row.acceptedPricingBefore} /></div>}
      {row.acceptedPricingAfter && <div><h3 className="mb-2 text-xs font-medium">{copy.afterPricing}</h3><AcceptedPricingDetails pricing={row.acceptedPricingAfter} /></div>}
    </section>)}
    <DetailSection title={copy.financial} fields={[
      { label: copy.previous, value: <Money value={financial.previousRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: copy.next, value: <Money value={financial.nextRecurringUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: copy.fullDelta, value: <Money value={financial.fullPeriodDeltaUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.commercialReceipt.direction, value: copy.status[financial.direction] },
      { label: copy.prorated, value: <Money value={financial.proratedAmountUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: copy.walletStatus, value: financial.walletStatus === "NOT_APPLICABLE" ? t.commercialAdoption.status.NOT_APPLICABLE : copy.status[financial.walletStatus] },
      { label: copy.available, value: financial.walletAvailableUsd === null ? t.commercialAdoption.status.NOT_APPLICABLE : <Money value={financial.walletAvailableUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: copy.shortfall, value: financial.walletShortfallUsd === null ? t.commercialAdoption.status.NOT_APPLICABLE : <Money value={financial.walletShortfallUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: copy.confirmation, value: financial.canApply ? copy.confirmable : copy.notConfirmable },
    ]} />
  </div>;
}
