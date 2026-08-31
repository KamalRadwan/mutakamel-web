"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  buildRetryRequest,
  isPendingDelivery,
  outboundEmailPath,
  outboundEmailRetryPath,
  parseAcceptedResponse,
  parseDetailResponse,
  type OutboundEmailDetail,
} from "../outbound-email-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2_000_000 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 512 * 1024,
  nonReplayable: true,
} as const;

export interface RetryResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/** `GET /outbound-emails/:id` and `POST /outbound-emails/:id/retry`. */
export function useOutboundEmailDetail(outboundEmailId: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canSend = user?.permissions.includes("crm.email.send") ?? false;
  const [detail, setDetail] = useState<OutboundEmailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await axiosClient.get<unknown>(
          outboundEmailPath(outboundEmailId),
          { ...READ_CONFIG, signal },
        );
        setDetail(parseDetailResponse(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setDetail(null);
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [outboundEmailId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  /**
   * `POST /:id/retry` — 202 Accepted, exactly like the original send. The
   * retry is queued, not delivered, and the row it creates carries its own id.
   */
  const retry = async (reason: string): Promise<RetryResult> => {
    if (!canSend) {
      return {
        ok: false,
        replayed: false,
        error: { status: 403, code: "FORBIDDEN" },
      };
    }
    let body: Record<string, unknown>;
    try {
      body = buildRetryRequest(reason);
    } catch (error) {
      return {
        ok: false,
        replayed: false,
        error: {
          status: 0,
          code: error instanceof Error ? error.message : "INVALID_INPUT",
        },
      };
    }
    setIsRetrying(true);
    try {
      const response = await axiosClient.post<unknown>(
        outboundEmailRetryPath(outboundEmailId),
        body,
        WRITE_CONFIG,
      );
      // Parsed to prove the 202 body is the accepted shape before the screen
      // claims anything about it.
      parseAcceptedResponse(response.data);
      await load();
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    t,
    lang,
    detail,
    isLoading,
    isRetrying,
    queryError,
    notFound: queryError?.status === 404,
    canSend,
    // Delivery state is written by the worker pipeline after the fact, so a
    // QUEUED or DISPATCHING row is expected to change without anything the
    // user did. The screen says so and offers a refresh.
    isPending: detail ? isPendingDelivery(detail.status) : false,
    retry,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
