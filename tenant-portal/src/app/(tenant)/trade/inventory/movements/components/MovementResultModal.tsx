"use client";
import { Badge, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatDecimalString } from "@/lib/format/number";
import type { SessionMovementEntry } from "../movements-contract";
import { useMovementModalLabels, type MovementReferences } from "../hooks/useMovementWorkspace";
import { ReservationLedgerQuantities } from "./ReservationLedgerQuantities";
import { MovementLinesReview } from "./MovementLinesReview";

export function MovementResultModal({ target, onClose, references }: { target: SessionMovementEntry; onClose: () => void; references?: MovementReferences }) {
  const { t, lang } = useI18n();
  const labels = useMovementModalLabels(t.common.close);
  const names = { openingBalance: t.tradeInventory.openingBalanceTab, reservation: t.tradeInventory.reservationTab,
    receipt: t.tradeInventory.receiptTab, delivery: t.tradeInventory.deliveryTab };
  return <FormModal open onOpenChange={open => { if (!open) onClose(); }} size={target.lines?.length ? "wide" : "card"} title={names[target.kind]}
    description={target.display?.sourceLabel ?? t.tradeInventory.movementSessionOnly} labels={{ ...labels, cancel: t.common.close }}
    isDirty={false} isSubmitting={false} onSubmit={onClose} hideSubmit titleBadge={<Badge tone="neutral">{t.tradeStatus[target.status]}</Badge>}>
    <dl className="grid gap-4 sm:grid-cols-2 text-sm">
      <div><dt className="text-muted-foreground">{t.tradeInventory.movementNode}</dt><dd>{target.display?.nodeLabel ?? t.common.nameUnavailable}</dd></div>
      <div><dt className="text-muted-foreground">{t.tradeInventory.movementRecordedAt}</dt><dd>{formatDateTime(target.recordedAt, lang)}</dd></div>
      {target.kind === "openingBalance" && target.businessEffectiveAt ? <div><dt className="text-muted-foreground">{t.tradeInventory.businessEffectiveAt}</dt><dd>{formatDateTime(target.businessEffectiveAt, lang)}</dd></div> : null}
      <div><dt className="text-muted-foreground">{t.tradeInventory.movementResult}</dt><dd>{target.summary}</dd></div>
      {target.reservation?.requestedQuantity && <div><dt className="text-muted-foreground">{t.tradeInventory.movementRequested}</dt><dd><bdi>{formatDecimalString(target.reservation.requestedQuantity, lang, { maximumFractionDigits: 8 })}</bdi></dd></div>}
      {target.reservation && <div><dt className="text-muted-foreground">{t.tradeInventory.reserved}</dt><dd><bdi>{formatDecimalString(target.reservation.quantity, lang, { maximumFractionDigits: 8 })}</bdi></dd></div>}
      {target.reservation?.backorderedQuantity && <div><dt className="text-muted-foreground">{t.tradeInventory.movementBackordered}</dt><dd><bdi>{formatDecimalString(target.reservation.backorderedQuantity, lang, { maximumFractionDigits: 8 })}</bdi></dd></div>}
    </dl>
    {target.reservation && <ReservationLedgerQuantities reservation={target.reservation} />}
    {target.stale ? <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{t.tradeInventory.movementStaleHandle}</p> : null}
    <MovementLinesReview target={target} references={references} />
    <p className="text-sm text-muted-foreground">{t.tradeInventory.movementSessionOnly}</p>
  </FormModal>;
}
