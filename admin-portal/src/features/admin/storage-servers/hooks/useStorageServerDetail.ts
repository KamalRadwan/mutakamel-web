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
  RotateStorageCredentialsDto,
  StorageCredentialRotationView,
  StorageServerProbeResult,
  StorageServerView,
  UpdateStorageServerDto,
} from "../types";

export function useStorageServerDetail(id: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const idRef = useRef(id);
  const [server, setServer] = useState<StorageServerView | null>(null);
  const [loadedServerId, setLoadedServerId] = useState<string | null>(null);
  const [lastProbe, setLastProbe] = useState<StorageServerProbeResult | null>(null);
  const [currentRotation, setCurrentRotation] = useState<StorageCredentialRotationView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const canRead = adminCan(user, "admin.storage_servers.read");
  const canUpdate = adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_UPDATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.STORAGE_SERVERS_DELETE);

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
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await storageServersApi.get(id, controller.signal);
      if (generation !== requestGeneration.current) return;
      setServer(result);
      setLoadedServerId(id);
    } catch (caught) {
      if (generation !== requestGeneration.current || controller.signal.aborted) {
        return;
      }
      setError(normalizeApiError(caught));
      setLoadedServerId(null);
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, [canRead, id, isAuthLoading]);

  useEffect(() => {
    idRef.current = id;
    requestGeneration.current += 1;
    requestAbort.current?.abort();
    queueMicrotask(() => {
      setServer(null);
      setLoadedServerId(null);
      setLastProbe(null);
      setCurrentRotation(null);
      setError(null);
      setIsLoading(true);
    });
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      requestAbort.current?.abort();
    };
  }, [id, refresh]);

  const assertCurrentServer = useCallback(() => {
    if (loadedServerId !== id || idRef.current !== id) {
      throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
    }
  }, [id, loadedServerId]);

  const write = useCallback(
    async <Result,>(
      intent: unknown,
      action: (key: string) => Promise<Result>,
    ): Promise<Result> => {
      const key = getIdempotencyKey(intent);
      setIsMutating(true);
      try {
        const result = await action(key);
        resetKey();
        return result;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (shouldResetStorageServerWriteKey(normalized)) resetKey();
        throw normalized;
      } finally {
        setIsMutating(false);
      }
    },
    [getIdempotencyKey, resetKey],
  );

  const update = useCallback(
    async (dto: UpdateStorageServerDto) => {
      if (!canUpdate) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
      assertCurrentServer();
      const updated = await write(
        { action: "update", id, dto },
        (key) => storageServersApi.update(id, dto, key),
      );
      if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
      setServer(updated);
      return updated;
    },
    [assertCurrentServer, canUpdate, id, write],
  );

  const activate = useCallback(async () => {
    if (!canUpdate) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
    assertCurrentServer();
    const updated = await write(
      { action: "activate", id },
      (key) => storageServersApi.activate(id, key),
    );
    if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
    setServer(updated);
    return updated;
  }, [assertCurrentServer, canUpdate, id, write]);

  const probe = useCallback(async () => {
    if (!canUpdate || !server) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
    assertCurrentServer();
    const expectedConfigRevision = server.configRevision;
    const result = await write(
      { action: "probe", id, expectedConfigRevision },
      (key) =>
        storageServersApi.probe(id, { expectedConfigRevision }, key),
    );
    if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
    setLastProbe(result);
    await refresh();
    return result;
  }, [assertCurrentServer, canUpdate, id, refresh, server, write]);

  const offline = useCallback(async () => {
    if (!canUpdate) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
    assertCurrentServer();
    const updated = await write(
      { action: "offline", id },
      (key) => storageServersApi.offline(id, key),
    );
    if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
    setServer(updated);
    return updated;
  }, [assertCurrentServer, canUpdate, id, write]);

  const drain = useCallback(async () => {
    if (!canUpdate) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
    assertCurrentServer();
    const updated = await write(
      { action: "drain", id },
      (key) => storageServersApi.drain(id, key),
    );
    if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
    setServer(updated);
    return updated;
  }, [assertCurrentServer, canUpdate, id, write]);

  const rotateCredentials = useCallback(
    async (credentials: RotateStorageCredentialsDto["credentials"], graceHours?: number) => {
      if (!canUpdate || !server) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
      assertCurrentServer();
      const expectedConfigRevision = server.configRevision;
      const result = await write(
        { action: "rotateCredentials", id, expectedConfigRevision },
        (key) =>
          storageServersApi.rotateCredentials(
            id,
            { expectedConfigRevision, credentials, graceHours },
            key,
          ),
      );
      if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
      setCurrentRotation(result);
      await refresh();
      return result;
    },
    [assertCurrentServer, canUpdate, id, refresh, server, write],
  );

  const revokeCredentialRotation = useCallback(
    async (rotationId: string) => {
      if (!canUpdate) throw new Error("STORAGE_SERVER_UPDATE_FORBIDDEN");
      assertCurrentServer();
      const result = await write(
        { action: "revokeCredentialRotation", id, rotationId },
        (key) => storageServersApi.revokeCredentialRotation(id, rotationId, key),
      );
      if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
      setCurrentRotation(result);
      return result;
    },
    [assertCurrentServer, canUpdate, id, write],
  );

  const remove = useCallback(async () => {
    if (!canDelete) throw new Error("STORAGE_SERVER_DELETE_FORBIDDEN");
    assertCurrentServer();
    await write(
      { action: "delete", id },
      (key) => storageServersApi.delete(id, key),
    );
    if (idRef.current !== id) throw new Error("STORAGE_SERVER_CONTEXT_CHANGED");
  }, [assertCurrentServer, canDelete, id, write]);

  const makePlatformDefault = useCallback(
    () => update({ isPlatformDefault: true }),
    [update],
  );

  return {
    server: loadedServerId === id ? server : null,
    loadedServerId,
    lastProbe,
    currentRotation,
    isLoading,
    isMutating,
    error,
    isAuthLoading,
    canRead,
    canUpdate,
    canDelete,
    update,
    activate,
    probe,
    offline,
    drain,
    rotateCredentials,
    revokeCredentialRotation,
    remove,
    makePlatformDefault,
    refresh,
  };
}
