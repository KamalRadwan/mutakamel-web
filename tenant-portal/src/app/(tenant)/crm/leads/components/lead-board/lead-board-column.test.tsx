// @vitest-environment jsdom

import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { LeadBoardActivityBar, type LeadBoardActivityBarProps } from "./LeadBoardActivityBar";
import { LeadBoardCollapsedRail, type LeadBoardCollapsedRailProps } from "./LeadBoardCollapsedRail";
import { LeadBoardColumnHeader, type LeadBoardColumnHeaderProps } from "./LeadBoardColumnHeader";
import { LeadBoardEmptyStage, type LeadBoardEmptyStageProps } from "./LeadBoardEmptyStage";

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

beforeEach(() => {
  setLanguage("en");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("LeadBoardColumnHeader", () => {
  const baseProps: LeadBoardColumnHeaderProps = {
    stageLabel: "New",
    stageFlag: "NEW",
    totalCount: 2,
    activityStates: ["FUTURE", "NONE"],
    onCollapse: vi.fn(),
  };

  it("applies active, zero, and danger count pill tones per count and stage flag", () => {
    const { rerender } = renderWithI18n(<LeadBoardColumnHeader {...baseProps} />);
    const activePill = screen.getByTestId("column-count-pill");
    expect(activePill).toHaveTextContent("2");
    expect(activePill).toHaveClass(
      "bg-count-active-surface",
      "text-count-active-fg",
      "text-badge",
      "tabular-nums",
    );

    rerender(
      <I18nProvider>
        <LeadBoardColumnHeader {...baseProps} stageLabel="Nurturing" stageFlag="NURTURING" totalCount={0} activityStates={[]} />
      </I18nProvider>,
    );
    const zeroPill = screen.getByTestId("column-count-pill");
    expect(zeroPill).toHaveTextContent("0");
    expect(zeroPill).toHaveClass("bg-count-zero-surface", "text-count-zero-fg");

    rerender(
      <I18nProvider>
        <LeadBoardColumnHeader {...baseProps} stageLabel="Disqualified" stageFlag="DISQUALIFIED" totalCount={0} activityStates={[]} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("column-count-pill")).toHaveClass("bg-count-danger-surface", "text-count-danger-fg");

    rerender(
      <I18nProvider>
        <LeadBoardColumnHeader {...baseProps} stageLabel="Disqualified" stageFlag="DISQUALIFIED" totalCount={4} />
      </I18nProvider>,
    );
    expect(screen.getByTestId("column-count-pill")).toHaveClass("bg-count-danger-surface", "text-count-danger-fg");
  });

  it("wires quick-add, collapse, terminal badge, and active activity filter controls", () => {
    const onCollapse = vi.fn();
    const onQuickAdd = vi.fn();
    const onClearActivityFilter = vi.fn();

    const { rerender } = renderWithI18n(
      <LeadBoardColumnHeader
        {...baseProps}
        activeActivityState="TODAY"
        activityStates={["TODAY", "FUTURE"]}
        onCollapse={onCollapse}
        onQuickAdd={onQuickAdd}
        onClearActivityFilter={onClearActivityFilter}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `${en.crmLeads.addLead}: New` }),
    );
    expect(onQuickAdd).toHaveBeenCalledTimes(1);

    const collapseBtn = screen.getByRole("button", {
      name: `${en.views.collapseColumn}: New`,
    });
    expect(collapseBtn.querySelector("svg")).toHaveClass("rtl:-scale-x-100");
    fireEvent.click(collapseBtn);
    expect(onCollapse).toHaveBeenCalledTimes(1);

    expect(screen.getByText(`${en.crmLeads.executive.today} (1)`)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: en.crmLeads.executive.clearFilter }),
    );
    expect(onClearActivityFilter).toHaveBeenCalledTimes(1);

    rerender(
      <I18nProvider>
        <LeadBoardColumnHeader
          {...baseProps}
          stageLabel="Converted"
          stageFlag="CONVERTED"
          onQuickAdd={onQuickAdd}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(en.crmLeads.executive.terminal)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${en.crmLeads.addLead}: Converted` }),
    ).toBeNull();
  });
});

describe("LeadBoardActivityBar", () => {
  it("renders a single 100% NONE segment when the stage has zero leads", () => {
    const props: LeadBoardActivityBarProps = {
      states: [],
      stageLabel: "Nurturing",
      onToggleState: vi.fn(),
    };
    renderWithI18n(<LeadBoardActivityBar {...props} />);

    const bar = screen.getByRole("img");
    const segments = bar.querySelectorAll<HTMLElement>("[data-activity-state]");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveAttribute("data-activity-state", "NONE");
    expect(segments[0]).toHaveClass("bg-activity-none");
    expect(segments[0]?.style.width).toBe("100%");
  });

  it("renders proportional widths, omits zero-count states, and toggles segment filters", () => {
    const onToggleState = vi.fn();
    renderWithI18n(
      <LeadBoardActivityBar
        states={["FUTURE", "FUTURE", "TODAY", "OVERDUE"]}
        stageLabel="Contacted"
        activeState="TODAY"
        onToggleState={onToggleState}
      />,
    );

    const futureBtn = screen.getByRole("button", {
      name: `${en.crmLeads.executive.future}: 2`,
    });
    const todayBtn = screen.getByRole("button", {
      name: `${en.crmLeads.executive.today}: 1`,
    });
    const overdueBtn = screen.getByRole("button", {
      name: `${en.crmLeads.executive.overdue}: 1`,
    });

    expect(futureBtn.style.width).toBe("50%");
    expect(todayBtn.style.width).toBe("25%");
    expect(overdueBtn.style.width).toBe("25%");
    expect(
      screen.queryByRole("button", {
        name: new RegExp(`^${en.crmLeads.executive.noActivities}:`),
      }),
    ).toBeNull();

    expect(todayBtn).toHaveAttribute("aria-pressed", "true");
    expect(futureBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(futureBtn);
    expect(onToggleState).toHaveBeenCalledWith("FUTURE");
  });
});

describe("LeadBoardCollapsedRail", () => {
  it("exposes an accessible expand button, neutral rail surface, and hover-to-peek cue", () => {
    const onExpand = vi.fn();
    const props: LeadBoardCollapsedRailProps = {
      stageLabel: "Qualified",
      stageFlag: "QUALIFIED",
      totalCount: 0,
      onExpand,
    };

    const { container, rerender } = renderWithI18n(<LeadBoardCollapsedRail {...props} />);
    expect(container.firstElementChild).toHaveClass(
      "w-[52px]",
      "bg-surface-column",
      "border-line-column",
    );

    const expandBtn = screen.getByRole("button", {
      name: `${en.views.expandColumn}: Qualified`,
    });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    expect(expandBtn.querySelector("svg")).toHaveClass("rtl:-scale-x-100");
    fireEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId("rail-count-badge")).toHaveClass(
      "bg-count-zero-surface",
      "text-count-zero-fg",
    );

    rerender(
      <I18nProvider>
        <LeadBoardCollapsedRail {...props} isDragging={true} />
      </I18nProvider>,
    );
    expect(screen.getByText(en.crmLeads.executive.hoverToPeek)).toBeInTheDocument();
  });
});

describe("LeadBoardEmptyStage", () => {
  it("shows stage-specific hints, fires quick-add, and supports Arabic translations", () => {
    const onQuickAdd = vi.fn();
    const props: LeadBoardEmptyStageProps = {
      stageFlag: "NURTURING",
      onQuickAdd,
    };

    const { rerender } = renderWithI18n(<LeadBoardEmptyStage {...props} />);
    expect(screen.getByText(en.crmLeads.emptyStage.title)).toBeInTheDocument();
    expect(screen.getByText(en.crmLeads.emptyStage.hint.NURTURING)).toBeInTheDocument();
    expect(screen.getByTestId("empty-stage-icon-badge")).toHaveClass(
      "bg-entity-company-surface",
      "text-entity-company-fg",
    );

    fireEvent.click(
      screen.getByRole("button", { name: en.crmLeads.emptyStage.quickAdd }),
    );
    expect(onQuickAdd).toHaveBeenCalledTimes(1);

    rerender(
      <I18nProvider>
        <LeadBoardEmptyStage stageFlag="DISQUALIFIED" onQuickAdd={onQuickAdd} />
      </I18nProvider>,
    );
    expect(screen.getByText(en.crmLeads.emptyStage.hint.DISQUALIFIED)).toBeInTheDocument();
    expect(screen.getByTestId("empty-stage-icon-badge")).toHaveClass(
      "bg-count-danger-surface",
      "text-count-danger-fg",
    );

    rerender(
      <I18nProvider>
        <LeadBoardEmptyStage stageFlag="NEW" />
      </I18nProvider>,
    );
    expect(screen.getByText(en.crmLeads.emptyStage.hint.default)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.crmLeads.emptyStage.quickAdd }),
    ).toBeNull();

    setLanguage("ar");
    rerender(
      <I18nProvider>
        <LeadBoardEmptyStage stageFlag="NURTURING" onQuickAdd={onQuickAdd} />
      </I18nProvider>,
    );
    expect(screen.getByText(ar.crmLeads.emptyStage.title)).toBeInTheDocument();
    expect(screen.getByText(ar.crmLeads.emptyStage.hint.NURTURING)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ar.crmLeads.emptyStage.quickAdd }),
    ).toBeInTheDocument();
  });
});
