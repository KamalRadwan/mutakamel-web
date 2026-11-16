// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import QuotationsPage from "./page";

const state = vi.hoisted(() => ({
  status: "", search: "server normalized match", currencyCode: "EGP",
  setStatus: vi.fn(), setSearch: vi.fn(), setCurrencyCode: vi.fn(),
  isResolved: true, canCreate: false,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("../documents/hooks/useTradeDocumentList", () => ({
  useTradeDocumentList: () => ({
    ...state,
    scope: { isResolved: state.isResolved, headers: {}, canWrite: () => state.isResolved && state.canCreate },
    items: [{ id: "server-row", currencyCode: "USD", lifecycleStatus: "DRAFT", businessDate: "2026-10-31" }],
    partyId: "", pageInfo: { page: 1, limit: 25, total: 26 },
    setPage: vi.fn(), setPartyId: vi.fn(), reload: vi.fn(),
    isLoading: false, isRefreshing: false, queryError: null,
  }),
}));
vi.mock("../documents/hooks/useTradeTableLabels", () => ({ useTradeTableLabels: () => ({}) }));
vi.mock("../documents/hooks/useTradeWrite", () => ({ useTradeWrite: () => ({}) }));
vi.mock("../documents/components/TradeGate", () => ({ TradeGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../documents/components/TradeBoundaryStates", () => ({ TradeWriteOutcome: () => null, TradeScopeRequired: () => null }));
vi.mock("../documents/components/TradeStatusBadge", () => ({ TradeStatusBadge: () => null }));
vi.mock("./components/QuotationCardsView", () => ({ QuotationCardsView: () => null }));
vi.mock("./components/QuotationDeleteGuardModal", () => ({ QuotationDeleteGuardModal: () => null }));
vi.mock("./components/QuotationMiniViewModal", () => ({ QuotationMiniViewModal: () => null }));
vi.mock("./components/QuotationReasonModal", () => ({ QuotationReasonModal: () => null }));
vi.mock("./components/QuotationShareButtons", () => ({ QuotationShareButtons: () => null }));
vi.mock("./components/QuotationBoardView", () => ({
  QuotationBoardView: ({ items }: { items: { id: string }[] }) => items.map((row) => <span key={row.id}>{row.id}</span>),
}));
vi.mock("@/design-system", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Badge: Pass, IdentifierText: Pass, Money: () => null,
    DropdownMenu: Pass, DropdownMenuContent: Pass, DropdownMenuItem: Pass, DropdownMenuTrigger: Pass,
    Popover: Pass, PopoverContent: Pass, PopoverTrigger: Pass,
    Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (next: string) => void }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
    SelectContent: Pass, SelectTrigger: Pass, SelectValue: () => null,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
    Tooltip: Pass, TooltipContent: () => null, TooltipTrigger: Pass,
    Field: ({ children, label }: { children: ReactNode; label: string }) => <label>{label}{children}</label>,
    Input: ({ size: _size, ...props }: Omit<ComponentProps<"input">, "size"> & { size?: string }) => <input {...props} />,
    Button: ({ children, onClick, asChild, "aria-label": label }: ComponentProps<"button"> & { asChild?: boolean }) => asChild ? <>{children}</> : <button onClick={onClick} aria-label={label}>{children}</button>,
    PageActions: Pass,
    PageHeader: () => null,
    ViewSwitcher: ({ onChange }: { onChange: (value: string) => void }) => <button onClick={() => onChange("table")}>Table view</button>,
    DataTable: ({ rows, page }: { rows: { id: string }[]; page: { total: number } }) => <div data-testid="table" data-total={page.total}>{rows.map((row) => <span key={row.id}>{row.id}</span>)}</div>,
  };
});

beforeEach(() => { vi.clearAllMocks(); state.status = ""; state.isResolved = true; state.canCreate = false; });
afterEach(cleanup);

describe("quotation list filters", () => {
  it("exposes one permission-gated New quotation link to the standard create route and no Fast Add or Full page launcher", () => {
    state.canCreate = true;
    render(<QuotationsPage />);
    const link = screen.getByRole("link", { name: en.tradeDocuments.quotations.create });
    expect(link).toHaveAttribute("href", "/trade/quotations/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("hides the New quotation link without create permission", () => {
    render(<QuotationsPage />);
    expect(screen.queryByRole("link", { name: en.tradeDocuments.quotations.create })).not.toBeInTheDocument();
  });
  it("omits all seven status statistics from the header", () => {
    render(<QuotationsPage />);
    const copy = en.tradeDocuments.quotations;
    for (const label of [copy.kpiTotal, copy.kpiDraft, copy.kpiSent, copy.kpiAccepted,
      copy.kpiRejected, copy.kpiCancelled, copy.kpiExpired]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: copy.title })).not.toBeInTheDocument();
  });

  it.each(["REJECTED", "CANCELLED", "EXPIRED"])("retains the advanced status filter for %s", (status) => {
    render(<QuotationsPage />);
    fireEvent.change(screen.getByLabelText(en.common.status), { target: { value: status } });
    expect(state.setStatus).toHaveBeenCalledWith(status);
  });

  it("delegates filters to the list and displays server rows with the server total", () => {
    render(<QuotationsPage />);
    expect(screen.getByText("server-row")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: en.tradeDocuments.quotations.searchPlaceholder }), {
      target: { value: "customer on another page" },
    });
    expect(state.setSearch).toHaveBeenCalledWith("customer on another page");
    fireEvent.change(screen.getByLabelText(en.tradeDocuments.quotations.filterCurrency), {
      target: { value: "USD" },
    });
    expect(state.setCurrencyCode).toHaveBeenCalledWith("USD");
    fireEvent.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByTestId("table")).toHaveAttribute("data-total", "26");
    // Server matching may normalize names differently; never filter its rows a second time.
    expect(screen.getByText("server-row")).toBeInTheDocument();
  });
});
