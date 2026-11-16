"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadActiveCurrencyOptions } from "@/app/(tenant)/core/contracts/currency-options";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import { record, tradeInvalidResponse } from "../../documents/trade-document-contract";
import { PRICING_REFERENCE_DATA_PATH } from "../../price-books/pricing-contract";

export interface QuotationCurrency { code: string; name: string; isDefault: boolean }
interface CurrencyDirectory { key: string; currencies: QuotationCurrency[]; error: NormalizedApiError | null }

export function useQuotationCurrencies(headers: Record<string, string>, enabled: boolean) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const companyId = headers[COMPANY_SCOPE_HEADER];
  const coreRead = Boolean(user?.isTenantOwner
    || (user?.permissions?.length && can(user, "currencies.currency.read")));
  const tradeRead = Boolean(isUUIDv7(companyId) && user?.featureEntitlements?.["trade.pricing"]
    && (user.isTenantOwner || (user.permissions?.length && can(user, "trade.pricing.read", { companyId }))));
  const source = coreRead ? "CORE" : tradeRead ? "TRADE" : null;
  const [revision, setRevision] = useState(0);
  const [directory, setDirectory] = useState<CurrencyDirectory | null>(null);
  const key = enabled && user?.id && source
    ? JSON.stringify([user.id, realtimeAuthGeneration, source, source === "TRADE" ? companyId : null, revision]) : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const load = async (): Promise<QuotationCurrency[]> => {
      if (source === "CORE") return (await loadActiveCurrencyOptions(controller.signal))
        .filter((currency) => currency.status === "ACTIVE")
        .map(({ code, name, isDefault }) => ({ code, name, isDefault }));
      // PricingReadController requires exactly Company scope and trade.pricing.
      const response = await tradeGet(PRICING_REFERENCE_DATA_PATH, {
        signal: controller.signal, headers: { [COMPANY_SCOPE_HEADER]: companyId }, maxResponseBytes: 2_000_000,
      });
      return parseTradeCurrencies(response.data);
    };
    void load().then((currencies) => {
      if (!controller.signal.aborted) setDirectory({ key, currencies, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setDirectory({ key, currencies: [], error: normalizeApiError(error) });
    });
    return () => controller.abort();
  }, [companyId, key, source]);

  const visible = key && directory?.key === key ? directory : null;
  const currencies = useMemo(() => visible?.currencies ?? [], [visible]);
  const options = useMemo(() => currencies.map((currency) => ({
    value: currency.code, label: `${currency.name} (${currency.code})`,
  })), [currencies]);
  const retry = useCallback(() => setRevision((current) => current + 1), []);
  return { currencies, options, canRead: Boolean(source), loading: Boolean(key && !visible),
    error: visible?.error ?? null, retry,
    defaultCode: currencies.find((currency) => currency.isDefault)?.code ?? currencies[0]?.code ?? "" };
}

function parseTradeCurrencies(payload: unknown): QuotationCurrency[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.currencies)) tradeInvalidResponse();
  return body.currencies.map((value) => {
    const currency = record(value);
    if (!currency || typeof currency.code !== "string" || !/^[A-Z]{3}$/u.test(currency.code)
      || typeof currency.name !== "string" || !currency.name || currency.name.length > 80
      || typeof currency.isDefault !== "boolean") tradeInvalidResponse();
    return { code: currency.code, name: currency.name, isDefault: currency.isDefault };
  });
}
