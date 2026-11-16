"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useTradeScope } from "../../useTradeScope";
import { useTradeWrite } from "../../documents/hooks/useTradeWrite";
import type { TradeDocumentScope } from "../../documents/hooks/useTradeDocumentScope";
import { partyDisplayName } from "../../documents/trade-document-contract";
import { SALES_ORDER_PERMISSIONS } from "../../sales-orders/sales-order-contract";
import { QUOTATION_REPLACEMENT_PARAM } from "../quotation-composer-draft";
import {
  QUOTATION_PERMISSIONS,
  type QuotationDetail,
} from "../quotation-contract";
import { quotationScopedHeaders } from "../quotation-workspace-hydration";
import { useQuotationActions } from "./useQuotationActions";
import { useQuotationComposer } from "./useQuotationComposer";

export type QuotationDetailViewMode = "edit" | "supersede" | "readonly";

function resolvedOrganizationLabel(options: readonly { value: string; label: string; resolved?: boolean }[], id: string): string | undefined {
  const option = options.find((entry) => entry.value === id);
  return option && option.resolved !== false ? option.label : undefined;
}

export function useQuotationDetailWorkspace({
  initialQuotation,
  scope,
  onReload,
  onFocusWorkspace,
}: {
  initialQuotation: QuotationDetail;
  scope: TradeDocumentScope;
  onReload: () => Promise<unknown>;
  onFocusWorkspace?: () => void;
}) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const router = useRouter();
  const tradeScope = useTradeScope();
  const qCopy = t.tradeDocuments.quotations;
  const sharedWrite = useTradeWrite();

  const [trackedInitial, setTrackedInitial] = useState<QuotationDetail>(initialQuotation);
  const [quotation, setQuotation] = useState<QuotationDetail>(initialQuotation);
  if (initialQuotation !== trackedInitial && !sharedWrite.isBlocked) {
    setTrackedInitial(initialQuotation);
    if (quotation.id !== initialQuotation.id || initialQuotation.version >= quotation.version) {
      setQuotation(initialQuotation);
    }
  }

  const canCreate = scope.canWrite(QUOTATION_PERMISSIONS.create);
  const canUpdate = scope.canWrite(QUOTATION_PERMISSIONS.update);
  const canSend = scope.canWrite(QUOTATION_PERMISSIONS.send);
  const canAccept = scope.canWrite(QUOTATION_PERMISSIONS.accept);
  const canReject = scope.canWrite(QUOTATION_PERMISSIONS.reject);
  const canCancelPerm = scope.canWrite(QUOTATION_PERMISSIONS.cancel);
  const canReadItems = Boolean(
    user?.isTenantOwner === true ||
    can(user, "trade.items.read", { companyId: quotation.companyId, branchId: quotation.branchId }),
  );

  const [discardOpen, setDiscardOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteBlockedOpen, setDeleteBlockedOpen] = useState(false);

  const canSupersedeBase = quotation.lifecycleStatus === "SENT" && canUpdate && canSend;
  const canEditDraftBase = quotation.lifecycleStatus === "DRAFT" && canUpdate;

  const viewMode: QuotationDetailViewMode = canEditDraftBase
    ? "edit"
    : canSupersedeBase
      ? "supersede"
      : "readonly";

  const baseHeaders = useMemo(() => quotationScopedHeaders(quotation), [quotation]);

  const handleSaved = useCallback(async (updated: QuotationDetail) => {
    setQuotation(updated);
    await onReload();
  }, [onReload]);

  const composerEnabled = scope.isResolved && (viewMode === "edit" || viewMode === "supersede");
  const composer = useQuotationComposer({
    headers: baseHeaders,
    isEnabled: composerEnabled,
    canCreate,
    canUpdate,
    canSend,
    canReadItems,
    existingQuotation: quotation,
    write: sharedWrite,
    onReplacementReady: (quotationId) => {
      router.push(`${TENANT_ROUTES.tradeQuotationCreate}?${QUOTATION_REPLACEMENT_PARAM}=${quotationId}`);
    },
    onSaved: handleSaved,
  });

  const liveQuotation = composer.existingQuotation ?? quotation;
  const scopedHeaders = useMemo(() => quotationScopedHeaders(liveQuotation), [liveQuotation]);

  const companyOptions = useTenantOrganizationOptions("company", [liveQuotation.companyId]);
  const branchOptions = useTenantOrganizationOptions("branch", [liveQuotation.branchId]);
  const contextLabels = useMemo(() => ({
    company: resolvedOrganizationLabel(companyOptions, liveQuotation.companyId),
    branch: resolvedOrganizationLabel(branchOptions, liveQuotation.branchId),
    channel: liveQuotation.channelId === null
      ? t.trade.scopeNoChannel
      : (tradeScope.channels.find((entry) => entry.id === liveQuotation.channelId)?.name ?? liveQuotation.channelId),
  }), [branchOptions, companyOptions, liveQuotation.branchId, liveQuotation.channelId, liveQuotation.companyId, t.trade.scopeNoChannel, tradeScope.channels]);

  const actions = useQuotationActions(
    liveQuotation,
    scopedHeaders,
    {
      send: qCopy.send,
      accept: qCopy.accept,
      reject: qCopy.reject,
      cancel: qCopy.cancel,
    },
    async () => {
      await onReload();
    },
    sharedWrite,
  );

  const customerName = useMemo(() => partyDisplayName(liveQuotation.partySnapshot), [liveQuotation.partySnapshot]);

  const status = liveQuotation.lifecycleStatus;
  const canConvert = status === "ACCEPTED"
    && scope.canWrite(QUOTATION_PERMISSIONS.convert)
    && scope.canWrite(SALES_ORDER_PERMISSIONS.create);
  const canCancelQuote = (status === "DRAFT" || status === "SENT") && canCancelPerm;
  const canRejectQuote = status === "SENT" && canReject;
  const advanceAction: "send" | "accept" | null =
    status === "DRAFT" && liveQuotation.currentRevisionId && canSend
      ? "send"
      : status === "SENT" && canAccept
        ? "accept"
        : null;

  const handleRequestDelete = useCallback(() => {
    if (canCancelQuote) {
      actions.requestReason("cancel");
      return;
    }
    setDeleteBlockedOpen(true);
  }, [actions, canCancelQuote]);

  const requestSave = useCallback(() => {
    if (!composer.canSubmit) return;
    void composer.submit({ confirmIssuedChange: viewMode === "supersede" });
  }, [composer, viewMode]);
  const requestResetDraft = useCallback(() => {
    if (!sharedWrite.isBlocked && composer.isDirty) setDiscardOpen(true);
  }, [composer.isDirty, sharedWrite.isBlocked]);
  const confirmDiscard = useCallback(() => {
    if (sharedWrite.isBlocked) return;
    setDiscardOpen(false);
    composer.resetComposer();
    onFocusWorkspace?.();
  }, [composer, onFocusWorkspace, sharedWrite.isBlocked]);
  const confirmIssue = useCallback(async () => {
    setIssueOpen(false);
    if (viewMode === "edit") {
      await composer.sendSaved();
    } else {
      await actions.run("send");
    }
  }, [actions, composer, viewMode]);

  const liveCalc = composer.pricing.preview.calculation;
  const statusAnnouncement = composer.savingStep !== "idle"
    ? t.common.save
    : composer.pricing.preview.loading
      ? t.quotationDiscount.previewPending
      : liveCalc
        ? `${t.quotationDiscount.total}: ${liveCalc.totals.grandTotal} ${liveQuotation.currencyCode}`
        : "";

  return {
    quotation: liveQuotation,
    scopedHeaders,
    contextLabels,
    customerName,
    viewMode,
    canUpdate,
    canSend,
    canConvert,
    canCancelQuote,
    canRejectQuote,
    advanceAction,
    isAwaitingConversion: status === "ACCEPTED",
    write: sharedWrite,
    composer,
    actions,
    statusAnnouncement,
    issueOpen,
    setIssueOpen,
    confirmIssue,
    requestResetDraft,
    requestSave,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
    convertOpen,
    setConvertOpen,
    deleteBlockedOpen,
    setDeleteBlockedOpen,
    handleRequestDelete,
    onReload,
  };
}

export type QuotationDetailWorkspaceState = ReturnType<typeof useQuotationDetailWorkspace>;
