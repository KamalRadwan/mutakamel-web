"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { canSendOutboundEmail } from "./useOutboundEmails";
import { useOutboundEmailWrite, type EmailWriteResult } from "./useOutboundEmailWrite";
import {
  buildRetryRequest, isPendingDelivery, outboundEmailPath, outboundEmailRetryPath,
  parseDetailResponse, type OutboundEmailDetail,
} from "../outbound-email-contract";

export type RetryResult =
  | { ok: true; outboundEmailId: string; replayed: boolean; error: null }
  | { ok: false; replayed: false; error: NormalizedApiError };

export function useOutboundEmailDetail(outboundEmailId: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const authScope = useAuthScopeKey(user);
  const scope = authScope + ":" + user?.featureEntitlements?.["crm.outbound_email"] + ":" + outboundEmailId;
  const canSend = canSendOutboundEmail(user?.permissions) && user?.featureEntitlements?.["crm.outbound_email"] !== false;
  const live = useRef(scope);
  useLayoutEffect(() => { live.current = scope; }, [scope]);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [detail, setDetail] = useState<OutboundEmailDetail | null>(null);
  const [dataScope, setDataScope] = useState(scope);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [retainedError, setRetainedError] = useState<NormalizedApiError | null>(null);
  const currentDetail = useRef<OutboundEmailDetail | null>(null);
  const email = dataScope === scope && detail?.outboundEmailId === outboundEmailId ? detail : null;
  useLayoutEffect(() => { currentDetail.current = email; }, [email]);
  const write = useOutboundEmailWrite(scope, canSend);
  const canRetry = canSend && !isLoading && !write.isPending && !write.uncertain && !retainedError &&
    email?.status === "FAILED" && !email.retriedById && email.content.state === "AVAILABLE";

  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const requestGeneration = ++generation.current;
    const current = () => !request.signal.aborted && requestGeneration === generation.current && live.current === scope;
    setIsLoading(true); setQueryError(null); setRetainedError(null);
    try {
      const response = await axiosClient.get<unknown>(outboundEmailPath(outboundEmailId),
        { cache: "no-store", maxResponseBytes: 2_000_000, signal: request.signal });
      if (!current()) return;
      const parsed = parseDetailResponse(response.data);
      if (parsed.outboundEmailId !== outboundEmailId) throw new Error("Invalid CRM outbound-email response.");
      setDetail(parsed); setDataScope(scope);
    } catch (failure) {
      if (!current()) return;
      const error = normalizeApiError(failure);
      if (currentDetail.current && error.status !== 403 && error.status !== 401 && error.status !== 404) setRetainedError(error);
      else { setDetail(null); setQueryError(error); }
    } finally { if (current()) setIsLoading(false); }
  }, [outboundEmailId, scope]);

  useEffect(() => {
    let active = true;
    const requestGeneration = generation.current;
    queueMicrotask(() => { if (active && live.current === scope && requestGeneration === generation.current) void load(); });
    return () => { active = false; controller.current?.abort(); };
  }, [load, scope]);

  function finish(result: EmailWriteResult): RetryResult {
    if (result.accepted) {
      const child = result.accepted.outboundEmailId;
      setDetail((current) => current?.outboundEmailId === outboundEmailId ? { ...current, retriedById: child } : current);
      return { ok: true, outboundEmailId: child, replayed: result.replayed, error: null };
    }
    return { ok: false, replayed: false,
      error: result.error ?? { status: 409, code: "CRM.EMAIL.RETRY_NOT_ALLOWED" } };
  }

  async function retry(reason: string): Promise<RetryResult> {
    if (!canSend) return { ok: false, replayed: false, error: { status: 403, code: "FORBIDDEN" } };
    if (!canRetry || write.isBlocked()) return { ok: false, replayed: false, error: {
      status: 409, code: email?.retriedById ? "CRM.EMAIL.RETRY_ALREADY_CREATED" : "CRM.EMAIL.RETRY_NOT_ALLOWED",
    } };
    let body: Record<string, unknown>;
    try { body = buildRetryRequest(reason); }
    catch { return { ok: false, replayed: false, error: { status: 0, code: "CRM_EMAIL_RETRY_REASON_INVALID" } }; }
    const result = await write.submit(outboundEmailRetryPath(outboundEmailId), body);
    if (result.error?.status === 409 || result.error?.status === 404) void load();
    return finish(result);
  }

  return {
    t, lang, scope, detail: email, isLoading, isRetrying: write.isPending,
    queryError, retainedError, notFound: queryError?.status === 404,
    canSend, canRetry, uncertain: write.uncertain,
    isPending: email ? isPendingDelivery(email.status) : false,
    retry, reconcile: async () => finish(await write.reconcile()), reload: load,
  };
}
