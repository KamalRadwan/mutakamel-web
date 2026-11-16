"use client";

import { useState } from "react";
import type { QuotationComposerState } from "./useQuotationComposer";
import { parseQuotationTerm, validQuotationDate } from "../quotation-composer-draft";
import { quotationDatePickerText, quotationDatePickerValue } from "../quotation-editor-values";

function snapshot(composer: QuotationComposerState) {
  return { currencyCode: composer.currencyCode, draftReference: composer.draftReference,
    validUntil: composer.validUntil, paymentTermCode: composer.paymentTermCode,
    incotermCode: composer.incotermCode, deliveryDays: composer.deliveryDays, warrantyMonths: composer.warrantyMonths };
}

export function useQuotationFieldEditor(composer: QuotationComposerState, kind: "document" | "terms") {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => snapshot(composer));
  const blocked = composer.write.isBlocked || composer.savingStep !== "idle";
  const headerLocked = composer.partialHeader !== null;
  const currencyKnown = headerLocked || composer.currencies.currencies.some((currency) => currency.code === draft.currencyCode);
  const dateValid = validQuotationDate(draft.validUntil);
  const deliveryValid = parseQuotationTerm(draft.deliveryDays, 14) !== null;
  const warrantyValid = parseQuotationTerm(draft.warrantyMonths, 12) !== null;
  const canApply = !blocked && (kind === "document" ? currencyKnown && dateValid && draft.draftReference.length <= 80
    : deliveryValid && warrantyValid && draft.paymentTermCode.length <= 80 && draft.incotermCode.length <= 80);
  return { open, draft, blocked, headerLocked, canApply, dateValid, deliveryValid, warrantyValid,
    dateValue: quotationDatePickerValue(draft.validUntil),
    show: () => { if (!blocked) { setDraft(snapshot(composer)); setOpen(true); } },
    setOpen: (value: boolean) => { if (!blocked) setOpen(value); },
    change: (patch: Partial<ReturnType<typeof snapshot>>) => setDraft((previous) => ({ ...previous, ...patch })),
    selectDate: (value: Date | undefined) => setDraft((previous) => ({ ...previous, validUntil: quotationDatePickerText(value) })),
    apply: () => {
      if (!canApply) return;
      if (kind === "document") {
        if (!headerLocked) { composer.setCurrencyCode(draft.currencyCode); composer.setDraftReference(draft.draftReference); }
        composer.setValidUntil(draft.validUntil);
      } else {
        composer.setPaymentTermCode(draft.paymentTermCode); composer.setIncotermCode(draft.incotermCode);
        composer.setDeliveryDays(draft.deliveryDays); composer.setWarrantyMonths(draft.warrantyMonths);
      }
      setOpen(false);
    },
  };
}

export type QuotationFieldEditorState = ReturnType<typeof useQuotationFieldEditor>;
