// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { DEFAULT_LEAD_SEARCH, type LeadSearchState } from "../lead-search-contract";
import { LeadSearchBar } from "./LeadSearchBar";

const controls = vi.hoisted(() => ({
  lang: "en",
  change: vi.fn(),
  degraded: false,
  tagsDegraded: false,
  canReadTags: true,
  submit: vi.fn(),
}));
// Exercise the real pattern without importing unrelated navigation from the barrel.
vi.mock("@/design-system", async () => ({
  ...await import("@/design-system/patterns/filter-search/FilterSearchInput"),
  ...await import("@/design-system/primitives/Button"),
  iconSize: () => "size-3.5",
  PageActions: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../../shared/components/CrmAdvancedSearchCard", () => ({
  CrmAdvancedSearchCard: ({ onSubmit }: {
    onSubmit: () => void;
  }) => (
    <section aria-label="Advanced filter builder">
      <span role="button" tabIndex={0} onClick={onSubmit}>Run advanced search</span>
    </section>
  ),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: controls.lang, t: controls.lang === "en" ? en : ar }) }));
vi.mock("../../shared/hooks/useCrmAcquisitionSources", () => ({
  useCrmAcquisitionSources: () => ({ items: [], degraded: controls.degraded }),
}));
vi.mock("../hooks/useCreateLeadTags", () => ({
  useCreateLeadTags: () => ({
    items: [{ id: "01900100-0000-7000-8000-000000000003", name: "VIP" }],
    canRead: controls.canReadTags,
    canManage: false,
    isLoading: false,
    degraded: controls.tagsDegraded,
    addTag: vi.fn(),
  }),
}));
const STAGE = "01900100-0000-7000-8000-000000000002";
const TAG = "01900100-0000-7000-8000-000000000003";
function Harness({ resetKey = "branch-a" }: { resetKey?: string }) {
  const [state, setState] = useState(DEFAULT_LEAD_SEARCH);
  return <LeadSearchBar value={state}
    stages={[{ id: STAGE, nameEn: "New enquiry", nameAr: "استفسار جديد", flag: "NEW" }]}
    resetKey={resetKey}
    onSubmit={controls.submit}
    onChange={(next) => { controls.change(next); setState(next); }} />;
}
const input = () => screen.getByRole("combobox");
const lastState = () => controls.change.mock.lastCall?.[0] as LeadSearchState;
beforeEach(() => {
  controls.lang = "en";
  controls.degraded = false;
  controls.tagsDegraded = false;
  controls.canReadTags = true;
  controls.change.mockReset();
  controls.submit.mockReset();
});
afterEach(cleanup);

describe("Basic lead search interaction", () => {
  it("opens and closes the empty search from its disclosure button without removing My Leads", async () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: en.crmLeads.searchMode.advanced })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const toggle = screen.getByRole("button", { name: en.crmLeads.basicSearch.toggle });
    expect(input()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(input()).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByText("My Leads")).toBeInTheDocument();
    expect(controls.change).not.toHaveBeenCalled();
  });

  it("keeps Advanced accessible and submits only from the explicit action", () => {
    render(<Harness />);
    const modeToggle = screen.getByRole("button", { name: en.crmLeads.searchMode.advanced });
    fireEvent.click(modeToggle);
    expect(modeToggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Advanced filter builder" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    expect(controls.submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Run advanced search" }));
    expect(controls.submit).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.searchMode.advanced }));
    expect(screen.getByText(en.crmLeads.basicSearch.myLeads)).toBeInTheDocument();
  });

  it("shows typed digits beside every candidate key and preserves leading zeros when committed", async () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "01050049899" } });
    const phoneOption = await screen.findByRole("option", { name: "Search Phone/Mobile for: 01050049899" });
    expect(phoneOption.querySelector("bdi")).toHaveTextContent("01050049899");
    expect(screen.getByRole("option", { name: "Search Lead for: 01050049899" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Search Customer for: 01050049899" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Search Email for: 01050049899" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Search Stage for: 01050049899" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Search Source for: 01050049899" })).toBeInTheDocument();
    expect(controls.change).not.toHaveBeenCalled();
    fireEvent.click(phoneOption);
    expect(lastState().basic.filters).toEqual([{ field: "phone", value: "01050049899" }]);
    const remove = screen.getByRole("button", { name: "Remove Phone/Mobile: 01050049899 filter" });
    expect(remove).toBeInTheDocument();
    const fieldLabel = within(remove.parentElement!).getByText("Phone/Mobile");
    expect(fieldLabel).toHaveClass("bg-primary", "text-primary-foreground");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("explains replacement of an existing semantic text filter while retaining structured filters", async () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "Mona" } });
    fireEvent.click(await screen.findByRole("option", { name: "Search Lead for: Mona" }));
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: "Status" }));
    fireEvent.click(await screen.findByRole("option", { name: en.statusValues["LeadStatus.OPEN"] }));
    fireEvent.change(input(), { target: { value: "01050049899" } });
    const option = await screen.findByRole("option", { name: "Search Phone/Mobile for: 01050049899" });
    expect(option).toHaveAccessibleDescription(en.crmLeads.basicSearch.replaceTextHint);
    fireEvent.click(option);
    expect(lastState().basic).toEqual({ myLeads: true, filters: [
      { field: "status", value: "OPEN" }, { field: "phone", value: "01050049899" },
    ] });
  });

  it("starts with My Leads and keeps typing local until a field is selected", async () => {
    render(<Harness />);
    expect(screen.getByText("My Leads")).toBeInTheDocument();
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "Mona" } });
    expect(controls.change).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("option", { name: /Search Lead for: Mona/ }));
    expect(lastState().basic).toEqual({ myLeads: true, filters: [{ field: "lead", value: "Mona" }] });
    expect(input()).toHaveValue("");
    expect(screen.getByText("Mona")).toBeInTheDocument();
    expect(input()).toHaveFocus();
  });

  it("clears typed text and a selected field prompt when the branch reset key changes", async () => {
    const { rerender } = render(<Harness resetKey="branch-a" />);
    fireEvent.change(input(), { target: { value: "enquiry" } });
    fireEvent.click(await screen.findByRole("option", { name: "Search Stage for: enquiry" }));
    expect(input()).toHaveValue("enquiry");
    expect(screen.getByRole("button", { name: en.crmLeads.basicSearch.back })).toBeInTheDocument();

    rerender(<Harness resetKey="branch-b" />);

    expect(input()).toHaveValue("");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: en.crmLeads.basicSearch.back })).not.toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.basicSearch.myLeads)).toBeInTheDocument();
    expect(controls.change).not.toHaveBeenCalled();
  });

  it("supports several statuses and a stage without losing other filters", async () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: /^Status/ }));
    fireEvent.click(await screen.findByRole("option", { name: en.statusValues["LeadStatus.OPEN"] }));
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: /^Status/ }));
    expect(screen.queryByRole("option", { name: en.statusValues["LeadStatus.OPEN"] })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: en.statusValues["LeadStatus.ON_HOLD"] }));
    fireEvent.change(input(), { target: { value: "enquiry" } });
    fireEvent.click(await screen.findByRole("option", { name: /Search Stage for: enquiry/ }));
    fireEvent.click(await screen.findByRole("option", { name: "New enquiry" }));
    expect(lastState().basic).toEqual({ myLeads: true, filters: [
      { field: "status", value: "OPEN" }, { field: "status", value: "ON_HOLD" }, { field: "stage", value: STAGE },
    ] });
    expect(lastState().groups).toBe(DEFAULT_LEAD_SEARCH.groups);
    expect(screen.queryByText(STAGE)).not.toBeInTheDocument();
  });

  it("removes and restores My Leads explicitly", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Remove My Leads filter" }));
    expect(lastState().basic.myLeads).toBe(false);
    fireEvent.click(await screen.findByRole("option", { name: "My Leads" }));
    expect(lastState().basic.myLeads).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.basicSearch.toggle }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all search filters" }));
    expect(lastState().basic).toEqual({ myLeads: false, filters: [] });
  });

  it("expands Tag to server-backed values and commits a removable chip", async () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: "Tag" }));
    fireEvent.click(await screen.findByRole("option", { name: "VIP" }));
    expect(lastState().basic.filters).toEqual([{ field: "tag", value: TAG }]);
    expect(screen.getByRole("button", { name: "Remove Tag: VIP filter" })).toBeInTheDocument();
    expect(screen.queryByText(TAG)).not.toBeInTheDocument();
  });

  it("does not offer Tag when the actor cannot read the tag catalogue", async () => {
    controls.canReadTags = false;
    render(<Harness />);
    fireEvent.focus(input());
    await screen.findByRole("listbox");
    expect(screen.queryByRole("option", { name: "Tag" })).not.toBeInTheDocument();
  });

  it("supports arrows and Enter, ignores IME confirmation, and Escape cancels suggestions", async () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "Mona" } });
    await screen.findByRole("listbox");
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(controls.change).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Search Customer for: Mona");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(lastState().basic.filters).toEqual([{ field: "lead", value: "Mona" }]);
    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(input()).toHaveAttribute("aria-expanded", "false"));
  });

  it("focuses the last filter before Backspace can delete it", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "Backspace" });
    const remove = screen.getByRole("button", { name: "Remove My Leads filter" });
    expect(remove).toHaveFocus();
    expect(controls.change).not.toHaveBeenCalled();
    fireEvent.keyDown(remove, { key: "Delete" });
    expect(lastState().basic.myLeads).toBe(false);
  });

  it("renders Arabic field suggestions, values and removal labels", async () => {
    controls.lang = "ar";
    render(<div dir="rtl"><Harness /></div>);
    expect(screen.getByText(ar.crmLeads.basicSearch.myLeads)).toBeInTheDocument();
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: ar.crmLeads.stage }));
    fireEvent.click(await screen.findByRole("option", { name: "استفسار جديد" }));
    expect(screen.getByRole("button", { name: ar.crmLeads.basicSearch.remove(`${ar.crmLeads.stage}: استفسار جديد`) })).toBeInTheDocument();
    expect(lastState().basic.filters).toEqual([{ field: "stage", value: STAGE }]);
  });

  it("shows unavailable sources without offering a raw identifier input", async () => {
    controls.degraded = true;
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: /^Source/ }));
    expect(await screen.findByRole("status")).toHaveTextContent(en.crmLeads.basicSearch.catalogueUnavailable);
    expect(controls.change).not.toHaveBeenCalled();
  });
});
