import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';

export interface Branding {
  id: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  appName: string | null;
  tabTitle: string | null;
  loginHtml: string | null;
  hasLogo: boolean;
  hasIcon: boolean;
  logoUrl: string | null;
  iconUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateBrandingBody {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  appName?: string | null;
  tabTitle?: string | null;
  fontFamily?: string | null;
  loginHtml?: string | null;
}

export type BrandingAssetKind = 'logo' | 'icon';

export interface BrandingIdentityErrors {
  appName: string | null;
  tabTitle: string | null;
}

export interface BrandingColoursErrors {
  primary: string | null;
  secondary: string | null;
}

export interface BrandingPreviewValues {
  appName: string;
  tabTitle: string;
  primary: string;
  secondary: string;
  logoUrl: string | null;
  iconUrl: string | null;
}

export const EMPTY_BRANDING: Branding = {
  id: null,
  primaryColor: null,
  secondaryColor: null,
  fontFamily: null,
  appName: null,
  tabTitle: null,
  loginHtml: null,
  hasLogo: false,
  hasIcon: false,
  logoUrl: null,
  iconUrl: null,
  createdAt: null,
  updatedAt: null,
};

export const BRANDING_TEXT_MAX = 120;
export const BRANDING_COLOUR_MAX = 9;
export const BRANDING_HEX_PATTERN = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const BRANDING_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];
export const BRANDING_ASSET_LIMITS = {
  logo: { maxBytes: 2 * 1024 * 1024, maxEdge: 4096 },
  icon: { maxBytes: 512 * 1024, maxEdge: 1024 },
} as const;

const KNOWN_ERROR_CODES = new Set([
  'BRANDING_FILE_REQUIRED',
  'BRANDING_FILE_INVALID',
  'BRANDING_FILE_TYPE_UNSUPPORTED',
  'BRANDING_FILE_TOO_LARGE',
  'BRANDING_IDEMPOTENCY_CONFLICT',
  'BRANDING_ASSET_NOT_FOUND',
  'BRANDING_STATE_UNAVAILABLE',
  'BRANDING_STORAGE_UNAVAILABLE',
  'INVALID_IDEMPOTENCY_KEY',
  'TENANT_WIDE_PERMISSION_REQUIRED',
  'MISSING_REQUIRED_PERMISSIONS',
  'CORE_VALIDATION_FAILED',
  'network',
  'generic',
]);

export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width <= 0 || bitmap.height <= 0) {
        throw new Error('Invalid image dimensions');
      }
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      if (width <= 0 || height <= 0) {
        reject(new Error('Invalid image dimensions'));
        return;
      }
      resolve({ width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };

    img.src = objectUrl;
  });
}

export function brandingErrorKey(
  error: unknown,
  t: SettingsTranslator,
  operation: 'read' | 'write' = 'write',
): string {
  const translate = typeof t === 'function' ? t : (key: string) => t.translate(key);
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return translate('wsBranding.notSaved');
  }
  if (error instanceof ApiError && KNOWN_ERROR_CODES.has(error.code)) {
    const key = `wsBranding.errors.${error.code}`;
    const message = translate(key);
    if (message && message !== key) return message;
  }
  return errorMessage(error, 'wsBranding', t);
}

export function brandingAccess(me: TenantMe | null | undefined): {
  readable: boolean;
  editable: boolean;
} {
  return {
    readable: me?.permissions.includes('branding.read') ?? false,
    editable: hasTenantWidePermission(me, 'branding.manage'),
  };
}

export function normaliseHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !BRANDING_HEX_PATTERN.test(trimmed)) {
    return null;
  }
  return `#${trimmed.replace(/^#/, '').toLowerCase()}`;
}
