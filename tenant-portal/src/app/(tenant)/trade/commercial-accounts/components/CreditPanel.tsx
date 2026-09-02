"use client";

import { useState } from "react";
import { Badge, Button, DetailSection, Field, IdentifierText, Input, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { CreditDecision } from "../commercial-account-contract";

interface CreditPanelProps {
  canViewCredit: boolean;
  isSubmitting: boolean;
  decision: CreditDecision | null;
  error: string | null;
  onEvaluate: (amount: string, currencyCode: string) => void;
  defaultCurrency: string | null;
}

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
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency ?? "");

  if (!canViewCredit) return null;

  return (
    <DetailSection title={t.trade.creditTitle} description={t.trade.creditDescription}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.trade.creditAmount} hint={t.trade.accountCreditLimitHint} error={error ?? undefined} required>
            <Input
              dir="ltr"
              inputMode="decimal"
              className="tabular-nums"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </Field>
          <Field label={t.trade.creditCurrency} hint={t.trade.accountCurrencyHint} required>
            <Input
              dir="ltr"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              disabled={isSubmitting}
              required
            />
          </Field>
        </div>

        <div>
          <Button
            variant="outline"
            loading={isSubmitting}
            onClick={() => onEvaluate(amount, currency)}
          >
            {t.trade.creditEvaluate}
          </Button>
        </div>

        {decision ? (
          <dl className="grid gap-2 sm:grid-cols-2">
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
        ) : null}
      </div>
    </DetailSection>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
