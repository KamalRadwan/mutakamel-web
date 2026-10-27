// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { DataTable } from "@/design-system";
import { TradeDocumentListBoundary } from "./TradeDocumentListBoundary";
import { TradeDocumentExecutiveBoard, type TradeExecutiveRecordItem } from "./TradeDocumentExecutiveBoard";
import { TradeDocumentExecutiveCards } from "./TradeDocumentExecutiveCards";
import { useTradeTableLabels } from "../hooks/useTradeTableLabels";

const locale = vi.hoisted(() => ({ lang: "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: locale.lang === "ar" ? ar : en, lang: locale.lang }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["trade.purchase_orders.read"] } }),
}));
afterEach(cleanup);

const order: TradeExecutiveRecordItem = {
  id: "0192f3a0-0000-7000-8000-000000000101", documentNumber: "order A",
  counterpartyName: "Supplier A", status: "DRAFT", statusKind: "TradePurchaseOrderStatus",
  currencyCode: "SAR", grandTotal: "100", version: 1, updatedAtFormatted: "2026-10-18",
  detailHref: "/trade/purchase-orders/0192f3a0-0000-7000-8000-000000000101",
};
function Rows({ mode }: { mode: string }) {
  const labels = useTradeTableLabels("Empty", "Failed");
  if (mode === "board") return <TradeDocumentExecutiveBoard
    columns={[{ id: "draft", title: "Draft", tone: "blue", statuses: ["DRAFT"] }]}
    records={[order]} onQuickInspect={vi.fn()} />;
  if (mode === "cards") return <TradeDocumentExecutiveCards records={[order]} selectedIds={new Set()}
    onToggleSelect={vi.fn()} onSelectAllVisible={vi.fn()} onClearSelection={vi.fn()} onQuickInspect={vi.fn()} />;
  return <DataTable columns={[{ id: "number", header: "Number", cell: (row) => row.documentNumber }]}
    rows={[order]} rowKey={(row) => row.id} isLoading={false} labels={labels} />;
}

describe.each(["en", "ar"])("purchase-order list boundaries in %s", (lang) => {
  it.each(["table", "cards", "board"])("replaces %s rows with loading, denial, error or empty", (mode) => {
    locale.lang = lang;
    const t = lang === "ar" ? ar : en;
    const retry = vi.fn();
    const props = { isLoading: false, error: null, recordCount: 1,
      permission: "trade.purchase_orders.read", emptyTitle: t.tradeDocuments.purchaseOrders.empty,
      errorTitle: t.tradeDocuments.purchaseOrders.loadFailed, onRetry: retry };
    const rows = <Rows mode={mode} />;
    const { rerender } = render(<TradeDocumentListBoundary {...props}>{rows}</TradeDocumentListBoundary>);
    expect(screen.getByText("order A")).toBeVisible();
    rerender(<TradeDocumentListBoundary {...props} isLoading>{rows}</TradeDocumentListBoundary>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("order A")).not.toBeInTheDocument();
    rerender(<TradeDocumentListBoundary {...props} error={{ status: 403 }}>{rows}</TradeDocumentListBoundary>);
    expect(screen.getByText(t.permissionGate.title)).toBeVisible();
    expect(screen.queryByText(props.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText("order A")).not.toBeInTheDocument();
    rerender(<TradeDocumentListBoundary {...props} error={{ status: 0 }}>{rows}</TradeDocumentListBoundary>);
    expect(screen.getByText(props.errorTitle)).toBeVisible();
    expect(screen.queryByText(props.emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByText("order A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.common.retry }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<TradeDocumentListBoundary {...props} recordCount={0}>{rows}</TradeDocumentListBoundary>);
    expect(screen.getByText(props.emptyTitle)).toBeVisible();
    expect(screen.queryByText(props.errorTitle)).not.toBeInTheDocument();
    expect(screen.queryByText("order A")).not.toBeInTheDocument();
  });
});
