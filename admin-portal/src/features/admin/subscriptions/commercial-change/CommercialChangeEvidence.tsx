import { Badge, Card } from "@/design-system";
import type { AcceptedPricing } from "@/shared/api/accepted-pricing";
import type { CommercialApplyReceipt, CommercialOperationReceipt, CommercialPreview } from "./commercial-change-readers";
import { commercialChangeCopy, type CommercialChangeCopy } from "./commercial-change-copy";

/** Read-only views; the owning workspace controls context, expiry and commands. */
export function CommercialPreviewEvidence({ value, lang, expired, labels = {} }: {
  value: CommercialPreview; lang: string; expired: boolean; labels?: Readonly<Record<string, string>>;
}) {
  const copy = commercialChangeCopy(lang);
  const financial = value.financial;
  return <Card className="min-w-0 space-y-4 p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
    <h3 className="text-sm font-semibold">{copy.review}</h3>
    <Facts values={[[copy.recurringBefore, `USD ${financial.previousRecurringUsd}`], [copy.recurringAfter, `USD ${financial.nextRecurringUsd}`],
      [copy.fullDelta, `USD ${financial.fullPeriodDeltaUsd}`], [copy.settlement, `${copy[financial.direction]} · USD ${financial.proratedAmountUsd}`],
      [copy.wallet, copy[financial.walletStatus]], [copy.available, `USD ${financial.walletAvailableUsd}`], [copy.shortfall, `USD ${financial.walletShortfallUsd}`]]} />
    <p className="text-xs text-muted-foreground">{copy.expires}: <time dateTime={value.expiresAt}><bdi>{value.expiresAt}</bdi></time></p>
    {expired && <p role="alert" className="rounded-md bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{copy.expired}</p>}
    {!financial.canApply && <p role="status" className="text-sm text-muted-foreground">{copy.cannotApply}</p>}
    <ol className="space-y-3">{value.changes.map(item => <li key={item.selectionKey} className="min-w-0 space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="info">{copy[item.operation]}</Badge><h4 className="break-all text-sm font-medium"><bdi>{labels[item.selectionKey] ?? `${copy[item.sourceKind]} · ${item.addonId ?? item.applicationId}`}</bdi></h4></div>
      <div className="grid gap-3 lg:grid-cols-2">
        <PriceEvidence title={copy.before} pricing={item.acceptedPricingBefore} seats={item.fromSeats} reference={item.fromTierId ?? item.fromDefinitionVersionId}
          referenceLabel={item.sourceKind === "APPLICATION" ? copy.tier : copy.definition} copy={copy} />
        <PriceEvidence title={copy.after} pricing={item.acceptedPricingAfter} seats={item.toSeats} reference={item.toTierId ?? item.toDefinitionVersionId}
          referenceLabel={item.sourceKind === "APPLICATION" ? copy.tier : copy.definition} copy={copy} />
      </div>
      <Facts values={[[copy.fullDelta, `USD ${item.fullPeriodDeltaUsd}`], [copy.settlement, `USD ${item.proratedAllocationUsd}`]]} />
    </li>)}</ol>
    <References copy={copy} values={[[copy.preview, value.previewId], [copy.operation, value.operationId], [copy.preparation, value.preparation.preparationId], [copy.revision, value.subscriptionRevision]]} />
  </Card>;
}

function PriceEvidence({ title, pricing, seats, reference, referenceLabel, copy }: {
  title: string; pricing: AcceptedPricing | null; seats: number | null; reference: string | null; referenceLabel: string; copy: CommercialChangeCopy;
}) {
  return <section className="min-w-0 space-y-2 rounded-md bg-muted p-3"><h5 className="text-xs font-semibold">{title}</h5>
    {!pricing ? <p className="text-sm text-muted-foreground">{copy.noSelection}</p> : <>
      <p className="font-mono text-sm"><bdi>USD {pricing.recurringAmountUsd}</bdi></p>
      <p className="text-xs">{copy.seats}: <bdi>{seats}</bdi></p>
      <p className="break-all text-xs text-muted-foreground">{referenceLabel}: <bdi className="font-mono">{reference}</bdi></p>
      <details className="text-xs"><summary className="min-h-11 cursor-pointer rounded-sm py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.brackets}</summary>
        <p className="break-all py-2 text-muted-foreground">{copy.priceRevision}: <bdi className="font-mono">{pricing.priceRevision}</bdi></p>
        <div className="overflow-x-auto"><table className="w-full text-start"><thead><tr>{[copy.from, copy.through, copy.charged, copy.unit, copy.amount].map(label =>
          <th key={label} scope="col" className="whitespace-nowrap px-2 py-2 text-start font-medium">{label}</th>)}</tr></thead>
          <tbody>{pricing.breakdown.map(row => <tr key={row.minUsers} className="border-t border-border">{[String(row.minUsers), row.maxUsers === null ? copy.open : String(row.maxUsers), String(row.chargedUsers), row.unitPriceUsd, row.amountUsd].map((amount, index) =>
            <td key={index} className="whitespace-nowrap px-2 py-2 font-mono"><bdi>{amount}</bdi></td>)}</tr>)}</tbody></table></div>
      </details>
    </>}
  </section>;
}

export function CommercialReceiptEvidence({ value, lang }: { value: CommercialApplyReceipt; lang: string }) {
  const copy = commercialChangeCopy(lang);
  return <Card className="min-w-0 space-y-4 p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
    <h3 className="text-sm font-semibold">{copy.receipt}</h3><p className="text-sm text-muted-foreground">{copy.original}</p>
    <Facts values={[[copy.base, `USD ${value.totals.baseRecurringUsd}`], [copy.addons, `USD ${value.totals.addonRecurringUsd}`], [copy.combined, `USD ${value.totals.combinedRecurringUsd}`],
      [copy.settlement, value.settlement ? `${copy[value.settlement.direction]} · USD ${value.settlement.amountUsd}` : copy.NONE],
      ...(value.settlement ? [[copy.balance, `USD ${value.settlement.balanceAfterUsd}`] as const] : []), [copy.projection, copy.PENDING]]} />
    <p className="text-xs text-muted-foreground">{copy.appliedAt}: <time dateTime={value.appliedAt}><bdi>{value.appliedAt}</bdi></time></p>
    <ul className="divide-y divide-border rounded-md border border-border">{value.changes.map(item => <li key={item.selectionKey} className="space-y-1 p-3">
      <p className="text-sm">{copy[item.operation]} · {copy[item.sourceKind]}</p><p className="break-all text-xs text-muted-foreground">{copy.selection}: <bdi className="font-mono">{item.selectionId}</bdi></p>
    </li>)}</ul>
    <References copy={copy} values={[[copy.preview, value.previewId], [copy.operation, value.operationId], [copy.preparation, value.projection.preparationId], [copy.revision, value.subscriptionRevision]]} />
  </Card>;
}

export function CommercialOperationEvidence({ value, lang }: { value: CommercialOperationReceipt; lang: string }) {
  const copy = commercialChangeCopy(lang);
  return <Card className="min-w-0 space-y-3 p-4" dir={lang === "ar" ? "rtl" : "ltr"}>
    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{copy.progress}</h3><Badge tone="info">{copy[value.state]}</Badge></div>
    <p className="text-sm text-muted-foreground">{copy.progressNotice}</p>
    <Facts values={[[copy.projection, value.projectionState === "READY" ? copy.projectionReady : copy[value.projectionState]],
      ...(value.safeReasonCode ? [[copy.reason, value.safeReasonCode] as const] : []), ...(value.retryAfterSeconds !== null ? [[copy.recheck, String(value.retryAfterSeconds)] as const] : [])]} />
    <p className="text-xs text-muted-foreground">{copy.updated}: <time dateTime={value.updatedAt}><bdi>{value.updatedAt}</bdi></time></p>
    <References copy={copy} values={[[copy.preparation, value.operationId], [copy.operationRevision, value.operationRevision], [copy.phase, value.phase], ...(value.relatedPreviewId ? [[copy.preview, value.relatedPreviewId] as const] : [])]} />
  </Card>;
}

function Facts({ values }: { values: ReadonlyArray<readonly [string, string]> }) {
  return <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{values.map(([label, value]) => <div key={label} className="min-w-0 rounded-md border border-border p-3">
    <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd>
  </div>)}</dl>;
}
function References({ copy, values }: { copy: CommercialChangeCopy; values: ReadonlyArray<readonly [string, string]> }) {
  return <details className="text-xs"><summary className="min-h-11 cursor-pointer rounded-sm py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.references}</summary>
    <dl className="space-y-2 pt-2">{values.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-mono"><bdi>{value}</bdi></dd></div>)}</dl>
  </details>;
}
