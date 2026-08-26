// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { languageMock, hookMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "ar" | "en" },
  hookMock: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => languageMock }));
vi.mock("./useProvisioningGovernance", () => ({
  useProvisioningGovernance: hookMock,
}));

import { COMPONENT_PAGE, RELEASE_PAGE, RUN } from "./test-fixtures";
import type { ProvisioningGovernanceView } from "./useProvisioningGovernance";
import { ProvisioningGovernanceScreen } from "./ProvisioningGovernanceScreen";

function baseView(): ProvisioningGovernanceView {
  return {
    permissions: {
      canReadCatalogue: true,
      canReadDiscovery: true,
      canRunDiscovery: true,
      canReadFleet: true,
      canReadPublisherKeys: true,
      canReadReleases: true,
    },
    componentDraft: {
      page: 1,
      limit: 20,
      sortBy: "key" as const,
      sortDir: "ASC" as const,
    },
    setComponentDraft: vi.fn(),
    componentQuery: {
      page: 1,
      limit: 20,
      sortBy: "key" as const,
      sortDir: "ASC" as const,
    },
    catalogue: {
      state: "READY" as const,
      data: COMPONENT_PAGE,
      error: null,
      isRefreshing: false,
    },
    applyComponentFilters: vi.fn(),
    resetComponentFilters: vi.fn(),
    setComponentPage: vi.fn(),
    refreshComponents: vi.fn(),
    selectedComponent: null,
    selectComponent: vi.fn(),
    releaseDraft: {
      page: 1,
      limit: 20,
      sortBy: "publishedAt" as const,
      sortDir: "DESC" as const,
    },
    setReleaseDraft: vi.fn(),
    releaseQuery: {
      page: 1,
      limit: 20,
      sortBy: "publishedAt" as const,
      sortDir: "DESC" as const,
    },
    releases: {
      state: "IDLE" as const,
      data: null,
      error: null,
      isRefreshing: false,
    },
    applyReleaseFilters: vi.fn(),
    resetReleaseFilters: vi.fn(),
    setReleasePage: vi.fn(),
    refreshReleases: vi.fn(),
    discovery: {
      state: "READY" as const,
      data: {
        items: [RUN],
        correlationId: COMPONENT_PAGE.correlationId,
        timestamp: COMPONENT_PAGE.timestamp,
      },
      error: null,
      isRefreshing: false,
    },
    refreshDiscovery: vi.fn(),
    selectedRunId: null,
    selectRun: vi.fn(),
    detail: {
      state: "IDLE" as const,
      data: null,
      error: null,
      isRefreshing: false,
    },
    mutation: {
      isPending: false,
      error: null,
      result: null,
      exactRetryAvailable: false,
      clear: vi.fn(),
    },
    runDiscovery: vi.fn(),
  };
}

describe("ProvisioningGovernanceScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    hookMock.mockReset().mockReturnValue(baseView());
  });

  it("renders the catalogue evidence and all supported component filters", () => {
    render(<ProvisioningGovernanceScreen />);

    expect(
      screen.getByRole("heading", { name: "Provisioning governance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("core.identity")).toBeInTheDocument();
    expect(screen.getByLabelText("Exact component key")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner application")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort field")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort direction")).toBeInTheDocument();
    expect(screen.getByLabelText("Rows per page")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Fleet rollouts/i }),
    ).toHaveAttribute("href", "/provisioning/fleet");
  });

  it("maps invalid component filters to the implicated field", () => {
    const view = baseView();
    view.componentDraft = { ...view.componentDraft, componentKey: "Bad Key" };
    hookMock.mockReturnValue(view);
    render(<ProvisioningGovernanceScreen />);

    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    expect(
      screen.getByRole("textbox", { name: /Exact component key/i }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/lowercase component key/i)).toBeInTheDocument();
    expect(view.applyComponentFilters).not.toHaveBeenCalled();
  });

  it("renders every release filter in the selected component dialog", () => {
    const view = baseView();
    view.selectedComponent = COMPONENT_PAGE.items[0];
    view.releases = {
      state: "READY",
      data: RELEASE_PAGE,
      error: null,
      isRefreshing: false,
    };
    hookMock.mockReturnValue(view);
    render(<ProvisioningGovernanceScreen />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Requires maintenance")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Sort field")).toHaveLength(2);
    expect(screen.getAllByLabelText("Rows per page")).toHaveLength(2);
  });

  it("requires an exact typed confirmation before submitting discovery", () => {
    const view = baseView();
    hookMock.mockReturnValue(view);
    render(<ProvisioningGovernanceScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Discovery runs" }));
    fireEvent.click(screen.getByRole("button", { name: "Review command" }));
    const confirmation = screen.getByLabelText("Type RUN");
    const submit = screen.getByRole("button", { name: "Start discovery" });
    expect(submit).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: "RUN" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(view.runDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "DRY_RUN", maxTenants: 100 }),
    );
  });

  it("fails closed for catalogue and discovery permissions and supports Arabic RTL", () => {
    languageMock.lang = "ar";
    const view = baseView();
    view.permissions.canRunDiscovery = false;
    view.catalogue = {
      state: "FORBIDDEN",
      data: null,
      error: null,
      isRefreshing: false,
    };
    view.discovery = {
      state: "FORBIDDEN",
      data: null,
      error: null,
      isRefreshing: false,
    };
    hookMock.mockReturnValue(view);
    const { container } = render(<ProvisioningGovernanceScreen />);

    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(
      screen.queryByText("Start bounded discovery"),
    ).not.toBeInTheDocument();
  });
});
