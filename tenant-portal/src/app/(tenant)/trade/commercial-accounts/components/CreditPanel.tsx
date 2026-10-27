"use client";

import { useState } from "react";
import { CheckCircle2, Receipt, ShieldAlert, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  DetailSection,
  Field,
  IdentifierText,
  Input,
  Money,
  SWATCH_SURFACE_PALETTES,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { INTL_LOCALE } from "@/lib/format/locale";
import type { CreditDecision } from "../commercial-account-contract";
import { ACCOUNT_UI_COPY, ISO_CURRENCY_PRESETS } from "../commercial-account-metadata";

interface CreditPanelProps {
  canViewCredit: boolean;
  isSubmitting: boolean;
  decision: CreditDecision | null;
  error: string | null;
  onEvaluate: (amount: string, currencyCode: string) => void;
  defaultCurrency: string | null;
}

const PROPOSED_AMOUNT_PRESETS = ["5000", "25000", "100000", "250000"] as const;

/**
 * Credit exposure is its own visibility boundary: `evaluate-credit` is the only
 * route on this page gated on `trade.credit.view`, and `trade.credit.override`
 * exists in the catalogue but guards nothing at all. A user without the view
 * grant sees no panel rather than a disabled one.
 */
export function CreditPanel({
  canViewCredit,
  isSubmitting,
  decision,
  error,
  onEvaluate,
  defaultCurrency,
}: CreditPanelProps) {
  const { t, lang } = useI18n();
  const copy = ACCOUNT_UI_COPY[lang];
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency ?? "");

  if (!canViewCredit) return null;

  const limitNum =
    decision?.effectiveLimit !== null && decision?.effectiveLimit !== undefined
      ? Number(decision.effectiveLimit)
      : null;
  const exposureNum =
    decision?.exposureAmount !== null && decision?.exposureAmount !== undefined
      ? Number(decision.exposureAmount)
      : 0;
  const utilizationPct =
    limitNum && limitNum > 0
      ? Math.min(100, Math.max(0, Math.round((exposureNum / limitNum) * 100)))
      : null;

  const greenSwatch = SWATCH_SURFACE_PALETTES.green;
  const amberSwatch = SWATCH_SURFACE_PALETTES.amber;
  const redSwatch = SWATCH_SURFACE_PALETTES.red;

  return (
    <DetailSection title={t.trade.creditTitle} description={t.trade.creditDescription}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t.trade.creditAmount}
            hint={t.trade.accountCreditLimitHint}
            error={error ?? undefined}
            required
          >
            <Input
              size="sm"
              placeholder={t.trade.creditAmount}
              dir="ltr"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting}
              required
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-2.5 text-primary" aria-hidden="true" />
                {copy.quickTestAmounts}
              </span>
              {PROPOSED_AMOUNT_PRESETS.map((presetAmt) => (
                <Button
                  key={presetAmt}
                  type="button"
                  size="xs"
                  variant={amount === presetAmt ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => setAmount(presetAmt)}
                  dir="ltr"
                  className="px-1.5 py-0.5 font-mono tabular-nums text-xs font-semibold"
                >
                  {Number(presetAmt).toLocaleString(INTL_LOCALE[lang])}
                </Button>
              ))}
            </div>
          </Field>

          <Field label={t.trade.creditCurrency} hint={t.trade.accountCurrencyHint} required>
            <Input
              size="sm"
              placeholder={t.trade.creditCurrency}
              dir="ltr"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              disabled={isSubmitting}
              required
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ISO_CURRENCY_PRESETS.map((preset) => (
                <Button
                  key={preset.code}
                  type="button"
                  size="xs"
                  variant={currency.toUpperCase() === preset.code ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() => setCurrency(preset.code)}
                  dir="ltr"
                  className="px-1.5 py-0.5 font-mono text-xs font-semibold"
                >
                  {preset.code}
                </Button>
              ))}
            </div>
          </Field>
        </div>

        <div>
          <Button
            size="sm"
            variant="primary"
            loading={isSubmitting}
            onClick={() => onEvaluate(amount, currency)}
          >
            {t.trade.creditEvaluate}
          </Button>
        </div>

        {decision ? (
          <div
            className={cn(
              "rounded-lg border p-4",
              decision.outcome === "ALLOW" ? greenSwatch.sectionCard : redSwatch.sectionCard,
            )}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                {decision.outcome === "ALLOW" ? (
                  <CheckCircle2 className={cn("size-5", greenSwatch.iconText)} aria-hidden="true" />
                ) : (
                  <ShieldAlert className={cn("size-5", redSwatch.iconText)} aria-hidden="true" />
                )}
                <Badge tone={decision.outcome === "ALLOW" ? "positive" : "negative"}>
                  {decision.outcome === "ALLOW"
                    ? t.trade.creditOutcome_ALLOW
                    : t.trade.creditOutcome_BLOCK}
                </Badge>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {decision.reasonCode}
                </IdentifierText>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Receipt className="size-3.5" aria-hidden="true" />
                <IdentifierText className="select-all">{decision.receiptId}</IdentifierText>
              </span>
            </div>

            {utilizationPct !== null && (
              <div className="mb-3.5 rounded-md border border-border/80 bg-card p-2.5">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {copy.creditUtilization}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {utilizationPct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      utilizationPct >= 90
                        ? redSwatch.dot
                        : utilizationPct >= 75
                          ? amberSwatch.dot
                          : greenSwatch.dot,
                    )}
                    style={{ width: `${utilizationPct}%` }}
                  />
                </div>
              </div>
            )}

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Row label={t.trade.creditOutcome}>
                <Badge tone={decision.outcome === "ALLOW" ? "positive" : "negative"}>
                  {decision.outcome === "ALLOW"
                    ? t.trade.creditOutcome_ALLOW
                    : t.trade.creditOutcome_BLOCK}
                </Badge>
              </Row>
              <Row label={t.trade.creditReason}>
                <IdentifierText className="text-xs">{decision.reasonCode}</IdentifierText>
              </Row>
              <Row label={t.trade.creditEffectiveLimit}>
                {decision.effectiveLimit === null ? (
                  t.trade.creditUnlimited
                ) : (
                  <Money value={decision.effectiveLimit} currency={decision.currencyCode} />
                )}
              </Row>
              <Row label={t.trade.creditExposure}>
                {decision.exposureAmount === null ? (
                  "—"
                ) : (
                  <Money value={decision.exposureAmount} currency={decision.currencyCode} />
                )}
              </Row>
              <Row label={t.trade.creditRemaining}>
                {decision.remainingAmount === null ? (
                  "—"
                ) : (
                  <Money value={decision.remainingAmount} currency={decision.currencyCode} />
                )}
              </Row>
              <Row label={t.trade.creditOrderingHold}>
                {decision.orderingHold ? t.common.active : t.common.inactive}
              </Row>
              <Row label={t.trade.creditAsOf}>
                {decision.asOf ? formatDateTime(decision.asOf, lang) : "—"}
              </Row>
              <Row label={t.trade.creditReceipt}>
                <IdentifierText className="text-xs select-all">{decision.receiptId}</IdentifierText>
              </Row>
            </dl>
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-card p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
