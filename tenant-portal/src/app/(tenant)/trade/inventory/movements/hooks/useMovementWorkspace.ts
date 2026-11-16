"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { FormModalLabels } from "@/design-system";
import type { MovementKind, SessionMovementEntry } from "../movements-contract";
import type { useInventoryReferences } from "../../hooks/useInventoryReferences";

export type MovementReferences = ReturnType<typeof useInventoryReferences>;
export type MovementDialog = { kind: MovementKind; mode: "create" | "result" | "post" | "release" | "reverse"; id?: string };
export function useMovementWorkspace(entries: SessionMovementEntry[], clearError: () => void, unresolved = false) {
  const [dialog, setDialog] = useState<MovementDialog | null>(null);
  return { dialog, target: entries.find(entry => entry.id === dialog?.id) ?? null,
    open: (next: MovementDialog) => { if (!unresolved) { clearError(); setDialog(next); } },
    close: (completed = false) => { if (completed || !unresolved) { clearError(); setDialog(null); } } };
}
export function useMovementModalLabels(submit: string): FormModalLabels {
  const { t } = useI18n();
  return { submit, cancel: t.common.cancel, close: t.common.close,
    discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
    sections: t.tradeInventory.movementsTitle, sectionInvalid: t.tradeInventory.formLinesInvalid };
}
