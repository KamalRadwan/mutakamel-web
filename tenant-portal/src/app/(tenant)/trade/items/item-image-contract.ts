import type { TradePath } from "@/lib/api/envelope";
import { isNonEmptyString, isRowVersion, isTimestamp, isUuidV7, record } from "../trade-validation";

// docs/api/trade-foundation.md#item-image--3-routes, verified against
// trade-app/src/modules/catalog/item-image.controller.ts, dto/item-image.dto.ts,
// item-image-summary.ts and item-image.processor.ts (LLD 02b §5, §12).

const ITEMS_PATH = "/api/tenant/trade/v1/items";

/** `TRADE_ITEM_IMAGE_SOURCE_MIME_TYPES` (trade-app-common `item-image-policy.ts`). */
export const ITEM_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** `TRADE_ITEM_IMAGE_LIMITS.MAX_SOURCE_BYTES` (10 MiB), also the multer `fileSize`. */
export const ITEM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** `TRADE_ITEM_IMAGE_LIMITS.MAX_SOURCE_PIXELS`, sharp's `limitInputPixels`. */
export const ITEM_IMAGE_MAX_PIXELS = 25_000_000;
/** `TRADE_ITEM_IMAGE_LIMITS.MIN_SOURCE_EDGE_PX`, both edges. */
export const ITEM_IMAGE_MIN_EDGE_PX = 32;
/** LLD 02b §19 create flow step 2: a shorter longest edge may print blurry. */
export const ITEM_IMAGE_LOW_RESOLUTION_EDGE_PX = 300;

/** `TRADE_ITEM_IMAGE_ERROR_CODES` in `@mutakamel/trade-app-common@0.0.6`. */
export const ITEM_IMAGE_ERROR_CODES = {
  required: "TRADE.CATALOG.ITEM_IMAGE_REQUIRED",
  invalid: "TRADE.CATALOG.ITEM_IMAGE_INVALID",
  tooLarge: "TRADE.CATALOG.ITEM_IMAGE_TOO_LARGE",
  notFound: "TRADE.CATALOG.ITEM_IMAGE_NOT_FOUND",
  storageUnavailable: "TRADE.CATALOG.ITEM_IMAGE_STORAGE_UNAVAILABLE",
  printBudgetExceeded: "TRADE.CATALOG.ITEM_IMAGE_PRINT_BUDGET_EXCEEDED",
} as const;

/**
 * `ITEM_IMAGE_INVALID` `details.reason`, sent as a one-item string array.
 * `TOO_DETAILED` is defined in `item-image.processor.ts` until the next
 * trade-app-common release adds it to `TRADE_ITEM_IMAGE_INVALID_REASONS`.
 */
export type ItemImageInvalidReason =
  | "TYPE_NOT_ALLOWED"
  | "EXTENSION_MISMATCH"
  | "CONTENT_MISMATCH"
  | "DECODE_FAILED"
  | "ANIMATED_OR_MULTIPAGE"
  | "TOO_SMALL"
  | "TOO_DETAILED";

type ItemImageRendition = "thumb" | "print";

/** `ItemImageSummaryDto`: the Item's current image on detail, list and search. */
export interface ItemImageSummary {
  id: string;
  sequence: number;
  thumb: { mimeType: string; widthPx: number; heightPx: number; sha256: string };
  print: { mimeType: string; widthPx: number; heightPx: number };
  hasAlpha: boolean;
  createdAt: string;
}

/** The pointer change a `PUT` or `DELETE` receipt reports. */
export interface ItemImageChange {
  itemId: string;
  /** The Item version after the change: the next `If-Match`. */
  itemVersion: number;
  image: ItemImageSummary | null;
}

/** What an image upload needs from a just-created Item. */
export interface CreatedItemRef {
  id: string;
  version: number;
}

export function itemImagePath(itemId: string): TradePath {
  if (!isUuidV7(itemId)) invalidResponse();
  return `${ITEMS_PATH}/${encodeURIComponent(itemId)}/image` as TradePath;
}

/**
 * The rendition URL. No URL is ever returned by Trade (the Gateway prefix
 * differs from the application path), so it is built from the Item and image
 * IDs. It names one immutable object, so a replaced image gets a new URL and a
 * stale thumbnail cannot appear.
 */
export function itemImageRenditionSrc(
  itemId: string,
  imageId: string,
  rendition: ItemImageRendition,
): string {
  if (!isUuidV7(itemId) || !isUuidV7(imageId)) invalidResponse();
  return `${ITEMS_PATH}/${encodeURIComponent(itemId)}/images/${encodeURIComponent(imageId)}/${rendition}`;
}

function isPixelEdge(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseRendition(value: unknown) {
  const rendition = record(value);
  if (
    !rendition ||
    !isNonEmptyString(rendition.mimeType, 64) ||
    !isPixelEdge(rendition.widthPx) ||
    !isPixelEdge(rendition.heightPx)
  ) {
    invalidResponse();
  }
  return { mimeType: rendition.mimeType, widthPx: rendition.widthPx, heightPx: rendition.heightPx };
}

/** `image` on Item reads. Absent (create and update receipts) reads as no image. */
export function parseItemImageSummary(value: unknown): ItemImageSummary | null {
  if (value === undefined || value === null) return null;
  const image = record(value);
  const thumb = record(image?.thumb);
  if (
    !image ||
    !thumb ||
    !isUuidV7(image.id) ||
    !isPixelEdge(image.sequence) ||
    typeof image.hasAlpha !== "boolean" ||
    !isTimestamp(image.createdAt) ||
    typeof thumb.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(thumb.sha256)
  ) {
    invalidResponse();
  }
  return {
    id: image.id,
    sequence: image.sequence,
    thumb: { ...parseRendition(thumb), sha256: thumb.sha256 },
    print: parseRendition(image.print),
    hasAlpha: image.hasAlpha,
    createdAt: image.createdAt,
  };
}

/** `ItemImageReceiptDto` from `PUT /items/:id/image`. */
export function parseItemImageReceipt(payload: unknown): ItemImageChange {
  const receipt = record(payload);
  if (!receipt || !isUuidV7(receipt.itemId) || !isRowVersion(receipt.itemVersion)) {
    invalidResponse();
  }
  const image = parseItemImageSummary(receipt.image);
  if (!image) invalidResponse();
  return { itemId: receipt.itemId, itemVersion: receipt.itemVersion, image };
}

/** `ItemImageRemovalReceiptDto` from `DELETE /items/:id/image`; `removed: false` is a no-op. */
export function parseItemImageRemovalReceipt(payload: unknown): ItemImageChange {
  const receipt = record(payload);
  if (
    !receipt ||
    !isUuidV7(receipt.itemId) ||
    !isRowVersion(receipt.itemVersion) ||
    typeof receipt.removed !== "boolean"
  ) {
    invalidResponse();
  }
  return { itemId: receipt.itemId, itemVersion: receipt.itemVersion, image: null };
}

/** The `id` and `version` of `POST /items`, the target of the image upload that follows. */
export function parseCreatedItemRef(payload: unknown): CreatedItemRef {
  const item = record(payload);
  if (!item || !isUuidV7(item.id) || !isRowVersion(item.version)) invalidResponse();
  return { id: item.id, version: item.version };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade item image response.");
}
