// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const branchId = "01900100-0000-7000-8000-000000000099";
const recordId = "01900100-0000-7000-8000-000000000110";

const state = vi.hoisted(() => ({
  user: null as unknown,
  readCorePage: vi.fn(),
  readCrmBody: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: state.user }),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCorePage: (...args: unknown[]) => state.readCorePage(...args),
  readCrmBody: (...args: unknown[]) => state.readCrmBody(...args),
}));

// The real English dictionary, not a stub: a missing key is then a failing
// test rather than an `undefined` that renders as empty text.
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const { SearchWorkspace } = await import("./search-workspace");

function tenantUser(overrides: Record<string, unknown> = {}) {
  return {
    accessibleBranches: [branchId],
    accessibleCompanies: ["01900100-0000-7000-8000-000000000001"],
    teamMemberships: [],
    permissions: [
      "directory.party.read",
      "crm.leads.read.all",
      "crm.customer_profiles.read.all",
      "crm.opportunities.read.all",
    ],
    isTenantOwner: false,
    ...overrides,
  };
}

beforeEach(() => {
  state.user = tenantUser();
  state.readCorePage.mockResolvedValue({
    data: [{ id: recordId, displayName: "Acme Holdings", legalName: null }],
    meta: { total: 1 },
  });
  state.readCrmBody.mockImplementation(async (path: string) => ({
    items: path.includes("/opportunities")
      ? [{ id: recordId, title: "Annual renewal" }]
      : [{ id: recordId, displayName: "Sara Nour", companyName: "Acme" }],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchWorkspace", () => {
  it("names the families no endpoint can search, rather than omitting them", () => {
    // The whole point: a result set that silently drops a module because its
    // endpoint ignored the term reads as "there are none", and nothing on the
    // screen lets the user tell the difference.
    render(<SearchWorkspace initialTerm="" />);

    expect(screen.getByText(en.globalSearch.unsearchableTitle)).toBeInTheDocument();
    expect(screen.getByText(en.globalSearch.unsearchable.items.name)).toBeInTheDocument();
    expect(
      screen.getByText(en.globalSearch.unsearchable.commercialDocuments.name),
    ).toBeInTheDocument();
  });

  it("prompts for a term instead of showing an empty result set", () => {
    render(<SearchWorkspace initialTerm="" />);

    expect(screen.getByText(en.globalSearch.promptTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.globalSearch.sources.leads)).not.toBeInTheDocument();
  });

  it("states what each endpoint actually matches on, per family", async () => {
    // "No results" means something different when the route only looks at one
    // column, so the opportunity section says title-only in so many words.
    render(<SearchWorkspace initialTerm="acme" />);

    await waitFor(() =>
      expect(screen.getByText(en.globalSearch.matches.opportunities)).toBeInTheDocument(),
    );
    expect(screen.getByText(en.globalSearch.matches.parties)).toBeInTheDocument();
  });

  it("renders no section at all for a family the actor may not read", async () => {
    state.user = tenantUser({ permissions: ["directory.party.read"] });
    render(<SearchWorkspace initialTerm="acme" />);

    await waitFor(() =>
      expect(screen.getByText(en.globalSearch.sources.parties)).toBeInTheDocument(),
    );
    expect(screen.queryByText(en.globalSearch.sources.leads)).not.toBeInTheDocument();
  });

  it("labels the export options with the row counts they will actually deliver", async () => {
    // The lie this task exists to prevent is a control that says "Export" and
    // quietly delivers whatever was loaded, so both option labels carry their
    // own count. Four families, one row each on screen and one in each server
    // total, so both options read 4.
    render(<SearchWorkspace initialTerm="acme" />);
    await waitFor(() => expect(screen.getByText("Acme Holdings")).toBeInTheDocument());

    const trigger = screen.getByRole("button", { name: en.globalSearch.export.trigger });
    expect(trigger).toBeEnabled();

    fireEvent.pointerDown(
      trigger,
      new PointerEvent("pointerdown", { bubbles: true, ctrlKey: false, button: 0 }),
    );

    await waitFor(() =>
      expect(screen.getByText("Rows on this screen (4)")).toBeInTheDocument(),
    );
    expect(screen.getByText("All matching rows (4)")).toBeInTheDocument();
    // No cap notice: 4 rows is nowhere near the bound, and a warning that does
    // not apply trains people to ignore the one that does.
    expect(screen.queryByText(/stops at/u)).not.toBeInTheDocument();
  });

  it("disables the export and says why when nothing has been searched", () => {
    render(<SearchWorkspace initialTerm="" />);

    const trigger = screen.getByRole("button", {
      name: en.globalSearch.export.nothingToExport,
    });
    expect(trigger).toBeDisabled();
  });

  it("tells a branchless account to pick one instead of firing a 422", async () => {
    state.user = tenantUser({ accessibleBranches: [], teamMemberships: [] });
    render(<SearchWorkspace initialTerm="acme" />);

    await waitFor(() =>
      expect(
        screen.getAllByText(en.globalSearch.needsBranchTitle).length,
      ).toBeGreaterThan(0),
    );
    expect(state.readCrmBody).not.toHaveBeenCalled();
    // Core parties are not branch-scoped, so that family still answers.
    expect(screen.getByText("Acme Holdings")).toBeInTheDocument();
  });
});
