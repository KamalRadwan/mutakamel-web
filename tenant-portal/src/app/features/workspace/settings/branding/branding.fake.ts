import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import {
  BRANDING_ASSET_LIMITS,
  BRANDING_MIME_TYPES,
  BRANDING_MULTIPART_MAX_BYTES,
  BRANDING_TEXT_MAX,
  Branding,
  BrandingAssetKind,
  EMPTY_BRANDING,
  UpdateBrandingBody,
  readImageSize,
} from './branding.model';

export let FAKE_BRANDING_SEED: 'customised' | 'empty' = 'customised';
export const FAKE_BRANDING_FAIL_NEXT: { code: string | null; status: number } = { code: null, status: 500 };

const SERVER_HEX_PATTERN = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const UUIDV7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOGIN_HTML_MAX = 20_000;

interface BrandingFakeStore {
  branding: Branding;
  uploadKeys: Map<string, string>;
}

let store: BrandingFakeStore | null = null;

function createSeedBranding(): Branding {
  if (FAKE_BRANDING_SEED === 'empty') {
    return { ...EMPTY_BRANDING };
  }
  return {
    id: fakeId(),
    primaryColor: '#2563eb',
    secondaryColor: null,
    fontFamily: 'Inter, sans-serif',
    appName: 'Delta Trading',
    tabTitle: 'Delta | Portal',
    loginHtml: '<p>Welcome</p>',
    hasLogo: false,
    hasIcon: false,
    logoUrl: null,
    iconUrl: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

function ensureStore(): BrandingFakeStore {
  if (!store) {
    store = {
      branding: createSeedBranding(),
      uploadKeys: new Map<string, string>(),
    };
  }
  return store;
}

function cloneBranding(record: Branding): Branding {
  return { ...record };
}

function consumeFailNext(): { code: string; status: number } | null {
  if (!FAKE_BRANDING_FAIL_NEXT.code) {
    return null;
  }
  const code = FAKE_BRANDING_FAIL_NEXT.code;
  const status = FAKE_BRANDING_FAIL_NEXT.status;
  FAKE_BRANDING_FAIL_NEXT.code = null;
  return { code, status };
}

async function sha256Hex(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic digest when SubtleCrypto is unavailable in non-secure test contexts.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const byte of bytes) {
    h1 ^= byte;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ byte, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function fakeGetBranding(): Promise<Branding> {
  await fakeDelay();
  const failure = consumeFailNext();
  if (failure) {
    throw new ApiError(failure.status, failure.code);
  }
  return cloneBranding(ensureStore().branding);
}

export async function fakeUpdateBranding(body: UpdateBrandingBody, idempotencyKey: string): Promise<Branding> {
  await fakeDelay();
  const failure = consumeFailNext();
  if (failure) {
    throw new ApiError(failure.status, failure.code);
  }

  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY');
  }

  if (body.primaryColor !== undefined && body.primaryColor !== null && !SERVER_HEX_PATTERN.test(body.primaryColor)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { primaryColor: ['primaryColor must be a hexadecimal color'] });
  }
  if (body.secondaryColor !== undefined && body.secondaryColor !== null && !SERVER_HEX_PATTERN.test(body.secondaryColor)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { secondaryColor: ['secondaryColor must be a hexadecimal color'] });
  }
  if (body.appName !== undefined && body.appName !== null && body.appName.length > BRANDING_TEXT_MAX) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { appName: [`appName must be shorter than or equal to ${BRANDING_TEXT_MAX} characters`] });
  }
  if (body.tabTitle !== undefined && body.tabTitle !== null && body.tabTitle.length > BRANDING_TEXT_MAX) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { tabTitle: [`tabTitle must be shorter than or equal to ${BRANDING_TEXT_MAX} characters`] });
  }
  if (body.fontFamily !== undefined && body.fontFamily !== null && body.fontFamily.length > BRANDING_TEXT_MAX) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { fontFamily: [`fontFamily must be shorter than or equal to ${BRANDING_TEXT_MAX} characters`] });
  }
  if (body.loginHtml !== undefined && body.loginHtml !== null && body.loginHtml.length > LOGIN_HTML_MAX) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { loginHtml: [`loginHtml must be shorter than or equal to ${LOGIN_HTML_MAX} characters`] });
  }

  const current = ensureStore().branding;
  const now = new Date().toISOString();

  if (current.id === null) {
    current.id = fakeId();
    current.createdAt = now;
  }

  if (body.primaryColor !== undefined) {
    current.primaryColor = body.primaryColor;
  }
  if (body.secondaryColor !== undefined) {
    current.secondaryColor = body.secondaryColor;
  }
  if (body.appName !== undefined) {
    current.appName = body.appName;
  }
  if (body.tabTitle !== undefined) {
    current.tabTitle = body.tabTitle;
  }
  if (body.fontFamily !== undefined) {
    current.fontFamily = body.fontFamily;
  }
  if (body.loginHtml !== undefined) {
    current.loginHtml = body.loginHtml;
  }

  current.updatedAt = now;
  return cloneBranding(current);
}

export async function fakeUploadBrandingAsset(
  kind: BrandingAssetKind,
  form: FormData,
  idempotencyKey: string,
): Promise<Branding> {
  await fakeDelay();

  if (FAKE_BRANDING_FAIL_NEXT.code && FAKE_BRANDING_FAIL_NEXT.code !== 'BRANDING_STORAGE_UNAVAILABLE') {
    const failure = consumeFailNext();
    if (failure) {
      throw new ApiError(failure.status, failure.code);
    }
  }

  const part = form.get('file');
  if (!(part instanceof File)) {
    throw new ApiError(400, 'BRANDING_FILE_REQUIRED');
  }
  const file = part;

  const trimmedKey = idempotencyKey.trim();
  if (!UUIDV7_PATTERN.test(trimmedKey)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY');
  }

  if (!BRANDING_MIME_TYPES.includes(file.type)) {
    throw new ApiError(415, 'BRANDING_FILE_TYPE_UNSUPPORTED');
  }

  if (file.size > BRANDING_MULTIPART_MAX_BYTES) {
    throw new ApiError(413, 'BRANDING_FILE_TOO_LARGE');
  }

  if (FAKE_BRANDING_FAIL_NEXT.code === 'BRANDING_STORAGE_UNAVAILABLE') {
    const status = FAKE_BRANDING_FAIL_NEXT.status === 500 ? 503 : FAKE_BRANDING_FAIL_NEXT.status || 503;
    FAKE_BRANDING_FAIL_NEXT.code = null;
    throw new ApiError(status, 'BRANDING_STORAGE_UNAVAILABLE');
  }

  const limits = BRANDING_ASSET_LIMITS[kind];
  if (file.size > limits.maxBytes) {
    throw new ApiError(413, 'BRANDING_FILE_TOO_LARGE');
  }

  const state = ensureStore();
  const digest = await sha256Hex(file);
  const fingerprint = `${kind}:${file.type}:${file.size}:${digest}`;
  const existingFingerprint = state.uploadKeys.get(trimmedKey);
  if (existingFingerprint !== undefined) {
    if (existingFingerprint === fingerprint) {
      return cloneBranding(state.branding);
    }
    // IdempotencyInterceptor: the same key with a different request.
    throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
  }

  if (file.size === 0) {
    throw new ApiError(400, 'BRANDING_FILE_INVALID');
  }

  try {
    const { width, height } = await readImageSize(file);
    if (width > limits.maxEdge || height > limits.maxEdge) {
      throw new ApiError(400, 'BRANDING_FILE_INVALID');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, 'BRANDING_FILE_INVALID');
  }

  const previousUrl = kind === 'logo' ? state.branding.logoUrl : state.branding.iconUrl;
  if (previousUrl && previousUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previousUrl);
  }

  const nextUrl = URL.createObjectURL(file);
  const now = new Date().toISOString();
  if (state.branding.id === null) {
    state.branding.id = fakeId();
    state.branding.createdAt = now;
  }

  if (kind === 'logo') {
    state.branding.logoUrl = nextUrl;
    state.branding.hasLogo = true;
  } else {
    state.branding.iconUrl = nextUrl;
    state.branding.hasIcon = true;
  }
  state.branding.updatedAt = now;
  state.uploadKeys.set(trimmedKey, fingerprint);

  return cloneBranding(state.branding);
}
