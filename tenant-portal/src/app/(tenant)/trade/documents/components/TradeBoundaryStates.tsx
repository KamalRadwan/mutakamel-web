"use client";

import type { ReactNode } from "react";
import { CircleAlert, Landmark, ShieldQuestion } from "lucide-react";
import { Button, cn, EmptyState, IdentifierText, proseMeasure } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TradeWriteState } from "../hooks/useTradeWrite";

/**
 * No usable branch scope.
 *
 * Every commercial-document route targets `BRANCH`, and 28 of them are also
 * Gateway `BRANCH_REQUIRED` — the request is refused as `GW.REQUEST.INVALID`
 * (400) before trade-app sees it. Nothing failed and nothing is missing: the
 * user still needs to choose an operating scope in the selector mounted by
 * the Trade layout. Selecting it resolves this state in place.
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
    <section role="status" className="space-y-2 rounded-sm border border-caution-200 bg-caution-100 p-3 text-caution-900 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-200">
      <h2 className="flex items-center gap-2 text-sm font-medium"><CircleAlert className="size-4 shrink-0" aria-hidden="true" />{t.tradeDocuments.ambiguousTitle}</h2>
      <p className={cn("text-xs", proseMeasure)}>{t.tradeDocuments.ambiguousDescription}</p>
      <dl className="space-y-1 text-xs">
        <div><dt>{t.tradeDocuments.ambiguousOperation}</dt><dd>{write.ambiguous.operation}</dd></div>
        <div><dt>{t.tradeDocuments.ambiguousKey}</dt><dd><IdentifierText>{write.ambiguous.idempotencyKey}</IdentifierText></dd></div>
        {write.ambiguous.correlationId ? (
          <div><dt>{t.errors.reference}</dt><dd><IdentifierText>{write.ambiguous.correlationId}</IdentifierText></dd></div>
        ) : null}
      </dl>
      <Button type="button" variant="outline" size="sm" loading={write.isWriting}
        onClick={() => void write.ambiguous?.retry()}>{t.common.retry}</Button>
    </section>
  );
}

/** Recovery stays outside this fieldset so the frozen request can be replayed. */
export function TradeWriteFields({ write, children }: { write: TradeWriteState; children: ReactNode }) {
  return <fieldset disabled={write.isBlocked} className="min-w-0 space-y-3">{children}</fieldset>;
}
