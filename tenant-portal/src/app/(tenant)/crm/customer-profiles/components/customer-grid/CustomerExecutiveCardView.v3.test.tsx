// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import type { CustomerProfileItem } from "../../hooks/useCustomerProfiles";
import { CustomerExecutiveCardView, type CustomerExecutiveCardViewProps } from "../CustomerExecutiveCardView";

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
    user: { id: "01900100-0000-7000-8000-000000000099", isTenantOwner: false, permissions: ["activities.create", "crm.customer_profiles.export"] },
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

function makeCustomer(overrides: Partial<CustomerProfileItem> = {}): CustomerProfileItem {
  return {
    id: "01900100-0000-7000-8000-000000000010", branchId: "01900100-0000-7000-8000-000000000050",
    partyId: "01900100-0000-7000-8000-000000000011", displayName: "Mona Saleh", profileType: "INDIVIDUAL",
    status: "PROSPECT", companyName: null, imageUrl: null, phone: "+201000000001", phones: ["+201000000001"],
    email: "mona@example.test", companyWebsite: null, country: "EG", city: "Cairo",
    primaryContactName: null, primaryContact: null, tags: [],
    ownerUserId: "01900100-0000-7000-8000-000000000020",
    owner: { userId: "01900100-0000-7000-8000-000000000020", firstName: "Kamal", lastName: "Radwan", avatarUrl: null },
    nextActivity: null, acquisitionSourceNameAr: "الموقع", acquisitionSourceNameEn: "Website",
    sourceIconUrl: null, rating: 2, cardColor: null, ...overrides,
  };
}

function renderGridView(overrides: Partial<CustomerExecutiveCardViewProps> = {}) {
  const props: CustomerExecutiveCardViewProps = {
    items: [makeCustomer()], selectedIds: new Set(), onSelectionChange: vi.fn(),
    canUpdate: () => true, canDelete: () => true, onOpen: vi.fn(), onOpenQuickModal: vi.fn(),
    onOpenActivities: vi.fn(), onDelete: vi.fn(), onMoveStatus: vi.fn(), onCardChange: vi.fn(),
    page: { page: 1, limit: 25, total: 60 }, onPageChange: vi.fn(), ...overrides,
  };
  return { ...render(<CustomerExecutiveCardView {...props} />), props };
}

describe("CustomerExecutiveCardView (v3)", () => {
  it("renders v3 card anatomy in a gap-3 grid with no stage-age, expand item, or purple chrome", () => {
    const customer = makeCustomer();
    const { container } = renderGridView({ items: [customer] });

    expect(screen.getByTestId("customer-card-grid")).toHaveClass("grid", "gap-3");
    expect(screen.getByTestId("customer-grid-card")).toHaveClass("h-full", "rounded-card", "shadow-card", "border-line-card");
    expect(screen.getByText("Mona Saleh")).toBeInTheDocument();
    expect(within(screen.getByTestId("customer-grid-card")).getByText(en.statusValues["CustomerStatus.PROSPECT"])).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("KR")).toBeInTheDocument();
    expect(screen.getByText("Kamal R.")).toBeInTheDocument();

    const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates.NONE });
    const pillButton = screen.getByRole("button", { name: pillLabel });
    expect(pillButton).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(pillButton.firstElementChild).toHaveClass("shrink-0", "whitespace-nowrap");
    expect(screen.getByText("No activities")).not.toHaveClass("truncate");
    expect(container.textContent).not.toMatch(/in stage|just now/i);
    expect(container.innerHTML).not.toMatch(/swatch-purple|indigo|violet|fuchsia/i);

    const menuLabel = formatTemplate(en.crmLeads.card.more, { name: customer.displayName });
    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    expect(screen.queryByRole("menuitem", { name: en.crmLeads.executive.expandCard })).toBeNull();
  });

  it("applies v3 activity tokens, custom card swatches, and neutral BLACKLISTED terminal treatment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 14, 0, 0));
    const cases = [
      { state: "NONE" as const, nextActivity: null, key: "none" },
      { state: "FUTURE" as const, nextActivity: { activityAt: new Date(2026, 9, 27, 11).toISOString(), bucket: "FUTURE" as const }, key: "future" },
      { state: "TODAY" as const, nextActivity: { activityAt: new Date(2026, 9, 26, 10).toISOString(), bucket: "TODAY" as const }, key: "today" },
      { state: "OVERDUE" as const, nextActivity: { activityAt: new Date(2026, 9, 25, 16).toISOString(), bucket: "OVERDUE" as const }, key: "overdue" },
    ];
    for (const c of cases) {
      const { unmount } = renderGridView({ items: [makeCustomer({ nextActivity: c.nextActivity })] });
      expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass(`bg-activity-${c.key}`);
      const pillLabel = formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates[c.state] });
      expect(screen.getByRole("button", { name: pillLabel }).firstElementChild).toHaveClass(
        `bg-activity-${c.key}-surface`, `border-activity-${c.key}-line`, `text-activity-${c.key}-text`,
      );
      unmount();
    }

    const { unmount: unmountSwatch } = renderGridView({ items: [makeCustomer({ cardColor: "TEAL" })] });
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-swatch-teal");
    expect(screen.getByTestId("customer-grid-card")).toHaveClass("border-swatch-teal");
    unmountSwatch();

    renderGridView({
      items: [makeCustomer({
        status: "BLACKLISTED",
        nextActivity: { activityAt: new Date(2026, 9, 25, 16).toISOString(), bucket: "OVERDUE" },
      })],
    });
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-none");
    const blacklistedNodes = screen.getAllByText(en.statusValues["CustomerStatus.BLACKLISTED"]);
    expect(blacklistedNodes.some((el) => el.parentElement?.classList.contains("bg-activity-none-surface"))).toBe(true);
  });

  it("renders corporate contact, phone channels, email/website, document counts visibility, and Arabic optical title", () => {
    const partyId = "01900100-0000-7000-8000-000000000041";
    const corporate = makeCustomer({
      id: "01900100-0000-7000-8000-000000000040", partyId, profileType: "CORPORATE",
      displayName: "النور للتجارة", companyName: "النور للتجارة", companyWebsite: "https://alnoor.sa",
      primaryContactName: "خالد عمر",
      primaryContact: {
        partyId: "01900100-0000-7000-8000-000000000042", displayName: "خالد عمر", jobTitle: "مدير المشتريات",
        email: "khaled@alnoor.sa", phones: ["+966501234567"], isPrimary: true,
      },
    });
    activeLang = "ar";
    dictionary = ar;

    renderGridView({
      items: [corporate],
      documentCountsByParty: new Map([[partyId, { opportunities: 4, quotations: 3, salesOrders: 2, invoices: 1 }]]),
      documentCountVisibility: { opportunities: true, quotations: false, salesOrders: true, invoices: true },
    });

    expect(screen.getByText("النور للتجارة").parentElement).toHaveClass("font-arabic", "text-base", "font-extrabold");
    expect(screen.getByText("خالد عمر")).toBeInTheDocument();
    expect(screen.getByText(/• مدير المشتريات/)).toBeInTheDocument();
    expect(screen.getByText("+966501234567")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: formatTemplate(ar.crmLeadDetail.callNumber, { value: "+966501234567" }) })).toHaveAttribute("href", "tel:+966501234567");
    expect(screen.getByText("khaled@alnoor.sa")).toHaveAttribute("href", "mailto:khaled@alnoor.sa");
    expect(screen.getByText("alnoor.sa")).toHaveAttribute("href", "https://alnoor.sa");

    const oppLink = screen.getByTestId(`customer-card-opp-${corporate.id}`);
    expect(oppLink).toHaveAttribute("href", `/crm/opportunities?partyId=${partyId}`);
    expect(oppLink).toHaveClass("bg-surface-subtle", "border-line-card");
    expect(within(oppLink).getByText("4")).toBeInTheDocument();
    expect(screen.queryByTestId(`customer-card-pq-${corporate.id}`)).toBeNull();
  });

  it("wires selection, standalone link, add phone, rating, activities, quick edit, menu, and pagination", () => {
    const customer = makeCustomer({ phone: null, phones: [], rating: 2 });
    const spies = {
      onSelectionChange: vi.fn(), onOpen: vi.fn(), onOpenQuickModal: vi.fn(), onOpenActivities: vi.fn(),
      onDelete: vi.fn(), onMoveStatus: vi.fn(), onCardChange: vi.fn(), onPageChange: vi.fn(),
    };
    renderGridView({ items: [customer], ...spies });

    fireEvent.click(screen.getByRole("checkbox", { name: `${en.views.selectItem}: Mona Saleh` }));
    expect(spies.onSelectionChange).toHaveBeenCalledWith(new Set([customer.id]));
    expect(spies.onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: en.views.selectAll }));
    expect(spies.onSelectionChange).toHaveBeenLastCalledWith(new Set([customer.id]));

    fireEvent.click(screen.getByText("Mona Saleh"));
    expect(spies.onOpen).toHaveBeenCalledWith(customer);
    expect(screen.getByRole("link", { name: en.crmLeads.executive.openStandalonePage })).toHaveAttribute(
      "href", `/crm/customer-profiles/${encodeURIComponent(customer.id)}`,
    );

    fireEvent.click(screen.getByRole("button", { name: en.crmLeads.executive.addPhoneNumber }));
    expect(spies.onOpenQuickModal).toHaveBeenCalledWith(customer);

    fireEvent.click(screen.getByRole("button", { name: formatTemplate(en.crmLeads.card.rateStars, { count: "2", max: "3" }) }));
    expect(spies.onCardChange).toHaveBeenCalledWith(customer, { rating: 0 });

    fireEvent.click(screen.getByRole("button", { name: formatTemplate(en.crmLeads.card.activityOpen, { state: en.crmLeads.card.activityStates.NONE }) }));
    expect(spies.onOpenActivities).toHaveBeenCalledWith(customer);

    fireEvent.click(screen.getByRole("button", { name: en.crmCustomerProfiles.ui.card.quick_360_inspect_edit }));
    expect(spies.onOpenQuickModal).toHaveBeenCalledTimes(2);

    const menuLabel = formatTemplate(en.crmLeads.card.more, { name: customer.displayName });
    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.statusValues["CustomerStatus.ACTIVE_CUSTOMER"] }));
    expect(spies.onMoveStatus).toHaveBeenCalledWith(customer, "ACTIVE_CUSTOMER");

    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.crmLeads.card.colors.TEAL }));
    expect(spies.onCardChange).toHaveBeenCalledWith(customer, { cardColor: "TEAL" });

    fireEvent.keyDown(screen.getByRole("button", { name: menuLabel }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: en.common.delete }));
    expect(spies.onDelete).toHaveBeenCalledWith(customer);

    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(spies.onPageChange).toHaveBeenCalledWith(2);
  });
});
