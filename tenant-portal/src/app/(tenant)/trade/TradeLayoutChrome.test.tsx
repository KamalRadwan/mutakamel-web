// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTradeInlineScopeClaim } from "./TradeInlineScope";
import { TradeLayoutChrome } from "./TradeLayoutChrome";

function PinnedEditor({ active }: { active: boolean }) {
  useTradeInlineScopeClaim(active);
  return <main>Pinned editor</main>;
}

const fixture = vi.hoisted(() => ({
  pathname: "/trade/pricing", selectCompany: vi.fn(), selectBranch: vi.fn(),
  companyIds: ["company"], locked: false, branchId: null as string | null,
}));
vi.mock("next/navigation", () => ({ usePathname: () => fixture.pathname }));
vi.mock("./useTradeScope", () => ({ useTradeScope: () => ({
  context: { companyId: "company", branchId: fixture.branchId },
  companyIds: fixture.companyIds, branchIds: ["branch"],
  contextLocked: fixture.locked,
  selectCompany: fixture.selectCompany, selectBranch: fixture.selectBranch,
}) }));
vi.mock("./TradeScopeBar", () => ({ TradeScopeBar: () => <div>Generic scope bar</div> }));
vi.mock("./price-books/components/PriceBookScopeBar", () => ({ PriceBookScopeBar: ({ companyOnly }: { companyOnly?: boolean }) => <div>{companyOnly ? "Named company scope" : "Named price-book scope bar"}</div> }));
beforeEach(() => { vi.clearAllMocks(); fixture.pathname = "/trade/pricing"; fixture.companyIds = ["company"]; fixture.locked = false; fixture.branchId = null; });
afterEach(cleanup);

describe("Trade workspace scope ownership", () => {
  it.each(["/trade/items", "/trade/items/item", "/trade/channels", "/trade/channels/channel",
    "/trade/uoms", "/trade/uoms/unit", "/trade/commercial-accounts", "/trade/commercial-accounts/account"])("leaves scope controls inside %s without duplicating them above", async (pathname) => {
    fixture.pathname = pathname;
    fixture.companyIds = ["company", "other"];
    render(<TradeLayoutChrome><main>Items scope controls</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Items scope controls")).toBeInTheDocument();
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    expect(fixture.selectCompany).not.toHaveBeenCalled();
    expect(fixture.selectBranch).not.toHaveBeenCalled();
  });

  it("lets the pricing workspace own its scope and preserve All branches", async () => {
    render(<TradeLayoutChrome><main>Pricing workbench</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Pricing workbench")).toBeInTheDocument();
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    expect(fixture.selectBranch).not.toHaveBeenCalled();
  });

  it("keeps the price-book scope bar without forcing its All branches selection", async () => {
    fixture.pathname = "/trade/price-books";
    render(<TradeLayoutChrome><main>Price books</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Named price-book scope bar")).toBeInTheDocument();
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    expect(fixture.selectBranch).not.toHaveBeenCalled();
  });

  it("preserves the existing branch default for document workspaces", async () => {
    fixture.pathname = "/trade/quotations";
    render(<TradeLayoutChrome><main>Quotations</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(fixture.selectBranch).toHaveBeenCalledWith("branch");
    expect(screen.getByText("Generic scope bar")).toBeInTheDocument();
  });

  it("leaves quotation create scope inside its composer and respects locked context defaults", async () => {
    fixture.pathname = "/trade/quotations/new";
    fixture.locked = true;
    render(<TradeLayoutChrome><main>Quotation composer</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    expect(fixture.selectBranch).not.toHaveBeenCalled();
  });

  it("keeps the global band on a saved quotation until the pinned editor claims its exact scope", async () => {
    fixture.pathname = "/trade/quotations/quote-1";
    fixture.companyIds = ["company", "other"];
    fixture.branchId = "branch";
    const { rerender } = render(<TradeLayoutChrome><main>Missing or forbidden document</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Generic scope bar")).toBeInTheDocument();
    rerender(<TradeLayoutChrome><PinnedEditor active /></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Pinned editor")).toBeInTheDocument();
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    rerender(<TradeLayoutChrome><PinnedEditor active={false} /></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Generic scope bar")).toBeInTheDocument();
  });

  it("restores the global band when the claiming editor unmounts", async () => {
    fixture.pathname = "/trade/quotations/quote-1";
    const { rerender } = render(<TradeLayoutChrome><PinnedEditor active /></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    rerender(<TradeLayoutChrome><main>Read-only dossier</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.getByText("Generic scope bar")).toBeInTheDocument();
  });

  it.each(["/trade/price-books/book", "/trade/price-book-versions/version"])("does not imply branch filtering for company-scoped %s", async (pathname) => {
    fixture.pathname = pathname;
    render(<TradeLayoutChrome><main>Book workspace</main></TradeLayoutChrome>);
    await act(async () => {});
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
    expect(fixture.selectBranch).not.toHaveBeenCalled();
  });

  it("keeps a named company selector available to multi-company detail readers", () => {
    fixture.pathname = "/trade/price-books/book";
    fixture.companyIds = ["company", "other"];
    render(<TradeLayoutChrome><main>Book workspace</main></TradeLayoutChrome>);
    expect(screen.getByText("Named company scope")).toBeInTheDocument();
    expect(screen.queryByText("Generic scope bar")).not.toBeInTheDocument();
  });
});
