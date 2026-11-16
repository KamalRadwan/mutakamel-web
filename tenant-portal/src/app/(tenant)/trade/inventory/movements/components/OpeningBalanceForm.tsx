"use client";
import { Boxes } from "lucide-react";
import { Button, Combobox, Field, FormModal, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { OpeningBalanceFormValues } from "../movements-contract";
import { useOpeningBalanceDraft } from "../hooks/useOpeningBalanceDraft";
import { useMovementModalLabels, type MovementReferences } from "../hooks/useMovementWorkspace";
import { MovementTrackingFields } from "./MovementTrackingFields";
import { MovementRetry } from "./MovementRetry";

export function OpeningBalanceForm({ onSubmit, isPending, error, refs, onClose, retry }: {
  onSubmit: (values: OpeningBalanceFormValues) => Promise<boolean>;
  isPending: boolean; error: string | null; refs: MovementReferences; onClose: (completed?: boolean) => void;
  retry?: () => Promise<boolean>;
}) {
  const { t } = useI18n();
  const draft = useOpeningBalanceDraft(refs);
  const { values } = draft;
  const labels = useMovementModalLabels(t.tradeInventory.submitOpeningBalance);
  return <FormModal open onOpenChange={open => { if (!open) onClose(); }} size="wide"
    title={t.tradeInventory.submitOpeningBalance} description={t.tradeInventory.openingBalancePeriodHint}
    headerIcon={<Boxes className="size-5" aria-hidden="true" />} labels={labels}
    isDirty={draft.dirty} isSubmitting={isPending} error={error ?? draft.error ?? undefined}
    footerLeading={<MovementRetry retry={retry} pending={isPending} onComplete={onClose} />}
    submitDisabled={draft.loadingItem || draft.item?.trackInventory === false || !refs.canCatalog || !refs.canNodes}
    onSubmit={() => { if (draft.validate()) void onSubmit(draft.submission()).then(saved => { if (saved) onClose(true); }); }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.tradeInventory.movementNode} showLabel required error={draft.fieldErrors.nodeId}>
        <NameSelect value={values.nodeId || undefined} options={refs.nodes.filter(node => node.status === "ACTIVE").map(node => ({ value: node.id, label: `${node.name} · ${node.code}` }))}
          placeholder={t.tradeInventory.movementChooseNode} disabled={isPending || !refs.canNodes} onValueChange={nodeId => draft.set({ nodeId })} />
      </Field>
      <Field label={t.tradeInventory.movementItem} showLabel required error={draft.fieldErrors.itemId}>
        <Combobox value={values.itemId || undefined} selectedLabel={values.itemId ? refs.itemLabel(values.itemId) : undefined}
          options={refs.items.map(item => ({ value: item.id, label: item.name, description: item.code }))}
          onSearch={refs.searchItems} onValueChange={id => { void draft.selectItem(id); }}
          placeholder={t.tradeInventory.movementChooseItem} searchPlaceholder={t.common.search} loadingLabel={t.common.loading}
          emptyLabel={t.common.noData} loading={refs.isLoading || draft.loadingItem} disabled={isPending || !refs.canCatalog}
          errorContent={refs.itemError ? <div role="alert" className="flex flex-col gap-2 p-3 text-sm text-destructive"><p>{t.tradeInventory.movementReferencesFailed}</p><Button type="button" variant="outline" size="sm" onClick={refs.refresh}>{t.common.retry}</Button></div> : undefined} />
      </Field>
      <Field label={t.tradeInventory.movementUnit} showLabel required error={draft.fieldErrors.uomId}>
        <NameSelect value={values.uomId || undefined} options={refs.uoms.filter(unit => !draft.item ||
          [draft.item.baseUomId, draft.item.defaultPurchaseUomId, draft.item.defaultSalesUomId].includes(unit.id)).map(unit => ({ value: unit.id, label: `${unit.name} · ${unit.code}` }))}
          placeholder={t.tradeInventory.movementChooseUnit} disabled={isPending || !draft.item} onValueChange={uomId => draft.set({ uomId })} />
      </Field>
      <Field label={t.tradeInventory.quantity} showLabel required error={draft.fieldErrors.quantity} hint={t.tradeCommon.decimalHint}>
        <Input value={values.quantity} inputMode="decimal" disabled={isPending} onChange={event => draft.set({ quantity: event.target.value })} />
      </Field>
      <Field label={t.tradeInventory.businessEffectiveAt} showLabel required error={draft.fieldErrors.businessEffectiveAt}>
        <Input type="datetime-local" value={values.businessEffectiveAt} disabled={isPending}
          onChange={event => draft.set({ businessEffectiveAt: event.target.value })} />
      </Field>
    </div>
    <MovementTrackingFields mode={draft.item?.trackingMode ?? null} values={values} onChange={draft.set} disabled={isPending} expiry errors={draft.fieldErrors} />
    {draft.item?.trackInventory === false && <p role="alert" className="text-sm text-destructive">{t.tradeInventory.errorItemNotTracked}</p>}
    {!refs.canCatalog || !refs.canNodes ? <p role="status" className="text-sm text-muted-foreground">{t.tradeInventory.movementLookupPermission}</p> : null}
  </FormModal>;
}
