"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { tenantStorageMigrationApi } from "./api";
import { isStorageMigrationSettled } from "./types";
import type { TenantStorageMigrationView } from "./types";

const POLL_INTERVAL_MS = 5_000;

/**
 * Looks up a tenant storage migration by id and polls while it is
 * in-flight. There is no "list migrations for this tenant" endpoint, so the
 * caller supplies the id (e.g. from a support ticket or a prior response) —
 * see `components/tenant-storage-migration-panel.tsx`.
 */
export function useTenantStorageMigration() {
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migration, setMigration] = useState<TenantStorageMigrationView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const pollTimer = useRef<number | null>(null);
  // Holds the latest fetchOnce so the scheduled poll below can call it
  // without closing over the useCallback binding before it's declared.
  const fetchOnceRef = useRef<((id: string) => Promise<void>) | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async (id: string) => {
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const result = await tenantStorageMigrationApi.get(id, controller.signal);
      if (generation !== requestGeneration.current) return;
      setMigration(result);
      // A committed migration holding its retained source has stopped
      // changing even though its status is not terminal. Polling it would
      // wait forever for a status that only an operator's confirmed deletion
      // can produce.
      if (!isStorageMigrationSettled(result)) {
        pollTimer.current = window.setTimeout(() => void fetchOnceRef.current?.(id), POLL_INTERVAL_MS);
      }
    } catch (caught) {
      if (generation !== requestGeneration.current || controller.signal.aborted) return;
      setError(normalizeApiError(caught));
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, []);
  // Ref writes must happen after render, not during it — this runs after
  // every commit (no deps) to keep the ref current for the setTimeout
  // callback above, which can't reference `fetchOnce` directly before its
  // own declaration completes.
  useEffect(() => {
    fetchOnceRef.current = fetchOnce;
  });

  const lookup = useCallback(
    (id: string) => {
      clearPoll();
      setMigrationId(id);
      setMigration(null);
      void fetchOnce(id);
    },
    [clearPoll, fetchOnce],
  );

  const clear = useCallback(() => {
    clearPoll();
    requestGeneration.current += 1;
    requestAbort.current?.abort();
    setMigrationId(null);
    setMigration(null);
    setError(null);
  }, [clearPoll]);

  useEffect(() => {
    return () => {
      clearPoll();
      requestAbort.current?.abort();
    };
  }, [clearPoll]);

  return { migrationId, migration, isLoading, error, lookup, clear };
}
