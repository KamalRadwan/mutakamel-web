"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScope, useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import { record } from "../../trade-validation";
import {
  ACCOUNT_BLOCK_TRANSITION_INVALID_CODE,
  ACCOUNT_NOT_FOUND_CODE,
  BRANCH_RULE_EXISTS_CODE,
  BRANCH_RULE_NOT_FOUND_CODE,
  BRANCH_RULE_WEAKENS_CODE,
  CREDIT_EXPOSURE_UNAVAILABLE_CODE,
  accountBranchRulePath,
  accountBranchRulesPath,
  accountCreditPath,
  accountPath,
  accountTransitionPath,
  buildCreditRequest,
  parseAccountResponse,
  parseBranchRuleResponse,
  parseCreditDecision,
  type AccountBranchRule,
  type CommercialAccount,
  type CreditDecision,
} from "../commercial-account-contract";
import { accountErrorMessage, accountFormMessage } from "./useCommercialAccounts";

const DETAIL_RESPONSE_LIMIT_BYTES = 200_000;

export function useAccountDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const { context } = useTradeScope();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.commercialAccountsManage);
  /** `evaluate-credit` is the only route on this page using `trade.credit.view`. */
  const canViewCredit = canPerformTradeAction(user, TRADE_PERMISSIONS.creditView);
  const read = useTradeScopeRequest("COMPANY_OR_BRANCH");
  const write = useTradeScopeRequest("COMPANY");
  const branch = useTradeScopeRequest("BRANCH");

  const [account, setAccount] = useState<CommercialAccount | null>(null);
  const [branchRule, setBranchRule] = useState<AccountBranchRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credit, setCredit] = useState<CreditDecision | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isMalformedId = !isUUIDv7(id);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isMalformedId || read.gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(accountPath(id), {
        signal: controller.signal,
        headers: read.headers,
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setAccount(parseAccountResponse(result.data));
          // `branchRule` rides on the account, and is null unless a branch is
          // in the operating context.
          const payload = record(result.data);
          setBranchRule(
            payload?.branchRule ? parseBranchRuleResponse(payload.branchRule) : null,
          );
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setAccount(null);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, read, isMalformedId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const describe = useCallback(
    (failure: NormalizedApiError): string | undefined => {
      if (failure.code === BRANCH_RULE_EXISTS_CODE) return t.trade.branchRuleExists;
      if (failure.code === BRANCH_RULE_NOT_FOUND_CODE) return t.trade.branchRuleNotFound;
      if (failure.code === BRANCH_RULE_WEAKENS_CODE) return t.trade.branchRuleWeakens;
      if (failure.code === ACCOUNT_BLOCK_TRANSITION_INVALID_CODE) {
        return t.trade.blockTransitionInvalid;
      }
      if (failure.code === CREDIT_EXPOSURE_UNAVAILABLE_CODE) {
        return t.trade.creditExposureUnavailable;
      }
      return accountErrorMessage(failure, t);
    },
    [t],
  );

  const saveBranchRule = useCallback(
    async (narrowingRules: string): Promise<boolean> => {
      if (!canManage || branch.gap || !context.branchId || isSubmitting) return false;
      let parsed: Record<string, unknown>;
      try {
        const value = record(JSON.parse(narrowingRules.trim() || "{}") as unknown);
        if (!value) throw new Error("ACCOUNT_FORM_TERMS");
        parsed = value;
      } catch {
        setCreditError(null);
        toast.error(t.trade.branchRuleSaveFailed, t.trade.jsonInvalid);
        return false;
      }
      setIsSubmitting(true);
      const outcome = await runWrite(
        () =>
          branchRule
            ? tradePatch(
                accountBranchRulePath(id, context.branchId as string),
                { narrowingRules: parsed, status: branchRule.status },
                { headers: { ...branch.headers, "if-match": tradeIfMatch(branchRule.version) } },
              )
            : tradePost(
                accountBranchRulesPath(id),
                { branchId: context.branchId, narrowingRules: parsed },
                { headers: branch.headers },
              ),
        { failureTitle: t.trade.branchRuleSaveFailed, describe },
      );
      setIsSubmitting(false);
      // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved the
      // row. Trade has no force-write path, so the only honest response is to
      // refetch and let the user see the server's value.
      if (!outcome.ok) {
        if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) reload();
        return false;
      }
      toast.success(
        t.trade.savedTitle,
        outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
      );
      reload();
      return true;
    },
    [
      canManage,
      branch,
      context.branchId,
      isSubmitting,
      branchRule,
      runWrite,
      id,
      describe,
      toast,
      t,
      reload,
    ],
  );

  /**
   * A `READ_HEAVY` POST that mutates nothing, yet still requires an idempotency
   * key and still writes a decision receipt. Gated on `trade.credit.view`, a
   * permission no other route on this page uses.
   */
  const evaluateCredit = useCallback(
    async (amount: string, currencyCode: string): Promise<void> => {
      if (!canViewCredit || read.gap || isSubmitting) return;
      setIsSubmitting(true);
      setCreditError(null);
      try {
        const request = buildCreditRequest(amount, currencyCode);
        const outcome = await runWrite(
          async () => {
            const result = await tradePost(accountCreditPath(id), request, {
              headers: read.headers,
              maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
            });
            setCredit(parseCreditDecision(result.data));
            return result;
          },
          { failureTitle: t.trade.creditEvaluateFailed, describe },
        );
        if (!outcome.ok) setCredit(null);
      } catch (thrown) {
        setCreditError(accountFormMessage(thrown, t));
      } finally {
        setIsSubmitting(false);
      }
    },
    [canViewCredit, read, isSubmitting, runWrite, id, describe, t],
  );

  const transition = useCallback(
    async (target: "block" | "unblock", reasonCode: string): Promise<boolean> => {
      if (!canManage || write.gap || !account || isSubmitting) return false;
      setIsSubmitting(true);
      const outcome = await runWrite(
        () =>
          tradePost(
            accountTransitionPath(id, target),
            { reasonCode: reasonCode.trim() },
            { headers: { ...write.headers, "if-match": tradeIfMatch(account.version) } },
          ),
        { failureTitle: t.trade.blockFailed, describe },
      );
      setIsSubmitting(false);
      if (!outcome.ok) {
        if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) reload();
        return false;
      }
      toast.success(
        t.trade.savedTitle,
        outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
      );
      reload();
      return true;
    },
    [canManage, write, account, isSubmitting, runWrite, id, describe, toast, t, reload],
  );

  const isGone =
    isMalformedId ||
    error?.status === 404 ||
    (error?.status === 422 && error.code === ACCOUNT_NOT_FOUND_CODE);

  return {
    t,
    lang,
    canManage,
    canViewCredit,
    account,
    branchRule,
    isLoading,
    error,
    isGone,
    isSubmitting,
    credit,
    creditError,
    scopeGap: read.gap,
    writeScopeGap: write.gap,
    branchScopeGap: branch.gap,
    selectedBranchId: context.branchId,
    saveBranchRule,
    evaluateCredit,
    transition,
    reload,
  };
}
