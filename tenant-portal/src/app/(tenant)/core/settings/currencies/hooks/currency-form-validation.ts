import type { Dictionary } from "@/i18n/dictionaries/ar";
import {
  CURRENCY_CODE_INVALID_CODE,
  CURRENCY_CODE_LENGTH,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE,
  CURRENCY_NAME_MAX_LENGTH,
  CURRENCY_PRECISION_MISMATCH_CODE,
  CURRENCY_RATE_REQUIRED_CODE,
  CURRENCY_REBASE_OUT_OF_RANGE_CODE,
  CURRENCY_REBASE_PRECISION_LOSS_CODE,
  CURRENCY_SYMBOL_MAX_LENGTH,
  hasValidSavedExchangeRate,
  isValidTypedExchangeRate,
  type CurrencyFormValues,
} from "../currency-contract";
import { currencyMutationMessage } from "./currency-errors";
import type { BaseCurrencyStatus } from "./useBaseCurrency";

export type CurrencyFieldName = "code" | "name" | "symbol" | "decimalPlaces" | "exchangeRate";

export const CURRENCY_FIELD_ORDER: readonly CurrencyFieldName[] = [
  "code",
  "name",
  "symbol",
  "decimalPlaces",
  "exchangeRate",
];

export type CurrencyFieldErrors = Partial<Record<CurrencyFieldName, string>>;
export type CreateCurrencyBaseMode = "existing-base" | "first-currency" | "unknown";

export interface CurrencyErrorSummaryItem {
  field: CurrencyFieldName;
  label: string;
  anchorId: string;
}

export interface CurrencyValidationContext {
  mode: "create" | "edit";
  codeReadOnly: boolean;
  rateLocked: boolean;
  rateRequiredOnEdit: boolean;
  baseMode?: CreateCurrencyBaseMode;
  initialExchangeRate?: string | null;
}

export function resolveCreateCurrencyBaseMode(
  baseStatus?: BaseCurrencyStatus,
  baseCurrencyCode?: string | null,
): CreateCurrencyBaseMode {
  const hasBaseCode = typeof baseCurrencyCode === "string" && baseCurrencyCode.trim().length > 0;
  if (baseStatus === "ready") return hasBaseCode ? "existing-base" : "first-currency";
  if (baseStatus === undefined && hasBaseCode) return "existing-base";
  return "unknown";
}

export function isCurrencyRateRequired(options: {
  mode: "create" | "edit";
  rateLocked: boolean;
  rateRequiredOnEdit: boolean;
  isDefault: boolean;
  baseMode?: CreateCurrencyBaseMode;
}): boolean {
  if (options.rateLocked) return false;
  if (options.mode === "edit") return options.rateRequiredOnEdit;
  if (options.baseMode === "existing-base") return true;
  if (options.baseMode === "first-currency") return false;
  return !options.isDefault;
}

interface ResolvedCurrencyServerError {
  field?: CurrencyFieldName;
  message?: string;
  generalError?: string;
}

export function currencyFieldLabel(field: CurrencyFieldName, t: Dictionary): string {
  switch (field) {
    case "code": return t.coreSettings.currencyCode;
    case "name": return t.coreSettings.currencyName;
    case "symbol": return t.coreSettings.currencySymbol;
    case "decimalPlaces": return t.coreSettings.currencyDecimalPlaces;
    case "exchangeRate": return t.coreSettings.currencyExchangeRate;
  }
}

export function validateCurrencyField(
  field: CurrencyFieldName,
  values: CurrencyFormValues,
  context: CurrencyValidationContext,
  t: Dictionary,
): string | undefined {
  switch (field) {
    case "code": {
      if (context.codeReadOnly) return undefined;
      const code = values.code.trim().toUpperCase();
      if (code.length !== CURRENCY_CODE_LENGTH || !/^[A-Z]{3}$/u.test(code)) {
        return t.coreSettings.currencyFormCode;
      }
      return undefined;
    }
    case "name": {
      const name = values.name.trim();
      if (name.length === 0 || name.length > CURRENCY_NAME_MAX_LENGTH) {
        return t.coreSettings.currencyFormName;
      }
      return undefined;
    }
    case "symbol": {
      if (values.symbol.trim().length > CURRENCY_SYMBOL_MAX_LENGTH) {
        return t.coreSettings.currencyFormSymbol;
      }
      return undefined;
    }
    case "decimalPlaces":
      return undefined;
    case "exchangeRate": {
      if (context.rateLocked) return undefined;
      if (context.mode === "create" && context.baseMode === "first-currency") {
        return undefined;
      }
      const trimmed = values.exchangeRate.trim();
      const rateRequired = isCurrencyRateRequired({
        mode: context.mode,
        rateLocked: context.rateLocked,
        rateRequiredOnEdit: context.rateRequiredOnEdit,
        isDefault: values.isDefault,
        baseMode: context.baseMode,
      });
      if (trimmed.length === 0) {
        return rateRequired ? t.coreSettings.currencyRateRequired : undefined;
      }
      const initialTrimmed = context.initialExchangeRate?.trim() ?? "";
      // PostgreSQL `numeric(18,8)` rebasing can produce valid stored rates above
      // the new-input DTO ceiling (`1e9`). Keep an unchanged stored rate valid
      // without `Number()` coercion so name/symbol-only edits omit `exchangeRate`.
      if (
        context.mode === "edit" &&
        initialTrimmed.length > 0 &&
        trimmed === initialTrimmed &&
        hasValidSavedExchangeRate(trimmed)
      ) {
        return undefined;
      }
      if (!isValidTypedExchangeRate(trimmed)) {
        return t.coreSettings.currencyFormRate;
      }
      return undefined;
    }
  }
}

export function validateCurrencyForm(
  values: CurrencyFormValues,
  context: CurrencyValidationContext,
  t: Dictionary,
): CurrencyFieldErrors {
  const errors: CurrencyFieldErrors = {};
  for (const field of CURRENCY_FIELD_ORDER) {
    const message = validateCurrencyField(field, values, context, t);
    if (message) errors[field] = message;
  }
  return errors;
}

function isFieldEditable(field: CurrencyFieldName, context: CurrencyValidationContext): boolean {
  if (field === "code") return !context.codeReadOnly;
  if (field === "decimalPlaces") return false;
  if (field === "exchangeRate") return !context.rateLocked;
  return true;
}

function matchesPrefix(actual: string, candidate: string): boolean {
  return candidate.length > 0 && (actual === candidate || actual.startsWith(`${candidate} `));
}

function resolveByCode(
  code: string,
  fallbackText: string | undefined,
  context: CurrencyValidationContext,
  t: Dictionary,
): ResolvedCurrencyServerError | null {
  switch (code) {
    case CURRENCY_CODE_TAKEN_CODE:
    case CURRENCY_CODE_INVALID_CODE:
    case "CURRENCY_FORM_CODE": {
      const message =
        fallbackText && !fallbackText.startsWith("CURRENCY_")
          ? fallbackText
          : code === "CURRENCY_FORM_CODE"
            ? t.coreSettings.currencyFormCode
            : currencyMutationMessage(code, t) ?? t.coreSettings.currencyCodeInvalid;
      return isFieldEditable("code", context)
        ? { field: "code", message }
        : { generalError: message };
    }
    case "CURRENCY_FORM_NAME": {
      const message = fallbackText && fallbackText !== code ? fallbackText : t.coreSettings.currencyFormName;
      return { field: "name", message };
    }
    case "CURRENCY_FORM_SYMBOL": {
      const message = fallbackText && fallbackText !== code ? fallbackText : t.coreSettings.currencyFormSymbol;
      return { field: "symbol", message };
    }
    case CURRENCY_PRECISION_MISMATCH_CODE:
    case CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE:
    case "CURRENCY_FORM_DECIMALS": {
      const message =
        fallbackText && !fallbackText.startsWith("CURRENCY_")
          ? fallbackText
          : code === "CURRENCY_FORM_DECIMALS"
            ? t.coreSettings.currencyFormDecimals
            : currencyMutationMessage(code, t) ?? t.coreSettings.currencyPrecisionMismatch;
      return code !== CURRENCY_DECIMAL_PLACES_IMMUTABLE_CODE && isFieldEditable("decimalPlaces", context)
        ? { field: "decimalPlaces", message }
        : { generalError: message };
    }
    case CURRENCY_RATE_REQUIRED_CODE:
    case CURRENCY_REBASE_OUT_OF_RANGE_CODE:
    case CURRENCY_REBASE_PRECISION_LOSS_CODE:
    case "CURRENCY_FORM_RATE": {
      const message =
        fallbackText && !fallbackText.startsWith("CURRENCY_")
          ? fallbackText
          : code === "CURRENCY_FORM_RATE"
            ? t.coreSettings.currencyFormRate
            : currencyMutationMessage(code, t) ?? t.coreSettings.currencyFormRate;
      return isFieldEditable("exchangeRate", context)
        ? { field: "exchangeRate", message }
        : { generalError: message };
    }
    default: {
      const mapped = currencyMutationMessage(code, t);
      if (mapped) return { generalError: fallbackText && !fallbackText.startsWith("CURRENCY_") ? fallbackText : mapped };
      return null;
    }
  }
}

/**
 * Surfaces duplicate, ISO-4217, minor-unit precision, and rate/rebase errors on
 * the editable field they belong to when existing error metadata or localized
 * copy identifies that field; preserves a general safe banner otherwise.
 */
export function resolveServerCurrencyError(options: {
  error: string | null | undefined;
  errorCode?: string | null;
  context: CurrencyValidationContext;
  t: Dictionary;
}): ResolvedCurrencyServerError {
  const { error, errorCode, context, t } = options;
  const trimmedError = error?.trim() ?? "";
  const trimmedCode = errorCode?.trim() ?? "";

  if (!trimmedError && !trimmedCode) return {};

  const candidateCode = trimmedCode || (/^[A-Z][A-Z0-9_]+$/u.test(trimmedError) ? trimmedError : "");
  if (candidateCode) {
    const byCode = resolveByCode(candidateCode, trimmedError || undefined, context, t);
    if (byCode) return byCode;
  }

  if (!trimmedError) {
    return {
      generalError:
        context.mode === "edit"
          ? t.coreSettings.currencyUpdateFailed
          : t.coreSettings.currencyCreateFailed,
    };
  }

  const textFieldPairs: readonly [CurrencyFieldName, readonly string[]][] = [
    ["code", [t.coreSettings.currencyCodeTaken, t.coreSettings.currencyCodeInvalid, t.coreSettings.currencyFormCode]],
    ["name", [t.coreSettings.currencyFormName]],
    ["symbol", [t.coreSettings.currencyFormSymbol]],
    ["decimalPlaces", [t.coreSettings.currencyPrecisionMismatch, t.coreSettings.currencyFormDecimals]],
    [
      "exchangeRate",
      [
        t.coreSettings.currencyRateRequired,
        t.coreSettings.currencyRebaseOutOfRange,
        t.coreSettings.currencyRebasePrecisionLoss,
        t.coreSettings.currencyFormRate,
      ],
    ],
  ];

  for (const [field, candidates] of textFieldPairs) {
    if (candidates.some((candidate) => matchesPrefix(trimmedError, candidate))) {
      return isFieldEditable(field, context)
        ? { field, message: trimmedError }
        : { generalError: trimmedError };
    }
  }

  return { generalError: trimmedError };
}
