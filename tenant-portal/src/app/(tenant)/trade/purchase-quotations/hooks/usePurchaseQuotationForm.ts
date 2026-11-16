"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  partyDisplayName,
  tradeDocumentPath,
} from "../../documents/trade-document-contract";
import { useTradeLineDraft, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { useTradeWrite, type TradeWriteState } from "../../documents/hooks/useTradeWrite";
import {
  PURCHASE_QUOTATIONS_PATH,
  buildCreatePurchaseQuotation,
  buildUpdatePurchaseQuotation,
  type PurchaseQuotationDetail,
  type SupplierAccountOption,
} from "../purchase-quotation-contract";
import { usePurchaseQuotationSuppliers } from "./usePurchaseQuotationSuppliers";

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
  canUseSupplierPicker: boolean;
  searchSuppliers: (search: string) => void;
  selectedSupplierLabel: string;
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
 * field alone. Supplying `lines` replaces the whole set, so header-only saves
 * omit it to preserve the persisted line identities.
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
  const supplierLookup = usePurchaseQuotationSuppliers(headers, canReadSuppliers);
  const [selectedSupplierLabel, setSelectedSupplierLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const lineDraft = useTradeLineDraft(
    headers,
    values.currencyCode,
    values.supplierPartyId || null,
    "PURCHASE",
    isOpen,
  );

  const linesReady =
    lineDraft.invalidLineIndex === null &&
    lineDraft.lines.every((line) => line.itemId !== "" && line.uomId !== "");

  const submit = useCallback(async (): Promise<void> => {
    if (write.isBlocked || !supplierLookup.canUseSupplierPicker) return;
    setFormError(null);
    try {
      const input = {
        ...values,
        lines: lineDraft.lines.map((line) => ({
          clientLineId: line.clientLineId,
          itemId: line.itemId,
          uomId: line.uomId,
          quantity: line.quantity,
        })),
      };
      const request = existing
        ? buildUpdatePurchaseQuotation(input, existing)
        : buildCreatePurchaseQuotation(input);
      await write.runWrite({
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
        onSuccess: async () => {
          setIsOpen(false);
          setValues(EMPTY);
          lineDraft.reset([]);
          await onSaved();
        },
      });
    } catch (error) {
      setFormError(formMessage(error, t));
    }
  }, [values, lineDraft, write, existing, t, headers, onSaved, supplierLookup.canUseSupplierPicker]);

  return {
    isOpen,
    open: () => {
      if (write.isBlocked || !supplierLookup.canUseSupplierPicker) return;
      setFormError(null);
      setSelectedSupplierLabel(existing ? partyDisplayName(existing.partySnapshot) ?? "" : "");
      supplierLookup.searchSuppliers("");
      lineDraft.reset(
        existing
          ? existing.lines.map((line) => ({
              clientLineId: line.clientLineId,
              itemId: line.itemId,
              uomId: line.uomId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              isPricing: false,
              priceError: null,
            }))
          : [],
      );
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
      if (write.isBlocked) return;
      setIsOpen(false);
    },
    values,
    setValue: (patch) => {
      if (patch.supplierPartyId !== undefined) {
        setSelectedSupplierLabel(supplierLookup.suppliers.find((supplier) =>
          supplier.partyId === patch.supplierPartyId)?.displayName ?? "");
      }
      setValues((current) => ({ ...current, ...patch }));
    },
    ...supplierLookup,
    selectedSupplierLabel,
    lineDraft,
    write,
    formError,
    canSubmit:
      supplierLookup.canUseSupplierPicker &&
      linesReady &&
      values.supplierPartyId !== "" &&
      values.currencyCode.trim().length === 3 &&
      values.validUntil !== "" &&
      !write.isBlocked,
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
