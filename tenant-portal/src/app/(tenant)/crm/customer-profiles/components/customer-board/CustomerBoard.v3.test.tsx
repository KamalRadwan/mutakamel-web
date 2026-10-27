// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "@/lib/api/axiosClient";
import { localizedValue } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { customerProfilePath, type CustomerProfileItem, type CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import { CustomerExecutiveBoardView } from "../CustomerExecutiveBoardView";
import type { CustomerExecutiveBoardViewProps } from "./customer-board-types";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" } as const;
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang, dir: directions[locale.lang] }),
}));
vi.mock("../../../leads/hooks/useLeadCompanyOptions", () => ({
  useLeadCompanyOptions: () => ({ companies: [], selectCompany: vi.fn(), isLoadingCompanies: false }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get: vi.fn(() => new Promise(() => {})) },
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ success: vi.fn(), warning: vi.fn(), errorFromApi: vi.fn() }),
}));
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(axiosClient.get).mockReset().mockImplementation(() => new Promise(() => {}));
  document.documentElement.classList.remove("dark");
  // Collapsed columns persist per route in localStorage; start every test clean.
  localStorage.clear();
});
const customer: CustomerProfileItem = {
  id: "01950000-0000-7000-8000-000000000001", branchId: "01950000-0000-7000-8000-000000000002",
  partyId: "01950000-0000-7000-8000-000000000003", displayName: "Dina Ali",
  profileType: "INDIVIDUAL", status: "PROSPECT", companyName: null, imageUrl: null,
  phone: "+201001234567", phones: ["+201001234567"], email: null, companyWebsite: null,
  country: "EG", city: "", primaryContactName: null, primaryContact: null,
  tags: [{ id: "01950000-0000-7000-8000-000000000004", name: "VIP", backgroundColor: null, textColor: null }],
  ownerUserId: null, owner: null, nextActivity: null, rating: 1, cardColor: null,
  acquisitionSourceNameAr: "الموقع", acquisitionSourceNameEn: "Website", sourceIconUrl: null,
};
function boardProps(overrides: Partial<CustomerExecutiveBoardViewProps> = {}): CustomerExecutiveBoardViewProps {
  return { items: [customer], statusTotals: new Map(), lanes: {}, loadingStatuses: new Set(),
    branchId: customer.branchId, canCreate: true, canUpdate: () => true, canDelete: () => true,
    onLoadMoreStatus: vi.fn(), onOpen: vi.fn(), onOpenQuickModal: vi.fn(), onOpenActivities: vi.fn(),
    onDelete: vi.fn(), onCardChange: vi.fn(), onCardMove: vi.fn(), ...overrides };
}
function renderBoard(overrides: Partial<CustomerExecutiveBoardViewProps> = {}) {
  const props = boardProps(overrides);
  return { props, ...render(<div dir={directions[locale.lang]}><CustomerExecutiveBoardView {...props} /></div>) };
}
function column(status: CustomerProfileStatus) {
  return screen.getByRole("region", { name: dictionaries[locale.lang].statusValues[`CustomerStatus.${status}`] });
}
function draggableCard() {
  const node = screen.getByText(customer.displayName).closest<HTMLDivElement>('[draggable="true"]');
  if (!node) throw new Error("Draggable customer is missing");
  return node;
}
function transfer() { return { setData: vi.fn(), effectAllowed: "", dropEffect: "" }; }

describe.each([
  ["en", "light"], ["en", "dark"], ["ar", "light"], ["ar", "dark"],
] as const)("Customers v3 (%s, %s)", (lang, theme) => {
  function setup() {
    locale.lang = lang;
    document.documentElement.classList.toggle("dark", theme === "dark");
    return dictionaries[lang];
  }
  it("uses v3 surfaces and keeps source and stage age off the face", () => {
    const t = setup();
    const { container } = renderBoard();
    expect(column("PROSPECT")).toHaveClass("min-w-[282px]", "bg-surface-column", "rounded-column");
    expect(screen.getByRole("region", { name: t.crmCustomerProfiles.ui.board.customer_status_board })).toHaveClass("px-5", "pb-5");
    expect(screen.getByText(t.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.queryByText(/in stage|في المرحلة/u)).toBeNull();
    expect(screen.queryByText(t.crmCustomerProfiles.ui.board.just_now)).toBeNull();
    expect(screen.queryByText(localizedValue(customer.acquisitionSourceNameAr, customer.acquisitionSourceNameEn, lang))).toBeNull();
    expect(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.expand_card_details })).toHaveClass("size-[26px]");
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeInTheDocument();
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-none");
  });
  it("expands through the arrow, fetches details, retains phone actions and collapses", () => {
    const t = setup();
    const { props, container } = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.expand_card_details }));
    expect(axiosClient.get).toHaveBeenCalledWith(customerProfilePath(customer.id), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText(localizedValue(customer.acquisitionSourceNameAr, customer.acquisitionSourceNameEn, lang))).toBeInTheDocument();
    expect(container.querySelector('a[href="tel:+201001234567"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="https://wa.me/201001234567"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="https://t.me/+201001234567"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.open_360_quick_edit_modal }));
    expect(props.onOpenQuickModal).toHaveBeenCalledWith(customer);
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.card.activityStates.NONE }));
    expect(props.onOpenActivities).toHaveBeenCalledWith(customer);
    fireEvent.click(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.collapse_card }));
    expect(screen.queryByText(t.crmCustomerProfiles.ui.board.acquisition_source)).toBeNull();
  });
  it("uses validated corporate detail and preserves company/contact display limits", async () => {
    const t = setup();
    const corporate: CustomerProfileItem = { ...customer, displayName: "Atlas", companyName: "Atlas",
      profileType: "CORPORATE", primaryContactName: "Summary contact", phone: null, phones: [] };
    const companyPhones = ["+201001234560", "+201001234561", "+201001234562"];
    const contacts = ["01950000-0000-7000-8000-000000000010", "01950000-0000-7000-8000-000000000011",
      "01950000-0000-7000-8000-000000000012", "01950000-0000-7000-8000-000000000013"]
      .map((partyId, index) => ({ partyId, displayName: `Contact ${index}`, jobTitle: "Buyer", isPrimary: index === 0,
        phones: [`+20100123457${index}`, `+20100123458${index}`] }));
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: { ...corporate, companyPhone: companyPhones[0],
      phones: companyPhones, contacts, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
      status: 200, statusText: "OK", headers: new Headers() });
    const { container } = renderBoard({ items: [corporate] });
    fireEvent.click(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.expand_card_details }));
    expect(await screen.findByText("Contact 2")).toBeInTheDocument();
    expect(screen.queryByText("Contact 3")).toBeNull();
    expect(container.querySelector('a[href="tel:+201001234560"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="tel:+201001234561"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="tel:+201001234562"]')).toBeNull();
    expect(container.querySelector('a[href="tel:+201001234570"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="tel:+201001234580"]')).toBeNull();
    expect(screen.queryByText(t.crmCustomerProfiles.ui.board.just_now)).toBeNull();
  });
  it("renders 100% neutral activity bars in empty columns and no blacklisted quick add", () => {
    const t = setup();
    const { container } = renderBoard({ items: [] });
    for (const segment of container.querySelectorAll("[data-activity-state]")) {
      expect(segment).toHaveAttribute("data-activity-state", "NONE");
      expect(segment).toHaveStyle({ width: "100%" });
    }
    expect(screen.getAllByText(t.crmCustomerProfiles.ui.board.emptyStage.title)).toHaveLength(4);
    expect(within(column("BLACKLISTED")).getByText(t.crmCustomerProfiles.ui.board.emptyStage.hint.BLACKLISTED)).toBeInTheDocument();
    expect(within(column("BLACKLISTED")).queryByRole("button", { name: t.crmCustomerProfiles.ui.board.emptyStage.quickAdd })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: t.crmCustomerProfiles.ui.board.emptyStage.quickAdd })[0]);
    expect(screen.getByPlaceholderText(t.crmCustomerProfiles.ui.board.first_name)).toBeInTheDocument();
  });
  it("uses loaded items for activity proportions and retains a selected zero segment", () => {
    const t = setup();
    const future: CustomerProfileItem = { ...customer, id: "01950000-0000-7000-8000-000000000005", displayName: "Future customer",
      nextActivity: { activityAt: "2099-01-01T00:00:00Z", bucket: "OVERDUE" } };
    const { props, rerender } = renderBoard({ items: [customer, future], statusTotals: new Map([["PROSPECT", 100]]) });
    const segment = column("PROSPECT").querySelector<HTMLButtonElement>('[data-activity-state="FUTURE"]')!;
    expect(segment).toHaveStyle({ width: "50%" });
    fireEvent.click(segment);
    expect(screen.queryByText(customer.displayName)).toBeNull();
    expect(screen.getByText(future.displayName)).toBeInTheDocument();
    rerender(<div dir={directions[locale.lang]}><CustomerExecutiveBoardView {...props} items={[customer]} /></div>);
    const selected = column("PROSPECT").querySelector('[data-activity-state="FUTURE"]');
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveStyle({ width: "0%" });
    fireEvent.click(screen.getByRole("button", { name: t.crmCustomerProfiles.ui.board.clear }));
    expect(screen.getByText(customer.displayName)).toBeInTheDocument();
  });
  it("keeps collapse state and status paging", () => {
    const t = setup();
    const { props } = renderBoard({ lanes: { PROSPECT: { items: [customer], total: 10, page: 1, hasMore: true } },
      statusTotals: new Map([["PROSPECT", 10]]) });
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.loadMore(1, 10) }));
    expect(props.onLoadMoreStatus).toHaveBeenCalledWith("PROSPECT");
    const title = t.statusValues["CustomerStatus.PROSPECT"];
    fireEvent.click(screen.getByRole("button", { name: `${t.views.collapseColumn}: ${title}` }));
    expect(screen.queryByText(customer.displayName)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` }));
    expect(screen.getByText(customer.displayName)).toBeInTheDocument();
  });
  it("moves with native drag/drop and the floating dock", () => {
    const t = setup();
    const { props } = renderBoard();
    const dataTransfer = transfer();
    fireEvent.dragStart(draggableCard(), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", customer.id);
    expect(screen.getByText(t.crmCustomerProfiles.ui.board.quick_drop_status)).toBeInTheDocument();
    fireEvent.dragOver(column("INACTIVE"), { dataTransfer });
    fireEvent.drop(column("INACTIVE"), { dataTransfer });
    expect(props.onCardMove).toHaveBeenCalledWith({ itemId: customer.id, fromColumnId: "PROSPECT", toColumnId: "INACTIVE", toIndex: 0 });
    expect(screen.queryByText(t.crmCustomerProfiles.ui.board.quick_drop_status)).toBeNull();
    fireEvent.dragStart(draggableCard(), { dataTransfer });
    fireEvent.click(screen.getByRole("button", { name: t.statusValues["CustomerStatus.BLACKLISTED"] }));
    expect(props.onCardMove).toHaveBeenLastCalledWith(expect.objectContaining({ toColumnId: "BLACKLISTED" }));
  });
  it("peeks a collapsed column after drag hover and restores the rail after drag ends", () => {
    const t = setup();
    vi.useFakeTimers();
    renderBoard();
    const title = t.statusValues["CustomerStatus.INACTIVE"];
    fireEvent.click(screen.getByRole("button", { name: `${t.views.collapseColumn}: ${title}` }));
    const rail = screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` }).parentElement!;
    fireEvent.dragStart(draggableCard(), { dataTransfer: transfer() });
    fireEvent.dragOver(rail, { dataTransfer: transfer() });
    act(() => vi.advanceTimersByTime(400));
    expect(column("INACTIVE")).toBeInTheDocument();
    fireEvent.dragEnd(draggableCard());
    expect(screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` })).toBeInTheDocument();
  });
  it("keeps blacklisted cards neutral and respects action permissions", () => {
    const t = setup();
    renderBoard({ items: [{ ...customer, status: "BLACKLISTED", cardColor: "RED",
      nextActivity: { activityAt: "2000-01-01T00:00:00Z", bucket: "OVERDUE" } }], canUpdate: () => false, canDelete: () => false, canCreate: false });
    expect(screen.getByText(t.crmCustomerProfiles.ui.board.closed).parentElement).toHaveClass("bg-activity-none-surface");
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-none");
    expect(screen.queryByRole("button", { name: t.crmLeads.card.activityStates.OVERDUE })).toBeNull();
    expect(screen.queryByRole("button", { name: formatTemplate(t.crmLeads.card.rateStars, { count: "1", max: "3" }) })).toBeNull();
    expect(screen.getByText(customer.displayName).closest('[draggable="false"]')).toBeInTheDocument();
    expect(within(column("BLACKLISTED")).getByTestId("column-count-pill")).toHaveClass("bg-count-danger-surface");
  });
});
