import { axiosClient } from "@/lib/api/axiosClient";
import {
  isUuidV7,
  readComponentPage,
  readDiscoveryRun,
  readDiscoveryRunDetail,
  readDiscoveryRuns,
  readReleasePage,
} from "./readers";
import type {
  ComponentQuery,
  CreateDiscoveryRunCommand,
  ReleaseQuery,
} from "./types";

export const PROVISIONING_GOVERNANCE_ROOT = "/api/admin/core/v1/provisioning";

export const provisioningGovernanceApi = {
  listComponents: async (query: ComponentQuery, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_GOVERNANCE_ROOT}/components${componentQuery(query)}`,
      requestConfig(signal),
    );
    return readComponentPage(response.data);
  },

  listComponentReleases: async (
    componentId: string,
    query: ReleaseQuery,
    signal?: AbortSignal,
  ) => {
    if (!isUuidV7(componentId)) throw new TypeError("INVALID_COMPONENT_ID");
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_GOVERNANCE_ROOT}/components/${componentId}/releases${releaseQuery(query)}`,
      requestConfig(signal),
    );
    return readReleasePage(response.data);
  },

  listDiscoveryRuns: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_GOVERNANCE_ROOT}/discovery-runs`,
      requestConfig(signal),
    );
    return readDiscoveryRuns(response.data);
  },

  getDiscoveryRun: async (runId: string, signal?: AbortSignal) => {
    if (!isUuidV7(runId)) throw new TypeError("INVALID_DISCOVERY_RUN_ID");
    const response = await axiosClient.get<unknown>(
      `${PROVISIONING_GOVERNANCE_ROOT}/discovery-runs/${runId}`,
      requestConfig(signal),
    );
    return readDiscoveryRunDetail(response.data);
  },

  createDiscoveryRun: async (
    command: CreateDiscoveryRunCommand,
    idempotencyKey: string,
  ) => {
    if (!isUuidV7(idempotencyKey)) {
      throw new TypeError("INVALID_DISCOVERY_COMMAND_ID");
    }
    validateDiscoveryCommand(command);
    const response = await axiosClient.post<unknown>(
      `${PROVISIONING_GOVERNANCE_ROOT}/discovery-runs`,
      command,
      {
        headers: { "x-idempotency-key": idempotencyKey },
        skipAutoIdempotency: true,
        replayAfterRefresh: true,
        cache: "no-store",
      },
    );
    return readDiscoveryRun(response.data);
  },
};

export function componentQuery(query: ComponentQuery): string {
  if (
    !hasExactKeys(query, [
      "page",
      "limit",
      "sortBy",
      "sortDir",
      "search",
      "componentKey",
      "ownerApp",
      "kind",
    ]) ||
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    !["key", "ownerApp", "kind", "createdAt", "updatedAt"].includes(
      query.sortBy,
    ) ||
    !["ASC", "DESC"].includes(query.sortDir) ||
    (query.search !== undefined &&
      (typeof query.search !== "string" || query.search.length > 100)) ||
    (query.componentKey !== undefined &&
      (typeof query.componentKey !== "string" ||
        !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u.test(
          query.componentKey,
        ))) ||
    (query.ownerApp !== undefined &&
      (typeof query.ownerApp !== "string" ||
        !/^[a-z][a-z0-9_-]{0,31}$/u.test(query.ownerApp))) ||
    (query.kind !== undefined && !["FOUNDATION", "MODULE"].includes(query.kind))
  ) {
    throw new TypeError("INVALID_COMPONENT_QUERY");
  }
  return serialize(query, [
    "page",
    "limit",
    "sortBy",
    "sortDir",
    "search",
    "componentKey",
    "ownerApp",
    "kind",
  ]);
}

export function releaseQuery(query: ReleaseQuery): string {
  if (
    !hasExactKeys(query, [
      "page",
      "limit",
      "sortBy",
      "sortDir",
      "search",
      "riskLevel",
      "selfServiceAllowed",
      "requiresBackup",
      "requiresMaintenance",
    ]) ||
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    !["publishedAt", "releaseVersion", "manifestVersion", "riskLevel"].includes(
      query.sortBy,
    ) ||
    !["ASC", "DESC"].includes(query.sortDir) ||
    (query.search !== undefined &&
      (typeof query.search !== "string" || query.search.length > 100)) ||
    (query.riskLevel !== undefined &&
      !["LOW", "MEDIUM", "HIGH"].includes(query.riskLevel)) ||
    !optionalBoolean(query.selfServiceAllowed) ||
    !optionalBoolean(query.requiresBackup) ||
    !optionalBoolean(query.requiresMaintenance)
  ) {
    throw new TypeError("INVALID_RELEASE_QUERY");
  }
  return serialize(query, [
    "page",
    "limit",
    "sortBy",
    "sortDir",
    "search",
    "riskLevel",
    "selfServiceAllowed",
    "requiresBackup",
    "requiresMaintenance",
  ]);
}

function validateDiscoveryCommand(
  command: CreateDiscoveryRunCommand,
): void {
  const cutoff = new Date(command.cutoffAt);
  if (
    !hasExactKeys(command, ["mode", "cutoffAt", "maxTenants"]) ||
    !["MANUAL", "DRY_RUN"].includes(command.mode) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(command.cutoffAt) ||
    !Number.isFinite(cutoff.getTime()) ||
    cutoff.toISOString() !== command.cutoffAt ||
    cutoff.getTime() > Date.now() ||
    !Number.isSafeInteger(command.maxTenants) ||
    command.maxTenants < 1 ||
    command.maxTenants > 10_000
  ) {
    throw new TypeError("INVALID_DISCOVERY_COMMAND");
  }
}

function serialize(value: object, keys: readonly string[]): string {
  const parameters = new URLSearchParams();
  const record = value as Record<string, unknown>;
  keys.forEach((key) => {
    const entry = record[key];
    if (entry !== undefined && entry !== "") parameters.set(key, String(entry));
  });
  return `?${parameters.toString()}`;
}

function hasExactKeys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function requestConfig(signal?: AbortSignal) {
  return {
    cache: "no-store" as const,
    ...(signal ? { signal } : {}),
  };
}
