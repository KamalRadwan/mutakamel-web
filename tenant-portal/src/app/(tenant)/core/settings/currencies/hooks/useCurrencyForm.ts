"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import type { CurrencyFormValues } from "../currency-contract";
import { deriveCurrencyMinorUnits } from "../iso4217-minor-units";
import { currencyMutationMessage } from "./currency-errors";
import {
  CURRENCY_FIELD_ORDER, currencyFieldLabel, isCurrencyRateRequired,
  resolveCreateCurrencyBaseMode, resolveServerCurrencyError, validateCurrencyField, validateCurrencyForm,
  type CreateCurrencyBaseMode, type CurrencyErrorSummaryItem, type CurrencyFieldErrors,
  type CurrencyFieldName, type CurrencyValidationContext,
} from "./currency-form-validation";
import type { BaseCurrencyStatus } from "./useBaseCurrency";

export interface CurrencyFieldRefs {
  code?: React.RefCallback<HTMLElement> | React.RefObject<HTMLInputElement | null>;
  name?: React.Ref<HTMLInputElement>;
  symbol?: React.Ref<HTMLInputElement>;
  decimalPlaces?: React.Ref<HTMLInputElement>;
  exchangeRate?: React.Ref<HTMLInputElement>;
}

interface UseCurrencyFormOptions {
  open: boolean;
  mode: "create" | "edit";
  initialValues: CurrencyFormValues;
  codeReadOnly: boolean;
  rateLocked: boolean;
  rateRequiredOnEdit?: boolean;
  baseStatus?: BaseCurrencyStatus;
  baseCurrencyCode?: string | null;
  isSubmitting: boolean;
  error: string | null;
  errorCode?: string | null;
  onClose: () => void;
  onSubmit: (values: CurrencyFormValues) => Promise<boolean>;
}

function areCurrencyValuesEqual(a: CurrencyFormValues, b: CurrencyFormValues): boolean {
  return (
    a.code === b.code && a.name === b.name && a.symbol === b.symbol &&
    a.decimalPlaces === b.decimalPlaces && a.exchangeRate === b.exchangeRate && a.isDefault === b.isDefault
  );
}

export function useCurrencyForm({
  open, mode, initialValues, codeReadOnly, rateLocked, rateRequiredOnEdit = false,
  baseStatus, baseCurrencyCode, isSubmitting, error, errorCode, onClose, onSubmit,
}: UseCurrencyFormOptions) {
  const { t } = useI18n();
  const anchorPrefix = useId();

  const [values, setValues] = useState<CurrencyFormValues>(initialValues);
  const [blurredFields, setBlurredFields] = useState<Partial<Record<CurrencyFieldName, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [localSubmitPending, setLocalSubmitPending] = useState(false);
  const [caughtError, setCaughtError] = useState<{ error: string; errorCode?: string } | null>(null);
  const [clearedServerFields, setClearedServerFields] = useState<Partial<Record<CurrencyFieldName, boolean>>>({});
  const [serverRequiresRate, setServerRequiresRate] = useState(false);

  const inFlightRef = useRef(false);
  const elementsRef = useRef<Partial<Record<CurrencyFieldName, HTMLElement | null>>>({});

  const fieldRefs = useMemo<CurrencyFieldRefs>(
    () => ({
      code: (node) => { elementsRef.current.code = node; },
      name: (node) => { elementsRef.current.name = node; },
      symbol: (node) => { elementsRef.current.symbol = node; },
      decimalPlaces: (node) => { elementsRef.current.decimalPlaces = node; },
      exchangeRate: (node) => { elementsRef.current.exchangeRate = node; },
    }),
    [],
  );

  const anchorIds = useMemo<Record<CurrencyFieldName, string>>(
    () => ({
      code: `${anchorPrefix}-code`, name: `${anchorPrefix}-name`, symbol: `${anchorPrefix}-symbol`,
      decimalPlaces: `${anchorPrefix}-decimalPlaces`, exchangeRate: `${anchorPrefix}-exchangeRate`,
    }),
    [anchorPrefix],
  );

  const resetFormState = () => {
    setValues(initialValues);
    setBlurredFields({});
    setSubmitAttempted(false);
    setCaughtError(null);
    setClearedServerFields({});
    setServerRequiresRate(false);
  };

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) resetFormState();
  }

  const serverSignature = `${error ?? ""}::${errorCode ?? ""}`;
  const [lastServerSignature, setLastServerSignature] = useState(serverSignature);
  if (lastServerSignature !== serverSignature) {
    setLastServerSignature(serverSignature);
    setClearedServerFields({});
    if (error || errorCode) setCaughtError(null);
  }

  const rawBaseMode: CreateCurrencyBaseMode =
    mode === "create" ? resolveCreateCurrencyBaseMode(baseStatus, baseCurrencyCode) : "existing-base";
  const rawContext: CurrencyValidationContext = {
    mode, codeReadOnly, rateLocked, rateRequiredOnEdit, baseMode: rawBaseMode,
    initialExchangeRate: mode === "edit" ? initialValues.exchangeRate : null,
  };

  const resolvedServer = resolveServerCurrencyError({
    error: caughtError?.error ?? error, errorCode: caughtError?.errorCode ?? errorCode,
    context: rawContext, t,
  });

  if (mode === "create" && resolvedServer.field === "exchangeRate" && !serverRequiresRate) {
    setServerRequiresRate(true);
  }

  const baseMode: CreateCurrencyBaseMode =
    serverRequiresRate && rawBaseMode === "first-currency" ? "existing-base" : rawBaseMode;
  const validationContext: CurrencyValidationContext = { ...rawContext, baseMode };
  const isFirstCurrency = mode === "create" && baseMode === "first-currency";
  const rateRequired = isCurrencyRateRequired({
    mode, rateLocked: rateLocked || isFirstCurrency, rateRequiredOnEdit, isDefault: values.isDefault, baseMode,
  });

  const allClientErrors = validateCurrencyForm(values, validationContext, t);
  const activeServerField =
    resolvedServer.field && !clearedServerFields[resolvedServer.field] ? resolvedServer.field : undefined;

  const fieldErrors: CurrencyFieldErrors = {};
  for (const field of CURRENCY_FIELD_ORDER) {
    const clientMessage = submitAttempted || blurredFields[field] ? allClientErrors[field] : undefined;
    const serverMessage = activeServerField === field ? resolvedServer.message : undefined;
    const combined = clientMessage ?? serverMessage;
    if (combined) fieldErrors[field] = combined;
  }

  const showSummary = submitAttempted || Boolean(activeServerField);
  const errorSummary: CurrencyErrorSummaryItem[] = showSummary
    ? CURRENCY_FIELD_ORDER.filter((field) => Boolean(fieldErrors[field])).map((field) => ({
        field, label: currencyFieldLabel(field, t), anchorId: anchorIds[field],
      }))
    : [];

  const busy = isSubmitting || localSubmitPending;
  const isDirty = !areCurrencyValuesEqual(values, initialValues);
  const generalError = resolvedServer.generalError;

  const focusField = (field: CurrencyFieldName) => {
    const control = elementsRef.current[field];
    if (!control) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView?.({ block: "nearest" });
  };

  const handleOpenAutoFocus = (event: Event) => {
    const target = codeReadOnly ? elementsRef.current.name : elementsRef.current.code;
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open || busy || !activeServerField) return;
    const control = elementsRef.current[activeServerField];
    if (!control) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView?.({ block: "nearest" });
  }, [open, busy, activeServerField, resolvedServer.message]);

  const handleChange = (patch: Partial<CurrencyFormValues>) => {
    let normalizedPatch: Partial<CurrencyFormValues> = patch;
    if (patch.code !== undefined) {
      const nextCode = patch.code.toUpperCase();
      const derived = deriveCurrencyMinorUnits(nextCode);
      normalizedPatch = { ...patch, code: nextCode, decimalPlaces: derived === null ? "" : String(derived) };
    }
    setValues((current) => ({ ...current, ...normalizedPatch }));
    setCaughtError(null);

    const clearedKeys = CURRENCY_FIELD_ORDER.filter((key) => key in normalizedPatch);
    if ("isDefault" in normalizedPatch && !clearedKeys.includes("exchangeRate")) {
      clearedKeys.push("exchangeRate");
    }
    if (clearedKeys.length > 0) {
      setClearedServerFields((current) => {
        const next = { ...current };
        for (const key of clearedKeys) next[key] = true;
        return next;
      });
    }
  };

  const handleBlur = (field: CurrencyFieldName) => {
    if (validateCurrencyField(field, values, validationContext, t)) {
      setBlurredFields((current) => (current[field] ? current : { ...current, [field]: true }));
    }
  };

  const handleSubmit = async () => {
    if (busy || inFlightRef.current) return;
    setSubmitAttempted(true);
    setCaughtError(null);
    setClearedServerFields({});

    const nextClientErrors = validateCurrencyForm(values, validationContext, t);
    const firstInvalid = CURRENCY_FIELD_ORDER.find((field) => Boolean(nextClientErrors[field]));
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    const submissionValues = isFirstCurrency ? { ...values, exchangeRate: "", isDefault: true } : values;
    inFlightRef.current = true;
    setLocalSubmitPending(true);
    try {
      const saved = await onSubmit(submissionValues);
      if (saved && mode === "create") {
        setValues(initialValues);
        setBlurredFields({});
        setSubmitAttempted(false);
        setServerRequiresRate(false);
      }
    } catch (err) {
      const normalized = normalizeApiError(err);
      const rawCode =
        normalized.code ??
        (err instanceof Error && /^CURRENCY_[A-Z0-9_]+$/u.test(err.message) ? err.message : undefined);
      const specific = currencyMutationMessage(rawCode, t);
      const fallback =
        normalized.status === 0 && !rawCode
          ? t.coreIdentity.errors.OFFLINE
          : mode === "edit" ? t.coreSettings.currencyUpdateFailed : t.coreSettings.currencyCreateFailed;
      setCaughtError({ error: specific ?? fallback, errorCode: rawCode });
    } finally {
      inFlightRef.current = false;
      setLocalSubmitPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || busy || inFlightRef.current) return;
    resetFormState();
    onClose();
  };

  return {
    values, busy, isDirty, isFirstCurrency, rateRequired, fieldErrors, errorSummary, generalError,
    anchorIds, fieldRefs, handleChange, handleBlur, focusField, handleOpenAutoFocus, handleSubmit, handleOpenChange,
  };
}
