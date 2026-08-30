// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Slider } from "./Slider";

afterEach(cleanup);

// Radix measures the thumb through ResizeObserver, which jsdom does not
// implement. The stub only has to exist; nothing here asserts on measurement.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("Slider", () => {
  it("names every thumb, so a range slider does not ship two unnamed controls", () => {
    render(
      <Slider defaultValue={[10, 90]} thumbLabels={["Minimum value", "Maximum value"]} min={0} max={100} />,
    );
    expect(screen.getByRole("slider", { name: "Minimum value" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Maximum value" })).toBeInTheDocument();
  });

  it("reports the full ARIA value set on each thumb", () => {
    render(<Slider defaultValue={[25]} thumbLabels={["Probability"]} min={0} max={100} />);
    const thumb = screen.getByRole("slider", { name: "Probability" });
    expect(thumb).toHaveAttribute("aria-valuenow", "25");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
  });

  it("moves with the keyboard", () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        defaultValue={[25]}
        thumbLabels={["Probability"]}
        min={0}
        max={100}
        step={5}
        onValueChange={onValueChange}
      />,
    );
    fireEvent.keyDown(screen.getByRole("slider", { name: "Probability" }), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith([30]);
  });

  it("mirrors arrow keys under RTL through the DirectionProvider, with no dir branch of its own", () => {
    const onValueChange = vi.fn();
    render(
      <DirectionProvider dir="rtl">
        <Slider
          defaultValue={[25]}
          thumbLabels={["Probability"]}
          min={0}
          max={100}
          step={5}
          onValueChange={onValueChange}
        />
      </DirectionProvider>,
    );
    // Right is "backwards" in Arabic, and the component never computes that
    // itself — the provider the app already mounts does.
    fireEvent.keyDown(screen.getByRole("slider", { name: "Probability" }), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith([20]);
  });

  it("marks the thumb as a pointer target with a visible focus ring", () => {
    render(<Slider defaultValue={[25]} thumbLabels={["Probability"]} />);
    const className = screen.getByRole("slider", { name: "Probability" }).className;
    expect(className).toContain("cursor-pointer");
    expect(className).toContain("focus-visible:ring-2");
  });
});
