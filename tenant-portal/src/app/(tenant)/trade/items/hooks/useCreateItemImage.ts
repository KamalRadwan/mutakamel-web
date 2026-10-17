"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { tradeGet } from "../../trade-api";
import { itemPath, parseItemDetailResponse } from "../item-contract";
import { useItemImageCommands, type ItemImageTarget } from "./useItemImageCommands";

const DETAIL_RESPONSE_LIMIT_BYTES = 200_000;

/**
 * The image half of New Item (LLD 02b §19 create flow, steps 4–5).
 *
 * An image cannot be uploaded before its Item exists, so the Item is created
 * first and the image follows with the returned version as `If-Match`. When
 * the upload fails the Item stays created: this keeps the saved Item as the
 * retry target so a retry uploads to it and never creates a second Item.
 */
export function useCreateItemImage() {
  const { t } = useI18n();
  const commands = useItemImageCommands();
  // `undefined`: no failure. `null` target: the Item was saved but its
  // receipt carried no usable id, so there is nothing to retry against.
  const [failedTarget, setFailedTarget] = useState<ItemImageTarget | null | undefined>(undefined);
  const { upload, setError } = commands;

  const send = useCallback(
    async (target: ItemImageTarget | null, file: File): Promise<boolean> => {
      if (!target) {
        setFailedTarget(null);
        setError(t.trade.itemImage.uploadFailed);
        return false;
      }
      const result = await upload(target, file);
      if (result.ok) {
        setFailedTarget(undefined);
        return true;
      }
      setFailedTarget(result.stale ? await withCurrentVersion(target) : target);
      return false;
    },
    [upload, setError, t],
  );

  return {
    /** "Item saved. The image was not uploaded." is showing. */
    failed: failedTarget !== undefined,
    canRetry: Boolean(failedTarget),
    isUploading: commands.isUploading,
    error: commands.error,
    status: commands.status,
    uploadAfterCreate: send,
    retry: useCallback(
      (file: File) => (failedTarget ? send(failedTarget, file) : Promise.resolve(false)),
      [failedTarget, send],
    ),
    reset: useCallback(() => {
      setFailedTarget(undefined);
      setError(null);
    }, [setError]),
  };
}

/**
 * After `STALE_VERSION` the next attempt needs the Item's current version.
 * If even that read fails, the old target is kept and the retry is refused
 * again as stale, which says the same thing.
 */
async function withCurrentVersion(target: ItemImageTarget): Promise<ItemImageTarget> {
  try {
    const result = await tradeGet(itemPath(target.itemId), {
      headers: {},
      maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
    });
    return { itemId: target.itemId, version: parseItemDetailResponse(result.data).version };
  } catch {
    return target;
  }
}
