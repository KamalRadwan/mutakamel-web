import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { initialCommercialCopy } from "../initial-commercial-copy";
import { isInitialSeatQuantity, readInitialDraftTerms, type InitialCommercialTerms } from "../initial-commercial-request";
import { useInitialCommercial, type InitialCommercialContext } from "./useInitialCommercial";

export type InitialCommercialWorkspaceProps = { context: InitialCommercialContext; initialTerms: InitialCommercialTerms; onSeeded?: () => void };
export function useInitialCommercialEntry(props: InitialCommercialWorkspaceProps) {
  const { user } = useAuth(); const { lang } = useI18n();
  const initial = useMemo(() => {
    try { return readInitialDraftTerms(props.initialTerms, props.context.purpose === "TENANT_CREATION" ? 50 : 100); }
    catch { return null; }
  }, [props.initialTerms, props.context.purpose]);
  return { initial, copy: initialCommercialCopy(lang), sessionKey: JSON.stringify([user?.id, props.context, initial]) };
}
export function useInitialCommercialWorkspace({ context, initialTerms, onSeeded }: InitialCommercialWorkspaceProps) {
  const { lang, dir } = useI18n(); const copy = initialCommercialCopy(lang);
  const [terms, setTerms] = useState(initialTerms);
  const input = useMemo(() => ({ ...terms, purpose: context.purpose, ...(context.purpose === "INITIAL_SEED" ? { targetTenantId: context.targetTenantId } : {}) }), [terms, context]);
  const state = useInitialCommercial(context, input);
  const refreshedReceipt = useRef<string | null>(null);
  useEffect(() => {
    if (!state.receipt || refreshedReceipt.current === state.receipt.commandId) return;
    refreshedReceipt.current = state.receipt.commandId;
    onSeeded?.();
  }, [state.receipt, onSeeded]);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state.error]);
  const errorMessage = state.error?.errorCode === "INITIAL_SELECTION_INVALID" ? copy.invalid
    : state.error?.errorCode === "INITIAL_QUOTE_EXPIRED" ? copy.expired
      : state.error?.errorCode === "INITIAL_QUOTE_REQUIRED" ? copy.requiredQuote : state.error?.message;
  const invalidFields = terms.applications.flatMap(item => [
    ...(!isInitialSeatQuantity(item.seats) ? [{ id: `initial-${item.selectionKey}`, label: copy.baseSeats }] : []),
    ...item.addons.filter(addon => !isInitialSeatQuantity(addon.seats, item.seats)).map(addon => ({ id: `initial-${addon.selectionKey}`, label: copy.addonSeats })),
  ]);
  const invalidTrial = terms.trialDays !== undefined && (!Number.isInteger(terms.trialDays) || terms.trialDays < 1 || terms.trialDays > 365);
  if (invalidTrial) invalidFields.push({ id: "initial-trial-days", label: copy.trial });
  if (!terms.applications.length) invalidFields.push({ id: "initial-selected-terms", label: copy.application });
  return { state, terms, copy, dir, errorRef, errorMessage, invalidTrial, invalidFields, setTerms,
    restore: () => setTerms(initialTerms),
    setCycle: (billingCycle: string) => { if (billingCycle === "MONTHLY" || billingCycle === "ANNUAL") setTerms({ ...terms, billingCycle }); },
    setTrial: (value: string) => setTerms({ ...terms, trialDays: value === "" ? undefined : Number(value) }) };
}
