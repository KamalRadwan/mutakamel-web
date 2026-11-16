import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";

// `BRANDING_ASSET_LIMITS` and `BRANDING_ASSET_MIME_TYPES` in Core:
// ../backend/mutakamel-apps/core-app/src/tenant/branding/branding-asset.constants.ts
export type BrandingAssetKind = "logo" | "icon";

interface BrandingAssetLimit {
  maxBytes: number;
  maxDimension: number;
}

const BYTES_PER_KIBIBYTE = 1024;
const BYTES_PER_MEBIBYTE = 1024 * 1024;

const BRANDING_ASSET_LIMITS: Record<BrandingAssetKind, BrandingAssetLimit> = {
  logo: {
    maxBytes: 2 * BYTES_PER_MEBIBYTE,
    maxDimension: 4096,
  },
  icon: {
    maxBytes: 512 * BYTES_PER_KIBIBYTE,
    maxDimension: 1024,
  },
};

export const BRANDING_ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type BrandingAssetRejectionReason =
  | "empty"
  | "unsupported-type"
  | "too-large"
  | "invalid-image"
  | "dimensions-exceeded";

export type BrandingAssetInspection =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: BrandingAssetRejectionReason };

type DecodedDimensions = { width: number; height: number } | "UNREADABLE";

export function formatBrandingAssetSize(
  bytes: number,
  t: Dictionary,
  lang: Language,
): string {
  if (bytes >= BYTES_PER_MEBIBYTE) {
    const megabytes = Math.round((bytes / BYTES_PER_MEBIBYTE) * 10) / 10;
    return `${formatNumber(megabytes, lang, { maximumFractionDigits: 1 })} ${t.coreBilling.megabytes}`;
  }
  const kilobytes = Math.max(1, Math.round(bytes / BYTES_PER_KIBIBYTE));
  return `${formatNumber(kilobytes, lang, { maximumFractionDigits: 0 })} ${t.coreSettings.brandingUi.kilobytes}`;
}

export function formatBrandingAssetLimits(
  kind: BrandingAssetKind,
  t: Dictionary,
  lang: Language,
): string {
  const limits = BRANDING_ASSET_LIMITS[kind];
  const dimension = formatNumber(limits.maxDimension, lang, { maximumFractionDigits: 0 });
  return t.coreSettings.brandingUi.assetLimits
    .replace("{maxSize}", formatBrandingAssetSize(limits.maxBytes, t, lang))
    .replaceAll("{maxDimension}", dimension);
}

export function formatBrandingTooLargeError(
  kind: BrandingAssetKind,
  t: Dictionary,
  lang: Language,
): string {
  const maxSize = formatBrandingAssetSize(BRANDING_ASSET_LIMITS[kind].maxBytes, t, lang);
  const template =
    kind === "logo"
      ? t.coreSettings.brandingUi.logoTooLarge
      : t.coreSettings.brandingUi.iconTooLarge;
  return template.replace("{maxSize}", maxSize);
}

async function decodeBrandingImageDimensions(file: File): Promise<DecodedDimensions> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return "UNREADABLE";
      }
      return { width, height };
    } catch {
      return "UNREADABLE";
    } finally {
      bitmap?.close();
    }
  }

  if (
    typeof Image === "function" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await new Promise<DecodedDimensions>((resolve) => {
        const image = new Image();
        image.onload = () => {
          const width = image.naturalWidth;
          const height = image.naturalHeight;
          resolve(
            Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
              ? { width, height }
              : "UNREADABLE",
          );
        };
        image.onerror = () => resolve("UNREADABLE");
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return "UNREADABLE";
}

export async function inspectBrandingAssetFile(
  kind: BrandingAssetKind,
  file: File,
): Promise<BrandingAssetInspection> {
  if (!file || file.size <= 0) {
    return { ok: false, reason: "empty" };
  }
  const mimeType = file.type.trim().toLowerCase();
  if (!(BRANDING_ASSET_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { ok: false, reason: "unsupported-type" };
  }
  const limits = BRANDING_ASSET_LIMITS[kind];
  if (file.size > limits.maxBytes) {
    return { ok: false, reason: "too-large" };
  }
  const decoded = await decodeBrandingImageDimensions(file);
  if (decoded === "UNREADABLE") {
    return { ok: false, reason: "invalid-image" };
  }
  if (decoded.width > limits.maxDimension || decoded.height > limits.maxDimension) {
    return { ok: false, reason: "dimensions-exceeded" };
  }
  return {
    ok: true,
    width: decoded.width,
    height: decoded.height,
  };
}

export function describeBrandingAssetRejection(
  kind: BrandingAssetKind,
  reason: BrandingAssetRejectionReason,
  t: Dictionary,
  lang: Language,
): string {
  switch (reason) {
    case "empty":
      return t.coreBilling.brandingFileRequired;
    case "unsupported-type":
      return t.coreBilling.brandingFileTypeUnsupported;
    case "too-large":
      return formatBrandingTooLargeError(kind, t, lang);
    case "invalid-image":
      return t.coreSettings.brandingUi.fileInvalid;
    case "dimensions-exceeded": {
      const dimension = formatNumber(BRANDING_ASSET_LIMITS[kind].maxDimension, lang, {
        maximumFractionDigits: 0,
      });
      return t.coreSettings.brandingUi.dimensionsExceeded.replaceAll("{maxDimension}", dimension);
    }
  }
}
