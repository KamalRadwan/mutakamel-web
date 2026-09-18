// @vitest-environment jsdom

import { useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { DEFAULT_OPPORTUNITY_SEARCH, type OpportunitySearchState } from "../opportunity-search-contract";
import { OpportunitySearchBar } from "./OpportunitySearchBar";
import type { OpportunityPipeline } from "../hooks/pipeline-types";

const controls = vi.hoisted(() => ({
  change: vi.fn(),
  submit: vi.fn(),
  advanced: vi.fn(),
}));

vi.mock("@/design-system", async () => ({
  ...await import("@/design-system/patterns/filter-search/FilterSearchInput"),
  ...await import("@/design-system/primitives/Button"),
  iconSize: () => "size-3.5",
  PageActions: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));
vi.mock("../hooks/useOpportunityTags", () => ({
  useOpportunityTags: () => ({
    items: [{ id: "01900100-0000-7000-8000-000000000003", name: "VIP" }],
    canRead: true,
    degraded: false,
  }),
}));
vi.mock("../../shared/components/CrmAdvancedSearchCard", () => ({
  CrmAdvancedSearchCard: (props: Record<string, unknown>) => {
    controls.advanced(props);
    return <section aria-label="Advanced filter builder" />;
  },
}));

const pipelines: OpportunityPipeline[] = [
  {
    id: "01900100-0000-7000-8000-000000000010",
    code: "SALES",
    nameAr: "المبيعات",
    nameEn: "Sales",
    isDefault: true,
    isActive: true,
    stages: [
      {
        id: "01900100-0000-7000-8000-000000000011",
        pipelineId: "01900100-0000-7000-8000-000000000010",
        opportunityStageId: "01900100-0000-7000-8000-000000000012",
        nameAr: "التأهيل",
        nameEn: "Qualification",
        flag: "QUALIFICATION",
        category: "IN_PROGRESS",
        rank: 1,
        isActive: true,
        isSystem: false,
      },
    ],
  },
];

function Harness({ advancedEnabled = true }: { advancedEnabled?: boolean }) {
  const [state, setState] = useState(DEFAULT_OPPORTUNITY_SEARCH);
  return (
    <OpportunitySearchBar
      value={state}
      onChange={(next) => {
        controls.change(next);
        setState(next);
      }}
      onSubmit={controls.submit}
      pipelines={pipelines}
      resetKey="branch:pipeline"
      advancedEnabled={advancedEnabled}
    />
  );
}

const input = () => screen.getByRole("combobox");
const lastState = () => controls.change.mock.lastCall?.[0] as OpportunitySearchState;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Opportunity Basic search interaction", () => {
  it("starts with My Opportunities and commits typed text only after a key is chosen", async () => {
    render(<Harness />);
    expect(screen.getByText(en.crmOpportunities.basicSearch.myOpportunities)).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "01050049899" } });
    expect(controls.change).not.toHaveBeenCalled();

    const phone = await screen.findByRole("option", {
      name: "Search Phone/Mobile for: 01050049899",
    });
    expect(screen.getByRole("option", { name: "Search Opportunity for: 01050049899" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Search Customer for: 01050049899" })).toBeInTheDocument();
    fireEvent.click(phone);

    expect(lastState().basic).toEqual({
      text: "",
      myOpportunities: true,
      filters: [{ field: "phone", value: "01050049899" }],
    });
    expect(input()).toHaveValue("");
  });

  it("keeps several structured chips, including repeated tags", async () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: "Status" }));
    fireEvent.click(
      await screen.findByRole("option", {
        name: en.statusValues["OpportunityStatus.IN_PROGRESS"],
      }),
    );
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: "Tag" }));
    fireEvent.click(await screen.findByRole("option", { name: "VIP" }));

    expect(lastState().basic.filters).toEqual([
      { field: "status", value: "IN_PROGRESS" },
      { field: "tag", value: "01900100-0000-7000-8000-000000000003" },
    ]);
    expect(screen.getByRole("button", { name: "Remove Tag: VIP filter" })).toBeInTheDocument();
  });

  it("offers pipeline and stage keys and keeps their scope compatible", async () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: en.crmOpportunities.pipeline }));
    fireEvent.click(await screen.findByRole("option", { name: "Sales" }));
    fireEvent.focus(input());
    fireEvent.click(await screen.findByRole("option", { name: en.crmOpportunities.stage }));
    fireEvent.click(await screen.findByRole("option", { name: "Qualification" }));

    expect(lastState().basic.filters).toEqual([
      { field: "pipeline", value: pipelines[0].id },
      { field: "stage", value: pipelines[0].stages[0].id },
    ]);
  });

  it("uses one small Advanced toggle and removes the legacy top text input", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: en.crmOpportunities.searchMode.advanced }),
    );
    expect(screen.getByRole("region", { name: "Advanced filter builder" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(controls.advanced).toHaveBeenLastCalledWith(
      expect.objectContaining({ requireFieldSelection: true }),
    );
    expect(controls.advanced.mock.lastCall?.[0]).not.toHaveProperty("text");
    expect(controls.advanced.mock.lastCall?.[0]).not.toHaveProperty("onTextChange");
  });

  it("hides Advanced outside Table view", () => {
    render(<Harness advancedEnabled={false} />);
    expect(
      screen.queryByRole("button", { name: en.crmOpportunities.searchMode.advanced }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
