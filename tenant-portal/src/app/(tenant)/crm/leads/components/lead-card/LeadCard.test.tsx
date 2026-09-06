// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_COLORS } from "@/design-system";
import type { LeadItem } from "../../hooks/useLeads";
import { LeadCard } from "../LeadCard";
import { LeadCardFooter, type LeadCardFooterLabels } from "./LeadCardFooter";
import { LeadCardMenu, type LeadCardMenuLabels } from "./LeadCardMenu";

const cardLabels = { moreTags: "+{count}" };

afterEach(cleanup);

const lead: LeadItem = {
  id: "01900100-0000-7000-8000-000000000001",
  leadName: "Kamal Radwan",
  company: "Acme Trading",
  email: "owner@example.com",
  phone: "+201001112223",
  sourceNameAr: "إحالة",
  sourceNameEn: "Referral",
  stageId: "01900100-0000-7000-8000-000000000010",
  ownerUserId: "01900100-0000-7000-8000-000000000020",
  rating: 2,
  primaryContactName: "Dina Ali",
  cardColor: "TEAL",
  owner: {
    userId: "01900100-0000-7000-8000-000000000020",
    firstName: "Kamal",
    lastName: "Radwan",
  },
  nextActivity: { activityAt: "2026-09-05T09:00:00.000Z", bucket: "OVERDUE" },
  // Mocked here because crm-app is still adding the field to the list read
  // model; the parser already treats an absent one as "no tags".
  tags: [],
};

const footerLabels: LeadCardFooterLabels = {
  activity: "Activities — Overdue",
  owner: "Owner: Kamal Radwan",
  group: "Rating",
  setStars: "Rate {count} of {max}",
  clear: "Clear the rating",
};

const menuLabels: LeadCardMenuLabels = {
  trigger: "More actions for Acme Trading",
  open: "Open",
  delete: "Delete",
  moveTo: "Move to",
  cardColor: "Card colour",
  colorNone: "No colour",
  selected: "selected",
  colorNames: Object.fromEntries(
    CARD_COLORS.map((color) => [color, color]),
  ) as LeadCardMenuLabels["colorNames"],
};

// Radix opens a dropdown on a key or a pointerdown, never on a synthetic
// click — and Enter is the path a keyboard user takes anyway.
function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: menuLabels.trigger }), { key: "Enter" });
}

describe("LeadCard", () => {
  it("shows the company with its contact beneath, and an individual on one line", () => {
    // A corporate lead's own display name IS its company name, so both cases
    // below carry the same `leadName`/`company` pair. What separates them is
    // whether the lead party has a contact person hanging off it.
    const { rerender } = render(
      <LeadCard
        lead={{ ...lead, leadName: "Acme Trading", company: "Acme Trading" }}
        labels={cardLabels}
      />,
    );
    expect(screen.getByText("Acme Trading")).toBeInTheDocument();
    expect(screen.getByText("Dina Ali")).toBeInTheDocument();

    rerender(
      <LeadCard
        lead={{
          ...lead,
          leadName: "Kamal Radwan",
          company: "Kamal Radwan",
          primaryContactName: "",
        }}
        labels={cardLabels}
      />,
    );
    expect(screen.getAllByText("Kamal Radwan")).toHaveLength(1);
    expect(screen.queryByText("Dina Ali")).toBeNull();
  });

  it("renders nothing at all where a lead has no tags", () => {
    render(<LeadCard lead={lead} labels={cardLabels} />);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("puts the lead's tags side by side under the contact name", () => {
    render(
      <LeadCard
        lead={{
          ...lead,
          tags: [
            { id: "01900100-0000-7000-8000-0000000000a1", name: "VIP", color: "RED" },
            { id: "01900100-0000-7000-8000-0000000000a2", name: "Renewal", color: null },
          ],
        }}
        labels={cardLabels}
      />,
    );
    const chips = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["VIP", "Renewal"]);
    // The contact line still comes first: the tags describe the lead, they do
    // not replace either identity line.
    expect(screen.getByText("Dina Ali")).toBeInTheDocument();
  });

  // A lead may carry up to fifty tags. A card that grew a line per tag would
  // be a different height from its neighbours, which is what the windowed
  // column measures its rows against.
  it("caps the chips and still names the ones it folds away", () => {
    render(
      <LeadCard
        lead={{
          ...lead,
          tags: Array.from({ length: 5 }, (_, index) => ({
            id: `01900100-0000-7000-8000-00000000000${index}`,
            name: `Tag ${index}`,
            color: null,
          })),
        }}
        labels={cardLabels}
      />,
    );
    const chips = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(chips).toHaveLength(4);
    expect(chips[3]).toHaveTextContent("+2");
    expect(chips[3]).toHaveTextContent("Tag 3, Tag 4");
  });
});

describe("LeadCardFooter", () => {
  function renderFooter(overrides: Partial<ComponentProps<typeof LeadCardFooter>> = {}) {
    const onRatingChange = vi.fn();
    const onOpenActivities = vi.fn();
    render(
      <LeadCardFooter
        nextActivity={lead.nextActivity}
        owner={lead.owner}
        rating={lead.rating}
        onRatingChange={onRatingChange}
        onOpenActivities={onOpenActivities}
        labels={footerLabels}
        {...overrides}
      />,
    );
    return { onRatingChange, onOpenActivities };
  }

  // The colour of the pulse mark is the only visual difference between
  // "overdue" and "due today", so the sentence beside it is not a nicety.
  //
  // The assertion moved from a bare `getByText` to the button's accessible
  // name because the mark IS the button now: a control whose name is only its
  // state does not say what pressing it does, so the composed label carries
  // both and this is where it has to hold.
  it("states the activity bucket in words, not only in colour", () => {
    const { onOpenActivities } = renderFooter();
    const trigger = screen.getByRole("button", { name: "Activities — Overdue" });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(onOpenActivities).toHaveBeenCalledTimes(1);
  });

  // The strip is WorkspaceCard's footer, outside the activation surface and
  // outside @hello-pangea/dnd's drag handle. The mark being a real button is
  // only safe because of that, so the rating and the mark are asserted to be
  // siblings rather than nested in anything.
  it("keeps the mark operable without touching the rating beside it", () => {
    const { onRatingChange, onOpenActivities } = renderFooter();
    fireEvent.click(screen.getByRole("button", { name: "Activities — Overdue" }));
    expect(onRatingChange).not.toHaveBeenCalled();
    expect(onOpenActivities).toHaveBeenCalledTimes(1);
  });

  it("gives the rating a name, a pressed state and three operable stars", () => {
    const { onRatingChange } = renderFooter();
    const rating = screen.getByRole("group", { name: "Rating" });
    const stars = within(rating).getAllByRole("button");
    expect(stars).toHaveLength(3);
    expect(stars.map((star) => star.getAttribute("aria-pressed"))).toEqual([
      "true",
      "true",
      "false",
    ]);

    fireEvent.click(within(rating).getByRole("button", { name: "Rate 3 of 3" }));
    expect(onRatingChange).toHaveBeenCalledWith(3);
  });

  it("clears the rating by pressing the star the lead already has", () => {
    const { onRatingChange } = renderFooter();
    fireEvent.click(screen.getByRole("button", { name: "Clear the rating" }));
    expect(onRatingChange).toHaveBeenCalledWith(0);
  });

  it("shows the stars but refuses the write when the user cannot update the lead", () => {
    const { onRatingChange } = renderFooter({ isRatingDisabled: true });
    const stars = within(screen.getByRole("group", { name: "Rating" })).getAllByRole("button");
    fireEvent.click(stars[0]);
    expect(onRatingChange).not.toHaveBeenCalled();
  });

  it("draws the owner's initials and carries the full name for a screen reader", () => {
    renderFooter();
    expect(screen.getByText("KR")).toBeInTheDocument();
    expect(screen.getByText("Owner: Kamal Radwan")).toBeInTheDocument();
  });

  it("renders no badge at all for a lead with no owner", () => {
    renderFooter({ owner: null });
    expect(screen.queryByText("KR")).toBeNull();
    expect(screen.queryByText("Owner: Kamal Radwan")).toBeNull();
  });
});

describe("LeadCardMenu", () => {
  function renderMenu(overrides: Partial<ComponentProps<typeof LeadCardMenu>> = {}) {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    const onColorChange = vi.fn();
    render(
      <LeadCardMenu
        cardColor={lead.cardColor}
        onOpen={onOpen}
        onDelete={onDelete}
        onColorChange={onColorChange}
        labels={menuLabels}
        {...overrides}
      />,
    );
    return { onOpen, onDelete, onColorChange };
  }

  it("carries exactly Open, Delete and a twelve-swatch colour picker", () => {
    renderMenu();
    openMenu();
    const menu = screen.getByRole("menu");

    expect(within(menu).getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(within(menu).getByText("Card colour")).toBeInTheDocument();
    // "None" leads; the eleven colours follow. Every swatch is named, because
    // a private filing colour cannot be inferred from the pixel.
    expect(within(menu).getByRole("menuitem", { name: "No colour" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "RED" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "TEAL — selected" })).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2 + CARD_COLORS.length + 1);

    // Nothing the card used to carry survives here: no move, no selection.
    expect(within(menu).queryByRole("menuitem", { name: /move/i })).toBeNull();
  });

  it("writes a colour, and clears one through the leading swatch", () => {
    const { onColorChange } = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "PINK" }));
    expect(onColorChange).toHaveBeenCalledWith("PINK");

    cleanup();
    const second = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "No colour" }));
    expect(second.onColorChange).toHaveBeenCalledWith(null);
  });

  it("hides the actions the user has no capability for, rather than failing them", () => {
    renderMenu({ onDelete: undefined, onColorChange: undefined });
    openMenu();
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(within(menu).queryByText("Card colour")).toBeNull();
  });

  describe("the move path that replaces the arrow", () => {
    // WCAG 2.2 AA `dragging-alternative`: dragging a card between stage columns
    // must have a single-pointer equivalent. The arrow came off the card face,
    // so the equivalent lives in this menu — without it a user who cannot drag
    // cannot move a lead at all.
    it("offers every permitted stage, and moves on choosing one", async () => {
      const onMove = vi.fn();
      renderMenu({
        moveTargets: [
          { id: "stage-b", label: "Qualified" },
          { id: "stage-c", label: "Proposal" },
        ],
        onMove,
      });
      await openMenu();

      expect(screen.getByRole("menuitem", { name: "Qualified" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("menuitem", { name: "Proposal" }));
      expect(onMove).toHaveBeenCalledWith("stage-c");
    });

    it("shows no move section when there is nowhere the lead may go", async () => {
      renderMenu({ moveTargets: [], onMove: vi.fn() });
      await openMenu();

      expect(screen.queryByText("Move to")).not.toBeInTheDocument();
    });
  });
});
