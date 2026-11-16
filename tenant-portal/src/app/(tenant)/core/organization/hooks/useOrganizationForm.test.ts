// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import {
  buildCreateBody,
  buildUpdateBody,
  EMPTY_ORG_NODE_FORM,
} from "../organization-payloads";
import { useOrganizationForm } from "./useOrganizationForm";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

const parentId = "01900100-0000-7000-8000-000000000002";
const leadUserId = "01900100-0000-7000-8000-000000000003";
const companyId = "01900100-0000-7000-8000-000000000010";
const branchId = "01900100-0000-7000-8000-000000000020";
const departmentId = "01900100-0000-7000-8000-000000000030";

afterEach(cleanup);

describe("useOrganizationForm and organization-payloads", () => {
  it("excludes create-only and unrelated fields on update and sends only direct parent ids on create", () => {
    const updateBody = buildUpdateBody("teams", {
      ...EMPTY_ORG_NODE_FORM,
      name: " Team ",
      code: "IMMUTABLE",
      companyId,
      branchId,
      departmentId,
      parentId,
      leadUserId: ` ${leadUserId} `,
      address: "Unrelated",
    });
    expect(updateBody).toEqual({ name: "Team", status: "ACTIVE", leadUserId });
    expect(updateBody).not.toHaveProperty("code");
    expect(updateBody).not.toHaveProperty("departmentId");
    expect(updateBody).not.toHaveProperty("companyId");
    expect(updateBody).not.toHaveProperty("branchId");

    const deptBody = buildCreateBody("departments", {
      ...EMPTY_ORG_NODE_FORM,
      companyId,
      branchId,
      code: " ops ",
      name: " Operations ",
    });
    expect(deptBody).toEqual({ code: "OPS", name: "Operations", branchId });
    expect(deptBody).not.toHaveProperty("companyId");

    const teamBody = buildCreateBody("teams", {
      ...EMPTY_ORG_NODE_FORM,
      companyId,
      branchId,
      departmentId,
      code: " sales ",
      name: " Sales ",
      leadUserId,
    });
    expect(teamBody).toEqual({ code: "SALES", name: "Sales", departmentId, leadUserId });
    expect(teamBody).not.toHaveProperty("companyId");
    expect(teamBody).not.toHaveProperty("branchId");
  });

  it("resets descendant ids in useOrganizationForm when upstream cascade selection changes", () => {
    const { result } = renderHook(() => useOrganizationForm("teams", "create"));
    act(() => result.current.patch({ companyId, branchId, departmentId }));
    expect(result.current.form.parentId).toBe(departmentId);

    act(() => {
      result.current.patch({
        companyId: "01900100-0000-7000-8000-000000000099",
        branchId: "",
        departmentId: "",
      });
    });
    expect(result.current.form.branchId).toBe("");
    expect(result.current.form.departmentId).toBe("");
    expect(result.current.form.parentId).toBe("");
  });
});
