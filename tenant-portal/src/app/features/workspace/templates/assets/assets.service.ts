import { TranslocoService } from '@jsverse/transloco';
import { Language } from '../../../../core/i18n/language';
import { TemplateApiError, TemplateAssetType } from '../templates.api';

export const ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const ASSET_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

export function formatStoredMime(mimeType: string): 'PNG' | 'JPEG' {
  const lower = mimeType.toLowerCase();
  return lower.includes('jpeg') || lower.includes('jpg') ? 'JPEG' : 'PNG';
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function formatAssetDate(iso: string, lang: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function assetTypeTile(type: TemplateAssetType): string {
  switch (type) {
    case 'LOGO':
      return 'bg-icon-teal';
    case 'IMAGE':
      return 'bg-icon-violet';
    case 'BACKGROUND':
      return 'bg-icon-blue';
  }
}

export function extractErrorCode(error: unknown): string | null {
  if (error instanceof TemplateApiError) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return null;
}

export function translateAssetError(error: unknown, transloco: TranslocoService): string {
  const code = extractErrorCode(error);
  if (code) {
    const assetKey = `templatesAssets.errors.${code}`;
    const assetMsg = transloco.translate(assetKey);
    if (assetMsg !== assetKey) return assetMsg;

    const sharedKey = `templates.errors.${code}`;
    const sharedMsg = transloco.translate(sharedKey);
    if (sharedMsg !== sharedKey) return sharedMsg;
  }
  return transloco.translate('templates.errors.generic');
}

export async function computeFileSha256(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new TemplateApiError(0, 'CORE.TEMPLATE.ASSET.UPLOAD_INVALID');
  }
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
