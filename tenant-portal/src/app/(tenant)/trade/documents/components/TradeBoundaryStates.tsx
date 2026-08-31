"use client";

import { Landmark, ShieldQuestion } from "lucide-react";
import { AmbiguousOutcomePanel, EmptyState } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TradeWriteState } from "../hooks/useTradeWrite";

/**
 * No usable branch scope.
 *
 * Every commercial-document route targets `BRANCH`, and 28 of them are also
 * Gateway `BRANCH_REQUIRED` — the request is refused as `GW.REQUEST.INVALID`
 * (400) before trade-app sees it. Nothing failed and nothing is missing: the
 * user has no branch the portal can pair with a company through their own team
 * memberships, which is a setup gap, so this is an empty state and not a red
 * banner.
 */
export function TradeScopeRequired() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={Landmark}
      title={t.tradeDocuments.scopeRequiredTitle}
      description={t.tradeDocuments.scopeRequiredDescription}
    />
  );
}

export interface TradeEvidenceBlockedProps {
  /** What cannot be built — already translated. */
  title: string;
  description: string;
}

/**
 * A create or edit form that cannot be built, and why.
 *
 * Every order, invoice and contract write requires one or more opaque objects —
 * `taxSnapshot`, `priceSnapshot`, `financialTerms.sourceEvidence` — that the
 * validators require to be **non-empty** and that nothing in the DTOs, the
 * validators or the services describes the contents of. `@IsObject()` accepts
 * `{ "a": 1 }`; the only discoverable rule is "not empty" (Q32).
 *
 * A portal cannot author a legally printable tax snapshot from a schema it
 * cannot see, and a wrong one is indistinguishable from a right one until the
 * document is rendered. The honest surface is to say so and name the missing
 * contract, rather than ship a form that composes a shape nobody specified.
 */
export function TradeEvidenceBlocked({ title, description }: TradeEvidenceBlockedProps) {
  return <EmptyState icon={ShieldQuestion} title={title} description={description} />;
}

/**
 * The persistent in-body evidence for a write that may or may not have applied.
 *
 * Retrying reuses the **same** idempotency key, which is the only thing that
 * makes the retry safe — a fresh key would be a second write, not a retry.
 */
export function TradeWriteOutcome({ write }: { write: TradeWriteState }) {
  const { t } = useI18n();
  if (!write.ambiguous) return null;
  return (
    <AmbiguousOutcomePanel
      operation={write.ambiguous.operation}
      idempotencyKey={write.ambiguous.idempotencyKey}
      correlationId={write.ambiguous.correlationId}
      description={t.tradeDocuments.ambiguousDescription}
      retrying={write.isWriting}
      onRetry={() => void write.ambiguous?.retry()}
      onDismiss={write.dismissAmbiguous}
      labels={{
        title: t.tradeDocuments.ambiguousTitle,
        operation: t.tradeDocuments.ambiguousOperation,
        idempotencyKey: t.tradeDocuments.ambiguousKey,
        correlationId: t.errors.reference,
        retry: t.common.retry,
        dismiss: t.common.dismiss,
      }}
    />
  );
}
