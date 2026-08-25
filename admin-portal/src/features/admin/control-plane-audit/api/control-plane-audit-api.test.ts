import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock },
}));

import {
  controlPlaneAuditApi,
  parseControlPlaneAuditPage,
  serializeControlPlaneAuditQuery,
} from "./control-plane-audit-api";

const EVENT = {
  id: "019f0000-0000-7000-8000-000000000001",
  schemaVersion: 1,
  actorType: "SUPER_ADMIN",
  actorId: "019f0000-0000-7000-8000-000000000002",
  actorLabel: "Platform Admin",
  tenantId: null,
  action: "TENANT_UPDATED",
  entityType: "TenantEntity",
  entityId: "019f0000-0000-7000-8000-000000000003",
  outcome: "SUCCESS",
  sourceApp: "CORE",
  sourceType: "LIVE",
  sourceId: null,
  sourceRoute: "/admin/tenants/:id",
  operationId: null,
  correlationId: "019f0000-0000-7000-8000-000000000004",
  requestId: null,
  idempotencyKey: null,
  before: { status: "ACTIVE" },
  after: { status: "SUSPENDED" },
  diff: [{ field: "status", before: "ACTIVE", after: "SUSPENDED" }],
  reason: "Operator request",
  ip: null,
  userAgent: null,
  metadata: null,
  occurredAt: "2026-08-12T08:00:00.000Z",
};

describe("controlPlaneAuditApi", () => {
  beforeEach(() => getMock.mockReset());

  it("serializes only supplied bounded query values", () => {
    expect(serializeControlPlaneAuditQuery({
      page: 2,
      limit: 25,
      actorType: "SUPER_ADMIN",
      entityId: "",
      outcome: undefined,
    })).toBe("?page=2&limit=25&actorType=SUPER_ADMIN");
  });

  it("reads the current Core nested pagination projection", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: { items: [EVENT], total: 26, page: 2, limit: 25, totalPages: 2 },
      },
    });

    const result = await controlPlaneAuditApi.list({
      page: 2,
      limit: 25,
      outcome: "SUCCESS",
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/audit?page=2&limit=25&outcome=SUCCESS",
      { cache: "no-store" },
    );
    expect(result).toMatchObject({
      items: [expect.objectContaining({ action: "TENANT_UPDATED" })],
      total: 26,
      page: 2,
      hasNext: false,
      hasPrev: true,
    });
  });

  it("also accepts the canonical envelope pagination shape", () => {
    expect(parseControlPlaneAuditPage({
      success: true,
      data: [EVENT],
      meta: {
        total: 50,
        page: 1,
        limit: 25,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      },
    })).toMatchObject({ total: 50, hasNext: true, hasPrev: false });
  });

  it("uses the entity-history route and path-encodes both identifiers", async () => {
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: { items: [], total: 0, page: 1, limit: 25, totalPages: 0 },
      },
    });

    await controlPlaneAuditApi.entityHistory(
      "Tenant/Entity",
      "tenant/key",
      { page: 1, limit: 25, actorId: "admin-1" },
    );

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/audit/entities/Tenant%2FEntity/tenant%2Fkey?page=1&limit=25&actorId=admin-1",
      { cache: "no-store" },
    );
  });

  it("fails closed on a malformed event projection", () => {
    expect(() => parseControlPlaneAuditPage({
      success: true,
      data: { items: [{ id: "only-an-id" }], total: 1, page: 1, limit: 25, totalPages: 1 },
    })).toThrow("INVALID_CONTROL_PLANE_AUDIT_RESPONSE");
  });
});
