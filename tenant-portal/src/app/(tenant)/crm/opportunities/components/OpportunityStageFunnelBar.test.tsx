// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { OpportunityBoardLane, OpportunityStage } from "../hooks/pipeline-types";
import { OpportunityStageFunnelBar } from "./OpportunityStageFunnelBar";

vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Button")),
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
const stages: OpportunityStage[] = ["New", "Won"].map((name, index) => ({
  id: name, pipelineId: "pipeline", opportunityStageId: name,
  nameEn: name, nameAr: name, rank: index + 1, flag: index === 0 ? "NEW" : "WON",
  category: index === 0 ? "IN_PROGRESS" : "WON", isActive: true, isSystem: true,
}));
const lanes: OpportunityBoardLane[] = stages.map((stage, index) => ({
  stage, items: [], summary: { totalCount: index === 0 ? 120 : 35, amountsByCurrency: {} },
  activitySummary: { totalCount: 0, noOpenCount: 0, overdueCount: 0, todayCount: 0, futureCount: 0 },
  pageInfo: { limit: 50, hasMore: false, nextCursor: null },
}));
afterEach(cleanup);

describe("Opportunity funnel server counts", () => {
  it("uses full summaries even with a selected stage and no loaded items", () => {
    const onSelectStage = vi.fn();
    render(<OpportunityStageFunnelBar stages={stages} boardLanes={lanes}
      selectedStageId="Won" onSelectStage={onSelectStage} />);
    expect(within(screen.getByRole("button", { name: /All Opportunities/u })).getByText("155")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /New/u })).getByText("120")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /Won/u })).getByText("35")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /All Opportunities/u }));
    expect(onSelectStage).toHaveBeenCalledWith(undefined);
  });

  it("shows unavailable rather than guessed zero counts before summaries arrive", () => {
    render(<OpportunityStageFunnelBar stages={stages} onSelectStage={vi.fn()} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders genuine zero totals from loaded summaries", () => {
    render(<OpportunityStageFunnelBar stages={stages} boardLanes={lanes.map((lane) => ({
      ...lane, summary: { totalCount: 0, amountsByCurrency: {} },
    }))} onSelectStage={vi.fn()} />);
    expect(screen.getAllByText("0")).toHaveLength(3);
  });
});
