"use client";

import { Layers, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, Badge, DateTime, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { partyDisplayName } from "../../documents/trade-document-contract";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import type { QuotationDetail } from "../quotation-contract";
import { readQuotationSavedPricing } from "../quotation-discount-snapshots";
import { quotationSavedLines, type QuotationSavedLineDisplay } from "../quotation-saved-presentation";
import { quotationScopedHeaders } from "../quotation-workspace-hydration";
import { QuotationDocumentStrip } from "./QuotationDocumentStrip";
import { QuotationCommercialSummary } from "./QuotationCommercialSummary";
import { QuotationSavedLines } from "./QuotationSavedLines";
import { QuotationContactDisplay } from "./QuotationContactDisplay";
import { QuotationSavedPricing } from "./QuotationSavedPricing";

export { QuotationSaveStatus } from "./QuotationSaveStatus";

export type QuotationSavedReceiptState = Pick<QuotationComposerState, "savedQuotation" | "selected"> & Partial<Pick<QuotationComposerState, "selectedContact" | "lockedHeaders">> & {
  lineDraft: Pick<QuotationComposerState["lineDraft"], "lines" | "itemsById" | "uomsByItem">;
  lineDisplayById?: Record<string, QuotationSavedLineDisplay>;
};

export function QuotationSavedReceipt({ composer, compact = false }: { composer: QuotationSavedReceiptState; compact?: boolean }) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const td = t.tradeDocuments;
  const saved = composer.savedQuotation;
  if (!saved) return null;
  const revision = saved.revisions.find((entry) => entry.id === saved.currentRevisionId);
  const selectedContact = composer.selectedContact?.partyId === saved.contactPartyId
    && composer.selectedContact.customerPartyId === saved.partyId ? composer.selectedContact : null;
  return <div className="space-y-3">
    <QuotationDocumentStrip compact={compact}
      customer={<SavedCustomer composer={composer} />}
      currency={<p className="text-base font-semibold"><IdentifierText>{saved.currencyCode}</IdentifierText></p>}
      reference={<p className="wrap-anywhere text-base font-semibold"><IdentifierText>{saved.draftReference ?? td.notRecorded}</IdentifierText></p>}
      validity={<p className="text-base font-semibold">{revision ? <DateTime value={revision.validUntil} precision="date" timeZone="UTC" /> : td.notRecorded}</p>}
      footer={saved.contactPartyId ? <p className="flex flex-wrap items-center gap-2 text-sm">
        <UserRound className="size-4 text-muted-foreground" aria-hidden="true" /><span className="text-muted-foreground">{copy.contactLabel}</span>
        <span>{selectedContact ? selectedContact.displayName : <QuotationContactDisplay partyId={saved.partyId} contactPartyId={saved.contactPartyId} headers={composerScope(composer)} />}</span>
      </p> : undefined}
    />
    <QuotationSavedItems quotation={saved} composer={composer} />
    {revision ? <QuotationCommercialSummary terms={revision.termsSnapshot} compact={compact} /> : null}
  </div>;
}

export function QuotationSavedItems({ quotation, composer }: {
  quotation: QuotationDetail;
  composer: Pick<QuotationSavedReceiptState, "lineDraft" | "lineDisplayById">;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const revision = quotation.revisions.find((entry) => entry.id === quotation.currentRevisionId);
  const savedPricing = revision ? readQuotationSavedPricingSafe(revision.discountSnapshot) : null;
  const lines = quotationSavedLines(quotation.currentLines, composer.lineDraft, composer.lineDisplayById);
  return (
    <section aria-label={copy.itemSection} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-2.5 sm:p-3">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{copy.itemSection}</h2>
        <Badge tone="neutral" size="compact">{copy.itemCount.replace("{count}", String(lines.length))}</Badge>
      </div>
      {lines.length ? <>
        <div className="overflow-hidden rounded-lg border border-border">
          <QuotationSavedLines lines={lines} mode={revision?.pricingMode ?? "PROMOTIONS"}
            discountScope={savedPricing?.pricing.scope}
            discountAmount={revision?.pricingMode === "PROMOTIONS"
              ? savedPricing?.totals.promotionSavings ?? revision.discountTotal
              : revision?.discountTotal}
            currencyCode={quotation.currencyCode} lineDisplayById={composer.lineDisplayById} />
        </div>
        {revision ? <QuotationSavedPricing revision={revision} currencyCode={quotation.currencyCode} /> : null}
      </> : <p className="rounded-md border border-border px-3 py-2 text-center text-sm text-muted-foreground">{copy.noSavedLines}</p>}
    </section>
  );
}

function readQuotationSavedPricingSafe(snapshot: Record<string, unknown>) {
  try { return readQuotationSavedPricing(snapshot); } catch { return null; }
}

function composerScope(composer: QuotationSavedReceiptState): Record<string, string> {
  const saved = composer.savedQuotation;
  return composer.lockedHeaders ?? (saved ? quotationScopedHeaders(saved) : {});
}

function SavedCustomer({ composer }: { composer: QuotationSavedReceiptState }) {
  const { t } = useI18n();
  const saved = composer.savedQuotation;
  if (!saved) return null;
  const name = partyDisplayName(saved.partySnapshot)
    ?? (composer.selected?.partyId === saved.partyId ? composer.selected.displayName : null)
    ?? t.tradeDocuments.notRecorded;
  const initials = name.trim().split(/\s+/u).slice(0, 2).map((part) => [...part][0]).join("");
  return <div className="flex min-w-0 items-center gap-3">
    <Avatar className="size-12 shrink-0"><AvatarFallback className="bg-primary/10 text-base text-primary">{initials || <UserRound className="size-5" aria-hidden="true" />}</AvatarFallback></Avatar>
    <div className="min-w-0 space-y-1.5">
      <p className="text-sm text-muted-foreground">{t.tradeDocuments.customer}</p>
      <p className="text-base font-semibold leading-snug">{name}</p>
      <Badge tone={saved.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT" ? "positive" : "neutral"} size="sm">{saved.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT" ? t.quotationExperience.activeAccount : t.quotationExperience.crmProspect}</Badge>
    </div>
  </div>;
}
