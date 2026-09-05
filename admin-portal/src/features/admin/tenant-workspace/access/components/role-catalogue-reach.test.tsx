// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TenantUserEditorDialog } from "./tenant-access-dialogs";
import { tenantAccessCopy } from "../copy";

import {
  branchFixture,
  departmentFixture,
  pageFixture,
  roleFixture,
  teamFixture,
} from "../__tests__/fixtures";

const copy = tenantAccessCopy("en");

/**
 * UI-019. The role catalogue loaded one page of 50 and the dialog offered no
 * search, so on a tenant with more roles than that an administrator could not
 * grant the one they were looking for - and nothing on screen said the list was
 * a subset.
 */

// The Dialog primitive labels its close button from `t.common.close`, so a
// mock without it fails on render rather than on the assertion.
const i18nMock = {
  lang: "en" as const,
  dir: "ltr" as const,
  t: { common: { cancel: "Cancel", close: "Close", save: "Save" } },
};
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => i18nMock,
  useOptionalI18n: () => i18nMock,
}));

const OTHER_ROLE = { ...roleFixture, id: "role-2", name: "Payroll" };

function controllerStub(overrides: Record<string, unknown> = {}) {
  return {
    permissions: { canAssignRoles: true, canInvite: true, canUpdate: true },
    branches: { data: pageFixture([branchFixture]) },
    departments: { data: pageFixture([departmentFixture]) },
    teams: { data: pageFixture([teamFixture]) },
    roles: { data: pageFixture([roleFixture, OTHER_ROLE], { total: 90 }) },
    command: { error: null, pending: false },
    loadRoles: vi.fn(),
    loadBranches: vi.fn(),
    loadDepartments: vi.fn(),
    loadTeams: vi.fn(),
    inviteUser: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  } as never;
}

function renderDialog(controller = controllerStub()) {
  render(
    <TenantUserEditorDialog
      controller={controller}
      copy={copy}
      locale="en"
      mode="invite"
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
  return controller as unknown as { loadRoles: ReturnType<typeof vi.fn> };
}

describe("reaching the whole role catalogue", () => {
  afterEach(cleanup);

  it("searches the catalogue instead of only the loaded page", () => {
    const controller = renderDialog();

    fireEvent.change(screen.getByLabelText(copy.searchRoles), {
      target: { value: "  payroll  " },
    });

    expect(controller.loadRoles).toHaveBeenCalledWith({
      q: "payroll",
      page: 1,
      limit: 50,
    });
  });

  it("asks for the plain first page again when the box is cleared", () => {
    const controller = renderDialog();

    const box = screen.getByLabelText(copy.searchRoles);
    // React does not raise a change for a value that never differed, so the
    // box has to hold something before clearing it means anything.
    fireEvent.change(box, { target: { value: "payroll" } });
    fireEvent.change(box, { target: { value: "" } });

    expect(controller.loadRoles).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
    });
  });

  /**
   * A selection whose checkbox disappears behind a search is a grant the
   * operator can neither see nor take back.
   */
  it("keeps a checked role visible after a search that excludes it", () => {
    const controller = controllerStub();
    renderDialog(controller);

    fireEvent.click(screen.getByLabelText(roleFixture.name));
    expect(screen.getByLabelText(roleFixture.name)).toBeChecked();

    // The search answered with a page that no longer contains it.
    cleanup();
    render(
      <TenantUserEditorDialog
        controller={
          controllerStub({ roles: { data: pageFixture([OTHER_ROLE], { total: 90 }) } })
        }
        copy={copy}
        locale="en"
        mode="invite"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(OTHER_ROLE.name)).toBeInTheDocument();
  });
});
