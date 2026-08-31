import type { CorePath } from "@/lib/api/envelope";
import { coreDelete, coreGet, corePost } from "../core-api";
import {
  invalidCoreResponse,
  nullableUuidV7,
  record,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import {
  TEMPLATE_PAGE_LIMIT,
  parseTemplateCursorPage,
  type TemplateCursorPage,
} from "./templates-contract";

// Template assets. The upload multipart is **exactly two parts** — a `metadata`
// JSON part (≤16 384 bytes) and a `file` part (≤5 MiB, PNG or JPEG). The
// interceptor caps `files: 1, fields: 1, parts: 2`, so a third part is rejected
// outright.
//
// Source: core-app/src/tenant/template-platform/template-platform.controller.ts
// (`createAsset`, `parseAssetMetadata`) and dto `CreateTemplateAssetMetadataDto`.

const TEMPLATE_ASSETS_PATH = "/api/tenant/core/v1/templates/assets";

export const ASSET_TYPES = ["IMAGE", "LOGO", "BACKGROUND"] as const;
export const ASSET_DELIVERY_CLASSES = ["PRIVATE_ONLY", "EMAIL_PUBLIC"] as const;
type AssetStatus = "ACTIVE" | "RETIRED";
type AssetScope = "ALL_AUTHORIZED" | "REUSABLE" | "DEFINITION";
/** A combined token — the shared `sortBy`/`sortDir` convention does not apply. */
export type AssetSort = "createdAt:desc" | "createdAt:asc" | "fileName:asc" | "fileName:desc";
export const ASSET_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetDeliveryClass = (typeof ASSET_DELIVERY_CLASSES)[number];

export const ASSET_FILE_MAX_BYTES = 5 * 1024 * 1024;
/** The `metadata` part is capped at 16 384 UTF-8 bytes by the controller. */
const ASSET_FILE_NAME_MAX = 255;

export const ASSET_UPLOAD_INVALID_CODE = "CORE.TEMPLATE.ASSET.UPLOAD_INVALID";
export const ASSET_EMAIL_PUBLIC_CODE = "CORE.TEMPLATE.ASSET.EMAIL_PUBLIC_NOT_ALLOWED";
export const ASSET_CHECKSUM_MISMATCH_CODE = "CORE.TEMPLATE.ASSET.CHECKSUM_MISMATCH";
export const ASSET_IN_USE_CODE = "CORE.TEMPLATE.ASSET.IN_USE";

export interface TemplateAsset {
  id: string;
  definitionId: string | null;
  assetType: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  deliveryClass: string;
  status: string;
  revision: number;
  /** `"asset:<id>:<revision>"` — the namespaced `If-Match` this route expects. */
  etag: string;
  createdAt: string;
}

export function parseTemplateAsset(payload: unknown): TemplateAsset {
  const row = record(payload);
  if (!row) invalidCoreResponse();
  const revision = row.revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 1) invalidCoreResponse();
  const size = row.sizeBytes;
  return {
    id: requiredUuidV7(row, "assetId"),
    definitionId: nullableUuidV7(row, "definitionId"),
    assetType: requiredText(row, "assetType", 24),
    originalFileName: requiredText(row, "originalFileName", ASSET_FILE_NAME_MAX),
    mimeType: requiredText(row, "mimeType", 64),
    sizeBytes: Number.isSafeInteger(size) ? (size as number) : 0,
    deliveryClass: requiredText(row, "deliveryClass", 24),
    status: requiredText(row, "status", 16),
    revision: revision as number,
    etag: requiredText(row, "etag", 128),
    createdAt: requiredTimestamp(row, "createdAt"),
  };
}

/** `GET /assets/:assetId` wraps the row in `{ asset, delivery }`. */
function parseAssetEnvelope(payload: unknown): TemplateAsset {
  const body = record(payload);
  if (!body) invalidCoreResponse();
  return parseTemplateAsset(body.asset ?? body);
}

export interface AssetListRequest {
  scope?: AssetScope;
  definitionId?: string;
  assetType?: AssetType;
  deliveryClass?: AssetDeliveryClass;
  status?: AssetStatus;
  search?: string;
  sort: AssetSort;
  cursor?: string;
}

export async function fetchTemplateAssets(
  request: AssetListRequest,
  signal?: AbortSignal,
): Promise<TemplateCursorPage<TemplateAsset>> {
  const query = new URLSearchParams({
    sort: request.sort,
    limit: String(TEMPLATE_PAGE_LIMIT),
  });
  for (const key of [
    "scope",
    "definitionId",
    "assetType",
    "deliveryClass",
    "status",
    "search",
    "cursor",
  ] as const) {
    const value = request[key];
    if (value) query.set(key, value);
  }
  const result = await coreGet(`${TEMPLATE_ASSETS_PATH}?${query.toString()}` as CorePath, {
    signal,
    maxResponseBytes: 900_000,
  });
  return parseTemplateCursorPage(result.data, parseTemplateAsset);
}

export interface AssetUploadMetadata {
  definitionId: string | null;
  assetType: AssetType;
  deliveryClass: AssetDeliveryClass;
  fileName: string;
  declaredMimeType: (typeof ASSET_MIME_TYPES)[number];
  expectedRawSha256: string;
  /** Required **exactly when** the delivery class is `EMAIL_PUBLIC`. */
  confirmPublicEmailDelivery?: true;
}

/** SHA-256 of the exact bytes; the server recomputes it and refuses a mismatch. */
export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * **Exactly two parts.** A third field is rejected with
 * `CORE.TEMPLATE.ASSET.UPLOAD_INVALID`, so nothing else may be appended here —
 * not a hidden input, not a duplicate file entry.
 */
export async function uploadTemplateAsset(
  metadata: AssetUploadMetadata,
  file: File,
): Promise<TemplateAsset> {
  const body = new FormData();
  body.append("metadata", JSON.stringify(metadata));
  body.append("file", file, metadata.fileName);
  const result = await corePost(TEMPLATE_ASSETS_PATH, body, {
    maxResponseBytes: 400_000,
    nonReplayable: true,
  });
  return parseAssetEnvelope(result.data);
}

/** **204**, `If-Match` on the namespaced asset etag. Unreferenced assets only. */
export async function retireTemplateAsset(assetId: string, etag: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/iu.test(assetId)) invalidCoreResponse();
  const path =
    `/api/tenant/core/v1/templates/assets/${encodeURIComponent(assetId)}` as CorePath;
  await coreDelete(path, { headers: { "If-Match": etag }, maxResponseBytes: 20_000 });
}

/** Re-authorised, checksum-verified bytes, streamed same-origin. */
export function assetContentHref(assetId: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(assetId)) invalidCoreResponse();
  return `/api/tenant/core/v1/templates/assets/${encodeURIComponent(assetId)}/content`;
}
