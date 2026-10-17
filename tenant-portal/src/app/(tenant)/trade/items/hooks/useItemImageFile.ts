"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatBytes } from "@/lib/format/number";
import {
  ITEM_IMAGE_LOW_RESOLUTION_EDGE_PX,
  ITEM_IMAGE_MAX_BYTES,
  ITEM_IMAGE_MAX_PIXELS,
  ITEM_IMAGE_MIME_TYPES,
  ITEM_IMAGE_MIN_EDGE_PX,
} from "../item-image-contract";

/** A picked image that passed the browser checks and is not on the server yet. */
export interface PendingItemImage {
  file: File;
  /** Object URL; this hook creates and revokes it. */
  previewUrl: string;
  /** Longest edge under 300 px: a non-blocking print-quality hint. */
  lowResolution: boolean;
}

type DecodedSize = { width: number; height: number } | "UNREADABLE" | null;

/**
 * The picked file before it is sent (LLD 02b §19 create flow, steps 1–2).
 *
 * The browser checks MIME and size (the tile does, through the shared upload
 * screening), then decodes the file to confirm it is an image and read its
 * edges. These are advisory: the server decodes again and is authoritative,
 * so a browser without `createImageBitmap` simply skips the decode check.
 */
export function useItemImageFile() {
  const { t, lang } = useI18n();
  const copy = t.trade.itemImage;
  const [pending, setPending] = useState<PendingItemImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Revokes each preview URL once it is replaced, cleared or unmounted.
  useEffect(() => {
    if (!pending) return undefined;
    return () => URL.revokeObjectURL(pending.previewUrl);
  }, [pending]);

  const choose = useCallback(
    async (file: File): Promise<void> => {
      setError(null);
      const size = await decodedSize(file);
      if (size === "UNREADABLE") {
        setError(copy.decodeFailed);
        return;
      }
      if (size && Math.min(size.width, size.height) < ITEM_IMAGE_MIN_EDGE_PX) {
        setError(copy.tooSmall);
        return;
      }
      if (size && size.width * size.height > ITEM_IMAGE_MAX_PIXELS) {
        setError(copy.tooLarge);
        return;
      }
      setPending({
        file,
        previewUrl: URL.createObjectURL(file),
        lowResolution: size
          ? Math.max(size.width, size.height) < ITEM_IMAGE_LOW_RESOLUTION_EDGE_PX
          : false,
      });
    },
    [copy],
  );

  return {
    pending,
    error,
    setError,
    choose,
    clear: useCallback(() => {
      setPending(null);
      setError(null);
    }, []),
    /** Props for `ImageUploadTile`'s screening. */
    tileScreening: {
      accept: ITEM_IMAGE_MIME_TYPES,
      maxSizeBytes: ITEM_IMAGE_MAX_BYTES,
      formatBytes: (bytes: number) => formatBytes(bytes, lang),
      labels: { wrongType: copy.typeNotAllowed, tooLarge: copy.tooLarge },
      onReject: (messages: string[]) => setError(messages[0] ?? null),
    },
  };
}

async function decodedSize(file: File): Promise<DecodedSize> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return "UNREADABLE";
  }
}
