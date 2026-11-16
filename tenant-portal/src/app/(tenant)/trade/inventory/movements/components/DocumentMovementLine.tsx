"use client";
import { Trash2 } from "lucide-react";
import { Button, Combobox, Field, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { SessionMovementEntry } from "../movements-contract";
import type { useDocumentMovementDraft } from "../hooks/useDocumentMovementDraft";
import type { MovementReferences } from "../hooks/useMovementWorkspace";
import { MovementTrackingFields } from "./MovementTrackingFields";

export function DocumentMovementLine({ draft, index, refs, disabled, isDelivery, reservations }: {
  draft: ReturnType<typeof useDocumentMovementDraft>; index: number; refs: MovementReferences;
  disabled: boolean; isDelivery: boolean; reservations: SessionMovementEntry[];
}) {
  const { t } = useI18n();
  const line = draft.values.lines[index];
  const item = draft.items[line.sourceLineId];
  const sourceLine = draft.sources.source?.lines.find(source => source.id === line.sourceLineId);
  const fieldError = (field: string) => draft.fieldErrors[`lines.${index}.${field}`];
  const eligibleReservations = reservations.filter(entry => entry.kind === "reservation" && !entry.stale &&
    entry.sourceDocumentId === draft.sources.source?.id && entry.sourceLineId === line.sourceLineId &&
    entry.nodeId === draft.values.nodeId && ["ACTIVE", "PARTIALLY_RELEASED", "PARTIALLY_CONSUMED"].includes(entry.status));
  return <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium">{t.tradeInventory.movementLineNumber.replace("{number}", String(index + 1))}</h3>
      <Button type="button" size="sm" variant="ghost" disabled={disabled || draft.values.lines.length <= 1} onClick={() => draft.remove(index)}>
        <Trash2 className="size-4" aria-hidden="true" />{t.tradeInventory.removeLine}
      </Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t.tradeInventory.movementSourceLine} showLabel required error={fieldError("sourceLineId")}>
        <NameSelect value={line.sourceLineId || undefined} options={(draft.sources.source?.lines ?? []).map((source, position) => ({
          value: source.id, label: source.label || t.tradeInventory.movementLineNumber.replace("{number}", String(position + 1)),
          disabled: draft.values.lines.some((other, otherIndex) => otherIndex !== index && other.sourceLineId === source.id),
        }))} placeholder={t.tradeInventory.movementChooseLine} disabled={disabled || !draft.sources.source} onValueChange={id => draft.selectLine(index, id)} />
      </Field>
      <Field label={t.tradeInventory.movementItem} showLabel required error={fieldError("itemId")} hint={t.tradeInventory.movementMatchSourceItem}>
        <Combobox value={item?.id} selectedLabel={item ? `${item.name} · ${item.code}` : undefined}
          options={refs.items.map(item => ({ value: item.id, label: item.name, description: item.code }))} onSearch={refs.searchItems}
          onValueChange={id => { void draft.selectItem(line.sourceLineId, id); }} placeholder={t.tradeInventory.movementChooseItem}
          searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData}
          disabled={disabled || !sourceLine || !refs.canCatalog} loading={draft.loading}
          errorContent={refs.itemError ? <div role="alert" className="flex flex-col gap-2 p-3 text-sm text-destructive"><p>{t.tradeInventory.movementReferencesFailed}</p><Button type="button" variant="outline" size="sm" onClick={refs.refresh}>{t.common.retry}</Button></div> : undefined} />
      </Field>
      <Field label={t.tradeInventory.movementUnit} showLabel error={fieldError("uomId")}><Input readOnly value={line.uomId ? refs.uomLabel(line.uomId) : ""} /></Field>
      <Field label={t.tradeInventory.quantity} showLabel required error={fieldError("quantity")} hint={t.tradeCommon.decimalHint}>
        <Input value={line.quantity} inputMode="decimal" disabled={disabled} onChange={event => draft.changeLine(index, { quantity: event.target.value })} />
      </Field>
      {isDelivery && <Field label={t.tradeInventory.reservationTab} showLabel required={item?.trackingMode === "SERIAL"} error={fieldError("reservationId")} hint={t.tradeInventory.movementReservationHint}>
        <NameSelect value={line.reservationId || "unreserved"} options={[
          { value: "unreserved", label: t.tradeInventory.movementUnreserved },
          ...eligibleReservations.map(entry => ({ value: entry.id, label: `${entry.display?.sourceLabel ?? t.tradeInventory.reservationTab} · ${entry.display?.itemLabel ?? t.tradeInventory.movementItem}` })),
        ]} placeholder={t.tradeInventory.reservationTab} disabled={disabled}
          onValueChange={id => draft.changeLine(index, { reservationId: id === "unreserved" ? "" : id })} />
      </Field>}
    </div>
    <MovementTrackingFields mode={item?.trackingMode ?? null} values={line} disabled={disabled}
      onChange={patch => draft.changeLine(index, patch)} expiry={!isDelivery}
      errors={{ lotKey: fieldError("lotKey"), serialKeys: fieldError("serialKeys"), expiresAt: fieldError("expiresAt") }} />
  </section>;
}
