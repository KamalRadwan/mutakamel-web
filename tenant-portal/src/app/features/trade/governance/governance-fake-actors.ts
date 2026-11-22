import { ApiError } from '../shared/trade-api';
import { clone } from '../shared/trade-foundation.fake';
import type { LocalizedNames } from '../shared/trade-foundation.model';

export const FAKE_ME = '0193a000-0000-7000-8000-000000000001';
export const FAKE_COLLEAGUE = '0193a000-0000-7000-8000-000000000002';

const ACTORS: Readonly<Record<string, LocalizedNames>> = {
  [FAKE_ME]: { en: 'Ali Hassan', ar: 'علي حسن' },
  [FAKE_COLLEAGUE]: { en: 'Sara Adel', ar: 'سارة عادل' },
};

let currentFakeActor: string = FAKE_ME;

export function getFakeActor(): string {
  return currentFakeActor;
}

export function setFakeActor(id: string): void {
  currentFakeActor = id && id.trim() ? id : FAKE_ME;
}

export function actorName(id: string | null | undefined): LocalizedNames {
  if (!id) {
    return { en: 'System', ar: 'النظام' };
  }
  const known = ACTORS[id];
  if (known) {
    return { ...known };
  }
  return { en: id, ar: id };
}

export function currentUiLang(): 'en' | 'ar' {
  if (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

export function actorDisplayName(id: string | null | undefined, lang: 'en' | 'ar' = currentUiLang()): string {
  const names = actorName(id);
  return names[lang] ?? names['en'] ?? id ?? '';
}

export interface WriteOptions {
  idempotencyKey?: string;
  ifMatch?: number;
}

export function normalizeWriteOpts(
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): WriteOptions {
  if (typeof ifMatchOrOpts === 'number') {
    return { ifMatch: ifMatchOrOpts, idempotencyKey };
  }
  if (ifMatchOrOpts && typeof ifMatchOrOpts === 'object') {
    return {
      ifMatch: ifMatchOrOpts.ifMatch,
      idempotencyKey: ifMatchOrOpts.idempotencyKey ?? idempotencyKey,
    };
  }
  return { idempotencyKey };
}

export function checkIfMatch(expected: number | undefined, actual: number): void {
  if (expected !== undefined && expected !== actual) {
    throw new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION');
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export function computeHash(value: unknown): string {
  const text = stableStringify(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

interface IdemEntry {
  fingerprint: string;
  result: unknown;
}

export interface IdempotencyStore {
  run<T>(scope: string, key: string | undefined, payload: unknown, fn: () => T): T;
}

export function fakeIdem(): IdempotencyStore {
  const seen = new Map<string, IdemEntry>();

  return {
    run<T>(scope: string, key: string | undefined, payload: unknown, fn: () => T): T {
      const normalizedKey = key?.trim();
      if (!normalizedKey) {
        return clone(fn());
      }
      const cacheKey = `${scope}::${normalizedKey}`;
      const fingerprint = stableStringify(payload);
      const existing = seen.get(cacheKey);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
        }
        return clone(existing.result as T);
      }
      const result = fn();
      seen.set(cacheKey, { fingerprint, result: clone(result) });
      return clone(result);
    },
  };
}

export function governanceErrorKey(error: unknown, scope = 'governance'): string {
  if (!(error instanceof ApiError)) {
    return 'tradeShared.errors.network';
  }
  const reason = error.details?.['reason']?.[0];
  if (reason) {
    return `${scope}.errors.${error.code}.${reason}`;
  }
  return `${scope}.errors.${error.code}`;
}
