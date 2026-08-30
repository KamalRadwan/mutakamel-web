// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stepper, type StepperStep } from "./Stepper";

afterEach(cleanup);

const steps: StepperStep[] = [
  { id: "details", label: "Details", state: "complete" },
  { id: "contact", label: "Contact", state: "invalid" },
  { id: "review", label: "Review", state: "current" },
  { id: "confirm", label: "Confirm", state: "upcoming" },
];

describe("Stepper", () => {
  it("names the sequence and renders it as an ordered list, so RTL ordering is the browser's job", () => {
    const { container } = render(<Stepper steps={steps} label="Lead conversion" />);
    expect(screen.getByRole("navigation", { name: "Lead conversion" })).toBeInTheDocument();
    expect(container.querySelector("ol")?.children).toHaveLength(4);
    // Nothing reverses order by hand — no flex-row-reverse anywhere.
    expect(container.innerHTML).not.toContain("flex-row-reverse");
  });

  it("marks exactly one step as aria-current", () => {
    const { container } = render(<Stepper steps={steps} label="Lead conversion" />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it("numbers upcoming and current steps, and swaps the numeral for an outcome glyph", () => {
    render(<Stepper steps={steps} label="Lead conversion" />);
    // "Details" is complete and "Contact" is invalid, so 1 and 2 are replaced.
    expect(screen.queryByText("1")).toBeNull();
    expect(screen.queryByText("2")).toBeNull();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("never gives a step a hue for its position — only the outcome takes colour", () => {
    const { container } = render(
      <Stepper
        steps={[
          { id: "a", label: "A", state: "upcoming" },
          { id: "b", label: "B", state: "current" },
          { id: "c", label: "C", state: "upcoming" },
        ]}
        label="Neutral"
      />,
    );
    const markup = container.innerHTML;
    for (const hue of ["brand-", "caution-", "positive-", "negative-"]) {
      expect(markup).not.toContain(hue);
    }
  });

  it("uses positive for a passed step and destructive for a failed one", () => {
    const { container } = render(<Stepper steps={steps} label="Lead conversion" />);
    expect(container.innerHTML).toContain("positive-700");
    expect(container.innerHTML).toContain("bg-destructive");
  });

  it("activates a step when the caller opts into selection", () => {
    const onStepSelect = vi.fn();
    render(<Stepper steps={steps} label="Lead conversion" onStepSelect={onStepSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Contact/ }));
    expect(onStepSelect).toHaveBeenCalledWith("contact");
  });

  it("renders no buttons at all when it is a read-only indicator", () => {
    render(<Stepper steps={steps} label="Lead conversion" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
