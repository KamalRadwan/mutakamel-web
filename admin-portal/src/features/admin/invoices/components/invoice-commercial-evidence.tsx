import { Badge, Card } from "@/design-system";
import { INVOICE_COMMERCIAL_COPY } from "../model/invoice-commercial-copy";
import type { InvoiceCommercial, RetainedInvoiceLine } from "../model/invoice-commercial";
import { isRetainedInvoice } from "../model/invoice-commercial";

export function InvoiceCommercialEvidence({ value, lang }: { value: InvoiceCommercial; lang: "ar" | "en" }) {
  const copy = INVOICE_COMMERCIAL_COPY[lang];
  return <Card className="min-w-0 space-y-3 p-4">
    <h2 className="text-base font-semibold">{copy.title}</h2>
    <p className="text-sm text-muted-foreground">{copy.hint}</p>
    {!isRetainedInvoice(value)
      ? <p className="rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{copy.unavailable}</p>
      : <ul className="min-w-0 divide-y divide-border">{value.lines.map(line => <li key={line.id} className="min-w-0 space-y-3 py-3">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="info">{copy.source[line.sourceKind]}</Badge><p className="min-w-0 break-words text-sm font-medium"><bdi>{line.description}</bdi></p></div>
        <dl className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Evidence label={copy.seats} value={String(line.acceptedSeats)} />
          <Evidence label={copy.quantity} value={line.quantity} />
          <Evidence label={`${copy.amount} (${copy.cycle[line.acceptedPricingSnapshot.billingCycle]})`} value={`USD ${line.acceptedPricingSnapshot.recurringAmountUsd}`} />
          <Evidence label={copy.parent} value={line.baseItemId} />
          {line.sourceKind === "ADDON" && <><Evidence label={copy.selection} value={line.addonSelectionId} /><Evidence label={copy.definition} value={line.addonDefinitionVersionId} /></>}
          <Evidence label={copy.priceRevision} value={line.acceptedPricingSnapshot.priceRevision} />
        </dl>
        <RecordedBrackets line={line} lang={lang} />
      </li>)}</ul>}
  </Card>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-md bg-muted px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-mono text-sm"><bdi>{value}</bdi></dd></div>;
}

function RecordedBrackets({ line, lang }: { line: RetainedInvoiceLine; lang: "ar" | "en" }) {
  const copy = INVOICE_COMMERCIAL_COPY[lang];
  return <details className="min-w-0 text-sm">
    <summary className="min-h-11 cursor-pointer rounded-md py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.breakdown}</summary>
    <div className="overflow-x-auto"><table className="w-full text-start text-xs">
      <caption className="sr-only">{copy.breakdown}: {line.description}</caption>
      <thead><tr>{[copy.from, copy.through, copy.charged, copy.unit, copy.lineAmount].map(label => <th key={label} scope="col" className="px-2 py-2 text-start font-semibold">{label}</th>)}</tr></thead>
      <tbody>{line.acceptedPricingSnapshot.breakdown?.map(row => <tr key={row.minUsers} className="border-t border-border">
        {[String(row.minUsers), row.maxUsers === null ? copy.open : String(row.maxUsers), String(row.chargedUsers), row.unitPriceUsd, row.amountUsd].map((value, index) => <td key={index} className="px-2 py-2 font-mono"><bdi>{value}</bdi></td>)}
      </tr>)}</tbody>
    </table></div>
  </details>;
}
