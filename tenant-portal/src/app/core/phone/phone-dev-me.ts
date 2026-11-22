import { isDevMode } from '@angular/core';
import { PhoneMe } from './phone.model';

export const PHONE_DEV_ME_STORAGE_KEY = 'mutakamel.phone.devMe';

/**
 * Reads a dev-only `PhoneMe` JSON override from `sessionStorage` so a developer can test
 * against the test PBX before P7 links the real `/me` endpoint. Always returns `null` in production builds.
 */
export function readPhoneDevMe(devMode: boolean = isDevMode()): PhoneMe | null {
  if (!devMode || typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(PHONE_DEV_ME_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPhoneMeLike(parsed)) return null;
    return structuredClone(parsed);
  } catch {
    return null;
  }
}

function isPhoneMeLike(value: unknown): value is PhoneMe {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record['enabled'] === 'boolean' && Array.isArray(record['servers']);
}
