// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageBar, type StageBarStep } from "./StageBar";

afterEach(cleanup);

const steps: StageBarStep[] = [
  { id: "new", label: "New", count: 4 },
  { id: "qualifying", label: "Qualifying", count: 2 },
  { id: "won", label: "Won", count: 1, tone: "positive" },
];

function renderBar(overrides: Partial<React.ComponentProps<typeof StageBar>> = {}) {
  const onChange = vi.fn();
  render(
    <StageBar
      steps={steps}
      onChange={onChange}
      label="Stages"
      allLabel="All"
      allCount={7}
      {...overrides}
    />,
  );
  return onChange;
}

describe("StageBar", () => {
  it("leads with an All step, so there is always a way back to the whole list", () => {
    renderBar();
    const group = screen.getByRole("group", { name: "Stages" });
    expect([...group.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual([
      "All7",
      "New4",
      "Qualifying2",
      "Won1",
    ]);
  });

  it("says which step is chosen without relying on colour", () => {
    renderBar({ value: "qualifying" });
    // aria-pressed, not a hue: the selected fill is reinforcement.
    expect(screen.getByRole("button", { name: /Qualifying/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("filters on a press, and clears when the chosen step is pressed again", () => {
    const onChange = renderBar({ value: "new" });
    fireEvent.click(screen.getByRole("button", { name: /Qualifying/ }));
    expect(onChange).toHaveBeenCalledWith("qualifying");

    fireEvent.click(screen.getByRole("button", { name: /New/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("treats All as the cleared state rather than a filter of its own", () => {
    const onChange = renderBar({ value: "won" });
    fireEvent.click(screen.getByRole("button", { name: /All/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("opens the bar flat and closes it flat, so it reads as one object", () => {
    renderBar();
    const buttons = [...screen.getByRole("group").querySelectorAll("button")];
    const first = buttons[0].className;
    const last = buttons[buttons.length - 1].className;
    // The first step has no notch cut into its start edge; the last has no
    // point on its end edge.
    expect(first).toContain("polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)");
    expect(last).toContain("polygon(0_0,100%_0,100%_100%,0_100%,12px_50%)");
  });
});
