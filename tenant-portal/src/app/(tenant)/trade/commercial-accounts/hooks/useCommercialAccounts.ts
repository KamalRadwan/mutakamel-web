"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  ACCOUNTS_PATH,
  ACCOUNT_ALREADY_EXISTS_CODE,
  ACCOUNT_CREDIT_LIMIT_INVALID_CODE,
  ACCOUNT_PAGE_SIZE,
  ACCOUNT_PARTY_ROLE_INVALID_CODE,
  ACCOUNT_TERM_INVALID_CODE,
  accountPath,
  accountsListPath,
  buildCreateAccountRequest,
  buildUpdateAccountRequest,
  parseAccountsResponse,
  type AccountFormValues,
  type AccountRole,
  type CommercialAccount,
} from "../commercial-account-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;

export function accountErrorMessage(
  error: NormalizedApiError,
  t: ReturnType<typeof useI18n>["t"],
): string | undefined {
  if (error.code === ACCOUNT_ALREADY_EXISTS_CODE) return t.trade.accountAlreadyExists;
  if (error.code === ACCOUNT_PARTY_ROLE_INVALID_CODE) return t.trade.accountPartyRoleInvalid;
  if (error.code === ACCOUNT_TERM_INVALID_CODE) return t.trade.accountTermInvalid;
  if (error.code === ACCOUNT_CREDIT_LIMIT_INVALID_CODE) return t.trade.accountCreditLimitInvalid;
  return undefined;
}

export function accountFormMessage(
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "ACCOUNT_FORM_PARTY") return t.trade.accountFormParty;
  if (reason === "ACCOUNT_FORM_CREDIT") return t.trade.accountFormCredit;
  if (reason === "ACCOUNT_FORM_CURRENCY") return t.trade.accountFormCurrency;
  if (reason === "ACCOUNT_FORM_TERMS") return t.trade.accountFormTerms;
  if (reason === "CREDIT_FORM_AMOUNT") return t.trade.creditFormAmount;
  return t.trade.accountCreateFailed;
}

export function useCommercialAccounts() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.commercialAccountsManage);
  // Reads accept a branch (which narrows nothing but the join); writes are
  // COMPANY-targeted, and a branch header would resolve them to BRANCH and be
  // refused by the permission guard.
  const read = useTradeScopeRequest("COMPANY_OR_BRANCH");
  const write = useTradeScopeRequest("COMPANY");

  const [items, setItems] = useState<CommercialAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<AccountRole | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialAccount | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (read.gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await tradeGet(accountsListPath(page, roleFilter, statusFilter), {
          signal,
          headers: read.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseAccountsResponse(result.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [read, page, roleFilter, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const describe = useCallback(
    (error: NormalizedApiError) => accountErrorMessage(error, t),
    [t],
  );

  const create = useCallback(
    async (values: AccountFormValues): Promise<boolean> => {
      if (!canManage || write.gap || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateAccountRequest(values);
        const outcome = await runWrite(
          () => tradePost(ACCOUNTS_PATH, request, { headers: write.headers }),
          { failureTitle: t.trade.accountCreateFailed, describe },
        );
        if (!outcome.ok) return false;
        setCreateOpen(false);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        await load();
        return true;
      } catch (error) {
        setFormError(accountFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, write, isSubmitting, runWrite, describe, toast, t, load],
  );

  const update = useCallback(
    async (values: AccountFormValues): Promise<boolean> => {
      if (!canManage || write.gap || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateAccountRequest(values);
        const outcome = await runWrite(
          () =>
            tradePatch(accountPath(editing.id), request, {
              headers: { ...write.headers, "if-match": tradeIfMatch(editing.version) },
            }),
          { failureTitle: t.trade.accountUpdateFailed, describe },
        );
        // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved
        // the row. Trade has no force-write path, so the only honest
        // response is to refetch and let the user see the server's value.
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) await load();
          return false;
        }
        setEditing(null);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        await load();
        return true;
      } catch (error) {
        setFormError(accountFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, write, editing, isSubmitting, runWrite, describe, toast, t, load],
  );

  return {
    t,
    lang,
    canManage,
    scopeGap: read.gap,
    writeScopeGap: write.gap,
    items,
    pageInfo: { page, limit: ACCOUNT_PAGE_SIZE, total },
    roleFilter,
    statusFilter,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    editing,
    setPage,
    setRoleFilter: (next: AccountRole | undefined) => {
      setPage(1);
      setRoleFilter(next);
    },
    setStatusFilter: (next: string | undefined) => {
      setPage(1);
      setStatusFilter(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openEdit: (account: CommercialAccount) => {
      setFormError(null);
      setEditing(account);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setEditing(null);
    },
    create,
    update,
    reload: () => load(),
  };
}
