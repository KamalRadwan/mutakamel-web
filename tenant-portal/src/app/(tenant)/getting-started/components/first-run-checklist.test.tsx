// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const state = vi.hoisted(() => ({
  user: null as unknown,
  readCrmBody: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCrmBody: (...args: unknown[]) => state.readCrmBody(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
}));

// The real English dictionary: a missing key fails the test rather than
// rendering as empty text.
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const { FirstRunChecklist } = await import("./first-run-checklist");

const ALL_PERMISSIONS = [
  "org.company.read",
  "org.branch.read",
  "crm.lead_stages.read",
  "crm.pipelines.manage",
  "crm.pipelines.read",
  "trade.items.read",
];

function tenantUser(overrides: Record<string, unknown> = {}) {
  return {
    accessibleBranches: ["01900100-0000-7000-8000-000000000099"],
    accessibleCompanies: ["01900100-0000-7000-8000-000000000001"],
    teamMemberships: [],
    permissions: ALL_PERMISSIONS,
    isTenantOwner: true,
    ...overrides,
  };
}

beforeEach(() => {
  state.user = tenantUser();
  state.readCrmBody.mockResolvedValue([{ id: "a" }]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstRunChecklist", () => {
  it("lists every step in the order they have to happen", async () => {
    render(<FirstRunChecklist />);
    await waitFor(() => expect(state.readCrmBody).toHaveBeenCalled());

    const headings = screen
      .getAllByText(/^\d\. /u)
      .map((node) => node.textContent);
    expect(headings).toEqual([
      `1. ${en.gettingStarted.steps.company.name}`,
      `2. ${en.gettingStarted.steps.branch.name}`,
      `3. ${en.gettingStarted.steps.leadStages.name}`,
      `4. ${en.gettingStarted.steps.opportunityStages.name}`,
      `5. ${en.gettingStarted.steps.pipeline.name}`,
      `6. ${en.gettingStarted.steps.items.name}`,
    ]);
  });

  it("names the next action on a zero-data tenant, at the top and on the row", async () => {
    // 13.14's rule: every empty state names the next action. This screen is
    // where it applies first, because a zero-data tenant has nothing else.
    state.user = tenantUser({ accessibleCompanies: [], accessibleBranches: [] });
    render(<FirstRunChecklist />);

    expect(screen.getByText(en.gettingStarted.zeroDataSummary)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `Start with: ${en.gettingStarted.steps.company.name}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(en.gettingStarted.statusDetail.todo).length).toBe(1);
  });

  it("offers no link for a blocked step — the action there would fail", async () => {
    state.user = tenantUser({ accessibleCompanies: [], accessibleBranches: [] });
    render(<FirstRunChecklist />);

    expect(
      screen.getByRole("link", { name: new RegExp(en.gettingStarted.steps.company.action, "u") }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: new RegExp(en.gettingStarted.steps.branch.action, "u"),
      }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(en.gettingStarted.statusDetail.blocked).length).toBeGreaterThan(0);
  });

  it("explains an empty scope differently for an owner and for a member", () => {
    render(<FirstRunChecklist />);
    expect(screen.getByText(en.gettingStarted.scopeOwnerNote)).toBeInTheDocument();

    cleanup();
    state.user = tenantUser({ isTenantOwner: false });
    render(<FirstRunChecklist />);
    expect(screen.getByText(en.gettingStarted.scopeMemberNote)).toBeInTheDocument();
  });

  it("says a step was not checked rather than guessing, and offers a real retry", async () => {
    // A question that could not be asked is not an answer — states.md. The
    // banner is useless without the control that asks again.
    state.readCrmBody.mockRejectedValue(new Error("offline"));
    render(<FirstRunChecklist />);

    await waitFor(() =>
      expect(screen.getByText(en.gettingStarted.probeDegraded)).toBeInTheDocument(),
    );
    expect(
      screen.getAllByText(en.gettingStarted.statusDetail.unchecked).length,
    ).toBeGreaterThan(0);

    const retry = screen.getByRole("button", { name: en.common.retry });
    state.readCrmBody.mockResolvedValue([{ id: "a" }]);
    fireEvent.click(retry);

    await waitFor(() =>
      expect(screen.queryByText(en.gettingStarted.probeDegraded)).not.toBeInTheDocument(),
    );
  });

  it("still shows a step the actor cannot perform, and says who can", async () => {
    // Hiding it would leave a checklist that silently skips a required step.
    state.user = tenantUser({ permissions: ["org.company.read", "org.branch.read"] });
    render(<FirstRunChecklist />);

    expect(
      screen.getByText(`3. ${en.gettingStarted.steps.leadStages.name}`),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(en.gettingStarted.statusDetail.unauthorized).length,
    ).toBeGreaterThan(0);
  });
});
