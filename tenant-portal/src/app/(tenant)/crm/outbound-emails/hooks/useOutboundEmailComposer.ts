"use client";

import { useCallback, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  OUTBOUND_EMAILS_PATH,
  OUTBOUND_EMAIL_OPTIONS_PATH,
  OUTBOUND_EMAIL_PREVIEW_PATH,
  buildOptionsRequest,
  buildSendRequest,
  parseAcceptedResponse,
  parseOptionsResponse,
  parsePreviewResponse,
  type OutboundEmailAccepted,
  type OutboundEmailOptions,
  type OutboundEmailPreview,
  type OutboundEmailRecipientReference,
  type OutboundEmailSourceType,
} from "../outbound-email-contract";

const POST_READ_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 2_000_000,
  // These two are POSTs that READ. They create nothing — the service
  // documents preview as "deliberately does not create an email intent,
  // activity, recipient snapshot or Worker outbox event" — and the Gateway
  // declares neither idempotent, so no key is required and a replay is not a
  // concept here.
  nonReplayable: true,
} as const;

const SEND_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 512 * 1024,
  nonReplayable: true,
} as const;

export interface SendResult {
  accepted: OutboundEmailAccepted | null;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/**
 * The compose flow: options, then preview, then send.
 *
 * `POST /outbound-emails` answers **202 Accepted** with `status: "QUEUED"`.
 * The message has been handed to the worker pipeline, not delivered, so
 * nothing here reports it as sent.
 */
export function useOutboundEmailComposer() {
  const [options, setOptions] = useState<OutboundEmailOptions | null>(null);
  const [optionsError, setOptionsError] = useState<NormalizedApiError | null>(
    null,
  );
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [preview, setPreview] = useState<OutboundEmailPreview | null>(null);
  const [previewError, setPreviewError] = useState<NormalizedApiError | null>(
    null,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadOptions = useCallback(
    async (sourceType: OutboundEmailSourceType, sourceId: string) => {
      setIsLoadingOptions(true);
      setOptionsError(null);
      setOptions(null);
      setPreview(null);
      try {
        const response = await axiosClient.post<unknown>(
          OUTBOUND_EMAIL_OPTIONS_PATH,
          buildOptionsRequest(sourceType, sourceId),
          POST_READ_CONFIG,
        );
        setOptions(parseOptionsResponse(response.data));
      } catch (error) {
        setOptionsError(normalizeApiError(error));
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [],
  );

  const loadPreview = useCallback(
    async (
      sourceType: OutboundEmailSourceType,
      sourceId: string,
      recipient: OutboundEmailRecipientReference,
      templateVersionId: string | null,
    ) => {
      setIsPreviewing(true);
      setPreviewError(null);
      try {
        const response = await axiosClient.post<unknown>(
          OUTBOUND_EMAIL_PREVIEW_PATH,
          buildSendRequest(sourceType, sourceId, recipient, templateVersionId),
          POST_READ_CONFIG,
        );
        setPreview(parsePreviewResponse(response.data));
      } catch (error) {
        setPreview(null);
        setPreviewError(normalizeApiError(error));
      } finally {
        setIsPreviewing(false);
      }
    },
    [],
  );

  const send = async (
    sourceType: OutboundEmailSourceType,
    sourceId: string,
    recipient: OutboundEmailRecipientReference,
    templateVersionId: string | null,
  ): Promise<SendResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildSendRequest(sourceType, sourceId, recipient, templateVersionId);
    } catch (error) {
      return {
        accepted: null,
        replayed: false,
        error: {
          status: 0,
          code: error instanceof Error ? error.message : "INVALID_INPUT",
        },
      };
    }
    setIsSending(true);
    try {
      // The Gateway declares this route idempotent, so the automatic
      // x-idempotency-key must NOT be suppressed — without it the request is
      // refused with IDEM_MISSING before it reaches crm-app.
      const response = await axiosClient.post<unknown>(
        OUTBOUND_EMAILS_PATH,
        body,
        SEND_CONFIG,
      );
      return {
        accepted: parseAcceptedResponse(response.data),
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      return { accepted: null, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSending(false);
    }
  };

  return {
    options,
    optionsError,
    isLoadingOptions,
    preview,
    previewError,
    isPreviewing,
    isSending,
    loadOptions,
    loadPreview,
    send,
    /**
     * Drops a rendered preview without dropping the options.
     *
     * Changing the recipient or the template invalidates what was rendered,
     * and leaving it on screen would show one message while another is queued.
     */
    clearPreview: () => {
      setPreview(null);
      setPreviewError(null);
    },
    reset: () => {
      setOptions(null);
      setOptionsError(null);
      setPreview(null);
      setPreviewError(null);
    },
  };
}
