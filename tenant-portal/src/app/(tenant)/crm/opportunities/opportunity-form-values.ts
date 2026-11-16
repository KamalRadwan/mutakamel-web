import { isExactMoneyDecimal, toMoneyWireNumber } from "../shared/money";

// crm-app/src/crm/opportunities/dto/opportunity.dto.ts:7, narrower than numeric(20,3).
const MAX_WHOLE = "8796093022207";

export function isValidOpportunityAmount(value: string, currencyCode = ""): boolean {
  if (!isExactMoneyDecimal(value, currencyCode)) return false;
  return withinAmountCap(value);
}

function withinAmountCap(value: string): boolean {
  const whole = value.trim().split(".")[0].replace(/^0+(?=\d)/, "");
  return whole.length < MAX_WHOLE.length || (whole.length === MAX_WHOLE.length && whole <= MAX_WHOLE);
}

export function opportunityAmountNumber(value: string, currencyCode: string): number | undefined {
  if (value.trim() && !currencyCode.trim()) throw new Error("OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED");
  if (!withinAmountCap(value)) throw new Error("CRM_AMOUNT_OUT_OF_SAFE_RANGE");
  return toMoneyWireNumber(value, currencyCode);
}

export function isValidOpportunityCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value.trim().toUpperCase());
}

/** A date-only value is a real Gregorian date, never a UTC timestamp. */
export function isValidOpportunityDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function opportunityOptionalInteger(value: string, min: number, max: number): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+$/.test(value.trim())) throw new Error("CRM_VALUE_OUT_OF_RANGE");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error("CRM_VALUE_OUT_OF_RANGE");
  return parsed;
}
