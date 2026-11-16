"use client";
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString, formatNumber } from "@/lib/format/number";
import { formatDateTime } from "@/lib/format/date";
import type { MovementReferences } from "../hooks/useMovementWorkspace";
import type { SessionMovementEntry } from "../movements-contract";
import { useMovementLinesReview } from "../hooks/useMovementLinesReview";

/** Review the returned document lines; normalization is never calculated or inferred here. */
export function MovementLinesReview({ target, references }: { target: SessionMovementEntry; references?: MovementReferences }) {
  const { t, lang } = useI18n();
  const inv = t.tradeInventory;
  const { formatExpiry } = useMovementLinesReview(target, references);
  const unit = (id?: string) => id ? references?.uomLabel(id) ?? t.common.nameUnavailable : t.common.nameUnavailable;
  const quantity = (value: string) => formatDecimalString(value, lang, { maximumFractionDigits: 8 });
  if (!target.lines?.length) return null;
  return <div className="flex flex-col gap-3">
    {target.businessEffectiveAt ? <p className="text-sm"><span className="text-muted-foreground">{inv.businessEffectiveAt}: </span>{formatDateTime(target.businessEffectiveAt, lang)}</p> : null}
    {references?.uomError ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p>{inv.movementReferencesFailed}</p><Button type="button" size="sm" variant="outline" onClick={references.refresh}>{t.common.retry}</Button>
    </div> : null}
    {target.lines.map((line, index) => <section key={line.id} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">{line.descriptionSnapshot || target.display?.lineLabels?.[index] || inv.movementLineNumber.replace("{number}", formatNumber(index + 1, lang))}</h3>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{inv.movementOriginalQuantity}</dt><dd><bdi>{quantity(line.quantity)}</bdi> {unit(line.uomId)}</dd></div>
        <div><dt className="text-muted-foreground">{inv.movementBaseQuantity}</dt><dd>{line.normalizedQuantity !== undefined ? <><bdi>{quantity(line.normalizedQuantity)}</bdi> {unit(line.normalizedUomId)}</> : t.tradeCommon.notSet}</dd></div>
        {line.reversedQuantity !== undefined && <div><dt className="text-muted-foreground">{inv.movementAlreadyReversed}</dt><dd><bdi>{quantity(line.reversedQuantity)}</bdi> {unit(line.uomId)}</dd></div>}
        {line.normalizedReversedQuantity !== undefined && <div><dt className="text-muted-foreground">{inv.movementBaseReversedQuantity}</dt><dd><bdi>{quantity(line.normalizedReversedQuantity)}</bdi> {unit(line.normalizedUomId)}</dd></div>}
        {line.lotKey && <div><dt className="text-muted-foreground">{inv.lotKey}</dt><dd><bdi dir="ltr">{line.lotKey}</bdi></dd></div>}
        {line.expiryDate && <div><dt className="text-muted-foreground">{inv.trackingExpiryDate}</dt><dd><bdi>{formatExpiry(line.expiryDate)}</bdi></dd></div>}
      </dl>
      {target.kind === "delivery" && line.reservationId !== undefined ? <Badge tone="neutral">{line.reservationId ? inv.movementLinkedReservation : inv.movementUnreserved}</Badge> : null}
      {line.serialKeys.length > 0 ? <Collapsible>
        <CollapsibleTrigger className="text-sm text-primary underline underline-offset-4">{inv.serialKeysLabel} ({formatNumber(line.serialKeys.length, lang)})</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-card p-2">
          <ul className="space-y-1 text-sm">{line.serialKeys.map(serial => <li key={serial}><bdi dir="ltr">{serial}</bdi></li>)}</ul>
        </CollapsibleContent>
      </Collapsible> : null}
    </section>)}
  </div>;
}
