import type { CorePath } from "@/lib/api/envelope";
import { isNonEmptyString, record } from "../../core-validation";

// The workspace default-currency selector, not the currency catalogue.
//
// `/core/settings/currencies` owns the management projection — rate, decimal
// places, default flag, status. This screen only needs the enabled codes to
// offer as `defaultCurrencyCode`, and validating only what it renders is the
// point: a reader here may not hold `currencies.currency.manage` at all.
export const CURRENCY_OPTIONS_PATH: CorePath =
  "/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC";

export interface CurrencyOption {
  code: string;
  name: string;
}

export function parseCurrencyOptionsResponse(payload: unknown): CurrencyOption[] {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) {
    throw new Error("Invalid Core currencies response.");
  }
  return page.items.map((item) => {
    const currency = record(item);
    if (!currency || !isNonEmptyString(currency.code, 3) || !isNonEmptyString(currency.name, 80)) {
      throw new Error("Invalid Core currencies response.");
    }
    return { code: currency.code, name: currency.name };
  });
}
