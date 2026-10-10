import {
  TENANT_DESTROY_ADVANCING_PHASES,
  type TenantDestroyPhase,
  type TenantDestroyView,
} from "../types";

const ADVANCING_PHASES: ReadonlySet<TenantDestroyPhase> = new Set(
  TENANT_DESTROY_ADVANCING_PHASES,
);

/**
 * Core accepts abandon only before it authorized the database drop; once the
 * drop is authorized the database may already be gone, so the request can
 * only finish (`409 TENANT_DESTROY_NOT_ABANDONABLE`).
 */
const ABANDONABLE_PHASES: ReadonlySet<TenantDestroyPhase> = new Set([
  "STOPPING_PROVISIONING",
  "BLOCKED",
]);

/** Worker still advances the request, so its projection is worth polling. */
export function isTenantDestroyAdvancing(phase: TenantDestroyPhase): boolean {
  return ADVANCING_PHASES.has(phase);
}

export function canAbandonTenantDestroy(
  operation: Pick<TenantDestroyView, "phase"> | null,
): boolean {
  return operation !== null && ABANDONABLE_PHASES.has(operation.phase);
}

/**
 * Every request that was not abandoned holds the tenant: Core refuses restore
 * with `TENANT_DESTROY_IN_PROGRESS` and answers a new destroy with this same
 * request. An abandoned request is only evidence, so restore and a new
 * destruction request become available again.
 */
export function tenantDestroyHoldsTenant(
  operation: Pick<TenantDestroyView, "phase"> | null,
): boolean {
  return operation !== null && operation.phase !== "ABANDONED";
}

/**
 * What one poll observed. Every field moves only when Worker or Core acted on
 * the request — nothing grows merely because it was read — so an unchanged
 * fingerprint is a quiet poll and lets the cadence back off.
 */
export function tenantDestroyPollFingerprint(
  operation: TenantDestroyView | null,
): string {
  return JSON.stringify(
    operation
      ? [
          operation.operationId,
          operation.phase,
          operation.attempts,
          operation.updatedAt,
          operation.nextAttemptAt,
          operation.lastErrorCode,
          operation.blockingOperationId,
          operation.blockedReason,
          operation.completedAt,
          operation.abandonedAt,
        ]
      : null,
  );
}
