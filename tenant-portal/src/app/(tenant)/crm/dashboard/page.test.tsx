// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import CrmDefaultDashboardPage from "./page";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get } }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  Skeleton: () => <div>Loading</div>,
  ErrorState: () => <div>Failed</div>,
}));
vi.mock("../dashboards/[id]/components/dashboard-workspace", async () => {
  const { createElement, useState } = await import("react");
  return {
    DashboardWorkspace: ({ dashboardId, onSelectDashboard }: {
      dashboardId: string;
      onSelectDashboard: (id: string) => void;
    }) => {
      const [mountedId] = useState(dashboardId);
      return (
        <div>
          <span>{dashboardId === mountedId ? "Fresh workspace" : "Previous workspace"}</span>
          {createElement(
            "button",
            { onClick: () => onSelectDashboard("01900300-0000-7000-8000-000000000002") },
            "Switch dashboard",
          )}
        </div>
      );
    },
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("remounts the workspace when switching dashboards on the default route", async () => {
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith("/navigation")
        ? {
            data: {
              items: [],
                nextCursor: null,
              activeDashboardId: "01900300-0000-7000-8000-000000000001",
            },
          }
        : {
            data: {
              id: "01900300-0000-7000-8000-000000000001",
              ownerUserId: "01900300-0000-7000-8000-000000000003",
              name: "Default dashboard",
              revision: 7,
              accessLevel: "OWNER",
              createdAt: "2026-10-17T00:00:00Z",
              updatedAt: "2026-10-17T00:00:00Z",
              defaultFilters: {},
              placements: [],
              unavailablePlacements: [],
              isShared: false,
              isDefault: true,
              isFavorite: false,
            },
          },
    ),
  );
  render(<CrmDefaultDashboardPage />);
  await screen.findByText("Fresh workspace");
  fireEvent.click(screen.getByRole("button", { name: "Switch dashboard" }));
  expect(screen.queryByText("Previous workspace")).toBeNull();
  expect(screen.getByText("Fresh workspace")).toBeTruthy();
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith("/api/tenant/crm/v1/dashboards/navigation", expect.any(Object));
});
