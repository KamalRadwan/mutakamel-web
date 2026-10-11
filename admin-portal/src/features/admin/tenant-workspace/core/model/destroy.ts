import {
  TENANT_DESTROY_ADVANCING_PHASES,
  type TenantDestroyBlockedPhase,
  type TenantDestroyPhase,
  type TenantDestroyView,
} from "../types";

const ADVANCING_PHASES: ReadonlySet<TenantDestroyPhase> = new Set(
  TENANT_DESTROY_ADVANCING_PHASES,
);

type DestroyState = Pick<TenantDestroyView, "phase" | "blockedPhase">;

/** A phase entered only after Core authorized the database drop. */
export type TenantDestroyHaltedPhase = Exclude<
  TenantDestroyBlockedPhase,
  "STOPPING_PROVISIONING"
>;

/** Worker still advances the request, so its projection is worth polling. */
export function isTenantDestroyAdvancing(phase: TenantDestroyPhase): boolean {
  return ADVANCING_PHASES.has(phase);
}

/**
 * Core accepts abandon only before it authorized the database drop: while
 * provisioning is still being stopped, or once that stop BLOCKED. A request
 * that halted after the drop was authorized is BLOCKED too, but the database
 * may already be gone, so Core answers `409 TENANT_DESTROY_NOT_ABANDONABLE`.
 */
export function canAbandonTenantDestroy(
  operation: DestroyState | null,
): boolean {
  if (operation === null) return false;
  return (
    operation.phase === "STOPPING_PROVISIONING" ||
    (operation.phase === "BLOCKED" &&
      operation.blockedPhase === "STOPPING_PROVISIONING")
  );
}

/**
 * The phase a request halted in after Core authorized the drop, or `null`.
 * Such a request holds the tenant and cannot be abandoned: only a resume
 * moves it on.
 */
export function tenantDestroyHaltedPhase(
  operation: DestroyState | null,
): TenantDestroyHaltedPhase | null {
  if (operation?.phase !== "BLOCKED") return null;
  const { blockedPhase } = operation;
  return blockedPhase === "DROPPING_DATABASE" || blockedPhase === "FINALIZING"
    ? blockedPhase
    : null;
}

/**
 * Core resumes every BLOCKED request when destruction is requested again under
 * a new idempotency key, with a fresh attempt count: one BLOCKED while
 * stopping provisioning goes back to STOPPING_PROVISIONING and Worker
 * re-checks at once, one halted after the drop was authorized continues in
 * the phase it halted in. A request BLOCKED before the drop can also be
 * abandoned instead ({@link canAbandonTenantDestroy}).
 */
export function canResumeTenantDestroy(operation: DestroyState | null): boolean {
  return operation?.phase === "BLOCKED" && operation.blockedPhase !== null;
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
          operation.blockedPhase,
          operation.completedAt,
          operation.abandonedAt,
        ]
      : null,
  );
}
