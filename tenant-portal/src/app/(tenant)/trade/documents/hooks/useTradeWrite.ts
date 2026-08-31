"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { isTradeReplay, type TradeResult } from "../../trade-api";
import { tradeDocumentMessage } from "../trade-document-errors";

/** The write that may or may not have applied, held until the user resolves it. */
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
  onSuccess?: (result: TradeResult) => void;
}

export interface TradeWriteState {
  isWriting: boolean;
  /** The last rejection, for an in-body surface a toast cannot host. */
  writeError: NormalizedApiError | null;
  ambiguous: TradeAmbiguousWrite | null;
  clearWriteError: () => void;
  dismissAmbiguous: () => void;
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

  const runWrite = useCallback(
    async (request: TradeWriteRequest): Promise<boolean> => {
      const attempt = async (idempotencyKey: string): Promise<boolean> => {
        setIsWriting(true);
        setWriteError(null);
        try {
          const result = await request.send({ "x-idempotency-key": idempotencyKey });
          setAmbiguous(null);
          request.onSuccess?.(result);
          toast.success(
            request.operation,
            isTradeReplay(result.headers)
              ? t.tradeDocuments.replayedDescription
              : t.tradeDocuments.savedDescription,
          );
          return true;
        } catch (error) {
          const normalized = normalizeApiError(error);
          if (normalized.status === 0) {
            setAmbiguous({
              operation: request.operation,
              idempotencyKey,
              correlationId: normalized.correlationId,
              retry: async () => {
                await attempt(idempotencyKey);
              },
            });
            return false;
          }
          setWriteError(normalized);
          if (normalized.status === 403) return false;
          if (toast.outcomeFromApi(normalized)) return false;
          const specific = tradeDocumentMessage(normalized.code, t.tradeDocuments.errors);
          if (specific) toast.error(request.operation, specific);
          else toast.errorFromApi(request.operation, normalized);
          return false;
        } finally {
          setIsWriting(false);
        }
      };
      return attempt(generateUUIDv7());
    },
    [t, toast],
  );

  return {
    isWriting,
    writeError,
    ambiguous,
    clearWriteError: () => setWriteError(null),
    dismissAmbiguous: () => setAmbiguous(null),
    runWrite,
  };
}
