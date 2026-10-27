"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { isTradeReplay, type TradeResult } from "../../trade-api";
import { tradeDocumentMessage } from "../trade-document-errors";

/** The write that may or may not have applied, held until same-key recovery succeeds. */
interface TradeAmbiguousWrite {
  operation: string;
  idempotencyKey: string;
  correlationId?: string;
  retry: () => Promise<void>;
}

interface TradeWriteRequest {
  /** Already translated — names the write in a toast and in the ambiguous panel. */
  operation: string;
  /** Receives the key so the same one is replayed on retry, never a fresh one. */
  send: (headers: Record<string, string>) => Promise<TradeResult>;
  onSuccess?: (result: TradeResult) => void | Promise<unknown>;
}

export interface TradeWriteState {
  isWriting: boolean;
  /** Pending requests and unknown outcomes fence off every new write. */
  isBlocked: boolean;
  /** The last rejection, for an in-body surface a toast cannot host. */
  writeError: NormalizedApiError | null;
  ambiguous: TradeAmbiguousWrite | null;
  clearWriteError: () => void;
  runWrite: (request: TradeWriteRequest) => Promise<boolean>;
}

/**
 * One write path for every commercial-document mutation.
 *
 * Four Trade-specific rules are applied here rather than in each of the
 * thirty-odd call sites:
 *
 * 1. **The idempotency key is generated up front and reused on retry.** Trade
 *    sets `Idempotency-Replayed` itself and sets it to the string `"false"` on
 *    first execution, so presence proves nothing — only `=== "true"` is a
 *    replay, and a replay is a **success**: the write ran once and this is its
 *    stored result. `isTradeReplay` is the only correct test.
 * 2. **A `status: 0` failure is ambiguous, not failed.** The request left the
 *    browser and no response came back, so it may have applied. That evidence
 *    goes in-body with its key, never in a four-second toast.
 * 3. **A 403 raises nothing here** — `axiosClient` already fires its own toast,
 *    and a second one double-fires.
 * 4. **A rate-limit or idempotency outcome takes its own surface** through
 *    `outcomeFromApi` before any error message is considered.
 */
export function useTradeWrite(): TradeWriteState {
  const { t } = useI18n();
  const toast = useToast();
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [ambiguous, setAmbiguous] = useState<TradeAmbiguousWrite | null>(null);
  const inFlight = useRef(false);
  const unresolved = useRef<TradeAmbiguousWrite | null>(null);

  const runWrite = useCallback(
    async (request: TradeWriteRequest): Promise<boolean> => {
      // Refs close the gap before React commits disabled controls, including
      // double clicks and calls through a callback from an earlier render.
      if (inFlight.current || unresolved.current) return false;
      const { send, onSuccess, operation } = request;
      const idempotencyKey = generateUUIDv7();
      const attempt = async (recovery = false): Promise<boolean> => {
        if (inFlight.current || (recovery && unresolved.current?.idempotencyKey !== idempotencyKey)) return false;
        inFlight.current = true;
        setIsWriting(true);
        setWriteError(null);
        try {
          let result: TradeResult;
          try {
            result = await send({ "x-idempotency-key": idempotencyKey });
          } catch (error) {
            const normalized = normalizeApiError(error);
            if (normalized.status === 0) {
              const pending: TradeAmbiguousWrite = {
                operation,
                idempotencyKey,
                correlationId: normalized.correlationId,
                retry: async () => {
                  await attempt(true);
                },
              };
              unresolved.current = pending;
              setAmbiguous(pending);
              return false;
            }
            setWriteError(normalized);
            if (normalized.status === 403) return false;
            if (toast.outcomeFromApi(normalized)) return false;
            const specific = tradeDocumentMessage(normalized.code, t.tradeDocuments.errors);
            if (specific) toast.error(operation, specific);
            else toast.errorFromApi(operation, normalized);
            return false;
          }
          unresolved.current = null;
          setAmbiguous(null);
          toast.success(
            operation,
            isTradeReplay(result.headers)
              ? t.tradeDocuments.replayedDescription
              : t.tradeDocuments.savedDescription,
          );
          // A refresh failure is not evidence that the write failed. Only the
          // transport catch above may create an ambiguous outcome.
          await onSuccess?.(result);
          return true;
        } finally {
          inFlight.current = false;
          setIsWriting(false);
        }
      };
      return attempt();
    },
    [t, toast],
  );

  return {
    isWriting,
    isBlocked: isWriting || ambiguous !== null,
    writeError,
    ambiguous,
    clearWriteError: () => setWriteError(null),
    runWrite,
  };
}
