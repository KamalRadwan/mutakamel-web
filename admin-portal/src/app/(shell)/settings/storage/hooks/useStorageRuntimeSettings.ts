"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import type { SettingsLoadState } from "../../hooks/useSettings";
import {
  readStorageRuntimeConfigEnvelope,
  type CoreStorageRuntimeSnapshot,
  type PatchStorageRuntimeConfigDto,
} from "../storage-runtime-contract";

const ENDPOINT = "/api/admin/core/v1/system-settings/storage-runtime";
const UPDATE_PERMISSIONS = [
  "admin.settings.update",
  "admin.settings.critical",
] as const;

export type StorageRuntimeMutationAction =
  | "ENABLE"
  | "DISABLE"
  | "GENERATE_KEY"
  | "ROTATE_KEY";

export interface StorageRuntimeMutationState {
  action: StorageRuntimeMutationAction | null;
  phase: "IDLE" | "PENDING" | "SUCCEEDED" | "FAILED";
  error: NormalizedApiError | null;
  localCode: string | null;
}

const EMPTY_MUTATION: StorageRuntimeMutationState = {
  action: null,
  phase: "IDLE",
  error: null,
  localCode: null,
};

export function useStorageRuntimeSettings() {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.settings.read");
  const canUpdateCritical = adminCanAll(user, UPDATE_PERMISSIONS);
  const [snapshot, setSnapshot] =
    useState<CoreStorageRuntimeSnapshot | null>(null);
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] =
    useState<StorageRuntimeMutationState>(EMPTY_MUTATION);
  const generation = useRef(0);
  const mutationIntent = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const fetchConfig = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      setSnapshot(null);
      setLoadError(null);
      setLoadState("FORBIDDEN");
      return;
    }

    setLoadState("LOADING");
    setLoadError(null);
    try {
      const response = await axiosClient.get<unknown>(ENDPOINT, {
        cache: "no-store",
      });
      if (currentGeneration !== generation.current) return;
      setSnapshot(readStorageRuntimeConfigEnvelope(response.data));
      mutationIntent.current = null;
      setMutation(EMPTY_MUTATION);
      setLoadState("READY");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const normalized = normalizeApiError(caught);
      setSnapshot(null);
      setLoadError(normalized);
      setLoadState(classifyLoadError(normalized));
    }
  }, [canRead, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void fetchConfig());
  }, [fetchConfig]);

  const mutate = useCallback(
    async (
      dto: PatchStorageRuntimeConfigDto,
      action: StorageRuntimeMutationAction,
    ) => {
      if (!snapshot || !canUpdateCritical || mutation.phase === "PENDING") {
        setMutation({
          action,
          phase: "FAILED",
          error: null,
          localCode: "STORAGE_RUNTIME_PERMISSION_OR_STATE_REQUIRED",
        });
        return false;
      }
      if (dto.enabled === true && !snapshot.data.configured) {
        setMutation({
          action,
          phase: "FAILED",
          error: null,
          localCode: "CORE.STORAGE_RUNTIME.NOT_CONFIGURED",
        });
        return false;
      }
      if (dto.enabled === true && !snapshot.data.brokerConfigured) {
        setMutation({
          action,
          phase: "FAILED",
          error: null,
          localCode: "CORE.STORAGE.RUNTIME_AUTH_NOT_CONFIGURED",
        });
        return false;
      }

      const fingerprint = JSON.stringify(dto);
      const key =
        mutationIntent.current?.fingerprint === fingerprint
          ? mutationIntent.current.key
          : generateUUIDv7();
      mutationIntent.current = { fingerprint, key };
      setMutation({ action, phase: "PENDING", error: null, localCode: null });

      try {
        const response = await axiosClient.patch<unknown>(ENDPOINT, dto, {
          headers: { "x-idempotency-key": key },
        });
        const saved = readStorageRuntimeConfigEnvelope(response.data);
        mutationIntent.current = null;
        setSnapshot(saved);
        setMutation({ action, phase: "SUCCEEDED", error: null, localCode: null });
        return true;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (!retainIntent(normalized)) mutationIntent.current = null;
        setMutation({
          action,
          phase: "FAILED",
          error: normalized,
          localCode: null,
        });
        return false;
      }
    },
    [canUpdateCritical, mutation.phase, snapshot],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (snapshot?.data.enabled === enabled) {
        setMutation({
          action: enabled ? "ENABLE" : "DISABLE",
          phase: "FAILED",
          error: null,
          localCode: "NO_STORAGE_RUNTIME_CHANGE",
        });
        return false;
      }
      return mutate({ enabled }, enabled ? "ENABLE" : "DISABLE");
    },
    [mutate, snapshot],
  );

  const rotateKey = useCallback(
    () =>
      mutate(
        { rotateKey: true },
        snapshot?.data.configured ? "ROTATE_KEY" : "GENERATE_KEY",
      ),
    [mutate, snapshot?.data.configured],
  );

  return {
    lang,
    snapshot,
    loadState,
    loadError,
    mutation,
    canUpdateCritical,
    setEnabled,
    rotateKey,
    refetch: fetchConfig,
  };
}

function classifyLoadError(error: NormalizedApiError): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function retainIntent(error: NormalizedApiError): boolean {
  return (
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}
