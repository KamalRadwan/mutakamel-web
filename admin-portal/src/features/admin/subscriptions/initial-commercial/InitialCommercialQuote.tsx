"use client";
import type { AcceptedPricing } from "@/shared/api/accepted-pricing";
import type { InitialQuoteView, OriginalInitialSeedReceipt } from "../initial-commercial-readers";
import type { InitialCommercialCopy } from "./initial-commercial-copy";

export function InitialCommercialQuote({ quote, expired, copy }: { quote: InitialQuoteView; expired: boolean; copy: InitialCommercialCopy }) {
  return <section aria-label={copy.quote} className="min-w-0 space-y-3 rounded-md border border-border p-3">
    {expired && <p role="alert" className="text-sm text-warning-subtle-foreground">{copy.expired}</p>}
    <p className="break-all text-xs">{copy.quoteId}: <bdi className="font-mono">{quote.quoteId}</bdi></p>
    <p className="text-xs">{copy.expires}: <time dateTime={quote.expiresAt}><bdi>{quote.expiresAt}</bdi></time></p>
    <p className="text-xs">{copy.resolvedTrial}: <bdi>{quote.resolvedTrialDays}</bdi></p>
    <Totals totals={quote.totals} copy={copy} />
    <p className="text-xs text-muted-foreground">{copy.allowance}</p>
    {quote.items.map(item => <section key={item.selectionKey} className="min-w-0 space-y-2 rounded-md border border-border p-3">
      <p className="break-all text-xs">{copy.application}: <bdi className="font-mono">{item.applicationId}</bdi> · {copy.seats}: <bdi>{item.seats}</bdi></p>
      <Breakdown pricing={item.acceptedPricing} copy={copy} />
      {item.addons.map(addon => <section key={addon.selectionKey} className="min-w-0 space-y-2 border-s-2 border-border ps-3">
        <p className="break-all text-xs">{copy.addon}: <bdi className="font-mono">{addon.addonId}</bdi> · {copy.seats}: <bdi>{addon.seats}</bdi></p>
        <Breakdown pricing={addon.acceptedPricing} copy={copy} />
      </section>)}
    </section>)}
  </section>;
}

function Totals({ totals, copy }: { totals: InitialQuoteView["totals"]; copy: InitialCommercialCopy }) {
  return <dl className="grid gap-3 sm:grid-cols-3">{[[copy.base, totals.baseRecurringUsd], [copy.addons, totals.addonRecurringUsd], [copy.combined, totals.combinedRecurringUsd]].map(([label, value]) =>
    <div key={label} className="rounded-md bg-muted p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm"><bdi>{value}</bdi></dd></div>)}</dl>;
}
function Breakdown({ pricing, copy }: { pricing: AcceptedPricing; copy: InitialCommercialCopy }) {
  return <div className="space-y-2"><p className="font-mono text-sm"><bdi>USD {pricing.recurringAmountUsd}</bdi></p>
    <details className="text-xs"><summary className="cursor-pointer rounded-sm py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.brackets}</summary>
      <div className="overflow-x-auto"><table className="w-full text-start"><thead><tr>{[copy.from, copy.through, copy.charged, copy.unit, copy.amount].map(label =>
        <th key={label} scope="col" className="px-2 py-2 text-start font-medium">{label}</th>)}</tr></thead>
        <tbody>{pricing.breakdown?.map(row => <tr key={row.minUsers} className="border-t border-border">{[String(row.minUsers), row.maxUsers === null ? copy.open : String(row.maxUsers), String(row.chargedUsers), row.unitPriceUsd, row.amountUsd].map((value, index) =>
          <td key={index} className="whitespace-nowrap px-2 py-2 font-mono"><bdi>{value}</bdi></td>)}</tr>)}</tbody></table></div>
    </details></div>;
}

export function InitialCommercialReceipt({ receipt, copy }: { receipt: OriginalInitialSeedReceipt; copy: InitialCommercialCopy }) {
  return <section aria-label={copy.original} className="min-w-0 space-y-3 rounded-md border border-border p-3">
    <h3 className="text-sm font-semibold">{copy.original}</h3><p role="status" className="text-sm text-muted-foreground">{copy.originalWarning}</p>
    <dl className="space-y-2 text-xs">{[[copy.command, receipt.commandId], [copy.subscription, receipt.subscriptionId], [copy.originalStatus, receipt.status],
      [copy.originalPeriod, `${receipt.trialStartedAt} – ${receipt.trialEndsAt}`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="break-all font-mono"><bdi>{value}</bdi></dd></div>)}</dl>
    <Totals totals={receipt.totals} copy={copy} />
  </section>;
}
