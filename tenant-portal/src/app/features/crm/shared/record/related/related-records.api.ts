import { signal } from '@angular/core';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../crm-http';
import { sessionBranch, type SessionBranch } from '../../lookups/session-branch';
import { RelatedCounts, RelatedCountsResponse, RelatedRecordType } from './related-records.model';

export const RELATED_COUNTS_STALE_MS = 60_000;
const moduleKey = 'crm-related-records';
const revision = signal(0);

export const relatedCountsRevision = revision.asReadonly();

export function relatedCountsQueryKey(
  recordType: RelatedRecordType,
  recordId: string,
): readonly ['crm', 'related-counts', RelatedRecordType, string] {
  return ['crm', 'related-counts', recordType, recordId] as const;
}

export function invalidateRelatedCounts(recordType?: RelatedRecordType, recordId?: string): void {
  const filters = {
    queryKey: [moduleKey],
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) =>
      (!recordType || queryKey[3] === recordType) &&
      (!recordType || !recordId || queryKey[4] === recordId.trim().toLowerCase()),
  };
  // Cancel first so a response loaded before a save cannot repopulate its cache.
  void crmQueries().cancelQueries(filters);
  void crmQueries().invalidateQueries(filters);
  revision.update((n) => n + 1);
}

interface PendingCount {
  recordId: string;
  resolve: (value: RelatedCounts | null) => void;
  reject: (error: unknown) => void;
}

const batches = new Map<string, PendingCount[]>();

function enqueueCount(scope: SessionBranch, recordType: RelatedRecordType, recordId: string): Promise<RelatedCounts | null> {
  const batchKey = JSON.stringify([scope, recordType]);
  return new Promise((resolve, reject) => {
    const pending = batches.get(batchKey);
    if (pending) {
      pending.push({ recordId, resolve, reject });
      return;
    }
    const entries: PendingCount[] = [{ recordId, resolve, reject }];
    batches.set(batchKey, entries);
    // Share one read-like POST for records requested during the same turn.
    queueMicrotask(() => {
      batches.delete(batchKey);
      for (let offset = 0; offset < entries.length; offset += 100) {
        const batch = entries.slice(offset, offset + 100);
        void crmHttp().write<RelatedCountsResponse>('POST', '/related-records/counts', {
          branchId: scope.branchId, recordType, recordIds: [...new Set(batch.map((entry) => entry.recordId))],
        }, { key: newIdempotencyKey(), scope }).then(({ data }) => {
          for (const entry of batch) entry.resolve(data.countsByRecordId[entry.recordId] ?? null);
        }).catch((error: unknown) => {
          for (const entry of batch) entry.reject(error);
        });
      }
    });
  });
}

/** BRANCH_REQUIRED: POST /related-records/counts needs both UUID v7 scope headers. */
export async function relatedCounts(
  branchId: string,
  recordType: RelatedRecordType,
  recordId: string,
): Promise<RelatedCounts | null> {
  const cleanId = recordId.trim().toLowerCase();
  if (!branchId || !cleanId) return null;
  const scope = sessionBranch();
  if (!scope || scope.branchId !== branchId) return null;
  const value = await crmQueries().fetchQuery({
    queryKey: [moduleKey, ...relatedCountsQueryKey(recordType, cleanId), scope],
    staleTime: RELATED_COUNTS_STALE_MS,
    gcTime: RELATED_COUNTS_STALE_MS,
    queryFn: () => enqueueCount(scope, recordType, cleanId),
  });
  return value ? { ...value } : null;
}
