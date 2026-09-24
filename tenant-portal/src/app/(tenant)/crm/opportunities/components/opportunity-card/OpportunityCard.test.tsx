// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_COLORS, type CardColor } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityCardFooter, type OpportunityCardFooterLabels } from "./OpportunityCardFooter";
import { OpportunityCardMenu, type OpportunityCardMenuLabels } from "./OpportunityCardMenu";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

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
  customerProfileType: "CORPORATE" as const,
  customerDisplayName: "Global Tech LLC",
  customerCompanyName: "Global Tech LLC",
  customerPhone: null,
  customerEmail: null,
  customerCountry: null,
  customerCity: null,
  primaryContact: {
    partyId: "0192f3a0-0000-7000-8000-000000000011",
    displayName: "Mona Ali",
    jobTitle: "Buyer",
    isPrimary: true,
    email: null,
    phones: [],
  },
  leadSourceName: null,
  leadSourceIconUrl: null,
  probabilityPercent: 75,
  expectedCloseDate: "2026-10-31",
  activityState: "OVERDUE" as const,
  openActivityCount: 2,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  ownerUserId: "0192f3a0-0000-7000-8000-000000000010",
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  tags: [{ id: "0192f3a0-0000-7000-8000-000000000012", name: "VIP", backgroundColor: null, textColor: null }],
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const footerLabels: OpportunityCardFooterLabels = {
  activity: "Activities — Overdue",
  owner: "Owner: Kamal Radwan",
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
    expect(screen.getByText(/50,000\.00/)).toBeInTheDocument();
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
        openActivityCount={2}
        onOpenActivities={onOpenActivities}
        ownerDisplayName="Kamal Radwan"
        labels={footerLabels}
      />,
    );

    const activityBtn = screen.getByTitle("Activities — Overdue");
    expect(activityBtn).toBeInTheDocument();
    fireEvent.click(activityBtn);
    expect(onOpenActivities).toHaveBeenCalledOnce();
    expect(screen.getByText("Kamal Radwan")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
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

  it("sends the selected filing colour through the shared picker", () => {
    const onColorChange = vi.fn();
    render(
      <OpportunityCardMenu
        cardColor="TEAL"
        onOpen={vi.fn()}
        onColorChange={onColorChange}
        labels={menuLabels}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: menuLabels.trigger }),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "PINK" }));
    expect(onColorChange).toHaveBeenCalledWith("PINK");
  });
});
