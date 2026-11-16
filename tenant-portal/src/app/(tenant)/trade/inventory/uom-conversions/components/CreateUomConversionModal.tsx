"use client";
import { Calculator } from "lucide-react";
import { Badge, Button, Combobox, Field, FormModal, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import type { useInventoryReferences } from "../../hooks/useInventoryReferences";
import type { UomConversionFormValues } from "../../inventory-governance-contract";
import { useUomConversionForm } from "../hooks/useUomConversionForm";

interface Props { isOpen: boolean; onClose: () => void; onSubmit: (values: UomConversionFormValues) => Promise<boolean>; isSubmitting: boolean; error: string | null; references: ReturnType<typeof useInventoryReferences>; initialValues?: UomConversionFormValues; unresolved?: boolean; onRetryOriginal?: () => Promise<boolean>; canRetryOriginal?: boolean }
const PRESETS = [{ num: "12", den: "1", key: "conversionRatioDozen" }, { num: "24", den: "1", key: "conversionRatioCase" }, { num: "3", den: "2", key: "conversionRatioThreeHalves" }] as const;
export function CreateUomConversionModal({ isOpen, onClose, onSubmit, isSubmitting, error, references, initialValues, unresolved = false, onRetryOriginal, canRetryOriginal = false }: Props) {
  const { t, lang } = useI18n();
  const form = useUomConversionForm(references, onSubmit, initialValues);
  const inv = t.tradeInventory;
  const busy = isSubmitting || form.loading || unresolved;
  return <FormModal open={isOpen} onOpenChange={(open) => { if (!open && (!unresolved || !canRetryOriginal)) { form.reset(); onClose(); } }} size="wide"
    title={inv.conversionCreateTitle} description={inv.conversionCreateDescription} isDirty={form.isDirty} isSubmitting={isSubmitting}
    onSubmit={() => void form.submit()} error={error ?? form.error ?? undefined}
    submitDisabled={unresolved} footerLeading={unresolved ? <div className="flex flex-col gap-2"><p role="status" className="text-caption text-muted-foreground">{inv.governanceUnknownWrite}</p><Button variant="outline" disabled={!canRetryOriginal || isSubmitting} onClick={() => void onRetryOriginal?.()}>{inv.governanceRetryOriginal}</Button></div> : undefined}
    labels={{ submit: inv.conversionCreateDraft, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel, sections: inv.conversionCreateTitle, sectionInvalid: t.common.cancel }}>
    <div className="flex flex-col gap-4">
      <Field showLabel label={inv.conversionItem} required><Combobox value={form.item?.id} selectedLabel={form.item ? `${form.item.name} · ${form.item.code}` : undefined}
        options={references.items.map((item) => ({ value: item.id, label: item.name, description: item.code }))} onSearch={references.searchItems}
        onValueChange={(id) => void form.selectItem(id)} disabled={busy || !references.canCatalog} loading={references.isLoading || form.loading}
        placeholder={inv.conversionItem} searchPlaceholder={t.common.search} loadingLabel={t.common.loading} emptyLabel={t.common.noData} wrapLabels
        errorContent={references.itemError ? <div role="alert" className="p-3 text-sm text-destructive"><p>{inv.governanceReferenceLoadFailed}</p><Button variant="outline" onClick={references.refresh}>{t.common.retry}</Button></div> : undefined} /></Field>
      {!references.canCatalog ? <p role="status" className="text-sm text-muted-foreground">{t.common.nameUnavailable}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field showLabel label={inv.fromUom} required><NameSelect value={form.values.fromUomId || undefined} onValueChange={(id) => form.set({ fromUomId: id })} placeholder={inv.fromUom} disabled={busy || !form.item}
          options={form.allowedIds.filter((id) => id !== form.item?.baseUomId).map((value) => ({ value, label: references.uomLabel(value) }))} /></Field>
        <Field showLabel label={inv.conversionBaseUnit} required readOnly><Input readOnly value={form.values.toUomId ? references.uomLabel(form.values.toUomId) : ""} /></Field>
        <Field showLabel label={inv.factorNumerator} required hint={inv.factorIntegerHint}><Input value={form.values.factorNumerator} maxLength={18} inputMode="numeric" disabled={busy} onChange={(event) => form.set({ factorNumerator: event.target.value })} /></Field>
        <Field showLabel label={inv.factorDenominator} required hint={inv.factorIntegerHint}><Input value={form.values.factorDenominator} maxLength={18} inputMode="numeric" disabled={busy} onChange={(event) => form.set({ factorDenominator: event.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">{PRESETS.map((preset) => <Button key={preset.key} type="button" size="sm" variant="outline" disabled={busy} onClick={() => form.set({ factorNumerator: preset.num, factorDenominator: preset.den })}>{inv[preset.key]}</Button>)}</div>
      {form.suggestion ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted p-3 text-sm"><span>{inv.conversionExactRatioHint}<bdi dir="ltr" className="block">{form.values.factorNumerator} / {form.values.factorDenominator} = {form.suggestion.numerator} / {form.suggestion.denominator}</bdi></span>
        <Button type="button" variant="outline" disabled={busy} onClick={() => form.set({ factorNumerator: form.suggestion?.numerator ?? "", factorDenominator: form.suggestion?.denominator ?? "" })}>{inv.conversionApplyExactRatio}</Button></div> : null}
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-3 text-sm"><Calculator className="size-4 shrink-0" aria-hidden="true" /><div><p className="font-medium">{inv.conversionLocalPreview}</p>
        <bdi dir="ltr">1 × {form.values.factorNumerator || "—"} / {form.values.factorDenominator || "—"} = {form.preview ? formatDecimalString(form.preview, lang, { maximumFractionDigits: 8 }) : "—"}</bdi></div></div>
      <Field showLabel label={inv.effectiveFrom} required hint={inv.conversionEffectiveHint}><Input type="datetime-local" value={form.values.effectiveFrom} disabled={busy} onChange={(event) => form.set({ effectiveFrom: event.target.value })} /></Field>
      <Badge tone="neutral">{t.tradeStatus.DRAFT}</Badge>
    </div>
  </FormModal>;
}
