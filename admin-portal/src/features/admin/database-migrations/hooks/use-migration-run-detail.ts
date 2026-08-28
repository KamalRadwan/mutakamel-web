"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { databaseMigrationsApi } from "../api/database-migrations.api";
import {
  classifyMigrationMutationError,
  classifyMigrationReadError,
} from "../model/migration-errors";
import { readMigrationPermissions } from "../model/migration-permissions";
import { readRunControlAvailability } from "../model/migration-outcomes";
import type {
  MigrationMutationName,
  MigrationMutationState,
  MigrationRun,
  MigrationTenantOutcome,
  MigrationTenantResult,
  Paginated,
  ResourceState,
} from "../types/database-migrations";

const OUTCOME_PAGE_SIZE = 50;

const CONTROL_ACTIONS: Record<
  Exclude<MigrationMutationName, "START">,
  "pause" | "resume" | "abort" | "retry-failed"
> = {
  PAUSE: "pause",
  RESUME: "resume",
  ABORT: "abort",
  RETRY_FAILED: "retry-failed",
};

export function useMigrationRunDetail(runId: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readMigrationPermissions(user), [user]);

  const [run, setRun] = useState<MigrationRun | null>(null);
  const [outcomes, setOutcomes] =
    useState<Paginated<MigrationTenantResult> | null>(null);
  const [outcomesError, setOutcomesError] =
    useState<NormalizedApiError | null>(null);
  const [state, setState] = useState<ResourceState>("LOADING");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<MigrationMutationState>({
    name: null,
    phase: "IDLE",
    error: null,
  });
  const [outcomeFilter, setOutcomeFilter] = useState<
    MigrationTenantOutcome | ""
  >("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const generation = useRef(0);
  const hasSnapshot = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== generation.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });

    // Per-tenant outcomes come from a separate projection table; the run's own
    // rolled-up counters remain readable when that read fails.
    const tenantOutcomes = databaseMigrationsApi
      .listRunTenants(
        runId,
        {
          outcome: outcomeFilter || undefined,
          page,
          limit: OUTCOME_PAGE_SIZE,
        },
        controller.signal,
      )
      .then(
        (data) => ({ ok: true as const, data }),
        (caught: unknown) => ({ ok: false as const, caught }),
      );

    void databaseMigrationsApi
      .getRun(runId, controller.signal)
      .then(async (nextRun) => {
        if (controller.signal.aborted || current !== generation.current) return;
        hasSnapshot.current = true;
        setRun(nextRun);
        setState("READY");

        const outcome = await tenantOutcomes;
        if (controller.signal.aborted || current !== generation.current) return;
        if (outcome.ok) {
          setOutcomes(outcome.data);
          setOutcomesError(null);
          return;
        }
        setOutcomes(null);
        if (!isAbortError(outcome.caught)) {
          setOutcomesError(normalizeApiError(outcome.caught));
        }
      })
      .catch((caught: unknown) => {
        if (
          controller.signal.aborted ||
          current !== generation.current ||
          isAbortError(caught)
        ) {
          return;
        }
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setRun(null);
        setOutcomes(null);
        setError(normalized);
        setState(classifyMigrationReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) {
          setIsRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [isAuthLoading, outcomeFilter, page, permissions.canRead, revision, runId]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const control = useCallback(
    async (
      name: Exclude<MigrationMutationName, "START">,
      reason: string,
    ): Promise<MigrationRun | null> => {
      const destructive = name === "ABORT";
      const allowed = destructive
        ? permissions.canDestroy
        : permissions.canExecute;
      if (!allowed) return null;

      setMutation({ name, phase: "PENDING", error: null });
      try {
        const updated = await databaseMigrationsApi.control(
          CONTROL_ACTIONS[name],
          { runId, reason },
        );
        setMutation({ name, phase: "SUCCEEDED", error: null });
        setRevision((value) => value + 1);
        return updated;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        setMutation({
          name,
          phase: classifyMigrationMutationError(caught, normalized),
          error: normalized,
        });
        return null;
      }
    },
    [permissions.canDestroy, permissions.canExecute, runId],
  );

  const visibleState: ResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;
  const visibleRun = visibleState === "READY" ? run : null;
  const availability = visibleRun
    ? readRunControlAvailability(visibleRun)
    : { canPause: false, canResume: false, canAbort: false, canRetryFailed: false };

  return {
    permissions,
    state: visibleState,
    run: visibleRun,
    outcomes: visibleState === "READY" ? outcomes : null,
    outcomesError: visibleState === "READY" ? outcomesError : null,
    availability,
    error,
    mutation,
    isRefreshing,
    outcomeFilter,
    setOutcomeFilter: (value: MigrationTenantOutcome | "") => {
      setOutcomeFilter(value);
      setPage(1);
    },
    page,
    setPage,
    pageSize: OUTCOME_PAGE_SIZE,
    refresh,
    control,
    resetMutation: () =>
      setMutation({ name: null, phase: "IDLE", error: null }),
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "AbortError")
  );
}
