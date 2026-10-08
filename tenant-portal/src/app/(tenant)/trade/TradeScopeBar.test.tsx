// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TradeScopeBar } from "./TradeScopeBar";
import { TradeScopeProvider, useTradeScope } from "./useTradeScope";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const { i18n } = vi.hoisted(() => ({ i18n: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: i18n }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    accessibleCompanies: ["0192f3a0-0000-7000-8000-000000000001"],
    accessibleBranches: ["0192f3a0-0000-7000-8000-000000000002"],
    teamMemberships: [],
  } }),
}));
vi.mock("./trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./trade-api")>(),
  tradeGet: vi.fn().mockResolvedValue({ data: [] }),
}));

function ScopeSnapshot() {
  const { context } = useTradeScope();
  return <output data-testid="scope">{JSON.stringify(context)}</output>;
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("TradeScopeBar item master", () => {
  it.each([
    { lang: "en", dir: "ltr", t: en },
    { lang: "ar", dir: "rtl", t: ar },
  ])("selects the master and disables dependent selectors in $lang", async ({ lang, dir, t }) => {
    i18n.mockReturnValue({ lang, dir, t });
    localStorage.setItem("tenant_trade_branch", BRANCH);
    render(<div dir={dir}><TradeScopeProvider><TradeScopeBar allowItemMaster /><ScopeSnapshot /></TradeScopeProvider></div>);
    const company = screen.getByRole("combobox", { name: t.trade.scopeCompany });
    await waitFor(() => expect(company).toHaveTextContent(COMPANY));
    expect(company).toHaveAttribute("dir", "ltr");
    expect(company).toHaveClass("font-mono");
    fireEvent.keyDown(company, { key: "ArrowDown" });
    const master = await screen.findByRole("option", { name: t.trade.scopeItemMaster });
    fireEvent.click(master);
    await waitFor(() => expect(company).toHaveTextContent(t.trade.scopeItemMaster));
    expect(company).not.toHaveAttribute("dir");
    expect(company.closest("[dir]")).toHaveAttribute("dir", dir);
    expect(company).not.toHaveClass("font-mono");
    expect(screen.getByTestId("scope")).toHaveTextContent(JSON.stringify({ companyId: null, branchId: null, channelId: null }));
    expect(screen.getByRole("combobox", { name: t.trade.scopeBranch })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: t.trade.scopeChannel })).toBeDisabled();

    fireEvent.keyDown(company, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: COMPANY }));
    await waitFor(() => expect(company).toHaveTextContent(COMPANY));
    expect(company).toHaveAttribute("dir", "ltr");
    expect(company).toHaveClass("font-mono");
    expect(screen.getByRole("combobox", { name: t.trade.scopeBranch })).toBeEnabled();
  });

  it.each([
    { lang: "en", dir: "ltr", t: en },
    { lang: "ar", dir: "rtl", t: ar },
  ])("inherits page direction and typography for the $lang placeholder", async ({ lang, dir, t }) => {
    i18n.mockReturnValue({ lang, dir, t });
    localStorage.setItem("tenant_trade_company", "__tenant__");
    render(<div dir={dir}><TradeScopeProvider><TradeScopeBar /></TradeScopeProvider></div>);
    const company = screen.getByRole("combobox", { name: t.trade.scopeCompany });
    await waitFor(() => expect(company).toHaveTextContent(t.trade.scopeSelectCompany));
    expect(company).not.toHaveAttribute("dir");
    expect(company.closest("[dir]")).toHaveAttribute("dir", dir);
    expect(company).not.toHaveClass("font-mono");
  });

  it("does not offer tenant scope on company-required screens", async () => {
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    render(<TradeScopeProvider><TradeScopeBar /></TradeScopeProvider>);
    const company = screen.getByRole("combobox", { name: en.trade.scopeCompany });
    await waitFor(() => expect(company).toHaveTextContent(COMPANY));
    fireEvent.keyDown(company, { key: "ArrowDown" });
    await screen.findByRole("option", { name: COMPANY });
    expect(screen.queryByRole("option", { name: en.trade.scopeItemMaster })).toBeNull();
  });
});
