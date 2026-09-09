import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AddonCopy } from "../lib/addon-copy";
import { readBrackets, type AddonPrices, type readPriceReceipt } from "../lib/addon-contract";
import type { useAddonMutation } from "./useAddonMutation";
type Row = { maxUsers: string; unitPrice: string };
type Cycle = "MONTHLY" | "ANNUAL";
type Ladder = AddonPrices["ladders"][number];
type CycleDraft = { ladder: Ladder; rows: Row[]; reason: string; dirty: boolean };
export interface AddonPricingOptions {
  prices: AddonPrices; canMutate: boolean; mutation: ReturnType<typeof useAddonMutation>; copy: AddonCopy;
  readCurrent?: boolean;
  acceptedReceipt?: ReturnType<typeof readPriceReceipt> | null;
  onAccepted: (receipt: { noChange: boolean }) => Promise<void>;
  initialCycle?: Cycle;
  onCycleChange?: (cycle: Cycle) => void;
}
const draftFor = (ladder: Ladder): CycleDraft => ({ ladder, reason: "", dirty: false,
  rows: ladder.configured ? ladder.brackets.map(row => ({ maxUsers: row.maxUsers === null ? "" : String(row.maxUsers), unitPrice: row.unitPrice })) : [{ maxUsers: "", unitPrice: "" }] });
export function useAddonPricingEditor({ prices, mutation, copy, onAccepted, canMutate, readCurrent = true, acceptedReceipt = null, initialCycle = "MONTHLY", onCycleChange }: AddonPricingOptions) {
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [drafts, setDrafts] = useState<Record<Cycle, CycleDraft>>(() => ({
    MONTHLY: draftFor(prices.ladders.find(item => item.billingCycle === "MONTHLY")!),
    ANNUAL: draftFor(prices.ladders.find(item => item.billingCycle === "ANNUAL")!),
  }));
  const [observed, setObserved] = useState({ prices, acceptedReceipt });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Synchronize new evidence before rendering inputs. Dirty sibling cycles keep
  // their reviewed fence; an accepted command clears only its actual cycle.
  if (observed.prices !== prices || observed.acceptedReceipt !== acceptedReceipt) {
    const next = { ...drafts };
    if (acceptedReceipt && observed.acceptedReceipt !== acceptedReceipt && acceptedReceipt.addonId === prices.addonId) {
      next[acceptedReceipt.billingCycle] = draftFor({ billingCycle: acceptedReceipt.billingCycle, revision: acceptedReceipt.revision,
        revisionId: acceptedReceipt.revisionId, brackets: acceptedReceipt.brackets, configured: true });
    }
    for (const head of prices.ladders) {
      if (!next[head.billingCycle].dirty && BigInt(head.revision) > BigInt(next[head.billingCycle].ladder.revision)) next[head.billingCycle] = draftFor(head);
    }
    setObserved({ prices, acceptedReceipt });
    setDrafts(next);
  }
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mutation.error || Object.keys(errors).length) errorRef.current?.focus();
  }, [errors, mutation.error]);
  const { rows, ladder, reason } = drafts[cycle];
  const head = prices.ladders.find(item => item.billingCycle === cycle)!;
  const stale = BigInt(head.revision) > BigInt(ladder.revision);
  const locked = !canMutate || !readCurrent || stale || mutation.isSubmitting || Boolean(mutation.pending && (mutation.canRetry || mutation.pending.resource.kind !== "PRICING_REPLACE"));
  const changeRows = (change: (rows: Row[]) => Row[]) => {
    if (locked) return;
    setDrafts(previous => ({ ...previous, [cycle]: { ...previous[cycle], rows: change(previous[cycle].rows), dirty: true } }));
  };
  const changeRow = (index: number, field: keyof Row, value: string) => changeRows(current =>
    current.map((row, position) => position === index ? { ...row, [field]: value } : row));
  const addRow = () => changeRows(current => {
    if (current.length >= 100) return current;
    const start = current.length === 1 ? 1 : Number(current[current.length - 2].maxUsers) + 1;
    return [...current.map((row, index) => index === current.length - 1 ? { ...row, maxUsers: String(start) } : row), { maxUsers: "", unitPrice: "" }];
  });
  const removeRow = (index: number) => changeRows(current => {
    if (current.length === 1) return current;
    const remaining = current.filter((_, position) => position !== index);
    return remaining.map((row, position) => position === remaining.length - 1 ? { ...row, maxUsers: "" } : row);
  });
  const loadLatest = () => {
    if (!canMutate || !readCurrent || mutation.isSubmitting || mutation.pending) return;
    setDrafts(previous => ({ ...previous, [cycle]: draftFor(head) })); setErrors({});
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (locked) return;
    const errors: Record<string, string> = {};
    let brackets;
    try {
      brackets = readBrackets(rows.map((row, index) => ({ minUsers: index === 0 ? 1 : Number(rows[index - 1].maxUsers) + 1,
        maxUsers: index === rows.length - 1 ? null : /^\d+$/u.test(row.maxUsers) ? Number(row.maxUsers) : NaN, unitPrice: row.unitPrice.trim() })));
    } catch { errors.brackets = copy.ladderInvalid; }
    if (!reason.trim() || reason.trim().length > 256) errors.reason = copy.required;
    setErrors(errors);
    if (!brackets || Object.keys(errors).length) return;
    const result = await mutation.submit({ type: "pricing", addonKey: prices.addonKey, addonId: prices.addonId,
      body: { billingCycle: cycle, expectedLadderRevision: ladder.revision, brackets, reason: reason.trim() } });
    if (result) await onAccepted(result);
  };
  return { cycle, setCycle: (value: string) => { if (mutation.isSubmitting || (value !== "MONTHLY" && value !== "ANNUAL")) return; setCycle(value); onCycleChange?.(value); setErrors({}); },
    rows, ladder, head, stale, locked, loadLatest, changeRow, addRow, removeRow, errors, errorRef,
    reason, setReason: (value: string) => { if (!locked) setDrafts(previous => ({ ...previous, [cycle]: { ...previous[cycle], reason: value, dirty: true } })); }, submit };
}
