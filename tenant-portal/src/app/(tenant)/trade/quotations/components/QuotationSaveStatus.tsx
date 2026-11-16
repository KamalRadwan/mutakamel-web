"use client";

import { CheckCircle2 } from "lucide-react";
import { Badge, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";

/** A compact save receipt, placed before the locked operating context. */
export function QuotationSaveStatus({ composer }: { composer: Pick<QuotationComposerState, "savedQuotation" | "isDetailsCurrent"> }) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const saved = composer.savedQuotation;
  if (!saved) return null;
  const revision = saved.revisions.find((row) => row.id === saved.currentRevisionId);

  return (
    <section role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-success/30 bg-success-subtle/50 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <CheckCircle2 className="size-6 shrink-0 text-success-subtle-foreground" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-success-subtle-foreground">{saved.lifecycleStatus === "DRAFT" ? copy.draftSaved : t.tradeDocuments.quotations.savedBannerTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {!composer.isDetailsCurrent ? copy.versionUnverified : revision ? copy.revisionConfirmed : copy.headerSaved}
            {revision ? <> · <IdentifierText>{`R${revision.revisionNumber}`}</IdentifierText></> : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TradeStatusBadge kind="TradeQuotationStatus" value={saved.lifecycleStatus} />
        {composer.isDetailsCurrent ? <Badge tone="brand"><span>{copy.recordVersion}</span><IdentifierText>{`v${saved.version}`}</IdentifierText></Badge> : null}
      </div>
    </section>
  );
}
