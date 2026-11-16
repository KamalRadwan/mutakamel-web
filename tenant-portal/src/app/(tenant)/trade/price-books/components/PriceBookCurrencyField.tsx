"use client";

import { Combobox, ErrorState, Field, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCreatePriceBookForm } from "../hooks/useCreatePriceBookForm";

interface PriceBookCurrencyFieldProps {
  form: ReturnType<typeof useCreatePriceBookForm>;
  disabled: boolean;
}

export function PriceBookCurrencyField({ form, disabled }: PriceBookCurrencyFieldProps) {
  const { t } = useI18n();
  const { currencies, selectedCurrency } = form;
  const denied = !currencies.canRead || currencies.error?.status === 403;
  const errorContent = denied ? (
    <PermissionGate denied require="currencies.currency.read">{null}</PermissionGate>
  ) : currencies.error ? (
    <ErrorState title={t.coreSettings.currencyLoadFailed} description={currencies.error.message} onRetry={currencies.retry} retryLabel={t.common.retry} />
  ) : undefined;

  if (errorContent) return <div role="group" aria-label={t.tradePricing.currencyCode}>{errorContent}</div>;

  return (
    <Field label={t.tradePricing.currencyCode} showLabel required>
      <Combobox
        value={selectedCurrency?.id}
        selectedLabel={selectedCurrency ? `${selectedCurrency.name} (${selectedCurrency.code})` : undefined}
        onValueChange={form.selectCurrency}
        options={currencies.options}
        onSearch={currencies.setSearch}
        debounceMs={0}
        loading={currencies.loading}
        placeholder={t.tradePricing.currencySelect}
        searchPlaceholder={t.coreSettings.currencySearch}
        loadingLabel={t.common.loading}
        emptyLabel={t.coreSettings.currencyEmpty}
        disabled={disabled}
        wrapLabels
      />
    </Field>
  );
}
