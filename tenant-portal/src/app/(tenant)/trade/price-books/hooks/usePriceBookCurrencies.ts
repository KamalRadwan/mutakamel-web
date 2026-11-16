"use client";

import { useEffect, useState } from "react";
import { loadActiveCurrencyOptions, type CurrencyOption } from "@/app/(tenant)/core/contracts/currency-options";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";

interface CurrencyDirectory {
  key: string;
  items: CurrencyOption[];
  error: NormalizedApiError | null;
}

export function usePriceBookCurrencies(enabled: boolean) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { lang } = useI18n();
  const canRead = Boolean(user?.isTenantOwner || can(user, "currencies.currency.read"));
  const key = user?.id && canRead ? JSON.stringify([user.id, realtimeAuthGeneration]) : null;
  const [directory, setDirectory] = useState<CurrencyDirectory | null>(null);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled || !key) return;
    const controller = new AbortController();
    void loadActiveCurrencyOptions(controller.signal).then((items) => {
      if (!controller.signal.aborted) setDirectory({ key, items, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setDirectory({ key, items: [], error: normalizeApiError(error) });
    });
    return () => controller.abort();
  }, [enabled, key, revision]);

  const settled = key && directory?.key === key ? directory : null;
  const currencies = settled?.items ?? [];
  const query = search.trim().toLocaleLowerCase(lang);
  const options = currencies
    .filter((currency) => `${currency.name} ${currency.code}`.toLocaleLowerCase(lang).includes(query))
    .map((currency) => ({ value: currency.id, label: `${currency.name} (${currency.code})` }));

  return {
    currencies, options, canRead, error: settled?.error,
    loading: Boolean(enabled && key && !settled), setSearch,
    retry: () => { setDirectory(null); setRevision((current) => current + 1); },
  };
}
