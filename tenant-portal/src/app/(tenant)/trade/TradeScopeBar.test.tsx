// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TradeScopeBar } from "./TradeScopeBar";
import { TradeScopeProvider, useTradeScope } from "./useTradeScope";
import { tradeGet } from "./trade-api";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const BRANCH = "0192f3a0-0000-7000-8000-000000000002";
const { i18n, labels } = vi.hoisted(() => ({ i18n: vi.fn(), labels: { available: true } }));
vi.mock("@/hooks/useTenantBranchLabels", () => ({
  useTenantCompanyLabels: () => new Map(labels.available ? [[COMPANY, "Mersany Trading"]] : []),
  useTenantBranchLabels: () => new Map(labels.available ? [[BRANCH, "Cairo branch"]] : []),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: i18n }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    accessibleCompanies: ["0192f3a0-0000-7000-8000-000000000001"],
    accessibleBranches: ["0192f3a0-0000-7000-8000-000000000002"],
    teamMemberships: [{ companyId: "0192f3a0-0000-7000-8000-000000000001", branchId: "0192f3a0-0000-7000-8000-000000000002" }],
  } }),
}));
vi.mock("./trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./trade-api")>(),
  tradeGet: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 100 } }),
}));

function ScopeSnapshot() {
  const { context } = useTradeScope();
  return <output data-testid="scope">{JSON.stringify(context)}</output>;
}

function LockScope() {
  const { registerContextGuard } = useTradeScope();
  useEffect(() => registerContextGuard(() => false, true), [registerContextGuard]);
  return null;
}

beforeEach(() => {
  labels.available = true;
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(tradeGet).mockReset().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 100 }, status: 200, headers: new Headers() });
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
    await waitFor(() => expect(company).toHaveTextContent("Mersany Trading"));
    expect(company).not.toHaveTextContent(COMPANY);
    expect(company).toHaveAttribute("dir", dir);
    expect(company).toHaveClass("font-sans", "font-normal", "text-caption");
    fireEvent.keyDown(company, { key: "ArrowDown" });
    const master = await screen.findByRole("option", { name: t.trade.scopeItemMaster });
    fireEvent.click(master);
    await waitFor(() => expect(company).toHaveTextContent(t.trade.scopeItemMaster));
    expect(company).toHaveAttribute("dir", dir);
    expect(company.closest("[dir]")).toHaveAttribute("dir", dir);
    expect(company).not.toHaveClass("font-mono");
    expect(screen.getByTestId("scope")).toHaveTextContent(JSON.stringify({ companyId: null, branchId: null, channelId: null }));
    expect(screen.getByRole("combobox", { name: t.trade.scopeBranch })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: t.trade.scopeChannel })).toBeDisabled();

    fireEvent.keyDown(company, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Mersany Trading" }));
    await waitFor(() => expect(company).toHaveTextContent("Mersany Trading"));
    expect(company).toHaveAttribute("dir", dir);
    expect(company).not.toHaveClass("font-mono");
    const branch = screen.getByRole("combobox", { name: t.trade.scopeBranch });
    expect(branch).toBeEnabled();
    expect(branch).toHaveClass("font-sans", "font-normal", "text-caption");
    fireEvent.keyDown(branch, { key: "ArrowDown" });
    const branchOption = await screen.findByRole("option", { name: "Cairo branch" });
    expect(branchOption).not.toHaveTextContent(BRANCH);
    fireEvent.click(branchOption);
    await waitFor(() => expect(branch).toHaveTextContent("Cairo branch"));
    expect(screen.getByTestId("scope")).toHaveTextContent(JSON.stringify({ companyId: COMPANY, branchId: BRANCH, channelId: null }));
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
    expect(company).toHaveAttribute("dir", dir);
    expect(company.closest("[dir]")).toHaveAttribute("dir", dir);
    expect(company).not.toHaveClass("font-mono");
  });

  it("does not offer tenant scope on company-required screens", async () => {
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    render(<TradeScopeProvider><TradeScopeBar /></TradeScopeProvider>);
    const company = screen.getByRole("combobox", { name: en.trade.scopeCompany });
    await waitFor(() => expect(company).toHaveTextContent("Mersany Trading"));
    fireEvent.keyDown(company, { key: "ArrowDown" });
    await screen.findByRole("option", { name: "Mersany Trading" });
    expect(screen.queryByRole("option", { name: en.trade.scopeItemMaster })).toBeNull();
  });

  it("keeps optional channel selection visible when single-option organization selectors are hidden", () => {
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    render(<TradeScopeProvider><TradeScopeBar allowItemMaster hideWhenSingleScope /></TradeScopeProvider>);
    expect(screen.queryByRole("combobox", { name: en.trade.scopeCompany })).toBeNull();
    expect(screen.queryByRole("combobox", { name: en.trade.scopeBranch })).toBeNull();
    expect(screen.getByRole("combobox", { name: en.trade.scopeChannel })).toBeInTheDocument();
  });

  it("uses readable fallback labels when organization names are unavailable", async () => {
    labels.available = false;
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    localStorage.setItem("tenant_trade_branch", BRANCH);
    render(<TradeScopeProvider><TradeScopeBar allowItemMaster /></TradeScopeProvider>);
    const company = screen.getByRole("combobox", { name: en.trade.scopeCompany });
    const branch = screen.getByRole("combobox", { name: en.trade.scopeBranch });
    await waitFor(() => expect(company).toHaveTextContent("Company 1"));
    await waitFor(() => expect(branch).toHaveTextContent("Branch 1"));
    expect(company).not.toHaveTextContent(COMPANY);
    expect(branch).not.toHaveTextContent(BRANCH);
  });

  it("disables every context picker when a composer locks its saved context", async () => {
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    render(<TradeScopeProvider><TradeScopeBar /><LockScope /></TradeScopeProvider>);
    await waitFor(() => expect(screen.getByRole("combobox", { name: en.trade.scopeCompany })).toBeDisabled());
    expect(screen.getByRole("combobox", { name: en.trade.scopeBranch })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: en.trade.scopeChannel })).toBeDisabled();
  });

  it("keeps No channel usable during a channel dependency failure and retries the read", async () => {
    i18n.mockReturnValue({ lang: "en", dir: "ltr", t: en });
    vi.mocked(tradeGet).mockRejectedValueOnce(new Error("channel unavailable"));
    render(<TradeScopeProvider><TradeScopeBar hideWhenSingleScope /></TradeScopeProvider>);
    await screen.findByText(en.quotationFlow.channelsUnavailable);
    expect(screen.getByRole("combobox", { name: en.trade.scopeChannel })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await waitFor(() => expect(screen.queryByText(en.quotationFlow.channelsUnavailable)).toBeNull());
  });
});
