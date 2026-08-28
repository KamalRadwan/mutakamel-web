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
import type {
  FleetStatus,
  MigrationMutationState,
  MigrationRun,
  Paginated,
  ResourceState,
  StartMigrationRunDto,
  TenantSchemaVersion,
  TenantSchemaVersionState,
} from "../types/database-migrations";

const TENANT_PAGE_SIZE = 25;

export interface MigrationsOverviewFilters {
  applicationKey: string;
  state: TenantSchemaVersionState | "";
  page: number;
}

export function useMigrationsOverview() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readMigrationPermissions(user), [user]);

  const [runs, setRuns] = useState<MigrationRun[] | null>(null);
  const [fleet, setFleet] = useState<FleetStatus[] | null>(null);
  const [tenants, setTenants] = useState<Paginated<TenantSchemaVersion> | null>(
    null,
  );
  const [state, setState] = useState<ResourceState>("LOADING");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  /**
   * The projection is a cache. Losing it hides fleet counts and per-tenant
   * versions, and must never take the run history or the run controls with it.
   */
  const [projectionError, setProjectionError] =
    useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<MigrationMutationState>({
    name: null,
    phase: "IDLE",
    error: null,
  });
  const [applicationKey, setApplicationKey] = useState("");
  const [schemaState, setSchemaState] = useState<TenantSchemaVersionState | "">(
    "",
  );
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

    const projection = Promise.all([
      databaseMigrationsApi.getFleet(
        applicationKey || undefined,
        controller.signal,
      ),
      databaseMigrationsApi.listTenants(
        {
          applicationKey: applicationKey || undefined,
          state: schemaState,
          page,
          limit: TENANT_PAGE_SIZE,
        },
        controller.signal,
      ),
    ]).then(
      ([fleetRows, tenantPage]) => ({
        ok: true as const,
        fleetRows,
        tenantPage,
      }),
      (caught: unknown) => ({ ok: false as const, caught }),
    );

    void databaseMigrationsApi
      .listRuns({}, controller.signal)
      .then(async (nextRuns) => {
        if (controller.signal.aborted || current !== generation.current) return;
        hasSnapshot.current = true;
        setRuns(nextRuns);

        const outcome = await projection;
        if (controller.signal.aborted || current !== generation.current) return;
        if (outcome.ok) {
          setFleet(outcome.fleetRows);
          setTenants(outcome.tenantPage);
          setProjectionError(null);
          setState(
            nextRuns.length || outcome.fleetRows.length ? "READY" : "EMPTY",
          );
          return;
        }

        const normalized = normalizeApiError(outcome.caught);
        setFleet(null);
        setTenants(null);
        if (isAbortError(outcome.caught)) return;
        // A projection failure degrades the fleet panel only; the run surface
        // below it is still authoritative and still operable.
        setProjectionError(normalized);
        setState(nextRuns.length ? "READY" : "EMPTY");
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
        setRuns(null);
        setFleet(null);
        setTenants(null);
        setError(normalized);
        setState(classifyMigrationReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) {
          setIsRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [
    applicationKey,
    isAuthLoading,
    page,
    permissions.canRead,
    revision,
    schemaState,
  ]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const startRun = useCallback(
    async (dto: StartMigrationRunDto): Promise<MigrationRun | null> => {
      if (!permissions.canExecute) return null;
      setMutation({ name: "START", phase: "PENDING", error: null });
      try {
        const run = await databaseMigrationsApi.startRun(dto);
        setMutation({ name: "START", phase: "SUCCEEDED", error: null });
        setRevision((value) => value + 1);
        return run;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        setMutation({
          name: "START",
          phase: classifyMigrationMutationError(caught, normalized),
          error: normalized,
        });
        return null;
      }
    },
    [permissions.canExecute],
  );

  const visibleState: ResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;
  const isReady = visibleState === "READY" || visibleState === "EMPTY";

  return {
    permissions,
    state: visibleState,
    runs: isReady ? (runs ?? []) : [],
    fleet: isReady ? fleet : null,
    tenants: isReady ? tenants : null,
    projectionError: isReady ? projectionError : null,
    error,
    mutation,
    isRefreshing,
    applicationKey,
    setApplicationKey: (value: string) => {
      setApplicationKey(value);
      setPage(1);
    },
    schemaState,
    setSchemaState: (value: TenantSchemaVersionState | "") => {
      setSchemaState(value);
      setPage(1);
    },
    page,
    setPage,
    pageSize: TENANT_PAGE_SIZE,
    refresh,
    startRun,
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
