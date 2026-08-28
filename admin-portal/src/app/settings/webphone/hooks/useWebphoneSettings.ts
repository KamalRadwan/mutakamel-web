"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import { adminCan } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import type { SettingsLoadState } from "../../hooks/useSettings";
import {
  buildConfigPatch,
  configToForm,
  readWebphoneConfig,
  readWebphoneExtensions,
  readWebphoneFleetSeats,
  validateConfigForm,
  type CreateWebphoneEndpointDto,
  type CreateWebphoneExtensionDto,
  type CreateWebphoneIceServerDto,
  type UpdateWebphoneEndpointDto,
  type UpdateWebphoneExtensionDto,
  type UpdateWebphoneIceServerDto,
  type WebphoneConfig,
  type WebphoneConfigForm,
  type WebphoneExtension,
  type WebphoneFieldErrors,
  type WebphoneFleetSeatRow,
} from "../webphone-contract";

const BASE_PATH = "/api/admin/webphone/v1";
const CONFIG_ENDPOINT = `${BASE_PATH}/config`;
const EXTENSIONS_ENDPOINT = `${BASE_PATH}/extensions`;
const FLEET_SEATS_ENDPOINT = `${BASE_PATH}/fleet/seats?page=1&limit=25`;

/**
 * Identifies which control a mutation belongs to, so its failure renders next
 * to that control instead of as one page-level banner.
 */
export type WebphoneMutationTarget =
  | "config"
  | "endpoint:new"
  | "ice:new"
  | "extension:new"
  | `endpoint:${string}`
  | `ice:${string}`
  | `extension:${string}`;

export interface WebphoneMutationState {
  target: WebphoneMutationTarget | null;
  phase: "IDLE" | "PENDING" | "SUCCEEDED" | "FAILED";
  errorCode: string | null;
  details: Record<string, string[]> | null;
  correlationId: string | null;
}

const IDLE_MUTATION: WebphoneMutationState = {
  target: null,
  phase: "IDLE",
  errorCode: null,
  details: null,
  correlationId: null,
};

export function useWebphoneSettings() {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.webphone.read");
  const canUpdate = adminCan(user, "admin.webphone.update");

  const [config, setConfig] = useState<WebphoneConfig | null>(null);
  const [form, setForm] = useState<WebphoneConfigForm | null>(null);
  const [extensions, setExtensions] = useState<WebphoneExtension[]>([]);
  const [fleetSeats, setFleetSeats] = useState<WebphoneFleetSeatRow[]>([]);
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<WebphoneMutationState>(IDLE_MUTATION);

  const generation = useRef(0);
  // One key per user intent: reused only while the previous attempt's outcome
  // is still unknown, so a retry reconciles rather than duplicates.
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);

  const applyConfig = useCallback((next: WebphoneConfig) => {
    setConfig(next);
    setForm(configToForm(next));
  }, []);

  const fetchAll = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      setConfig(null);
      setForm(null);
      setExtensions([]);
      setFleetSeats([]);
      setLoadError(null);
      setLoadState("FORBIDDEN");
      return;
    }

    setLoadState("LOADING");
    setLoadError(null);
    try {
      // The configuration is the screen; the extension list and the fleet seat
      // view are additions to it. Fleet seats in particular opens a database
      // per tenant, so it is the read most likely to be slow or unavailable —
      // losing it must narrow the screen, not replace it with an error.
      const [configResponse, extensionsResult, seatsResult] = await Promise.all([
        axiosClient.get<unknown>(CONFIG_ENDPOINT, { cache: "no-store" }),
        settle(axiosClient.get<unknown>(EXTENSIONS_ENDPOINT, { cache: "no-store" })),
        settle(axiosClient.get<unknown>(FLEET_SEATS_ENDPOINT, { cache: "no-store" })),
      ]);
      if (currentGeneration !== generation.current) return;

      applyConfig(readWebphoneConfig(unwrapCoreData(configResponse.data)));
      setExtensions(readOrDefault(extensionsResult, readWebphoneExtensions, []));
      setFleetSeats(readOrDefault(seatsResult, readWebphoneFleetSeats, []));
      intent.current = null;
      setMutation(IDLE_MUTATION);
      setLoadState("READY");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const normalized = normalizeApiError(caught);
      setConfig(null);
      setForm(null);
      setExtensions([]);
      setFleetSeats([]);
      setLoadError(normalized);
      setLoadState(classifyLoadError(normalized));
    }
  }, [applyConfig, canRead, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void fetchAll());
  }, [fetchAll]);

  const fieldErrors: WebphoneFieldErrors = useMemo(
    () => (form ? validateConfigForm(form) : {}),
    [form],
  );

  const configPatch = useMemo(
    () => (config && form ? buildConfigPatch(config, form) : {}),
    [config, form],
  );
  const hasUnsavedChanges = Object.keys(configPatch).length > 0;

  const updateField = useCallback(
    <K extends keyof WebphoneConfigForm>(
      field: K,
      value: WebphoneConfigForm[K],
    ) => {
      setForm((current) =>
        current ? { ...current, [field]: value } : current,
      );
    },
    [],
  );

  const failLocally = useCallback(
    (target: WebphoneMutationTarget, errorCode: string) => {
      setMutation({
        target,
        phase: "FAILED",
        errorCode,
        details: null,
        correlationId: null,
      });
      return false;
    },
    [],
  );

  /**
   * Runs one write and refreshes from the authoritative response.
   *
   * Every write returns the server's own view, so the screen never shows a
   * value the server did not confirm.
   */
  const runMutation = useCallback(
    async (
      target: WebphoneMutationTarget,
      body: unknown,
      send: (idempotencyKey: string) => Promise<void>,
    ): Promise<boolean> => {
      if (!canUpdate) {
        return failLocally(target, "WEBPHONE_UPDATE_PERMISSION_REQUIRED");
      }
      if (mutation.phase === "PENDING") return false;

      const fingerprint = `${target}:${JSON.stringify(body ?? null)}`;
      const key =
        intent.current?.fingerprint === fingerprint
          ? intent.current.key
          : generateUUIDv7();
      intent.current = { fingerprint, key };
      setMutation({
        target,
        phase: "PENDING",
        errorCode: null,
        details: null,
        correlationId: null,
      });

      try {
        await send(key);
        intent.current = null;
        setMutation({
          target,
          phase: "SUCCEEDED",
          errorCode: null,
          details: null,
          correlationId: null,
        });
        return true;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (shouldRotateWriteCommandKey(normalized)) intent.current = null;
        setMutation({
          target,
          phase: "FAILED",
          errorCode: normalized.errorCode,
          details: normalized.details ?? null,
          correlationId: normalized.correlationId ?? null,
        });
        return false;
      }
    },
    [canUpdate, failLocally, mutation.phase],
  );

  const reloadConfig = useCallback(async () => {
    const response = await axiosClient.get<unknown>(CONFIG_ENDPOINT, {
      cache: "no-store",
    });
    applyConfig(readWebphoneConfig(unwrapCoreData(response.data)));
  }, [applyConfig]);

  /**
   * Refreshes the extension list after a write. Tolerant on purpose: the write
   * already succeeded, so a failed follow-up read must not be reported as a
   * failed write.
   */
  const reloadExtensions = useCallback(async () => {
    const result = await settle(
      axiosClient.get<unknown>(EXTENSIONS_ENDPOINT, { cache: "no-store" }),
    );
    setExtensions((current) =>
      readOrDefault(result, readWebphoneExtensions, current),
    );
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config || !form) return false;
    if (Object.keys(validateConfigForm(form)).length > 0) {
      return failLocally("config", "WEBPHONE_VALIDATION_FAILED");
    }
    const patch = buildConfigPatch(config, form);
    if (Object.keys(patch).length === 0) {
      return failLocally("config", "NO_WEBPHONE_CHANGES");
    }
    return runMutation("config", patch, async (key) => {
      const response = await axiosClient.patch<unknown>(CONFIG_ENDPOINT, patch, {
        headers: { "x-idempotency-key": key },
      });
      applyConfig(readWebphoneConfig(unwrapCoreData(response.data)));
    });
  }, [applyConfig, config, failLocally, form, runMutation]);

  const createEndpoint = useCallback(
    (dto: CreateWebphoneEndpointDto) =>
      runMutation("endpoint:new", dto, async (key) => {
        await axiosClient.post<unknown>(`${CONFIG_ENDPOINT}/endpoints`, dto, {
          headers: { "x-idempotency-key": key },
        });
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const updateEndpoint = useCallback(
    (id: string, dto: UpdateWebphoneEndpointDto) =>
      runMutation(`endpoint:${id}`, dto, async (key) => {
        await axiosClient.patch<unknown>(
          `${CONFIG_ENDPOINT}/endpoints/${encodeURIComponent(id)}`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const deleteEndpoint = useCallback(
    (id: string) =>
      runMutation(`endpoint:${id}`, { delete: id }, async (key) => {
        await axiosClient.delete<unknown>(
          `${CONFIG_ENDPOINT}/endpoints/${encodeURIComponent(id)}`,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const createIceServer = useCallback(
    (dto: CreateWebphoneIceServerDto) =>
      runMutation("ice:new", redactCredential(dto), async (key) => {
        await axiosClient.post<unknown>(`${CONFIG_ENDPOINT}/ice-servers`, dto, {
          headers: { "x-idempotency-key": key },
        });
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const updateIceServer = useCallback(
    (id: string, dto: UpdateWebphoneIceServerDto) =>
      runMutation(`ice:${id}`, redactCredential(dto), async (key) => {
        await axiosClient.patch<unknown>(
          `${CONFIG_ENDPOINT}/ice-servers/${encodeURIComponent(id)}`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const deleteIceServer = useCallback(
    (id: string) =>
      runMutation(`ice:${id}`, { delete: id }, async (key) => {
        await axiosClient.delete<unknown>(
          `${CONFIG_ENDPOINT}/ice-servers/${encodeURIComponent(id)}`,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadConfig();
      }),
    [reloadConfig, runMutation],
  );

  const createExtension = useCallback(
    (dto: CreateWebphoneExtensionDto) =>
      runMutation("extension:new", redactPassword(dto), async (key) => {
        await axiosClient.post<unknown>(EXTENSIONS_ENDPOINT, dto, {
          headers: { "x-idempotency-key": key },
        });
        await reloadExtensions();
      }),
    [reloadExtensions, runMutation],
  );

  const updateExtension = useCallback(
    (id: string, dto: UpdateWebphoneExtensionDto) =>
      runMutation(`extension:${id}`, redactPassword(dto), async (key) => {
        await axiosClient.patch<unknown>(
          `${EXTENSIONS_ENDPOINT}/${encodeURIComponent(id)}`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadExtensions();
      }),
    [reloadExtensions, runMutation],
  );

  const deleteExtension = useCallback(
    (id: string) =>
      runMutation(`extension:${id}`, { delete: id }, async (key) => {
        await axiosClient.delete<unknown>(
          `${EXTENSIONS_ENDPOINT}/${encodeURIComponent(id)}`,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadExtensions();
      }),
    [reloadExtensions, runMutation],
  );

  return {
    lang,
    loadState,
    loadError,
    refetch: fetchAll,
    canUpdate,
    config,
    form,
    fieldErrors,
    hasUnsavedChanges,
    updateField,
    saveConfig,
    endpoints: config?.endpoints ?? [],
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    iceServers: config?.iceServers ?? [],
    createIceServer,
    updateIceServer,
    deleteIceServer,
    extensions,
    createExtension,
    updateExtension,
    deleteExtension,
    fleetSeats,
    mutation,
  };
}

export type WebphoneSettingsState = ReturnType<typeof useWebphoneSettings>;

function classifyLoadError(error: NormalizedApiError): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason }),
  );
}

/**
 * Reads one secondary resource, keeping `fallback` when it was refused or came
 * back in a shape the contract rejects.
 */
function readOrDefault<T>(
  result: PromiseSettledResult<{ data: unknown }>,
  parse: (payload: unknown) => T,
  fallback: T,
): T {
  if (result.status !== "fulfilled") return fallback;
  try {
    return parse(unwrapCoreData(result.value.data));
  } catch {
    return fallback;
  }
}

/**
 * The idempotency fingerprint is derived from the request body, so secrets are
 * stripped before it is built. A SIP password or TURN credential must not sit
 * in component state one moment longer than the request that carries it.
 */
function redactCredential(dto: { credential?: string | null }): unknown {
  const { credential, ...rest } = dto;
  return { ...rest, credential: credential ? "[set]" : credential };
}

function redactPassword(dto: { sipPassword?: string | null }): unknown {
  const { sipPassword, ...rest } = dto;
  return { ...rest, sipPassword: sipPassword ? "[set]" : sipPassword };
}
