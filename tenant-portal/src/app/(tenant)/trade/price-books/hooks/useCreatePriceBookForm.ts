"use client";

import { useState } from "react";
import { EMPTY_PRICE_BOOK_FORM, type PriceBook, type PriceBookFormValues, type PriceBookPurpose } from "../pricing-contract";
import { usePriceBookCurrencies } from "./usePriceBookCurrencies";

interface CreatePriceBookFormOptions {
  isOpen: boolean;
  initialPurpose?: PriceBookPurpose;
  initialCurrencyCode?: string;
  initialSetDefault?: boolean;
  existingBooks: PriceBook[];
  onSubmit: (values: PriceBookFormValues) => Promise<boolean>;
  onClose: () => void;
}

export function useCreatePriceBookForm({
  isOpen, initialPurpose, initialCurrencyCode, initialSetDefault = false,
  existingBooks, onSubmit, onClose,
}: CreatePriceBookFormOptions) {
  const currencies = usePriceBookCurrencies(isOpen);
  const initialValues: PriceBookFormValues = {
    ...EMPTY_PRICE_BOOK_FORM,
    purpose: initialPurpose ?? EMPTY_PRICE_BOOK_FORM.purpose,
    currencyCode: initialCurrencyCode ?? "",
    seedMode: "CLONE", setAsCompanyDefault: initialSetDefault,
  };
  const [draft, setValues] = useState(initialValues);
  const selectedCurrency = draft.currencyCode
    ? currencies.currencies.find((currency) => currency.code === draft.currencyCode)
    : currencies.currencies.find((currency) => currency.isDefault) ?? currencies.currencies[0];
  const values = { ...draft, currencyCode: selectedCurrency?.code ?? "" };
  const compatibleSourceBooks = existingBooks.filter((book) =>
    book.purpose === values.purpose && book.currencyCode === values.currencyCode && book.versions.length > 0);
  const selectedSourceBook = compatibleSourceBooks.find((book) => book.id === values.sourceBookId) ?? compatibleSourceBooks[0];

  function selectCurrency(id: string | undefined) {
    const currency = currencies.currencies.find((option) => option.id === id);
    if (!currency) return;
    setValues((current) => ({ ...current, currencyCode: currency.code, sourceBookId: "", sourceVersionId: "" }));
  }

  function submit() {
    if (!selectedCurrency || currencies.loading || currencies.error || !currencies.canRead) return;
    const effectiveValues = values.seedMode === "CLONE" && !values.sourceVersionId && selectedSourceBook?.versions[0]
      ? { ...values, sourceBookId: selectedSourceBook.id, sourceVersionId: selectedSourceBook.versions[0].id }
      : values;
    void onSubmit(effectiveValues);
  }

  return {
    values, setValues, currencies, selectedCurrency, selectCurrency,
    compatibleSourceBooks, selectedSourceBook, submit,
    submitDisabled: !selectedCurrency || currencies.loading || Boolean(currencies.error) || !currencies.canRead,
    isDirty: values.code.trim().length > 0 || Boolean(values.nameAr?.trim() || values.nameEn?.trim()),
    onOpenChange: (open: boolean) => { if (!open) { setValues(initialValues); onClose(); } },
  };
}
