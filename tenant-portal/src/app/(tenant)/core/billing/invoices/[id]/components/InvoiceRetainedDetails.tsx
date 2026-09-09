"use client";

import type { ReactNode } from "react";
import { DateTime, DetailSection, IdentifierText, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { BillingBadge } from "../../../../components/BillingBadge";
import { AcceptedPricingDetails } from "../../../../subscription/components/AcceptedPricingDetails";
import type { InvoiceRead } from "../../../invoice-read";

/** Retained evidence only; no current catalogue reconstruction or client-made balance. */
export function InvoiceRetainedDetails({ view }: { view: InvoiceRead }) {
  const { t, lang } = useI18n();
  const copy = t.invoiceEvidence;
  const invoice = view.invoice;
  return <div className="flex min-w-0 flex-col gap-4">
    <DetailSection title={t.coreBilling.invoiceFacts} emptyValueLabel={t.coreBilling.notSet} fields={[
      { label: t.coreBilling.invoicePurpose, value: <BillingBadge kind="InvoicePurpose" value={invoice.purpose} /> },
      { label: t.coreBilling.invoiceIssuedAt, value: invoice.issuedAt ? <DateTime value={invoice.issuedAt} precision="date" /> : null },
      { label: t.coreBilling.invoiceDueAt, value: invoice.dueAt ? <DateTime value={invoice.dueAt} precision="date" /> : null },
      { label: t.coreBilling.invoicePaidAt, value: invoice.paidAt ? <DateTime value={invoice.paidAt} precision="date" /> : null },
      { label: t.coreBilling.invoicePeriod, value: invoice.periodStart && invoice.periodEnd ? <span className="flex flex-wrap gap-1"><DateTime value={invoice.periodStart} precision="date" /><span aria-hidden="true">–</span><DateTime value={invoice.periodEnd} precision="date" /></span> : null },
      { label: t.coreBilling.invoiceSubtotal, value: <Money value={invoice.subtotal} currency={invoice.currencyCode} maximumFractionDigits={4} /> },
      { label: t.coreBilling.invoiceTax, value: <Money value={invoice.taxTotal} currency={invoice.currencyCode} maximumFractionDigits={4} /> },
      { label: t.coreBilling.invoiceTotal, value: <Money value={invoice.total} currency={invoice.currencyCode} maximumFractionDigits={4} /> },
    ]} />
    <DetailSection title={copy.settlement} emptyValueLabel={copy.notRecorded} fields={[
      { label: t.coreBilling.invoiceSubtotal, value: invoice.settlementSubtotalUsd === null ? null : <Money value={invoice.settlementSubtotalUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.coreBilling.invoiceTax, value: invoice.settlementTaxTotalUsd === null ? null : <Money value={invoice.settlementTaxTotalUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.coreBilling.invoiceTotal, value: invoice.settlementTotalUsd === null ? null : <Money value={invoice.settlementTotalUsd} currency="USD" maximumFractionDigits={4} /> },
      { label: t.coreBilling.invoicePaid, value: <Money value={invoice.amountPaidUsd} currency="USD" maximumFractionDigits={4} /> },
    ]} />
    <section className="min-w-0 rounded-md border border-border p-4" aria-label={copy.title}>
      <h2 className="text-sm font-semibold">{copy.title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{copy.notice}</p>
      <ul className="min-w-0 divide-y divide-border">
        {view.lines.map((line) => <li key={line.id} className="min-w-0 space-y-3 py-4">
          <h3 className="break-words text-sm font-medium"><bdi>{line.description}</bdi></h3>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Fact label={t.coreBilling.lineQuantity}>{formatDecimalString(line.quantity, lang, { maximumFractionDigits: 2 })}</Fact>
            <Fact label={t.coreBilling.lineUnitPrice}><Money value={line.unitPrice} currency={invoice.currencyCode} maximumFractionDigits={4} /></Fact>
            <Fact label={t.coreBilling.lineTotal}><Money value={line.lineTotal} currency={invoice.currencyCode} maximumFractionDigits={4} /></Fact>
            {line.sourceKind !== null && <>
              <Fact label={copy.source}>{copy.status[line.sourceKind]}</Fact>
              <Fact label={copy.acceptedSeats}>{formatNumber(line.acceptedSeats, lang)}</Fact>
              <Fact label={copy.parent}><IdentifierText>{line.baseItemId}</IdentifierText></Fact>
              {line.sourceKind === "ADDON" && <>
                <Fact label={copy.selection}><IdentifierText>{line.addonSelectionId}</IdentifierText></Fact>
                <Fact label={copy.definition}><IdentifierText>{line.addonDefinitionVersionId}</IdentifierText></Fact>
              </>}
              <Fact label={copy.cycle}><BillingBadge kind="BillingCycle" value={line.acceptedPricingSnapshot.billingCycle} /></Fact>
              <Fact label={copy.priceRevision}><IdentifierText>{line.acceptedPricingSnapshot.priceRevision}</IdentifierText></Fact>
            </>}
          </dl>
          {line.sourceKind !== null && <AcceptedPricingDetails pricing={line.acceptedPricingSnapshot} />}
        </li>)}
      </ul>
    </section>
  </div>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-normal">{children}</dd></div>;
}
