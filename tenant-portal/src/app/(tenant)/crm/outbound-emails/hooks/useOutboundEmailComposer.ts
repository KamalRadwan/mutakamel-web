"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  OUTBOUND_EMAILS_PATH, OUTBOUND_EMAIL_OPTIONS_PATH, OUTBOUND_EMAIL_PREVIEW_PATH,
  buildOptionsRequest, buildSendRequest, parseOptionsResponse, parsePreviewResponse,
  type OutboundEmailOptions, type OutboundEmailPreview,
  type OutboundEmailRecipientReference, type OutboundEmailSourceType,
} from "../outbound-email-contract";
import { canSendOutboundEmail } from "./useOutboundEmails";
import { useOutboundEmailWrite, type EmailWriteResult } from "./useOutboundEmailWrite";

export type SendResult = EmailWriteResult;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2_000_000, skipAutoIdempotency: true } as const;

export function useOutboundEmailComposer() {
  const { user } = useTenantAuth();
  const authScope = useAuthScopeKey(user);
  const scope = authScope + ":" + user?.featureEntitlements?.["crm.outbound_email"];
  const canSend = canSendOutboundEmail(user?.permissions) && user?.featureEntitlements?.["crm.outbound_email"] !== false;
  const live = useRef({ scope, canSend });
  useLayoutEffect(() => { live.current = { scope, canSend }; }, [scope, canSend]);
  const reads = useRef({ options: 0, preview: 0 });
  const controllers = useRef<{ options?: AbortController; preview?: AbortController }>({});
  const [options, setOptions] = useState<OutboundEmailOptions | null>(null);
  const [optionsScope, setOptionsScope] = useState(scope);
  const [optionsError, setOptionsError] = useState<NormalizedApiError | null>(null);
  const [isLoadingOptions, setLoadingOptions] = useState(false);
  const [preview, setPreview] = useState<OutboundEmailPreview | null>(null);
  const [previewScope, setPreviewScope] = useState(scope);
  const [previewError, setPreviewError] = useState<NormalizedApiError | null>(null);
  const [isPreviewing, setPreviewing] = useState(false);
  const write = useOutboundEmailWrite(scope, canSend);

  const clearPreview = useCallback(() => {
    reads.current.preview++;
    controllers.current.preview?.abort();
    setPreview(null); setPreviewError(null); setPreviewing(false);
  }, []);
  const clearReads = useCallback(() => {
    reads.current.options++;
    controllers.current.options?.abort();
    clearPreview();
    setOptions(null); setOptionsError(null); setLoadingOptions(false);
  }, [clearPreview]);

  useEffect(() => {
    const optionEpoch = ++reads.current.options;
    const previewEpoch = ++reads.current.preview;
    controllers.current.options?.abort(); controllers.current.preview?.abort();
    queueMicrotask(() => {
      if (live.current.scope !== scope) return;
      if (reads.current.options === optionEpoch) {
        setOptions(null); setOptionsScope(scope); setOptionsError(null); setLoadingOptions(false);
      }
      if (reads.current.preview === previewEpoch) {
        setPreview(null); setPreviewScope(scope); setPreviewError(null); setPreviewing(false);
      }
    });
  }, [scope]);
  useEffect(() => () => {
    reads.current.options++; reads.current.preview++;
    controllers.current.options?.abort(); controllers.current.preview?.abort();
  }, []);

  const loadOptions = useCallback(async (sourceType: OutboundEmailSourceType, sourceId: string) => {
    if (!live.current.canSend) return;
    const owner = live.current.scope;
    controllers.current.options?.abort();
    const controller = new AbortController();
    controllers.current.options = controller;
    const generation = ++reads.current.options;
    const current = () => !controller.signal.aborted && reads.current.options === generation && live.current.scope === owner;
    clearPreview(); setOptionsScope(owner); setLoadingOptions(true); setOptionsError(null); setOptions(null);
    try {
      const response = await axiosClient.post<unknown>(OUTBOUND_EMAIL_OPTIONS_PATH,
        buildOptionsRequest(sourceType, sourceId), { ...READ_CONFIG, signal: controller.signal });
      if (!current()) return;
      const parsed = parseOptionsResponse(response.data);
      if (parsed.sourceType !== sourceType || parsed.sourceId !== sourceId) throw new Error("Invalid CRM outbound-email response.");
      setOptions(parsed); setOptionsScope(owner);
    } catch (failure) {
      if (current()) setOptionsError(normalizeApiError(failure));
    } finally { if (current()) setLoadingOptions(false); }
  }, [clearPreview]);

  const loadPreview = useCallback(async (
    sourceType: OutboundEmailSourceType, sourceId: string,
    recipient: OutboundEmailRecipientReference, templateVersionId: string | null,
  ) => {
    if (!live.current.canSend) return;
    const owner = live.current.scope;
    controllers.current.preview?.abort();
    const controller = new AbortController();
    controllers.current.preview = controller;
    const generation = ++reads.current.preview;
    const current = () => !controller.signal.aborted && reads.current.preview === generation && live.current.scope === owner;
    setPreviewScope(owner); setPreviewing(true); setPreviewError(null); setPreview(null);
    try {
      const response = await axiosClient.post<unknown>(OUTBOUND_EMAIL_PREVIEW_PATH,
        buildSendRequest(sourceType, sourceId, recipient, templateVersionId), { ...READ_CONFIG, signal: controller.signal });
      if (current()) { setPreview(parsePreviewResponse(response.data)); setPreviewScope(owner); }
    } catch (failure) {
      if (current()) setPreviewError(normalizeApiError(failure));
    } finally { if (current()) setPreviewing(false); }
  }, []);

  function send(sourceType: OutboundEmailSourceType, sourceId: string,
    recipient: OutboundEmailRecipientReference, templateVersionId: string | null): Promise<SendResult> {
    if (optionsScope !== scope || !options || options.sourceType !== sourceType || options.sourceId !== sourceId || options.availability.length ||
      !options.recipients.some((option) => JSON.stringify(option.reference) === JSON.stringify(recipient))) {
      return Promise.resolve({ accepted: null, replayed: false, error: { status: 0, code: "CRM_EMAIL_RECIPIENT_INVALID" } });
    }
    try { return write.submit(OUTBOUND_EMAILS_PATH, buildSendRequest(sourceType, sourceId, recipient, templateVersionId)); }
    catch (failure) { return Promise.resolve({ accepted: null, replayed: false,
      error: { status: 0, code: failure instanceof Error ? failure.message : "INVALID_INPUT" } }); }
  }

  return {
    options: optionsScope === scope ? options : null,
    optionsError: optionsScope === scope ? optionsError : null, isLoadingOptions,
    preview: previewScope === scope ? preview : null,
    previewError: previewScope === scope ? previewError : null, isPreviewing,
    isSending: write.isPending, uncertain: write.uncertain, canSend, scope,
    loadOptions, loadPreview, send, reconcile: write.reconcile, clearPreview,
    isBlocked: write.isBlocked,
    reset: () => { if (!write.clear()) return false; clearReads(); return true; },
  };
}
