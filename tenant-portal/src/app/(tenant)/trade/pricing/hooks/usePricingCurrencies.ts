"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadActiveCurrencyOptions,
  type CurrencyOption,
} from "@/app/(tenant)/core/contracts/currency-options";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import type { PricingReferenceData } from "../../price-books/pricing-contract";

interface CurrencyDirectory {
  key: string;
  items: CurrencyOption[];
  error: NormalizedApiError | null;
}

interface ActivePricingCurrency {
  code: string;
  name: string;
  isDefault: boolean;
}

/**
 * Loads configured active currencies from Core's paginated currency directory,
 * with fallback to Trade's `/pricing/reference-data` active currency list when
 * the actor holds `trade.pricing.read` without `currencies.currency.read`.
 * Never hardcodes ISO currency presets.
 */
export function usePricingCurrencies(
  referenceCurrencies?: PricingReferenceData["currencies"],
  isLoadingRefData = false,
) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { lang } = useI18n();
  const canReadCore = Boolean(user?.isTenantOwner || can(user, "currencies.currency.read"));
  const key = user?.id && canReadCore ? JSON.stringify([user.id, realtimeAuthGeneration]) : null;

  const [directory, setDirectory] = useState<CurrencyDirectory | null>(null);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void loadActiveCurrencyOptions(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setDirectory({ key, items, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDirectory({ key, items: [], error: normalizeApiError(error) });
        }
      });
    return () => controller.abort();
  }, [key, revision]);

  const settled = key && directory?.key === key ? directory : null;

  const currencies = useMemo<ActivePricingCurrency[]>(() => {
    if (settled && settled.items.length > 0) {
      return settled.items.map((item) => ({
        code: item.code,
        name: item.name,
        isDefault: item.isDefault,
      }));
    }
    if (referenceCurrencies && referenceCurrencies.length > 0) {
      return referenceCurrencies.map((item) => ({
        code: item.code,
        name: item.name,
        isDefault: item.isDefault,
      }));
    }
    return [];
  }, [settled, referenceCurrencies]);

  const query = search.trim().toLocaleLowerCase(lang);
  const options = useMemo(
    () =>
      currencies
        .filter((currency) =>
          `${currency.name} ${currency.code}`.toLocaleLowerCase(lang).includes(query),
        )
        .map((currency) => ({
          value: currency.code,
          label: `${currency.name} (${currency.code})`,
        })),
    [currencies, lang, query],
  );

  const hasFallbackSource = referenceCurrencies !== undefined;

  return {
    currencies,
    options,
    canRead: !user || canReadCore || hasFallbackSource || isLoadingRefData,
    error: hasFallbackSource ? null : (settled?.error ?? null),
    loading: Boolean((key && !settled && !hasFallbackSource) || (!canReadCore && isLoadingRefData)),
    setSearch,
    retry: () => {
      setDirectory(null);
      setRevision((current) => current + 1);
    },
  };
}
