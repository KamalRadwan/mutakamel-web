"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { storageServersApi } from "../api/storage-servers.api";
import { shouldResetStorageServerWriteKey } from "../lib/storage-server-contract";
import type {
  CreateStorageServerDto,
  StorageServerSortField,
  StorageServerStatus,
  StorageServerView,
} from "../types";

export function useStorageServers() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const [servers, setServers] = useState<StorageServerView[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StorageServerStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<StorageServerSortField>("name");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const canRead = adminCan(user, "admin.storage_servers.read");
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_CREATE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [status, sortBy, sortDir]);

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }
    if (!canRead) {
      setServers([]);
      setTotal(0);
      setTotalPages(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await storageServersApi.list(
        {
          page,
          limit,
          search: debouncedSearch || undefined,
          status: status === "ALL" ? undefined : status,
          sortBy,
          sortDir,
        },
        controller.signal,
      );
      if (generation !== requestGeneration.current) return;
      setServers(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      if (result.totalPages === 0 && page !== 1) {
        setPage(1);
      } else if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
      }
    } catch (caught) {
      if (generation !== requestGeneration.current || controller.signal.aborted) {
        return;
      }
      setError(normalizeApiError(caught));
      setServers([]);
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, [canRead, debouncedSearch, isAuthLoading, limit, page, sortBy, sortDir, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      requestAbort.current?.abort();
    };
  }, [refresh]);

  const createServer = useCallback(
    async (dto: CreateStorageServerDto) => {
      if (!canCreate) throw new Error("STORAGE_SERVER_CREATE_FORBIDDEN");
      const key = getIdempotencyKey({ action: "create", dto });
      try {
        const created = await storageServersApi.create(dto, key);
        resetKey();
        await refresh();
        return created;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (shouldResetStorageServerWriteKey(normalized)) resetKey();
        throw normalized;
      }
    },
    [canCreate, getIdempotencyKey, refresh, resetKey],
  );

  return {
    servers,
    page,
    setPage,
    limit,
    search,
    setSearch,
    status,
    setStatus,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    total,
    totalPages,
    isLoading,
    error,
    isAuthLoading,
    canRead,
    canCreate,
    createServer,
    refresh,
  };
}
