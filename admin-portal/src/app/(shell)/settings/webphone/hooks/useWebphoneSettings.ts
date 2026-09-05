"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { notifyWebphoneChanged } from "@mutakamel/webphone";
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
  readWebphoneServers,
  type CreateWebphoneIceServerDto,
  type CreateWebphoneServerDto,
  type UpdateWebphoneIceServerDto,
  type UpdateWebphoneServerDto,
  type WebphoneServer,
} from "../webphone-contract";

const BASE_PATH = "/api/admin/webphone/v1";
const SERVERS_ENDPOINT = `${BASE_PATH}/servers`;
const SERVERS_ORDER_ENDPOINT = `${SERVERS_ENDPOINT}/order`;

/**
 * How long a finished write keeps saying so.
 *
 * Long enough to be read, short enough that it is gone before the next change,
 * so "Saved" never describes something other than what the operator just did.
 */
const SUCCESS_NOTICE_MS = 4_000;

/**
 * Identifies which control a mutation belongs to, so its outcome renders next
 * to that control instead of as one page-level banner.
 *
 * A row's on/off switch gets a target of its own, separate from the row's Save
 * button, because the two save on different gestures: sharing one target would
 * make the switch report "Saved" for a change to the fields below it.
 */
export type WebphoneMutationTarget =
  | "server:new"
  | "servers:order"
  | `server:enabled:${string}`
  | `server:ice-enabled:${string}`
  | `server:${string}`
  | `ice:new:${string}`
  | `ice:enabled:${string}`
  | `ice:${string}`;

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

  const [servers, setServers] = useState<WebphoneServer[]>([]);
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<WebphoneMutationState>(IDLE_MUTATION);

  const generation = useRef(0);
  // One key per user intent: reused only while the previous attempt's outcome
  // is still unknown, so a retry reconciles rather than duplicates.
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);

  const fetchAll = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      setServers([]);
      setLoadError(null);
      setLoadState("FORBIDDEN");
      return;
    }

    setLoadState("LOADING");
    setLoadError(null);
    try {
      const response = await axiosClient.get<unknown>(SERVERS_ENDPOINT, {
        cache: "no-store",
      });
      if (currentGeneration !== generation.current) return;

      setServers(readWebphoneServers(unwrapCoreData(response.data)));
      intent.current = null;
      setMutation(IDLE_MUTATION);
      setLoadState("READY");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const normalized = normalizeApiError(caught);
      setServers([]);
      setLoadError(normalized);
      setLoadState(classifyLoadError(normalized));
    }
  }, [canRead, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void fetchAll());
  }, [fetchAll]);

  // A success notice that never expires becomes furniture: it would still be
  // sitting under a control an hour after the save it refers to.
  useEffect(() => {
    if (mutation.phase !== "SUCCEEDED") return undefined;
    const timer = setTimeout(() => setMutation(IDLE_MUTATION), SUCCESS_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [mutation]);

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
        // Every mutation on this screen can change what `/me` answers — the
        // server chain decides whether the dock can register at all. Signalled
        // here rather than per-mutation so a new one cannot forget.
        notifyWebphoneChanged();
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

  /**
   * Refreshes the server list after a write. One read serves every server and
   * ICE mutation because ICE entries are returned nested in their server.
   */
  const reloadServers = useCallback(async () => {
    const response = await axiosClient.get<unknown>(SERVERS_ENDPOINT, {
      cache: "no-store",
    });
    setServers(readWebphoneServers(unwrapCoreData(response.data)));
  }, []);

  const createServer = useCallback(
    (dto: CreateWebphoneServerDto) =>
      runMutation("server:new", dto, async (key) => {
        await axiosClient.post<unknown>(SERVERS_ENDPOINT, dto, {
          headers: { "x-idempotency-key": key },
        });
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  /** One server PATCH, reported against whichever control asked for it. */
  const patchServer = useCallback(
    (
      target: WebphoneMutationTarget,
      id: string,
      dto: UpdateWebphoneServerDto,
    ) =>
      runMutation(target, dto, async (key) => {
        await axiosClient.patch<unknown>(
          `${SERVERS_ENDPOINT}/${encodeURIComponent(id)}`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  const updateServer = useCallback(
    (id: string, dto: UpdateWebphoneServerDto) =>
      patchServer(`server:${id}`, id, dto),
    [patchServer],
  );

  const deleteServer = useCallback(
    (id: string) =>
      runMutation(`server:${id}`, { delete: id }, async (key) => {
        await axiosClient.delete<unknown>(
          `${SERVERS_ENDPOINT}/${encodeURIComponent(id)}`,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  /**
   * Writes the failover order as one statement about the whole list.
   *
   * Sending every id — not just the moved one — is what makes the write
   * idempotent: replaying it produces the same order rather than shifting the
   * list one place further each time.
   */
  const reorderServers = useCallback(
    (ids: string[]) =>
      runMutation("servers:order", { ids }, async (key) => {
        await axiosClient.put<unknown>(
          SERVERS_ORDER_ENDPOINT,
          { ids },
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  const createIceServer = useCallback(
    (serverId: string, dto: CreateWebphoneIceServerDto) =>
      runMutation(`ice:new:${serverId}`, redactCredential(dto), async (key) => {
        await axiosClient.post<unknown>(
          `${SERVERS_ENDPOINT}/${encodeURIComponent(serverId)}/ice-servers`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  /** One ICE PATCH, reported against whichever control asked for it. */
  const patchIceServer = useCallback(
    (
      target: WebphoneMutationTarget,
      serverId: string,
      id: string,
      dto: UpdateWebphoneIceServerDto,
    ) =>
      runMutation(target, redactCredential(dto), async (key) => {
        await axiosClient.patch<unknown>(
          `${SERVERS_ENDPOINT}/${encodeURIComponent(serverId)}/ice-servers/${encodeURIComponent(id)}`,
          dto,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  const updateIceServer = useCallback(
    (serverId: string, id: string, dto: UpdateWebphoneIceServerDto) =>
      patchIceServer(`ice:${id}`, serverId, id, dto),
    [patchIceServer],
  );

  const deleteIceServer = useCallback(
    (serverId: string, id: string) =>
      runMutation(`ice:${id}`, { delete: id }, async (key) => {
        await axiosClient.delete<unknown>(
          `${SERVERS_ENDPOINT}/${encodeURIComponent(serverId)}/ice-servers/${encodeURIComponent(id)}`,
          { headers: { "x-idempotency-key": key } },
        );
        await reloadServers();
      }),
    [reloadServers, runMutation],
  );

  /**
   * Turns one server on or off and writes it in the same gesture.
   *
   * The failover order already saves the moment it changes; an on/off switch
   * that instead waited for a Save button somewhere else would be the one
   * control on the screen whose state can silently disagree with the server.
   * The row flips locally first so the switch answers the click, and flips back
   * if the write is refused — `WEBPHONE_LAST_SERVER` makes that a real outcome,
   * not a theoretical one.
   */
  const setServerEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      setServers((current) =>
        current.map((server) =>
          server.id === id ? { ...server, enabled } : server,
        ),
      );
      const succeeded = await patchServer(`server:enabled:${id}`, id, {
        enabled,
      });
      if (!succeeded) {
        setServers((current) =>
          current.map((server) =>
            server.id === id ? { ...server, enabled: !enabled } : server,
          ),
        );
      }
      return succeeded;
    },
    [patchServer],
  );

  /**
   * Turns a whole server's ICE on or off, in the same gesture.
   *
   * The same bargain the two switches below and above it make, for the same
   * reason. What it deliberately does NOT do is touch a single ICE entry: the
   * entries stay stored and stay individually enabled, so switching back on
   * restores the set exactly as the operator left it — including which entries
   * they had already parked. That is the whole point of a server-level column,
   * and a UI that "helpfully" disabled each entry instead would destroy it.
   *
   * A refusal is a real outcome here, not a theoretical one:
   * `WEBPHONE_RELAY_WITHOUT_TURN` covers a relay-only server, which would be
   * left with no media path at all, so the switch flips back and says why.
   */
  const setServerIceEnabled = useCallback(
    async (id: string, iceEnabled: boolean) => {
      setServers((current) =>
        current.map((server) =>
          server.id === id ? { ...server, iceEnabled } : server,
        ),
      );
      const succeeded = await patchServer(`server:ice-enabled:${id}`, id, {
        iceEnabled,
      });
      if (!succeeded) {
        setServers((current) =>
          current.map((server) =>
            server.id === id ? { ...server, iceEnabled: !iceEnabled } : server,
          ),
        );
      }
      return succeeded;
    },
    [patchServer],
  );

  /** The same bargain for one ICE entry. */
  const setIceServerEnabled = useCallback(
    async (serverId: string, id: string, enabled: boolean) => {
      setServers((current) => withIceEnabled(current, serverId, id, enabled));
      const succeeded = await patchIceServer(
        `ice:enabled:${id}`,
        serverId,
        id,
        { enabled },
      );
      if (!succeeded) {
        setServers((current) => withIceEnabled(current, serverId, id, !enabled));
      }
      return succeeded;
    },
    [patchIceServer],
  );

  return {
    lang,
    loadState,
    loadError,
    refetch: fetchAll,
    canUpdate,
    servers,
    createServer,
    updateServer,
    setServerEnabled,
    setServerIceEnabled,
    deleteServer,
    reorderServers,
    createIceServer,
    updateIceServer,
    setIceServerEnabled,
    deleteIceServer,
    mutation,
  };
}

/** Replaces one ICE entry's `enabled` without disturbing the rest of the tree. */
function withIceEnabled(
  servers: readonly WebphoneServer[],
  serverId: string,
  id: string,
  enabled: boolean,
): WebphoneServer[] {
  return servers.map((server) =>
    server.id === serverId
      ? {
          ...server,
          iceServers: server.iceServers.map((ice) =>
            ice.id === id ? { ...ice, enabled } : ice,
          ),
        }
      : server,
  );
}

export type WebphoneSettingsState = ReturnType<typeof useWebphoneSettings>;

function classifyLoadError(error: NormalizedApiError): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

/**
 * Distinguishes one TURN credential from another without being one.
 *
 * The salt is drawn once per page load and never leaves this module: it is not
 * sent, stored, or logged, so a marker that somehow escaped could not be
 * matched against a guessed credential. Within one load it is constant, which
 * is what makes the marker stable for an exact retry.
 */
const CREDENTIAL_MARKER_SALT = generateUUIDv7();

/**
 * The idempotency fingerprint is derived from the request body, so secrets are
 * stripped before it is built. A TURN credential must not sit in component
 * state one moment longer than the request that carries it.
 *
 * It is replaced by a digest rather than a constant, because the fingerprint
 * has two jobs and a constant only does one of them. `"[set]"` kept the secret
 * out, and made every non-empty credential look like the same intent: after an
 * ambiguous save of credential A, changing only the credential to B reused A's
 * idempotency key, and the Gateway — which hashes the real body — refused the
 * retry as a mismatch. The operator's first attempt to replace the credential
 * failed for a reason no part of the screen could explain.
 */
function redactCredential(dto: { credential?: string | null }): unknown {
  const { credential, ...rest } = dto;
  return {
    ...rest,
    credential: credential ? credentialMarker(credential) : credential,
  };
}

function credentialMarker(credential: string): string {
  const digest = sha256(
    new TextEncoder().encode(`${CREDENTIAL_MARKER_SALT}:${credential}`),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
