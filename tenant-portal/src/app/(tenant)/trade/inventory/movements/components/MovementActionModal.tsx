"use client";
import { Button, Field, FormModal, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import type { useInventoryMovements } from "../hooks/useInventoryMovements";
import { useMovementActionDraft } from "../hooks/useMovementActionDraft";
import { useMovementModalLabels, type MovementDialog, type MovementReferences } from "../hooks/useMovementWorkspace";
import { movementRemainingQuantity, type SessionMovementEntry } from "../movements-contract";
import { SerialKeysField } from "./SerialKeysField";
import { MovementRetry } from "./MovementRetry";
import { MovementLinesReview } from "./MovementLinesReview";

export function MovementActionModal({ target, mode, controller, onClose, references }: {
  target: SessionMovementEntry; mode: MovementDialog["mode"];
  controller: ReturnType<typeof useInventoryMovements>; onClose: (completed?: boolean) => void;
  references?: MovementReferences;
}) {
  const { t, lang } = useI18n();
  const draft = useMovementActionDraft(target, mode, controller, onClose);
  const release = mode === "release";
  const reverse = mode === "reverse";
  const title = release ? t.tradeInventory.releaseTitle : reverse
    ? target.kind === "receipt" ? t.tradeInventory.reverseReceipt : t.tradeInventory.reverseDelivery
    : target.kind === "receipt" ? t.tradeInventory.postReceipt : t.tradeInventory.postDelivery;
  const labels = useMovementModalLabels(title);
  return <FormModal open onOpenChange={open => { if (!open) onClose(); }} size={reverse || mode === "post" ? "wide" : "card"}
    title={title} description={target.display?.sourceLabel ?? t.tradeInventory.movementSessionOnly}
    labels={labels} isDirty={draft.dirty} isSubmitting={controller.pending !== null}
    footerLeading={<MovementRetry retry={controller.hasUnresolvedWrite ? controller.retryUnresolved : undefined} pending={controller.pending !== null} onComplete={onClose} />}
    error={controller.formError ?? undefined} onSubmit={() => { void draft.submit(); }}>
    <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm">{target.display?.nodeLabel ?? t.common.nameUnavailable}</p>
    {mode === "post" ? <MovementLinesReview target={target} references={references} /> : null}
    {release && <>
      <p className="text-sm">{t.tradeInventory.reservationRemainingQuantity}: <bdi>{formatDecimalString(target.reservation?.remainingQuantity ?? "0", lang, { maximumFractionDigits: 8 })}</bdi></p>
      <Field label={t.tradeInventory.quantity} showLabel hint={t.tradeInventory.releaseQuantityHint} error={draft.fieldErrors.quantity}>
        <Input value={draft.quantity} inputMode="decimal" disabled={controller.pending !== null} onChange={event => draft.setQuantity(event.target.value)} />
      </Field>
      {!!target.serialKeys?.length && <SerialKeysField value={draft.serials} quantity={draft.quantity} subset error={draft.fieldErrors.serials} disabled={controller.pending !== null} onChange={draft.setSerials} />}
    </>}
    {(reverse || release) && <Field label={t.tradeInventory.reasonCode} showLabel required={reverse} hint={t.tradeInventory.movementReasonHint} error={draft.fieldErrors.reason}>
      <Input value={draft.reason} maxLength={80} disabled={controller.pending !== null} onChange={event => draft.setReason(event.target.value)} />
    </Field>}
    {reverse && <>
      <div className="flex flex-col gap-2">
        {(target.lines ?? []).map((line, index) => <div key={line.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <p className="mb-2 font-medium">{target.display?.lineLabels?.[index] || t.tradeInventory.movementLineNumber.replace("{number}", String(index + 1))}</p>
          <dl className="grid grid-cols-3 gap-3">
            <div><dt className="text-muted-foreground">{t.tradeInventory.movementOriginalQuantity}</dt><dd><bdi>{formatDecimalString(line.quantity, lang, { maximumFractionDigits: 8 })}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{t.tradeInventory.movementAlreadyReversed}</dt><dd><bdi>{formatDecimalString(line.reversedQuantity ?? "0", lang, { maximumFractionDigits: 8 })}</bdi></dd></div>
            <div><dt className="text-muted-foreground">{t.tradeInventory.movementReversibleQuantity}</dt><dd><bdi>{formatDecimalString(movementRemainingQuantity(line.quantity, line.reversedQuantity ?? "0"), lang, { maximumFractionDigits: 8 })}</bdi></dd></div>
          </dl>
        </div>)}
      </div>
      <Field label={t.tradeInventory.reversalEffectiveAt} showLabel required error={draft.fieldErrors.effectiveAt}>
        <Input type="datetime-local" value={draft.effectiveAt} disabled={controller.pending !== null} onChange={event => draft.setEffectiveAt(event.target.value)} />
      </Field>
      <p className="text-sm text-muted-foreground">{t.tradeInventory.movementFullReversalHint}</p>
      <Field label={t.tradeInventory.movementSourceLine} showLabel>
        <NameSelect value={undefined} options={(target.lines ?? []).map((line, index) => ({ value: line.id,
          label: target.display?.lineLabels?.[index] || t.tradeInventory.movementLineNumber.replace("{number}", String(index + 1)) }))
          .filter(line => !draft.lines.some(selected => selected.lineId === line.value))}
          placeholder={t.tradeInventory.addReversalLine} onValueChange={draft.add} disabled={controller.pending !== null} />
      </Field>
      {draft.lines.map((line, index) => <div key={line.lineId} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
        <Field label={target.display?.lineLabels?.[target.lines?.findIndex(known => known.id === line.lineId) ?? index] || t.tradeInventory.movementLineNumber.replace("{number}", String(index + 1))} showLabel required error={draft.fieldErrors.lines[line.lineId]?.quantity}>
          <Input value={line.quantity} inputMode="decimal" disabled={controller.pending !== null} onChange={event => draft.change(line.lineId, { quantity: event.target.value })} />
        </Field>
        {(target.lines?.find(known => known.id === line.lineId)?.serialKeys.length ?? 0) > 0 && <SerialKeysField value={line.serialKeys} quantity={line.quantity} subset error={draft.fieldErrors.lines[line.lineId]?.serials}
          disabled={controller.pending !== null} onChange={serialKeys => draft.change(line.lineId, { serialKeys })} />}
        <Button type="button" variant="ghost" size="sm" onClick={() => draft.remove(line.lineId)} disabled={controller.pending !== null}>{t.tradeInventory.removeLine}</Button>
      </div>)}
    </>}
    <p className="text-sm text-muted-foreground">{reverse ? target.kind === "delivery" ? t.tradeInventory.movementDeliveryReversalHint : t.tradeInventory.movementReceiptReversalHint
      : release ? t.tradeInventory.movementReleaseHint : t.tradeInventory.movementPostingHint}</p>
  </FormModal>;
}
