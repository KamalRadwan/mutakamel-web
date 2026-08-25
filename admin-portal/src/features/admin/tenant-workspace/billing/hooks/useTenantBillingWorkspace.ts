"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { tenantBillingApi } from "../api/tenant-billing.api";
import {
  createBillingIntentKeyStore,
  shouldRetainBillingIntentKey,
  stableFingerprint,
} from "../model/intent-keys";
import { readTenantBillingPermissions } from "../model/permissions";
import type {
  AdminTenantBillingSummaryView,
  BillingMutationState,
  BillingResourceState,
  CreateSubscriptionPlanChangePreviewDto,
  OfflinePaymentDto,
  PageView,
  PaymentReconciliationAction,
  PaymentReconciliationCaseView,
  PaymentStatusView,
  PreviewWalletAdjustmentDto,
  SeedTenantSubscriptionDto,
  SubscriptionItemView,
  SubscriptionPlanChangePreviewView,
  SubscriptionView,
  WalletAdjustmentPreviewView,
  WalletInputCurrenciesView,
  WalletLedgerView,
  WalletView,
} from "../types";

const EMPTY_PAGE_META = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export interface TenantBillingWorkspaceOptions {
  enabled?: boolean;
  pageSize?: number;
}

export function useTenantBillingWorkspace(
  tenantId: string,
  options: TenantBillingWorkspaceOptions = {},
) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const enabled = options.enabled ?? true;
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
  const permissions = useMemo(
    () => readTenantBillingPermissions(user),
    [user],
  );
  const contextKey = useMemo(
    () =>
      [
        tenantId,
        user?.id ?? "anonymous",
        user?.isSuperAdmin ? "super" : "scoped",
        ...(user?.permissions ?? []).slice().sort(),
      ].join("|"),
    [tenantId, user?.id, user?.isSuperAdmin, user?.permissions],
  );
  const generation = useRef(0);
  const identityGeneration = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const reconciliationGeneration = useRef(0);
  const reconciliationAbort = useRef<AbortController | null>(null);
  const contextRef = useRef(contextKey);
  const intentKeys = useRef(createBillingIntentKeyStore());
  const mutationGenerations = useRef(new Map<string, number>());
  const mutationDisplayGeneration = useRef(0);
  const [dataContextKey, setDataContextKey] = useState(contextKey);

  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [subscriptionItems, setSubscriptionItems] = useState<SubscriptionItemView[]>([]);
  const [subscriptionState, setSubscriptionState] =
    useState<BillingResourceState>("idle");
  const [subscriptionError, setSubscriptionError] =
    useState<NormalizedApiError | null>(null);

  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [inputCurrencies, setInputCurrencies] =
    useState<WalletInputCurrenciesView | null>(null);
  const [ledger, setLedger] = useState<PageView<WalletLedgerView>>({
    items: [],
    meta: EMPTY_PAGE_META,
  });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [walletState, setWalletState] =
    useState<BillingResourceState>("idle");
  const [walletError, setWalletError] =
    useState<NormalizedApiError | null>(null);
  const [inputCurrenciesState, setInputCurrenciesState] =
    useState<BillingResourceState>("idle");
  const [inputCurrenciesError, setInputCurrenciesError] =
    useState<NormalizedApiError | null>(null);
  const [ledgerState, setLedgerState] =
    useState<BillingResourceState>("idle");
  const [ledgerError, setLedgerError] =
    useState<NormalizedApiError | null>(null);

  const [payments, setPayments] = useState<PageView<PaymentStatusView>>({
    items: [],
    meta: EMPTY_PAGE_META,
  });
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsState, setPaymentsState] =
    useState<BillingResourceState>("idle");
  const [paymentsError, setPaymentsError] =
    useState<NormalizedApiError | null>(null);

  const [billingSummary, setBillingSummary] =
    useState<AdminTenantBillingSummaryView | null>(null);
  const [billingSummaryState, setBillingSummaryState] =
    useState<BillingResourceState>("idle");
  const [billingSummaryError, setBillingSummaryError] =
    useState<NormalizedApiError | null>(null);

  const [planPreview, setPlanPreview] =
    useState<SubscriptionPlanChangePreviewView | null>(null);
  const [walletPreview, setWalletPreview] =
    useState<WalletAdjustmentPreviewView | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [reconciliationCase, setReconciliationCase] =
    useState<PaymentReconciliationCaseView | null>(null);
  const [reconciliationState, setReconciliationState] =
    useState<BillingResourceState>("idle");
  const [reconciliationError, setReconciliationError] =
    useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<BillingMutationState>({
    name: null,
    error: null,
  });

  const reset = useCallback(() => {
    setSubscription(null);
    setSubscriptionItems([]);
    setSubscriptionState("idle");
    setSubscriptionError(null);
    setWallet(null);
    setInputCurrencies(null);
    setLedger({ items: [], meta: EMPTY_PAGE_META });
    setWalletState("idle");
    setWalletError(null);
    setInputCurrenciesState("idle");
    setInputCurrenciesError(null);
    setLedgerState("idle");
    setLedgerError(null);
    setPayments({ items: [], meta: EMPTY_PAGE_META });
    setPaymentsState("idle");
    setPaymentsError(null);
    setBillingSummary(null);
    setBillingSummaryState("idle");
    setBillingSummaryError(null);
    setPlanPreview(null);
    setWalletPreview(null);
    setSelectedPaymentId(null);
    setReconciliationCase(null);
    setReconciliationState("idle");
    setReconciliationError(null);
    reconciliationGeneration.current += 1;
    reconciliationAbort.current?.abort();
    setMutation({ name: null, error: null });
  }, []);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const requestContext = contextKey;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    if (!enabled || isAuthLoading) {
      if (!enabled) reset();
      return;
    }

    if (permissions.canReadSubscription) {
      setSubscriptionState("loading");
      setSubscriptionError(null);
    } else {
      setSubscriptionState("forbidden");
      setSubscription(null);
      setSubscriptionItems([]);
    }
    if (permissions.canReadWallet) {
      setWalletState("loading");
      setWalletError(null);
      setInputCurrenciesState("loading");
      setInputCurrenciesError(null);
      setLedgerState("loading");
      setLedgerError(null);
      setPaymentsState("loading");
      setPaymentsError(null);
    } else {
      setWalletState("forbidden");
      setInputCurrenciesState("forbidden");
      setLedgerState("forbidden");
      setPaymentsState("forbidden");
      setWallet(null);
      setInputCurrencies(null);
      setLedger({ items: [], meta: EMPTY_PAGE_META });
      setPayments({ items: [], meta: EMPTY_PAGE_META });
    }
    if (permissions.canReadBillingSummary) {
      setBillingSummaryState("loading");
      setBillingSummaryError(null);
    } else {
      setBillingSummaryState("forbidden");
      setBillingSummary(null);
    }

    const tasks: Promise<void>[] = [];
    if (permissions.canReadSubscription) {
      tasks.push(
        tenantBillingApi
          .getSubscription(tenantId, controller.signal)
          .then((nextSubscription) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setSubscription(nextSubscription);
            setSubscriptionItems([]);
            setSubscriptionState("ready");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            if (normalized.httpStatus === 404) {
              setSubscription(null);
              setSubscriptionItems([]);
              setSubscriptionState("empty");
              return;
            }
            setSubscriptionState(normalized.httpStatus === 403 ? "forbidden" : "error");
            setSubscriptionError(normalized);
          }),
      );
    }
    if (permissions.canReadWallet) {
      tasks.push(
        tenantBillingApi
          .getWallet(tenantId, controller.signal)
          .then((nextWallet) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setWallet(nextWallet);
            setWalletState("ready");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            if (normalized.httpStatus === 404) {
              setWallet(null);
              setWalletState("empty");
              return;
            }
            setWalletState(normalized.httpStatus === 403 ? "forbidden" : "error");
            setWalletError(normalized);
          }),
      );
      tasks.push(
        tenantBillingApi
          .getInputCurrencies(controller.signal)
          .then((currencies) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setInputCurrencies(currencies);
            setInputCurrenciesState(currencies.items.length ? "ready" : "empty");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            setInputCurrencies(null);
            setInputCurrenciesState(
              normalized.httpStatus === 403 ? "forbidden" : "error",
            );
            setInputCurrenciesError(normalized);
          }),
      );
      tasks.push(
        tenantBillingApi
          .getLedger(tenantId, ledgerPage, pageSize, controller.signal)
          .then((nextLedger) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setLedger(nextLedger);
            setLedgerState(nextLedger.items.length ? "ready" : "empty");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            setLedger({ items: [], meta: EMPTY_PAGE_META });
            setLedgerState(
              normalized.httpStatus === 403 ? "forbidden" : "error",
            );
            setLedgerError(normalized);
          }),
      );
      tasks.push(
        tenantBillingApi
          .getPayments(tenantId, paymentsPage, pageSize, controller.signal)
          .then((nextPayments) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setPayments(nextPayments);
            setPaymentsState(nextPayments.items.length ? "ready" : "empty");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            setPaymentsState(normalized.httpStatus === 403 ? "forbidden" : "error");
            setPaymentsError(normalized);
          }),
      );
    }
    if (permissions.canReadBillingSummary) {
      tasks.push(
        tenantBillingApi
          .getBillingSummary(tenantId, controller.signal)
          .then((summary) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            setBillingSummary(summary);
            setBillingSummaryState("ready");
          })
          .catch((error: unknown) => {
            if (!isCurrent(current, generation, controller, contextRef, requestContext)) return;
            const normalized = normalizeApiError(error);
            if (normalized.httpStatus === 404) {
              setBillingSummary(null);
              setBillingSummaryState("empty");
              return;
            }
            setBillingSummaryState(normalized.httpStatus === 403 ? "forbidden" : "error");
            setBillingSummaryError(normalized);
          }),
      );
    }
    await Promise.all(tasks);
  }, [
    enabled,
    contextKey,
    isAuthLoading,
    ledgerPage,
    pageSize,
    paymentsPage,
    permissions,
    reset,
    tenantId,
  ]);

  useEffect(() => {
    if (contextRef.current !== contextKey) {
      identityGeneration.current += 1;
      contextRef.current = contextKey;
      intentKeys.current.clearAll();
      mutationGenerations.current.clear();
      mutationDisplayGeneration.current += 1;
      generation.current += 1;
      abort.current?.abort();
      reconciliationGeneration.current += 1;
      reconciliationAbort.current?.abort();
      setLedgerPage(1);
      setPaymentsPage(1);
    }
    const timer = window.setTimeout(() => {
      if (dataContextKey !== contextKey) {
        reset();
        setDataContextKey(contextKey);
      }
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      generation.current += 1;
      abort.current?.abort();
      reconciliationGeneration.current += 1;
      reconciliationAbort.current?.abort();
    };
  }, [contextKey, dataContextKey, refresh, reset]);

  useEffect(
    () => () => {
      identityGeneration.current += 1;
    },
    [],
  );

  const runMutation = useCallback(
    async <T,>(
      name: string,
      intentScope: string,
      action: () => Promise<T>,
    ): Promise<T | null> => {
      const operationContext = contextKey;
      const operationGeneration = identityGeneration.current;
      const intentGeneration =
        (mutationGenerations.current.get(intentScope) ?? 0) + 1;
      mutationGenerations.current.set(intentScope, intentGeneration);
      const displayGeneration = ++mutationDisplayGeneration.current;
      if (
        contextRef.current !== operationContext ||
        dataContextKey !== operationContext
      ) {
        return null;
      }
      setMutation({ name, error: null });
      try {
        const result = await action();
        if (
          contextRef.current !== operationContext ||
          operationGeneration !== identityGeneration.current ||
          mutationGenerations.current.get(intentScope) !== intentGeneration
        ) return null;
        intentKeys.current.clear(intentScope);
        if (mutationDisplayGeneration.current === displayGeneration) {
          setMutation({ name: null, error: null });
        }
        return result;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (
          contextRef.current === operationContext &&
          operationGeneration === identityGeneration.current &&
          mutationGenerations.current.get(intentScope) === intentGeneration
        ) {
          if (!shouldRetainBillingIntentKey(normalized)) {
            intentKeys.current.clear(intentScope);
          }
          if (mutationDisplayGeneration.current === displayGeneration) {
            setMutation({ name: null, error: normalized });
          }
        }
        return null;
      }
    },
    [contextKey, dataContextKey],
  );

  const seedSubscription = useCallback(
    async (dto: SeedTenantSubscriptionDto) => {
      if (!permissions.canCreateSubscription) {
        setMutation({ name: null, error: forbidden("SUBSCRIPTION_CREATE_FORBIDDEN") });
        return null;
      }
      const fingerprint = stableFingerprint(dto);
      const key = intentKeys.current.get("subscription:seed", fingerprint);
      const result = await runMutation("seed-subscription", "subscription:seed", () =>
        tenantBillingApi.seedSubscription(tenantId, dto, key),
      );
      if (result) await refresh();
      return result;
    },
    [permissions.canCreateSubscription, refresh, runMutation, tenantId],
  );

  const previewPlanChange = useCallback(
    async (dto: CreateSubscriptionPlanChangePreviewDto) => {
      if (!permissions.canUpdateSubscription) {
        setMutation({ name: null, error: forbidden("SUBSCRIPTION_UPDATE_FORBIDDEN") });
        return null;
      }
      if (!subscription || !isPlanChangeStatus(subscription.subscription.status)) {
        setMutation({ name: null, error: conflict("SUBSCRIPTION_UPDATE_NOT_ALLOWED") });
        return null;
      }
      setPlanPreview(null);
      const fingerprint = stableFingerprint(dto);
      const key = intentKeys.current.get("subscription:preview", fingerprint);
      const result = await runMutation("preview-plan-change", "subscription:preview", () =>
        tenantBillingApi.previewPlanChange(subscription.subscription.id, dto, key),
      );
      if (result) setPlanPreview(result);
      return result;
    },
    [permissions.canUpdateSubscription, runMutation, subscription],
  );

  const applyPlanChange = useCallback(async () => {
    if (!permissions.canApplySubscriptionUpdate) {
      setMutation({ name: null, error: forbidden("SUBSCRIPTION_APPLY_FORBIDDEN") });
      return null;
    }
    if (
      !subscription ||
      !isPlanChangeStatus(subscription.subscription.status) ||
      !planPreview
    ) {
      setMutation({ name: null, error: conflict("SUBSCRIPTION_APPLY_NOT_ALLOWED") });
      return null;
    }
    if (!planPreview.financial.canApply) {
      setMutation({ name: null, error: conflict("SUBSCRIPTION_PREVIEW_NOT_APPLICABLE") });
      return null;
    }
    if (!isFutureInstant(planPreview.expiresAt)) {
      setPlanPreview(null);
      setMutation({ name: null, error: conflict("SUBSCRIPTION_PREVIEW_EXPIRED") });
      return null;
    }
    const key = intentKeys.current.get(
      `subscription:apply:${planPreview.previewId}`,
      planPreview.previewId,
    );
    const intentScope = `subscription:apply:${planPreview.previewId}`;
    const result = await runMutation("apply-plan-change", intentScope, () =>
      tenantBillingApi.applyPlanChange(
        subscription.subscription.id,
        planPreview.previewId,
        key,
      ),
    );
    if (result) {
      setPlanPreview(null);
      await refresh();
    }
    return result;
  }, [permissions.canApplySubscriptionUpdate, planPreview, refresh, runMutation, subscription]);

  const cancelSubscription = useCallback(async () => {
    if (!permissions.canCancelSubscription) {
      setMutation({ name: null, error: forbidden("SUBSCRIPTION_CANCEL_FORBIDDEN") });
      return null;
    }
    if (
      !subscription ||
      subscription.subscription.status === "CANCELLED" ||
      subscription.subscription.cancelAt !== null
    ) {
      setMutation({ name: null, error: conflict("SUBSCRIPTION_CANCEL_NOT_ALLOWED") });
      return null;
    }
    const key = intentKeys.current.get("subscription:cancel", tenantId);
    const result = await runMutation("cancel-subscription", "subscription:cancel", () =>
      tenantBillingApi.cancelSubscription(tenantId, key),
    );
    if (result) await refresh();
    return result;
  }, [permissions.canCancelSubscription, refresh, runMutation, subscription, tenantId]);

  const previewWalletAdjustment = useCallback(
    async (dto: PreviewWalletAdjustmentDto) => {
      if (!permissions.canPreviewWalletAdjustment) {
        setMutation({ name: null, error: forbidden("WALLET_ADJUSTMENT_FORBIDDEN") });
        return null;
      }
      if (wallet?.status !== "ACTIVE") {
        setMutation({ name: null, error: conflict("WALLET_ADJUSTMENT_NOT_ALLOWED") });
        return null;
      }
      setWalletPreview(null);
      const fingerprint = stableFingerprint(dto);
      const key = intentKeys.current.get("wallet:preview", fingerprint);
      const result = await runMutation("preview-wallet-adjustment", "wallet:preview", () =>
        tenantBillingApi.previewWalletAdjustment(tenantId, dto, key),
      );
      if (result) setWalletPreview(result);
      return result;
    },
    [permissions.canPreviewWalletAdjustment, runMutation, tenantId, wallet?.status],
  );

  const confirmWalletAdjustment = useCallback(
    async (note: string) => {
      if (!permissions.canConfirmWalletAdjustment) {
        setMutation({ name: null, error: forbidden("WALLET_CONFIRM_FORBIDDEN") });
        return null;
      }
      if (wallet?.status !== "ACTIVE" || !walletPreview) {
        setMutation({ name: null, error: conflict("WALLET_CONFIRM_NOT_ALLOWED") });
        return null;
      }
      if (!isFutureInstant(walletPreview.expiresAt)) {
        setWalletPreview(null);
        setMutation({ name: null, error: conflict("WALLET_PREVIEW_EXPIRED") });
        return null;
      }
      const normalizedNote = note.trim();
      const fingerprint = stableFingerprint({ quoteId: walletPreview.quoteId, note: normalizedNote });
      const key = intentKeys.current.get(`wallet:confirm:${walletPreview.quoteId}`, fingerprint);
      const intentScope = `wallet:confirm:${walletPreview.quoteId}`;
      const result = await runMutation("confirm-wallet-adjustment", intentScope, () =>
        tenantBillingApi.confirmWalletAdjustment(
          tenantId,
          walletPreview.quoteId,
          normalizedNote,
          key,
        ),
      );
      if (result) {
        setWalletPreview(null);
        await refresh();
      }
      return result;
    },
    [permissions.canConfirmWalletAdjustment, refresh, runMutation, tenantId, wallet?.status, walletPreview],
  );

  const refundPayment = useCallback(
    async (paymentId: string, note?: string) => {
      if (!permissions.canRefundPayment) {
        setMutation({ name: null, error: forbidden("PAYMENT_REFUND_FORBIDDEN") });
        return null;
      }
      if (
        !payments.items.some(
          (payment) => payment.paymentId === paymentId && payment.status === "SUCCEEDED",
        )
      ) {
        setMutation({ name: null, error: conflict("PAYMENT_REFUND_NOT_ALLOWED") });
        return null;
      }
      const fingerprint = stableFingerprint({ paymentId, note: note?.trim() || null });
      const key = intentKeys.current.get(`payment:refund:${paymentId}`, fingerprint);
      const intentScope = `payment:refund:${paymentId}`;
      const result = await runMutation("refund-payment", intentScope, () =>
        tenantBillingApi.refundPayment(paymentId, note, key),
      );
      if (result) await refresh();
      return result;
    },
    [payments.items, permissions.canRefundPayment, refresh, runMutation],
  );

  const recordOfflinePayment = useCallback(
    async (dto: OfflinePaymentDto) => {
      if (!permissions.canRecordOfflinePayment) {
        setMutation({ name: null, error: forbidden("OFFLINE_PAYMENT_FORBIDDEN") });
        return null;
      }
      const invoice = billingSummary?.currentCollectionInvoice;
      if (
        !invoice ||
        !["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)
      ) {
        setMutation({ name: null, error: conflict("OFFLINE_PAYMENT_NOT_ALLOWED") });
        return null;
      }
      const normalized: OfflinePaymentDto = {
        amount: dto.amount.trim(),
        currencyCode: dto.currencyCode.trim().toUpperCase(),
        reference: dto.reference.trim(),
        ...(dto.note?.trim() ? { note: dto.note.trim() } : {}),
      };
      if (
        !/^\d{1,14}(?:\.\d{1,4})?$/.test(normalized.amount) ||
        !/^[A-Z]{3}$/.test(normalized.currencyCode) ||
        normalized.reference.length < 1 ||
        normalized.reference.length > 128 ||
        (normalized.note?.length ?? 0) > 500
      ) {
        setMutation({ name: null, error: conflict("OFFLINE_PAYMENT_INVALID") });
        return null;
      }
      const intentScope = `invoice:offline:${invoice.id}`;
      const fingerprint = stableFingerprint({ invoiceId: invoice.id, ...normalized });
      const key = intentKeys.current.get(intentScope, fingerprint);
      const result = await runMutation("record-offline-payment", intentScope, async () => {
        const payment = await tenantBillingApi.recordOfflinePayment(
          invoice.id,
          normalized,
          key,
        );
        if (payment.invoiceId !== invoice.id) {
          throw conflict("OFFLINE_PAYMENT_IDENTITY_MISMATCH");
        }
        return payment;
      });
      if (result) await refresh();
      return result;
    },
    [billingSummary, permissions.canRecordOfflinePayment, refresh, runMutation],
  );

  const selectPayment = useCallback(
    async (paymentId: string | null) => {
      const requestContext = contextKey;
      const current = ++reconciliationGeneration.current;
      reconciliationAbort.current?.abort();
      const controller = new AbortController();
      reconciliationAbort.current = controller;
      setSelectedPaymentId(paymentId);
      setReconciliationCase(null);
      setReconciliationError(null);
      if (!paymentId) {
        setReconciliationState("idle");
        return null;
      }
      if (!permissions.canReconcilePayment) {
        setReconciliationState("forbidden");
        return null;
      }
      setReconciliationState("loading");
      try {
        const result = await tenantBillingApi.getReconciliationCase(
          paymentId,
          controller.signal,
        );
        if (
          contextRef.current !== requestContext ||
          current !== reconciliationGeneration.current ||
          controller.signal.aborted
        ) return null;
        if (
          result.payment.paymentId !== paymentId ||
          result.payment.tenantId !== tenantId
        ) {
          setReconciliationError(
            conflict("PAYMENT_RECONCILIATION_IDENTITY_MISMATCH"),
          );
          setReconciliationState("error");
          return null;
        }
        setReconciliationCase(result);
        setReconciliationState("ready");
        return result;
      } catch (error) {
        if (
          contextRef.current !== requestContext ||
          current !== reconciliationGeneration.current ||
          controller.signal.aborted
        ) return null;
        const normalized = normalizeApiError(error);
        setReconciliationError(normalized);
        setReconciliationState(normalized.httpStatus === 403 ? "forbidden" : "error");
        return null;
      }
    },
    [contextKey, permissions.canReconcilePayment, tenantId],
  );

  const proposeReconciliation = useCallback(
    async (dto: {
      action: PaymentReconciliationAction;
      evidenceReference: string;
      providerOutcomeReference?: string;
      note: string;
    }) => {
      const normalized: {
        action: PaymentReconciliationAction;
        evidenceReference: string;
        providerOutcomeReference?: string;
        note: string;
      } = {
        action: dto.action,
        evidenceReference: dto.evidenceReference.trim(),
        ...(dto.providerOutcomeReference?.trim()
          ? { providerOutcomeReference: dto.providerOutcomeReference.trim() }
          : {}),
        note: dto.note.trim(),
      };
      const hasOpenProposal = reconciliationCase?.reconciliations.some(
        (row) => row.status === "PROPOSED",
      );
      const providerReferenceAllowed =
        normalized.action === "CONFIRM_REFUNDED"
          ? Boolean(normalized.providerOutcomeReference)
          : normalized.providerOutcomeReference === undefined;
      if (!permissions.canReconcilePayment) {
        setMutation({ name: null, error: forbidden("PAYMENT_RECONCILIATION_FORBIDDEN") });
        return null;
      }
      if (
        !selectedPaymentId ||
        reconciliationCase?.payment.paymentId !== selectedPaymentId ||
        !reconciliationCase.eligibleActions.includes(normalized.action) ||
        hasOpenProposal ||
        !providerReferenceAllowed ||
        !normalized.evidenceReference ||
        normalized.note.length < 10
      ) {
        setMutation({ name: null, error: conflict("PAYMENT_RECONCILIATION_NOT_ALLOWED") });
        return null;
      }
      const fingerprint = stableFingerprint(normalized);
      const key = intentKeys.current.get(
        `payment:reconcile:${selectedPaymentId}`,
        fingerprint,
      );
      const intentScope = `payment:reconcile:${selectedPaymentId}`;
      const result = await runMutation("propose-reconciliation", intentScope, () =>
        tenantBillingApi.proposeReconciliation(
          selectedPaymentId,
          normalized,
          key,
        ),
      );
      if (result) await selectPayment(selectedPaymentId);
      return result;
    },
    [permissions.canReconcilePayment, reconciliationCase, runMutation, selectPayment, selectedPaymentId],
  );

  const decideReconciliation = useCallback(
    async (
      reconciliationId: string,
      decision: "APPROVE" | "REJECT",
      note: string,
    ) => {
      const proposal = reconciliationCase?.reconciliations.find(
        (row) => row.id === reconciliationId,
      );
      const normalizedNote = note.trim();
      if (!permissions.canDecideReconciliation) {
        setMutation({ name: null, error: forbidden("PAYMENT_RECONCILIATION_DECISION_FORBIDDEN") });
        return null;
      }
      if (
        !selectedPaymentId ||
        !proposal ||
        proposal.status !== "PROPOSED" ||
        proposal.proposedByAdminId === user?.id ||
        normalizedNote.length < 10
      ) {
        setMutation({ name: null, error: conflict("PAYMENT_RECONCILIATION_DECISION_NOT_ALLOWED") });
        return null;
      }
      const fingerprint = stableFingerprint({ reconciliationId, decision, note: normalizedNote });
      const key = intentKeys.current.get(
        `payment:decision:${reconciliationId}`,
        fingerprint,
      );
      const intentScope = `payment:decision:${reconciliationId}`;
      const result = await runMutation("decide-reconciliation", intentScope, () =>
        tenantBillingApi.decideReconciliation(
          selectedPaymentId,
          reconciliationId,
          decision,
          normalizedNote,
          key,
        ),
      );
      if (result) {
        await Promise.all([refresh(), selectPayment(selectedPaymentId)]);
      }
      return result;
    },
    [permissions.canDecideReconciliation, reconciliationCase, refresh, runMutation, selectPayment, selectedPaymentId, user?.id],
  );

  const ownsData = dataContextKey === contextKey;
  const hiddenState = (allowed: boolean): BillingResourceState =>
    isAuthLoading ? "idle" : allowed ? "loading" : "forbidden";

  return {
    permissions,
    actorId: user?.id ?? null,
    subscription: ownsData ? subscription : null,
    subscriptionItems: ownsData ? subscriptionItems : [],
    subscriptionState: ownsData
      ? subscriptionState
      : hiddenState(permissions.canReadSubscription),
    subscriptionError: ownsData ? subscriptionError : null,
    wallet: ownsData ? wallet : null,
    inputCurrencies: ownsData ? inputCurrencies : null,
    inputCurrenciesState: ownsData
      ? inputCurrenciesState
      : hiddenState(permissions.canReadWallet),
    inputCurrenciesError: ownsData ? inputCurrenciesError : null,
    ledger: ownsData ? ledger : { items: [], meta: EMPTY_PAGE_META },
    ledgerPage,
    setLedgerPage,
    ledgerState: ownsData
      ? ledgerState
      : hiddenState(permissions.canReadWallet),
    ledgerError: ownsData ? ledgerError : null,
    walletState: ownsData
      ? walletState
      : hiddenState(permissions.canReadWallet),
    walletError: ownsData ? walletError : null,
    payments: ownsData ? payments : { items: [], meta: EMPTY_PAGE_META },
    paymentsPage,
    setPaymentsPage,
    paymentsState: ownsData
      ? paymentsState
      : hiddenState(permissions.canReadWallet),
    paymentsError: ownsData ? paymentsError : null,
    billingSummary: ownsData ? billingSummary : null,
    billingSummaryState: ownsData
      ? billingSummaryState
      : hiddenState(permissions.canReadBillingSummary),
    billingSummaryError: ownsData ? billingSummaryError : null,
    planPreview: ownsData ? planPreview : null,
    walletPreview: ownsData ? walletPreview : null,
    selectedPaymentId: ownsData ? selectedPaymentId : null,
    reconciliationCase: ownsData ? reconciliationCase : null,
    reconciliationState: ownsData ? reconciliationState : "idle",
    reconciliationError: ownsData ? reconciliationError : null,
    mutation: ownsData ? mutation : { name: null, error: null },
    isAuthLoading,
    refresh,
    seedSubscription,
    previewPlanChange,
    applyPlanChange,
    cancelSubscription,
    previewWalletAdjustment,
    confirmWalletAdjustment,
    refundPayment,
    recordOfflinePayment,
    selectPayment,
    proposeReconciliation,
    decideReconciliation,
    clearPlanPreview: () => setPlanPreview(null),
    clearWalletPreview: () => setWalletPreview(null),
  };
}

export type UseTenantBillingWorkspaceResult = ReturnType<
  typeof useTenantBillingWorkspace
>;

function isCurrent(
  current: number,
  generation: React.MutableRefObject<number>,
  controller: AbortController,
  context: React.MutableRefObject<string>,
  requestContext: string,
): boolean {
  return (
    current === generation.current &&
    !controller.signal.aborted &&
    context.current === requestContext
  );
}

function forbidden(errorCode: string): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 403,
    errorCode,
    message: "You do not have permission for this action.",
  };
}

function conflict(
  errorCode: string,
  message = "The requested action is not valid for the current server state.",
): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 409,
    errorCode,
    message,
  };
}

function isPlanChangeStatus(status: SubscriptionView["subscription"]["status"]): boolean {
  return status === "TRIAL" || status === "ACTIVE";
}

function isFutureInstant(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
