// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadBoardCard } from "./LeadBoardCard";
import { LeadBoardExpandedCard } from "./LeadBoardExpandedCard";

let dictionary: Dictionary = en;
let lang: "en" | "ar" = "en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionary, lang, dir: lang === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ canMutate: false }),
}));
vi.mock("../../lead-requests", () => ({
  fetchLeadDetail: vi.fn().mockRejectedValue(new Error("Unavailable in this card test")),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  dictionary = en;
  lang = "en";
});

const lead: LeadItem = {
  id: "01900100-0000-7000-8000-000000000010",
  partyId: "01900100-0000-7000-8000-000000000011",
  leadProfileType: "CORPORATE",
  leadName: "Capital Hills",
  company: "Capital Hills",
  email: "",
  phone: "",
  phones: [],
  country: "EG",
  primaryContact: null,
  sourceNameAr: "",
  sourceNameEn: "",
  sourceIconUrl: null,
  stageId: "01900100-0000-7000-8000-000000000001",
  ownerUserId: null,
  rating: 0,
  cardColor: null,
  owner: null,
  nextActivity: { activityAt: "2026-10-20T08:00:00.000Z", bucket: "OVERDUE" },
  tags: [],
};

function cardProps(flag: LeadStage["flag"]) {
  return {
    lead,
    stage: { id: lead.stageId, nameAr: "", nameEn: "", flag },
    canUpdate: false,
    canDelete: false,
    moveTargets: [],
    showActivityEntry: true,
    onOpenLead: vi.fn(),
    onOpenQuickModal: vi.fn(),
    onOpenActivities: vi.fn(),
    onDelete: vi.fn(),
    onMoveStage: vi.fn(),
    onCardChange: vi.fn(),
  };
}

describe("board card baseline regressions", () => {
  it.each(["en", "ar"] as const)("keeps terminal labels neutral on collapsed and expanded cards in %s", (language) => {
    lang = language;
    dictionary = language === "ar" ? ar : en;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));

    for (const flag of ["CONVERTED", "DISQUALIFIED"] as const) {
      for (const expanded of [false, true]) {
        for (const showActivityEntry of [false, true]) {
          const props = { ...cardProps(flag), showActivityEntry };
          const { unmount } = render(expanded ? (
            <LeadBoardExpandedCard {...props} sources={[]} onCollapse={vi.fn()} />
          ) : (
            <LeadBoardCard {...props} isDragging={false} draggingFromLabel="" draggingToLabel="" />
          ));
          const label = flag === "CONVERTED"
            ? dictionary.crmLeads.executive.converted
            : dictionary.crmLeads.executive.closed;
          const pill = screen.getByText(label).closest(showActivityEntry ? "button" : "span.inline-flex");
          expect(pill).toHaveClass("bg-activity-none-surface", "border-activity-none-line", "text-activity-none-text");
          expect(screen.queryByText(dictionary.crmLeads.card.activityStates.OVERDUE)).toBeNull();
          if (!expanded) expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass("bg-activity-none");
          if (showActivityEntry) {
            fireEvent.click(screen.getByRole("button", {
              name: formatTemplate(dictionary.crmLeads.card.activityOpen, { state: label }),
            }));
            expect(props.onOpenActivities).toHaveBeenCalledOnce();
          }
          unmount();
        }
      }
    }
  });

  it("keeps the NONE bar for terminal leads with a custom card colour", () => {
    const props = cardProps("CONVERTED");
    render(<LeadBoardCard {...props} lead={{ ...lead, cardColor: "TEAL" }}
      isDragging={false} draggingFromLabel="" draggingToLabel="" />);
    expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass("bg-activity-none");
  });

  it("does not treat QUALIFIED as a terminal label", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
    render(<LeadBoardCard {...cardProps("QUALIFIED")} isDragging={false} draggingFromLabel="" draggingToLabel="" />);
    expect(screen.getByText(en.crmLeads.card.activityStates.OVERDUE)).toBeInTheDocument();
    expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass("bg-activity-overdue");
  });

  it("retains the corporate contact row with the title fallback when no contact name exists", () => {
    for (const primaryContact of [null, {
      partyId: lead.partyId, displayName: "", jobTitle: "", email: "", phones: [], isPrimary: true,
    }]) {
      const { unmount } = render(<LeadBoardCard {...cardProps("NEW")} lead={{ ...lead, primaryContact }}
        isDragging={false} draggingFromLabel="" draggingToLabel="" />);
      const names = screen.getAllByText("Capital Hills");
      expect(names).toHaveLength(2);
      expect(names[1].closest("div")).toHaveClass("bg-surface-subtle", "border-line-divider");
      unmount();
    }
  });
});
