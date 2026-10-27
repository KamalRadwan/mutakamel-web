// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../lead-list-contract";
import { LeadExecutiveCardView, type LeadExecutiveCardViewProps } from "./LeadExecutiveCardView";

const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;
let dictionary: Dictionary = en;
let activeLang: "en" | "ar" = "en";
let canMutate = true;

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionary, lang: activeLang, dir: DIRECTIONS[activeLang], setLang: vi.fn(), toggleLang: vi.fn() }),
}));
vi.mock("@/hooks/useAccessMode", () => ({
  useAccessMode: () => ({ mode: "FULL" as const, isResolved: true, canRead: true, canMutate, isRestricted: false }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { id: "01900100-0000-7000-8000-000000000099", isTenantOwner: false, permissions: ["activities.create", "crm.leads.export"] },
  }),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => { dictionary = en; activeLang = "en"; canMutate = true; });
afterEach(() => { vi.useRealTimers(); cleanup(); });

const STAGE_NEW: LeadStage = { id: "01900100-0000-7000-8000-000000000001", nameAr: "جديد", nameEn: "New", flag: "NEW" };
const STAGE_CONTACTED: LeadStage = { id: "01900100-0000-7000-8000-000000000002", nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED" };

function makeLead(overrides: Partial<LeadItem> = {}): LeadItem {
  return {
    id: "01900100-0000-7000-8000-000000000010", partyId: "01900100-0000-7000-8000-000000000011",
    leadProfileType: "INDIVIDUAL", leadName: "Ebrahim Essam", company: "Ebrahim Essam",
    email: "ebrahim@example.test", phone: "+201000000001", phones: ["+201000000001"], country: "EG",
    primaryContact: null, sourceNameAr: "مركز الاتصال", sourceNameEn: "Call Center", sourceIconUrl: null,
    stageId: STAGE_NEW.id, ownerUserId: "01900100-0000-7000-8000-000000000020", rating: 3, cardColor: null,
    owner: { userId: "01900100-0000-7000-8000-000000000020", firstName: "Kamal", lastName: "Radwan" },
    nextActivity: null, tags: [], stageEnteredAt: "2026-10-16T08:00:00.000Z", ...overrides,
  };
}

function renderGridView(overrides: Partial<LeadExecutiveCardViewProps> = {}) {
  const props: LeadExecutiveCardViewProps = {
    items: [makeLead()], stages: [STAGE_NEW, STAGE_CONTACTED], branchId: "01900100-0000-7000-8000-000000000050",
    selectedIds: new Set(), onSelectionChange: vi.fn(), canUpdate: () => true, canDelete: () => true,
    isLoading: false, error: null, onRetry: vi.fn(), page: { page: 1, limit: 50, total: 120 },
    onPageChange: vi.fn(), sort: { id: "createdAt", direction: "desc" }, onSortChange: vi.fn(),
    onOpenLead: vi.fn(), onOpenQuickModal: vi.fn(), onOpenActivities: vi.fn(), onDeleteLead: vi.fn(),
    onMoveStage: vi.fn(), onCardChange: vi.fn(), ...overrides,
  };
  return { ...render(<LeadExecutiveCardView {...props} />), props };
}

describe("LeadExecutiveCardView", () => {
  it("renders v3 anatomy in a gap-3 grid, omits stage-age and expand affordances, and never truncates the activity pill", () => {
    const lead = makeLead();
    const { container } = renderGridView({ items: [lead] });

    expect(screen.getByTestId("lead-card-grid")).toHaveClass("grid", "gap-3");
    expect(screen.getByTestId("lead-grid-card")).toHaveClass("h-full", "rounded-card", "shadow-card", "border-line-card");
    expect(screen.getByText("Ebrahim Essam")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Call Center")).toBeInTheDocument();
    expect(screen.getByText("KR")).toBeInTheDocument();

    const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates.NONE });
    expect(screen.getByRole("button", { name: pillLabel })).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(screen.getByText("No activities")).not.toHaveClass("truncate");
    expect(container.textContent).not.toMatch(/in stage/i);
    expect(screen.queryByRole("button", { name: en.crmLeads.executive.expandCard })).toBeNull();

    const menuLabel = formatTemplate(en.crmLeads.card.more, { name: lead.leadName });
    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    expect(screen.queryByRole("menuitem", { name: en.crmLeads.executive.expandCard })).toBeNull();
  });

  it("renders corporate contact subtitle 'Name • Role' and optical Arabic title classes", () => {
    const primaryContact = {
      partyId: "01900100-0000-7000-8000-000000000030",
      displayName: "Hossam Ali",
      jobTitle: "IT Manager",
      email: "hossam@example.test",
      phones: [],
      isPrimary: true,
    };
    const { unmount } = renderGridView({
      items: [makeLead({ leadProfileType: "CORPORATE", leadName: "Capital Hills", company: "Capital Hills", primaryContact })],
    });
    expect(screen.getByText("Capital Hills")).toBeInTheDocument();
    expect(screen.getByText("Hossam Ali")).toBeInTheDocument();
    expect(screen.getByText(/• IT Manager/)).toBeInTheDocument();
    unmount();

    dictionary = ar;
    activeLang = "ar";
    renderGridView({ items: [makeLead({ leadProfileType: "CORPORATE", leadName: "المتحدة", company: "المتحدة" })] });
    expect(screen.getByText("المتحدة").parentElement).toHaveClass("font-arabic", "text-base", "font-extrabold");
    expect(screen.getByText(ar.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
  });

  it("applies matching activity bar/pill tokens for NONE, FUTURE, TODAY, OVERDUE and custom card colours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 14, 0, 0));
    const cases = [
      { state: "NONE" as const, nextActivity: null, key: "none" },
      { state: "FUTURE" as const, nextActivity: { activityAt: new Date(2026, 9, 27, 11).toISOString(), bucket: "FUTURE" as const }, key: "future" },
      { state: "TODAY" as const, nextActivity: { activityAt: new Date(2026, 9, 26, 10).toISOString(), bucket: "TODAY" as const }, key: "today" },
      { state: "OVERDUE" as const, nextActivity: { activityAt: new Date(2026, 9, 25, 16).toISOString(), bucket: "OVERDUE" as const }, key: "overdue" },
    ];
    for (const c of cases) {
      const { unmount } = renderGridView({ items: [makeLead({ nextActivity: c.nextActivity })] });
      expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass(`bg-activity-${c.key}`);
      const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates[c.state] });
      expect(screen.getByRole("button", { name: pillLabel })).toHaveClass(
        `bg-activity-${c.key}-surface`,
        `border-activity-${c.key}-line`,
        `text-activity-${c.key}-text`,
      );
      unmount();
    }
    renderGridView({ items: [makeLead({ cardColor: "TEAL" })] });
    expect(screen.getByTestId("lead-card-activity-bar")).toHaveClass("bg-swatch-teal");
    expect(screen.getByTestId("lead-grid-card")).toHaveClass("border-swatch-teal");
  });

  it.each([
    {
      lang: "en" as const,
      dict: en,
      owner: { userId: "01900100-0000-7000-8000-000000000020", firstName: "Kamal", lastName: "Radwan" },
      ownerShort: "Kamal R.",
      ownerFull: "Kamal Radwan",
      interestSummary: "Needs multi-branch cloud ERP",
      expectedNeed: "60 user licences Q4",
      fallbackDescription: "Referred from Cairo summit",
    },
    {
      lang: "ar" as const,
      dict: ar,
      owner: { userId: "01900100-0000-7000-8000-000000000020", firstName: "كمال", lastName: "رضوان" },
      ownerShort: "كمال ر.",
      ownerFull: "كمال رضوان",
      interestSummary: "يحتاج نظام إدارة موارد سحابي متعدد الفروع",
      expectedNeed: "60 ترخيص مستخدم في الربع الرابع",
      fallbackDescription: "توصية من مؤتمر القاهرة",
    },
  ])("renders need snippet, phone/email, 4 document count links, and owner name in $lang", (tc) => {
    activeLang = tc.lang;
    dictionary = tc.dict;
    const personPartyId = "01900100-0000-7000-8000-000000000011";
    const personLead = makeLead({
      partyId: personPartyId,
      owner: tc.owner,
      interestSummary: tc.interestSummary,
      expectedNeed: tc.expectedNeed,
    });
    const companyLead = makeLead({
      id: "01900100-0000-7000-8000-000000000040",
      partyId: "01900100-0000-7000-8000-000000000041",
      leadProfileType: "CORPORATE",
      leadName: "Capital Hills",
      company: "Capital Hills",
      phone: "+20220000000",
      phones: ["+20220000000"],
      email: "info@capital.test",
      description: tc.fallbackDescription,
      owner: null,
      primaryContact: {
        partyId: "01900100-0000-7000-8000-000000000042",
        displayName: "Hossam Ali",
        jobTitle: "IT Manager",
        email: "hossam@capital.test",
        phones: ["+201222333444"],
        isPrimary: true,
      },
    });
    renderGridView({
      items: [personLead, companyLead],
      documentCountsByParty: new Map([[personPartyId, { opportunities: 4, quotations: 3, salesOrders: 2, invoices: 1 }]]),
    });

    expect(screen.getByText(tc.interestSummary)).toHaveClass("line-clamp-2", "text-caption", "text-foreground-secondary");
    expect(screen.getByText(tc.expectedNeed)).toBeInTheDocument();
    expect(screen.getByText(tc.fallbackDescription)).toHaveClass("line-clamp-2", "text-caption", "text-foreground-secondary");

    expect(screen.getByText("+201000000001")).toBeInTheDocument();
    expect(screen.getByText("ebrahim@example.test")).toHaveAttribute("href", "mailto:ebrahim@example.test");
    expect(screen.getByRole("link", { name: formatTemplate(tc.dict.crmLeadDetail.callNumber, { value: "+201000000001" }) })).toHaveAttribute("href", "tel:+201000000001");
    expect(screen.getByRole("link", { name: formatTemplate(tc.dict.crmLeadDetail.whatsappNumber, { value: "+201000000001" }) })).toHaveAttribute("href", "https://wa.me/201000000001");

    expect(screen.getByText("+201222333444")).toBeInTheDocument();
    expect(screen.queryByText("+20220000000")).toBeNull();
    expect(screen.getByText("hossam@capital.test")).toHaveAttribute("href", "mailto:hossam@capital.test");
    expect(screen.queryByText("info@capital.test")).toBeNull();

    const docCases = [
      { kind: "opportunities" as const, short: tc.dict.crmCustomerProfiles.ui.card.opps, count: "4", href: `/crm/opportunities?partyId=${personPartyId}` },
      { kind: "quotations" as const, short: tc.dict.crmCustomerProfiles.ui.card.quotes, count: "3", href: `/trade/quotations?partyId=${personPartyId}` },
      { kind: "salesOrders" as const, short: tc.dict.crmCustomerProfiles.ui.card.orders, count: "2", href: `/trade/sales-orders?partyId=${personPartyId}` },
      { kind: "invoices" as const, short: tc.dict.crmCustomerProfiles.ui.card.invoices, count: "1", href: `/trade/invoices?partyId=${personPartyId}` },
    ];
    for (const doc of docCases) {
      const label = formatTemplate(tc.dict.crmLeadDetail.related.labelWithCount, { name: tc.dict.crmLeadDetail.related.labels[doc.kind], count: doc.count });
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", doc.href);
      expect(link).toHaveClass("bg-surface-subtle", "border-line-card", "rounded-md");
      expect(within(link).getByText(doc.short).parentElement).toHaveClass("text-badge");
      expect(within(link).getByText(doc.count)).toHaveClass("font-bold", "tabular-nums");
    }

    expect(screen.getByText(tc.ownerShort)).toBeInTheDocument();
    expect(screen.getByLabelText(formatTemplate(tc.dict.crmLeads.card.owner, { name: tc.ownerFull }))).toBeInTheDocument();
  });

  it("preserves selection, open lead, standalone link, add phone, quick edit, rating, activities, menu actions, and pagination", () => {
    const lead = makeLead({ rating: 2, phone: "", phones: [] });
    const spies = {
      onSelectionChange: vi.fn(),
      onOpenLead: vi.fn(),
      onOpenQuickModal: vi.fn(),
      onOpenActivities: vi.fn(),
      onDeleteLead: vi.fn(),
      onMoveStage: vi.fn(),
      onCardChange: vi.fn(),
      onPageChange: vi.fn(),
    };
    renderGridView({ items: [lead], ...spies });

    fireEvent.click(screen.getByRole("checkbox", { name: `${en.views.selectItem}: Ebrahim Essam` }));
    expect(spies.onSelectionChange).toHaveBeenCalledWith(new Set([lead.id]));
    expect(spies.onOpenLead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: en.views.selectAll }));
    expect(spies.onSelectionChange).toHaveBeenLastCalledWith(new Set([lead.id]));

    fireEvent.click(screen.getByText("Ebrahim Essam"));
    expect(spies.onOpenLead).toHaveBeenCalledWith(lead);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.openStandalonePage }));
    expect(spies.onOpenLead).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.addPhoneNumber }));
    expect(spies.onOpenQuickModal).toHaveBeenCalledWith(lead);

    fireEvent.click(screen.getByRole("button", { name: formatTemplate(en.crmLeads.card.rateStars, { count: "2", max: "3" }) }));
    expect(spies.onCardChange).toHaveBeenCalledWith(lead.id, { rating: 0 }, lead);
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates.NONE }) }));
    expect(spies.onOpenActivities).toHaveBeenCalledWith(lead);
    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.quickEdit }));
    expect(spies.onOpenQuickModal).toHaveBeenCalledTimes(2);

    const menuLabel = formatTemplate(en.crmLeads.card.more, { name: lead.leadName });
    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: STAGE_CONTACTED.nameEn }));
    expect(spies.onMoveStage).toHaveBeenCalledWith(lead, STAGE_CONTACTED.id);

    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.crmLeads.card.colors.TEAL }));
    expect(spies.onCardChange).toHaveBeenCalledWith(lead.id, { cardColor: "TEAL" }, lead);

    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.common.delete }));
    expect(spies.onDeleteLead).toHaveBeenCalledWith(lead);

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(spies.onPageChange).toHaveBeenCalledWith(2);
  });
});
