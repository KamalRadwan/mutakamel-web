"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradePost } from "../../trade-api";
import { TRADE_ACTION_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import { useQuotationCustomers, type QuotationCustomersState } from "./useQuotationCustomers";
import {
  QUOTATIONS_PATH,
  buildCreateQuotation,
  type QuotationCustomerOption,
} from "../quotation-contract";

export interface QuotationCreateState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  customers: QuotationCustomersState;
  selected: QuotationCustomerOption | null;
  select: (partyId: string | undefined) => void;
  currencyCode: string;
  setCurrencyCode: (value: string) => void;
  draftReference: string;
  setDraftReference: (value: string) => void;
  formError: string | null;
  write: TradeWriteState;
  canSubmit: boolean;
  submit: () => Promise<void>;
}

/**
 * `POST /quotations` — party, currency and an optional draft reference.
 *
 * A quotation is created **empty**: it carries no lines and no revision, and
 * `currentRevisionId` is null until `POST /:id/revisions` runs. That is why the
 * form asks for nothing else and the detail screen leads with "add a revision".
 */
export function useQuotationCreate(
  headers: Record<string, string>,
  canCreate: boolean,
  onCreated: () => Promise<unknown>,
): QuotationCreateState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<QuotationCustomerOption | null>(null);
  const [currencyCode, setCurrencyCode] = useState("");
  const [draftReference, setDraftReference] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // `customer-options` is gated on `trade.quotations.create`, not `.read`, so
  // it is fetched only where creation is actually on offer.
  const customers = useQuotationCustomers(headers, isOpen && canCreate);

  const submit = useCallback(async (): Promise<void> => {
    if (!selected) return;
    setFormError(null);
    try {
      const request = buildCreateQuotation(selected, currencyCode, draftReference);
      const created = await write.runWrite({
        operation: t.tradeDocuments.quotations.createTitle,
        send: (idempotency) =>
          tradePost(QUOTATIONS_PATH, request, {
            headers: { ...headers, ...idempotency },
            maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
          }),
      });
      if (created) {
        setIsOpen(false);
        setSelected(null);
        setCurrencyCode("");
        setDraftReference("");
        await onCreated();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setFormError(
        reason === "QUOTATION_FORM_CURRENCY"
          ? t.tradeDocuments.currencyHint
          : t.tradeDocuments.quotations.customerEmpty,
      );
    }
  }, [selected, currencyCode, draftReference, write, t, headers, onCreated]);

  return {
    isOpen,
    open: () => {
      setFormError(null);
      setIsOpen(true);
    },
    close: () => {
      if (write.isWriting) return;
      setIsOpen(false);
    },
    customers,
    selected,
    select: (partyId: string | undefined) =>
      setSelected(customers.options.find((option) => option.partyId === partyId) ?? null),
    currencyCode,
    setCurrencyCode,
    draftReference,
    setDraftReference,
    formError,
    write,
    canSubmit: selected !== null && selected.quotationSelectable && currencyCode.trim().length === 3,
    submit,
  };
}
