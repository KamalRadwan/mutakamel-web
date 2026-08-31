"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  TRADE_LIST_RESPONSE_BYTES,
  tradeDocumentPath,
} from "../../documents/trade-document-contract";
import { isAbortError } from "../../documents/hooks/useTradeDocumentList";
import { useTradeLineDraft, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  PURCHASE_QUOTATIONS_PATH,
  buildCreatePurchaseQuotation,
  parseSupplierAccounts,
  supplierAccountsPath,
  type PurchaseQuotationDetail,
  type SupplierAccountOption,
} from "../purchase-quotation-contract";

interface PurchaseQuotationFormValues {
  supplierPartyId: string;
  currencyCode: string;
  validUntil: string;
  reference: string;
  notes: string;
}

export interface PurchaseQuotationFormState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  values: PurchaseQuotationFormValues;
  setValue: (patch: Partial<PurchaseQuotationFormValues>) => void;
  suppliers: SupplierAccountOption[];
  suppliersError: NormalizedApiError | null;
  isLoadingSuppliers: boolean;
  lineDraft: TradeLineDraftState;
  write: TradeWriteState;
  formError: string | null;
  canSubmit: boolean;
  submit: () => Promise<void>;
}

const EMPTY: PurchaseQuotationFormValues = {
  supplierPartyId: "",
  currencyCode: "",
  validUntil: "",
  reference: "",
  notes: "",
};

/**
 * Create and edit for a purchase quotation.
 *
 * `UpdatePurchaseQuotationDto` uses `@ValidateIf(value !== undefined)` on every
 * field, so **`null` is a 400** — an omitted key is the only way to leave a
 * field alone. Supplying `lines` replaces the whole set, which is why the
 * drawer says so before it saves.
 */
export function usePurchaseQuotationForm(
  headers: Record<string, string>,
  canReadSuppliers: boolean,
  existing: PurchaseQuotationDetail | null,
  onSaved: () => Promise<unknown>,
): PurchaseQuotationFormState {
  const { t } = useI18n();
  const write = useTradeWrite();
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<PurchaseQuotationFormValues>(EMPTY);
  const [suppliers, setSuppliers] = useState<SupplierAccountOption[]>([]);
  const [suppliersError, setSuppliersError] = useState<NormalizedApiError | null>(null);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const lineDraft = useTradeLineDraft(
    headers,
    values.currencyCode,
    values.supplierPartyId || null,
    "PURCHASE",
    isOpen,
  );

  useEffect(() => {
    if (!isOpen || !canReadSuppliers) return undefined;
    const controller = new AbortController();
    // Deferred to a microtask so the first `setState` is not synchronous with
    // the effect body.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoadingSuppliers(true);
      void (async () => {
        try {
          const result = await tradeGet(supplierAccountsPath(), {
            signal: controller.signal,
            headers,
            maxResponseBytes: TRADE_LIST_RESPONSE_BYTES,
          });
          setSuppliers(parseSupplierAccounts(result.data));
        } catch (error) {
          if (isAbortError(error)) return;
          setSuppliersError(normalizeApiError(error));
        } finally {
          if (!controller.signal.aborted) setIsLoadingSuppliers(false);
        }
      })();
    });
    return () => controller.abort();
  }, [isOpen, canReadSuppliers, headers]);

  const linesReady =
    lineDraft.invalidLineIndex === null &&
    lineDraft.lines.every((line) => line.itemId !== "" && line.uomId !== "");

  const submit = useCallback(async (): Promise<void> => {
    setFormError(null);
    try {
      const request = buildCreatePurchaseQuotation({
        ...values,
        lines: lineDraft.lines.map((line) => ({
          clientLineId: line.clientLineId,
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: line.quantity,
        })),
      });
      const saved = await write.runWrite({
        operation: existing
          ? t.tradeDocuments.purchaseQuotations.editTitle
          : t.tradeDocuments.purchaseQuotations.createTitle,
        send: (idempotency) =>
          existing
            ? tradePatch(
                tradeDocumentPath(PURCHASE_QUOTATIONS_PATH, existing.id),
                request,
                {
                  headers: {
                    ...headers,
                    ...idempotency,
                    "if-match": tradeIfMatch(existing.version),
                  },
                  maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
                },
              )
            : tradePost(PURCHASE_QUOTATIONS_PATH, request, {
                headers: { ...headers, ...idempotency },
                maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
              }),
      });
      if (saved) {
        setIsOpen(false);
        setValues(EMPTY);
        await onSaved();
      }
    } catch (error) {
      setFormError(formMessage(error, t));
    }
  }, [values, lineDraft.lines, write, existing, t, headers, onSaved]);

  return {
    isOpen,
    open: () => {
      setFormError(null);
      setValues(
        existing
          ? {
              supplierPartyId: existing.partyId,
              currencyCode: existing.currencyCode,
              validUntil: existing.validUntil ?? "",
              reference: existing.reference ?? "",
              notes: existing.notes ?? "",
            }
          : EMPTY,
      );
      setIsOpen(true);
    },
    close: () => {
      if (write.isWriting) return;
      setIsOpen(false);
    },
    values,
    setValue: (patch) => setValues((current) => ({ ...current, ...patch })),
    suppliers,
    suppliersError,
    isLoadingSuppliers,
    lineDraft,
    write,
    formError,
    canSubmit:
      linesReady &&
      values.supplierPartyId !== "" &&
      values.currencyCode.trim().length === 3 &&
      values.validUntil !== "" &&
      !write.isWriting,
    submit,
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "PURCHASE_QUOTATION_FORM_CURRENCY") return t.tradeDocuments.currencyHint;
  if (reason === "PURCHASE_QUOTATION_FORM_VALIDITY") {
    return t.tradeDocuments.errors.purchaseQuotationValidityInvalid;
  }
  return t.tradeDocuments.purchaseQuotations.supplierEmpty;
}
