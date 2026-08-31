"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import { canPerformTradeAction, TRADE_CONCURRENCY_CODES, TRADE_PERMISSIONS } from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  buildCreateChannelRequest,
  buildUpdateChannelRequest,
  CHANNELS_PATH,
  CHANNEL_CODE_TAKEN_CODE,
  CHANNEL_INVALID_CODE,
  channelPath,
  parseChannelListResponse,
  parseChannelResponse,
  type Channel,
  type ChannelFormValues,
} from "../channel-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 40_000;

/** Every channel route targets `COMPANY`; the branch routes live on the detail screen. */
const READ_TARGET = "COMPANY" as const;

export function useChannels() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.itemsManage);
  const { headers, gap } = useTradeScopeRequest(READ_TARGET);

  const [items, setItems] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [conflict, setConflict] = useState<Channel | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await tradeGet(CHANNELS_PATH, {
          signal,
          headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        // A **bare array**, not `{ items, total, page, limit }`. A generic list
        // adapter reads `undefined` here.
        setItems(parseChannelListResponse(result.data));
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [gap, headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === CHANNEL_CODE_TAKEN_CODE) return t.trade.channelCodeTaken;
      if (error.code === CHANNEL_INVALID_CODE) return t.trade.channelInvalid;
      return undefined;
    },
    [t],
  );

  const isStale = useCallback(
    (error: NormalizedApiError) => error.code === TRADE_CONCURRENCY_CODES.staleVersion,
    [],
  );

  const openConflict = useCallback(
    async (id: string): Promise<void> => {
      try {
        const result = await tradeGet(channelPath(id), {
          headers,
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        setConflict(parseChannelResponse(result.data));
      } catch {
        setConflict(null);
      }
    },
    [headers],
  );

  const create = useCallback(
    async (values: ChannelFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateChannelRequest(values);
        const outcome = await runWrite(() => tradePost(CHANNELS_PATH, request, { headers }), {
          failureTitle: t.trade.channelCreateFailed,
          describe,
        });
        if (!outcome.ok) return false;
        setCreateOpen(false);
        toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, runWrite, headers, describe, toast, t, load],
  );

  const update = useCallback(
    async (values: ChannelFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateChannelRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        const outcome = await runWrite(
          () =>
            tradePatch(channelPath(editing.id), request, {
              headers: { ...headers, "if-match": tradeIfMatch(editing.version) },
            }),
          { failureTitle: t.trade.channelUpdateFailed, describe, isHandled: isStale },
        );
        if (!outcome.ok) {
          if (outcome.error && isStale(outcome.error)) await openConflict(editing.id);
          return false;
        }
        setEditing(null);
        toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canManage,
      editing,
      isSubmitting,
      runWrite,
      headers,
      describe,
      isStale,
      openConflict,
      toast,
      t,
      load,
    ],
  );

  return {
    t,
    lang,
    canManage,
    scopeGap: gap,
    items,
    // `GET /channels` is not paginated at all, so this is the honest total on
    // one page rather than a fabricated pager over a single fetch.
    pageInfo: { page: 1, limit: Math.max(items.length, 1), total: items.length },
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    editing,
    conflict,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    openEdit: (channel: Channel) => {
      setFormError(null);
      setEditing(channel);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    dismissConflict: () => setConflict(null),
    resolveConflict: () => {
      setConflict(null);
      setEditing(null);
      void load();
    },
    create,
    update,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function replayMessage(replayed: boolean, t: Dictionary): string {
  return replayed ? t.trade.replayedDescription : t.trade.savedDescription;
}

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "CHANNEL_FORM_CODE") return t.trade.channelFormCode;
  if (reason === "CHANNEL_FORM_NAME") return t.trade.channelFormName;
  if (reason === "CHANNEL_FORM_STATUS") return t.trade.channelFormStatus;
  return t.trade.channelCreateFailed;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
