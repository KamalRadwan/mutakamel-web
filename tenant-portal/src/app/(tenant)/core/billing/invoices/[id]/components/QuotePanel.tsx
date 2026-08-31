"use client";

import { AlertTriangle, Calculator, CreditCard } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DegradedBanner,
  ErrorState,
  Field,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { formatDecimalString } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { formatCountdown, useCountdown } from "../../../../hooks/useCountdown";
import type { InvoicePaymentQuote, PaymentInputCurrencies } from "../../../payment-contract";

export interface QuotePanelProps {
  currencies: PaymentInputCurrencies | null;
  currenciesFailed: boolean;
  currencyCode: string;
  onCurrencyChange: (value: string) => void;
  quote: InvoicePaymentQuote | null;
  quoteError: NormalizedApiError | null;
  isQuoting: boolean;
  isStarting: boolean;
  onRequestQuote: () => void;
  onStartPayment: () => void;
}

/**
 * The quote step. It freezes a collection currency and an FX rate for a short
 * window, and **the lapse is rendered as its own outcome**: once the countdown
 * reaches zero the pay control is replaced by a re-quote, rather than left in
 * place to fail server-side (MASTER-PLAN 6.21).
 *
 * The currency chosen here is what the owner *pays in*. The wallet is USD and
 * only USD; `providerAmount` is a collection figure backed by the immutable FX
 * evidence the quote carries, not a balance.
 */
export function QuotePanel({
  currencies,
  currenciesFailed,
  currencyCode,
  onCurrencyChange,
  quote,
  quoteError,
  isQuoting,
  isStarting,
  onRequestQuote,
  onStartPayment,
}: QuotePanelProps) {
  const { t, lang } = useI18n();
  const { secondsRemaining, hasLapsed } = useCountdown(quote?.expiresAt ?? null);
  const options = currencies?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.coreBilling.quoteTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {currenciesFailed && <DegradedBanner message={t.coreBilling.currenciesUnavailable} />}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label={t.coreBilling.quoteCurrency} className="sm:w-48">
            <Select
              value={currencyCode}
              disabled={isQuoting || options.length === 0}
              onValueChange={onCurrencyChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.coreBilling.quoteCurrency} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.currencyCode} value={option.currencyCode}>
                    {option.currencyCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            variant="outline"
            onClick={onRequestQuote}
            loading={isQuoting}
            disabled={isQuoting || options.length === 0}
          >
            <Calculator className="size-4" aria-hidden="true" />
            {quote ? t.coreBilling.requote : t.coreBilling.requestQuote}
          </Button>
        </div>

        {quoteError && (
          <ErrorState
            title={t.coreBilling.quoteFailed}
            description={quoteError.code ?? quoteError.correlationId}
            onRetry={onRequestQuote}
            retryLabel={t.common.retry}
          />
        )}

        {quote && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-muted p-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              <QuoteFigure
                label={t.coreBilling.quoteOutstanding}
                value={<Money value={quote.invoiceOutstandingUsd} currency="USD" />}
              />
              <QuoteFigure
                label={t.coreBilling.quoteWalletApplied}
                value={<Money value={quote.walletAppliedUsd} currency="USD" />}
              />
              <QuoteFigure
                label={t.coreBilling.quoteGatewayAmount}
                value={<Money value={quote.gatewayAmountUsd} currency="USD" />}
              />
              <QuoteFigure
                label={t.coreBilling.quoteProviderAmount}
                value={
                  <Money value={quote.providerAmount} currency={quote.providerCurrencyCode} />
                }
              />
              <QuoteFigure
                label={t.coreBilling.quoteRate}
                value={formatTemplate(t.coreBilling.quoteRateValue, {
                  units: formatDecimalString(quote.currencyUnitsPerUsd, lang, {
                    maximumFractionDigits: 8,
                  }),
                  currency: quote.providerCurrencyCode,
                })}
              />
            </dl>

            {hasLapsed ? (
              // The failure mode this replaces is a button that silently stops
              // working: the quote is dead server-side and pressing pay would
              // only earn a rejection.
              <div className="flex items-start gap-1.5 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <span>{t.coreBilling.quoteLapsed}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTemplate(t.coreBilling.quoteExpiresIn, {
                    time: formatCountdown(secondsRemaining, lang),
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStartPayment}
                  loading={isStarting}
                  disabled={isStarting}
                >
                  <CreditCard className="size-4" aria-hidden="true" />
                  {t.coreBilling.startPayment}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuoteFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs text-foreground">{value}</dd>
    </div>
  );
}
