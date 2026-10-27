// @vitest-environment jsdom

import type { ChangeEventHandler, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CreateSalesOrderDrawer } from "../../sales-orders/components/CreateSalesOrderDrawer";
import { CreatePurchaseOrderDrawer } from "../../purchase-orders/components/CreatePurchaseOrderDrawer";
import type { TradeFinancialLinesEditorProps } from "./TradeFinancialLinesEditor";

const { post, runWrite } = vi.hoisted(() => ({ post: vi.fn(), runWrite: vi.fn() }));
vi.mock("../../trade-api", () => ({ tradePost: post }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../hooks/useTradeWrite", () => ({
  useTradeWrite: () => ({ isBlocked: false, isWriting: false, runWrite }),
}));
vi.mock("./TradeBoundaryStates", () => ({
  TradeWriteOutcome: () => null,
  TradeWriteFields: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/design-system", () => ({
  Field: ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>,
  Input: ({ value, onChange, placeholder }: {
    value: string; onChange: ChangeEventHandler<HTMLInputElement>; placeholder?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
  FormDrawer: ({ children, submitDisabled, onSubmit }: {
    children: ReactNode; submitDisabled: boolean; onSubmit: () => void;
  }) => <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    {children}<button type="submit" disabled={submitDisabled}>Save</button>
  </form>,
}));
vi.mock("./TradeFinancialLinesEditor", () => ({
  TradeFinancialLinesEditor: ({ lines, onChangeLines }: TradeFinancialLinesEditorProps) => <>
    <button type="button" onClick={() => onChangeLines([DRAFT])}>Choose line</button>
    <output data-testid="price">{lines[0]?.unitPrice}</output>
  </>,
}));

const ID = "0192f3a0-0000-7000-8000-000000000001";
const UOM = "0192f3a0-0000-7000-8000-000000000002";
const HEADERS = { "x-mutakamel-company-id": ID, "x-mutakamel-branch-id": UOM };
const DRAFT = {
  id: ID, itemId: ID, uomCode: UOM, description: "Valve", quantity: "2",
  unitPrice: "999", discountAmount: "0", chargeAmount: "0", taxCode: "VAT-15", taxRatePercent: "15",
};
beforeEach(() => {
  vi.useFakeTimers(); post.mockReset(); runWrite.mockReset();
  post.mockImplementation(async (path: string, body: { currencyCode: string }) => ({
    data: path.endsWith("/pricing/evaluate") ? {
      unitPrice: body.currencyCode === "SAR" ? "25.00000000" : "40",
      currencyCode: body.currencyCode, priceBookId: ID, minimumAllowedPrice: null,
    } : { id: ID },
    status: 200, headers: new Headers(),
  }));
  runWrite.mockImplementation(async ({ send }: { send: (headers: Record<string, string>) => Promise<unknown> }) => {
    await send({ "x-idempotency-key": ID });
    return true;
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("order creation pricing", () => {
  it.each(["SALES", "PURCHASE"] as const)("submits %s evidence from the displayed server price", async (purpose) => {
    const Component = purpose === "SALES" ? CreateSalesOrderDrawer : CreatePurchaseOrderDrawer;
    render(<Component open onOpenChange={vi.fn()} headers={HEADERS} onCreated={vi.fn()} />);
    const partyLabel = purpose === "SALES" ? en.tradeDocuments.customer : en.tradeDocuments.supplier;
    fireEvent.change(screen.getByLabelText(partyLabel), { target: { value: ID } });
    if (purpose === "PURCHASE") {
      fireEvent.change(screen.getByLabelText(en.tradeDocuments.purchaseOrders.supplierAccount), { target: { value: ID } });
      fireEvent.change(screen.getByLabelText(en.tradeDocuments.purchaseOrders.receivingNode), { target: { value: ID } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Choose line" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByTestId("price")).toBeEmptyDOMElement();
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByTestId("price")).toHaveTextContent("25.00000000");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(post.mock.calls[0]?.[1]).toMatchObject({ purpose, partyId: ID, itemId: ID, uomId: UOM, quantity: "2" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
    const path = purpose === "SALES" ? "/api/tenant/trade/v1/sales-orders" : "/api/tenant/trade/v1/purchase-orders";
    const payload = post.mock.calls.find(([url]) => url === path)?.[1];
    expect(payload.totals).toMatchObject({ subtotal: "50", taxTotal: "7.5", grandTotal: "57.5", amountDue: "57.5" });
    expect(payload.lines[0].financial.lineTotal).toBe("57.5");
    expect(payload.lines[0]).not.toHaveProperty("unitPrice");

    fireEvent.change(screen.getByLabelText(en.tradeDocuments.currency), { target: { value: "USD" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByTestId("price")).toBeEmptyDOMElement();
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByTestId("price")).toHaveTextContent("40");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
    expect(post.mock.calls.filter(([url]) => url === path).at(-1)?.[1].totals.grandTotal).toBe("92");
  });
});
