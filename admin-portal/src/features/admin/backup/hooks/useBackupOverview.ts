"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backupApi, backupDatabaseAccessApi } from "../api";
import type {
  BackupArtifact,
  BackupDatabaseAccessBinding,
  BackupPolicy,
  BackupRun,
  RestoreRun,
} from "../types";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import { useBackupServerOptions } from "./useBackupServerOptions";
import { isCurrentBackupServerRequest } from "./backup-server-request-guard";

interface OverviewData {
  policies: BackupPolicy[];
  runs: BackupRun[];
  artifacts: BackupArtifact[];
  restores: RestoreRun[];
}

const initialData: OverviewData = {
  policies: [],
  runs: [],
  artifacts: [],
  restores: [],
};

export function useBackupOverview() {
  const { user } = useAuth();
  const canReadDatabaseAccess = adminCan(user, "admin.database_servers.read");
  const serverContext = useBackupServerOptions(canReadDatabaseAccess);
  const [data, setData] = useState<OverviewData>(initialData);
  const [hasWorkerData, setHasWorkerData] = useState(false);
  const [accessBinding, setAccessBinding] = useState<BackupDatabaseAccessBinding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [accessError, setAccessError] = useState<NormalizedApiError | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const accessRequestGeneration = useRef(0);
  /**
   * The live selection, mirrored out of the closure.
   *
   * `refreshAccess` used to compare its captured `serverId` against
   * `serverContext.selectedServerId` from the same closure - the same value
   * twice, so the check was always true. It read like an ownership guard and
   * was not one. `refresh` awaits the worker and server-context reloads and
   * then calls the CAPTURED `refreshAccess`, so a selection change in that
   * window landed server A's readiness under server B. The sibling
   * `useBackupDatabaseAccess` has always done this with a ref.
   */
  const selectedServerIdRef = useRef(serverContext.selectedServerId);
  useEffect(() => {
    selectedServerIdRef.current = serverContext.selectedServerId;
  }, [serverContext.selectedServerId]);

  const refreshWorker = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [policies, runs, artifacts, restores] = await Promise.all([
        backupApi.listPolicies(),
        backupApi.listRuns(),
        backupApi.listArtifacts(),
        backupApi.listRestores(),
      ]);
      setData({ policies, runs, artifacts, restores });
      setHasWorkerData(true);
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshWorker(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshWorker]);

  const refreshAccess = useCallback(async () => {
    const generation = ++accessRequestGeneration.current;
    setAccessBinding(null);
    setAccessError(null);
    if (!canReadDatabaseAccess || !serverContext.selectedServerId) {
      setIsAccessLoading(false);
      return;
    }

    const serverId = serverContext.selectedServerId;
    setIsAccessLoading(true);
    try {
      const binding = await backupDatabaseAccessApi.getBinding(serverId);
      if (
        isCurrentBackupServerRequest({
          requestServerId: serverId,
          selectedServerId: selectedServerIdRef.current,
          requestGeneration: generation,
          currentGeneration: accessRequestGeneration.current,
        })
      ) {
        setAccessBinding(binding);
      }
    } catch (caught) {
      if (generation === accessRequestGeneration.current) {
        setAccessError(normalizeApiError(caught));
      }
    } finally {
      if (generation === accessRequestGeneration.current) {
        setIsAccessLoading(false);
      }
    }
  }, [canReadDatabaseAccess, serverContext.selectedServerId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshAccess(); }, 0);
    return () => {
      clearTimeout(timer);
      accessRequestGeneration.current += 1;
    };
  }, [refreshAccess]);

  const refresh = useCallback(async () => {
    await Promise.allSettled([refreshWorker(), serverContext.refresh()]);
    await refreshAccess();
  }, [refreshAccess, refreshWorker, serverContext]);

  const selectedData = useMemo(() => {
    const serverId = serverContext.selectedServerId;
    const policies = data.policies.filter((item) => item.databaseServerId === serverId);
    const runs = data.runs
      .filter((item) => item.databaseServerId === serverId)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    const restores = data.restores
      .filter((item) => item.databaseServerId === serverId)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return {
      policy: policies[0] ?? null,
      latestRun: runs[0] ?? null,
      latestRestore: restores[0] ?? null,
    };
  }, [data, serverContext.selectedServerId]);

  const metrics = useMemo(
    () => ({
      enabledPolicies: data.policies.filter((policy) => policy.enabled).length,
      activeRuns: data.runs.filter((run) => run.status === "PENDING" || run.status === "RUNNING").length,
      completedArtifacts: data.artifacts.filter((artifact) => artifact.status === "COMPLETED").length,
      verifiedRestores: data.restores.filter(
        (restore) => restore.status === "VERIFIED" || restore.status === "PROMOTED",
      ).length,
    }),
    [data],
  );

  return {
    ...serverContext,
    data,
    accessBinding,
    databaseAccessError: accessError ?? serverContext.error,
    isDatabaseAccessLoading: isAccessLoading || serverContext.isLoading,
    canReadDatabaseAccess,
    selectedData,
    metrics,
    hasWorkerData,
    isLoading,
    error,
    refresh,
  };
}
