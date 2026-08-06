// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import { AddDatabaseApplicationDialog } from "./AddDatabaseApplicationDialog";

vi.mock("@/features/admin/applications/api/applications.api", () => ({
  applicationsApi: { list: vi.fn() },
}));

const listApplications = vi.mocked(applicationsApi.list);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddDatabaseApplicationDialog", () => {
  it("requests and renders only ACTIVE + PUBLISHED database Applications", async () => {
    listApplications.mockResolvedValue({
      data: [
        {
          id: "01900000-0000-7000-8000-000000000001",
          key: "crm",
          name: "Published CRM",
          lifecycleStatus: "ACTIVE",
          publicationStatus: "PUBLISHED",
          databaseAccessMode: "TENANT_DATABASE",
          databasePrincipal: "mutakamel_crm_app",
          catalogueRevision: "4",
          databasePolicy: { policyRevision: "3" },
        },
        {
          id: "01900000-0000-7000-8000-000000000002",
          key: "trade",
          name: "Unpublished Trade",
          lifecycleStatus: "ACTIVE",
          publicationStatus: "UNPUBLISHED",
          databaseAccessMode: "TENANT_DATABASE",
          databasePrincipal: "mutakamel_trade_app",
          catalogueRevision: "2",
          databasePolicy: { policyRevision: "2" },
        },
      ],
      meta: undefined,
    } as never);

    render(
      <AddDatabaseApplicationDialog
        isOpen
        boundApplicationKeys={[]}
        isSubmitting={false}
        onClose={vi.fn()}
        onBootstrap={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(listApplications).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        lifecycleStatus: "ACTIVE",
        publicationStatus: "PUBLISHED",
        databaseAccessMode: "TENANT_DATABASE",
      });
    });

    expect(
      await screen.findByRole("option", { name: /Published CRM/ }),
    ).not.toBeNull();
    expect(screen.queryByRole("option", { name: /Unpublished Trade/ })).toBeNull();
  });
});
