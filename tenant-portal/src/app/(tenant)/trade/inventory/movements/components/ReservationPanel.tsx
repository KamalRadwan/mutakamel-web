"use client";
import { Lock } from "lucide-react";
import { Button, Combobox, Field, FormModal, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ReservationFormValues } from "../movements-contract";
import { useReservationDraft } from "../hooks/useReservationDraft";
import { useMovementModalLabels, type MovementReferences } from "../hooks/useMovementWorkspace";
import { MovementSourcePicker } from "./MovementSourcePicker";
import { MovementTrackingFields } from "./MovementTrackingFields";
import { MovementRetry } from "./MovementRetry";

export function ReservationPanel({ onSubmit, pending, error, refs, headers, canReadSource, onClose, retry }: {
  onSubmit: (values: ReservationFormValues) => Promise<boolean>; pending: boolean; error: string | null;
  refs: MovementReferences; headers: Record<string, string>; canReadSource: boolean; onClose: (completed?: boolean) => void;
  retry?: () => Promise<boolean>;
}) {
  const { t } = useI18n();
  const draft = useReservationDraft(refs, headers, canReadSource);
  const { values } = draft;
  const labels = useMovementModalLabels(t.tradeInventory.submitReservation);
  return <FormModal open onOpenChange={open => { if (!open) onClose(); }} size="wide"
    title={t.tradeInventory.submitReservation} description={t.tradeInventory.reservationFormHint}
    headerIcon={<Lock className="size-5" aria-hidden="true" />} labels={labels} isDirty={draft.dirty}
    isSubmitting={pending} error={error ?? draft.error ?? undefined}
    footerLeading={<MovementRetry retry={retry} pending={pending} onComplete={onClose} />}
    submitDisabled={draft.item?.trackInventory === false || draft.loadingItem || draft.sources.loading || !refs.canNodes || !canReadSource}
    onSubmit={() => { if (draft.validate()) void onSubmit(draft.submission()).then(saved => { if (saved) onClose(true); }); }}>
    <MovementSourcePicker sources={draft.sources} isPurchase={false} disabled={pending || !canReadSource} onSelect={draft.selectSource} error={draft.fieldErrors.sourceDocumentId} />
    {!canReadSource && <p className="text-sm text-muted-foreground">{t.tradeInventory.movementSourcePermission}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.tradeInventory.movementSourceLine} showLabel required error={draft.fieldErrors.sourceLineId}>
        <NameSelect value={values.sourceLineId || undefined} options={(draft.sources.source?.lines ?? []).map((line, index) =>
          ({ value: line.id, label: line.label || t.tradeInventory.movementLineNumber.replace("{number}", String(index + 1)) }))}
          placeholder={t.tradeInventory.movementChooseLine} onValueChange={draft.selectLine} disabled={pending || !draft.sources.source} />
      </Field>
      <Field label={t.tradeInventory.movementNode} showLabel required error={draft.fieldErrors.nodeId}>
        <NameSelect value={values.nodeId || undefined} options={refs.nodes.filter(node => node.status === "ACTIVE").map(node => ({ value: node.id, label: `${node.name} · ${node.code}` }))}
          placeholder={t.tradeInventory.movementChooseNode} onValueChange={nodeId => draft.set({ nodeId })} disabled={pending || !refs.canNodes} />
      </Field>
      <Field label={t.tradeInventory.movementItem} showLabel required error={draft.fieldErrors.itemId} hint={t.tradeInventory.movementMatchSourceItem}>
        <Combobox value={values.itemId || undefined} selectedLabel={values.itemId ? refs.itemLabel(values.itemId) : undefined}
          options={refs.items.map(item => ({ value: item.id, label: item.name, description: item.code }))} onSearch={refs.searchItems}
          onValueChange={id => { void draft.selectItem(id); }} placeholder={t.tradeInventory.movementChooseItem}
          searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData}
          loading={draft.loadingItem} disabled={pending || !draft.line || !refs.canCatalog}
          errorContent={refs.itemError ? <div role="alert" className="flex flex-col gap-2 p-3 text-sm text-destructive"><p>{t.tradeInventory.movementReferencesFailed}</p><Button type="button" variant="outline" size="sm" onClick={refs.refresh}>{t.common.retry}</Button></div> : undefined} />
      </Field>
      <Field label={t.tradeInventory.movementUnit} showLabel error={draft.fieldErrors.uomId}><Input readOnly value={values.uomId ? refs.uomLabel(values.uomId) : ""} /></Field>
      <Field label={t.tradeInventory.quantity} showLabel required error={draft.fieldErrors.quantity} hint={t.tradeCommon.decimalHint}>
        <Input value={values.quantity} inputMode="decimal" disabled={pending} onChange={event => draft.set({ quantity: event.target.value })} />
      </Field>
      <Field label={t.tradeInventory.reservationExpiryField} showLabel error={draft.fieldErrors.expiresAt}>
        <Input type="datetime-local" value={values.expiresAt ?? ""} disabled={pending} onChange={event => draft.set({ expiresAt: event.target.value })} />
      </Field>
    </div>
    <MovementTrackingFields mode={draft.item?.trackingMode ?? null} values={values} disabled={pending} onChange={draft.set} errors={draft.fieldErrors} />
    <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{t.tradeInventory.movementPolicyHint}</p>
  </FormModal>;
}
