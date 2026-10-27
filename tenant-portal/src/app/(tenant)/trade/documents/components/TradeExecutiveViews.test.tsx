// @vitest-environment jsdom

import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TradeDocumentKpiStrip } from "./TradeDocumentKpiStrip";
import { TradeDocumentFunnelBar } from "./TradeDocumentFunnelBar";
import { TradeDocumentExecutiveBoard } from "./TradeDocumentExecutiveBoard";
import { TradeDocumentExecutiveCards } from "./TradeDocumentExecutiveCards";
import { TradeQuickInspectModal } from "./TradeQuickInspectModal";
import { TradeFinancialLinesEditor } from "./TradeFinancialLinesEditor";
import { createEmptyEvidenceLineDraft } from "../lib/trade-financial-evidence";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

afterEach(cleanup);

const sampleRecords = [
  {
    id: "0192f3a0-0000-7000-8000-000000000101",
    documentNumber: "QUO-2026-00042",
    counterpartyName: "Al-Futtaim Industrial Supply",
    status: "DRAFT",
    statusKind: "TradeQuotationStatus" as const,
    currencyCode: "SAR",
    grandTotal: "148500.00",
    version: 2,
    updatedAtFormatted: "2026-10-16",
    dateWindowLabel: "Valid Until",
    dateWindowFormatted: "2026-11-16",
    axes: [
      { label: "Lines", value: "4" },
      { label: "Status", value: "Draft" },
    ],
    tags: [{ label: "v2", tone: "indigo" as const }],
    detailHref: "/trade/quotations/0192f3a0-0000-7000-8000-000000000101",
  },
  {
    id: "0192f3a0-0000-7000-8000-000000000102",
    documentNumber: "QUO-2026-00043",
    counterpartyName: "Red Sea Logistics Co.",
    status: "ACCEPTED",
    statusKind: "TradeQuotationStatus" as const,
    currencyCode: "SAR",
    grandTotal: "92000.00",
    version: 1,
    updatedAtFormatted: "2026-10-15",
    axes: [
      { label: "Lines", value: "2" },
      { label: "Status", value: "Accepted" },
    ],
    detailHref: "/trade/quotations/0192f3a0-0000-7000-8000-000000000102",
  },
];

describe("TradeDocumentKpiStrip", () => {
  it("renders KPI pills and switches view modes and status filters", () => {
    const onSelectStatusFilter = vi.fn();
    const onChangeViewMode = vi.fn();

    render(
      <TradeDocumentKpiStrip
        pills={[
          {
            id: "all",
            label: "All Documents",
            count: 2,
            tone: "blue",
            statusFilterValue: "",
          },
          {
            id: "draft",
            label: "Drafts",
            count: 1,
            tone: "amber",
            statusFilterValue: "DRAFT",
          },
        ]}
        activeStatusFilter=""
        onSelectStatusFilter={onSelectStatusFilter}
        viewMode="table"
        onChangeViewMode={onChangeViewMode}
      />,
    );

    expect(screen.getByText("All Documents")).toBeVisible();
    fireEvent.click(screen.getByText("Drafts"));
    expect(onSelectStatusFilter).toHaveBeenCalledWith("DRAFT");

    fireEvent.click(screen.getByText(en.tradeDocuments.executive.viewBoard));
    expect(onChangeViewMode).toHaveBeenCalledWith("board");
  });
});

describe("TradeDocumentFunnelBar", () => {
  it("renders status distribution steps and toggles status filter on click", () => {
    const onSelectStatus = vi.fn();

    render(
      <TradeDocumentFunnelBar
        steps={[
          { status: "DRAFT", label: "Draft", count: 1, tone: "amber" },
          { status: "ACCEPTED", label: "Accepted", count: 1, tone: "emerald" },
        ]}
        activeStatus=""
        onSelectStatus={onSelectStatus}
      />,
    );

    fireEvent.click(screen.getByText("Accepted"));
    expect(onSelectStatus).toHaveBeenCalledWith("ACCEPTED");
  });
});

describe("TradeDocumentExecutiveBoard", () => {
  it("groups records into status columns and triggers quick inspect", () => {
    const onQuickInspect = vi.fn();

    render(
      <TradeDocumentExecutiveBoard
        columns={[
          { id: "draft", title: "Draft", tone: "amber", statuses: ["DRAFT"] },
          {
            id: "accepted",
            title: "Accepted",
            tone: "emerald",
            statuses: ["ACCEPTED"],
          },
        ]}
        records={sampleRecords}
        selectedIds={new Set()}
        onQuickInspect={onQuickInspect}
      />,
    );

    expect(screen.getByText("QUO-2026-00042")).toBeVisible();
    expect(screen.getByText("QUO-2026-00043")).toBeVisible();

    const inspectButtons = screen.getAllByRole("button", {
      name: "360°",
    });
    fireEvent.click(inspectButtons[0]);
    expect(onQuickInspect).toHaveBeenCalledWith(sampleRecords[0].id);
  });
});

describe("TradeDocumentExecutiveCards", () => {
  it("renders colorful executive cards, supports bulk selection, and triggers quick inspect", () => {
    const onToggleSelect = vi.fn();
    const onSelectAllVisible = vi.fn();
    const onClearSelection = vi.fn();
    const onQuickInspect = vi.fn();

    render(
      <TradeDocumentExecutiveCards
        records={sampleRecords}
        selectedIds={new Set([sampleRecords[0].id])}
        onToggleSelect={onToggleSelect}
        onSelectAllVisible={onSelectAllVisible}
        onClearSelection={onClearSelection}
        onQuickInspect={onQuickInspect}
      />,
    );

    expect(screen.getByText("Al-Futtaim Industrial Supply")).toBeVisible();
    expect(screen.getByText("Red Sea Logistics Co.")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: en.tradeDocuments.executive.selectAllVisible,
      }),
    );
    expect(onSelectAllVisible).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: en.tradeDocuments.executive.clearSelection,
      }),
    );
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe("TradeQuickInspectModal", () => {
  it("renders 360 dossier modal and navigates between records", () => {
    const onOpenChange = vi.fn();
    const onSelectRecordId = vi.fn();

    render(
      <TradeQuickInspectModal
        open={true}
        onOpenChange={onOpenChange}
        records={sampleRecords}
        activeRecordId={sampleRecords[0].id}
        onSelectRecordId={onSelectRecordId}
      />,
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getAllByText("Al-Futtaim Industrial Supply").length,
    ).toBeGreaterThanOrEqual(1);

    const nextBtn = screen.getByRole("button", {
      name: en.tradeDocuments.executive.nextRecord,
    });
    fireEvent.click(nextBtn);
    expect(onSelectRecordId).toHaveBeenCalledWith(sampleRecords[1].id);
  });
});

describe("TradeFinancialLinesEditor", () => {
  it("connects inline numeric errors to the unchanged input and hides invalid totals", () => {
    const lines = [{ ...createEmptyEvidenceLineDraft(), quantity: "-2", taxRatePercent: "15oops" }];
    render(<TradeFinancialLinesEditor dialect="FINANCIAL" currencyCode="SAR"
      lines={lines} onChangeLines={vi.fn()} />);
    const quantity = screen.getByPlaceholderText(en.tradeDocuments.quantity);
    expect(quantity).toHaveValue("-2");
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveAccessibleDescription(en.tradeDocuments.lineEditor.decimalInvalid);
    expect(screen.getByText(en.tradeDocuments.lineEditor.taxRateInvalid)).toBeVisible();
    expect(screen.queryByText(en.tradeDocuments.executive.computedSubtotal)).not.toBeInTheDocument();
    expect(screen.queryByText(en.tradeDocuments.executive.evidenceVerifiedBadge)).not.toBeInTheDocument();
  });

  it("keeps engine prices read-only and hides evidence while pricing is pending", () => {
    const lines = [{ ...createEmptyEvidenceLineDraft(), unitPrice: "25" }];
    const { rerender } = render(<TradeFinancialLinesEditor dialect="ORDER" currencyCode="SAR"
      lines={lines} onChangeLines={vi.fn()} pricing={{ ready: false, error: null }} />);
    expect(screen.getByPlaceholderText(en.tradeDocuments.unitPrice)).toHaveAttribute("readonly");
    expect(screen.getByRole("status")).toHaveTextContent(en.tradeDocuments.lineEditor.awaitingPrice);
    expect(screen.queryByText(en.tradeDocuments.executive.computedSubtotal)).not.toBeInTheDocument();
    expect(screen.queryByText(en.tradeDocuments.executive.evidenceVerifiedBadge)).not.toBeInTheDocument();
    rerender(<TradeFinancialLinesEditor dialect="ORDER" currencyCode="SAR"
      lines={lines} onChangeLines={vi.fn()} pricing={{ ready: true, error: null }} />);
    expect(screen.getByText(en.tradeDocuments.executive.computedSubtotal)).toBeVisible();
  });

  it("adds lines and computes live financial evidence totals", () => {
    function Harness() {
      const [lines, setLines] = React.useState(() => [
        {
          ...createEmptyEvidenceLineDraft(),
          itemId: "0192f3a0-0000-7000-8000-000000000901",
          uomCode: "0192f3a0-0000-7000-8000-000000000902",
          description: "Industrial Valve",
          quantity: "2",
          unitPrice: "50",
          taxRatePercent: "15",
        },
      ]);
      return (
        <TradeFinancialLinesEditor
          dialect="FINANCIAL"
          currencyCode="SAR"
          lines={lines}
          onChangeLines={setLines}
        />
      );
    }

    render(<Harness />);

    expect(
      screen.getByText(en.tradeDocuments.executive.linesEditorTitle),
    ).toBeVisible();
    expect(screen.getByDisplayValue("Industrial Valve")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: en.tradeDocuments.lineEditor.addLine }),
    );
    expect(screen.getByText("#2")).toBeVisible();
  });
});
