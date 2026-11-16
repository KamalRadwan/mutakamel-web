// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { CommercialAccount } from "./commercial-account-contract";
import { ACCOUNT_UI_COPY } from "./commercial-account-metadata";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", canManage: true,
  edit: vi.fn(), page: vi.fn(), role: vi.fn(), status: vi.fn() }));
const dictionaries = { en, ar };
const account: CommercialAccount = {
  id: "01900100-0000-7000-8000-000000000001", partyId: "01900100-0000-7000-8000-000000000002",
  companyId: "01900100-0000-7000-8000-000000000003", accountRole: "CUSTOMER", status: "ACTIVE",
  creditLimit: "9007199254740993.15", creditCurrencyCode: "EGP", priceBookId: null,
  creditPolicyVersionId: null, terms: {}, blockReasonCode: null, version: 1, updatedAt: "2026-10-17T00:00:00.000Z",
};
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[state.lang], lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" }) }));
vi.mock("./hooks/useCommercialAccounts", () => ({ useCommercialAccounts: () => ({
  items: [account], pageInfo: { page: 1, limit: 20, total: 40 }, canManage: state.canManage,
  scopeGap: null, writeScopeGap: null, roleFilter: undefined, statusFilter: undefined,
  isLoading: false, isRefreshing: false, isSubmitting: false, queryError: null, formError: null,
  createOpen: false, editing: null, reload: vi.fn(), openCreate: vi.fn(), openEdit: state.edit,
  closeCreate: vi.fn(), closeEdit: vi.fn(), create: vi.fn(), update: vi.fn(),
  setPage: state.page, setRoleFilter: state.role, setStatusFilter: state.status,
}) }));
vi.mock("../TradeScopeBar", () => ({ TradeScopeBar: () => <div data-testid="scope-controls" /> }));
vi.mock("./components/AccountDrawers", () => ({
  CreateAccountDrawer: () => null, EditAccountDrawer: () => null,
  AccountInspectModal: ({ account: item }: { account: CommercialAccount | null }) => item ? <div role="dialog">{item.partyId}</div> : null,
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import TradeCommercialAccountsPage from "./page";

beforeEach(() => { state.lang = "en"; state.canManage = true; vi.clearAllMocks(); });
afterEach(cleanup);
const renderPage = () => render(<TooltipProvider><TradeCommercialAccountsPage /></TooltipProvider>);

describe("commercial account workspace", () => {
  it.each(["en", "ar"] as const)("keeps a single inline scope and create action, without a side inspector in %s", (lang) => {
    state.lang = lang;
    const { container } = renderPage();
    expect(screen.getAllByTestId("scope-controls")).toHaveLength(1);
    expect(container.querySelector("dl")?.children).toHaveLength(4);
    expect(screen.queryByText(ACCOUNT_UI_COPY[lang].inspectorTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: dictionaries[lang].trade.accountCreate })).toHaveLength(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/9,007,199,254,740,993\.15/)).toBeInTheDocument();
  });

  it("keeps server pagination available in the card view", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_UI_COPY.en.cardsView }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: en.common.nextPage }));
    expect(state.page).toHaveBeenCalledWith(2);
  });

  it("opens quick view from a row while edits dispatch only once", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: en.trade.accountEditTitle }));
    expect(state.edit).toHaveBeenCalledExactlyOnceWith(account);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: new RegExp(account.partyId) }));
    expect(screen.getByRole("dialog")).toHaveTextContent(account.partyId);
  });

  it("preserves read-only action boundaries", () => {
    state.canManage = false;
    renderPage();
    expect(screen.queryByRole("button", { name: en.trade.accountCreate })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.trade.accountEditTitle })).not.toBeInTheDocument();
  });
});
