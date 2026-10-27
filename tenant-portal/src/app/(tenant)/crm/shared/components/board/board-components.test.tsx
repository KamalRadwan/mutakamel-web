// @vitest-environment jsdom

import type { DragEventHandler, JSX, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrmActivityState } from "../../crm-activity-tone";
import {
  crmBoardCardClass,
  crmBoardColumnClass,
  crmBoardIconButtonClass,
  crmBoardScrollClass,
} from "./board-classes";
import { CrmActivityPill } from "./CrmActivityPill";
import { CrmBoardActivityBar } from "./CrmBoardActivityBar";
import { CrmBoardCollapsedRail } from "./CrmBoardCollapsedRail";
import { CrmBoardColumnHeader } from "./CrmBoardColumnHeader";
import { CrmBoardEmptyStage } from "./CrmBoardEmptyStage";
import { CrmCardExpandButton } from "./CrmCardIconButton";
import { CrmCardStartBar } from "./CrmCardStartBar";
import { CrmOwnerAvatar } from "./CrmOwnerAvatar";
import { CrmRatingStars } from "./CrmRatingStars";

afterEach(cleanup);

const ACTIVITY_LABELS: Record<CrmActivityState, string> = {
  FUTURE: "Future",
  TODAY: "Today",
  OVERDUE: "Overdue",
  NONE: "No activities",
};

describe("shared CRM board components", () => {
  it("matches the shared board contract signatures and class tokens", () => {
    const contract = {
      CrmActivityPill,
      CrmRatingStars,
      CrmOwnerAvatar,
      CrmCardStartBar,
      CrmBoardActivityBar,
      CrmBoardColumnHeader,
      CrmBoardCollapsedRail,
      CrmBoardEmptyStage,
      CrmCardExpandButton,
    } satisfies {
      CrmActivityPill: (p: { state: CrmActivityState; label: string; title?: string; neutral?: boolean; className?: string }) => JSX.Element;
      CrmRatingStars: (p: { value: number; onChange?: (next: number) => void; ariaLabel: string; starLabel: (n: number) => string; disabled?: boolean }) => JSX.Element;
      CrmOwnerAvatar: (p: { initials: string; name?: string; imageUrl?: string | null }) => JSX.Element;
      CrmCardStartBar: (p: { state: CrmActivityState; neutral?: boolean; colorClass?: string }) => JSX.Element;
      CrmBoardActivityBar: (p: { states: readonly CrmActivityState[]; labels: Record<CrmActivityState, string>; activeState?: CrmActivityState | null; onToggleState?: (s: CrmActivityState) => void; ariaLabel: string }) => JSX.Element;
      CrmBoardColumnHeader: (p: { title: string; count: number; countTone?: "default" | "danger"; activity: ReactNode; extra?: ReactNode; filterPill?: ReactNode; onQuickAdd?: () => void; quickAddLabel: string; onCollapse?: () => void; collapseLabel: string }) => JSX.Element;
      CrmBoardCollapsedRail: (p: { title: string; count: number; countTone?: "default" | "danger"; onExpand: () => void; expandLabel: string; onMouseEnter?: () => void; onMouseLeave?: () => void; onDragOver?: DragEventHandler; onDrop?: DragEventHandler; isDropTarget?: boolean }) => JSX.Element;
      CrmBoardEmptyStage: (p: { title: string; hint: string; icon?: "inbox" | "sprout" | "closed"; quickAddLabel?: string; onQuickAdd?: () => void }) => JSX.Element;
      CrmCardExpandButton: (p: { expanded: boolean; onClick: () => void; label: string }) => JSX.Element;
    };

    expect(contract).toBeDefined();
    expect(crmBoardScrollClass).toContain("px-5 pb-5");
    expect(crmBoardColumnClass).toContain("rounded-column");
    expect(crmBoardCardClass).toContain("rounded-card");
    expect(crmBoardIconButtonClass).toContain("size-[26px]");
  });

  it("applies CrmActivityPill tone per state and neutral override", () => {
    const cases = [
      { state: "NONE" as const, key: "none" },
      { state: "FUTURE" as const, key: "future" },
      { state: "TODAY" as const, key: "today" },
      { state: "OVERDUE" as const, key: "overdue" },
    ];

    for (const { state, key } of cases) {
      const { unmount } = render(
        <CrmActivityPill state={state} label={ACTIVITY_LABELS[state]} title="Activity" />,
      );
      const pill = screen.getByText(ACTIVITY_LABELS[state]).parentElement;
      expect(pill).toHaveClass(
        `bg-activity-${key}-surface`,
        `border-activity-${key}-line`,
        `text-activity-${key}-text`,
        "whitespace-nowrap",
      );
      unmount();
    }

    render(<CrmActivityPill state="OVERDUE" neutral label="Blacklisted" />);
    const neutralPill = screen.getByText("Blacklisted").parentElement;
    expect(neutralPill).toHaveClass(
      "bg-activity-none-surface",
      "border-activity-none-line",
      "text-activity-none-text",
    );
  });

  it("renders CrmRatingStars in read-only vs editable modes", () => {
    const { rerender } = render(
      <CrmRatingStars value={2} ariaLabel="2 of 3 stars" starLabel={(n) => `Rate ${n}`} />,
    );
    const readOnlyGroup = screen.getByRole("img", { name: "2 of 3 stars" });
    expect(screen.queryByRole("button")).toBeNull();
    expect(readOnlyGroup.querySelectorAll(".fill-star-filled")).toHaveLength(2);
    expect(readOnlyGroup.querySelectorAll(".text-star-empty")).toHaveLength(1);

    const onChange = vi.fn();
    rerender(
      <CrmRatingStars
        value={2}
        onChange={onChange}
        ariaLabel="Importance"
        starLabel={(n) => `Set ${n} stars`}
      />,
    );
    expect(screen.getByRole("group", { name: "Importance" })).toBeInTheDocument();
    const secondStar = screen.getByRole("button", { name: "Set 2 stars" });
    expect(secondStar).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(secondStar);
    expect(onChange).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "Set 3 stars" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("renders CrmOwnerAvatar and CrmCardStartBar states", () => {
    const { container, rerender } = render(<CrmOwnerAvatar initials="" />);
    expect(container.firstChild).toBeNull();

    rerender(<CrmOwnerAvatar initials="KR" name="Kamal Radwan" />);
    const avatar = screen.getByLabelText("Kamal Radwan");
    expect(avatar).toHaveClass("size-[25px]");
    expect(avatar).toHaveTextContent("KR");

    const { unmount } = render(<CrmCardStartBar state="TODAY" />);
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-today");
    unmount();

    const { unmount: unmountCustom } = render(
      <CrmCardStartBar state="TODAY" colorClass="bg-swatch-teal" />,
    );
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-swatch-teal");
    unmountCustom();

    render(<CrmCardStartBar state="OVERDUE" neutral colorClass="bg-swatch-teal" />);
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-none");
  });

  it("renders proportional activity widths and hides unselected zero states", () => {
    render(<CrmBoardActivityBar states={["FUTURE", "FUTURE", "TODAY", "OVERDUE"]}
      labels={ACTIVITY_LABELS} onToggleState={vi.fn()} ariaLabel="Stage activities" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const [index, state, width] of [[0, "FUTURE", "50%"], [1, "TODAY", "25%"], [2, "OVERDUE", "25%"]] as const) {
      expect(buttons[index]).toHaveAttribute("data-activity-state", state);
      expect(buttons[index]).toHaveStyle({ width });
      expect(buttons[index]).toHaveAttribute("aria-pressed", "false");
    }
  });

  it.each(["FUTURE", "TODAY", "OVERDUE", "NONE"] as const)("retains selected %s at zero and hides it after clearing", (activeState) => {
    const onToggleState = vi.fn();
    const otherState = activeState === "NONE" ? "FUTURE" : "NONE";
    const props = { labels: ACTIVITY_LABELS, onToggleState, ariaLabel: "Stage activities" };
    const { rerender } = render(<CrmBoardActivityBar {...props}
      states={[activeState, otherState]} activeState={activeState} />);
    rerender(<CrmBoardActivityBar {...props} states={[otherState]} activeState={activeState} />);
    const selected = screen.getByRole("button", { pressed: true });
    expect(selected).toHaveAttribute("data-activity-state", activeState);
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveAccessibleName(`${ACTIVITY_LABELS[activeState]}: 0`);
    expect(selected).toHaveStyle({ width: "0%" });
    expect(selected).toHaveClass("min-w-6", "shrink-0", "ring-1", "ring-inset", "ring-foreground");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { pressed: false })).toHaveClass("opacity-30");
    fireEvent.click(selected);
    expect(onToggleState).toHaveBeenCalledWith(activeState);
    rerender(<CrmBoardActivityBar {...props} states={[otherState]} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveAttribute("data-activity-state", otherState);
    expect(screen.getByRole("button")).toHaveStyle({ width: "100%" });
  });

  it.each(["FUTURE", "TODAY", "OVERDUE", "NONE"] as const)("keeps empty %s filter clearable over a neutral background", (activeState) => {
    const onToggleState = vi.fn();
    const props = { labels: ACTIVITY_LABELS, onToggleState, ariaLabel: "Stage activities" };
    const { rerender } = render(<CrmBoardActivityBar {...props} states={[]} activeState={activeState} />);
    expect(screen.getByRole("group", { name: "Stage activities" })).toHaveClass("bg-activity-none");
    const selected = screen.getByRole("button");
    expect(selected).toHaveAttribute("data-activity-state", activeState);
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass("min-w-6", "shrink-0", "ring-1");
    fireEvent.click(selected);
    expect(onToggleState).toHaveBeenCalledWith(activeState);
    rerender(<CrmBoardActivityBar {...props} states={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    const emptyBar = screen.getByRole("img");
    expect(emptyBar).toHaveClass("bg-activity-none");
    expect(emptyBar.querySelectorAll("[data-activity-state]")).toHaveLength(1);
    expect(emptyBar.querySelector("[data-activity-state=NONE]")).toHaveStyle({ width: "100%" });
  });

  it("renders CrmBoardColumnHeader quick-add and collapse buttons with aria-labels", () => {
    const onQuickAdd = vi.fn();
    const onCollapse = vi.fn();
    render(
      <CrmBoardColumnHeader
        title="Qualification"
        count={4}
        countTone="danger"
        activity={<div data-testid="activity-slot" />}
        extra={<span>USD 12,000</span>}
        filterPill={<span>Overdue (1)</span>}
        onQuickAdd={onQuickAdd}
        quickAddLabel="Add opportunity: Qualification"
        onCollapse={onCollapse}
        collapseLabel="Collapse column: Qualification"
      />,
    );

    expect(screen.getByText("Qualification")).toBeInTheDocument();
    expect(screen.getByTestId("column-count-pill")).toHaveClass(
      "bg-count-danger-surface",
      "text-count-danger-fg",
    );
    expect(screen.getByText("USD 12,000")).toBeInTheDocument();
    expect(screen.getByText("Overdue (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add opportunity: Qualification" }));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Collapse column: Qualification" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("renders CrmBoardCollapsedRail expand button and drag/hover handlers", () => {
    const onExpand = vi.fn();
    const onMouseEnter = vi.fn();
    const onDrop = vi.fn();
    const { container } = render(
      <CrmBoardCollapsedRail
        title="Negotiation"
        count={7}
        onExpand={onExpand}
        expandLabel="Expand column: Negotiation"
        onMouseEnter={onMouseEnter}
        onDrop={onDrop}
        isDropTarget
      />,
    );

    const expandBtn = screen.getByRole("button", { name: "Expand column: Negotiation" });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledTimes(1);

    const rail = container.firstElementChild as HTMLElement;
    expect(rail).toHaveClass("ring-2", "ring-primary");
    fireEvent.mouseEnter(rail);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    fireEvent.drop(rail);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it("renders CrmBoardEmptyStage quick-add button and CrmCardExpandButton aria-expanded", () => {
    const onQuickAdd = vi.fn();
    const { unmount } = render(
      <CrmBoardEmptyStage
        title="No customers in this stage"
        hint="Drag a customer here or add a new one."
        icon="sprout"
        quickAddLabel="Quick Add Customer"
        onQuickAdd={onQuickAdd}
      />,
    );

    expect(screen.getByTestId("empty-stage-icon-badge")).toHaveClass(
      "bg-entity-company-surface",
      "text-entity-company-fg",
    );
    fireEvent.click(screen.getByRole("button", { name: "Quick Add Customer" }));
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
    unmount();

    const onToggleExpand = vi.fn();
    const { rerender } = render(
      <CrmCardExpandButton expanded={false} onClick={onToggleExpand} label="Expand card" />,
    );
    const btn = screen.getByRole("button", { name: "Expand card" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn.querySelector("svg")).not.toHaveClass("rotate-180");

    rerender(
      <CrmCardExpandButton expanded={true} onClick={onToggleExpand} label="Expand card" />,
    );
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(btn.querySelector("svg")).toHaveClass("rotate-180");
    fireEvent.click(btn);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
