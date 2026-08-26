import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { rolesApi, serializeRoleListQuery } from "./api";
import { readRolesPage, RoleContractError } from "./contract";

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const ROLE_ID = "019f0000-0000-7000-8000-000000000001";
const PERMISSION_ID = "019f0000-0000-7000-8000-000000000002";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000003";
const CORRELATION_ID = "019f0000-0000-7000-8000-000000000004";
const TIMESTAMP = "2026-08-12T10:00:00.000Z";

const role = {
  id: ROLE_ID,
  name: "Billing Manager",
  description: null,
  isSystem: false,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  rolePermissions: [{ permissionId: PERMISSION_ID }],
};

const roleEnvelope = {
  success: true,
  data: role,
  correlationId: CORRELATION_ID,
  timestamp: TIMESTAMP,
};

describe("roles API contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serializes only the supported server pagination and type filters", () => {
    expect(
      serializeRoleListQuery({ page: 2, limit: 20, isSystem: false }),
    ).toBe("?page=2&limit=20&sortBy=createdAt&sortDir=DESC&isSystem=false");
    expect(serializeRoleListQuery({ page: 1, limit: 20 })).not.toContain(
      "search",
    );
    expect(() => serializeRoleListQuery({ page: 0, limit: 20 })).toThrow(
      "INVALID_ROLE_LIST_QUERY",
    );
  });

  it("reads authoritative server pagination and rejects inconsistent totals", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      data: {
        success: true,
        data: [role],
        meta: {
          page: 2,
          limit: 20,
          total: 21,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
        correlationId: CORRELATION_ID,
        timestamp: TIMESTAMP,
      },
    } as never);

    const result = await rolesApi.list({ page: 2, limit: 20 });
    expect(result).toMatchObject({ page: 2, total: 21, totalPages: 2 });
    expect(result.items[0]?.permissionIds).toEqual([PERMISSION_ID]);
    expect(axiosClient.get).toHaveBeenCalledWith(
      "/api/admin/core/v1/roles?page=2&limit=20&sortBy=createdAt&sortDir=DESC",
      { cache: "no-store" },
    );

    expect(() =>
      readRolesPage({
        success: true,
        data: [role],
        meta: {
          page: 1,
          limit: 20,
          total: 21,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        correlationId: CORRELATION_ID,
        timestamp: TIMESTAMP,
      }),
    ).toThrow(RoleContractError);
  });

  it("sends explicit null when clearing a description and reconciles the response", async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: roleEnvelope } as never);
    const result = await rolesApi.update(
      ROLE_ID,
      { name: "Billing Manager", description: null },
      COMMAND_ID,
    );

    expect(axiosClient.patch).toHaveBeenCalledWith(
      `/api/admin/core/v1/roles/${ROLE_ID}`,
      { name: "Billing Manager", description: null },
      keyedConfig(),
    );
    expect(result.data.description).toBeNull();
  });

  it("uses the exact critical replacement route with a caller-owned UUIDv7", async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: roleEnvelope } as never);
    await rolesApi.replacePermissions(
      ROLE_ID,
      { permissionIds: [PERMISSION_ID] },
      COMMAND_ID,
    );
    expect(axiosClient.patch).toHaveBeenCalledWith(
      `/api/admin/core/v1/roles/${ROLE_ID}/permissions`,
      { permissionIds: [PERMISSION_ID] },
      keyedConfig(),
    );
  });

  it("keys create and delete writes and rejects non-v7 identities", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: roleEnvelope } as never);
    vi.mocked(axiosClient.delete).mockResolvedValue({} as never);
    await rolesApi.create({ name: "Billing Manager" }, COMMAND_ID);
    await rolesApi.remove(ROLE_ID, COMMAND_ID);

    expect(axiosClient.post).toHaveBeenCalledWith(
      "/api/admin/core/v1/roles",
      { name: "Billing Manager" },
      keyedConfig(),
    );
    expect(axiosClient.delete).toHaveBeenCalledWith(
      `/api/admin/core/v1/roles/${ROLE_ID}`,
      keyedConfig(),
    );
    await expect(rolesApi.remove("not-a-role-id", COMMAND_ID)).rejects.toThrow(
      "INVALID_ROLE_ID",
    );
    await expect(
      rolesApi.create({ name: "x" }, COMMAND_ID),
    ).rejects.toThrow("INVALID_CREATE_ROLE_COMMAND");
  });
});

function keyedConfig() {
  return {
    headers: { "x-idempotency-key": COMMAND_ID },
    skipAutoIdempotency: true,
    replayAfterRefresh: true,
    cache: "no-store",
  };
}
