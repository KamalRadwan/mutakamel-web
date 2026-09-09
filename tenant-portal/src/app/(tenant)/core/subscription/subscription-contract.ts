import { invalidBillingResponse } from "../billing/billing-validation";

/** Existing V1 seat-increase DTO remains capped at100000; no new financial command is introduced here. */
export const SUBSCRIPTION_SEATS_MAX = 100_000;

export function safeCount(source: Record<string, unknown>, key: string, maximum: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) invalidBillingResponse();
  return value as number;
}
