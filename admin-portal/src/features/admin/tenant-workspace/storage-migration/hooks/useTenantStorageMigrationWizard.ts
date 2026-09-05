"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { backupApi } from "@/features/admin/backup/api";
import type { BackupArtifact, RestoreRun } from "@/features/admin/backup/types";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { PendingCommandIntentMismatchError } from "@/shared/api/persisted-command-recovery";
import {
  isAmbiguousCommandOutcome,
  STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
} from "../../command-outcome";
import { useOperatorRefreshGuard } from "@/shared/hooks/useOperatorRefreshGuard";
import { usePersistedCommandAttempt } from "@/shared/hooks/usePersistedCommandAttempt";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import {
  isStorageMigrationAwaitingSourceRelease,
  isStorageMigrationSettled,
} from "../../storage/types";
import type { TenantStorageMigrationView } from "../../storage/types";
import {
  tenantStorageMigrationApi,
  tenantStorageMigrationPreflightApi,
} from "../api";
import { storageMigrationCopy } from "../copy";
import { readTenantStorageMigrationPermissions } from "../model/permissions";
import { remainingStorageBytes } from "../model/migration-timeline";
import type { TenantStorageMigrationPreflight } from "../types";

const POLL_INTERVAL_MS = 5_000;
/** Core's DTO: whole bytes, 1–16 digits, no leading zero. */
const MAX_BYTES_PATTERN = /^[1-9][0-9]{0,15}$/;
const START_STORAGE_KEY = "admin.tenant.pending.storage-migration.v1";
const START_ROUTE = "/api/admin/core/v1/tenants/:tenantId/storage-migrations";
const RELEASE_STORAGE_KEY = "admin.tenant.pending.storage-source-release.v1";
const RELEASE_ROUTE =
  "/api/admin/core/v1/storage-migrations/:id/release-source";

export type StorageMigrationPhase = "select" | "monitor" | "finish";
export type StorageMigrationResourceState = "loading" | "ready" | "error";
export type BackupEvidenceState =
  | "idle"
  | "loading"
  | "ready"
  | "forbidden"
  | "error";

export interface StorageMigrationFieldErrors {
  target?: string;
  backupArtifactId?: string;
  restoreRunId?: string;
  maxBytes?: string;
}

function isAmbiguousOutcome(error: NormalizedApiError): boolean {
  return isAmbiguousCommandOutcome(
    error,
    STORAGE_MIGRATION_DEFINITIVE_REFUSAL_CODES,
  );
}

export interface UseTenantStorageMigrationWizardOptions {
  /**
   * Regions whose editing and text selection a background poll must not
   * disrupt. Owned by the caller, matching `useDashboardData`.
   */
  ownedRefreshRegionRefs?: readonly RefObject<HTMLElement | null>[];
}

export function useTenantStorageMigrationWizard(
  tenantId: string,
  options: UseTenantStorageMigrationWizardOptions = {},
) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const copy = storageMigrationCopy[lang];
  const permissions = readTenantStorageMigrationPermissions(user);

  const [preflight, setPreflight] =
    useState<TenantStorageMigrationPreflight | null>(null);
  const [resourceState, setResourceState] =
    useState<StorageMigrationResourceState>("loading");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [migration, setMigration] = useState<TenantStorageMigrationView | null>(
    null,
  );

  const [artifacts, setArtifacts] = useState<BackupArtifact[]>([]);
  const [restores, setRestores] = useState<RestoreRun[]>([]);
  const [evidenceState, setEvidenceState] = useState<BackupEvidenceState>("idle");

  const [targetStorageServerId, setTargetStorageServerId] = useState("");
  const [backupArtifactId, setBackupArtifactId] = useState("");
  const [restoreRunId, setRestoreRunId] = useState("");
  const [maxBytes, setMaxBytes] = useState("");
  // Default ON. Keeping the old copy is the safer choice and the one an
  // operator almost always wants: the tenant is already live on the
  // destination, so retention costs nothing but storage and buys a manual way
  // back if the copy turns out to be subtly wrong.
  const [retainSource, setRetainSource] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<StorageMigrationFieldErrors>({});

  const [isStarting, setIsStarting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [commandError, setCommandError] = useState<NormalizedApiError | null>(
    null,
  );
  const [ambiguousCommand, setAmbiguousCommand] = useState<
    "start" | "release" | null
  >(null);
  /**
   * Which persisted slot raised PendingCommandIntentMismatchError. A boolean
   * could not say, so the banner always offered reconcileStart and a
   * release-path mismatch stayed stuck: the wrong slot was cleared and the next
   * Release raised the same error with no request issued. Twin of the database
   * relocation wizard.
   */
  const [intentMismatch, setIntentMismatch] = useState<
    "start" | "release" | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);

  const startCommand = usePersistedCommandAttempt(START_STORAGE_KEY, START_ROUTE);
  const releaseCommand = usePersistedCommandAttempt(
    RELEASE_STORAGE_KEY,
    RELEASE_ROUTE,
  );
  const refreshGuard = useOperatorRefreshGuard({
    ...(options.ownedRefreshRegionRefs
      ? { ownedRegionRefs: options.ownedRefreshRegionRefs }
      : {}),
    modalOrMenuOpen: confirmOpen || releaseConfirmOpen,
  });

  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setResourceState((current) => (current === "ready" ? "ready" : "loading"));
    setLoadError(null);
    try {
      const next = await tenantStorageMigrationPreflightApi.read(tenantId);
      if (generation !== loadGenerationRef.current) return;
      setPreflight(next);
      setResourceState("ready");
      // Recovery after a reload: the preflight already knows whether a
      // migration is open, so no separate history read is needed.
      if (next.openMigrationId) {
        const open = await tenantStorageMigrationApi.get(next.openMigrationId);
        if (generation !== loadGenerationRef.current) return;
        setMigration(open);
      }
    } catch (caught) {
      if (generation !== loadGenerationRef.current) return;
      setLoadError(normalizeApiError(caught));
      setResourceState("error");
    }
  }, [tenantId]);

  /**
   * Backup artifacts and restore runs are a separate Worker resource under a
   * separate permission, so they get their own state: an operator who cannot
   * read them still gets the preflight, the placement and any open migration.
   */
  const loadBackupEvidence = useCallback(async () => {
    if (!permissions.canReadBackupEvidence) {
      setEvidenceState("forbidden");
      return;
    }
    setEvidenceState("loading");
    try {
      const [nextArtifacts, nextRestores] = await Promise.all([
        backupApi.listArtifacts({ tenantId }),
        backupApi.listRestores({ tenantId }),
      ]);
      setArtifacts(nextArtifacts);
      setRestores(nextRestores);
      setEvidenceState("ready");
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setEvidenceState(normalized.httpStatus === 403 ? "forbidden" : "error");
    }
  }, [permissions.canReadBackupEvidence, tenantId]);

  // Deferred by one macrotask so the first fetches are not a synchronous
  // setState cascade inside the mount effect, matching `useBackupRuns`.
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBackupEvidence();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadBackupEvidence]);

  // "Settled" covers both a terminal status and a committed migration resting
  // on its retained source. The second is not stuck: the tenant has moved and
  // nothing advances until an operator confirms the deletion, so polling it
  // would wait forever for a status that cannot arrive on its own.
  const isSettled = migration ? isStorageMigrationSettled(migration) : false;
  const awaitingSourceRelease = migration
    ? isStorageMigrationAwaitingSourceRelease(migration)
    : false;
  const isRunning = Boolean(migration) && !isSettled;

  const poll = useCallback(async () => {
    if (!migration) return;
    try {
      const next = await tenantStorageMigrationApi.get(migration.id);
      setMigration((current) =>
        current && current.id === next.id ? next : current,
      );
    } catch (caught) {
      // Keep the migration already on screen; the next tick retries.
      setCommandError(normalizeApiError(caught));
    }
  }, [migration]);

  usePollWhile(isRunning && !refreshGuard.isPaused, poll, {
    intervalMs: POLL_INTERVAL_MS,
    deps: [migration?.id],
  });

  const phase: StorageMigrationPhase = !migration
    ? "select"
    : isSettled
      ? "finish"
      : "monitor";

  const blockers = preflight?.blockers ?? [];
  const hasBlockers = blockers.length > 0;
  const hasTargets = (preflight?.targets.length ?? 0) > 0;
  const selectedTarget =
    preflight?.targets.find((target) => target.id === targetStorageServerId) ??
    null;

  const startLocked =
    ambiguousCommand !== null || intentMismatch !== null || isStarting;
  const canSubmit =
    permissions.canExecute &&
    permissions.canReadBackupEvidence &&
    !hasBlockers &&
    hasTargets &&
    !startLocked &&
    phase === "select";

  const validate = useCallback((): StorageMigrationFieldErrors => {
    const errors: StorageMigrationFieldErrors = {};
    if (!targetStorageServerId) errors.target = copy.destinationRequired;
    if (!backupArtifactId) errors.backupArtifactId = copy.artifactRequired;
    if (!restoreRunId) errors.restoreRunId = copy.restoreRequired;
    if (!MAX_BYTES_PATTERN.test(maxBytes)) {
      errors.maxBytes = copy.maxBytesInvalid;
    } else if (selectedTarget) {
      const headroom = remainingStorageBytes(selectedTarget);
      if (headroom !== null && BigInt(maxBytes) > BigInt(headroom)) {
        errors.maxBytes = copy.maxBytesExceedsHeadroom;
      }
    }
    return errors;
  }, [
    backupArtifactId,
    copy,
    maxBytes,
    restoreRunId,
    selectedTarget,
    targetStorageServerId,
  ]);

  const requestConfirmation = useCallback(() => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirmOpen(true);
  }, [validate]);

  const startMigration = useCallback(async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !preflight) {
      setConfirmOpen(false);
      return;
    }
    const dto = {
      targetStorageServerId,
      // The whole reason this wizard is buildable: the fence value now has a
      // read. It is passed through verbatim, never derived or guessed.
      expectedStoragePlacementRevision:
        preflight.current.storagePlacementRevision,
      backupArtifactId,
      restoreRunId,
      maxBytes,
      retainSource,
    };
    setIsStarting(true);
    setCommandError(null);
    try {
      const idempotencyKey = await startCommand.prepare(
        { action: "start-tenant-storage-migration", tenantId, ...dto },
        { kind: "TENANT", id: tenantId },
      );
      const started = await tenantStorageMigrationApi.start(
        tenantId,
        dto,
        idempotencyKey,
      );
      startCommand.clear();
      setAmbiguousCommand(null);
      setMigration(started);
      setConfirmOpen(false);
    } catch (caught) {
      if (caught instanceof PendingCommandIntentMismatchError) {
        setIntentMismatch("start");
        setConfirmOpen(false);
        return;
      }
      const normalized = normalizeApiError(caught);
      setCommandError(normalized);
      setConfirmOpen(false);
      if (isAmbiguousOutcome(normalized)) {
        // This route is Gateway `idempotent: true`, so an exact retry with the
        // same key returns the original outcome instead of starting a second
        // migration. A definitive 4xx ends the intent and retires the key.
        setAmbiguousCommand("start");
      } else {
        startCommand.clear();
      }
    } finally {
      setIsStarting(false);
    }
  }, [
    backupArtifactId,
    maxBytes,
    preflight,
    restoreRunId,
    retainSource,
    startCommand,
    targetStorageServerId,
    tenantId,
    validate,
  ]);

  /** Authoritative recovery: the preflight reports any open migration. */
  const reconcileStart = useCallback(async () => {
    setIsReconciling(true);
    try {
      const next = await tenantStorageMigrationPreflightApi.read(tenantId);
      setPreflight(next);
      if (next.openMigrationId) {
        setMigration(await tenantStorageMigrationApi.get(next.openMigrationId));
      }
      // Either answer resolves the attempt. An open migration is the outcome
      // the operator was missing; none is proof the command never took effect,
      // which is just as final — and an attempt left on file after that is what
      // blocks the next submission as an intent mismatch.
      startCommand.clear();
      setAmbiguousCommand(null);
      setIntentMismatch(null);
      setCommandError(null);
      return next.openMigrationId;
    } catch (caught) {
      setCommandError(normalizeApiError(caught));
      return null;
    } finally {
      setIsReconciling(false);
    }
  }, [startCommand, tenantId]);

  /**
   * Removes the retained source namespace.
   *
   * Core is forward-only here: a failure leaves the migration at
   * `PLACEMENT_COMMITTED` with `STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED` and
   * never restores source placement, so the recovery is an exact retry with the
   * same key — never a rollback.
   */
  const releaseSource = useCallback(async () => {
    if (!migration) return;
    setIsReleasing(true);
    setCommandError(null);
    try {
      const idempotencyKey = await releaseCommand.prepare(
        {
          action: "release-tenant-storage-migration-source",
          migrationId: migration.id,
          confirmTenantId: tenantId,
        },
        { kind: "STORAGE_MIGRATION", id: migration.id },
      );
      const next = await tenantStorageMigrationApi.releaseSource(
        migration.id,
        { confirmTenantId: tenantId },
        idempotencyKey,
      );
      releaseCommand.clear();
      setAmbiguousCommand(null);
      setMigration(next);
      setReleaseConfirmOpen(false);
    } catch (caught) {
      if (caught instanceof PendingCommandIntentMismatchError) {
        setIntentMismatch("release");
        setReleaseConfirmOpen(false);
        return;
      }
      const normalized = normalizeApiError(caught);
      setCommandError(normalized);
      setReleaseConfirmOpen(false);
      // `STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED` is a 503, so it is already
      // covered here: the deletion may or may not have run, and the exact retry
      // with the same key is what settles it.
      if (isAmbiguousOutcome(normalized)) setAmbiguousCommand("release");
      else releaseCommand.clear();
    } finally {
      setIsReleasing(false);
    }
  }, [migration, releaseCommand, tenantId]);

  /** Re-reads the migration; its own projection says whether the source is gone. */
  const reconcileRelease = useCallback(async () => {
    if (!migration) return;
    setIsReconciling(true);
    try {
      const next = await tenantStorageMigrationApi.get(migration.id);
      setMigration(next);
      if (next.status === "COMPLETED" || next.sourceReleaseRequestedAt) {
        releaseCommand.clear();
        setAmbiguousCommand(null);
        setCommandError(null);
      }
      // Cleared whatever the projection said: re-reading the migration answers
      // the stale release attempt either way, and that attempt is what blocks
      // the next submission. reconcileStart has always done this for its slot.
      setIntentMismatch((slot) => (slot === "release" ? null : slot));
    } catch (caught) {
      setCommandError(normalizeApiError(caught));
    } finally {
      setIsReconciling(false);
    }
  }, [migration, releaseCommand]);

  const startAnotherMigration = useCallback(() => {
    setMigration(null);
    setCommandError(null);
    setAmbiguousCommand(null);
    setFieldErrors({});
    setTargetStorageServerId("");
    setBackupArtifactId("");
    setRestoreRunId("");
    setMaxBytes("");
    setRetainSource(true);
    void load();
    void loadBackupEvidence();
  }, [load, loadBackupEvidence]);

  return {
    copy,
    lang,
    permissions,
    resourceState,
    loadError,
    preflight,
    blockers,
    hasBlockers,
    hasTargets,
    selectedTarget,
    phase,
    migration,
    isRunning,
    awaitingSourceRelease,
    refreshGuard,

    artifacts,
    restores,
    evidenceState,
    reloadBackupEvidence: loadBackupEvidence,

    targetStorageServerId,
    setTargetStorageServerId,
    backupArtifactId,
    setBackupArtifactId,
    restoreRunId,
    setRestoreRunId,
    maxBytes,
    setMaxBytes,
    retainSource,
    setRetainSource,
    fieldErrors,

    canSubmit,
    isStarting,
    isReleasing,
    isReconciling,
    commandError,
    ambiguousCommand,
    intentMismatch,
    startAttempt: startCommand.pendingAttempt,
    releaseAttempt: releaseCommand.pendingAttempt,

    confirmOpen,
    openConfirm: requestConfirmation,
    closeConfirm: () => setConfirmOpen(false),
    releaseConfirmOpen,
    openReleaseConfirm: () => setReleaseConfirmOpen(true),
    closeReleaseConfirm: () => setReleaseConfirmOpen(false),

    canReleaseSource: permissions.canExecute && awaitingSourceRelease,
    sourceAlreadyReleased: migration?.status === "COMPLETED",

    refresh: load,
    startMigration,
    reconcileStart,
    releaseSource,
    reconcileRelease,
    startAnotherMigration,
  };
}

export type TenantStorageMigrationController = ReturnType<
  typeof useTenantStorageMigrationWizard
>;
