import { describe, expect, it } from "vitest";
import type { TenantUser } from "../contracts/user-contract";
import {
  EMPTY_USER_FORM,
  isUserFormValid,
  toInviteInput,
  toUpdateInput,
  userToFormValues,
  type UserFormValues,
} from "./user-payloads";

const COMPANY_A = "019f3100-0000-7000-8000-000000000001";
const BRANCH_A = "019f3100-0000-7000-8000-000000000011";
const DEPT_A = "019f3100-0000-7000-8000-000000000021";
const TEAM_A = "019f3100-0000-7000-8000-000000000031";
const MANAGER_A = "019f3100-0000-7000-8000-000000000041";

function baseUser(overrides: Partial<TenantUser> = {}): TenantUser {
  return {
    id: "019f3100-0000-7000-8000-000000000099",
    email: "sara@example.com",
    firstName: "Sara",
    lastName: "Mansour",
    employeeCode: "EMP-10",
    jobTitle: "Operations Lead",
    companyId: COMPANY_A,
    branchId: BRANCH_A,
    departmentId: DEPT_A,
    teamId: TEAM_A,
    managerId: MANAGER_A,
    status: "ACTIVE",
    isTenantOwner: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("user-payloads", () => {
  it("normalises invite payloads and omits blank optional fields", () => {
    const draft: UserFormValues = {
      ...EMPTY_USER_FORM,
      email: "  Sara.Mansour@Example.COM ",
      firstName: "  Sara ",
      lastName: " Mansour  ",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      employeeCode: "   ",
      jobTitle: "",
      teamId: "",
      managerId: "",
    };

    const payload = toInviteInput(draft);
    expect(payload).toEqual({
      email: "sara.mansour@example.com",
      firstName: "Sara",
      lastName: "Mansour",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
    });
    expect("teamId" in payload).toBe(false);
    expect("managerId" in payload).toBe(false);
    expect("employeeCode" in payload).toBe(false);
    expect("jobTitle" in payload).toBe(false);
  });

  it("includes optional invite fields when populated", () => {
    const payload = toInviteInput({
      email: "user@example.com",
      firstName: "Omar",
      lastName: "Saleh",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      teamId: TEAM_A,
      managerId: MANAGER_A,
      employeeCode: " EMP_01 ",
      jobTitle: " Specialist ",
    });

    expect(payload).toEqual({
      email: "user@example.com",
      firstName: "Omar",
      lastName: "Saleh",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      teamId: TEAM_A,
      managerId: MANAGER_A,
      employeeCode: "EMP_01",
      jobTitle: "Specialist",
    });
  });

  it("omits email on update, sends explicit null when clearing team/manager, and omits unchanged nullable IDs", () => {
    const loaded = baseUser();
    const cleared = toUpdateInput(loaded, {
      ...userToFormValues(loaded),
      email: "tampered@example.com",
      teamId: "",
      managerId: "",
      employeeCode: "  ",
      jobTitle: "",
    });

    expect("email" in cleared).toBe(false);
    expect(cleared).toEqual({
      firstName: "Sara",
      lastName: "Mansour",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
      employeeCode: "",
      jobTitle: "",
      teamId: null,
      managerId: null,
    });

    const unchanged = toUpdateInput(loaded, {
      ...userToFormValues(loaded),
      firstName: "Sara Updated",
    });
    expect("email" in unchanged).toBe(false);
    expect("teamId" in unchanged).toBe(false);
    expect("managerId" in unchanged).toBe(false);
    expect(unchanged.firstName).toBe("Sara Updated");
  });

  it("validates required placement, invite email, and employeeCode pattern", () => {
    const validInvite: UserFormValues = {
      ...EMPTY_USER_FORM,
      email: "valid@example.com",
      firstName: "Nour",
      lastName: "Ali",
      companyId: COMPANY_A,
      branchId: BRANCH_A,
      departmentId: DEPT_A,
    };

    expect(isUserFormValid("invite", validInvite)).toBe(true);
    expect(isUserFormValid("invite", { ...validInvite, email: "bad-email" })).toBe(false);
    expect(isUserFormValid("edit", { ...validInvite, email: "" })).toBe(true);
    expect(isUserFormValid("invite", { ...validInvite, departmentId: "" })).toBe(false);
    expect(
      isUserFormValid("invite", { ...validInvite, employeeCode: "BAD SPACE!" }),
    ).toBe(false);
    expect(
      isUserFormValid("invite", { ...validInvite, employeeCode: "EMP.2026_A-1" }),
    ).toBe(true);
  });
});
