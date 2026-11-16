// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const COMPANY_ID = "01900100-0000-7000-8000-000000000001";
const BRANCH_CAIRO = "01900100-0000-7000-8000-000000000101";
const BRANCH_ALEX = "01900100-0000-7000-8000-000000000202";
const BRANCH_UNLISTED = "01900100-0000-7000-8000-000000000303";
const BRANCH_ASWAN = "01900100-0000-7000-8000-000000000404";
const USER_ONE = "01900100-0000-7000-8000-000000000901";
const USER_TWO = "01900100-0000-7000-8000-000000000902";

const state = vi.hoisted(() => ({
  user: null as unknown,
  realtimeAuthGeneration: "gen-1" as string | null,
  readCorePage: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: state.user,
    realtimeAuthGeneration: state.realtimeAuthGeneration,
  }),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCoreData: vi.fn(),
  readCorePage: (...args: unknown[]) => state.readCorePage(...args),
  writeCoreData: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const { TenantBranchSelect } = await import("./TenantBranchSelect");

function tenantUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ONE,
    email: "agent@example.com",
    firstName: "Sara",
    lastName: "Nour",
    isTenantOwner: false,
    status: "ACTIVE",
    accessibleBranches: [BRANCH_CAIRO, BRANCH_ALEX],
    accessibleCompanies: [COMPANY_ID],
    accessibleBranchCompanies: [],
    permissions: ["org.branch.read"],
    featureEntitlements: {},
    permissionScopes: {
      "org.branch.read": {
        tenantWide: true,
        companyIds: [],
        branchIds: [],
      },
    },
    teamMemberships: [],
    accessScope: {
      mode: "EXPLICIT",
      branchesTruncated: false,
      companiesTruncated: false,
      teamMembershipsTruncated: false,
      teamMembershipsTotal: 0,
    },
    ...overrides,
  };
}

function branchPage(items: ReadonlyArray<{ id: string; code: string; name: string }>) {
  return {
    data: items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      status: "ACTIVE",
      companyId: COMPANY_ID,
      address: null,
      phone: null,
      isHeadquarters: false,
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
    })),
    meta: {
      page: 1,
      limit: 100,
      total: items.length,
      totalPages: items.length === 0 ? 0 : 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

beforeEach(() => {
  state.readCorePage.mockReset();
  state.user = tenantUser();
  state.realtimeAuthGeneration = "gen-1";
  state.readCorePage.mockResolvedValue(
    branchPage([
      { id: BRANCH_CAIRO, code: "CAI", name: "فرع القاهرة" },
      { id: BRANCH_ALEX, code: "ALX", name: "Alexandria Hub" },
    ]),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TenantBranchSelect", () => {
  it("shows compact names without IDs and uses a named fallback for missing labels", async () => {
    const onChange = vi.fn();
    const branchIds = [BRANCH_CAIRO, BRANCH_ALEX, BRANCH_UNLISTED];
    const { rerender } = render(
      <TenantBranchSelect
        branchIds={branchIds}
        branchId={BRANCH_CAIRO}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("فرع القاهرة"));
    expect(trigger).not.toHaveTextContent("00000101");
    expect(trigger).toHaveClass("text-caption");
    expect(trigger).not.toHaveClass("font-mono");

    expect(state.readCorePage).toHaveBeenCalledTimes(1);
    expect(state.readCorePage).toHaveBeenCalledWith(
      "/api/tenant/core/v1/organization/branches",
      "page=1&limit=100&sortBy=name&sortDir=ASC",
      expect.objectContaining({
        suppressForbiddenToast: true,
        signal: expect.any(AbortSignal),
      }),
    );

    rerender(
      <TenantBranchSelect
        branchIds={branchIds}
        branchId={BRANCH_ALEX}
        onChange={onChange}
      />,
    );
    expect(trigger).toHaveTextContent("Alexandria Hub");
    expect(trigger).not.toHaveTextContent("00000202");
    expect(state.readCorePage).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: /فرع القاهرة/u })).not.toHaveTextContent("00000101");
    expect(screen.getByRole("option", { name: /Alexandria Hub/u })).not.toHaveTextContent("00000202");
    expect(screen.getByRole("option", { name: "Branch 3" })).toBeInTheDocument();
    expect(screen.queryByText(BRANCH_UNLISTED)).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: /فرع القاهرة/u }));
    expect(onChange).toHaveBeenCalledWith(BRANCH_CAIRO);
  });

  it("keeps named fallback choices selectable when branch names are forbidden", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), {
      response: { status: 403 },
    });
    state.readCorePage.mockRejectedValueOnce(forbidden);

    const onChange = vi.fn();
    const { unmount } = render(
      <TenantBranchSelect
        branchIds={[BRANCH_CAIRO, BRANCH_ALEX]}
        branchId={BRANCH_CAIRO}
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(state.readCorePage).toHaveBeenCalledTimes(1));

    const trigger = screen.getByRole("combobox", { name: en.common.branch });
    expect(trigger).toHaveTextContent("Branch 1");
    expect(trigger).not.toHaveTextContent(BRANCH_CAIRO);
    expect(trigger).not.toHaveClass("font-mono");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Branch 2" }));
    expect(onChange).toHaveBeenCalledWith(BRANCH_ALEX);

    unmount();
    vi.clearAllMocks();

    state.user = tenantUser({
      permissions: ["crm.leads.read.all"],
      permissionScopes: {
        "crm.leads.read.all": {
          tenantWide: true,
          companyIds: [],
          branchIds: [],
        },
      },
    });

    const onUnauthorizedSelect = vi.fn();
    render(
      <TenantBranchSelect
        branchIds={[BRANCH_CAIRO, BRANCH_ALEX]}
        branchId={BRANCH_CAIRO}
        onChange={onUnauthorizedSelect}
      />,
    );

    expect(state.readCorePage).not.toHaveBeenCalled();
    const fallbackTrigger = screen.getByRole("combobox", { name: en.common.branch });
    expect(fallbackTrigger).toHaveTextContent("Branch 1");

    fireEvent.click(fallbackTrigger);
    fireEvent.click(screen.getByRole("option", { name: "Branch 2" }));
    expect(onUnauthorizedSelect).toHaveBeenCalledWith(BRANCH_ALEX);
  });

  it("performs a fresh lookup when user.id or realtimeAuthGeneration changes, drops cache on sign-out, and aborts on unmount", async () => {
    const onChange = vi.fn();
    const { rerender, unmount } = render(
      <TenantBranchSelect branchIds={[BRANCH_CAIRO, BRANCH_ALEX]} branchId={BRANCH_CAIRO} onChange={onChange} />,
    );

    const trigger = screen.getByRole("combobox", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("فرع القاهرة"));
    expect(state.readCorePage).toHaveBeenCalledTimes(1);

    state.user = tenantUser({ id: USER_TWO });
    state.readCorePage.mockResolvedValueOnce(
      branchPage([
        { id: BRANCH_CAIRO, code: "CAI", name: "Cairo Second Actor" },
        { id: BRANCH_ALEX, code: "ALX", name: "Alex Second Actor" },
      ]),
    );

    rerender(
      <TenantBranchSelect branchIds={[BRANCH_CAIRO, BRANCH_ALEX]} branchId={BRANCH_CAIRO} onChange={onChange} />,
    );

    expect(trigger).toHaveTextContent("Branch 1");
    await waitFor(() => expect(trigger).toHaveTextContent("Cairo Second Actor"));
    expect(state.readCorePage).toHaveBeenCalledTimes(2);

    state.realtimeAuthGeneration = "gen-rotated";
    state.readCorePage.mockResolvedValueOnce(
      branchPage([
        { id: BRANCH_CAIRO, code: "CAI", name: "Cairo Rotated Session" },
        { id: BRANCH_ALEX, code: "ALX", name: "Alex Rotated Session" },
      ]),
    );

    rerender(
      <TenantBranchSelect branchIds={[BRANCH_CAIRO, BRANCH_ALEX]} branchId={BRANCH_CAIRO} onChange={onChange} />,
    );

    await waitFor(() => expect(trigger).toHaveTextContent("Cairo Rotated Session"));
    expect(state.readCorePage).toHaveBeenCalledTimes(3);

    state.user = null;
    state.realtimeAuthGeneration = null;
    rerender(
      <TenantBranchSelect branchIds={[BRANCH_CAIRO, BRANCH_ALEX]} branchId={BRANCH_CAIRO} onChange={onChange} />,
    );
    expect(trigger).toHaveTextContent("Branch 1");
    unmount();

    let inFlightSignal: AbortSignal | undefined;
    state.user = tenantUser({ id: USER_ONE });
    state.realtimeAuthGeneration = "gen-pending";
    state.readCorePage.mockImplementationOnce((...args: unknown[]) => {
      const options = args[2] as { signal?: AbortSignal } | undefined;
      inFlightSignal = options?.signal;
      return new Promise(() => {});
    });

    const pendingView = render(
      <TenantBranchSelect branchIds={[BRANCH_CAIRO, BRANCH_ALEX]} branchId={BRANCH_CAIRO} onChange={onChange} />,
    );

    expect(inFlightSignal).toBeDefined();
    expect(inFlightSignal?.aborted).toBe(false);
    pendingView.unmount();
    expect(inFlightSignal?.aborted).toBe(true);
  });
});

const SEARCH_BRANCH_IDS = [BRANCH_CAIRO, BRANCH_ALEX, BRANCH_UNLISTED, BRANCH_ASWAN];

function prepareSearchBranches() {
  state.user = tenantUser({ accessibleBranches: SEARCH_BRANCH_IDS });
  state.readCorePage.mockResolvedValue(branchPage([
    { id: BRANCH_CAIRO, code: "CAI", name: "Cairo branch" },
    { id: BRANCH_ALEX, code: "ALX", name: "Alexandria Hub" },
    { id: BRANCH_UNLISTED, code: "GIZ", name: "Giza office" },
    { id: BRANCH_ASWAN, code: "ASW", name: "Aswan desk" },
  ]));
}

describe("TenantBranchSelect search", () => {
  it("loads later catalogue pages so every searchable accessible branch has its name", async () => {
    prepareSearchBranches();
    const first = branchPage([
      { id: BRANCH_CAIRO, code: "CAI", name: "Cairo branch" },
      { id: BRANCH_ALEX, code: "ALX", name: "Alexandria Hub" },
      ...Array.from({ length: 98 }, (_, index) => ({
        id: `01900100-0000-7000-8000-${String(index + 2000).padStart(12, "0")}`,
        code: `OTHER-${index}`, name: `Other branch ${index}`,
      })),
    ]);
    first.meta = { ...first.meta, total: 102, totalPages: 2, hasNext: true };
    const second = branchPage([
      { id: BRANCH_UNLISTED, code: "GIZ", name: "Giza office" },
      { id: BRANCH_ASWAN, code: "ASW", name: "Aswan desk" },
    ]);
    second.meta = { ...second.meta, page: 2, total: 102, totalPages: 2, hasPrev: true };
    state.readCorePage.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS} branchId={BRANCH_ASWAN} onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("Aswan desk"));
    expect(state.readCorePage).toHaveBeenCalledTimes(2);
    expect(state.readCorePage).toHaveBeenLastCalledWith(
      "/api/tenant/core/v1/organization/branches",
      "page=2&limit=100&sortBy=name&sortDir=ASC",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.click(trigger);
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.queryByRole("option", { name: "Other branch 0" })).toBeNull();
  });

  it.each([2, 3])("keeps the plain select for %s branches without a search input", async (count) => {
    prepareSearchBranches();
    render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS.slice(0, count)} branchId={BRANCH_CAIRO} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("Cairo branch"));
    fireEvent.click(trigger);
    expect(screen.getAllByRole("option")).toHaveLength(count);
    expect(screen.queryByRole("combobox", { name: en.common.searchBranches })).toBeNull();
    expect(screen.queryByPlaceholderText(en.common.searchBranches)).toBeNull();
  });

  it("searches labels locally for four branches, preserves the selected name and recovers from no matches", async () => {
    prepareSearchBranches();
    const onChange = vi.fn();
    render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS} branchId={BRANCH_CAIRO} onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("Cairo branch"));
    expect(trigger).toHaveClass("text-caption");
    fireEvent.click(trigger);
    const input = screen.getByRole("combobox", { name: en.common.searchBranches });
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.change(input, { target: { value: "  ASWAN  " } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByRole("option", { name: "Aswan desk" })).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Cairo branch");
    expect(trigger).not.toHaveTextContent(BRANCH_CAIRO);
    fireEvent.change(input, { target: { value: "missing branch" } });
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    expect(screen.getByText(en.common.noMatchingBranches)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(4));
    expect(state.readCorePage).toHaveBeenCalledTimes(1);
  });

  it("selects a branch with ArrowDown and Enter", async () => {
    prepareSearchBranches();
    const onChange = vi.fn();
    render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS} branchId={BRANCH_CAIRO} onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: en.common.branch });
    await waitFor(() => expect(trigger).toHaveTextContent("Cairo branch"));
    fireEvent.click(trigger);
    const input = screen.getByRole("combobox", { name: en.common.searchBranches });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(BRANCH_ALEX);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("preserves optional all-branches selection in the searchable variant", async () => {
    prepareSearchBranches();
    const onChange = vi.fn();
    const { rerender } = render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS} branchId={null} allowAll onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: en.common.branch });
    expect(trigger).toHaveTextContent(en.common.allBranches);
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Cairo branch" }));
    expect(onChange).toHaveBeenLastCalledWith(BRANCH_CAIRO);
    rerender(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS} branchId={BRANCH_CAIRO} allowAll onChange={onChange} />);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: en.common.allBranches }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it.each([3, 4])("disables the %s-branch control and never exposes IDs when a selected name is unavailable", (count) => {
    state.user = tenantUser({ permissions: [], accessibleBranches: SEARCH_BRANCH_IDS });
    render(<TenantBranchSelect branchIds={SEARCH_BRANCH_IDS.slice(0, count)} branchId={BRANCH_UNLISTED} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole(count > 3 ? "button" : "combobox", { name: en.common.branch });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Branch 3");
    expect(trigger).not.toHaveTextContent(BRANCH_UNLISTED);
    expect(state.readCorePage).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
