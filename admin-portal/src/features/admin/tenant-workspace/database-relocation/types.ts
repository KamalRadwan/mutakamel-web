import type { TenantPlacementBlockerCode } from "../placement-blockers";

/**
 * The documented relocation sequence, in order.
 *
 * Worker writes its ledger in exactly these terms (`relocation.plan.ts`), and
 * a step that is absent from `steps[]` has not run yet — the record carries no
 * explicit PENDING entry, so the UI derives it from this order.
 */
export const RELOCATION_STEPS = [
  "CLAIM",
  "QUIESCE",
  "BACKUP",
  "PROVISION",
  "RESTORE",
  "VERIFY",
  "REPOINT",
  "LIFT",
  "RETAIN",
  "DESTROY",
] as const;

export type RelocationStep = (typeof RELOCATION_STEPS)[number];

/** Worker records only settled steps; "in progress" is the absence of one. */
export type RelocationStepState = "DONE" | "FAILED";

export interface RelocationStepEntry {
  step: RelocationStep;
  state: RelocationStepState;
  at: string;
  detail?: string;
}

export type RelocationOutcome = "RUNNING" | "RELOCATED" | "ABANDONED";

/**
 * Which rollback applies is decided entirely by *where* a relocation stopped.
 * `NONE` means the retained source is already gone, which is why releasing it
 * is a separate, retention-gated command.
 */
export type RelocationRollback =
  | "SOURCE_AUTHORITATIVE"
  | "REPOINT_TO_RETAINED_SOURCE"
  | "NONE";

export interface RelocationRecord {
  relocationId: string;
  tenantId: string;
  sourceDatabaseServerId: string;
  sourceDatabaseName: string;
  targetDatabaseServerId: string;
  targetDatabaseName: string;
  actorId: string;
  reason: string;
  startedAt: string;
  steps: RelocationStepEntry[];
  /** Set once the repoint succeeds; the source is retained until this instant. */
  retainUntil?: string;
  sourceDestroyedAt?: string;
  outcome: RelocationOutcome;
  failedStep?: RelocationStep;
  rollback?: RelocationRollback;
}

/** Source-retention bounds the start command will accept, stated by Core. */
export interface TenantRelocationRetentionPolicy {
  minDays: number;
  maxDays: number;
  defaultDays: number;
}

export interface TenantRelocationTenantView {
  id: string;
  name: string;
  status: string;
}

export interface DatabaseRelocationTarget {
  id: string;
  name: string;
  status: string;
  countryName?: string;
  countryIsoCode?: string;
  currentTenants: number;
  maxTenants: number;
}

/**
 * `GET /api/admin/core/v1/tenants/:tenantId/database-relocation-preflight`.
 *
 * `current.databasePlacementRevision` is the number the relocation is fenced
 * on. It has no other admin read, which is why this wizard could not exist
 * before the preflight route did.
 */
export interface TenantDatabaseRelocationPreflight {
  tenant: TenantRelocationTenantView;
  current: {
    databaseServerId: string;
    databaseServerName: string | null;
    databaseName: string;
    databasePlacementRevision: string;
  };
  targets: DatabaseRelocationTarget[];
  blockers: TenantPlacementBlockerCode[];
  retention: TenantRelocationRetentionPolicy;
}

/** Body for `POST /api/admin/worker/v1/relocations/tenants/:tenantId`. */
export interface StartTenantRelocationDto {
  targetDatabaseServerId: string;
  /** 1–500 characters, audited. */
  reason: string;
  /** Typed confirmation; Worker refuses unless it equals the path tenant id. */
  confirmTenantId: string;
  sourceRetentionDays?: number;
}

export interface StartTenantRelocationResult {
  relocationId: string;
  /** The backup run that carries this relocation's durable ledger. */
  runId: string;
  record: RelocationRecord;
}

export interface TenantRelocationSummary {
  runId: string;
  record: RelocationRecord;
}

export interface DestroyRelocationSourceDto {
  confirmTenantId: string;
}

/** A relocation is settled once Worker stops reporting `RUNNING`. */
export function isTerminalRelocation(record: RelocationRecord): boolean {
  return record.outcome !== "RUNNING";
}

/**
 * Whether the retained source database may still be released.
 *
 * Worker gates the command on the retention window *and* a typed tenant id;
 * this mirrors only the parts the browser can evaluate, so a disabled button
 * can explain itself instead of trading a click for a 422.
 */
export function canReleaseRelocationSource(
  record: RelocationRecord,
  now: number,
): boolean {
  if (record.outcome !== "RELOCATED" || record.sourceDestroyedAt) return false;
  const retainUntil = record.retainUntil
    ? Date.parse(record.retainUntil)
    : Number.NaN;
  return Number.isFinite(retainUntil) && now >= retainUntil;
}
