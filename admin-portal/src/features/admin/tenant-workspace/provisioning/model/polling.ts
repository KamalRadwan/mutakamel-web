import type {
  ProvisioningPage,
  TenantOperationDetail,
  TenantOperationSummary,
  TenantOperationTimelineEvent,
  TenantPrerequisiteEvidenceRecord,
} from "../types";

/** The fastest cadence, used while anything on screen is still changing. */
export const PROVISIONING_POLL_BASE_MS = 3_000;

/** 3 s → 15 s → 60 s with the default base. */
const BACKOFF_FACTORS = [1, 5, 20] as const;

/**
 * Unchanged polls tolerated at each cadence before slowing to the next:
 * fifteen quiet seconds at 3 s, then a quiet minute at 15 s.
 */
const QUIET_POLLS_BEFORE_SLOWING = [5, 4] as const;

/**
 * The poll cadence after `quietPolls` consecutive polls that changed nothing.
 * Any change, command, selection, manual refresh or return to the tab resets
 * the count, so live work is always watched at the base cadence.
 */
export function provisioningPollIntervalMs(
  quietPolls: number,
  baseMs: number = PROVISIONING_POLL_BASE_MS,
): number {
  let tier = 0;
  let threshold = 0;
  for (const allowance of QUIET_POLLS_BEFORE_SLOWING) {
    threshold += allowance;
    if (quietPolls >= threshold) tier += 1;
  }
  return baseMs * BACKOFF_FACTORS[tier];
}

/**
 * What one poll observed, reduced to the fields that mean progress. The
 * stall's age is left out on purpose: it grows on every read and would keep
 * an idle operation polling at the fastest cadence forever.
 */
export function provisioningPollFingerprint(observed: {
  operations: readonly TenantOperationSummary[] | null;
  detail: TenantOperationDetail | null;
  prerequisites: readonly TenantPrerequisiteEvidenceRecord[] | null;
}): string {
  const { operations, detail, prerequisites } = observed;
  return JSON.stringify([
    operations?.map((operation) => [
      operation.id,
      operation.status,
      operation.currentPhase,
      operation.heartbeatAt,
      operation.updatedAt,
    ]) ?? null,
    detail
      ? [
          detail.id,
          detail.status,
          detail.currentPhase,
          detail.timelineEventCount,
          detail.stall?.reason ?? null,
          detail.stall?.stepKey ?? null,
          detail.steps.map((step) => [
            step.stepKey,
            step.status,
            step.attemptCount,
            step.heartbeatAt,
          ]),
        ]
      : null,
    prerequisites?.map((request) => [
      request.requestId,
      request.status,
      request.maintenanceFence?.status ?? null,
      request.evidence.length,
    ]) ?? null,
  ]);
}

/**
 * Folds a freshly read first page into the pages already shown. A background
 * refresh used to replace the list with page one, so every poll undid the
 * operator's "Load older". `meta.page` keeps counting the pages loaded, which
 * is what the next "Load older" extends.
 */
export function mergeFirstPage<T extends { id: string }>(
  previous: ProvisioningPage<T>,
  fresh: ProvisioningPage<T>,
  order: (left: T, right: T) => number,
): ProvisioningPage<T> {
  if (previous.meta.page <= 1) return fresh;
  const freshIds = new Set(fresh.items.map((item) => item.id));
  const items = [
    ...fresh.items,
    ...previous.items.filter((item) => !freshIds.has(item.id)),
  ].sort(order);
  const page = previous.meta.page;
  return {
    items,
    meta: {
      ...fresh.meta,
      page,
      hasNext: page < fresh.meta.totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Appends the next page without duplicating rows that slid into it because
 * newer rows were added at the top since the previous page was read.
 */
export function appendPage<T extends { id: string }>(
  previous: ProvisioningPage<T>,
  next: ProvisioningPage<T>,
): ProvisioningPage<T> {
  const seen = new Set(previous.items.map((item) => item.id));
  return {
    items: [...previous.items, ...next.items.filter((item) => !seen.has(item.id))],
    meta: next.meta,
  };
}

/** The history's own order: generation, then id, both descending. */
export function newestOperationFirst(
  left: TenantOperationSummary,
  right: TenantOperationSummary,
): number {
  return right.generation - left.generation || compareText(right.id, left.id);
}

/** The timeline's own order: sequence descending. */
export function newestEventFirst(
  left: TenantOperationTimelineEvent,
  right: TenantOperationTimelineEvent,
): number {
  return (
    compareUnsignedDecimal(right.sequence, left.sequence) ||
    compareText(right.id, left.id)
  );
}

/** Sequences are decimal strings without leading zeros and may exceed 2^53. */
function compareUnsignedDecimal(left: string, right: string): number {
  return left.length - right.length || compareText(left, right);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
