import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getMock, patchMock, postMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    delete: deleteMock,
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}));

import { tenantAccessApi, toTenantUserSummaryQuery } from "./api";
import {
  BRANCH_ID,
  COMMAND_ID,
  COMPANY_ID,
  DEPARTMENT_ID,
  ROLE_ID,
  TEAM_ID,
  TENANT_ID,
  USER_ID,
  branchFixture,
  departmentFixture,
  envelope,
  pageEnvelope,
  roleFixture,
  summaryFixture,
  teamFixture,
  userPayload,
} from "./__tests__/fixtures";

describe("tenant access API", () => {
  beforeEach(() => {
    deleteMock.mockReset().mockResolvedValue({ status: 204 });
    getMock.mockReset().mockImplementation((url: string) => {
      if (url.includes("/users/summary")) return Promise.resolve(envelope(summaryFixture));
      if (url.includes("/access/roles")) return Promise.resolve(pageEnvelope([roleFixture]));
      if (url.includes("/access/branches")) return Promise.resolve(pageEnvelope([branchFixture]));
      if (url.includes("/access/departments")) return Promise.resolve(pageEnvelope([departmentFixture]));
      if (url.includes("/access/teams")) return Promise.resolve(pageEnvelope([teamFixture]));
      if (url.endsWith("/users") || url.includes("/users?")) {
        return Promise.resolve(pageEnvelope([userPayload()]));
      }
      return Promise.resolve(envelope(userPayload()));
    });
    patchMock.mockReset().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/webphone")
          ? envelope((userPayload().webphone as Record<string, unknown>))
          : envelope(userPayload()),
      ),
    );
    postMock.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("/users")) {
        return Promise.resolve(envelope({ user: userPayload(), delivery: "QUEUED" }));
      }
      if (url.endsWith("/reset-password") || url.endsWith("/resend-invite")) {
        return Promise.resolve(envelope({ userId: USER_ID, delivery: "QUEUED" }));
      }
      return Promise.resolve(envelope(userPayload()));
    });
  });

  it("implements all seven read routes with canonical query names and cancellation", async () => {
    const signal = new AbortController().signal;
    const list = {
      page: 2,
      limit: 50,
      q: "  mona ali  ",
      status: "ACTIVE" as const,
      role: ROLE_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
      teamId: TEAM_ID,
      visibility: "ALL" as const,
      sortBy: "email" as const,
      sortDir: "ASC" as const,
    };
    await tenantAccessApi.listUsers(TENANT_ID, list, signal);
    await tenantAccessApi.summarizeUsers(
      TENANT_ID,
      toTenantUserSummaryQuery(list),
      signal,
    );
    await tenantAccessApi.listRoles(TENANT_ID, { q: "finance", page: 1, limit: 50 }, signal);
    await tenantAccessApi.listBranches(TENANT_ID, { q: "cairo", page: 1, limit: 50 }, signal);
    await tenantAccessApi.listDepartments(TENANT_ID, { branchId: BRANCH_ID, page: 1, limit: 100 }, signal);
    await tenantAccessApi.listTeams(TENANT_ID, { departmentId: DEPARTMENT_ID, page: 1, limit: 100 }, signal);
    await tenantAccessApi.getUser(TENANT_ID, USER_ID, signal);

    const base = `/api/admin/core/v1/tenants/${TENANT_ID}`;
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${base}/users?page=2&limit=50&q=mona+ali&status=ACTIVE&role=${ROLE_ID}&companyId=${COMPANY_ID}&branchId=${BRANCH_ID}&departmentId=${DEPARTMENT_ID}&teamId=${TEAM_ID}&visibility=ALL&sortBy=email&sortDir=ASC`,
      { signal },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${base}/users/summary?q=mona+ali&status=ACTIVE&role=${ROLE_ID}&companyId=${COMPANY_ID}&branchId=${BRANCH_ID}&departmentId=${DEPARTMENT_ID}&teamId=${TEAM_ID}&visibility=ALL`,
      { signal },
    );
    expect(getMock.mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining("/users?"),
      expect.stringContaining("/users/summary?"),
      `${base}/access/roles?q=finance&page=1&limit=50`,
      `${base}/access/branches?q=cairo&page=1&limit=50`,
      `${base}/access/departments?branchId=${BRANCH_ID}&page=1&limit=100`,
      `${base}/access/teams?departmentId=${DEPARTMENT_ID}&page=1&limit=100`,
      `${base}/users/${USER_ID}`,
    ]);
    expect(getMock).toHaveBeenCalledTimes(7);
    expect(getMock.mock.calls.flat().join(" ")).not.toMatch(/includeDeleted|search=/);
  });

  it("implements all eleven write routes with exact verbs and caller-owned keys", async () => {
    const base = `/api/admin/core/v1/tenants/${TENANT_ID}`;
    const user = `${base}/users/${USER_ID}`;
    const invite = {
      email: "mona@example.test",
      firstName: "Mona",
      lastName: "Ali",
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      departmentId: DEPARTMENT_ID,
    };
    await tenantAccessApi.inviteUser(TENANT_ID, invite, COMMAND_ID);
    await tenantAccessApi.updateUser(TENANT_ID, USER_ID, { firstName: "Mona" }, COMMAND_ID);
    await tenantAccessApi.resetPassword(TENANT_ID, USER_ID, COMMAND_ID);
    await tenantAccessApi.resendInvite(TENANT_ID, USER_ID, COMMAND_ID);
    await tenantAccessApi.changePassword(TENANT_ID, USER_ID, { newPassword: "StrongPassword!2026", passwordConfirmation: "StrongPassword!2026" }, COMMAND_ID);
    await tenantAccessApi.updateWebphone(TENANT_ID, USER_ID, { enabled: true, sipPassword: "write-only" }, COMMAND_ID);
    await tenantAccessApi.suspendUser(TENANT_ID, USER_ID, COMMAND_ID);
    await tenantAccessApi.activateUser(TENANT_ID, USER_ID, COMMAND_ID);
    await tenantAccessApi.replaceRoles(TENANT_ID, USER_ID, { assignments: [{ branchId: BRANCH_ID, roleId: ROLE_ID }] }, COMMAND_ID);
    await tenantAccessApi.deleteUser(TENANT_ID, USER_ID, COMMAND_ID);
    await tenantAccessApi.restoreUser(TENANT_ID, USER_ID, COMMAND_ID);

    const config = { headers: { "x-idempotency-key": COMMAND_ID } };
    expect(postMock.mock.calls.map((call) => call[0])).toEqual([
      `${base}/users`,
      `${user}/reset-password`,
      `${user}/resend-invite`,
      `${user}/change-password`,
      `${user}/suspend`,
      `${user}/activate`,
      `${user}/restore`,
    ]);
    expect(patchMock.mock.calls.map((call) => call[0])).toEqual([
      user,
      `${user}/webphone`,
      `${user}/roles`,
    ]);
    expect(deleteMock).toHaveBeenCalledWith(user, config);
    for (const call of postMock.mock.calls) expect(call[2]).toEqual(config);
    for (const call of patchMock.mock.calls) expect(call[2]).toEqual(config);
    expect(postMock).toHaveBeenCalledTimes(7);
    expect(patchMock).toHaveBeenCalledTimes(3);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("sends delivery locale without weakening the stable command identity", async () => {
    await tenantAccessApi.resendInvite(TENANT_ID, USER_ID, COMMAND_ID, "ar");
    expect(postMock.mock.calls[0]?.[2]).toEqual({
      headers: {
        "x-idempotency-key": COMMAND_ID,
        "accept-language": "ar",
      },
    });
  });

  it("refuses non-UUIDv7 mutation identities before transport", async () => {
    await expect(
      tenantAccessApi.deleteUser(TENANT_ID, USER_ID, "random-key"),
    ).rejects.toThrow("INVALID_TENANT_ACCESS_IDEMPOTENCY_KEY");
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
