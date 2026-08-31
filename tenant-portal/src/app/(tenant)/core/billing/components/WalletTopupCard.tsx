"use client";

import { ExternalLink, Wallet } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DegradedBanner,
  Field,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { BillingBadge } from "../../components/BillingBadge";
import type { TenantWallet } from "../billing-contract";
import type { PaymentInputCurrencies } from "../payment-contract";
import type { TopupResult } from "../wallet-contract";

export interface WalletTopupCardProps {
  wallet: TenantWallet;
  currencies: PaymentInputCurrencies | null;
  currenciesFailed: boolean;
  amount: string;
  currencyCode: string;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
  topup: TopupResult | null;
  onDismissTopup: () => void;
}

/**
 * The wallet, and the one write a past-due tenant must always be able to make.
 *
 * There is exactly **one wallet per tenant and it is always USD**
 * (`WalletService.toView` hard-codes `BASE_CURRENCY`). The currency selector
 * below chooses what the owner *pays in*, not what is held: the collected
 * amount is converted through immutable FX evidence and lands in the same USD
 * balance. Nothing here is ever labelled as an EGP balance, because none exists.
 */
export function WalletTopupCard({
  wallet,
  currencies,
  currenciesFailed,
  amount,
  currencyCode,
  onAmountChange,
  onCurrencyChange,
  onSubmit,
  isSubmitting,
  error,
  topup,
  onDismissTopup,
}: WalletTopupCardProps) {
  const { t } = useI18n();
  const options = currencies?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>{t.coreBilling.walletTitle}</CardTitle>
        <BillingBadge kind="WalletStatus" value={wallet.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-3 sm:grid-cols-3">
          <WalletFigure label={t.coreBilling.walletAvailable} value={wallet.availableBalanceUsd} />
          <WalletFigure label={t.coreBilling.walletBalance} value={wallet.balanceUsd} />
          <WalletFigure label={t.coreBilling.walletReserved} value={wallet.reservedBalanceUsd} />
        </dl>

        <p className="text-xs text-muted-foreground">{t.coreBilling.walletUsdOnly}</p>

        {currenciesFailed && <DegradedBanner message={t.coreBilling.currenciesUnavailable} />}

        {topup ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground">
              {topup.replayed ? t.coreBilling.topupReplayed : t.coreBilling.topupStarted}
            </p>
            <p className="text-xs text-muted-foreground">{t.coreBilling.topupCheckoutHint}</p>
            <p className="font-mono text-xs text-muted-foreground">{topup.paymentId}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={topup.checkoutUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {t.coreBilling.topupOpenCheckout}
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismissTopup}>
                {t.common.dismiss}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field
              label={t.coreBilling.topupAmount}
              hint={t.coreBilling.topupAmountHint}
              error={error ?? undefined}
              className="flex-1"
            >
              <Input
                value={amount}
                inputMode="decimal"
                disabled={isSubmitting}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </Field>
            <Field label={t.coreBilling.topupCurrency} className="sm:w-40">
              <Select
                value={currencyCode}
                disabled={isSubmitting || options.length === 0}
                onValueChange={onCurrencyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.coreBilling.topupCurrency} />
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
              onClick={onSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || options.length === 0}
            >
              <Wallet className="size-4" aria-hidden="true" />
              {t.coreBilling.topupSubmit}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WalletFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">
        <Money value={value} currency="USD" />
      </dd>
    </div>
  );
}
