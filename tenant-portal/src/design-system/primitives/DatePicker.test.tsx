// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./DatePicker";

afterEach(cleanup);

const MARCH_15 = new Date(2026, 2, 15);

describe("DatePicker", () => {
  it("renders the placeholder when nothing is selected", () => {
    render(<DatePicker onValueChange={vi.fn()} placeholder="Pick a date" />);
    expect(screen.getByRole("button", { name: /Pick a date/ })).toBeInTheDocument();
  });

  it("formats the selected date with an explicit locale rather than the runtime default", () => {
    render(<DatePicker value={MARCH_15} onValueChange={vi.fn()} placeholder="Pick a date" language="en" />);
    expect(screen.getByRole("button", { name: /Mar 15, 2026/ })).toBeInTheDocument();
  });

  it("opens the calendar and reports the chosen day", () => {
    const onValueChange = vi.fn();
    render(
      <DatePicker value={MARCH_15} onValueChange={onValueChange} placeholder="Pick a date" language="en" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Mar 15, 2026/ }));
    // Day buttons carry a full spoken date as their accessible name, so the
    // visible numeral is the stable handle here.
    fireEvent.click(screen.getByText("20"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect((onValueChange.mock.calls[0][0] as Date).getDate()).toBe(20);
  });

  it("clears through a dedicated control that is a sibling of the trigger, never nested inside it", () => {
    const onValueChange = vi.fn();
    render(
      <DatePicker
        value={MARCH_15}
        onValueChange={onValueChange}
        placeholder="Pick a date"
        clearLabel="Clear date"
        language="en"
      />,
    );
    const clear = screen.getByRole("button", { name: "Clear date" });
    expect(clear.closest("button")).toBe(clear);
    fireEvent.click(clear);
    expect(onValueChange).toHaveBeenCalledWith(undefined);
  });

  it("renders readOnly distinctly from disabled — still focusable, still full contrast", () => {
    const { rerender } = render(
      <DatePicker value={MARCH_15} onValueChange={vi.fn()} placeholder="Pick a date" readOnly language="en" />,
    );
    const readOnlyTrigger = screen.getByRole("button", { name: /Mar 15, 2026/ });
    expect(readOnlyTrigger).toBeEnabled();
    expect(readOnlyTrigger).toHaveAttribute("aria-readonly", "true");
    // Only the disabled: variant may dim — an unconditional opacity-50 would
    // claim the value does not apply, which is the bug this state exists to
    // avoid.
    expect(readOnlyTrigger.className).not.toMatch(/(?:^|\s)opacity-50/);
    expect(readOnlyTrigger.className).toContain("text-foreground");

    rerender(
      <DatePicker value={MARCH_15} onValueChange={vi.fn()} placeholder="Pick a date" disabled language="en" />,
    );
    expect(screen.getByRole("button", { name: /Mar 15, 2026/ })).toBeDisabled();
  });

  it("does not open the calendar while readOnly", () => {
    render(
      <DatePicker value={MARCH_15} onValueChange={vi.fn()} placeholder="Pick a date" readOnly language="en" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Mar 15, 2026/ }));
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("fires onBlur so a form can validate on blur instead of per keystroke", () => {
    const onBlur = vi.fn();
    render(<DatePicker onValueChange={vi.fn()} placeholder="Pick a date" onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole("button", { name: /Pick a date/ }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
