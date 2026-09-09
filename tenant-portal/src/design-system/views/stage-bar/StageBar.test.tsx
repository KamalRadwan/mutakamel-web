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

  // The second job: one record's own stage, where pressing a step MOVES it.
  // `allLabel` is what separates the two — a bar without an "every stage" step
  // is never a toggle group. See the table on StageBarProps.
  describe("as a stage move", () => {
    function renderMoveBar(overrides: Partial<React.ComponentProps<typeof StageBar>> = {}) {
      const onChange = vi.fn();
      render(
        <StageBar
          steps={steps}
          onChange={onChange}
          label="Stage"
          value="qualifying"
          {...overrides}
        />,
      );
      return onChange;
    }

    it("marks where the record stands with aria-current, not aria-pressed", () => {
      renderMoveBar();
      expect(screen.getByRole("button", { name: /Qualifying/ })).toHaveAttribute(
        "aria-current",
        "step",
      );
      // `aria-pressed="false"` on the others would announce a state a record
      // does not have: it is in one stage, not "unpressed" in the rest.
      expect(screen.getByRole("button", { name: /New/ })).not.toHaveAttribute("aria-pressed");
    });

    it("moves the record to the pressed stage", () => {
      const onChange = renderMoveBar();
      fireEvent.click(screen.getByRole("button", { name: /Won/ }));
      expect(onChange).toHaveBeenCalledWith("won");
    });

    it("does nothing when the current stage is pressed, without looking switched off", () => {
      // The filter path reads that press as "clear"; here there is nowhere to
      // go. It is NOT `disabled`: that paints the step at 50% opacity, and
      // half-fading the one step saying where the record stands made a working
      // bar look dead. `aria-current` is what says it is not a destination.
      const onChange = renderMoveBar();
      const current = screen.getByRole("button", { name: /Qualifying/ });
      expect(current).toBeEnabled();
      expect(current.className).toContain("cursor-default");
      fireEvent.click(current);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("leaves a forbidden destination in the bar, inert", () => {
      // A lead's CONVERTED stage: conversion owns it, and a stage move into it
      // is a 409. Hiding the step would say the pipeline is shorter than it is.
      const onChange = renderMoveBar({
        steps: [...steps, { id: "converted", label: "Converted", disabled: true }],
      });
      const forbidden = screen.getByRole("button", { name: /Converted/ });
      expect(forbidden).toBeDisabled();
      fireEvent.click(forbidden);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("is a picture when no handler is passed at all", () => {
      // Which is what a reader without the update capability gets.
      render(<StageBar steps={steps} label="Stage" value="new" />);
      for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    });
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
