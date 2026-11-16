"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { InventoryReferenceItem } from "../../inventory-reference-contract";
import { inventoryFormMessage } from "../../inventory-messages";
import { EMPTY_OPENING_BALANCE_FORM, type OpeningBalanceFormValues } from "../movements-contract";
import type { MovementReferences } from "./useMovementWorkspace";
import { openingFormErrors, type MovementFieldErrors } from "../movement-form-validation";

export function useOpeningBalanceDraft(refs: MovementReferences) {
  const { t } = useI18n();
  const [values, setValues] = useState<OpeningBalanceFormValues>(EMPTY_OPENING_BALANCE_FORM);
  const [item, setItem] = useState<InventoryReferenceItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MovementFieldErrors>({});
  const selection = useRef(0);
  return { values, item, loadingItem, error, fieldErrors,
    validate: () => { const errors = openingFormErrors(values, item, t); setFieldErrors(errors); setError(Object.values(errors).find(Boolean) ?? null); return Object.keys(errors).length === 0; },
    dirty: JSON.stringify(values) !== JSON.stringify(EMPTY_OPENING_BALANCE_FORM),
    set: (patch: Partial<OpeningBalanceFormValues>) => { setFieldErrors({}); setError(null); setValues(current => ({ ...current, ...patch })); },
    selectItem: async (id?: string) => {
      const request = ++selection.current;
      setError(null); setFieldErrors({}); setItem(null);
      setValues(current => ({ ...current, itemId: id ?? "", uomId: "", lotKey: "", serialKeys: "", expiresAt: "" }));
      if (!id) return;
      setLoadingItem(true);
      try {
        const selected = await refs.ensureItem(id);
        await Promise.all([...new Set([selected.baseUomId, selected.defaultPurchaseUomId, selected.defaultSalesUomId]
          .filter((unit): unit is string => unit !== null))].map(unit => refs.ensureUom(unit)));
        if (selection.current !== request) return;
        setItem(selected);
        setValues(current => current.itemId === id ? { ...current, uomId: selected.baseUomId, itemProfileVersion: String(selected.profileVersion ?? "") } : current);
      } catch (failure) { if (selection.current === request) setError(inventoryFormMessage(failure, t)); }
      finally { if (selection.current === request) setLoadingItem(false); }
    },
    submission: () => ({ ...values, display: { itemLabel: refs.itemLabel(values.itemId),
      nodeLabel: refs.nodeLabel(values.nodeId), unitLabel: refs.uomLabel(values.uomId) } }),
  };
}
