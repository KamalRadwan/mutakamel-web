// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { buildRunRequest, type DashboardFilterSelection } from "../../dashboard-run-contract";
import { DashboardFilterBar } from "./DashboardFilterBar";

const dictionaries = { en, ar } as const;
const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const branches = [
  { value: "branch-a", label: "Accessible branch" },
  { value: "branch-b", label: "Inaccessible branch" },
];
const emptySelection: DashboardFilterSelection = {
  datePreset: null, compare: null, branchId: null, currencyCode: null,
};
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[state.lang], lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr",
  }),
}));
vi.mock("@/app/(tenant)/core/hooks/useCoreOptions", () => ({
  useOrgNodeOptions: () => ({ options: branches }),
}));

// Radix scrolls the focused option; jsdom has no layout or scrolling API.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true, value: vi.fn(),
  });
});
afterAll(() => {
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});
beforeEach(() => { state.lang = "en"; });
afterEach(cleanup);

function openOptions(label: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  return within(screen.getByRole("listbox"));
}

function openFilters(labels: typeof en.crmDashboards.filters) {
  fireEvent.click(screen.getByRole("button", { name: labels.title }));
  return within(screen.getByRole("dialog", { name: labels.title }));
}

function openMultiOptions(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  return screen.getByRole("listbox");
}

describe("dashboard filter selection", () => {
  it.each(["en", "ar"] as const)("displays team and owner options within the draft branch in %s", lang => {
    state.lang = lang;
    const { crmDashboards: t } = dictionaries[lang];
    const company = "018f0000-0000-7000-8000-000000000011";
    const west = "018f0000-0000-7000-8000-000000000012";
    const east = "018f0000-0000-7000-8000-000000000013";
    const team = "018f0000-0000-7000-8000-000000000014";
    const owner = "018f0000-0000-7000-8000-000000000015";
    const otherOwner = "018f0000-0000-7000-8000-000000000016";
    const organization = { companies: [{ id: company, name: "North" }], branches: [
      { id: west, name: "West", companyId: company, companyName: "North" },
      { id: east, name: "East", companyId: company, companyName: "North" },
    ] };
    const onChange = vi.fn();
    render(<DashboardFilterBar selection={emptySelection} organization={organization} population={{ state: "READY",
      teams: [{ id: team, name: "Sales", branchIds: [west] }],
      owners: [{ id: owner, name: "Mariam", branchIds: [west] }, { id: otherOwner, name: "Omar", branchIds: [east] }],
    }} onChange={onChange} branchIds={[]} currencyCodes={[]} disabled={false} />);
    const dialog = openFilters(t.filters);
    let list = openMultiOptions(t.branch);
    fireEvent.click(within(list).getByRole("option", { name: "West · North" }));
    fireEvent.keyDown(list, { key: "Escape" });
    list = openMultiOptions(t.filters.team);
    fireEvent.click(within(list).getByRole("option", { name: "Sales" }));
    fireEvent.keyDown(list, { key: "Escape" });
    list = openMultiOptions(t.filters.owner);
    expect(within(list).queryByRole("option", { name: "Omar" })).toBeNull();
    fireEvent.click(within(list).getByRole("option", { name: "Mariam" }));
    fireEvent.keyDown(list, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: t.filters.apply }));
    expect(buildRunRequest(onChange.mock.calls[0]![0])).toEqual({ filters: { branchId: west, teamIds: [team], ownerUserIds: [owner] } });
  });

  it("keeps organization filters available when population discovery is unavailable", () => {
    const t = en.crmDashboards;
    const onChange = vi.fn();
    render(<DashboardFilterBar selection={emptySelection} organization={{ companies: [], branches: [] }}
      population={{ state: "SOURCE_NOT_READY", teams: [], owners: [] }} onChange={onChange} branchIds={[]} currencyCodes={[]} disabled={false} />);
    const dialog = openFilters(t.filters);
    expect(dialog.getByRole("status")).toHaveTextContent(t.filters.populationUnavailable);
    expect(dialog.queryByRole("button", { name: t.filters.team })).toBeNull();
    expect(dialog.queryByRole("button", { name: t.filters.owner })).toBeNull();
    expect(dialog.getByRole("button", { name: t.branch })).toBeEnabled();
    fireEvent.click(dialog.getByRole("button", { name: t.filters.apply }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(emptySelection);
  });

  it.each(["en", "ar"] as const)("narrows branch choices when switching company in %s", lang => {
    state.lang = lang;
    const t = dictionaries[lang];
    const north = "018f0000-0000-7000-8000-000000000011";
    const south = "018f0000-0000-7000-8000-000000000012";
    const west = "018f0000-0000-7000-8000-000000000013";
    const coast = "018f0000-0000-7000-8000-000000000014";
    const organization = { companies: [{ id: north, name: "North" }, { id: south, name: "South" }],
      branches: [{ id: west, name: "West", companyId: north, companyName: "North" },
        { id: coast, name: "Coast", companyId: south, companyName: "South" }] };
    const onChange = vi.fn();
    render(<DashboardFilterBar selection={{ ...emptySelection, companyId: north, branchId: west }}
      organization={organization} onChange={onChange} branchIds={[]} currencyCodes={[]} disabled={false} />);
    const dialog = openFilters(t.crmDashboards.filters);
    fireEvent.click(dialog.getByRole("button", { name: t.crmDashboards.filters.removeScope.replace("{label}", "North") }));
    const companies = openMultiOptions(t.crmDashboardReports.branchCohort.company);
    fireEvent.click(within(companies).getByRole("option", { name: "South" }));
    fireEvent.keyDown(companies, { key: "Escape" });
    expect(dialog.getByRole("button", { name: t.crmDashboards.branch })).toHaveTextContent(t.crmDashboards.allBranches);
    expect(onChange).not.toHaveBeenCalled();
    const branches = openMultiOptions(t.crmDashboards.branch);
    expect(within(branches).queryByRole("option", { name: "West" })).toBeNull();
    fireEvent.click(within(branches).getByRole("option", { name: "Coast" }));
    fireEvent.keyDown(branches, { key: "Escape" });
    fireEvent.click(dialog.getByRole("button", { name: t.crmDashboards.filters.apply }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...emptySelection, companyId: south, branchId: coast });
    expect(buildRunRequest(onChange.mock.calls[0]![0])).toEqual({ filters: { companyId: south, branchId: coast } });
  });

  it("applies selected branches across companies while cancel discards the draft", () => {
    const north = "018f0000-0000-7000-8000-000000000011";
    const south = "018f0000-0000-7000-8000-000000000012";
    const east = "018f0000-0000-7000-8000-000000000013";
    const west = "018f0000-0000-7000-8000-000000000014";
    const coast = "018f0000-0000-7000-8000-000000000015";
    const other = "018f0000-0000-7000-8000-000000000016";
    const organization = { companies: [{ id: north, name: "North" }, { id: south, name: "South" }, { id: east, name: "East" }],
      branches: [{ id: west, name: "West", companyId: north, companyName: "North" },
        { id: coast, name: "Coast", companyId: south, companyName: "South" },
        { id: other, name: "Other", companyId: east, companyName: "East" }] };
    const onChange = vi.fn();
    const t = en.crmDashboards;
    render(<DashboardFilterBar selection={emptySelection} organization={organization}
      onChange={onChange} branchIds={[]} currencyCodes={[]} disabled={false} />);
    let dialog = openFilters(t.filters);
    let list = openMultiOptions(en.crmDashboardReports.branchCohort.company);
    fireEvent.click(within(list).getByRole("option", { name: "East" }));
    fireEvent.keyDown(list, { key: "Escape" });
    fireEvent.click(dialog.getByRole("button", { name: en.common.cancel }));
    expect(onChange).not.toHaveBeenCalled();
    dialog = openFilters(t.filters);
    list = openMultiOptions(en.crmDashboardReports.branchCohort.company);
    expect(within(list).getByRole("option", { name: "East" })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(within(list).getByRole("option", { name: "South" }));
    fireEvent.click(within(list).getByRole("option", { name: "North" }));
    fireEvent.keyDown(list, { key: "Escape" });
    list = openMultiOptions(t.branch);
    expect(within(list).queryByRole("option", { name: /Other/u })).toBeNull();
    fireEvent.click(within(list).getByRole("option", { name: "Coast · South" }));
    fireEvent.click(within(list).getByRole("option", { name: "West · North" }));
    fireEvent.keyDown(list, { key: "Escape" });
    fireEvent.click(dialog.getByRole("button", { name: t.filters.apply }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(buildRunRequest(onChange.mock.calls[0]![0])).toEqual({ filters: { companyIds: [north, south], branchIds: [west, coast] } });
  });

  it("keeps an incomplete custom range local and applies a validated pair only", () => {
    const onChange = vi.fn();
    render(<DashboardFilterBar selection={emptySelection} onChange={onChange} branchIds={[]} currencyCodes={[]} disabled={false} />);
    const t = en.crmDashboards;
    const form = openFilters(t.filters);
    const options = openOptions(t.datePreset);
    expect(options.getAllByRole("option")).toHaveLength(14);
    expect(options.getByRole("option", { name: t.datePresets.LAST_3_COMPLETE_MONTHS })).toBeInTheDocument();
    fireEvent.click(options.getByRole("option", { name: t.datePresets.CUSTOM }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(form.getByRole("button", { name: t.filters.apply }));
    expect(screen.getByText(t.customRangeRequired)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.dateFrom), { target: { value: "2026-11-03" } });
    fireEvent.change(screen.getByLabelText(t.dateTo), { target: { value: "2026-11-01" } });
    fireEvent.click(form.getByRole("button", { name: t.filters.apply }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(t.customRangeInvalid)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t.dateTo), { target: { value: "2026-11-05" } });
    fireEvent.click(form.getByRole("button", { name: t.filters.apply }));
    expect(onChange).toHaveBeenLastCalledWith({ ...emptySelection, datePreset: "CUSTOM", dateFrom: "2026-11-03", dateTo: "2026-11-05" });
  });
  it.each(["en", "ar"] as const)("shows the omitted filters honestly in %s", (lang) => {
    state.lang = lang;
    const t = dictionaries[lang].crmDashboards;
    const onChange = vi.fn();
    render(<DashboardFilterBar
      selection={emptySelection} onChange={onChange}
      branchIds={[]} currencyCodes={[]} disabled={false}
    />);
    openFilters(t.filters);

    expect(screen.getByRole("combobox", { name: t.datePreset })).toHaveTextContent(t.dashboardDefault);
    expect(screen.getByRole("combobox", { name: t.compare })).toHaveTextContent(t.dashboardDefault);
    expect(screen.getByRole("combobox", { name: t.currency })).toHaveTextContent(t.allCurrencies);
    expect(screen.getByRole("combobox", { name: t.branch })).toHaveTextContent(t.allBranches);
    expect(screen.queryByRole("combobox", { name: t.company })).toBeNull();
    expect(buildRunRequest(emptySelection)).toEqual({});
    expect(onChange).not.toHaveBeenCalled();
    expect(openOptions(t.currency).getAllByRole("option").map((option) => option.textContent))
      .toEqual([t.allCurrencies]);
  });

  it.each([
    { branchIds: [] },
    { branchIds: ["unloaded-branch"] },
    { branchIds: ["branch-a"] },
  ])(
    "offers only branch options matching accessible ids $branchIds",
    ({ branchIds }) => {
      render(<DashboardFilterBar
        selection={emptySelection} onChange={vi.fn()}
        branchIds={branchIds} currencyCodes={[]} disabled={false}
      />);
      openFilters(en.crmDashboards.filters);
      const labels = openOptions(en.crmDashboards.branch).getAllByRole("option")
        .map((option) => option.textContent);
      expect(labels).toEqual(branchIds.includes("branch-a")
        ? [en.crmDashboards.allBranches, "Accessible branch"]
        : [en.crmDashboards.allBranches]);
      expect(screen.queryByText("Inaccessible branch")).toBeNull();
    },
  );

  it("offers server currencies and sends an explicit selection, then clears it", () => {
    const onChange = vi.fn();
    const props = { onChange, branchIds: [], currencyCodes: ["KWD"], disabled: false };
    const { rerender } = render(<DashboardFilterBar {...props} selection={emptySelection} />);
    const labels = en.crmDashboards.filters;
    const form = openFilters(labels);
    const options = openOptions(en.crmDashboards.currency);
    expect(options.getAllByRole("option").map((option) => option.textContent))
      .toEqual([en.crmDashboards.allCurrencies, "KWD"]);
    fireEvent.click(options.getByRole("option", { name: "KWD" }));
    const selected = { ...emptySelection, currencyCode: "KWD" };
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(form.getByRole("button", { name: labels.apply }));
    expect(onChange).toHaveBeenLastCalledWith(selected);
    expect(buildRunRequest(selected)).toEqual({ filters: { currencyCode: "KWD" } });

    rerender(<DashboardFilterBar {...props} selection={selected} />);
    const updated = openFilters(labels);
    expect(screen.getByRole("combobox", { name: en.crmDashboards.currency })).toHaveTextContent("KWD");
    fireEvent.click(openOptions(en.crmDashboards.currency)
      .getByRole("option", { name: en.crmDashboards.allCurrencies }));
    fireEvent.click(updated.getByRole("button", { name: labels.apply }));
    expect(onChange).toHaveBeenLastCalledWith(emptySelection);
  });

  it("displays explicit date and comparison selections and can return to dashboard defaults", () => {
    const selection: DashboardFilterSelection = {
      ...emptySelection, datePreset: "CURRENT_YEAR", compare: "NONE",
    };
    const onChange = vi.fn();
    render(<DashboardFilterBar
      selection={selection} onChange={onChange}
      branchIds={[]} currencyCodes={[]} disabled={false}
    />);
    const t = en.crmDashboards;
    const form = openFilters(t.filters);
    expect(screen.getByRole("combobox", { name: t.datePreset })).toHaveTextContent(t.datePresets.CURRENT_YEAR);
    expect(screen.getByRole("combobox", { name: t.compare })).toHaveTextContent(t.compareModes.NONE);
    fireEvent.click(openOptions(t.datePreset).getByRole("option", { name: t.dashboardDefault }));
    fireEvent.click(openOptions(t.compare).getByRole("option", { name: t.dashboardDefault }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(form.getByRole("button", { name: t.filters.apply }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(emptySelection);
  });

  it("cancels draft changes and reopens with the applied selection", () => {
    const onChange = vi.fn();
    const t = en.crmDashboards;
    render(<DashboardFilterBar selection={emptySelection} onChange={onChange} branchIds={["branch-a"]} currencyCodes={[]} disabled={false} />);
    const form = openFilters(t.filters);
    fireEvent.click(openOptions(t.branch).getByRole("option", { name: "Accessible branch" }));
    fireEvent.click(form.getByRole("button", { name: en.common.cancel }));
    expect(onChange).not.toHaveBeenCalled();
    const reopened = openFilters(t.filters);
    expect(reopened.getByRole("combobox", { name: t.branch })).toHaveTextContent(t.allBranches);
  });

  it("invalidates an open draft when branch authority changes", () => {
    const onChange = vi.fn();
    const t = en.crmDashboards;
    const props = { selection: emptySelection, onChange, currencyCodes: [], disabled: false };
    const { rerender } = render(<DashboardFilterBar {...props} branchIds={["branch-a"]} />);
    openFilters(t.filters);
    fireEvent.click(openOptions(t.branch).getByRole("option", { name: "Accessible branch" }));
    rerender(<DashboardFilterBar {...props} branchIds={[]} />);
    expect(screen.queryByRole("dialog", { name: t.filters.title })).not.toBeInTheDocument();
    rerender(<DashboardFilterBar {...props} branchIds={["branch-a"]} />);
    expect(screen.queryByRole("dialog", { name: t.filters.title })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps an accessible dashboard switcher alongside the filters", () => {
    const onSwitch = vi.fn();
    render(<DashboardFilterBar
      selection={emptySelection} onChange={vi.fn()}
      branchIds={[]} currencyCodes={[]} disabled={false}
      dashboardSwitcher={{ value: "sales", options: [
        { value: "sales", label: "Sales" }, { value: "leads", label: "Leads" },
      ], onChange: onSwitch }}
    />);
    expect(screen.getAllByRole("combobox", { name: en.crmDashboards.switchDashboard })).toHaveLength(1);
    fireEvent.click(openOptions(en.crmDashboards.switchDashboard).getByRole("option", { name: "Leads" }));
    expect(onSwitch).toHaveBeenCalledWith("leads");
  });
});
