"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { inventoryFormMessage } from "../../inventory-messages";
import type { InventoryReferenceItem } from "../../inventory-reference-contract";
import { EMPTY_RESERVATION_FORM, type ReservationFormValues } from "../movements-contract";
import { useMovementSources } from "./useMovementSources";
import type { MovementReferences } from "./useMovementWorkspace";
import { reservationFormErrors, type MovementFieldErrors } from "../movement-form-validation";

export function useReservationDraft(refs: MovementReferences, headers: Record<string, string>, canRead: boolean) {
  const { t } = useI18n();
  const sources = useMovementSources("sales", headers, canRead);
  const [values, setValues] = useState<ReservationFormValues>(EMPTY_RESERVATION_FORM);
  const [item, setItem] = useState<InventoryReferenceItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MovementFieldErrors>({});
  const selection = useRef(0);
  const line = sources.source?.lines.find(line => line.id === values.sourceLineId);
  const selectItem = async (id?: string, profileId = line?.profileId) => {
    const request = ++selection.current;
    setItem(null); setError(null); setFieldErrors({});
    setValues(current => ({ ...current, itemId: id ?? "", lotKey: "", serialKeys: "" }));
    if (!id) return;
    setLoadingItem(true);
    try {
      const selected = await refs.ensureItem(id);
      if (selection.current !== request) return;
      if (profileId && selected.profileId !== profileId) { setError(t.tradeInventory.movementItemMismatch); return; }
      setItem(selected);
    } catch (failure) { if (selection.current === request) setError(inventoryFormMessage(failure, t)); }
    finally { if (selection.current === request) setLoadingItem(false); }
  };
  const submission = (): ReservationFormValues => ({ ...values,
    sourceDocumentId: sources.source?.id ?? "", sourceDocumentVersion: String(sources.source?.version ?? ""),
    sourceLineVersion: String(line?.version ?? ""),
    display: { sourceLabel: sources.source?.label, itemLabel: item ? `${item.name} · ${item.code}` : undefined,
      nodeLabel: refs.nodeLabel(values.nodeId), unitLabel: refs.uomLabel(values.uomId) } });
  return { sources, values, line, item, error, fieldErrors, loadingItem,
    validate: () => { const errors = reservationFormErrors(submission(), item, t); setFieldErrors(errors); setError(Object.values(errors).find(Boolean) ?? null); return Object.keys(errors).length === 0; },
    dirty: Boolean(sources.selectedId) || JSON.stringify(values) !== JSON.stringify(EMPTY_RESERVATION_FORM),
    set: (patch: Partial<ReservationFormValues>) => { setFieldErrors({}); setError(null); setValues(current => ({ ...current, ...patch })); },
    selectSource: (id: string) => { selection.current += 1; setLoadingItem(false); setFieldErrors({}); setError(null); sources.select(id); setValues(EMPTY_RESERVATION_FORM); setItem(null); },
    selectItem,
    selectLine: (id: string) => {
      selection.current += 1; setLoadingItem(false);
      const request = selection.current;
      const selected = sources.source?.lines.find(line => line.id === id);
      setItem(null); setError(null); setFieldErrors({});
      setValues(current => ({ ...current, sourceLineId: id, uomId: selected?.uomId ?? "", itemId: "", lotKey: "", serialKeys: "" }));
      if (!selected) return;
      void refs.ensureUom(selected.uomId).catch(failure => setError(inventoryFormMessage(failure, t)));
      const matchingItem = refs.items.find(item => item.profileId === selected.profileId);
      if (matchingItem) void selectItem(matchingItem.id, selected.profileId);
      else {
        setLoadingItem(true);
        void refs.ensureProfiles([selected.profileId]).then(items => {
          if (selection.current !== request) return;
          const matching = items.find(item => item.profileId === selected.profileId);
          if (matching) return selectItem(matching.id, selected.profileId);
          setLoadingItem(false);
        }).catch(failure => { if (selection.current === request) { setError(inventoryFormMessage(failure, t)); setLoadingItem(false); } });
      }
    },
    submission,
  };
}
