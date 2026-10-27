// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CrmActivityState } from "../../../shared/crm-activity-tone";
import { LeadBoardActivityBar } from "./LeadBoardActivityBar";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

afterEach(cleanup);

describe("LeadBoardActivityBar active filter retention", () => {
  it.each(["FUTURE", "TODAY", "OVERDUE", "NONE"] as const)("retains %s when its count drops to zero and allows clearing it", (activeState) => {
    const onToggleState = vi.fn();
    const otherState = activeState === "NONE" ? "FUTURE" : "NONE";
    const { rerender } = render(<LeadBoardActivityBar states={[activeState, otherState]}
      activeState={activeState} onToggleState={onToggleState} />);
    rerender(<LeadBoardActivityBar states={[otherState]}
      activeState={activeState} onToggleState={onToggleState} />);

    const selected = screen.getByRole("button", { pressed: true });
    expect(selected).toHaveAttribute("data-activity-state", activeState);
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveAccessibleName(/: 0$/);
    expect(selected).toHaveClass("min-w-6", "shrink-0", "ring-1", "ring-inset", "ring-foreground");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(selected);
    expect(onToggleState).toHaveBeenCalledWith(activeState);
  });

  it.each(["FUTURE", "TODAY", "OVERDUE", "NONE"] as const)("keeps an empty column's active %s filter clickable and hides other zero states", (activeState) => {
    const onToggleState = vi.fn();
    const { rerender } = render(<LeadBoardActivityBar states={[]}
      activeState={activeState} onToggleState={onToggleState} />);
    const selected = screen.getByRole("button");
    expect(selected).toHaveAttribute("data-activity-state", activeState);
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected).toHaveClass("min-w-6", "ring-1");
    fireEvent.click(selected);
    expect(onToggleState).toHaveBeenCalledWith(activeState);

    rerender(<LeadBoardActivityBar states={[]} activeState={null} onToggleState={onToggleState} />);
    expect(screen.queryByRole("button")).toBeNull();
    const bar = screen.getByRole("img");
    expect(bar).toHaveClass("bg-activity-none");
    expect(bar.querySelector<HTMLElement>("[data-activity-state=NONE]")?.style.width).toBe("100%");
  });

  it("hides zero segments again once the active filter clears", () => {
    const states: CrmActivityState[] = ["FUTURE"];
    const onToggleState = vi.fn();
    const { rerender } = render(<LeadBoardActivityBar states={states}
      activeState="OVERDUE" onToggleState={onToggleState} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    rerender(<LeadBoardActivityBar states={states} onToggleState={onToggleState} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveAttribute("data-activity-state", "FUTURE");
    expect(screen.getByRole("button").style.width).toBe("100%");
  });
});
