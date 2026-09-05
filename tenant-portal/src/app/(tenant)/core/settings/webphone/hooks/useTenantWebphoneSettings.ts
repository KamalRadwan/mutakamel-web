"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { getAuthErrorCode, getAuthErrorStatus } from "@/lib/auth/sessionErrors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  moveServerId,
  readWebphoneConfig,
  readWebphoneExtensions,
  readWebphoneSeats,
  readWebphoneServers,
  unwrapWebphoneEnvelope,
  type CreateWebphoneExtensionDto,
  type CreateWebphoneIceServerDto,
  type CreateWebphoneServerDto,
  type UpdateWebphoneExtensionDto,
  type UpdateWebphoneIceServerDto,
  type UpdateWebphoneServerDto,
  type WebphoneExtension,
  type WebphoneScopeConfig,
  type WebphoneSeats,
  type WebphoneServer,
} from "../webphone-contract";

const BASE_PATH = "/api/tenant/webphone/v1";
/**
 * Read-only. The scope has no stored settings row, so there is no `PATCH` here
 * — `enabled` is derived from the servers below and is switched by giving the
 * scope a working server, not by writing a flag.
 */
const CONFIG_ENDPOINT = `${BASE_PATH}/config`;
const SERVERS_ENDPOINT = `${BASE_PATH}/servers`;
const EXTENSIONS_ENDPOINT = `${BASE_PATH}/extensions`;
const SEATS_ENDPOINT = `${BASE_PATH}/seats`;

function iceServersEndpoint(serverId: string): string {
  return `${SERVERS_ENDPOINT}/${encodeURIComponent(serverId)}/ice-servers`;
}

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
  | "servers:order"
  | "server:new"
  | "extension:new"
  | `server:${string}`
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
  const [config, setConfig] = useState<WebphoneScopeConfig | null>(null);
  const [servers, setServers] = useState<WebphoneServer[]>([]);
  const [extensions, setExtensions] = useState<WebphoneExtension[]>([]);
  const [seats, setSeats] = useState<WebphoneSeats | null>(null);
  const [loadState, setLoadState] = useState<WebphoneLoadState>("LOADING");
  const [mutation, setMutation] = useState<WebphoneMutationState>(IDLE_MUTATION);

  const generation = useRef(0);
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);

  const clearData = useCallback(() => {
    setConfig(null);
    setServers([]);
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
   *
   * The server list sits behind the same permission and the same entitlement as
   * the scope settings, so it is read here rather than tolerantly: an empty
   * chain and an unreadable one are different facts, and the failover order is
   * the substance of this screen.
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
      const [configResponse, serversResponse] = await Promise.all([
        axiosClient.get<unknown>(CONFIG_ENDPOINT, { cache: "no-store" }),
        axiosClient.get<unknown>(SERVERS_ENDPOINT, { cache: "no-store" }),
      ]);
      if (currentGeneration !== generation.current) return;
      setConfig(readWebphoneConfig(unwrapWebphoneEnvelope(configResponse.data)));
      setServers(readWebphoneServers(unwrapWebphoneEnvelope(serversResponse.data)));
      setEntitlement("ACTIVE");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const blocked = entitlementFromError(caught);
      clearData();
      setEntitlement(blocked ?? "ACTIVE");
      // An unavailable module still reaches READY, so the screen renders its
      // sections inert and empty and the capability stays visible rather than
      // hidden. `config` stays null, so nothing on screen can be mistaken for
      // something the server returned.
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
  }, [canRead, clearData, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const isSubscribed = entitlement === "ACTIVE";
  const canUpdateConfig = isSubscribed && hasSettingsUpdate;
  const canManageExtensions = isSubscribed && hasExtensionsManage;

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

  /**
   * Re-reads the chain after any server or ICE write.
   *
   * One read for the whole list rather than patching the one row back in: a
   * create appends a priority the client did not choose and a delete renumbers
   * everything after it, so a local splice would be guessing at what the server
   * just decided.
   */
  const reloadServers = useCallback(async () => {
    const response = await axiosClient.get<unknown>(SERVERS_ENDPOINT, {
      cache: "no-store",
    });
    setServers(readWebphoneServers(unwrapWebphoneEnvelope(response.data)));
  }, []);

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

  const createServer = useCallback(
    (dto: CreateWebphoneServerDto) =>
      runMutation(
        "server:new",
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        dto,
        async (key) => {
          await axiosClient.post<unknown>(SERVERS_ENDPOINT, dto, {
            headers: { "x-idempotency-key": key },
          });
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
  );

  const updateServer = useCallback(
    (id: string, dto: UpdateWebphoneServerDto) =>
      runMutation(
        `server:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        dto,
        async (key) => {
          await axiosClient.patch<unknown>(
            `${SERVERS_ENDPOINT}/${encodeURIComponent(id)}`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
  );

  const deleteServer = useCallback(
    (id: string) =>
      runMutation(
        `server:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        { delete: id },
        async (key) => {
          await axiosClient.delete<unknown>(
            `${SERVERS_ENDPOINT}/${encodeURIComponent(id)}`,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
  );

  /**
   * Moves one server in the chain.
   *
   * The endpoint takes the whole id list rather than a delta, because a move
   * renumbers every row between the two positions and `priority` is unique per
   * scope — there is no sequence of single-row writes that stays valid in
   * between. The new order is shown before the response lands, since a row that
   * springs back to where it was reads as a drag that failed; a refusal puts
   * the previous chain back.
   */
  const moveServer = useCallback(
    async (fromIndex: number, toIndex: number): Promise<boolean> => {
      const previous = servers;
      const ids = moveServerId(
        previous.map((server) => server.id),
        fromIndex,
        toIndex,
      );
      if (ids.length === 0) return false;

      setServers(applyOrder(previous, ids));
      const succeeded = await runMutation(
        "servers:order",
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        { ids },
        async (key) => {
          await axiosClient.put<unknown>(
            `${SERVERS_ENDPOINT}/order`,
            { ids },
            { headers: { "x-idempotency-key": key } },
          );
          await reloadServers();
        },
      );
      if (!succeeded) setServers(previous);
      return succeeded;
    },
    [canUpdateConfig, reloadServers, runMutation, servers],
  );

  const createIceServer = useCallback(
    (serverId: string, dto: CreateWebphoneIceServerDto) =>
      runMutation(
        `ice:new:${serverId}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        redactCredential(dto),
        async (key) => {
          await axiosClient.post<unknown>(iceServersEndpoint(serverId), dto, {
            headers: { "x-idempotency-key": key },
          });
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
  );

  const updateIceServer = useCallback(
    (serverId: string, id: string, dto: UpdateWebphoneIceServerDto) =>
      runMutation(
        `ice:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        redactCredential(dto),
        async (key) => {
          await axiosClient.patch<unknown>(
            `${iceServersEndpoint(serverId)}/${encodeURIComponent(id)}`,
            dto,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
  );

  const deleteIceServer = useCallback(
    (serverId: string, id: string) =>
      runMutation(
        `ice:${id}`,
        canUpdateConfig,
        "WEBPHONE_UPDATE_PERMISSION_REQUIRED",
        { delete: id },
        async (key) => {
          await axiosClient.delete<unknown>(
            `${iceServersEndpoint(serverId)}/${encodeURIComponent(id)}`,
            { headers: { "x-idempotency-key": key } },
          );
          await reloadServers();
        },
      ),
    [canUpdateConfig, reloadServers, runMutation],
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
    /** Read-only, and derived server-side. Null while the module is blocked. */
    config,
    servers,
    createServer,
    updateServer,
    deleteServer,
    moveServer,
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
 * Re-sequences the chain into `ids`, renumbering `priority` from 1 the way the
 * reorder endpoint does, so the position badges match what was just dropped
 * rather than the numbers the previous response carried.
 */
function applyOrder(
  servers: readonly WebphoneServer[],
  ids: readonly string[],
): WebphoneServer[] {
  const byId = new Map(servers.map((server) => [server.id, server]));
  return ids.flatMap((id, index) => {
    const server = byId.get(id);
    return server ? [{ ...server, priority: index + 1 }] : [];
  });
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
    return parse(unwrapWebphoneEnvelope(result.value.data));
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
