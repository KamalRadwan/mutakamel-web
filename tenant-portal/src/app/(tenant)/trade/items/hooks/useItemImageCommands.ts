"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { tradeDelete, tradeIfMatch, tradePut } from "../../trade-api";
import { TRADE_CONCURRENCY_CODES, TRADE_TARGET_DENIED_CODE } from "../../trade-scope";
import { ITEM_NOT_FOUND_CODE } from "../item-contract";
import {
  ITEM_IMAGE_ERROR_CODES,
  itemImagePath,
  parseItemImageReceipt,
  parseItemImageRemovalReceipt,
  type ItemImageChange,
  type ItemImageInvalidReason,
} from "../item-image-contract";

/** `maxReplayResponseBytes` of both Gateway image write routes. */
const RECEIPT_LIMIT_BYTES = 16_384;

export interface ItemImageTarget {
  itemId: string;
  /** The Item version the change is based on: the `If-Match`. */
  version: number;
}

export type ItemImageCommandResult =
  | { ok: true; change: ItemImageChange }
  | { ok: false; stale: boolean };

interface Attempt {
  kind: "set" | "remove";
  itemId: string;
  file: File | null;
  key: string;
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/**
 * `PUT` and `DELETE /items/:id/image` (LLD 02b §13).
 *
 * One idempotency key per user attempt: retrying the same file on the same
 * Item resends the same key, so a lost response or a `503` resolves to the
 * original receipt instead of a second upload. A new file or another Item
 * starts a new attempt, and a `STALE_VERSION` or `IDEMPOTENCY.MISMATCH`
 * refusal ends one — a stale attempt is never replayed with its old key
 * (§19 Edit flow).
 */
export function useItemImageCommands() {
  const { t } = useI18n();
  const toast = useToast();
  const attempt = useRef<Attempt | null>(null);
  const [pending, setPending] = useState<Attempt["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const keyFor = useCallback((kind: Attempt["kind"], itemId: string, file: File | null) => {
    const current = attempt.current;
    if (current && current.kind === kind && current.itemId === itemId && current.file === file) {
      return current.key;
    }
    const key = generateUUIDv7();
    attempt.current = { kind, itemId, file, key };
    return key;
  }, []);

  const fail = useCallback(
    (thrown: unknown, fallback: string): ItemImageCommandResult => {
      const normalized = normalizeApiError(thrown);
      const stale = isStale(normalized);
      if (stale || normalized.code === "TRADE.IDEMPOTENCY.MISMATCH") attempt.current = null;
      const message = itemImageErrorMessage(normalized, t);
      // An unmapped failure keeps its code and correlationId in a toast, the
      // evidence a support report needs; the tile still says what to do.
      if (!message && normalized.status !== 403) toast.errorFromApi(fallback, normalized);
      setError(message ?? fallback);
      return { ok: false, stale };
    },
    [t, toast],
  );

  const upload = useCallback(
    async (target: ItemImageTarget, file: File): Promise<ItemImageCommandResult> => {
      setPending("set");
      setError(null);
      setAnnouncement("");
      const body = new FormData();
      body.append("file", file, file.name);
      try {
        const result = await tradePut(itemImagePath(target.itemId), body, {
          headers: {
            "if-match": tradeIfMatch(target.version),
            "x-idempotency-key": keyFor("set", target.itemId, file),
          },
          maxResponseBytes: RECEIPT_LIMIT_BYTES,
        });
        const change = parseItemImageReceipt(result.data);
        attempt.current = null;
        setAnnouncement(t.trade.itemImage.updated);
        return { ok: true, change };
      } catch (thrown) {
        return fail(thrown, t.trade.itemImage.uploadFailed);
      } finally {
        setPending(null);
      }
    },
    [fail, keyFor, t],
  );

  const remove = useCallback(
    async (target: ItemImageTarget): Promise<ItemImageCommandResult> => {
      setPending("remove");
      setError(null);
      setAnnouncement("");
      try {
        const result = await tradeDelete(itemImagePath(target.itemId), {
          headers: {
            "if-match": tradeIfMatch(target.version),
            "x-idempotency-key": keyFor("remove", target.itemId, null),
          },
          maxResponseBytes: RECEIPT_LIMIT_BYTES,
        });
        const change = parseItemImageRemovalReceipt(result.data);
        attempt.current = null;
        setAnnouncement(t.trade.itemImage.removed);
        return { ok: true, change };
      } catch (thrown) {
        return fail(thrown, t.trade.itemImage.removeFailed);
      } finally {
        setPending(null);
      }
    },
    [fail, keyFor, t],
  );

  return {
    isUploading: pending === "set",
    isRemoving: pending === "remove",
    error,
    /** Polite status text: in flight, then the result. */
    status:
      pending === "set"
        ? t.trade.itemImage.uploading
        : pending === "remove"
          ? t.trade.itemImage.removing
          : announcement,
    setError,
    upload,
    remove,
  };
}

function isStale(error: NormalizedApiError): boolean {
  return error.code === TRADE_CONCURRENCY_CODES.staleVersion || error.status === 412;
}

const INVALID_REASON_COPY: Record<ItemImageInvalidReason, keyof Dictionary["trade"]["itemImage"]> = {
  TYPE_NOT_ALLOWED: "typeNotAllowed",
  // The declared type and the file name disagree: the same "not really that
  // type" guidance as a content mismatch.
  EXTENSION_MISMATCH: "contentMismatch",
  CONTENT_MISMATCH: "contentMismatch",
  DECODE_FAILED: "decodeFailed",
  ANIMATED_OR_MULTIPAGE: "animated",
  TOO_SMALL: "tooSmall",
  TOO_DETAILED: "tooDetailed",
};

function isInvalidReason(value: string | undefined): value is ItemImageInvalidReason {
  return value !== undefined && value in INVALID_REASON_COPY;
}

/**
 * LLD 02b §12: every image refusal has its own next step, so none shares a
 * message. `details.reason` arrives as a one-item string array, which
 * `normalizeApiError` exposes as `fieldErrors.reason`. Returns `undefined`
 * for a failure with no specific guidance.
 */
function itemImageErrorMessage(error: NormalizedApiError, t: Dictionary): string | undefined {
  const copy = t.trade.itemImage;
  switch (error.code) {
    case ITEM_IMAGE_ERROR_CODES.required:
      return copy.required;
    case ITEM_IMAGE_ERROR_CODES.invalid: {
      const reason = error.fieldErrors?.reason?.[0];
      return isInvalidReason(reason) ? copy[INVALID_REASON_COPY[reason]] : copy.invalid;
    }
    case ITEM_IMAGE_ERROR_CODES.tooLarge:
      return copy.tooLarge;
    case ITEM_IMAGE_ERROR_CODES.notFound:
      return copy.notFound;
    case ITEM_IMAGE_ERROR_CODES.storageUnavailable:
      return copy.storageUnavailable;
    case ITEM_IMAGE_ERROR_CODES.printBudgetExceeded:
      return copy.printBudget;
    case ITEM_NOT_FOUND_CODE:
      return t.trade.itemNotFoundDescription;
    case TRADE_TARGET_DENIED_CODE:
      return copy.targetDenied;
    case TRADE_CONCURRENCY_CODES.ifMatchRequired:
      return t.trade.errorIfMatchRequired;
    case "TRADE.IDEMPOTENCY.KEY_REQUIRED":
      return t.trade.errorIdempotencyKey;
    case "TRADE.IDEMPOTENCY.IN_FLIGHT":
      return t.trade.errorIdempotencyInFlight;
    case "TRADE.IDEMPOTENCY.MISMATCH":
      return t.trade.errorIdempotencyMismatch;
    case "TRADE.VALIDATION_FAILED":
      return t.trade.errorValidationFailed;
    default:
      break;
  }
  if (isStale(error)) return copy.staleVersion;
  // A Gateway refusal carries no Trade code; the status still names the cause.
  if (error.status === 403) return copy.targetDenied;
  if (error.status === 413) return copy.tooLarge;
  if (error.status === 415) return copy.invalid;
  if (error.status === 503) return copy.storageUnavailable;
  return undefined;
}
