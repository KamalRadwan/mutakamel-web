"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { INVENTORY_CODE_PATTERN } from "../../../trade-advanced-validation";
import { buildReleaseRequest } from "../movement-request-builders";
import { buildSerialSelection } from "../serial-input";
import { movementRemainingQuantity, type ReversalLineValues, type SessionMovementEntry } from "../movements-contract";
import type { useInventoryMovements } from "./useInventoryMovements";
import type { MovementDialog } from "./useMovementWorkspace";

type ActionFieldErrors = { quantity?: string; reason?: string; effectiveAt?: string; serials?: string;
  lines: Record<string, { quantity?: string; serials?: string }> };

export function useMovementActionDraft(target: SessionMovementEntry, mode: MovementDialog["mode"], controller: ReturnType<typeof useInventoryMovements>, onClose: (completed?: boolean) => void) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [serials, setSerials] = useState("");
  const [lines, setLines] = useState<ReversalLineValues[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const validate = () => {
    const errors: ActionFieldErrors = { lines: {} };
    const checkQuantity = (value: string, remaining?: string) => {
      try {
        buildReleaseRequest(value, "");
        if (remaining !== undefined) movementRemainingQuantity(remaining, value.trim());
      } catch { return t.tradeInventory.formQuantityInvalid; }
    };
    const checkSerials = (value: string, amount: string, known: string[], remaining?: string) => {
      try {
        const selected = buildSerialSelection(value, amount.trim() || undefined);
        if (selected && (selected.length > 1000 || selected.some(key => !known.includes(key)))) throw new Error();
        if (remaining !== undefined) {
          if (selected && !amount.trim()) movementRemainingQuantity(remaining, String(selected.length));
          if (!selected && amount.trim() && !/^0(?:\.0+)?$/u.test(movementRemainingQuantity(remaining, amount.trim()))) throw new Error();
        }
      } catch { return t.tradeInventory.serialSelectionInvalid; }
    };
    if (mode === "release") {
      if (quantity.trim()) errors.quantity = checkQuantity(quantity, target.reservation?.remainingQuantity);
      if (reason.trim() && !INVENTORY_CODE_PATTERN.test(reason.trim().toUpperCase())) errors.reason = t.tradeInventory.formReasonInvalid;
      if (target.serialKeys?.length) errors.serials = checkSerials(serials, quantity, target.serialKeys, target.reservation?.remainingQuantity);
    }
    if (mode === "reverse") {
      if (!INVENTORY_CODE_PATTERN.test(reason.trim().toUpperCase())) errors.reason = t.tradeInventory.formReasonInvalid;
      const parsed = new Date(effectiveAt);
      const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/u.exec(effectiveAt);
      if (!parts || Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(parts[1]) ||
        parsed.getMonth() + 1 !== Number(parts[2]) || parsed.getDate() !== Number(parts[3]) ||
        parsed.getHours() !== Number(parts[4]) || parsed.getMinutes() !== Number(parts[5]) ||
        (target.businessEffectiveAt && parsed.getTime() < new Date(target.businessEffectiveAt).getTime())) errors.effectiveAt = t.tradeInventory.formDateInvalid;
      let serialCount = 0;
      for (const line of lines) {
        const original = target.lines?.find(known => known.id === line.lineId);
        const remaining = original ? movementRemainingQuantity(original.quantity, original.reversedQuantity ?? "0") : undefined;
        const quantityError = line.quantity.trim() ? checkQuantity(line.quantity, remaining) : t.tradeInventory.formQuantityInvalid;
        const serialError = original?.serialKeys.length ? checkSerials(line.serialKeys, line.quantity, original.serialKeys, remaining) : undefined;
        serialCount += line.serialKeys.trim() ? line.serialKeys.split(/\r?\n/u).length : 0;
        errors.lines[line.lineId] = { quantity: quantityError, serials: serialError };
      }
      if (serialCount > 1000) for (const line of lines.filter(line => line.serialKeys.trim())) errors.lines[line.lineId].serials = t.tradeInventory.serialSelectionInvalid;
    }
    return errors;
  };
  const fieldErrors: ActionFieldErrors = submitted ? validate() : { lines: {} };
  return { quantity, setQuantity, reason, setReason, effectiveAt, setEffectiveAt, serials, setSerials, lines, fieldErrors,
    submit: async () => {
      setSubmitted(true);
      const errors = validate();
      if (errors.quantity || errors.reason || errors.effectiveAt || errors.serials || Object.values(errors.lines).some(line => line.quantity || line.serials)) return;
      const saved = mode === "release" ? await controller.releaseReservation(target.id, target.version, quantity, reason, serials)
        : mode === "reverse" ? await (target.kind === "receipt" ? controller.reverseReceipt : controller.reverseDelivery)(target.id, target.version, reason, effectiveAt, lines)
        : await (target.kind === "receipt" ? controller.postReceipt : controller.postDelivery)(target.id, target.version);
      if (saved) onClose(true);
    },
    dirty: !!quantity || !!reason || !!effectiveAt || !!serials || lines.length > 0,
    add: (lineId: string) => { if (!lines.some(line => line.lineId === lineId)) setLines(current => [...current, { lineId, quantity: "", serialKeys: "" }]); },
    remove: (lineId: string) => setLines(current => current.filter(line => line.lineId !== lineId)),
    change: (lineId: string, patch: Partial<ReversalLineValues>) => setLines(current => current.map(line => line.lineId === lineId ? { ...line, ...patch } : line)),
  };
}
