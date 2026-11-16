"use client";

import { FileCode2 } from "lucide-react";
import { Badge, Button, IdentifierText, Money } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { formatDateTime } from "@/lib/format/date";
import type { PricingDecisionResult } from "../../price-books/pricing-contract";
import { localizeRejectionReason } from "../pricing-display";

interface PricingDecisionTraceSectionProps {
  t: Dictionary;
  lang: Language;
  result: PricingDecisionResult;
  showRawReceipt: boolean;
  onToggleRawReceipt: () => void;
}

export function PricingDecisionTraceSection({
  t,
  lang,
  result,
  showRawReceipt,
  onToggleRawReceipt,
}: PricingDecisionTraceSectionProps) {
  const rejectedPromotions = result.rejectedPromotions ?? [];
  const rejectedCandidates = result.rejectedCandidates ?? [];

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line-divider pt-3 text-xs">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-subtle/40 p-2.5">
          <span className="text-muted-foreground">{t.tradePricing.evalSimulationDecisionId}</span>
          <IdentifierText className="font-medium text-foreground">{result.decisionId}</IdentifierText>
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-subtle/40 p-2.5">
          <span className="text-muted-foreground">{t.tradePricing.minimumAllowedPrice}</span>
          <span className="font-medium text-foreground">
            {result.minimumAllowedPrice ? (
              <Money
                value={result.minimumAllowedPrice}
                currency={result.currencyCode}
                language={lang}
                minimumFractionDigits={2}
                maximumFractionDigits={8}
              />
            ) : (
              t.tradePricing.floorGuardNone
            )}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-subtle/40 p-2.5">
          <span className="text-muted-foreground">{t.tradePricing.evaluatedAtLabel}</span>
          <span className="font-medium text-foreground">
            {result.evaluatedAt ? formatDateTime(result.evaluatedAt, lang) : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-subtle/30 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              {t.tradePricing.rejectedPromotionsTitle}
            </span>
            <Badge tone="neutral" size="sm">
              <IdentifierText className="tabular-nums">
                {String(rejectedPromotions.length)}
              </IdentifierText>
            </Badge>
          </div>
          {rejectedPromotions.length > 0 ? (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {rejectedPromotions.map((item, idx) => (
                <li
                  key={`rej-promo-${item.promotionId ?? item.code}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-1.5"
                >
                  <IdentifierText className="text-foreground">{item.code}</IdentifierText>
                  <span>{localizeRejectionReason(item.reason, t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t.tradePricing.noRejectedPromotions}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-subtle/30 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              {t.tradePricing.rejectedCandidatesTitle}
            </span>
            <Badge tone="neutral" size="sm">
              <IdentifierText className="tabular-nums">
                {String(rejectedCandidates.length)}
              </IdentifierText>
            </Badge>
          </div>
          {rejectedCandidates.length > 0 ? (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {rejectedCandidates.map((candidate, idx) => (
                <li
                  key={`rej-entry-${candidate.entryId}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-1.5"
                >
                  <IdentifierText className="text-foreground">
                    {candidate.entryId.slice(0, 8)}
                  </IdentifierText>
                  <span>{localizeRejectionReason(candidate.reason, t)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t.tradePricing.noRejectedCandidates}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {result.inputFingerprint || result.checksum ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>{`${t.tradePricing.checksumLabel}:`}</span>
            <IdentifierText className="text-foreground">
              {(result.checksum ?? result.inputFingerprint ?? "").slice(0, 16)}
            </IdentifierText>
          </div>
        ) : (
          <span />
        )}
        <Button type="button" size="xs" variant="ghost" onClick={onToggleRawReceipt}>
          <FileCode2 className="size-3.5" aria-hidden="true" />
          <span>{t.tradePricing.evalRawJsonToggle}</span>
        </Button>
      </div>

      {showRawReceipt ? (
        <pre
          dir="ltr"
          className="max-h-56 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs tabular-nums text-foreground"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
