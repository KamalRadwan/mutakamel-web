// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, databaseServersMock, generateMock } = vi.hoisted(
  () => ({
    apiMock: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
    authMock: {
      user: null as {
        isSuperAdmin: boolean;
        permissions: string[];
      } | null,
      isLoading: false,
    },
    databaseServersMock: {
      list: vi.fn(),
    },
    generateMock: vi.fn(),
  }),
);

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: apiMock }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/features/admin/database-servers/api/database-servers.api", () => ({
  databaseServersApi: databaseServersMock,
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: generateMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { tenants: {} } }),
}));

import { readTenantDirectoryPage, useTenants } from "./useTenants";
import {
  DATABASE_ID,
  OPERATION_ID,
  TENANT_ID,
  tenantPayload,
} from "@/features/admin/tenant-workspace/core/__tests__/fixtures";

const COMMAND_ID = "019ff251-7777-7777-8777-777777777777";
const NEXT_COMMAND_ID = "019ff251-8888-7888-8888-888888888888";
const SECOND_DATABASE_ID = "019ff251-9999-7999-8999-999999999999";

describe("tenant directory response contract", () => {
  it("reads the canonical data/meta envelope and strips untrusted projection fields", () => {
    const result = readTenantDirectoryPage(directoryEnvelope(), {
      page: 1,
      limit: 10,
    });

    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(result.items[0]).toMatchObject({
      id: TENANT_ID,
      status: "ACTIVE",
      databaseServerId: DATABASE_ID,
      databaseServerName: "Postgres Cairo",
      primaryFqdn: "acme.mutakamel.ai",
    });
    expect(result.items[0].storageServer).toEqual({
      id: "019ff251-2222-7222-8222-222222222222",
      code: "garage-cairo-1",
      name: "Garage Cairo",
      region: "af-cairo-1",
      status: "ACTIVE",
    });
  });

  it.each([
    ["wrong success marker", { success: false }],
    ["missing canonical hasPrev", { meta: { hasPrev: undefined } }],
    [
      "legacy hasPrevious",
      { meta: { hasPrev: undefined, hasPrevious: false } },
    ],
    ["wrong requested page", { meta: { page: 2 } }],
    ["incoherent total pages", { meta: { totalPages: 2 } }],
    ["incoherent hasNext", { meta: { hasNext: true } }],
    [
      "oversized page data",
      { data: Array.from({ length: 11 }, () => tenantPayload()) },
    ],
  ])("rejects %s", (_name, mutation) => {
    const canonical = directoryEnvelope();
    const mutated = {
      ...canonical,
      ...mutation,
      meta: {
        ...canonical.meta,
        ...((mutation as { meta?: Record<string, unknown> }).meta ?? {}),
      },
    };

    expect(() =>
      readTenantDirectoryPage(mutated, { page: 1, limit: 10 }),
    ).toThrow("INVALID_TENANT_DIRECTORY_RESPONSE");
  });
});

describe("useTenants", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.delete.mockReset();
    databaseServersMock.list.mockReset();
    generateMock.mockReset();
    generateMock
      .mockReturnValueOnce(COMMAND_ID)
      .mockReturnValue(NEXT_COMMAND_ID);
    authMock.user = {
      isSuperAdmin: false,
      permissions: allDirectoryPermissions(),
    };
    authMock.isLoading = false;
    apiMock.get.mockResolvedValue({ data: directoryEnvelope() });
    databaseServersMock.list.mockResolvedValue(databaseRegistryPage());
  });

  it("waits for auth and never reads without admin.tenants.read", async () => {
    authMock.user = null;
    authMock.isLoading = true;
    const { result, rerender } = renderHook(() => useTenants());

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(apiMock.get).not.toHaveBeenCalled();

    authMock.user = { isSuperAdmin: false, permissions: [] };
    authMock.isLoading = false;
    rerender();

    await waitFor(() =>
      expect(result.current.loadError).toMatchObject({
        httpStatus: 403,
        errorCode: "TENANT_DIRECTORY_FORBIDDEN",
      }),
    );
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(databaseServersMock.list).not.toHaveBeenCalled();
    expect(result.current.databaseServerOptions).toEqual([]);
  });

  it("uses the exact read query, authoritative pagination, and real server IDs", async () => {
    const { result } = renderHook(() => useTenants());

    await waitFor(() => expect(result.current.tenants).toHaveLength(1));
    expect(apiMock.get).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants?page=1&limit=10&sortBy=createdAt&sortDir=DESC",
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.totalItems).toBe(1);
    expect(result.current.pagination).toMatchObject({
      page: 1,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    await waitFor(() =>
      expect(result.current.databaseServerOptionsState).toBe("ready"),
    );
    expect(databaseServersMock.list).toHaveBeenCalledWith(
      { page: 1, limit: 100, sortBy: "name", sortDir: "ASC" },
      expect.any(AbortSignal),
    );
    expect(result.current.databaseServerOptions).toEqual([
      { id: SECOND_DATABASE_ID, name: "Postgres Alexandria" },
      { id: DATABASE_ID, name: "Postgres Cairo" },
    ]);
    expect(result.current.databaseServerOptions[0]?.id).not.toMatch(/^srv-/);
  });

  it("keeps tenant results trustworthy when the independent registry is unavailable", async () => {
    databaseServersMock.list.mockRejectedValue({
      response: {
        status: 503,
        data: {
          title: "Registry unavailable",
          status: 503,
          code: "GW.UPSTREAM_UNAVAILABLE",
          correlationId: "019ff251-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
        },
      },
    });
    const { result } = renderHook(() => useTenants());

    await waitFor(() => expect(result.current.tenants).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.databaseServerOptionsState).toBe("error"),
    );
    expect(result.current.loadError).toBeNull();
    expect(result.current.databaseServerOptions).toEqual([]);
    expect(result.current.databaseServerOptionsError).toMatchObject({
      httpStatus: 503,
      errorCode: "GW.UPSTREAM_UNAVAILABLE",
    });
  });

  it("sends only real Core filters and the exact PROVISIONING_FAILED status", async () => {
    apiMock.get.mockImplementation((url: string) => {
      const page = Number(
        new URL(url, "http://local").searchParams.get("page"),
      );
      return Promise.resolve({ data: directoryEnvelope({ page }) });
    });
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    apiMock.get.mockClear();

    act(() => {
      result.current.setStatusFilter("PROVISIONING_FAILED");
      result.current.setServerFilter(DATABASE_ID);
      result.current.setSearch("  Acme owner@example.com  ");
    });

    await waitFor(
      () => {
        const url = lastGetUrl();
        const params = new URL(url, "http://local").searchParams;
        expect(params.get("status")).toBe("PROVISIONING_FAILED");
        expect(params.get("databaseServerId")).toBe(DATABASE_ID);
        expect(params.get("search")).toBe("Acme owner@example.com");
        expect(url).not.toContain("status=FAILED");
        expect(url).not.toContain("fqdn");
      },
      { timeout: 1_500 },
    );
  });

  it("ignores an older response after a newer page request wins", async () => {
    const first = deferred<{ data: ReturnType<typeof directoryEnvelope> }>();
    const second = deferred<{ data: ReturnType<typeof directoryEnvelope> }>();
    apiMock.get
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(1));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
    second.resolve({
      data: directoryEnvelope({
        page: 2,
        total: 11,
        totalPages: 2,
        hasPrev: true,
        items: [tenantPayload("SUSPENDED")],
      }),
    });
    await waitFor(() =>
      expect(result.current.tenants[0]?.status).toBe("SUSPENDED"),
    );

    first.resolve({ data: directoryEnvelope() });
    await act(async () => await first.promise);
    expect(result.current.page).toBe(2);
    expect(result.current.tenants[0]?.status).toBe("SUSPENDED");
  });

  it.each([
    ["suspend", "ACTIVE", "SUSPENDED"],
    ["activate", "SUSPENDED", "ACTIVE"],
  ] as const)(
    "dispatches canonical %s with an explicit caller UUIDv7",
    async (actionName, initialStatus, responseStatus) => {
      apiMock.get.mockResolvedValue({
        data: directoryEnvelope({ items: [tenantPayload(initialStatus)] }),
      });
      apiMock.post.mockResolvedValue({
        data: successEnvelope(tenantPayload(responseStatus)),
      });
      const { result } = renderHook(() => useTenants());
      await waitFor(() => expect(result.current.tenants).toHaveLength(1));

      act(() => {
        if (actionName === "suspend") {
          result.current.openSuspendModal(result.current.tenants[0]);
        } else {
          result.current.openActivateModal(result.current.tenants[0]);
        }
      });
      await act(async () => await result.current.confirmModalAction());

      expect(apiMock.post).toHaveBeenCalledWith(
        `/api/admin/core/v1/tenants/${TENANT_ID}/${actionName}`,
        undefined,
        { headers: { "x-idempotency-key": COMMAND_ID } },
      );
      expect(COMMAND_ID).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    },
  );

  it("soft-deletes through DELETE with delete+critical, never destroy", async () => {
    apiMock.delete.mockResolvedValue({ data: undefined });
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.tenants).toHaveLength(1));

    act(() => result.current.openDeleteModal(result.current.tenants[0]));
    await act(async () => await result.current.confirmModalAction());

    expect(apiMock.delete).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}`,
      { headers: { "x-idempotency-key": COMMAND_ID } },
    );
    expect(result.current.permissions.canSoftDelete).toBe(true);
  });

  it("uses canonical reprovision and reuses the same key after an ambiguous 503", async () => {
    apiMock.get.mockResolvedValue({
      data: directoryEnvelope({
        items: [tenantPayload("PROVISIONING_FAILED")],
      }),
    });
    apiMock.post
      .mockRejectedValueOnce(ambiguous503())
      .mockResolvedValueOnce({ data: successEnvelope(provisioningCommand()) });
    const { result } = renderHook(() => useTenants());
    await waitFor(() =>
      expect(result.current.tenants[0]?.status).toBe("PROVISIONING_FAILED"),
    );
    const failedTenant = result.current.tenants[0];

    await act(async () => await result.current.handleReprovision(failedTenant));
    expect(result.current.actionError).toMatchObject({
      httpStatus: 503,
      errorCode: "TENANT_DATABASE_NOT_READY",
    });
    await act(async () => await result.current.handleReprovision(failedTenant));

    expect(apiMock.post).toHaveBeenCalledTimes(2);
    expect(apiMock.post.mock.calls.map((call) => call[0])).toEqual([
      `/api/admin/core/v1/tenants/${TENANT_ID}/reprovision`,
      `/api/admin/core/v1/tenants/${TENANT_ID}/reprovision`,
    ]);
    expect(apiMock.post.mock.calls.map((call) => call[2]?.headers)).toEqual([
      { "x-idempotency-key": COMMAND_ID },
      { "x-idempotency-key": COMMAND_ID },
    ]);
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(apiMock.post.mock.calls.flat().join(" ")).not.toContain("reconcile");
  });

  it("enforces exact ALL permissions and lifecycle states before transport", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.tenants.read",
        "admin.tenants.create",
        "admin.tenants.suspend",
        "admin.tenants.reprovision",
        "admin.tenants.delete",
        "admin.tenants.destroy",
      ],
    };
    apiMock.get.mockResolvedValue({
      data: directoryEnvelope({
        items: [tenantPayload("PROVISIONING_FAILED")],
      }),
    });
    const { result } = renderHook(() => useTenants());
    await waitFor(() => expect(result.current.tenants).toHaveLength(1));

    expect(result.current.permissions).toEqual({
      canRead: true,
      canCreate: true,
      canReadDatabaseServers: false,
      canSuspendOrActivate: false,
      canReprovision: false,
      canSoftDelete: false,
    });
    await act(
      async () =>
        await result.current.handleReprovision(result.current.tenants[0]),
    );
    act(() => result.current.openDeleteModal(result.current.tenants[0]));

    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
    expect(result.current.actionError).toMatchObject({
      httpStatus: 403,
      errorCode: "TENANT_ACTION_FORBIDDEN",
    });
  });
});

function directoryEnvelope(
  overrides: {
    page?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    items?: Record<string, unknown>[];
  } = {},
) {
  return {
    success: true as const,
    data: overrides.items ?? [tenantPayload()],
    meta: {
      page: overrides.page ?? 1,
      limit: 10,
      total: overrides.total ?? 1,
      totalPages: overrides.totalPages ?? 1,
      hasNext: overrides.hasNext ?? false,
      hasPrev: overrides.hasPrev ?? false,
    },
    correlationId: "019ff251-9999-7999-8999-999999999999",
    timestamp: "2026-08-11T19:33:49.000Z",
  };
}

function successEnvelope(data: unknown) {
  return {
    success: true,
    data,
    correlationId: "019ff251-9999-7999-8999-999999999999",
    timestamp: "2026-08-11T19:33:49.000Z",
  };
}

function provisioningCommand() {
  return {
    replayed: false,
    operation: {
      id: OPERATION_ID,
      tenantId: TENANT_ID,
      generation: 2,
      type: "RETRY",
      status: "QUEUED",
      currentPhase: "PLAN",
      updatedAt: "2026-08-11T19:33:49.000Z",
    },
  };
}

function ambiguous503() {
  return {
    response: {
      status: 503,
      data: {
        success: false,
        statusCode: 503,
        errorCode: "TENANT_DATABASE_NOT_READY",
        errorCategory: "SERVER_ERROR",
        message: "Tenant database is not ready yet.",
        correlationId: "019ff251-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
      },
    },
  };
}

function allDirectoryPermissions() {
  return [
    "admin.tenants.read",
    "admin.tenants.create",
    "admin.database_servers.read",
    "admin.tenants.suspend",
    "admin.tenants.reprovision",
    "admin.tenants.delete",
    "admin.tenants.critical",
  ];
}

function databaseRegistryPage() {
  return {
    data: [
      { id: DATABASE_ID, name: "Postgres Cairo" },
      { id: SECOND_DATABASE_ID, name: "Postgres Alexandria" },
    ],
    meta: {
      page: 1,
      limit: 100,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

function lastGetUrl(): string {
  const value = apiMock.get.mock.calls.at(-1)?.[0];
  if (typeof value !== "string") throw new Error("TENANT_GET_NOT_CALLED");
  return value;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
