import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay } from '../../../../core/fake/fake-utils';
import { CORE_VALIDATION_FAILED, coreValidationDetails } from '../core-response.model';
import {
  CURRENCY_CODE_LENGTH,
  CurrencyOption,
  TIMEZONE_MAX_LENGTH,
  TimezoneOption,
  UpdateWorkspaceSettingsRequest,
  WorkspaceLanguage,
  WorkspaceSettings,
  formatTimezoneOffset,
} from './workspace-settings.model';

export { formatTimezoneOffset } from './workspace-settings.model';

export const FAKE_WORKSPACE_FAIL_NEXT = { code: null as string | null, status: 0 };

const SINGLETON_ID = '018f0000-0000-7000-8000-000000000015';
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INITIAL_SETTINGS: WorkspaceSettings = {
  id: SINGLETON_ID,
  defaultLanguage: 'en',
  defaultCurrencyCode: 'EGP',
  timezone: 'Africa/Cairo',
  allowSupport: true,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-06-10T11:30:00.000Z',
};

const ACTIVE_CURRENCIES: readonly CurrencyOption[] = [
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£' },
];

const ACTIVE_CURRENCY_CODES = new Set(ACTIVE_CURRENCIES.map((currency) => currency.code));

const COMMON_TIMEZONES: readonly string[] = [
  'UTC',
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Amman',
  'Asia/Beirut',
  'Africa/Casablanca',
  'Africa/Tunis',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Istanbul',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

let store: WorkspaceSettings = { ...INITIAL_SETTINGS };
/** Gateway idempotency (PUT workspace-settings is WRITE_SENSITIVE): key -> request fingerprint + 2xx answer. */
const idempotencyCache = new Map<string, { fingerprint: string; result: WorkspaceSettings }>();

export function resetWorkspaceSettingsFake(): void {
  store = { ...INITIAL_SETTINGS };
  idempotencyCache.clear();
  FAKE_WORKSPACE_FAIL_NEXT.code = null;
  FAKE_WORKSPACE_FAIL_NEXT.status = 0;
}

function inferFailStatus(code: string): number {
  switch (code) {
    case 'TENANT_NOT_READY':
      return 503;
    case 'TENANT_WIDE_PERMISSION_REQUIRED':
    case 'FORBIDDEN':
    case 'PERMISSION_DENIED':
      return 403;
    case 'LANGUAGE_INVALID':
    case 'CURRENCY_NOT_ENABLED':
    case 'TIMEZONE_INVALID':
      return 422;
    case CORE_VALIDATION_FAILED:
    case 'GW.IDEM.MISSING':
    case 'GW.IDEM.BAD_VALUE':
      return 400;
    case 'GW.IDEM.IN_FLIGHT':
      return 409;
    case 'GW.IDEM.MISMATCH':
      return 422;
    case 'NETWORK':
    case 'NETWORK_ERROR':
      return 0;
    default:
      return 500;
  }
}

function consumeFailNext(): void {
  const { code, status } = FAKE_WORKSPACE_FAIL_NEXT;
  if (!code) return;
  FAKE_WORKSPACE_FAIL_NEXT.code = null;
  FAKE_WORKSPACE_FAIL_NEXT.status = 0;
  throw new ApiError(status !== 0 ? status : inferFailStatus(code), code);
}

/** Core's ValidationPipe: 400 CORE_VALIDATION_FAILED, details keyed by field (lists of messages). */
function invalidField(field: string): ApiError {
  return new ApiError(400, CORE_VALIDATION_FAILED, coreValidationDetails({ [field]: 'invalid' }));
}

function canonicalTimezone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length > TIMEZONE_MAX_LENGTH) {
    throw invalidField('timezone');
  }
  if (!trimmed || trimmed.startsWith('+') || trimmed.startsWith('-')) {
    throw new ApiError(422, 'TIMEZONE_INVALID');
  }
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    throw new ApiError(422, 'TIMEZONE_INVALID');
  }
}

export async function fakeGetWorkspaceSettings(): Promise<WorkspaceSettings> {
  await fakeDelay();
  consumeFailNext();
  return { ...store };
}

export async function fakeUpdateWorkspaceSettings(
  body: UpdateWorkspaceSettingsRequest,
  idempotencyKey: string,
): Promise<WorkspaceSettings> {
  await fakeDelay();
  consumeFailNext();

  // The gateway checks the key before Core sees the request (route core.tenant.workspace-settings.update).
  const trimmedKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!trimmedKey) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  if (!UUID_V7_RE.test(trimmedKey)) {
    throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  }

  const fingerprint = JSON.stringify(body) ?? '';
  const cached = idempotencyCache.get(trimmedKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      throw new ApiError(422, 'GW.IDEM.MISMATCH');
    }
    return { ...cached.result };
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, CORE_VALIDATION_FAILED, { _: ['request body must be an object'] });
  }

  let nextLanguage: WorkspaceLanguage = store.defaultLanguage;
  if ('defaultLanguage' in body && body.defaultLanguage !== undefined) {
    if (body.defaultLanguage === null || typeof body.defaultLanguage !== 'string') {
      throw invalidField('defaultLanguage');
    }
    const normalized = body.defaultLanguage.trim().toLowerCase();
    if (normalized !== 'en' && normalized !== 'ar') {
      throw new ApiError(422, 'LANGUAGE_INVALID');
    }
    nextLanguage = normalized;
  }

  let nextCurrency: string | null = store.defaultCurrencyCode;
  if ('defaultCurrencyCode' in body && body.defaultCurrencyCode !== undefined) {
    if (body.defaultCurrencyCode === null || typeof body.defaultCurrencyCode !== 'string') {
      throw invalidField('defaultCurrencyCode');
    }
    const normalized = body.defaultCurrencyCode.trim().toUpperCase();
    if (normalized.length !== CURRENCY_CODE_LENGTH) {
      throw invalidField('defaultCurrencyCode');
    }
    if (!ACTIVE_CURRENCY_CODES.has(normalized)) {
      throw new ApiError(422, 'CURRENCY_NOT_ENABLED');
    }
    nextCurrency = normalized;
  }

  let nextTimezone: string = store.timezone;
  if ('timezone' in body && body.timezone !== undefined) {
    if (body.timezone === null || typeof body.timezone !== 'string') {
      throw invalidField('timezone');
    }
    nextTimezone = canonicalTimezone(body.timezone);
  }

  let nextAllowSupport: boolean = store.allowSupport;
  if ('allowSupport' in body && body.allowSupport !== undefined) {
    if (body.allowSupport === null || typeof body.allowSupport !== 'boolean') {
      throw invalidField('allowSupport');
    }
    nextAllowSupport = body.allowSupport;
  }

  const changed =
    nextLanguage !== store.defaultLanguage ||
    nextCurrency !== store.defaultCurrencyCode ||
    nextTimezone !== store.timezone ||
    nextAllowSupport !== store.allowSupport;

  if (changed) {
    store = {
      ...store,
      defaultLanguage: nextLanguage,
      defaultCurrencyCode: nextCurrency,
      timezone: nextTimezone,
      allowSupport: nextAllowSupport,
      updatedAt: new Date().toISOString(),
    };
  }

  const snapshot = { ...store };
  idempotencyCache.set(trimmedKey, { fingerprint, result: snapshot });
  return { ...snapshot };
}

export async function fakeListCurrencyCatalogue(): Promise<CurrencyOption[]> {
  await fakeDelay();
  return ACTIVE_CURRENCIES.map((currency) => ({ ...currency }));
}

export async function fakeListTimezones(): Promise<TimezoneOption[]> {
  await fakeDelay();
  const now = new Date();
  let zones: readonly string[] = COMMON_TIMEZONES;

  try {
    const intlApi = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    const supported = intlApi.supportedValuesOf?.('timeZone');
    if (Array.isArray(supported) && supported.length > 0) {
      zones = supported.includes('UTC') ? supported : ['UTC', ...supported];
    }
  } catch {
    zones = COMMON_TIMEZONES;
  }

  return zones.map((zone) => ({
    value: zone,
    label: zone,
    offset: formatTimezoneOffset(zone, now),
  }));
}
