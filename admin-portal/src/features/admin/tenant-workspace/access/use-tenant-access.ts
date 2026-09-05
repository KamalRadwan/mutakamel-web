"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import type { TenantStatus } from "../core/types";
import { tenantAccessApi, toTenantUserSummaryQuery } from "./api";
import { TenantAccessCommandIdentities } from "./command-identities";
import {
  TENANT_ACCESS_PERMISSION_SETS,
  isDeletedTenantUser,
  isOwnerProtectedCommand,
  isTenantAccessDatabaseReady,
  type CatalogueQuery,
  type ChangeTenantUserPasswordInput,
  type DepartmentCatalogueQuery,
  type InviteTenantUserInput,
  type PageResult,
  type BranchOption,
  type OrganizationOption,
  type ReplaceTenantUserRolesInput,
  type RoleOption,
  type TeamCatalogueQuery,
  type TenantAccessCommandName,
  type TenantAccessCommandState,
  type TenantAccessPermissions,
  type TenantAccessResource,
  type TenantUserListQuery,
  type TenantUserSummary,
  type TenantUserView,
  type UpdateTenantUserInput,
} from "./types";

export interface UseTenantAccessOptions {
  tenantId: string;
  tenantStatus: TenantStatus;
  /** Keep false until the Users/Access tab is active. */
  enabled?: boolean;
  locale?: "ar" | "en";
  initialQuery?: Partial<TenantUserListQuery>;
}

const DEFAULT_QUERY: TenantUserListQuery = {
  page: 1,
  limit: 20,
  visibility: "ACTIVE",
  sortBy: "createdAt",
  sortDir: "DESC",
};

const idleResource = <T,>(): TenantAccessResource<T> => ({
  status: "idle",
  data: null,
  error: null,
});

export function useTenantAccess({
  tenantId,
  tenantStatus,
  enabled = true,
  locale = "en",
  initialQuery,
}: UseTenantAccessOptions) {
  const { user: admin, isLoading: isAuthLoading } = useAuth();
  const [query, setQueryState] = useState<TenantUserListQuery>(() => ({
    ...DEFAULT_QUERY,
    ...initialQuery,
  }));
  const [directory, setDirectory] = useState<
    TenantAccessResource<PageResult<TenantUserView>>
  >(idleResource);
  const [summary, setSummary] = useState<
    TenantAccessResource<TenantUserSummary>
  >(idleResource);
  const [roles, setRoles] = useState<
    TenantAccessResource<PageResult<RoleOption>>
  >(idleResource);
  const [branches, setBranches] = useState<
    TenantAccessResource<PageResult<BranchOption>>
  >(idleResource);
  const [departments, setDepartments] = useState<
    TenantAccessResource<PageResult<OrganizationOption>>
  >(idleResource);
  const [teams, setTeams] = useState<
    TenantAccessResource<PageResult<OrganizationOption>>
  >(idleResource);
  const [selectedUser, setSelectedUser] = useState<
    TenantAccessResource<TenantUserView>
  >(idleResource);
  const [command, setCommand] = useState<TenantAccessCommandState>({
    name: null,
    userId: null,
    pending: false,
    error: null,
  });

  const directoryRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const summaryRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const rolesRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const branchesRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const departmentsRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const teamsRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const userRequest = useRef({ generation: 0, abort: null as AbortController | null });
  const commandIdentities = useRef(new TenantAccessCommandIdentities());
  const selectedBranchId = useRef<string | null>(null);
  const selectedDepartmentId = useRef<string | null>(null);

  const ready = isTenantAccessDatabaseReady(tenantStatus);
  const permissions: TenantAccessPermissions = useMemo(
    () => ({
      canRead: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.read),
      canReadRoles: adminCanAll(
        admin,
        TENANT_ACCESS_PERMISSION_SETS.readRoles,
      ),
      canInvite: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.invite),
      canUpdate: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.update),
      canResetPassword: adminCanAll(
        admin,
        TENANT_ACCESS_PERMISSION_SETS.resetPassword,
      ),
      canSuspend: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.suspend),
      canAssignRoles: adminCanAll(
        admin,
        TENANT_ACCESS_PERMISSION_SETS.assignRoles,
      ),
      canDelete: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.delete),
      canRestore: adminCanAll(admin, TENANT_ACCESS_PERMISSION_SETS.restore),
      canTransferOwnership: adminCanAll(
        admin,
        TENANT_ACCESS_PERMISSION_SETS.transferOwnership,
      ),
    }),
    [admin],
  );

  const readGate = useCallback((): TenantAccessResource<never> | null => {
    if (!enabled) return idleResource();
    if (isAuthLoading) return { status: "loading", data: null, error: null };
    if (!ready) {
      const error = localError(
        503,
        "TENANT_DATABASE_NOT_READY",
        "Tenant database is not ready yet.",
      );
      return { status: "unavailable", data: null, error };
    }
    if (!permissions.canRead) {
      const error = localError(
        403,
        "TENANT_USER_READ_FORBIDDEN",
        "Tenant-user access permission is required.",
      );
      return { status: "forbidden", data: null, error };
    }
    return null;
  }, [enabled, isAuthLoading, permissions.canRead, ready]);

  const refreshDirectory = useCallback(async () => {
    const request = directoryRequest.current;
    const generation = ++request.generation;
    request.abort?.abort();
    const gate = readGate();
    if (gate) {
      setDirectory(gate);
      return;
    }
    const controller = new AbortController();
    request.abort = controller;
    setDirectory((previous) => ({
      status: "loading",
      data: previous.data,
      error: null,
    }));
    try {
      const page = await tenantAccessApi.listUsers(tenantId, query, controller.signal);
      if (generation !== request.generation || controller.signal.aborted) return;
      setDirectory({
        status: page.items.length ? "ready" : "empty",
        data: page,
        error: null,
      });
      if (page.totalPages > 0 && query.page > page.totalPages) {
        setQueryState((current) => ({ ...current, page: page.totalPages }));
      }
    } catch (caught) {
      if (generation !== request.generation || controller.signal.aborted) return;
      setDirectory(resourceError(caught));
    }
  }, [query, readGate, tenantId]);

  const refreshSummary = useCallback(async () => {
    const request = summaryRequest.current;
    const generation = ++request.generation;
    request.abort?.abort();
    const gate = readGate();
    if (gate) {
      setSummary(gate);
      return;
    }
    const controller = new AbortController();
    request.abort = controller;
    setSummary((previous) => ({
      status: "loading",
      data: previous.data,
      error: null,
    }));
    try {
      const result = await tenantAccessApi.summarizeUsers(
        tenantId,
        toTenantUserSummaryQuery(query),
        controller.signal,
      );
      if (generation !== request.generation || controller.signal.aborted) return;
      setSummary({ status: "ready", data: result, error: null });
    } catch (caught) {
      if (generation !== request.generation || controller.signal.aborted) return;
      setSummary(resourceError(caught));
    }
  }, [query, readGate, tenantId]);

  const loadRoles = useCallback(
    async (catalogue: CatalogueQuery = { page: 1, limit: 50 }) => {
      const request = rolesRequest.current;
      const generation = ++request.generation;
      request.abort?.abort();
      const gate = readGate();
      if (gate) {
        setRoles(gate);
        return;
      }
      if (!permissions.canReadRoles) {
        setRoles({
          status: "forbidden",
          data: null,
          error: localError(
            403,
            "TENANT_ROLE_CATALOGUE_FORBIDDEN",
            "Role-assignment permission is required.",
          ),
        });
        return;
      }
      const controller = new AbortController();
      request.abort = controller;
      setRoles((previous) => ({ status: "loading", data: previous.data, error: null }));
      try {
        const page = await tenantAccessApi.listRoles(tenantId, catalogue, controller.signal);
        if (generation !== request.generation || controller.signal.aborted) return;
        setRoles({ status: page.items.length ? "ready" : "empty", data: page, error: null });
      } catch (caught) {
        if (generation !== request.generation || controller.signal.aborted) return;
        setRoles(resourceError(caught));
      }
    },
    [permissions.canReadRoles, readGate, tenantId],
  );

  const loadBranches = useCallback(
    async (catalogue: CatalogueQuery = { page: 1, limit: 50 }) => {
      const request = branchesRequest.current;
      const generation = ++request.generation;
      request.abort?.abort();
      const gate = readGate();
      if (gate) {
        setBranches(gate);
        return;
      }
      const controller = new AbortController();
      request.abort = controller;
      setBranches((previous) => ({ status: "loading", data: previous.data, error: null }));
      try {
        const page = await tenantAccessApi.listBranches(tenantId, catalogue, controller.signal);
        if (generation !== request.generation || controller.signal.aborted) return;
        setBranches({ status: page.items.length ? "ready" : "empty", data: page, error: null });
      } catch (caught) {
        if (generation !== request.generation || controller.signal.aborted) return;
        setBranches(resourceError(caught));
      }
    },
    [readGate, tenantId],
  );

  const loadDepartments = useCallback(
    async (catalogue: DepartmentCatalogueQuery) => {
      const request = departmentsRequest.current;
      const generation = ++request.generation;
      request.abort?.abort();
      const branchChanged = selectedBranchId.current !== catalogue.branchId;
      if (branchChanged) {
        selectedBranchId.current = catalogue.branchId;
        selectedDepartmentId.current = null;
        teamsRequest.current.abort?.abort();
        setTeams(idleResource());
      }
      const gate = readGate();
      if (gate) {
        setDepartments(gate);
        return;
      }
      const controller = new AbortController();
      request.abort = controller;
      setDepartments((previous) => ({
        status: "loading",
        data: branchChanged ? null : previous.data,
        error: null,
      }));
      try {
        const page = await tenantAccessApi.listDepartments(
          tenantId,
          catalogue,
          controller.signal,
        );
        if (generation !== request.generation || controller.signal.aborted) return;
        setDepartments({ status: page.items.length ? "ready" : "empty", data: page, error: null });
      } catch (caught) {
        if (generation !== request.generation || controller.signal.aborted) return;
        setDepartments(resourceError(caught));
      }
    },
    [readGate, tenantId],
  );

  const loadTeams = useCallback(
    async (catalogue: TeamCatalogueQuery) => {
      const request = teamsRequest.current;
      const generation = ++request.generation;
      request.abort?.abort();
      const departmentChanged =
        selectedDepartmentId.current !== catalogue.departmentId;
      selectedDepartmentId.current = catalogue.departmentId;
      const gate = readGate();
      if (gate) {
        setTeams(gate);
        return;
      }
      const controller = new AbortController();
      request.abort = controller;
      setTeams((previous) => ({
        status: "loading",
        data: departmentChanged ? null : previous.data,
        error: null,
      }));
      try {
        const page = await tenantAccessApi.listTeams(tenantId, catalogue, controller.signal);
        if (generation !== request.generation || controller.signal.aborted) return;
        setTeams({ status: page.items.length ? "ready" : "empty", data: page, error: null });
      } catch (caught) {
        if (generation !== request.generation || controller.signal.aborted) return;
        setTeams(resourceError(caught));
      }
    },
    [readGate, tenantId],
  );

  const loadUser = useCallback(
    async (userId: string) => {
      const request = userRequest.current;
      const generation = ++request.generation;
      request.abort?.abort();
      const gate = readGate();
      if (gate) {
        setSelectedUser(gate);
        return;
      }
      const controller = new AbortController();
      request.abort = controller;
      setSelectedUser({ status: "loading", data: null, error: null });
      try {
        const result = await tenantAccessApi.getUser(tenantId, userId, controller.signal);
        if (generation !== request.generation || controller.signal.aborted) return;
        setSelectedUser({ status: "ready", data: result, error: null });
      } catch (caught) {
        if (generation !== request.generation || controller.signal.aborted) return;
        setSelectedUser(resourceError(caught));
      }
    },
    [readGate, tenantId],
  );

  const closeUser = useCallback(() => {
    userRequest.current.abort?.abort();
    ++userRequest.current.generation;
    setSelectedUser(idleResource());
  }, []);

  const setQuery = useCallback(
    (
      next:
        | TenantUserListQuery
        | ((current: TenantUserListQuery) => TenantUserListQuery),
    ) => {
      setQueryState(next);
    },
    [],
  );

  const execute = useCallback(
    async <T,>(
      name: TenantAccessCommandName,
      target: TenantUserView | null,
      allowed: boolean,
      payload: unknown,
      operation: (key: string) => Promise<T>,
    ): Promise<T> => {
      const userId = target?.id ?? null;
      if (!enabled || !ready) {
        const error = localError(
          503,
          "TENANT_DATABASE_NOT_READY",
          "Tenant database is not ready yet.",
        );
        setCommand({ name, userId, pending: false, error });
        throw error;
      }
      if (!allowed) {
        const error = localError(
          403,
          "TENANT_USER_COMMAND_FORBIDDEN",
          "You do not have permission to perform this action.",
        );
        setCommand({ name, userId, pending: false, error });
        throw error;
      }
      if (target?.isTenantOwner && isOwnerProtectedCommand(name)) {
        const error = localError(
          409,
          "TENANT_OWNER_PROTECTED",
          "Tenant-owner identity, access, and lifecycle are protected.",
        );
        setCommand({ name, userId, pending: false, error });
        throw error;
      }
      const intent = { tenantId, name, userId, payload };
      const key = commandIdentities.current.keyFor(intent);
      setCommand({ name, userId, pending: true, error: null });
      try {
        const result = await operation(key);
        commandIdentities.current.complete(intent);
        setCommand({ name: null, userId: null, pending: false, error: null });
        return result;
      } catch (caught) {
        const error = normalizeApiError(caught);
        if (shouldRotateWriteCommandKey(error)) {
          commandIdentities.current.complete(intent);
        }
        setCommand({ name, userId, pending: false, error });
        throw error;
      }
    },
    [enabled, ready, tenantId],
  );

  const refreshAfterWrite = useCallback(
    async (updated?: TenantUserView) => {
      if (updated && selectedUser.data?.id === updated.id) {
        setSelectedUser({ status: "ready", data: updated, error: null });
      }
      await Promise.allSettled([refreshDirectory(), refreshSummary()]);
    },
    [refreshDirectory, refreshSummary, selectedUser.data?.id],
  );

  const inviteUser = useCallback(
    async (input: InviteTenantUserInput) => {
      const result = await execute(
        "invite",
        null,
        permissions.canInvite,
        input,
        (key) => tenantAccessApi.inviteUser(tenantId, input, key, locale),
      );
      await refreshAfterWrite(result.user);
      return result;
    },
    [execute, locale, permissions.canInvite, refreshAfterWrite, tenantId],
  );

  const updateUser = useCallback(
    async (target: TenantUserView, input: UpdateTenantUserInput) => {
      assertUserState(!isDeletedTenantUser(target), "TENANT_USER_IS_DELETED");
      const result = await execute(
        "update",
        target,
        permissions.canUpdate,
        input,
        (key) => tenantAccessApi.updateUser(tenantId, target.id, input, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canUpdate, refreshAfterWrite, tenantId],
  );

  const resetPassword = useCallback(
    async (target: TenantUserView) => {
      assertUserState(
        !isDeletedTenantUser(target) && target.status === "ACTIVE",
        "TENANT_USER_PASSWORD_RESET_UNAVAILABLE",
      );
      return execute(
        "reset-password",
        target,
        permissions.canResetPassword,
        null,
        (key) => tenantAccessApi.resetPassword(tenantId, target.id, key, locale),
      );
    },
    [execute, locale, permissions.canResetPassword, tenantId],
  );

  const resendInvite = useCallback(
    async (target: TenantUserView) => {
      assertUserState(
        !isDeletedTenantUser(target) && target.status === "INVITED",
        "TENANT_USER_INVITE_NOT_PENDING",
      );
      return execute(
        "resend-invite",
        target,
        permissions.canInvite,
        null,
        (key) => tenantAccessApi.resendInvite(tenantId, target.id, key, locale),
      );
    },
    [execute, locale, permissions.canInvite, tenantId],
  );

  const changePassword = useCallback(
    async (target: TenantUserView, input: ChangeTenantUserPasswordInput) => {
      assertUserState(
        !isDeletedTenantUser(target) &&
          target.status !== "INVITED" &&
          target.status !== "DEACTIVATED",
        "TENANT_USER_PASSWORD_CHANGE_UNAVAILABLE",
      );
      const result = await execute(
        "change-password",
        target,
        permissions.canResetPassword,
        input,
        (key) => tenantAccessApi.changePassword(tenantId, target.id, input, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canResetPassword, refreshAfterWrite, tenantId],
  );

  const suspendUser = useCallback(
    async (target: TenantUserView) => {
      assertUserState(
        !isDeletedTenantUser(target) && target.status === "ACTIVE",
        "TENANT_USER_SUSPEND_UNAVAILABLE",
      );
      const result = await execute(
        "suspend",
        target,
        permissions.canSuspend,
        null,
        (key) => tenantAccessApi.suspendUser(tenantId, target.id, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canSuspend, refreshAfterWrite, tenantId],
  );

  const activateUser = useCallback(
    async (target: TenantUserView) => {
      assertUserState(
        !isDeletedTenantUser(target) &&
          (target.status === "SUSPENDED" || target.status === "INVITED"),
        "TENANT_USER_ACTIVATE_UNAVAILABLE",
      );
      const result = await execute(
        "activate",
        target,
        permissions.canSuspend,
        null,
        (key) => tenantAccessApi.activateUser(tenantId, target.id, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canSuspend, refreshAfterWrite, tenantId],
  );

  const transferOwnership = useCallback(
    async (target: TenantUserView, newOwnerUserId: string) => {
      assertUserState(
        !isDeletedTenantUser(target) && target.isTenantOwner,
        "TENANT_OWNER_TRANSFER_INVALID",
      );
      // The destination is the whole command. It travels in the POST body, so
      // it has to travel in the intent too: with `payload: null` a retry that
      // changed the new owner reused the first attempt's key, and the Gateway
      // — which fingerprints the real body — answered the retry that was meant
      // to resolve the ambiguity with `GW.IDEM.MISMATCH`.
      const result = await execute(
        "transfer-ownership",
        target,
        permissions.canTransferOwnership,
        { newOwnerUserId },
        (key) =>
          tenantAccessApi.transferOwnership(
            tenantId,
            target.id,
            newOwnerUserId,
            key,
          ),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [
      execute,
      permissions.canTransferOwnership,
      refreshAfterWrite,
      tenantId,
    ],
  );

  const replaceRoles = useCallback(
    async (target: TenantUserView, input: ReplaceTenantUserRolesInput) => {
      assertUserState(!isDeletedTenantUser(target), "TENANT_USER_IS_DELETED");
      const result = await execute(
        "roles",
        target,
        permissions.canAssignRoles,
        input,
        (key) => tenantAccessApi.replaceRoles(tenantId, target.id, input, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canAssignRoles, refreshAfterWrite, tenantId],
  );

  const deleteUser = useCallback(
    async (target: TenantUserView) => {
      assertUserState(!isDeletedTenantUser(target), "TENANT_USER_ALREADY_DELETED");
      await execute(
        "delete",
        target,
        permissions.canDelete,
        null,
        (key) => tenantAccessApi.deleteUser(tenantId, target.id, key),
      );
      if (selectedUser.data?.id === target.id) closeUser();
      await refreshAfterWrite();
    },
    [closeUser, execute, permissions.canDelete, refreshAfterWrite, selectedUser.data?.id, tenantId],
  );

  const restoreUser = useCallback(
    async (target: TenantUserView) => {
      assertUserState(isDeletedTenantUser(target), "TENANT_USER_NOT_DELETED");
      const result = await execute(
        "restore",
        target,
        permissions.canRestore,
        null,
        (key) => tenantAccessApi.restoreUser(tenantId, target.id, key),
      );
      await refreshAfterWrite(result);
      return result;
    },
    [execute, permissions.canRestore, refreshAfterWrite, tenantId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDirectory();
      void refreshSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshDirectory, refreshSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (enabled && ready && permissions.canRead) void loadBranches();
      if (enabled && ready && permissions.canReadRoles) void loadRoles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, loadBranches, loadRoles, permissions.canRead, permissions.canReadRoles, ready]);

  useEffect(() => {
    commandIdentities.current.clear();
    selectedBranchId.current = null;
    selectedDepartmentId.current = null;
    const requests = [
      directoryRequest.current,
      summaryRequest.current,
      rolesRequest.current,
      branchesRequest.current,
      departmentsRequest.current,
      teamsRequest.current,
      userRequest.current,
    ];
    return () => {
      for (const request of requests) {
        request.abort?.abort();
        ++request.generation;
      }
    };
  }, [tenantId]);

  return {
    tenantId,
    tenantStatus,
    enabled,
    ready,
    isAuthLoading,
    permissions,
    query,
    setQuery,
    directory,
    summary,
    roles,
    branches,
    departments,
    teams,
    selectedUser,
    command,
    refreshDirectory,
    refreshSummary,
    refresh: async () =>
      Promise.allSettled([refreshDirectory(), refreshSummary()]),
    loadRoles,
    loadBranches,
    loadDepartments,
    loadTeams,
    loadUser,
    closeUser,
    inviteUser,
    updateUser,
    resetPassword,
    resendInvite,
    changePassword,
    suspendUser,
    activateUser,
    transferOwnership,
    replaceRoles,
    deleteUser,
    restoreUser,
  };
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
    errorCategory:
      httpStatus === 403
        ? "AUTHORIZATION"
        : httpStatus === 409
          ? "CONFLICT"
          : httpStatus >= 500
            ? "SERVER_ERROR"
            : undefined,
    message,
  };
}

function resourceError<T>(caught: unknown): TenantAccessResource<T> {
  const error = normalizeApiError(caught);
  const status =
    error.httpStatus === 403
      ? "forbidden"
      : error.errorCode === "TENANT_DATABASE_NOT_READY"
        ? "unavailable"
        : "error";
  return { status, data: null, error };
}

function assertUserState(condition: boolean, errorCode: string): asserts condition {
  if (!condition) {
    throw localError(409, errorCode, "This action is unavailable for the current user state.");
  }
}

export type TenantAccessController = ReturnType<typeof useTenantAccess>;
