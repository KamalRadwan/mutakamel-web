"use client";
import { useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { InventoryReferenceItem } from "../../inventory-reference-contract";
import type { useInventoryReferences } from "../../hooks/useInventoryReferences";
import { EMPTY_UOM_CONVERSION_FORM, buildCreateUomConversionRequest, convertQuantityPreview, suggestIntegerFraction, type UomConversionFormValues } from "../../inventory-governance-contract";
import { inventoryFormMessage } from "../../inventory-messages";

export function useUomConversionForm(references: ReturnType<typeof useInventoryReferences>, onSubmit: (values: UomConversionFormValues) => Promise<boolean>, initialValues = EMPTY_UOM_CONVERSION_FORM) {
  const { t } = useI18n();
  const [values, setValues] = useState<UomConversionFormValues>(initialValues);
  const [item, setItem] = useState<InventoryReferenceItem | null>(() => references.items.find((option) => option.profileId === initialValues.itemCompanyProfileId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selection = useRef(0);
  const set = (patch: Partial<UomConversionFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const allowedIds = item ? [...new Set([item.baseUomId, item.defaultSalesUomId, item.defaultPurchaseUomId].filter((id): id is string => Boolean(id)))] : [];
  const selectItem = async (id?: string) => {
    const request = ++selection.current;
    setError(null);
    setItem(null);
    set({ itemCompanyProfileId: "", fromUomId: "", toUomId: "" });
    if (!id) return;
    setLoading(true);
    try {
      const selected = await references.ensureItem(id);
      if (request !== selection.current) return;
      if (!selected.profileId || !selected.trackInventory) { setError(t.tradeInventory.errorItemNotTracked); return; }
      const units = [selected.baseUomId, selected.defaultSalesUomId, selected.defaultPurchaseUomId].filter((value): value is string => Boolean(value));
      await Promise.all(units.map((unit) => references.ensureUom(unit)));
      if (request !== selection.current) return;
      setItem(selected);
      set({ itemCompanyProfileId: selected.profileId, toUomId: selected.baseUomId, fromUomId: selected.defaultPurchaseUomId !== selected.baseUomId ? selected.defaultPurchaseUomId ?? "" : selected.defaultSalesUomId !== selected.baseUomId ? selected.defaultSalesUomId ?? "" : "" });
    } catch { if (request === selection.current) setError(t.tradeInventory.governanceReferenceLoadFailed); }
    finally { if (request === selection.current) setLoading(false); }
  };
  const reset = () => { selection.current += 1; setValues(EMPTY_UOM_CONVERSION_FORM); setItem(null); setError(null); setLoading(false); };
  const submit = async () => {
    try { buildCreateUomConversionRequest(values); }
    catch (failure) { setError(inventoryFormMessage(failure, t)); return; }
    if (await onSubmit(values)) reset();
  };
  const suggestion = useMemo(() => suggestIntegerFraction(values.factorNumerator, values.factorDenominator), [values.factorNumerator, values.factorDenominator]);
  return { values, set, item, selectItem, allowedIds, error, loading, reset, submit, suggestion,
    preview: convertQuantityPreview("1", values.factorNumerator, values.factorDenominator),
    isDirty: JSON.stringify(values) !== JSON.stringify(EMPTY_UOM_CONVERSION_FORM) };
}
