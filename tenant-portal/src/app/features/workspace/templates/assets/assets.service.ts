import { TranslocoService } from '@jsverse/transloco';
import { Language } from '../../../../core/i18n/language';
import { ApiError, errorMessage, writeErrorMessage } from '../../../../core/api/api-errors';
import type { TemplateAssetType, TemplateDefinitionScope } from '../templates.model';
import type { TenantScopeState } from '../../../../core/scope/tenant-scope';

export const ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const ASSET_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg';

export function canManageAssetScope(scope: TenantScopeState, definition: TemplateDefinitionScope | null): boolean {
  const me = scope.me();
  if (me?.isTenantOwner) return true;
  const key = 'templates.assets.manage';
  if (!me?.permissions.includes(key)) return false;
  const grants = me.permissionScopes[key];
  if (grants?.tenantWide) return true;
  if (definition?.type !== 'COMPANY') return false;
  return !!grants?.companyIds.includes(definition.companyId) ||
    !!grants?.branchIds.some((id) => scope.branchCompanies().get(id) === definition.companyId);
}

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

export function translateAssetError(error: unknown, transloco: TranslocoService, write = false): string {
  return (write ? writeErrorMessage : errorMessage)(error, 'templatesAssets', transloco);
}

export function prepareAssetFile(file: File): File {
  const name = file.name.trim().normalize('NFC');
  if (!name || [...name].length > 255 || /[\\/\0\r\n]/.test(name) || name === '.' || name === '..') {
    throw new ApiError(422, 'ASSET_FILE_NAME_INVALID');
  }
  const mime = file.type.toLowerCase() || (/\.png$/i.test(name) ? 'image/png'
    : /\.jpe?g$/i.test(name) ? 'image/jpeg' : '');
  if (mime !== 'image/png' && mime !== 'image/jpeg') throw new ApiError(422, 'ASSET_FILE_TYPE_INVALID');
  if (!file.size || file.size > ASSET_MAX_BYTES) throw new ApiError(413, 'ASSET_FILE_TOO_LARGE');
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}

export async function computeFileSha256(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new ApiError(0, 'CORE.TEMPLATE.ASSET.UPLOAD_INVALID');
  }
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
