"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { inventoryFormMessage } from "../../inventory-messages";
import type { InventoryReferenceItem } from "../../inventory-reference-contract";
import { EMPTY_MOVEMENT_FORM, EMPTY_MOVEMENT_LINE, MOVEMENT_LINES_MAX, type MovementFormValues, type MovementLineValues } from "../movements-contract";
import { useMovementSources } from "./useMovementSources";
import type { MovementReferences } from "./useMovementWorkspace";
import { documentFormErrors, type MovementFieldErrors } from "../movement-form-validation";

export function useDocumentMovementDraft(refs: MovementReferences, headers: Record<string, string>, isDelivery: boolean, canRead: boolean) {
  const { t } = useI18n();
  const sources = useMovementSources(isDelivery ? "sales" : "purchase", headers, canRead);
  const [values, setValues] = useState<MovementFormValues>(EMPTY_MOVEMENT_FORM);
  const [items, setItems] = useState<Record<string, InventoryReferenceItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MovementFieldErrors>({});
  const selection = useRef<Record<number, number>>({});
  const sequence = useRef(0);
  const sourceGeneration = useRef(0);
  const clearErrors = () => { setFieldErrors({}); setError(null); };
  const changeLine = (index: number, patch: Partial<MovementLineValues>) => { clearErrors(); setValues(current => ({ ...current,
    lines: current.lines.map((line, position) => position === index ? { ...line, ...patch } : line) })); };
  const selectItem = async (sourceLineId: string, itemId?: string) => {
    const generation = sourceGeneration.current;
    clearErrors();
    if (!itemId) return;
    setLoading(true);
    try {
      const item = await refs.ensureItem(itemId);
      if (sourceGeneration.current !== generation) return;
      const line = sources.source?.lines.find(line => line.id === sourceLineId);
      if (!line || item.profileId !== line.profileId) { setError(t.tradeInventory.movementItemMismatch); return; }
      setItems(current => ({ ...current, [sourceLineId]: item }));
    } catch (failure) { if (sourceGeneration.current === generation) setError(inventoryFormMessage(failure, t)); }
    finally { if (sourceGeneration.current === generation) setLoading(false); }
  };
  const submission = (): MovementFormValues => ({ ...values, sourceDocumentId: sources.source?.id ?? "",
    sourceDocumentVersion: String(sources.source?.version ?? ""),
    display: { sourceLabel: sources.source?.label, nodeLabel: refs.nodeLabel(values.nodeId),
      lineLabels: values.lines.map(line => sources.source?.lines.find(source => source.id === line.sourceLineId)?.label ?? t.common.nameUnavailable) } });
  return { values, sources, items, loading, error, fieldErrors,
    validate: () => { const errors = documentFormErrors(submission(), items, isDelivery, t); setFieldErrors(errors); setError(Object.values(errors).find(Boolean) ?? null); return Object.keys(errors).length === 0; },
    dirty: Boolean(sources.selectedId) || JSON.stringify(values) !== JSON.stringify(EMPTY_MOVEMENT_FORM),
    complete: values.lines.every(line => items[line.sourceLineId]?.trackInventory),
    set: (patch: Partial<MovementFormValues>) => { clearErrors(); setValues(current => ({ ...current, ...patch })); },
    selectSource: (id: string) => { sourceGeneration.current += 1; selection.current = {}; setLoading(false); clearErrors(); sources.select(id); setValues(EMPTY_MOVEMENT_FORM); setItems({}); },
    changeLine, selectItem,
    selectLine: (index: number, id: string) => {
      const request = ++sequence.current;
      selection.current[index] = request;
      const selected = sources.source?.lines.find(line => line.id === id);
      if (!selected) return;
      changeLine(index, { sourceLineId: id, sourceLineVersion: String(selected.version), uomId: selected.uomId,
        lotKey: "", serialKeys: "", reservationId: "" });
      if (selected.nodeId || sources.source?.nodeId) setValues(current => ({ ...current, nodeId: selected.nodeId ?? sources.source?.nodeId ?? current.nodeId }));
      void refs.ensureUom(selected.uomId).catch(failure => setError(inventoryFormMessage(failure, t)));
      const item = refs.items.find(item => item.profileId === selected.profileId);
      if (item) void selectItem(id, item.id);
      else void refs.ensureProfiles([selected.profileId]).then(items => {
        if (selection.current[index] !== request) return;
        const matching = items.find(item => item.profileId === selected.profileId);
        if (matching) return selectItem(id, matching.id);
      }).catch(failure => { if (selection.current[index] === request) setError(inventoryFormMessage(failure, t)); });
    },
    add: () => { if (values.lines.length < MOVEMENT_LINES_MAX) { clearErrors(); setValues(current => ({ ...current, lines: [...current.lines, { ...EMPTY_MOVEMENT_LINE }] })); } },
    remove: (index: number) => { clearErrors(); setValues(current => ({ ...current, lines: current.lines.filter((_, position) => position !== index) })); },
    submission,
  };
}
