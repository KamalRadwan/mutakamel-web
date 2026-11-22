import { ApiError, errorCodeOf } from '../../../core/api/api-errors';
import { SettingsTranslator } from '../../../core/api/settings-translator';
import { CascadeAddonItem } from './seats.model';

export const SEAT_ERROR_CODES = new Set<string>([
  'SEAT_CAPACITY_INSUFFICIENT',
  'SEAT_ADDON_CASCADE_REQUIRED',
  'SEATS_MANAGED_BY_ROLES',
  'SEAT_RELEASE_NOT_ALLOWED',
  'SEAT_MIGRATION_NOT_READY',
  'SEAT_PREVIEW_TOO_LARGE',
  'SEAT_DOWNGRADE_FREE_UP_REQUIRED',
  'SEAT_KEEP_LIST_TOO_LARGE',
  'SEAT_USAGE_STALE',
  'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE',
  'SEAT_SWAP_INVALID',
  'SEAT_LIMIT_REACHED',
  'SEAT_OVER_CAPACITY_READ_ONLY',
  'APPLICATION_CAPACITY_EXCEEDED',
]);

export interface CascadeAddonDetails {
  addons: CascadeAddonItem[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ''));
}

function invokeTranslate(
  t: SettingsTranslator,
  key: string,
  params?: Record<string, unknown>,
): string {
  return typeof t === 'function' ? t(key, params) : t.translate(key, params);
}

const KNOWN_MODULES = new Set<string>(['crm', 'trade', 'accounting']);

function resolveModuleName(
  t: SettingsTranslator,
  moduleKey: string,
  nameI18n?: { en?: string; ar?: string },
): string {
  if (moduleKey && KNOWN_MODULES.has(moduleKey)) {
    const key = `seats.module.${moduleKey}`;
    const translated = invokeTranslate(t, key);
    if (translated && translated !== key) {
      return translated;
    }
  }
  const activeLang =
    typeof t !== 'function' && 'getActiveLang' in t && typeof (t as { getActiveLang?: () => string }).getActiveLang === 'function'
      ? (t as { getActiveLang: () => string }).getActiveLang()
      : 'en';
  if (nameI18n) {
    return (activeLang === 'ar' ? nameI18n.ar : nameI18n.en) || nameI18n.en || nameI18n.ar || moduleKey;
  }
  return moduleKey;
}

export interface SeatShortfallDetail {
  moduleKey: string;
  needed: number;
  free: number;
  /** Purchased seats; null when the details do not carry it. */
  capacity: number | null;
  /** SEAT_MIGRATION_NOT_READY only: holders now, holders after the switch, and the seats missing. */
  used: number | null;
  usedAfter: number | null;
  shortfall: number | null;
}

/**
 * SEAT_CAPACITY_INSUFFICIENT and SEAT_MIGRATION_NOT_READY carry parallel decimal string arrays that share an
 * index: { moduleKey, needed, free, capacity } and, for the migration, { used, usedAfter, shortfall }.
 * (userModuleKey, userIds, userNames are a separate parallel set, not read here.)
 * Returns [] when the details are absent, so callers fall back to their own data.
 */
export function seatShortfallDetails(error: unknown): SeatShortfallDetail[] {
  const details = error instanceof ApiError ? error.details : undefined;
  const moduleKeys = asStringArray(details?.['moduleKey']);
  const needed = asStringArray(details?.['needed']);
  const free = asStringArray(details?.['free']);
  const capacity = asStringArray(details?.['capacity']);
  const used = asStringArray(details?.['used']);
  const usedAfter = asStringArray(details?.['usedAfter']);
  const shortfall = asStringArray(details?.['shortfall']);
  return moduleKeys
    .map((moduleKey, idx) => ({
      moduleKey,
      needed: toCount(needed[idx]),
      free: toCount(free[idx]),
      capacity: toOptionalCount(capacity[idx]),
      used: toOptionalCount(used[idx]),
      usedAfter: toOptionalCount(usedAfter[idx]),
      shortfall: toOptionalCount(shortfall[idx]),
    }))
    .filter((row) => row.moduleKey !== '');
}

function toCount(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toOptionalCount(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function seatErrorMessage(t: SettingsTranslator, error: unknown): string | null {
  const code = errorCodeOf(error);
  if (!code || !SEAT_ERROR_CODES.has(code)) {
    return null;
  }

  const details = error instanceof ApiError ? error.details : undefined;
  if (code === 'SEAT_CAPACITY_INSUFFICIENT') {
    const shortfall = seatShortfallDetails(error);
    if (shortfall.length > 0) {
      return shortfall
        .map((row) =>
          invokeTranslate(t, 'seats.errors.SEAT_CAPACITY_INSUFFICIENT', {
            module: resolveModuleName(t, row.moduleKey),
            needed: row.needed,
            free: row.free,
          }),
        )
        .join(' ');
    }

    const genericKey = 'seats.errors.capacityGeneric';
    const genericText = invokeTranslate(t, genericKey);
    return genericText && genericText !== genericKey
      ? genericText
      : 'Not enough seats for this change.';
  }

  const key = `seats.errors.${code}`;
  const translated = invokeTranslate(t, key, details);
  return translated && translated !== key ? translated : code;
}

export function isCascadeRequired(error: unknown): CascadeAddonDetails | null {
  if (errorCodeOf(error) !== 'SEAT_ADDON_CASCADE_REQUIRED') {
    return null;
  }
  const details = error instanceof ApiError ? error.details : undefined;
  const userIds = asStringArray(details?.['userIds']);
  const userNames = asStringArray(details?.['userNames']);
  const addonKeys = asStringArray(details?.['addonKeys']);
  const addonNames = asStringArray(details?.['addonNames']);
  const parallelCount = Math.max(userIds.length, userNames.length, addonKeys.length, addonNames.length);

  if (parallelCount > 0) {
    const addons: CascadeAddonItem[] = [];
    for (let i = 0; i < parallelCount; i++) {
      const userId = userIds[i] ?? '';
      addons.push({
        userId,
        userName: userNames[i] ?? userId,
        addonKey: addonKeys[i] ?? '',
        addonName: addonNames[i] ?? '',
      });
    }
    return { addons };
  }

  const rawAddons = details?.['addons'];
  const addons: CascadeAddonItem[] = Array.isArray(rawAddons)
    ? rawAddons.map((item) => {
        const record = item as Record<string, unknown>;
        const userId = String(record['userId'] ?? '');
        return {
          userId,
          userName: String(record['userName'] ?? record['name'] ?? record['user'] ?? userId),
          addonKey: String(record['addonKey'] ?? record['addon'] ?? ''),
          addonName: String(record['addonName'] ?? ''),
        };
      })
    : [];
  return { addons };
}
