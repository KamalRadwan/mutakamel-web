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
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { PendingCommandIntentMismatchError } from "@/shared/api/persisted-command-recovery";
import {
  isAmbiguousCommandOutcome,
  RELOCATION_DEFINITIVE_REFUSAL_CODES,
} from "../../command-outcome";
import { useOperatorRefreshGuard } from "@/shared/hooks/useOperatorRefreshGuard";
import { usePersistedCommandAttempt } from "@/shared/hooks/usePersistedCommandAttempt";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import { tenantDatabaseRelocationApi } from "../api";
import { relocationCopy } from "../copy";
import { readTenantRelocationPermissions } from "../model/permissions";
import { recoverRelocationRun } from "../model/relocation-timeline";
import {
  canReleaseRelocationSource,
  type RelocationRecord,
  type StartTenantRelocationDto,
  type TenantDatabaseRelocationPreflight,
} from "../types";

const POLL_INTERVAL_MS = 5_000;
const REASON_MAX_LENGTH = 500;
const START_STORAGE_KEY = "admin.tenant.pending.relocate-database.v1";
const START_ROUTE = "/api/admin/worker/v1/relocations/tenants/:tenantId";
const RELEASE_STORAGE_KEY = "admin.tenant.pending.relocation-release-source.v1";
const RELEASE_ROUTE = "/api/admin/worker/v1/relocations/:runId/destroy-source";

export type RelocationPhase = "select" | "monitor" | "finish";
export type RelocationResourceState = "loading" | "ready" | "error";

export interface RelocationFieldErrors {
  target?: string;
  reason?: string;
  retentionDays?: string;
}

/**
 * A write whose result is unknown must keep its evidence. Only these outcomes
 * leave the command's server-side effect genuinely undecided; a definitive
 * `4xx` ends the intent, so the next submission gets a fresh key.
 */
function isAmbiguousOutcome(error: NormalizedApiError): boolean {
  return isAmbiguousCommandOutcome(error, RELOCATION_DEFINITIVE_REFUSAL_CODES);
}

export interface UseTenantDatabaseRelocationOptions {
  /**
   * Regions whose editing and text selection a background poll must not
   * disrupt. Owned by the caller, matching `useDashboardData` — a hook that
   * returned a ref would put a ref value in the render path of every panel
   * that reads the controller.
   */
  ownedRefreshRegionRefs?: readonly RefObject<HTMLElement | null>[];
}

export function useTenantDatabaseRelocation(
  tenantId: string,
  options: UseTenantDatabaseRelocationOptions = {},
) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const copy = relocationCopy[lang];
  const permissions = readTenantRelocationPermissions(user);

  const [preflight, setPreflight] =
    useState<TenantDatabaseRelocationPreflight | null>(null);
  const [resourceState, setResourceState] =
    useState<RelocationResourceState>("loading");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [run, setRun] = useState<{
    runId: string;
    record: RelocationRecord;
  } | null>(null);

  const [targetDatabaseServerId, setTargetDatabaseServerId] = useState("");
  const [reason, setReason] = useState("");
  // Held as a string so the operator can clear the field while typing; the
  // bounds check happens on submit against Core's stated retention policy.
  const [retentionDays, setRetentionDays] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RelocationFieldErrors>({});

  const [isStarting, setIsStarting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [commandError, setCommandError] = useState<NormalizedApiError | null>(
    null,
  );
  const [ambiguousCommand, setAmbiguousCommand] = useState<
    "start" | "release" | null
  >(null);
  const [intentMismatch, setIntentMismatch] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
  // A relocation the operator explicitly dismissed with "start another move".
  // Without this, the very next load would re-adopt the same retained run and
  // drop them straight back into the finish phase they just left.
  const dismissedRunIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setResourceState((current) => (current === "ready" ? "ready" : "loading"));
    setLoadError(null);
    try {
      // Independent resources, one await: the preflight decides what the form
      // may offer, the history decides which run this page reopens.
      const [nextPreflight, summaries] = await Promise.all([
        tenantDatabaseRelocationApi.readPreflight(tenantId),
        tenantDatabaseRelocationApi.listForTenant(tenantId),
      ]);
      if (generation !== loadGenerationRef.current) return;
      setPreflight(nextPreflight);
      setRetentionDays((current) =>
        current === "" ? String(nextPreflight.retention.defaultDays) : current,
      );
      const recovered = recoverRelocationRun(summaries);
      setRun((current) =>
        current ??
        (recovered && recovered.runId === dismissedRunIdRef.current
          ? null
          : recovered),
      );
      setResourceState("ready");
    } catch (caught) {
      if (generation !== loadGenerationRef.current) return;
      setLoadError(normalizeApiError(caught));
      setResourceState("error");
    }
  }, [tenantId]);

  // Deferred by one macrotask so the first fetch is not a synchronous setState
  // cascade inside the mount effect, matching `useBackupRuns`.
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const record = run?.record ?? null;
  const isRunning = record?.outcome === "RUNNING";

  const poll = useCallback(async () => {
    if (!run) return;
    try {
      const next = await tenantDatabaseRelocationApi.get(run.runId);
      setRun((current) =>
        current && current.runId === run.runId
          ? { runId: current.runId, record: next }
          : current,
      );
      setNow(Date.now());
    } catch (caught) {
      // A polling failure must not replace the ledger already on screen. The
      // record stays mounted and the next tick retries.
      setCommandError(normalizeApiError(caught));
    }
  }, [run]);

  usePollWhile(Boolean(isRunning) && !refreshGuard.isPaused, poll, {
    intervalMs: POLL_INTERVAL_MS,
    deps: [run?.runId],
  });

  // The release gate is a wall-clock comparison, so the button has to
  // re-evaluate without an operator interaction once the window closes.
  useEffect(() => {
    if (!record?.retainUntil || record.sourceDestroyedAt) return;
    const remaining = Date.parse(record.retainUntil) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining + 1_000, POLL_INTERVAL_MS * 12),
    );
    return () => window.clearTimeout(timer);
  }, [record?.retainUntil, record?.sourceDestroyedAt, now]);

  const phase: RelocationPhase = !record
    ? "select"
    : record.outcome === "RUNNING"
      ? "monitor"
      : "finish";

  const blockers = preflight?.blockers ?? [];
  const hasBlockers = blockers.length > 0;
  const hasTargets = (preflight?.targets.length ?? 0) > 0;
  const startLocked =
    ambiguousCommand === "start" || intentMismatch || isStarting;
  const canSubmit =
    permissions.canExecute &&
    !hasBlockers &&
    hasTargets &&
    !startLocked &&
    phase === "select";

  const validate = useCallback((): RelocationFieldErrors => {
    const errors: RelocationFieldErrors = {};
    if (!targetDatabaseServerId) errors.target = copy.noDestinationSelected;
    const trimmedReason = reason.trim();
    if (!trimmedReason) errors.reason = copy.reasonRequired;
    else if (trimmedReason.length > REASON_MAX_LENGTH) {
      errors.reason = copy.reasonTooLong;
    }
    const days = Number(retentionDays);
    const retention = preflight?.retention;
    if (
      !retention ||
      !Number.isInteger(days) ||
      days < retention.minDays ||
      days > retention.maxDays
    ) {
      errors.retentionDays = copy.retentionOutOfRange;
    }
    return errors;
  }, [copy, preflight?.retention, reason, retentionDays, targetDatabaseServerId]);

  /** Opens the typed confirmation only once the form itself is valid. */
  const requestConfirmation = useCallback(() => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirmOpen(true);
  }, [validate]);

  const startRelocation = useCallback(async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setConfirmOpen(false);
      return;
    }
    const dto: StartTenantRelocationDto = {
      targetDatabaseServerId,
      reason: reason.trim(),
      confirmTenantId: tenantId,
      sourceRetentionDays: Number(retentionDays),
    };
    setIsStarting(true);
    setCommandError(null);
    try {
      const idempotencyKey = await startCommand.prepare(
        { action: "relocate-tenant-database", tenantId, ...dto },
        { kind: "TENANT", id: tenantId },
      );
      const result = await tenantDatabaseRelocationApi.start(
        tenantId,
        dto,
        idempotencyKey,
      );
      startCommand.clear();
      setAmbiguousCommand(null);
      setRun({ runId: result.runId, record: result.record });
      setConfirmOpen(false);
    } catch (caught) {
      if (caught instanceof PendingCommandIntentMismatchError) {
        setIntentMismatch(true);
        setConfirmOpen(false);
        return;
      }
      const normalized = normalizeApiError(caught);
      setCommandError(normalized);
      setConfirmOpen(false);
      if (isAmbiguousOutcome(normalized)) {
        // Relocation is not replay-idempotent — a second accepted call starts a
        // second move. The recovery is the authoritative tenant history read,
        // never an automatic resend.
        setAmbiguousCommand("start");
      } else {
        startCommand.clear();
      }
    } finally {
      setIsStarting(false);
    }
  }, [
    reason,
    retentionDays,
    startCommand,
    targetDatabaseServerId,
    tenantId,
    validate,
  ]);

  /** Authoritative recovery: ask Worker what actually exists for this tenant. */
  const reconcileStart = useCallback(async () => {
    setIsReconciling(true);
    try {
      const summaries = await tenantDatabaseRelocationApi.listForTenant(tenantId);
      const recovered = recoverRelocationRun(summaries);
      if (recovered) {
        // An explicit reconcile is the operator asking what actually exists, so
        // it overrides an earlier dismissal.
        dismissedRunIdRef.current = null;
        setRun(recovered);
      }
      // Either answer resolves the attempt. A recovered run is the outcome the
      // operator was missing; no run is proof the command never took effect,
      // which is just as final — and leaving the attempt on file after that is
      // what strands the next submission behind an intent mismatch.
      startCommand.clear();
      setAmbiguousCommand(null);
      setIntentMismatch(false);
      setCommandError(null);
      return recovered;
    } catch (caught) {
      setCommandError(normalizeApiError(caught));
      return null;
    } finally {
      setIsReconciling(false);
    }
  }, [startCommand, tenantId]);

  const releaseSource = useCallback(async () => {
    if (!run) return;
    setIsReleasing(true);
    setCommandError(null);
    try {
      const idempotencyKey = await releaseCommand.prepare(
        {
          action: "destroy-relocation-source",
          runId: run.runId,
          confirmTenantId: tenantId,
        },
        { kind: "RELOCATION_RUN", id: run.runId },
      );
      const next = await tenantDatabaseRelocationApi.destroySource(
        run.runId,
        { confirmTenantId: tenantId },
        idempotencyKey,
      );
      releaseCommand.clear();
      setAmbiguousCommand(null);
      setRun({ runId: run.runId, record: next });
      setReleaseConfirmOpen(false);
    } catch (caught) {
      if (caught instanceof PendingCommandIntentMismatchError) {
        setIntentMismatch(true);
        setReleaseConfirmOpen(false);
        return;
      }
      const normalized = normalizeApiError(caught);
      setCommandError(normalized);
      setReleaseConfirmOpen(false);
      if (isAmbiguousOutcome(normalized)) setAmbiguousCommand("release");
      else releaseCommand.clear();
    } finally {
      setIsReleasing(false);
    }
  }, [releaseCommand, run, tenantId]);

  /** Re-reads the ledger; the record itself says whether the source is gone. */
  const reconcileRelease = useCallback(async () => {
    if (!run) return;
    setIsReconciling(true);
    try {
      const next = await tenantDatabaseRelocationApi.get(run.runId);
      setRun({ runId: run.runId, record: next });
      if (next.sourceDestroyedAt) {
        releaseCommand.clear();
        setAmbiguousCommand(null);
        setCommandError(null);
      }
    } catch (caught) {
      setCommandError(normalizeApiError(caught));
    } finally {
      setIsReconciling(false);
    }
  }, [releaseCommand, run]);

  const startAnotherMove = useCallback(() => {
    dismissedRunIdRef.current = run?.runId ?? null;
    setRun(null);
    setCommandError(null);
    setAmbiguousCommand(null);
    setFieldErrors({});
    setTargetDatabaseServerId("");
    setReason("");
    void load();
  }, [load, run?.runId]);

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
    phase,
    run,
    record,
    isRunning: Boolean(isRunning),
    refreshGuard,

    targetDatabaseServerId,
    setTargetDatabaseServerId,
    reason,
    setReason,
    retentionDays,
    setRetentionDays,
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

    canReleaseSource:
      permissions.canReleaseSource &&
      Boolean(record) &&
      canReleaseRelocationSource(record as RelocationRecord, now),
    sourceAlreadyReleased: Boolean(record?.sourceDestroyedAt),

    refresh: load,
    startRelocation,
    reconcileStart,
    releaseSource,
    reconcileRelease,
    startAnotherMove,
  };
}

export type TenantDatabaseRelocationController = ReturnType<
  typeof useTenantDatabaseRelocation
>;
