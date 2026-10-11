"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  readTenantProvisioningCommandResult,
  readTenantView,
} from "@/features/admin/tenant-workspace/core/model/readers";
import type {
  TenantStatus,
  TenantView,
} from "@/features/admin/tenant-workspace/core/types";
import {
  createTenantIntentKeyStore,
  shouldRetainTenantIntentKey,
} from "@/features/admin/tenant-workspace/core/model/intent-keys";
import { databaseServersApi } from "@/features/admin/database-servers/api/database-servers.api";

export type TenantStatusFilter = TenantStatus | "ALL";
/** Every directory row command; each one is confirmed in a dialog first. */
export type TenantDirectoryModalAction =
  | "activate"
  | "suspend"
  | "delete"
  | "reprovision";

export interface TenantRecord {
  id: string;
  name: string;
  companyName: string;
  primaryFqdn: string | null;
  secondaryFqdnsCount: number;
  databaseServerName: string | null;
  databaseServerId: string | null;
  storageServerId: string;
  storageServer: {
    id: string;
    code: string;
    name: string;
    region: string;
    status: string;
  } | null;
  countryName: string;
  countryIsoCode: string;
  subscriptionStatus: string | null;
  seats: number | null;
  status: TenantStatus;
  ownerEmail: string | null;
  createdAt: string;
}

export interface TenantDirectoryMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type DatabaseServerRegistryState =
  "idle" | "loading" | "ready" | "forbidden" | "error";

export interface TenantDatabaseServerOption {
  id: string;
  name: string;
}

export interface TenantDirectoryPage {
  items: TenantRecord[];
  meta: TenantDirectoryMeta;
}

const DEFAULT_PAGE_SIZE = 10;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SORT_FIELDS = ["name", "status", "createdAt"] as const;
type TenantSortField = (typeof TENANT_SORT_FIELDS)[number];

const EMPTY_META: TenantDirectoryMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export function useTenants() {
  const { t } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(
    () => ({
      canRead: adminCan(user, "admin.tenants.read"),
      canCreate: adminCan(user, "admin.tenants.create"),
      canReadDatabaseServers: adminCan(user, "admin.database_servers.read"),
      canSuspendOrActivate: adminCanAll(user, [
        "admin.tenants.suspend",
        "admin.tenants.critical",
      ]),
      canReprovision: adminCanAll(user, [
        "admin.tenants.reprovision",
        "admin.tenants.critical",
      ]),
      canSoftDelete: adminCanAll(user, [
        "admin.tenants.delete",
        "admin.tenants.critical",
      ]),
    }),
    [user],
  );
  const intentKeys = useRef(createTenantIntentKeyStore());
  const request = useRef({
    generation: 0,
    abort: null as AbortController | null,
  });
  const databaseRegistryRequest = useRef({
    generation: 0,
    abort: null as AbortController | null,
  });
  const actorId = user?.id ?? null;
  const actorIdRef = useRef(actorId);
  useEffect(() => {
    actorIdRef.current = actorId;
  }, [actorId]);
  const actionInFlight = useRef(false);

  const [search, setSearchValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilterValue] =
    useState<TenantStatusFilter>("ALL");
  const [serverFilter, setServerFilterValue] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  // GET /admin/tenants accepts name, status and createdAt only; any other
  // sortBy is a 400, so changeSort checks the value before applying it.
  const [sortBy, setSortBy] = useState<TenantSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [pagination, setPagination] = useState<TenantDirectoryMeta>(EMPTY_META);
  const [databaseServerOptions, setDatabaseServerOptions] = useState<
    TenantDatabaseServerOption[]
  >([]);
  const [databaseServerOptionsState, setDatabaseServerOptionsState] =
    useState<DatabaseServerRegistryState>("idle");
  const [databaseServerOptionsError, setDatabaseServerOptionsError] =
    useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [actionError, setActionError] = useState<NormalizedApiError | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<{
    action: TenantDirectoryModalAction;
    tenantId: string;
  } | null>(null);
  const [activeModalTenant, setActiveModalTenant] =
    useState<TenantRecord | null>(null);
  const [modalActionType, setModalActionType] =
    useState<TenantDirectoryModalAction | null>(null);

  useEffect(() => {
    const nextSearch = search.trim();
    if (nextSearch === appliedSearch) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(nextSearch);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [appliedSearch, search]);

  const fetchTenants = useCallback(async () => {
    const generation = ++request.current.generation;
    request.current.abort?.abort();

    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }
    if (!permissions.canRead) {
      setTenants([]);
      setPagination({ ...EMPTY_META, page });
      setDatabaseServerOptions([]);
      setIsLoading(false);
      setLoadError(
        localError(
          403,
          "TENANT_DIRECTORY_FORBIDDEN",
          "You do not have permission to read tenants.",
        ),
      );
      return;
    }

    const controller = new AbortController();
    request.current.abort = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(DEFAULT_PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (appliedSearch) params.set("search", appliedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (serverFilter !== "ALL") {
        params.set("databaseServerId", serverFilter);
      }

      const response = await axiosClient.get<unknown>(
        `/api/admin/core/v1/tenants?${params.toString()}`,
        { signal: controller.signal },
      );
      const result = readTenantDirectoryPage(response.data, {
        page,
        limit: DEFAULT_PAGE_SIZE,
      });
      if (
        generation !== request.current.generation ||
        controller.signal.aborted
      ) {
        return;
      }
      setTenants(result.items);
      setPagination(result.meta);

      if (result.meta.totalPages === 0 && page !== 1) {
        setPage(1);
      } else if (result.meta.totalPages > 0 && page > result.meta.totalPages) {
        setPage(result.meta.totalPages);
      }
    } catch (caught) {
      if (
        generation !== request.current.generation ||
        controller.signal.aborted
      ) {
        return;
      }
      setTenants([]);
      setPagination({ ...EMPTY_META, page });
      setLoadError(normalizeApiError(caught));
    } finally {
      if (generation === request.current.generation) setIsLoading(false);
    }
  }, [
    appliedSearch,
    isAuthLoading,
    page,
    permissions.canRead,
    serverFilter,
    sortBy,
    sortDir,
    statusFilter,
  ]);

  const changeSort = useCallback((nextSortBy: string, nextSortDir: "ASC" | "DESC") => {
    const field = TENANT_SORT_FIELDS.find((allowed) => allowed === nextSortBy);
    if (!field) return;
    setSortBy(field);
    setSortDir(nextSortDir);
    setPage(1);
  }, []);

  const fetchDatabaseServerOptions = useCallback(async () => {
    const requestedActorId = actorId;
    const generation = ++databaseRegistryRequest.current.generation;
    databaseRegistryRequest.current.abort?.abort();

    if (isAuthLoading) {
      setDatabaseServerOptionsState("loading");
      return;
    }
    if (!permissions.canRead || !permissions.canReadDatabaseServers) {
      setDatabaseServerOptions([]);
      setDatabaseServerOptionsError(null);
      setDatabaseServerOptionsState(permissions.canRead ? "forbidden" : "idle");
      setServerFilterValue((current) => (current === "ALL" ? current : "ALL"));
      return;
    }

    const controller = new AbortController();
    databaseRegistryRequest.current.abort = controller;
    setDatabaseServerOptionsState("loading");
    setDatabaseServerOptionsError(null);

    try {
      const options = new Map<string, TenantDatabaseServerOption>();
      let pageToLoad = 1;
      let totalPages = 1;
      let expectedTotal: number | null = null;

      do {
        const response = await databaseServersApi.list(
          {
            page: pageToLoad,
            limit: 100,
            sortBy: "name",
            sortDir: "ASC",
          },
          controller.signal,
        );
        const meta = response.meta;
        if (
          !meta ||
          meta.page !== pageToLoad ||
          meta.limit !== 100 ||
          !Number.isSafeInteger(meta.totalPages) ||
          meta.totalPages < 0 ||
          meta.totalPages > 10_000 ||
          !Number.isSafeInteger(meta.total) ||
          meta.total < 0 ||
          response.data.length > 100 ||
          (expectedTotal !== null && meta.total !== expectedTotal)
        ) {
          throw new Error("INVALID_DATABASE_SERVER_REGISTRY_RESPONSE");
        }
        expectedTotal ??= meta.total;
        totalPages = meta.totalPages;
        for (const server of response.data) {
          const option = readDatabaseServerOption(server);
          if (options.has(option.id)) {
            throw new Error("INVALID_DATABASE_SERVER_REGISTRY_RESPONSE");
          }
          options.set(option.id, option);
        }
        pageToLoad += 1;
      } while (pageToLoad <= totalPages);

      if (options.size !== expectedTotal) {
        throw new Error("INVALID_DATABASE_SERVER_REGISTRY_RESPONSE");
      }

      if (
        generation !== databaseRegistryRequest.current.generation ||
        controller.signal.aborted ||
        actorIdRef.current !== requestedActorId
      ) {
        return;
      }
      setDatabaseServerOptions(
        [...options.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setDatabaseServerOptionsState("ready");
    } catch (caught) {
      if (
        generation !== databaseRegistryRequest.current.generation ||
        controller.signal.aborted ||
        actorIdRef.current !== requestedActorId
      ) {
        return;
      }
      setDatabaseServerOptions([]);
      setDatabaseServerOptionsError(normalizeApiError(caught));
      setDatabaseServerOptionsState("error");
      setServerFilterValue((current) => (current === "ALL" ? current : "ALL"));
    }
  }, [
    isAuthLoading,
    permissions.canRead,
    permissions.canReadDatabaseServers,
    actorId,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTenants(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchTenants]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDatabaseServerOptions(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchDatabaseServerOptions]);

  useEffect(() => {
    const activeRequest = request.current;
    const databaseRequest = databaseRegistryRequest.current;
    const keys = intentKeys.current;
    return () => {
      activeRequest.abort?.abort();
      ++activeRequest.generation;
      databaseRequest.abort?.abort();
      ++databaseRequest.generation;
      keys.clearAll();
    };
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value.slice(0, 200));
  }, []);

  const setStatusFilter = useCallback((value: TenantStatusFilter) => {
    setStatusFilterValue(value);
    setPage(1);
  }, []);

  const setServerFilter = useCallback((value: string) => {
    setServerFilterValue(value);
    setPage(1);
  }, []);

  const openModal = useCallback(
    (tenant: TenantRecord, action: TenantDirectoryModalAction) => {
      const refusal = directoryCommandRefusal(action, tenant, permissions);
      if (refusal) {
        setActionError(refusal);
        return;
      }
      setActionError(null);
      setActiveModalTenant(tenant);
      setModalActionType(action);
    },
    [permissions],
  );

  const closeModal = useCallback(() => {
    if (actionInFlight.current) return;
    if (activeModalTenant && modalActionType) {
      intentKeys.current.clear(
        actionScope(modalActionType, activeModalTenant.id),
      );
    }
    setActiveModalTenant(null);
    setModalActionType(null);
    setActionError(null);
  }, [activeModalTenant, modalActionType]);

  const runAction = useCallback(
    async (
      tenant: TenantRecord,
      action: TenantDirectoryModalAction,
      transport: (key: string) => Promise<void>,
    ) => {
      if (actionInFlight.current) {
        setActionError(
          localError(
            409,
            "TENANT_ACTION_IN_PROGRESS",
            "Another tenant action is already in progress.",
          ),
        );
        return;
      }
      const scope = actionScope(action, tenant.id);
      const key = intentKeys.current.get(scope, {
        tenantId: tenant.id,
        action,
      });
      actionInFlight.current = true;
      setPendingAction({ action, tenantId: tenant.id });
      setActionError(null);
      try {
        await transport(key);
        intentKeys.current.clear(scope);
        setActiveModalTenant(null);
        setModalActionType(null);
        await fetchTenants();
      } catch (caught) {
        const error = normalizeApiError(caught);
        if (!shouldRetainTenantIntentKey(error))
          intentKeys.current.clear(scope);
        setActionError(error);
      } finally {
        actionInFlight.current = false;
        setPendingAction(null);
      }
    },
    [fetchTenants],
  );

  const confirmModalAction = useCallback(async () => {
    const tenant = activeModalTenant;
    const action = modalActionType;
    if (!tenant || !action) return;

    const refusal = directoryCommandRefusal(action, tenant, permissions);
    if (refusal) {
      setActionError(refusal);
    } else {
      await runAction(tenant, action, (key) =>
        sendDirectoryCommand(action, tenant.id, key),
      );
    }
    // A provisioning retry is confirmed once, as in the provisioning
    // workspace: its dialog closes whatever the outcome, and a refusal is
    // shown in the directory banner in that workspace's wording. An uncertain
    // outcome keeps its idempotency key, so confirming the retry again from
    // the row is the exact retry.
    if (action === "reprovision") {
      setActiveModalTenant(null);
      setModalActionType(null);
    }
  }, [activeModalTenant, modalActionType, permissions, runAction]);

  return {
    t,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serverFilter,
    setServerFilter,
    databaseServerOptions,
    databaseServerOptionsState,
    databaseServerOptionsError,
    retryDatabaseServerOptions: fetchDatabaseServerOptions,
    page,
    setPage,
    sortBy,
    sortDir,
    changeSort,
    limit: DEFAULT_PAGE_SIZE,
    tenants,
    totalItems: pagination.total,
    pagination,
    activeModalTenant,
    modalActionType,
    closeModal,
    confirmModalAction,
    openActivateModal: (tenant: TenantRecord) => openModal(tenant, "activate"),
    openSuspendModal: (tenant: TenantRecord) => openModal(tenant, "suspend"),
    openDeleteModal: (tenant: TenantRecord) => openModal(tenant, "delete"),
    openReprovisionModal: (tenant: TenantRecord) =>
      openModal(tenant, "reprovision"),
    refresh: fetchTenants,
    isLoading: isLoading || isAuthLoading,
    loadError,
    actionError,
    clearActionError: () => setActionError(null),
    pendingAction,
    permissions,
  };
}

export function readTenantDirectoryPage(
  payload: unknown,
  expected: { page: number; limit: number },
): TenantDirectoryPage {
  const root = requireRecord(payload);
  if (root.success !== true) invalidDirectoryResponse();
  const rawItems = requireArray(root.data);
  const meta = readPaginationMeta(root.meta);
  if (
    meta.page !== expected.page ||
    meta.limit !== expected.limit ||
    rawItems.length > meta.limit ||
    meta.totalPages !== Math.ceil(meta.total / meta.limit) ||
    meta.hasNext !== meta.page < meta.totalPages ||
    meta.hasPrev !== meta.page > 1
  ) {
    invalidDirectoryResponse();
  }
  return {
    items: rawItems.map(readTenantView).map(toTenantRecord),
    meta,
  };
}

function toTenantRecord(tenant: TenantView): TenantRecord {
  const primary = tenant.fqdns.find((fqdn) => fqdn.isPrimary);
  return {
    id: tenant.id,
    name: tenant.name,
    companyName: tenant.companyName,
    primaryFqdn: primary?.fqdn ?? null,
    secondaryFqdnsCount: tenant.fqdns.filter((fqdn) => !fqdn.isPrimary).length,
    databaseServerName: tenant.databaseServer?.name ?? null,
    databaseServerId: tenant.databaseServer?.id ?? null,
    storageServerId: tenant.storageServerId,
    storageServer: tenant.storageServer ?? null,
    countryName: tenant.countryName,
    countryIsoCode: tenant.countryIsoCode,
    subscriptionStatus: tenant.subscription?.status ?? null,
    seats: tenant.subscription?.effectiveAllowedUsers ?? null,
    status: tenant.status,
    ownerEmail: tenant.ownerEmail,
    createdAt: tenant.createdAt,
  };
}

function readPaginationMeta(value: unknown): TenantDirectoryMeta {
  const meta = requireRecord(value);
  return {
    page: requirePositiveInteger(meta.page),
    limit: requirePositiveInteger(meta.limit),
    total: requireNonNegativeInteger(meta.total),
    totalPages: requireNonNegativeInteger(meta.totalPages),
    hasNext: requireBoolean(meta.hasNext),
    hasPrev: requireBoolean(meta.hasPrev),
  };
}

function readDatabaseServerOption(value: unknown): TenantDatabaseServerOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_DATABASE_SERVER_REGISTRY_RESPONSE");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    !UUID_V7_PATTERN.test(row.id) ||
    typeof row.name !== "string" ||
    row.name.trim().length === 0 ||
    row.name !== row.name.trim() ||
    row.name.length > 120
  ) {
    throw new Error("INVALID_DATABASE_SERVER_REGISTRY_RESPONSE");
  }
  return { id: row.id, name: row.name };
}

function readSuccessData(value: unknown): unknown {
  const root = requireRecord(value);
  if (root.success !== true || !("data" in root)) invalidDirectoryResponse();
  return root.data;
}

interface DirectoryCommandPermissions {
  canSuspendOrActivate: boolean;
  canReprovision: boolean;
  canSoftDelete: boolean;
}

/**
 * Who may run each row command — Core's permission pair for its route, each
 * with `admin.tenants.critical` — and the lifecycle state the directory offers
 * it from. A retry is offered here only after a failed initial provisioning;
 * retrying any other operation is the provisioning workspace's.
 */
const DIRECTORY_COMMANDS: Record<
  TenantDirectoryModalAction,
  {
    permission: keyof DirectoryCommandPermissions;
    acceptsStatus: (status: TenantStatus) => boolean;
  }
> = {
  activate: {
    permission: "canSuspendOrActivate",
    acceptsStatus: (status) => status === "SUSPENDED",
  },
  suspend: {
    permission: "canSuspendOrActivate",
    acceptsStatus: (status) => status === "ACTIVE",
  },
  delete: {
    permission: "canSoftDelete",
    acceptsStatus: (status) => status !== "DELETED",
  },
  reprovision: {
    permission: "canReprovision",
    acceptsStatus: (status) => status === "PROVISIONING_FAILED",
  },
};

/**
 * The local refusal for a row command the actor may not run on this row, or
 * null. Checked when its confirmation opens and again when it is confirmed,
 * so nothing is sent for a row or a permission set that changed meanwhile.
 */
function directoryCommandRefusal(
  action: TenantDirectoryModalAction,
  tenant: TenantRecord,
  permissions: DirectoryCommandPermissions,
): NormalizedApiError | null {
  const command = DIRECTORY_COMMANDS[action];
  const permitted = permissions[command.permission];
  if (permitted && command.acceptsStatus(tenant.status)) return null;
  if (action === "reprovision") {
    return permitted
      ? localError(
          409,
          "TENANT_REPROVISION_UNAVAILABLE",
          "Provisioning can be retried only after provisioning failed.",
        )
      : localError(
          403,
          "TENANT_ACTION_FORBIDDEN",
          "You do not have permission to retry tenant provisioning.",
        );
  }
  return permitted
    ? localError(
        409,
        "TENANT_ACTION_UNAVAILABLE",
        "This tenant action is unavailable for the current lifecycle state.",
      )
    : localError(
        403,
        "TENANT_ACTION_FORBIDDEN",
        "You do not have permission for this tenant action.",
      );
}

/**
 * Sends one confirmed row command and validates Core's answer: the tenant view
 * for activate and suspend, the provisioning command result for a retry, and
 * nothing for the soft delete's 204.
 */
async function sendDirectoryCommand(
  action: TenantDirectoryModalAction,
  tenantId: string,
  idempotencyKey: string,
): Promise<void> {
  const base = `/api/admin/core/v1/tenants/${encodeURIComponent(tenantId)}`;
  if (action === "delete") {
    await axiosClient.delete(base, idempotentWrite(idempotencyKey));
    return;
  }
  const response = await axiosClient.post<unknown>(
    `${base}/${action}`,
    undefined,
    idempotentWrite(idempotencyKey),
  );
  const data = readSuccessData(response.data);
  if (action === "reprovision") readTenantProvisioningCommandResult(data);
  else readTenantView(data);
}

function idempotentWrite(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

function actionScope(action: TenantDirectoryModalAction, tenantId: string) {
  return `directory:${action}:${tenantId}`;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidDirectoryResponse();
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidDirectoryResponse();
  return value;
}

function requireNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalidDirectoryResponse();
  }
  return value;
}

function requirePositiveInteger(value: unknown): number {
  const integer = requireNonNegativeInteger(value);
  if (integer < 1) invalidDirectoryResponse();
  return integer;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalidDirectoryResponse();
  return value;
}

function invalidDirectoryResponse(): never {
  throw new Error("INVALID_TENANT_DIRECTORY_RESPONSE");
}

function localError(
  httpStatus: number,
  errorCode: string,
  message: string,
): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus,
    errorCode,
    errorCategory: httpStatus === 403 ? "AUTHORIZATION" : "CONFLICT",
    message,
  };
}
