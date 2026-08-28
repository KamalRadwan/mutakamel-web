"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, unwrapCoreData } from "@/lib/api/axiosClient";
import { getAuthErrorCode, getAuthErrorStatus } from "@/lib/auth/sessionErrors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  buildConfigPatch,
  configToForm,
  EMPTY_CONFIG_FORM,
  readWebphoneConfig,
  readWebphoneExtensions,
  readWebphoneSeats,
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
  type WebphoneSeats,
} from "../webphone-contract";

const BASE_PATH = "/api/tenant/webphone/v1";
const CONFIG_ENDPOINT = `${BASE_PATH}/config`;
const EXTENSIONS_ENDPOINT = `${BASE_PATH}/extensions`;
const SEATS_ENDPOINT = `${BASE_PATH}/seats`;

/**
 * Why the screen is or is not usable.
 *
 * The three unavailable values are kept apart on purpose: "you did not buy
 * this", "your system is still being set up", and "your subscription is
 * suspended" are three different conversations with a customer, and the API
 * returns them as three distinct outcomes.
 */
export type WebphoneEntitlement =
  | "ACTIVE"
  | "NOT_PURCHASED"
  | "PROVISIONING_PENDING"
  | "SUSPENDED";

export type WebphoneLoadState = "LOADING" | "READY" | "FORBIDDEN" | "ERROR";

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
}

const IDLE_MUTATION: WebphoneMutationState = {
  target: null,
  phase: "IDLE",
  errorCode: null,
  details: null,
};

const SETTINGS_READ = "webphone.settings.read";
const SETTINGS_UPDATE = "webphone.settings.update";
const EXTENSIONS_MANAGE = "webphone.extensions.manage";

export function useTenantWebphoneSettings() {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useTenantAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const canRead = permissions.includes(SETTINGS_READ);
  const hasSettingsUpdate = permissions.includes(SETTINGS_UPDATE);
  const hasExtensionsManage = permissions.includes(EXTENSIONS_MANAGE);

  const [entitlement, setEntitlement] = useState<WebphoneEntitlement>("ACTIVE");
  const [config, setConfig] = useState<WebphoneConfig | null>(null);
  const [form, setForm] = useState<WebphoneConfigForm | null>(null);
  const [extensions, setExtensions] = useState<WebphoneExtension[]>([]);
  const [seats, setSeats] = useState<WebphoneSeats | null>(null);
  const [loadState, setLoadState] = useState<WebphoneLoadState>("LOADING");
  const [mutation, setMutation] = useState<WebphoneMutationState>(IDLE_MUTATION);

  const generation = useRef(0);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);

  const applyConfig = useCallback((next: WebphoneConfig) => {
    setConfig(next);
    setForm(configToForm(next));
  }, []);

  const clearData = useCallback(() => {
    setConfig(null);
    setForm(null);
    setExtensions([]);
    setSeats(null);
  }, []);

  /**
   * Loads the screen.
   *
   * A 403/409 carrying a WebPhone entitlement code is an EXPECTED outcome, not
   * a failure: the screen is rendered for unsubscribed workspaces so the
   * capability stays discoverable, which means it issues a read the server is
   * meant to refuse. That refusal becomes the disabled state — never an error
   * banner and never an error boundary.
   */
  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      clearData();
      setLoadState("FORBIDDEN");
      return;
    }

    setLoadState("LOADING");
    try {
      const response = await axiosClient.get<unknown>(CONFIG_ENDPOINT, {
        cache: "no-store",
      });
      if (currentGeneration !== generation.current) return;
      applyConfig(readWebphoneConfig(unwrapCoreData(response.data)));
      setEntitlement("ACTIVE");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const blocked = entitlementFromError(caught);
      clearData();
      setEntitlement(blocked ?? "ACTIVE");
      // An unavailable module still gets the whole form, inert and empty, so
      // the capability is visible rather than hidden. `config` stays null, so
      // nothing here can be mistaken for something the server returned.
      if (blocked) setForm(EMPTY_CONFIG_FORM);
      setLoadState(blocked ? "READY" : classifyLoadError(caught));
      intent.current = null;
      setMutation(IDLE_MUTATION);
      return;
    }

    const [extensionsResult, seatsResult] = await Promise.allSettled([
      axiosClient.get<unknown>(EXTENSIONS_ENDPOINT, { cache: "no-store" }),
      axiosClient.get<unknown>(SEATS_ENDPOINT, { cache: "no-store" }),
    ]);
    if (currentGeneration !== generation.current) return;

    // Extensions and seats sit behind their own permissions. A caller who may
    // read the configuration but not the extension list still gets a working
    // screen rather than a failed one.
    setExtensions(
      readOrDefault(extensionsResult, readWebphoneExtensions, []),
    );
    setSeats(readOrDefault(seatsResult, readWebphoneSeats, null));
    intent.current = null;
    setMutation(IDLE_MUTATION);
    setLoadState("READY");
  }, [applyConfig, canRead, clearData, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const isSubscribed = entitlement === "ACTIVE";
  const canUpdateConfig = isSubscribed && hasSettingsUpdate;
  const canManageExtensions = isSubscribed && hasExtensionsManage;

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
      setForm((current) => (current ? { ...current, [field]: value } : current));
    },
    [],
  );

  const failLocally = useCallback(
    (target: WebphoneMutationTarget, errorCode: string) => {
      setMutation({ target, phase: "FAILED", errorCode, details: null });
      return false;
    },
    [],
  );

  /**
   * Runs one write, but only when the module is actually usable.
   *
   * The disabled state is presentation, and the server enforces every rule
   * anyway — but a screen that fires writes it knows will be refused turns an
   * unsubscribed workspace into a stream of 403s in the logs, so nothing is
   * attempted here.
   */
  const runMutation = useCallback(
    async (
      target: WebphoneMutationTarget,
      allowed: boolean,
      permissionCode: string,
      body: unknown,
      send: (idempotencyKey: string) => Promise<void>,
    ): Promise<boolean> => {
      if (!isSubscribed) {
        return failLocally(target, "WEBPHONE_MODULE_UNAVAILABLE");
      }
      if (!allowed) return failLocally(target, permissionCode);
      if (mutation.phase === "PENDING") return false;

      const fingerprint = `${target}:${JSON.stringify(body ?? null)}`;
      const key =
        intent.current?.fingerprint === fingerprint
          ? intent.current.key
          : generateUUIDv7();
      intent.current = { fingerprint, key };
      setMutation({ target, phase: "PENDING", errorCode: null, details: null });

      try {
        await send(key);
        intent.current = null;
        setMutation({
          target,
          phase: "SUCCEEDED",
          errorCode: null,
          details: null,
        });
        return true;
      } catch (caught) {
        const status = getAuthErrorStatus(caught);
        const code = getAuthErrorCode(caught) ?? "UNKNOWN_ERROR";
        // A definitive client rejection completes this command identity; an
        // ambiguous outcome keeps the key so a retry reconciles.
        if (status !== undefined && status >= 400 && status < 500) {
          intent.current = null;
        }
        // Reads survive a suspended subscription while writes do not, so a
        // suspension is often discovered here rather than at load.
        const blocked = entitlementFromError(caught);
        if (blocked) setEntitlement(blocked);
        setMutation({
          target,
          phase: "FAILED",
          errorCode: code,
          details: errorDetails(caught),
        });
        return false;
      }
    },
    [failLocally, isSubscribed, mutation.phase],
  );

  const reloadConfig = useCallback(async () => {
    const response = await axiosClient.get<unknown>(CONFIG_ENDPOINT, {
      cache: "no-store",
    });
    applyConfig(readWebphoneConfig(unwrapCoreData(response.data)));
  }, [applyConfig]);

  /**
   * Refreshes the extension list and the seat counter after a write.
   *
   * Deliberately tolerant: the write already succeeded, so a refusal or a
   * malformed payload on the follow-up read must not be reported as a failed
   * write. The previous values stay on screen until the next successful read.
   */
  const reloadExtensions = useCallback(async () => {
    const [extensionsResult, seatsResult] = await Promise.allSettled([
      axiosClient.get<unknown>(EXTENSIONS_ENDPOINT, { cache: "no-store" }),
      axiosClient.get<unknown>(SEATS_ENDPOINT, { cache: "no-store" }),
    ]);
    setExtensions((current) =>
      readOrDefault(extensionsResult, readWebphoneExtensions, current),
    );
    setSeats((current) => readOrDefault(seatsResult, readWebphoneSeats, current));
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
    return runMutation(
      "config",
      canUpdateConfig,
      "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
      patch,
      async (key) => {
        const response = await axiosClient.patch<unknown>(
          CONFIG_ENDPOINT,
          patch,
          { headers: { "x-idempotency-key": key } },
        );
        applyConfig(readWebphoneConfig(unwrapCoreData(response.data)));
      },
    );
  }, [applyConfig, canUpdateConfig, config, failLocally, form, runMutation]);

  const createEndpoint = useCallback(
    (dto: CreateWebphoneEndpointDto) =>
      runMutation(
        "endpoint:new",
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        dto,
        async (key) => {
          await axiosClient.post<unknown>(`${CONFIG_ENDPOINT}/endpoints`, dto, {
            headers: { "x-idempotency-key": key },
          });
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const updateEndpoint = useCallback(
    (id: string, dto: UpdateWebphoneEndpointDto) =>
      runMutation(
        `endpoint:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        dto,
        async (key) => {
          await axiosClient.patch<unknown>(
            `${CONFIG_ENDPOINT}/endpoints/${encodeURIComponent(id)}`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const deleteEndpoint = useCallback(
    (id: string) =>
      runMutation(
        `endpoint:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        { delete: id },
        async (key) => {
          await axiosClient.delete<unknown>(
            `${CONFIG_ENDPOINT}/endpoints/${encodeURIComponent(id)}`,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const createIceServer = useCallback(
    (dto: CreateWebphoneIceServerDto) =>
      runMutation(
        "ice:new",
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        redactCredential(dto),
        async (key) => {
          await axiosClient.post<unknown>(
            `${CONFIG_ENDPOINT}/ice-servers`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const updateIceServer = useCallback(
    (id: string, dto: UpdateWebphoneIceServerDto) =>
      runMutation(
        `ice:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        redactCredential(dto),
        async (key) => {
          await axiosClient.patch<unknown>(
            `${CONFIG_ENDPOINT}/ice-servers/${encodeURIComponent(id)}`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const deleteIceServer = useCallback(
    (id: string) =>
      runMutation(
        `ice:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        { delete: id },
        async (key) => {
          await axiosClient.delete<unknown>(
            `${CONFIG_ENDPOINT}/ice-servers/${encodeURIComponent(id)}`,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadConfig();
        },
      ),
    [canUpdateConfig, reloadConfig, runMutation],
  );

  const createExtension = useCallback(
    (dto: CreateWebphoneExtensionDto) =>
      runMutation(
        "extension:new",
        canManageExtensions,
        "WEBPHONE_EXTENSION_PERMISSION_REQUIRED",
        redactPassword(dto),
        async (key) => {
          await axiosClient.post<unknown>(EXTENSIONS_ENDPOINT, dto, {
            headers: { "x-idempotency-key": key },
          });
          await reloadExtensions();
        },
      ),
    [canManageExtensions, reloadExtensions, runMutation],
  );

  const updateExtension = useCallback(
    (id: string, dto: UpdateWebphoneExtensionDto) =>
      runMutation(
        `extension:${id}`,
        canManageExtensions,
        "WEBPHONE_EXTENSION_PERMISSION_REQUIRED",
        redactPassword(dto),
        async (key) => {
          await axiosClient.patch<unknown>(
            `${EXTENSIONS_ENDPOINT}/${encodeURIComponent(id)}`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadExtensions();
        },
      ),
    [canManageExtensions, reloadExtensions, runMutation],
  );

  const deleteExtension = useCallback(
    (id: string) =>
      runMutation(
        `extension:${id}`,
        canManageExtensions,
        "WEBPHONE_EXTENSION_PERMISSION_REQUIRED",
        { delete: id },
        async (key) => {
          await axiosClient.delete<unknown>(
            `${EXTENSIONS_ENDPOINT}/${encodeURIComponent(id)}`,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadExtensions();
        },
      ),
    [canManageExtensions, reloadExtensions, runMutation],
  );

  return {
    lang,
    loadState,
    entitlement,
    isSubscribed,
    refetch: load,
    canUpdateConfig,
    canManageExtensions,
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
    seats,
    mutation,
  };
}

export type TenantWebphoneSettingsState = ReturnType<
  typeof useTenantWebphoneSettings
>;

/**
 * Maps an entitlement refusal to the reason the screen shows. Anything else
 * returns `null` so it stays a real error rather than being disguised as an
 * unsubscribed state.
 */
export function entitlementFromError(
  error: unknown,
): Exclude<WebphoneEntitlement, "ACTIVE"> | null {
  const status = getAuthErrorStatus(error);
  const code = getAuthErrorCode(error);
  if (status === 403 && code === "WEBPHONE_MODULE_NOT_PURCHASED") {
    return "NOT_PURCHASED";
  }
  if (status === 403 && code === "WEBPHONE_MODULE_INACTIVE") return "SUSPENDED";
  if (status === 409 && code === "WEBPHONE_PROVISIONING_PENDING") {
    return "PROVISIONING_PENDING";
  }
  return null;
}

function classifyLoadError(error: unknown): WebphoneLoadState {
  return getAuthErrorStatus(error) === 403 ? "FORBIDDEN" : "ERROR";
}

/**
 * Reads one secondary resource, keeping `fallback` when it was refused or came
 * back in a shape the contract rejects. These resources sit behind their own
 * permissions, so their absence is a narrower screen — not a broken one.
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

function errorDetails(error: unknown): Record<string, string[]> | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { response?: { data?: { details?: unknown } } })
    .response?.data?.details;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }

  const details: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const entries = value
        .filter((entry): entry is string => typeof entry === "string")
        .slice(0, 20);
      if (entries.length) details[key] = entries;
    } else if (typeof value === "string" || typeof value === "number") {
      details[key] = [String(value)];
    }
  }
  return Object.keys(details).length ? details : null;
}

/**
 * The idempotency fingerprint is built from the request body, so secrets are
 * stripped first. A SIP password or TURN credential must not outlive the
 * request that carries it.
 */
function redactCredential(dto: { credential?: string | null }): unknown {
  const { credential, ...rest } = dto;
  return { ...rest, credential: credential ? "[set]" : credential };
}

function redactPassword(dto: { sipPassword?: string | null }): unknown {
  const { sipPassword, ...rest } = dto;
  return { ...rest, sipPassword: sipPassword ? "[set]" : sipPassword };
}
