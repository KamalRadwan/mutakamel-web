"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeRequired, TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import { QUOTATION_PERMISSIONS } from "../quotation-contract";
import { QuotationComposerFields, QuotationCommercialTerms } from "./QuotationComposerFields";
import { QuotationContextFields } from "./QuotationContextFields";
import { QuotationLineWorkspace, type QuotationLineDisplayMap } from "./QuotationLineWorkspace";
import { QuotationPdfWorkspace } from "./QuotationPdfWorkspace";
import { QuotationSavedItems, QuotationSavedReceipt, QuotationSaveStatus } from "./QuotationSavedReceipt";
import { QuotationWriteFeedback } from "./QuotationWriteFeedback";
import { QuotationDraftNote } from "./QuotationDraftNote";
import { QuotationPricingControls } from "./QuotationPricingControls";

interface QuotationComposerLineDisplay {
  description?: string | null;
  itemName?: string | null;
  sku?: string | null;
  uomCode?: string | null;
  unavailable?: boolean;
}

type ExtendedComposerState = QuotationComposerState & {
  isEditMode?: boolean;
  existingQuotation?: { partyId?: string; crmCustomerProfileId?: string | null } | null;
  headerLocked?: boolean;
  headerFieldsLocked?: boolean;
  hasOrganizationCustomer?: boolean;
  lineDisplayById?: Readonly<Record<string, QuotationComposerLineDisplay>>;
};

function normalizeLineDisplayMap(
  input?: Readonly<Record<string, QuotationComposerLineDisplay>>,
): QuotationLineDisplayMap | undefined {
  if (!input) return undefined;
  return Object.fromEntries(
    Object.entries(input).map(([id, entry]) => [
      id,
      {
        ...(entry.description != null ? { description: entry.description } : {}),
        ...(entry.itemName != null ? { itemName: entry.itemName } : {}),
        ...(entry.sku != null ? { sku: entry.sku } : {}),
        ...(entry.uomCode != null ? { uomCode: entry.uomCode } : {}),
        ...(entry.unavailable !== undefined ? { unavailable: entry.unavailable } : {}),
      },
    ]),
  );
}

export function QuotationComposerBody({
  composer,
  headers,
  canUpdate,
  compact = false,
  isResolved = true,
  workspaceMode = "create",
  contextLocked,
  identityLocked,
  headerFieldsLocked,
  contextLabels,
  customerLabel,
  showContact,
  lineDisplayById,
  headerBanner,
  pricingActions,
}: {
  composer: QuotationComposerState;
  headers: Record<string, string>;
  canUpdate: boolean;
  compact?: boolean;
  isResolved?: boolean;
  workspaceMode?: "create" | "edit" | "supersede" | "readonly";
  contextLocked?: boolean;
  identityLocked?: boolean;
  headerFieldsLocked?: boolean;
  contextLabels?: { company?: string | null; branch?: string | null; channel?: string | null };
  customerLabel?: string | null;
  showContact?: boolean;
  lineDisplayById?: Readonly<Record<string, QuotationComposerLineDisplay>>;
  headerBanner?: ReactNode;
  pricingActions?: ReactNode;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const extended = composer as ExtendedComposerState;
  const saved = composer.savedQuotation;
  const reconciliation = composer.replacementReconciliation;
  const confirmed = reconciliation?.kind === "confirmed" ? reconciliation : null;
  const busy = composer.write.isBlocked || composer.savingStep !== "idle" || confirmed !== null;
  const isReadOnlyMode = workspaceMode === "readonly";
  const persisted = isReadOnlyMode ? composer.existingQuotation : null;
  const persistedRevision = persisted?.revisions.find((revision) => revision.id === persisted.currentRevisionId);
  const resolvedContextLocked = contextLocked ?? extended.headerLocked ?? (workspaceMode !== "create");
  const resolvedIdentityLocked = identityLocked ?? extended.headerLocked ?? (workspaceMode !== "create");
  const resolvedHeaderFieldsLocked =
    headerFieldsLocked ?? extended.headerFieldsLocked ?? (workspaceMode === "supersede" || isReadOnlyMode);
  const resolvedShowContact = showContact ?? extended.hasOrganizationCustomer;
  const resolvedPartyId =
    composer.partialHeader?.partyId ?? extended.existingQuotation?.partyId ?? composer.selected?.partyId ?? null;
  const resolvedLineDisplayById = normalizeLineDisplayMap(lineDisplayById ?? extended.lineDisplayById);
  const resolvedIsEdit =
    workspaceMode !== "create" || Boolean(extended.isEditMode) || Boolean(extended.existingQuotation) || composer.partialHeader !== null;

  if (composer.replacementUnavailable) {
    const key = composer.replacementCreateKey;
    return <section role="alert" className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-sm">
      <p>{key ? copy.replacementPending : copy.replacementUnavailable}</p>
      {key ? <p>{copy.replacementCreateReference} <IdentifierText>{key}</IdentifierText></p> : null}
    </section>;
  }

  return <div className="min-w-0 space-y-2">
    {composer.replacementCreateKey && !reconciliation && !composer.write.ambiguous ? <section role="status" className="space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <p>{copy.replacementResumeHeader}</p>
      <p>{copy.replacementCreateReference} <IdentifierText>{composer.replacementCreateKey}</IdentifierText></p>
    </section> : null}
    {confirmed ? <section role="status" className="space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <p>{copy.replacementRecovered}</p>
      <p>{copy.replacementCreateReference} <IdentifierText>{confirmed.key}</IdentifierText></p>
      <p><Link className="underline underline-offset-2" href={`${TENANT_ROUTES.tradeQuotations}/${confirmed.quotationId}`} target="_blank" rel="noopener noreferrer">
        {copy.openSaved} <IdentifierText>{confirmed.quotationId}</IdentifierText></Link></p>
    </section> : null}
    <TradeWriteOutcome write={composer.write} retryBlockedReason={composer.replacementRetryBlocked ? copy.replacementRetryBlocked : undefined} />
    <QuotationWriteFeedback write={composer.write} />
    {composer.replacementSource && !composer.selected && !saved ? <p role="status" className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">{copy.replacementReview}</p> : null}
    {composer.replacementSource && !composer.partialHeader && composer.detailsError && !saved
      ? <p role="alert" className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">{copy.replacementSourceUnverified}</p> : null}
    {composer.replacementStorageError
      ? <p role="alert" className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">{copy.replacementStorageError}</p> : null}
    {reconciliation?.kind === "mismatch" ? <section role="alert" className="space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
      <p>{copy.replacementCreateMismatch}</p>
      <p>{copy.replacementCreateReference} <IdentifierText>{reconciliation.key}</IdentifierText></p>
    </section> : null}
    {saved ? <QuotationSaveStatus composer={composer} /> : null}

    {saved ? <>
      <QuotationContextFields composer={composer} contextLocked labels={contextLabels} />
      {!composer.isDetailsCurrent ? <section role="alert" className="space-y-1.5 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"><h2 className="text-sm font-semibold">{copy.detailUnavailableTitle}</h2><p>{copy.detailUnavailableDescription}</p><Button variant="outline" size="xs" className="gap-1.5" loading={composer.isReloadingDetails} onClick={() => void composer.reloadSavedDetails()}><RefreshCw className="size-3.5" aria-hidden="true" />{copy.reloadDetails}</Button></section> : null}
      <QuotationSavedReceipt composer={composer} compact={compact} />
      <QuotationPdfWorkspace quotation={saved} headers={composer.lockedHeaders ?? headers} enabled={composer.isDetailsCurrent} compact={compact} />
    </> : !isResolved ? <>
      <QuotationContextFields composer={composer} contextLocked={resolvedContextLocked} labels={contextLabels} />
      <TradeScopeRequired />
    </> : <>
      <QuotationContextFields composer={composer} embedded contextLocked={resolvedContextLocked} labels={contextLabels}
        renderDetails={(channel) => (
          <fieldset disabled={busy} className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-foreground">
            <QuotationComposerFields composer={composer} compact={compact} embedded channel={channel}
              identityLocked={resolvedIdentityLocked} headerFieldsLocked={resolvedHeaderFieldsLocked}
              commercialLocked={isReadOnlyMode} savedValidUntil={persistedRevision?.validUntil}
              customerLabel={customerLabel} showContact={resolvedShowContact} />
          </fieldset>
        )} />
      {headerBanner}
      {composer.formError ? <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>{composer.formError}</p></div> : null}
      {composer.partialHeader ? <p role="status" className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">{t.tradeDocuments.quotations.partialHeaderSaved}</p> : null}
      {!isReadOnlyMode && !headerBanner && (composer.partialHeader || extended.isEditMode) && (composer.partialHeaderConflict || !composer.isDetailsCurrent || composer.detailsError) ? <section role="alert" className="space-y-1.5 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"><h2 className="text-sm font-semibold">{composer.partialHeaderConflict ? t.quotationFlow.partialConflictTitle : copy.detailUnavailableTitle}</h2><p>{composer.partialHeaderConflict ? t.quotationFlow.partialConflictDescription : copy.detailUnavailableDescription}</p><Button variant="outline" size="xs" className="gap-1.5" loading={composer.isReloadingDetails} disabled={composer.isReloadingDetails || composer.write.isWriting || Boolean(composer.write.ambiguous)} onClick={() => void composer.reloadSavedDetails()}><RefreshCw className="size-3.5" aria-hidden="true" />{copy.reloadDetails}</Button></section> : null}
      {persisted ? <>
        <QuotationSavedItems quotation={persisted} composer={composer} />
        <QuotationCommercialTerms composer={composer} compact={compact} savedTerms={persistedRevision?.termsSnapshot ?? {}} />
      </> : !isReadOnlyMode ? <fieldset disabled={busy} className="min-w-0 space-y-2">
        {canUpdate ? <>
          <QuotationPricingControls state={composer.pricing} currencyCode={composer.currencyCode}
            disabled={busy}
            requiredPermission={resolvedIsEdit ? QUOTATION_PERMISSIONS.update : QUOTATION_PERMISSIONS.create}
            actions={pricingActions} />
          <QuotationLineWorkspace draft={composer.lineDraft} pricing={composer.pricing} currencyCode={composer.currencyCode}
            partyId={resolvedPartyId}
            crmCustomerProfileId={extended.existingQuotation?.crmCustomerProfileId
              ?? composer.partialHeader?.crmCustomerProfileId ?? composer.selected?.crmCustomerProfileId}
            headers={composer.lockedHeaders ?? headers} disabled={busy} compact={compact}
            lineDisplayById={resolvedLineDisplayById} />
          <QuotationCommercialTerms composer={composer} compact={compact} />
        </> : (
          <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{copy.headerOnly}</p>
        )}
        {workspaceMode !== "supersede" ? <div className="[&>section]:px-3 [&>section]:py-1.5 [&>section_h2]:text-xs [&>section_p]:text-xs">
          <QuotationDraftNote headerSaved={composer.partialHeader !== null} existingDraft={composer.partialHeader === null && resolvedIsEdit} />
        </div> : null}
      </fieldset> : null}
    </>}
  </div>;
}
