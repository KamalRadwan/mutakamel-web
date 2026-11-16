// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistorySection } from "./HistorySection";
import type { HistoryTreeNode } from "./history-tree-types";

afterEach(cleanup);

const SAMPLE_ITEMS: HistoryTreeNode[] = [
  {
    id: "evt-1",
    actorName: "Sara Al-Mansour",
    actorInitials: "SA",
    timestamp: "2026-10-29 13:00",
    tone: "positive",
    actionTitle: "Add Quotation",
    actionIcon: FileSpreadsheet,
    referenceLabel: "#QT-2026-0042",
    referenceHref: "/trade/quotations/01990000-0000-7000-8000-000000000042",
    changeCountLabel: "2 changes",
    diffs: [
      { key: "status", label: "Status", before: "Draft", after: "Sent" },
      { key: "grandTotal", label: "Grand total", after: "1,250.00 SAR", showTransition: false },
    ],
    detailsFooter: "Reason: Requested by client",
  },
  {
    id: "evt-2",
    actorName: "Kamal",
    actorInitials: "KA",
    timestamp: "2026-10-28 09:30",
    tone: "neutral",
    actionTitle: "Create Lead",
    actionIcon: Sparkles,
    diffs: [],
  },
];

describe("HistorySection", () => {
  it("renders the 3-level hierarchy with Level 3 collapsed by default and expands on click", () => {
    render(
      <HistorySection
        title="History"
        items={SAMPLE_ITEMS}
        detailsLabel="Details of changes"
        emptyDetailsLabel="No field-level changes recorded."
        expandAllLabel="Expand all"
        collapseAllLabel="Collapse all"
      />,
    );

    // Card header + Expand all button
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();

    // Level 1 & Level 2 visible immediately
    expect(screen.getByText("Sara Al-Mansour")).toBeInTheDocument();
    expect(screen.getByText("Add Quotation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#QT-2026-0042" })).toHaveAttribute(
      "href",
      "/trade/quotations/01990000-0000-7000-8000-000000000042",
    );

    // Level 3 collapsed initially
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();

    // Expand first item
    const triggers = screen.getAllByRole("button", { name: /Details of changes/i });
    fireEvent.click(triggers[0]!);
    expect(screen.getByText("Draft")).toHaveClass("line-through");
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("1,250.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("Reason: Requested by client")).toBeInTheDocument();
  });

  it("supports Expand all / Collapse all and resets open items when filter changes", () => {
    const onFilterChange = vi.fn();
    render(
      <HistorySection
        title="History"
        items={SAMPLE_ITEMS}
        detailsLabel="Details of changes"
        emptyDetailsLabel="No field-level changes recorded."
        expandAllLabel="Expand all"
        collapseAllLabel="Collapse all"
        filters={[
          { value: "all", label: "All" },
          { value: "commercial", label: "Commercial" },
        ]}
        filterLabel="Filter history"
        selectedFilter="all"
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("No field-level changes recorded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeInTheDocument();

    // Changing filter resets open items and notifies caller
    fireEvent.click(screen.getByRole("radio", { name: "Commercial" }));
    expect(onFilterChange).toHaveBeenCalledWith("commercial");
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("renders loading skeletons, empty state, and error retry state", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <HistorySection
        title="History"
        items={[]}
        isLoading
        detailsLabel="Details of changes"
        expandAllLabel="Expand all"
        collapseAllLabel="Collapse all"
      />,
    );
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();

    rerender(
      <HistorySection
        title="History"
        items={[]}
        emptyTitle="No history yet"
        emptyDescription="Updates will appear here."
        detailsLabel="Details of changes"
        expandAllLabel="Expand all"
        collapseAllLabel="Collapse all"
      />,
    );
    expect(screen.getByText("No history yet")).toBeInTheDocument();

    rerender(
      <HistorySection
        title="History"
        items={[]}
        errorTitle="Failed to load history"
        onRetry={onRetry}
        retryLabel="Retry"
        detailsLabel="Details of changes"
        expandAllLabel="Expand all"
        collapseAllLabel="Collapse all"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
