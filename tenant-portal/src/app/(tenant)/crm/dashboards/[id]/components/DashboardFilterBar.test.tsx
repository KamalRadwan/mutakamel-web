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

describe("dashboard filter selection", () => {
  it.each(["en", "ar"] as const)("shows the omitted filters honestly in %s", (lang) => {
    state.lang = lang;
    const t = dictionaries[lang].crmDashboards;
    const onChange = vi.fn();
    render(<DashboardFilterBar
      selection={emptySelection} onChange={onChange}
      branchIds={[]} currencyCodes={[]} disabled={false}
    />);

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
    const options = openOptions(en.crmDashboards.currency);
    expect(options.getAllByRole("option").map((option) => option.textContent))
      .toEqual([en.crmDashboards.allCurrencies, "KWD"]);
    fireEvent.click(options.getByRole("option", { name: "KWD" }));
    const selected = { ...emptySelection, currencyCode: "KWD" };
    expect(onChange).toHaveBeenLastCalledWith(selected);
    expect(buildRunRequest(selected)).toEqual({ filters: { currencyCode: "KWD" } });

    rerender(<DashboardFilterBar {...props} selection={selected} />);
    expect(screen.getByRole("combobox", { name: en.crmDashboards.currency })).toHaveTextContent("KWD");
    fireEvent.click(openOptions(en.crmDashboards.currency)
      .getByRole("option", { name: en.crmDashboards.allCurrencies }));
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
    expect(screen.getByRole("combobox", { name: t.datePreset })).toHaveTextContent(t.datePresets.CURRENT_YEAR);
    expect(screen.getByRole("combobox", { name: t.compare })).toHaveTextContent(t.compareModes.NONE);
    fireEvent.click(openOptions(t.datePreset).getByRole("option", { name: t.dashboardDefault }));
    expect(onChange).toHaveBeenLastCalledWith({ ...selection, datePreset: null });
    fireEvent.click(openOptions(t.compare).getByRole("option", { name: t.dashboardDefault }));
    expect(onChange).toHaveBeenLastCalledWith({ ...selection, compare: null });
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
