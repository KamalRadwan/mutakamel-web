"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backupDatabaseAccessApi } from "../api";
import type { BackupDatabaseServerOption } from "../types";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { resolveBackupServerSelection } from "./backup-server-request-guard";

export function useBackupServerOptions(enabled = true) {
  const searchParams = useSearchParams();
  const requestedServerId = searchParams.get("databaseServerId") ?? "";
  const [servers, setServers] = useState<BackupDatabaseServerOption[]>([]);
  const [selectedServerId, setSelectedServerId] = useState(requestedServerId);
  const [resolvedRequestedServerId, setResolvedRequestedServerId] = useState(requestedServerId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestGenerationRef = useRef(0);
  const requestedServerIdRef = useRef(requestedServerId);
  requestedServerIdRef.current = requestedServerId;

  const refresh = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current;
    const isCurrentRequest = () =>
      requestGeneration === requestGenerationRef.current &&
      requestedServerId === requestedServerIdRef.current;
    if (!enabled) {
      setServers([]);
      setSelectedServerId("");
      setResolvedRequestedServerId(requestedServerId);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const options = await backupDatabaseAccessApi.listServers();
      if (!isCurrentRequest()) return;
      setServers(options);
      setSelectedServerId((current) =>
        resolveBackupServerSelection(
          options.map((server) => server.id),
          requestedServerId,
          current,
        ),
      );
      setResolvedRequestedServerId(requestedServerId);
    } catch (caught) {
      if (!isCurrentRequest()) return;
      setError(normalizeApiError(caught));
      setServers([]);
      setSelectedServerId("");
      setResolvedRequestedServerId(requestedServerId);
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  }, [enabled, requestedServerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const routeSelectionPending = resolvedRequestedServerId !== requestedServerId;
  const effectiveSelectedServerId = routeSelectionPending ? "" : selectedServerId;

  return {
    servers,
    selectedServerId: effectiveSelectedServerId,
    setSelectedServerId,
    selectedServer: servers.find((server) => server.id === effectiveSelectedServerId) ?? null,
    isLoading: isLoading || routeSelectionPending,
    error,
    refresh,
  };
}
