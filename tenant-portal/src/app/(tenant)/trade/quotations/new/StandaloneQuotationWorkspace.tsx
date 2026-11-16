"use client";

import { useRouter } from "next/navigation";
import { PageHeader, TooltipProvider } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useTradeDocumentScope } from "../../documents/hooks/useTradeDocumentScope";
import { QuotationComposerBody } from "../components/QuotationComposerBody";
import { QuotationIssueConfirmation } from "../components/QuotationIssueConfirmation";
import { QuotationWorkspaceActions } from "../components/QuotationWorkspaceActions";
import { useQuotationComposer } from "../hooks/useQuotationComposer";
import { useQuotationDialogs } from "../hooks/useQuotationDialogs";
import { QUOTATION_PERMISSIONS } from "../quotation-contract";

/** One full-width authoring surface; all write and scope recovery lives in the shared composer. */
export function StandaloneQuotationWorkspace({ replacementQuoteId }: { replacementQuoteId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const copy = t.quotationExperience;
  const qCopy = t.tradeDocuments.quotations;
  const scope = useTradeDocumentScope();
  const canUpdate = scope.canWrite(QUOTATION_PERMISSIONS.update);
  const composer = useQuotationComposer({
    headers: scope.headers,
    isEnabled: scope.isResolved,
    canCreate: scope.canWrite(QUOTATION_PERMISSIONS.create),
    canUpdate,
    canSend: scope.canWrite(QUOTATION_PERMISSIONS.send),
    canReadItems: scope.canWrite("trade.items.read"),
    hydrateHandoff: true,
    replacementQuoteId,
  });
  const dialogs = useQuotationDialogs(composer);
  const saved = composer.savedQuotation;
  const liveCalc = composer.pricing.preview.calculation;
  const liveStatus = composer.savingStep !== "idle"
    ? qCopy.saveQuotation
    : composer.pricing.preview.loading
      ? t.quotationDiscount.previewPending
      : liveCalc
        ? `${t.quotationDiscount.total}: ${liveCalc.totals.grandTotal} ${composer.currencyCode}`
        : "";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-w-0 flex-col gap-2" data-testid="quotation-workspace">
        <PageHeader
          className="sr-only"
          title={saved ? qCopy.savedBannerTitle : copy.workspaceTitle}
          description={copy.workspaceDescription}
          primaryAction={!saved
            ? composer.partialHeaderConflict
              ? { label: copy.reloadDetails, onClick: () => void composer.reloadSavedDetails(), disabled: composer.isReloadingDetails || composer.write.isBlocked }
              : { label: qCopy.saveQuotation, onClick: () => void composer.submit(), disabled: !composer.canSubmit }
            : composer.canSendSaved
              ? { label: copy.issueQuotation, onClick: () => dialogs.setIssueOpen(true), disabled: composer.savingStep !== "idle" }
              : !composer.isDetailsCurrent
                ? { label: copy.reloadDetails, onClick: () => void composer.reloadSavedDetails(), disabled: composer.isReloadingDetails || composer.savingStep !== "idle" }
                : undefined}
          secondaryActions={<QuotationWorkspaceActions composer={replacementQuoteId && saved
            ? { ...composer, resetComposer: () => router.push(TENANT_ROUTES.tradeQuotationCreate) } : composer} />}
        />
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{liveStatus}</p>
        <QuotationComposerBody composer={composer} headers={scope.headers} canUpdate={canUpdate} isResolved={scope.isResolved} />
        <QuotationIssueConfirmation open={dialogs.issueOpen} onOpenChange={dialogs.setIssueOpen} onConfirm={() => void dialogs.confirmIssue()} loading={composer.savingStep === "sending"} />
      </div>
    </TooltipProvider>
  );
}
