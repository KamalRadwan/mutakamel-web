// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_COLORS, type CardColor } from "@/design-system";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityCardFooter, type OpportunityCardFooterLabels } from "./OpportunityCardFooter";
import { OpportunityCardMenu, type OpportunityCardMenuLabels } from "./OpportunityCardMenu";

afterEach(cleanup);

const mockOpportunity = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  branchId: "0192f3a0-0000-7000-8000-000000000002",
  customerProfileId: "0192f3a0-0000-7000-8000-000000000003",
  pipelineId: "0192f3a0-0000-7000-8000-000000000004",
  stageId: "0192f3a0-0000-7000-8000-000000000005",
  stageFlag: "NEW" as const,
  status: "IN_PROGRESS" as const,
  title: "Enterprise Deal 2026",
  importance: 2 as const,
  cardColor: "TEAL" as const,
  amount: "50000",
  currencyCode: "SAR",
  customerDisplayName: "Global Tech LLC",
  probabilityPercent: 75,
  activityState: "OVERDUE" as const,
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const footerLabels: OpportunityCardFooterLabels = {
  activity: "Activities — Overdue",
  owner: "Owner: 0192f3a0-0000-7000-8000-000000000010",
  group: "Importance",
  setStars: "Rate {count} of {max}",
  clear: "Clear importance",
};

const menuLabels: OpportunityCardMenuLabels = {
  trigger: "More options for Enterprise Deal 2026",
  open: "Open",
  delete: "Delete",
  moveTo: "Move to…",
  cardColor: "Card color",
  colorNone: "None",
  colorNames: Object.fromEntries(CARD_COLORS.map((c) => [c, c])) as Record<CardColor, string>,
  selected: "Selected",
};

describe("OpportunityCard", () => {
  it("renders opportunity title, customer display name, formatted amount and probability", () => {
    render(<OpportunityCard item={mockOpportunity} />);
    expect(screen.getByText("Enterprise Deal 2026")).toBeInTheDocument();
    expect(screen.getByText("Global Tech LLC")).toBeInTheDocument();
    expect(screen.getByText("SAR 50,000")).toBeInTheDocument();
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });
});

describe("OpportunityCardFooter", () => {
  it("renders CrmRating stars, activity pulse button, and owner initials", () => {
    const onImportanceChange = vi.fn();
    const onOpenActivities = vi.fn();

    render(
      <OpportunityCardFooter
        importance={2}
        onImportanceChange={onImportanceChange}
        activityState="OVERDUE"
        onOpenActivities={onOpenActivities}
        ownerUserId="0192f3a0-0000-7000-8000-000000000010"
        labels={footerLabels}
      />,
    );

    const activityBtn = screen.getByTitle("Activities — Overdue");
    expect(activityBtn).toBeInTheDocument();
    fireEvent.click(activityBtn);
    expect(onOpenActivities).toHaveBeenCalledOnce();
    expect(screen.getByText("01")).toBeInTheDocument();
  });
});

describe("OpportunityCardMenu", () => {
  it("triggers onOpen when Open item is clicked", () => {
    const onOpen = vi.fn();
    render(
      <OpportunityCardMenu
        cardColor="TEAL"
        onOpen={onOpen}
        labels={menuLabels}
      />,
    );

    const trigger = screen.getByRole("button", { name: menuLabels.trigger });
    fireEvent.keyDown(trigger, { key: "Enter" });

    const openItem = screen.getByText("Open");
    fireEvent.click(openItem);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
