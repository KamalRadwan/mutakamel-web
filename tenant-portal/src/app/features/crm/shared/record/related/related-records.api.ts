import { signal } from '@angular/core';
import { fakeRelatedCounts } from './related-records.fake';
import { RelatedCounts, RelatedRecordType } from './related-records.model';

export const RELATED_COUNTS_STALE_MS = 60_000;

interface CacheEntry {
  branchId: string;
  value: RelatedCounts | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<RelatedCounts | null>>();
const revision = signal(0);

export const relatedCountsRevision = revision.asReadonly();

export function relatedCountsQueryKey(
  recordType: RelatedRecordType,
  recordId: string,
): readonly ['crm', 'related-counts', RelatedRecordType, string] {
  return ['crm', 'related-counts', recordType, recordId] as const;
}

function cacheKey(recordType: RelatedRecordType, recordId: string): string {
  return `${recordType}:${recordId}`;
}

export function invalidateRelatedCounts(recordType?: RelatedRecordType, recordId?: string): void {
  if (!recordType) {
    cache.clear();
    inFlight.clear();
  } else if (recordId) {
    const key = cacheKey(recordType, recordId);
    cache.delete(key);
    inFlight.delete(key);
  } else {
    const prefix = `${recordType}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
    for (const key of inFlight.keys()) {
      if (key.startsWith(prefix)) inFlight.delete(key);
    }
  }
  revision.update((n) => n + 1);
}

/**
 * POST /api/tenant/crm/v1/related-records/counts
 * Query key: `['crm', 'related-counts', recordType, recordId]` (stale 60 s; invalidated after saves that can change the party, e.g. lead conversion).
 */
export async function relatedCounts(
  branchId: string,
  recordType: RelatedRecordType,
  recordId: string,
): Promise<RelatedCounts | null> {
  const cleanId = recordId.trim();
  if (!cleanId) return null;

  const key = cacheKey(recordType, cleanId);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.branchId === branchId && cached.expiresAt > now) {
    return cached.value ? { ...cached.value } : null;
  }

  const pendingKey = `${branchId}:${key}`;
  const existingRequest = inFlight.get(pendingKey);
  if (existingRequest) {
    const result = await existingRequest;
    return result ? { ...result } : null;
  }

  const request = fakeRelatedCounts({ branchId, recordType, recordIds: [cleanId] })
    .then((response) => {
      const value = response.countsByRecordId[cleanId] ?? null;
      cache.set(key, {
        branchId,
        value: value ? { ...value } : null,
        expiresAt: Date.now() + RELATED_COUNTS_STALE_MS,
      });
      return value;
    })
    .finally(() => {
      inFlight.delete(pendingKey);
    });

  inFlight.set(pendingKey, request);
  const result = await request;
  return result ? { ...result } : null;
}
