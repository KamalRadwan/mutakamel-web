// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type { ApplicationView } from "@/features/admin/applications/types";
import { AddDatabaseApplicationDialog } from "./AddDatabaseApplicationDialog";

vi.mock("@/features/admin/applications/api/applications.api", () => ({
  applicationsApi: { list: vi.fn() },
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
  useOptionalI18n: () => null,
}));

const listApplications = vi.mocked(applicationsApi.list);

function application(
  overrides: Partial<ApplicationView> &
    Pick<ApplicationView, "id" | "key" | "name">,
): ApplicationView {
  return {
    lifecycleStatus: "ACTIVE",
    publicationStatus: "PUBLISHED",
    databaseAccessMode: "TENANT_DATABASE",
    databasePrincipal: `mutakamel_${overrides.key}_app`,
    requiredOnDatabaseServer: false,
    activeManifest: { active: true },
    catalogueRevision: "4",
    databasePolicy: { policyRevision: "3" },
    ...overrides,
  } as ApplicationView;
}

function renderDialog(boundApplicationKeys: string[] = []) {
  render(
    <AddDatabaseApplicationDialog
      isOpen
      boundApplicationKeys={boundApplicationKeys}
      isSubmitting={false}
      onClose={vi.fn()}
      onBootstrap={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddDatabaseApplicationDialog", () => {
  it("requests published database Applications and includes required drafts", async () => {
    listApplications.mockResolvedValue({
      data: [
        application({
          id: "01900000-0000-7000-8000-000000000001",
          key: "crm",
          name: "Active CRM",
        }),
        application({
          id: "01900000-0000-7000-8000-000000000002",
          key: "trade",
          name: "Required Trade Draft",
          lifecycleStatus: "DRAFT",
          requiredOnDatabaseServer: true,
        }),
        application({
          id: "01900000-0000-7000-8000-000000000003",
          key: "optional",
          name: "Optional Draft",
          lifecycleStatus: "DRAFT",
          requiredOnDatabaseServer: false,
        }),
      ],
      meta: undefined,
    });

    renderDialog();

    await waitFor(() => {
      expect(listApplications).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        publicationStatus: "PUBLISHED",
        databaseAccessMode: "TENANT_DATABASE",
      });
    });

    const applicationSelect = await screen.findByRole("combobox", {
      name: "Application",
    });
    expect(applicationSelect.textContent).toMatch(/Active CRM/);

    const nativeSelect = document.querySelector(
      'select[aria-hidden="true"]',
    ) as HTMLSelectElement | null;
    expect(
      Array.from(nativeSelect?.options ?? []).map((option) => option.text),
    ).toEqual([
      "Active CRM · mutakamel_crm_app",
      "Required Trade Draft · mutakamel_trade_app",
    ]);
  });

  it("reports when every eligible Application is already bound", async () => {
    listApplications.mockResolvedValue({
      data: [
        application({
          id: "01900000-0000-7000-8000-000000000001",
          key: "crm",
          name: "Active CRM",
        }),
      ],
      meta: undefined,
    });

    renderDialog(["crm"]);

    expect(
      await screen.findByText(
        "Every eligible Application already has a binding on this database server.",
      ),
    ).not.toBeNull();
  });

  it("reports the eligibility requirements when no Application qualifies", async () => {
    listApplications.mockResolvedValue({
      data: [
        application({
          id: "01900000-0000-7000-8000-000000000001",
          key: "crm",
          name: "Draft CRM without manifest",
          lifecycleStatus: "DRAFT",
          requiredOnDatabaseServer: true,
          activeManifest: null,
        }),
      ],
      meta: undefined,
    });

    renderDialog();

    expect(
      await screen.findByText(/No Application is eligible/),
    ).not.toBeNull();
  });
});
