import { describe, expect, it } from "vitest";
import {
  readBranchPage,
  readOrganizationPage,
  readRolePage,
  readTenantUserDelivery,
  readTenantUserInvitation,
  readTenantUserPage,
  readTenantUserSummary,
  readTenantUserView,
} from "./readers";
import {
  BRANCH_ID,
  COMPANY_ID,
  DEPARTMENT_ID,
  ROLE_ID,
  TEAM_ID,
  USER_ID,
  branchFixture,
  departmentFixture,
  pageFixture,
  roleFixture,
  summaryFixture,
  teamFixture,
  userPayload,
} from "./__tests__/fixtures";

describe("tenant access response readers", () => {
  it("reads the safe user projection from the Core envelope and allowlists fields", () => {
    const source = userPayload({ internalNote: "do-not-copy" });
    const parsed = readTenantUserView({ success: true, data: source });
    expect(parsed).toMatchObject({
      id: USER_ID,
      status: "ACTIVE",
      organization: {
        company: { id: COMPANY_ID },
        branch: { id: BRANCH_ID },
        department: { id: DEPARTMENT_ID },
        team: { id: TEAM_ID },
      },
      roleAssignments: [{ roleId: ROLE_ID }],
    });
    expect(parsed).not.toHaveProperty("internalNote");
  });

  it.each(["sipPassword", "passwordHash", "inviteToken", "resetToken"])(
    "rejects credential material named %s",
    (name) => {
      const source = userPayload();
      (source as Record<string, unknown>)[name] = "secret";
      expect(() => readTenantUserView(source)).toThrow(
        "INVALID_TENANT_USER_RESPONSE",
      );
    },
  );

  it("keeps deletion orthogonal to lifecycle status", () => {
    const parsed = readTenantUserView(
      userPayload({ status: "DEACTIVATED", deletedAt: "2026-08-11T20:00:00.000Z" }),
    );
    expect(parsed.status).toBe("DEACTIVATED");
    expect(parsed.deletedAt).not.toBeNull();
    expect(() => readTenantUserView(userPayload({ status: "DELETED" }))).toThrow();
  });

  it("validates pagination metadata and user rows", () => {
    const canonical = pageFixture([userPayload()]);
    const { items, ...meta } = canonical;
    expect(
      readTenantUserPage({ success: true, data: items, meta }),
    ).toMatchObject({ total: 1, page: 1, hasPrev: false });
    expect(() =>
      readTenantUserPage({ success: true, data: items }),
    ).toThrow("INVALID_TENANT_USER_LIST_RESPONSE");
    expect(() =>
      readTenantUserPage({ ...pageFixture([]), total: 1, totalPages: 0 }),
    ).toThrow("INVALID_TENANT_USER_LIST_RESPONSE");
    expect(() => readTenantUserPage({ ...pageFixture([]), hasPrev: "false" })).toThrow();
  });

  it("reads authoritative summaries", () => {
    expect(readTenantUserSummary({ success: true, data: summaryFixture })).toEqual(
      summaryFixture,
    );
    expect(() =>
      readTenantUserSummary({ ...summaryFixture, active: -1 }),
    ).toThrow("INVALID_TENANT_USER_SUMMARY_RESPONSE");
  });

  it("reads invitation and delivery evidence without tokens", () => {
    expect(
      readTenantUserInvitation({
        success: true,
        data: { user: userPayload(), delivery: "QUEUED" },
      }),
    ).toMatchObject({ user: { id: USER_ID }, delivery: "QUEUED" });
    expect(
      readTenantUserDelivery({ userId: USER_ID, delivery: "ALREADY_QUEUED" }),
    ).toEqual({ userId: USER_ID, delivery: "ALREADY_QUEUED" });
    expect(() =>
      readTenantUserDelivery({ userId: USER_ID, delivery: "SENT" }),
    ).toThrow();
  });

  it("reads each live access catalogue shape", () => {
    expect(readRolePage(pageFixture([roleFixture])).items[0]).toEqual(roleFixture);
    expect(readBranchPage(pageFixture([branchFixture])).items[0]).toEqual(
      branchFixture,
    );
    expect(readOrganizationPage(pageFixture([departmentFixture])).items[0]).toEqual(
      departmentFixture,
    );
    expect(readOrganizationPage(pageFixture([teamFixture])).items[0]).toEqual(
      teamFixture,
    );
  });

  it.each([
    ["id", "not-a-uuid"],
    ["email", "not-an-email"],
    ["createdAt", "yesterday"],
    ["isTenantOwner", "false"],
  ])("rejects invalid user field %s", (field, value) => {
    expect(() => readTenantUserView(userPayload({ [field]: value }))).toThrow();
  });

  /**
   * Per-user WebPhone was removed from Core: the user projection carries no
   * `webphone` object and the summary carries no `webphoneEnabled` count.
   * Requiring either made every reader throw on a real response, so a tenant
   * with even one user answered "The tenant access data could not be loaded."
   * These pin the readers to exactly what the server sends.
   */
  it("reads a user projection that carries no WebPhone object", () => {
    const source = userPayload();
    delete (source as Record<string, unknown>)["webphone"];

    const parsed = readTenantUserView(source);

    expect(parsed.id).toBe(USER_ID);
    expect(parsed).not.toHaveProperty("webphone");
  });

  it("reads a live user page rather than rejecting it", () => {
    const source = userPayload();
    delete (source as Record<string, unknown>)["webphone"];

    expect(readTenantUserPage(pageFixture([source])).items).toHaveLength(1);
  });

  it("reads a summary that carries no WebPhone count", () => {
    const source = { ...summaryFixture } as Record<string, unknown>;
    delete source["webphoneEnabled"];

    expect(readTenantUserSummary({ success: true, data: source })).toEqual(
      summaryFixture,
    );
  });
});
