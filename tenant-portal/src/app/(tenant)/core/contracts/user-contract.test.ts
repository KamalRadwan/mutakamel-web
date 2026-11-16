import { beforeEach, describe, expect, it, vi } from "vitest";
import { CORE_WRITE_RESPONSE_LIMIT_BYTES } from "./core-page";

const { writeCoreDataMock } = vi.hoisted(() => ({
  writeCoreDataMock: vi.fn(),
}));

vi.mock("@/lib/api/envelope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/envelope")>(
    "@/lib/api/envelope",
  );
  return {
    ...actual,
    writeCoreData: writeCoreDataMock,
  };
});

import {
  parseResendInviteResult,
  resendTenantUserInvite,
  revokeTenantUserSessions,
  setTenantUserStatus,
} from "./user-contract";

const USER_ID = "0199f2b0-1111-7222-8333-444455556666";
const COMPANY_ID = "0199f2b0-1111-7222-8333-444455556667";
const BRANCH_ID = "0199f2b0-1111-7222-8333-444455556668";
const DEPT_ID = "0199f2b0-1111-7222-8333-444455556669";
const UUID_V4 = "550e8400-e29b-41d4-a716-446655440000";
const NOW = "2026-11-01T10:00:00.000Z";

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "member@example.test",
    firstName: "Nour",
    lastName: "Hassan",
    employeeCode: null,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    departmentId: DEPT_ID,
    teamId: null,
    managerId: null,
    jobTitle: null,
    isTenantOwner: false,
    status: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("user-contract resend and session revocation", () => {
  beforeEach(() => {
    writeCoreDataMock.mockReset();
  });

  it("validates resend-invite payload strictly as QUEUED", () => {
    expect(parseResendInviteResult({ deliveryStatus: "QUEUED" })).toEqual({
      deliveryStatus: "QUEUED",
    });
    expect(() => parseResendInviteResult({ deliveryStatus: "SENT" })).toThrow();
    expect(() => parseResendInviteResult({ deliveryStatus: "DELIVERED" })).toThrow();
    expect(() => parseResendInviteResult({ deliveryStatus: "queued" })).toThrow();
    expect(() => parseResendInviteResult({})).toThrow();
    expect(() => parseResendInviteResult(null)).toThrow();
    expect(() => parseResendInviteResult(undefined)).toThrow();
    expect(() => parseResendInviteResult(123)).toThrow();
    expect(() => parseResendInviteResult(["QUEUED"])).toThrow();
  });

  it("posts resend-invite to the canonical Gateway path", async () => {
    writeCoreDataMock.mockResolvedValueOnce({ deliveryStatus: "QUEUED" });

    const result = await resendTenantUserInvite(USER_ID);

    expect(result).toEqual({ deliveryStatus: "QUEUED" });
    expect(writeCoreDataMock).toHaveBeenCalledTimes(1);
    expect(writeCoreDataMock).toHaveBeenCalledWith(
      "post",
      `/api/tenant/core/v1/users/${USER_ID}/resend-invite`,
      undefined,
      {
        cache: "no-store",
        maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
      },
    );
  });

  it("rejects resend-invite when the server returns a malformed body or non-UUIDv7 user id", async () => {
    await expect(resendTenantUserInvite(UUID_V4)).rejects.toThrow();
    expect(writeCoreDataMock).not.toHaveBeenCalled();

    writeCoreDataMock.mockResolvedValueOnce({ deliveryStatus: "DELIVERED" });
    await expect(resendTenantUserInvite(USER_ID)).rejects.toThrow();
  });

  it("posts sessions/revoke to the canonical Gateway path and preserves the returned lifecycle status", async () => {
    writeCoreDataMock.mockResolvedValueOnce(userFixture({ status: "ACTIVE" }));
    const active = await revokeTenantUserSessions(USER_ID);
    expect(active.id).toBe(USER_ID);
    expect(active.status).toBe("ACTIVE");
    expect(writeCoreDataMock).toHaveBeenCalledWith(
      "post",
      `/api/tenant/core/v1/users/${USER_ID}/sessions/revoke`,
      undefined,
      {
        cache: "no-store",
        maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
      },
    );

    writeCoreDataMock.mockResolvedValueOnce(userFixture({ status: "INVITED" }));
    const invited = await revokeTenantUserSessions(USER_ID);
    expect(invited.status).toBe("INVITED");

    writeCoreDataMock.mockResolvedValueOnce(userFixture({ status: "SUSPENDED" }));
    const suspended = await revokeTenantUserSessions(USER_ID);
    expect(suspended.status).toBe("SUSPENDED");
  });

  it("propagates denied or failed server writes unchanged for resend-invite and sessions/revoke", async () => {
    const forbiddenError = Object.assign(new Error("TARGET_AUTHORITY_EXCEEDS_ACTOR"), {
      status: 403,
      code: "TARGET_AUTHORITY_EXCEEDS_ACTOR",
    });
    writeCoreDataMock.mockRejectedValueOnce(forbiddenError);
    await expect(resendTenantUserInvite(USER_ID)).rejects.toBe(forbiddenError);

    const ownerProtectedError = Object.assign(new Error("TENANT_OWNER_PROTECTED"), {
      status: 409,
      code: "TENANT_OWNER_PROTECTED",
    });
    writeCoreDataMock.mockRejectedValueOnce(ownerProtectedError);
    await expect(revokeTenantUserSessions(USER_ID)).rejects.toBe(ownerProtectedError);
  });

  it("rejects sessions/revoke on non-UUIDv7 user ids or invalid TenantUser payloads", async () => {
    await expect(revokeTenantUserSessions("not-a-uuid")).rejects.toThrow();
    expect(writeCoreDataMock).not.toHaveBeenCalled();

    writeCoreDataMock.mockResolvedValueOnce({ id: USER_ID });
    await expect(revokeTenantUserSessions(USER_ID)).rejects.toThrow();
  });

  it("preserves authoritative status on activate whether Core returns ACTIVE or INVITED", async () => {
    writeCoreDataMock.mockResolvedValueOnce(userFixture({ status: "ACTIVE" }));
    const active = await setTenantUserStatus(USER_ID, "activate");
    expect(active.status).toBe("ACTIVE");

    writeCoreDataMock.mockResolvedValueOnce(userFixture({ status: "INVITED" }));
    const invited = await setTenantUserStatus(USER_ID, "activate");
    expect(invited.status).toBe("INVITED");
  });
});
