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
import {
  CHANNEL_INVALID_CODE,
  channelBranchPath,
  channelBranchesPath,
  channelPath,
  parseChannelDetailResponse,
  type ChannelBranch,
  type ChannelDetail,
} from "../channel-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 200_000;

export function useChannelDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const { context } = useTradeScope();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.itemsManage);
  const { headers, gap } = useTradeScopeRequest("COMPANY");
  // Every branch mapping route is `BRANCH`-targeted, and the service refuses
  // any `branchId` other than the one in the operating context, so this screen
  // can only ever map the branch the user has selected.
  const branchScope = useTradeScopeRequest("BRANCH");

  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const isMalformedId = !isUUIDv7(id);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isMalformedId || gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(channelPath(id), {
        signal: controller.signal,
        headers,
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (!controller.signal.aborted) setChannel(parseChannelDetailResponse(result.data));
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setChannel(null);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, headers, gap, isMalformedId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const describe = useCallback(
    (failure: NormalizedApiError): string | undefined =>
      failure.code === CHANNEL_INVALID_CODE ? t.trade.channelInvalid : undefined,
    [t],
  );

  /**
   * Creates or updates the mapping for the **selected** branch.
   *
   * `POST` when there is no row yet and `PATCH` with `If-Match` when there is —
   * the service answers 409 on a POST over an existing mapping and 404 on a
   * PATCH without one, both under the single code `TRADE.CATALOG.CHANNEL_INVALID`.
   */
  const saveBranchMapping = useCallback(
    async (isActive: boolean): Promise<void> => {
      if (!canManage || isSubmitting || branchScope.gap || !context.branchId) return;
      const existing = channel?.branches.find((branch) => branch.branchId === context.branchId);
      setIsSubmitting(true);
      const outcome = await runWrite(
        () =>
          existing
            ? tradePatch(
                channelBranchPath(id, context.branchId as string),
                { isActive },
                {
                  headers: { ...branchScope.headers, "if-match": tradeIfMatch(existing.version) },
                },
              )
            : tradePost(
                channelBranchesPath(id),
                { branchId: context.branchId, isActive },
                { headers: branchScope.headers },
              ),
        { failureTitle: t.trade.channelBranchSaveFailed, describe },
      );
      setIsSubmitting(false);
      if (!outcome.ok && outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) reload();
      if (outcome.ok) {
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        reload();
      }
    },
    [
      canManage,
      isSubmitting,
      branchScope,
      context.branchId,
      channel,
      runWrite,
      id,
      describe,
      toast,
      t,
      reload,
    ],
  );

  const isGone =
    isMalformedId ||
    error?.status === 404 ||
    (error?.status === 422 && error.code === CHANNEL_INVALID_CODE);

  const selectedBranchMapping: ChannelBranch | null =
    channel?.branches.find((branch) => branch.branchId === context.branchId) ?? null;

  return {
    t,
    lang,
    canManage,
    channel,
    isLoading,
    error,
    isGone,
    isSubmitting,
    scopeGap: gap,
    branchScopeGap: branchScope.gap,
    selectedBranchId: context.branchId,
    selectedBranchMapping,
    saveBranchMapping,
    reload,
  };
}
