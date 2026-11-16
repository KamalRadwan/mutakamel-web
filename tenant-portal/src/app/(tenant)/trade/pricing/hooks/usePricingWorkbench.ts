"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { formatTradeDecimal, isTradeDecimalString } from "../../trade-validation";
import { usePricingReferenceData } from "../../price-books/hooks/usePricingReferenceData";
import {
  isPriceBookPurpose,
  localizedBookDisplayName,
  localizedRecordName,
} from "../../price-books/pricing-contract";
import {
  buildPricingWaterfall,
  pricingDisplayTotals,
  resolveActiveScenarioPreset,
  resolvePublishedVersionNumber,
  resolveSourceTier,
  type PricingScenarioPreset,
} from "../pricing-display";
import { usePricingCurrencies } from "./usePricingCurrencies";
import { usePricingEvaluation, type EvaluateFormValues } from "./usePricingEvaluation";
import { usePricingScopeOptions } from "./usePricingScopeOptions";
import { usePricingUrlChannel } from "./usePricingUrlChannel";

export function usePricingWorkbench() {
  const evaluation = usePricingEvaluation();
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    values,
    result,
    evaluatedInputs,
    isEvaluating,
    setValue,
    reset: resetEvaluation,
    evaluate,
    applyPreset,
  } = evaluation;

  const {
    data: refData,
    books,
    isLoading: isLoadingRefData,
    itemById,
    uomById,
    bookById,
  } = usePricingReferenceData({ includeBooks: true });
  const currencies = usePricingCurrencies(refData?.currencies, isLoadingRefData);

  const handleScopeChannelSelected = useCallback(() => {
    if (values.channelId) setValue({ channelId: "" });
  }, [values.channelId, setValue]);
  const scopeOptions = usePricingScopeOptions({
    referenceBranches: refData?.branches,
    onChannelScopeChange: handleScopeChannelSelected,
  });

  const [itemSearch, setItemSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(() =>
    Boolean(values.priceBookId || values.pricingAt),
  );
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [showRawReceipt, setShowRawReceipt] = useState(false);
  const [hadCompleteUrlOnMount] = useState(() =>
    Boolean(
      values.itemId.trim() &&
        values.uomId.trim() &&
        values.quantity.trim() &&
        values.currencyCode.trim(),
    ),
  );
  const didRunUrlAutoEvalRef = useRef(false);

  usePricingUrlChannel(values.channelId, scopeOptions);

  const selectedExplicitBook = values.priceBookId ? bookById.get(values.priceBookId) : undefined;
  const defaultActiveCurrency = useMemo(
    () => currencies.currencies.find((c) => c.isDefault) ?? currencies.currencies[0],
    [currencies.currencies],
  );

  // Sync currency/purpose when deep-linked via `?priceBookId=...` or seed active default currency.
  useEffect(() => {
    if (selectedExplicitBook) {
      const nextPurpose = isPriceBookPurpose(selectedExplicitBook.purpose)
        ? selectedExplicitBook.purpose
        : values.purpose;
      if (
        values.purpose !== nextPurpose ||
        values.currencyCode.trim().toUpperCase() !== selectedExplicitBook.currencyCode
      ) {
        queueMicrotask(() => {
          setValue({ purpose: nextPurpose, currencyCode: selectedExplicitBook.currencyCode });
        });
      }
      return;
    }
    if (!values.currencyCode.trim() && defaultActiveCurrency) {
      queueMicrotask(() => setValue({ currencyCode: defaultActiveCurrency.code }));
    }
  }, [selectedExplicitBook, values.purpose, values.currencyCode, defaultActiveCurrency, setValue]);

  // Auto-evaluate at most once when navigated with full query parameters.
  useEffect(() => {
    if (!hadCompleteUrlOnMount || didRunUrlAutoEvalRef.current) return;
    if (!isScopeResolved || !canRead || isEvaluating || values.channelId) return;
    didRunUrlAutoEvalRef.current = true;
    queueMicrotask(() => void evaluate());
  }, [hadCompleteUrlOnMount, isScopeResolved, canRead, isEvaluating, values.channelId, evaluate]);

  const normalizedCurrency = values.currencyCode.trim().toUpperCase();

  // Explicit price book override must be ACTIVE and match purpose + currency.
  const eligibleBooks = useMemo(
    () =>
      books.filter(
        (book) =>
          book.status === "ACTIVE" &&
          book.purpose === values.purpose &&
          (!normalizedCurrency || book.currencyCode === normalizedCurrency),
      ),
    [books, values.purpose, normalizedCurrency],
  );

  const allItemOptions = useMemo(
    () =>
      (refData?.items ?? [])
        .filter((item) => (values.purpose === "PURCHASE" ? item.canPurchase : item.canSell))
        .map((item) => ({
          value: item.itemId,
          label: localizedRecordName(item.localizedNames, item.canonicalCode, lang),
          description: item.canonicalCode,
        })),
    [refData?.items, values.purpose, lang],
  );

  const itemOptions = useMemo(() => {
    const q = itemSearch.trim().toLocaleLowerCase(lang);
    return q
      ? allItemOptions.filter(
          (opt) =>
            opt.label.toLocaleLowerCase(lang).includes(q) ||
            (opt.description ?? "").toLocaleLowerCase(lang).includes(q),
        )
      : allItemOptions;
  }, [allItemOptions, itemSearch, lang]);

  const allAccountOptions = useMemo(
    () =>
      (refData?.commercialAccounts ?? [])
        .filter(
          (acc) =>
            acc.status === "ACTIVE" &&
            (values.purpose === "SALES"
              ? acc.accountRole !== "SUPPLIER"
              : acc.accountRole !== "CUSTOMER"),
        )
        .map((acc) => ({
          value: acc.partyId,
          label: acc.displayName,
          description:
            acc.accountRole === "CUSTOMER"
              ? t.tradePricing.accountRoleCustomer
              : acc.accountRole === "SUPPLIER"
                ? t.tradePricing.accountRoleSupplier
                : t.tradePricing.accountRoleBoth,
        })),
    [refData?.commercialAccounts, values.purpose, t.tradePricing],
  );

  const accountOptions = useMemo(() => {
    const q = accountSearch.trim().toLocaleLowerCase(lang);
    return q
      ? allAccountOptions.filter(
          (opt) =>
            opt.label.toLocaleLowerCase(lang).includes(q) ||
            (opt.description ?? "").toLocaleLowerCase(lang).includes(q),
        )
      : allAccountOptions;
  }, [allAccountOptions, accountSearch, lang]);

  const selectPurpose = useCallback(
    (next: EvaluateFormValues["purpose"]) => {
      const currentBook = values.priceBookId ? bookById.get(values.priceBookId) : undefined;
      const keepBook = !currentBook || currentBook.purpose === next;
      const currentAccount = values.partyId
        ? (refData?.commercialAccounts ?? []).find((acc) => acc.partyId === values.partyId)
        : undefined;
      const keepAccount =
        !currentAccount ||
        (next === "SALES"
          ? currentAccount.accountRole !== "SUPPLIER"
          : currentAccount.accountRole !== "CUSTOMER");
      setValue({
        purpose: next,
        ...(keepBook ? {} : { priceBookId: "" }),
        ...(keepAccount ? {} : { partyId: "" }),
      });
    },
    [values.priceBookId, values.partyId, bookById, refData?.commercialAccounts, setValue],
  );

  const selectCurrencyCode = useCallback(
    (nextCode: string | undefined) => {
      if (!nextCode) return;
      const upper = nextCode.trim().toUpperCase();
      const currentBook = values.priceBookId ? bookById.get(values.priceBookId) : undefined;
      setValue({
        currencyCode: upper,
        ...(!currentBook || currentBook.currencyCode === upper ? {} : { priceBookId: "" }),
      });
    },
    [values.priceBookId, bookById, setValue],
  );

  const selectItem = useCallback(
    (nextItemId: string | undefined) => {
      const itemId = nextItemId ?? "";
      const refItem = itemById.get(itemId);
      const preferredUom =
        values.purpose === "PURCHASE"
          ? (refItem?.defaultPurchaseUomId ?? refItem?.baseUomId ?? "")
          : (refItem?.defaultSalesUomId ?? refItem?.baseUomId ?? "");
      setValue({
        itemId,
        ...(preferredUom ? { uomId: preferredUom } : {}),
        ...(!values.quantity.trim() && itemId ? { quantity: "1" } : {}),
        ...(!values.currencyCode.trim() && refItem?.currencyCode
          ? { currencyCode: refItem.currencyCode }
          : {}),
      });
    },
    [itemById, values.purpose, values.quantity, values.currencyCode, setValue],
  );

  const normalizeQuantityBlur = useCallback(() => {
    const trimmed = values.quantity.trim();
    if (trimmed && isTradeDecimalString(trimmed)) setValue({ quantity: formatTradeDecimal(trimmed) });
  }, [values.quantity, setValue]);

  const selectScenarioPreset = useCallback(
    (preset: PricingScenarioPreset) => {
      selectPurpose("SALES");
      applyPreset(preset);
    },
    [selectPurpose, applyPreset],
  );

  const advancedSummaryText = useMemo(() => {
    const dateText = values.pricingAt?.trim()
      ? formatDateTime(values.pricingAt, lang)
      : t.tradePricing.evalDateNow;
    const bookText = selectedExplicitBook
      ? localizedBookDisplayName(selectedExplicitBook, lang)
      : values.priceBookId
        ? values.priceBookId.slice(0, 8)
        : t.tradePricing.evalPriceBookAutoShort;
    return formatTemplate(t.tradePricing.evalAdvancedSummary, { date: dateText, book: bookText });
  }, [values.pricingAt, values.priceBookId, selectedExplicitBook, lang, t.tradePricing]);

  const resolvedBook = result ? bookById.get(result.priceBookId) : undefined;
  const selectedCurrencyRecord = currencies.currencies.find((c) => c.code === normalizedCurrency);

  return {
    ...evaluation,
    scopeOptions,
    currencies,
    isLoadingRefData,
    selectedCurrencyLabel: selectedCurrencyRecord
      ? `${selectedCurrencyRecord.name} (${selectedCurrencyRecord.code})`
      : normalizedCurrency || undefined,
    uoms: refData?.uoms ?? [],
    selectedItem: values.itemId ? itemById.get(values.itemId) : undefined,
    allItemOptions,
    itemOptions,
    setItemSearch,
    allAccountOptions,
    accountOptions,
    setAccountSearch,
    eligibleBooks,
    activePreset: resolveActiveScenarioPreset(values.purpose, values.quantity),
    selectScenarioPreset,
    selectPurpose,
    selectCurrencyCode,
    selectItem,
    normalizeQuantityBlur,
    isAdvancedOpen,
    setIsAdvancedOpen,
    advancedSummaryText,
    isTraceOpen,
    setIsTraceOpen,
    showRawReceipt,
    setShowRawReceipt,
    totals:
      result && evaluatedInputs
        ? pricingDisplayTotals(result.baselineUnitPrice, result.unitPrice, evaluatedInputs.quantity)
        : { subtotal: "0", savings: "0" },
    waterfall: result ? buildPricingWaterfall(result) : null,
    resolvedBook,
    resolvedVersionNumber: resolvePublishedVersionNumber(result, resolvedBook),
    evaluatedItem: evaluatedInputs ? itemById.get(evaluatedInputs.itemId) : undefined,
    evaluatedUom: evaluatedInputs ? uomById.get(evaluatedInputs.uomId) : undefined,
    resolutionSourceTier: resolveSourceTier(evaluatedInputs),
    resetAll: () => {
      resetEvaluation(defaultActiveCurrency ? { currencyCode: defaultActiveCurrency.code } : undefined);
      setIsTraceOpen(false);
      setShowRawReceipt(false);
    },
  };
}
