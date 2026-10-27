// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTenantAuth } from "@/context/AuthContext";
import { Button } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import TradeLayout from "./layout";
import { TradeScopeRequired } from "./documents/components/TradeBoundaryStates";
import { useTradeDocumentScope } from "./documents/hooks/useTradeDocumentScope";
import { useTradeBranchSelection, useTradeScope } from "./trade-advanced-scope";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const OTHER_COMPANY = "0192f3a0-0000-7000-8000-000000000002";
const BRANCH = "0192f3a0-0000-7000-8000-000000000003";
const OTHER_BRANCH = "0192f3a0-0000-7000-8000-000000000004";
const { i18n } = vi.hoisted(() => ({ i18n: vi.fn() }));

vi.mock("@/i18n/I18nContext", () => ({ useI18n: i18n }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: {
    accessibleCompanies: [
      "0192f3a0-0000-7000-8000-000000000001",
      "0192f3a0-0000-7000-8000-000000000002",
    ],
    accessibleBranches: [
      "0192f3a0-0000-7000-8000-000000000003",
      "0192f3a0-0000-7000-8000-000000000004",
    ],
    permissions: [],
    teamMemberships: [],
  } }),
}));
vi.mock("./trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./trade-api")>(),
  tradeGet: vi.fn().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 100 } }),
}));

function ScopeConsumers() {
  const { user } = useTenantAuth();
  const document = useTradeDocumentScope();
  const { branchId, selectBranch } = useTradeBranchSelection(user);
  const advanced = useTradeScope("BRANCH", branchId);
  const company = useTradeScope("COMPANY", branchId);
  return (
    <>
      {!document.isResolved && <TradeScopeRequired />}
      <output data-testid="document">{JSON.stringify(document.headers)}</output>
      <output data-testid="advanced">{JSON.stringify(advanced.headers)}</output>
      <output data-testid="company">{JSON.stringify(company.headers)}</output>
      <Button onClick={() => selectBranch(OTHER_BRANCH)}>Change advanced branch</Button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("Trade layout shared scope", () => {
  it.each([
    { lang: "en", dir: "ltr", t: en },
    { lang: "ar", dir: "rtl", t: ar },
  ])("resolves a document deep link in place and shares changes in $lang", async ({ lang, dir, t }) => {
    i18n.mockReturnValue({ lang, dir, t });
    render(<div dir={dir}><TradeLayout><ScopeConsumers /></TradeLayout></div>);
    expect(screen.getByText(t.tradeDocuments.scopeRequiredTitle)).toBeVisible();
    const company = screen.getByRole("combobox", { name: t.trade.scopeCompany });
    expect(company).toBeVisible();
    fireEvent.keyDown(company, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: COMPANY }));
    const branch = screen.getByRole("combobox", { name: t.trade.scopeBranch });
    fireEvent.keyDown(branch, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: BRANCH }));
    const headers = {
      "x-mutakamel-company-id": COMPANY,
      "x-mutakamel-branch-id": BRANCH,
    };
    await waitFor(() => expect(screen.queryByText(t.tradeDocuments.scopeRequiredTitle)).toBeNull());
    expect(screen.getByTestId("document")).toHaveTextContent(JSON.stringify(headers));
    expect(screen.getByTestId("advanced")).toHaveTextContent(JSON.stringify(headers));
    expect(screen.getByTestId("company")).toHaveTextContent(JSON.stringify({
      "x-mutakamel-company-id": COMPANY,
    }));

    fireEvent.click(screen.getByRole("button", { name: "Change advanced branch" }));
    expect(branch).toHaveTextContent(OTHER_BRANCH);
    expect(screen.getByTestId("document")).toHaveTextContent(OTHER_BRANCH);
    expect(screen.getByTestId("advanced")).toHaveTextContent(OTHER_BRANCH);

    fireEvent.keyDown(company, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: OTHER_COMPANY }));
    await waitFor(() => expect(screen.getByText(t.tradeDocuments.scopeRequiredTitle)).toBeVisible());
    expect(screen.getByTestId("document")).toHaveTextContent("{}");
    expect(screen.getByTestId("advanced")).not.toHaveTextContent(OTHER_BRANCH);
    expect(localStorage.getItem("tenant_trade_company")).toBe(OTHER_COMPANY);
    expect(localStorage.getItem("tenant_trade_branch")).toBeNull();
  });
});
