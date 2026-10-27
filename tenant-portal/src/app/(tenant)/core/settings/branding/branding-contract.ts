import { readCoreData } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  BRANDING_TEXT_MAX_LENGTH,
  PUBLIC_BRANDING_ICON_PATH,
  PUBLIC_BRANDING_LOGO_PATH,
} from "@/lib/branding/public-branding";
import { corePost, corePut } from "../../core-api";
import { CORE_DETAIL_RESPONSE_LIMIT_BYTES, record } from "../../contracts/core-page";

// `BrandingController`
// (../backend/mutakamel-apps/core-app/src/tenant/branding/branding.controller.ts).
// The authenticated half is permission-gated — `branding.read` to look,
// `branding.manage` to write — unlike billing and subscription, which are
// owner-only with no permission at all.

const BRANDING_PATH = "/api/tenant/core/v1/branding" as const;
const BRANDING_LOGO_PATH = "/api/tenant/core/v1/branding/logo" as const;
const BRANDING_ICON_PATH = "/api/tenant/core/v1/branding/icon" as const;

export const BRANDING_READ_PERMISSION = "branding.read";
export const BRANDING_MANAGE_PERMISSION = "branding.manage";

/** `BRANDING_ASSET_MAX_BYTES` and `BRANDING_ASSET_MIME_TYPES` in the controller. */
export const BRANDING_ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const BRANDING_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Three separate outcomes, three separate messages — never one "upload failed". */
export const BRANDING_FILE_REQUIRED_CODE = "BRANDING_FILE_REQUIRED";
export const BRANDING_FILE_TYPE_UNSUPPORTED_CODE = "BRANDING_FILE_TYPE_UNSUPPORTED";
export const BRANDING_FILE_TOO_LARGE_CODE = "BRANDING_FILE_TOO_LARGE";
export const BRANDING_STORAGE_UNAVAILABLE_CODE = "BRANDING_STORAGE_UNAVAILABLE";

export type BrandingAssetKind = "logo" | "icon";

const BRANDING_ASSET_UPLOAD_PATH: Record<BrandingAssetKind, typeof BRANDING_LOGO_PATH | typeof BRANDING_ICON_PATH> = {
  logo: BRANDING_LOGO_PATH,
  icon: BRANDING_ICON_PATH,
};

export const BRANDING_ASSET_PUBLIC_PATH: Record<BrandingAssetKind, string> = {
  logo: PUBLIC_BRANDING_LOGO_PATH,
  icon: PUBLIC_BRANDING_ICON_PATH,
};

export interface BrandingSettings {
  appName: string | null;
  tabTitle: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  /**
   * Presence only. The storage keys themselves never leave the server — the
   * bytes stream through the two public binary routes.
   */
  hasLogo: boolean;
  hasIcon: boolean;
}

export const EMPTY_BRANDING: BrandingSettings = {
  appName: null,
  tabTitle: null,
  primaryColor: null,
  secondaryColor: null,
  fontFamily: null,
  hasLogo: false,
  hasIcon: false,
};

function invalidBrandingResponse(): never {
  throw new Error("Invalid Core branding response.");
}

function nullableText(source: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) invalidBrandingResponse();
  return value;
}

/** `BrandingService.get()` answers `{}` when the tenant has never customized branding. */
function parseBrandingSettings(payload: unknown): BrandingSettings {
  const branding = record(payload);
  if (!branding) invalidBrandingResponse();
  return {
    appName: nullableText(branding, "appName", BRANDING_TEXT_MAX_LENGTH),
    tabTitle: nullableText(branding, "tabTitle", BRANDING_TEXT_MAX_LENGTH),
    primaryColor: nullableText(branding, "primaryColor", 9),
    secondaryColor: nullableText(branding, "secondaryColor", 9),
    fontFamily: nullableText(branding, "fontFamily", BRANDING_TEXT_MAX_LENGTH),
    hasLogo: nullableText(branding, "logoStorageKey", 512) !== null,
    hasIcon: nullableText(branding, "iconStorageKey", 512) !== null,
  };
}

export interface BrandingFormValues {
  appName: string;
  tabTitle: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

export function toBrandingForm(branding: BrandingSettings): BrandingFormValues {
  return {
    appName: branding.appName ?? "",
    tabTitle: branding.tabTitle ?? "",
    primaryColor: branding.primaryColor ?? "",
    secondaryColor: branding.secondaryColor ?? "",
    fontFamily: branding.fontFamily ?? "",
  };
}

/** `@IsHexColor()` accepts 3, 4, 6 and 8 hex digits behind a `#`. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const BRANDING_FORM_COLOR_ERROR = "BRANDING_FORM_COLOR";
export const BRANDING_FORM_TEXT_ERROR = "BRANDING_FORM_TEXT";

export function validateBrandingForm(values: BrandingFormValues) {
  const errors: Partial<Record<keyof BrandingFormValues, string>> = {};
  for (const field of ["appName", "tabTitle", "fontFamily"] as const) {
    if (values[field].length > BRANDING_TEXT_MAX_LENGTH) errors[field] = BRANDING_FORM_TEXT_ERROR;
  }
  for (const field of ["primaryColor", "secondaryColor"] as const) {
    const color = values[field].trim();
    if (color && !HEX_COLOR.test(color)) errors[field] = BRANDING_FORM_COLOR_ERROR;
  }
  return errors;
}

export interface UpdateBrandingRequest {
  appName?: string | null;
  tabTitle?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
}

/**
 * Builds the `UpdateBrandingDto` patch.
 *
 * `loginHtml` is deliberately absent: this screen does not edit it, and Core
 * only writes keys the body actually carries, so omitting it preserves whatever
 * is stored. Sending `""` would silently erase a tenant's login page.
 */
export function buildUpdateBrandingRequest(
  values: BrandingFormValues,
  current: BrandingSettings,
): UpdateBrandingRequest {
  const error = Object.values(validateBrandingForm(values))[0];
  if (error) throw new Error(error);
  const request: UpdateBrandingRequest = {};
  for (const field of ["appName", "tabTitle", "fontFamily", "primaryColor", "secondaryColor"] as const) {
    const value = values[field].trim() || null;
    // Core preserves omitted keys and persists null as an explicit reset.
    if (value !== (current[field] || null)) request[field] = value;
  }
  return request;
}

export async function fetchBrandingSettings(signal?: AbortSignal): Promise<BrandingSettings> {
  return parseBrandingSettings(
    await readCoreData(BRANDING_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function updateBrandingSettings(
  request: UpdateBrandingRequest,
): Promise<BrandingSettings> {
  const result = await corePut(BRANDING_PATH, request, {
    maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  });
  return parseBrandingSettings(result.data);
}

/**
 * Uploads one branding asset as `multipart/form-data` with a single `file`
 * part, which is the exact shape `FileInterceptor('file')` expects.
 *
 * The route is `@IdempotencyRequired()`, so a replay returns the stored result
 * with `Idempotency-Replayed: true` — a success, not a duplicate upload.
 */
export async function uploadBrandingAsset(
  kind: BrandingAssetKind,
  file: File,
  idempotencyKey: string,
): Promise<{ branding: BrandingSettings; replayed: boolean }> {
  const body = new FormData();
  body.append("file", file, file.name);
  const result = await corePost(BRANDING_ASSET_UPLOAD_PATH[kind], body, {
    headers: { "x-idempotency-key": idempotencyKey },
    maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  });
  return {
    branding: parseBrandingSettings(result.data),
    replayed: isIdempotentReplay(result.headers),
  };
}
