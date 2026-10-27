// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import { LeadBoardCard, type LeadBoardCardProps } from "./LeadBoardCard";

const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

let dictionary: Dictionary = en;
let activeLang: "en" | "ar" = "en";
let canMutate = true;

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionary,
    lang: activeLang,
    dir: DIRECTIONS[activeLang],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({
    mode: "FULL" as const,
    isResolved: true,
    canRead: true,
    canMutate,
    isRestricted: false,
  }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  dictionary = en;
  activeLang = "en";
  canMutate = true;
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const STAGE_NEW: LeadStage = {
  id: "01900100-0000-7000-8000-000000000001",
  nameAr: "جديد",
  nameEn: "New",
  flag: "NEW",
};

const STAGE_CONTACTED: LeadStage = {
  id: "01900100-0000-7000-8000-000000000002",
  nameAr: "تم التواصل",
  nameEn: "Contacted",
  flag: "CONTACTED",
};

function makeLead(overrides: Partial<LeadItem> = {}): LeadItem {
  return {
    id: "01900100-0000-7000-8000-000000000010",
    partyId: "01900100-0000-7000-8000-000000000011",
    leadProfileType: "INDIVIDUAL",
    leadName: "Ebrahim Essam",
    company: "Ebrahim Essam",
    email: "ebrahim@example.test",
    phone: "+201000000001",
    phones: ["+201000000001"],
    country: "EG",
    primaryContact: null,
    sourceNameAr: "مركز الاتصال",
    sourceNameEn: "Call Center",
    sourceIconUrl: null,
    stageId: STAGE_NEW.id,
    ownerUserId: "01900100-0000-7000-8000-000000000020",
    rating: 3,
    cardColor: null,
    owner: {
      userId: "01900100-0000-7000-8000-000000000020",
      firstName: "Kamal",
      lastName: "Radwan",
    },
    nextActivity: null,
    tags: [],
    stageEnteredAt: "2026-10-16T08:00:00.000Z",
    ...overrides,
  };
}

function renderCard(overrides: Partial<LeadBoardCardProps> = {}) {
  const props: LeadBoardCardProps = {
    lead: makeLead(),
    stage: STAGE_NEW,
    isDragging: false,
    draggingFromLabel: "",
    draggingToLabel: "",
    canUpdate: true,
    canDelete: true,
    moveTargets: [{ id: STAGE_CONTACTED.id, label: STAGE_CONTACTED.nameEn }],
    showActivityEntry: true,
    onOpenLead: vi.fn(),
    onExpandView: vi.fn(),
    onOpenQuickModal: vi.fn(),
    onOpenActivities: vi.fn(),
    onDelete: vi.fn(),
    onMoveStage: vi.fn(),
    onCardChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<LeadBoardCard {...props} />), props };
}

describe("LeadBoardCard", () => {
  it.each([{ lang: "en", dict: en }, { lang: "ar", dict: ar }] as const)(
    "allows footer groups to wrap without truncating the activity pill in $lang",
    ({ lang, dict }) => {
      dictionary = dict;
      activeLang = lang;
      renderCard();
      const actions = screen.getByRole("button", { name: dict.crmLeads.executive.quickEdit }).parentElement;
      const footer = actions?.parentElement;
      const stars = screen.getByRole("group", { name: dict.crmLeads.card.rating });
      const pill = screen.getByRole("button", {
        name: formatTemplate(dict.crmLeads.card.activityOpen, { state: dict.crmLeads.card.activityStates.NONE }),
      });
      expect(footer).toHaveClass("flex", "flex-wrap", "items-center", "gap-x-1.5", "gap-y-1.5");
      expect(actions).toHaveClass("ms-auto", "shrink-0");
      expect(actions).toContainElement(screen.getByText("KR"));
      expect(stars).toHaveClass("gap-0.5");
      expect(stars.parentElement).toHaveClass("min-w-0", "max-w-full", "flex-wrap");
      expect(stars.parentElement).toContainElement(pill);
      expect(pill).toHaveClass("h-[23px]", "shrink-0", "whitespace-nowrap");
      expect(pill).not.toHaveClass("truncate", "overflow-hidden");
    },
  );

  it("renders lead name, 'No activities' when nextActivity is null, and omits time-in-stage text", () => {
    const { container } = renderCard();

    expect(screen.getByText("Ebrahim Essam")).toBeInTheDocument();
    expect(screen.getByText("No activities")).toBeInTheDocument();
    expect(screen.getByText("Call Center")).toBeInTheDocument();
    expect(screen.getByText("KR")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/in stage/i);
  });

  it("renders corporate contact subtitle 'Name • Role' and Arabic title weight for Arabic script", () => {
    const { unmount } = renderCard({
      lead: makeLead({
        leadProfileType: "CORPORATE",
        leadName: "Capital Hills",
        company: "Capital Hills",
        primaryContact: {
          partyId: "01900100-0000-7000-8000-000000000030",
          displayName: "Hossam Ali",
          jobTitle: "IT Manager",
          email: "hossam@example.test",
          phones: [],
          isPrimary: true,
        },
      }),
    });

    expect(screen.getByText("Capital Hills")).toBeInTheDocument();
    expect(screen.getByText("Hossam Ali")).toBeInTheDocument();
    expect(screen.getByText(/• IT Manager/)).toBeInTheDocument();
    unmount();

    dictionary = ar;
    activeLang = "ar";
    renderCard({
      lead: makeLead({
        leadProfileType: "CORPORATE",
        leadName: "المتحدة",
        company: "المتحدة",
        primaryContact: {
          partyId: "01900100-0000-7000-8000-000000000031",
          displayName: "سالم الهوارى",
          jobTitle: "",
          email: "",
          phones: [],
          isPrimary: true,
        },
      }),
    });

    const arabicHeading = screen.getByText("المتحدة").parentElement;
    expect(arabicHeading).toHaveClass("font-arabic", "text-base", "font-extrabold");
    expect(screen.getByText(ar.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
  });

  it("removes the expand button from the card face and exposes 'Expand card' inside LeadCardMenu", () => {
    const onExpandView = vi.fn();
    const lead = makeLead();
    const menuLabel = formatTemplate(en.crmLeads.card.more, { name: lead.leadName });
    const { unmount } = renderCard({ lead, onExpandView });

    expect(screen.queryByRole("button", { name: en.crmLeads.executive.expandCard })).toBeNull();

    const menuTrigger = screen.getByRole("button", { name: menuLabel });
    expect(menuTrigger).toHaveClass("size-[26px]", "bg-surface-subtle", "border-line-card");

    fireEvent.keyDown(menuTrigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.crmLeads.executive.expandCard }));
    expect(onExpandView).toHaveBeenCalledTimes(1);
    unmount();

    renderCard({ lead, onExpandView: undefined });
    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    expect(screen.queryByRole("menuitem", { name: en.crmLeads.executive.expandCard })).toBeNull();
  });

  it("applies the matching bar and pill activity colour classes for NONE, FUTURE, TODAY, and OVERDUE", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 14, 0, 0));

    const cases = [
      { state: "NONE" as const, nextActivity: null, key: "none" },
      {
        state: "FUTURE" as const,
        nextActivity: { activityAt: new Date(2026, 9, 27, 11, 0, 0).toISOString(), bucket: "FUTURE" as const },
        key: "future",
      },
      {
        state: "TODAY" as const,
        nextActivity: { activityAt: new Date(2026, 9, 26, 10, 0, 0).toISOString(), bucket: "TODAY" as const },
        key: "today",
      },
      {
        state: "OVERDUE" as const,
        nextActivity: { activityAt: new Date(2026, 9, 25, 16, 0, 0).toISOString(), bucket: "OVERDUE" as const },
        key: "overdue",
      },
    ];

    for (const testCase of cases) {
      const { unmount } = renderCard({ lead: makeLead({ nextActivity: testCase.nextActivity }) });
      expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass(`bg-activity-${testCase.key}`);

      const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, {
        state: en.crmLeads.card.activityStates[testCase.state],
      });
      expect(screen.getByRole("button", { name: pillLabel })).toHaveClass(
        `bg-activity-${testCase.key}-surface`,
        `border-activity-${testCase.key}-line`,
        `text-activity-${testCase.key}-text`,
      );
      unmount();
    }
  });

  it("preserves custom card colour tinting and fires rating, quick-modal, activity, and open callbacks", () => {
    const onOpenLead = vi.fn();
    const onOpenActivities = vi.fn();
    const onOpenQuickModal = vi.fn();
    const onCardChange = vi.fn();

    renderCard({
      lead: makeLead({ rating: 2, cardColor: "TEAL" }),
      onOpenLead,
      onOpenActivities,
      onOpenQuickModal,
      onCardChange,
    });

    expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass("bg-swatch-teal");

    fireEvent.click(screen.getByText("Ebrahim Essam"));
    expect(onOpenLead).toHaveBeenCalledTimes(1);

    const starTwoLabel = formatTemplate(en.crmLeads.card.rateStars, { count: "2", max: "3" });
    fireEvent.click(screen.getByRole("button", { name: starTwoLabel }));
    expect(onCardChange).toHaveBeenCalledWith({ rating: 0 });

    const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, {
      state: en.crmLeads.card.activityStates.NONE,
    });
    fireEvent.click(screen.getByRole("button", { name: pillLabel }));
    expect(onOpenActivities).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.quickEdit }));
    expect(onOpenQuickModal).toHaveBeenCalledTimes(1);
  });
});
