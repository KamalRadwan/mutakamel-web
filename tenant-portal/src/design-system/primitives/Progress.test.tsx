// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Progress } from "./Progress";

afterEach(cleanup);

function indicatorOf(): HTMLElement {
  const indicator = screen.getByRole("progressbar").firstElementChild;
  if (!(indicator instanceof HTMLElement)) throw new Error("Progress rendered no indicator");
  return indicator;
}

describe("Progress", () => {
  it("exposes role=progressbar with the full ARIA value set when determinate", () => {
    render(<Progress value={38} max={50} label="Bulk update" valueText="38 of 50 processed" />);
    const bar = screen.getByRole("progressbar", { name: "Bulk update" });
    expect(bar).toHaveAttribute("aria-valuenow", "38");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "50");
    expect(bar).toHaveAttribute("aria-valuetext", "38 of 50 processed");
  });

  it("omits aria-valuenow when indeterminate, so it announces as unknown rather than zero", () => {
    render(<Progress label="Export" />);
    const bar = screen.getByRole("progressbar", { name: "Export" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("sizes the determinate indicator by width, which mirrors under RTL with no direction branch", () => {
    const { container } = render(<Progress value={25} max={100} label="Upload" />);
    expect(indicatorOf().style.width).toBe("25%");
    expect(container.innerHTML).not.toContain("translateX");
  });

  it("clamps an out-of-range value instead of overflowing its track", () => {
    const { rerender } = render(<Progress value={140} max={100} label="Upload" />);
    expect(indicatorOf().style.width).toBe("100%");
    rerender(<Progress value={-20} max={100} label="Upload" />);
    expect(indicatorOf().style.width).toBe("0%");
  });

  it("falls back to a static bar under prefers-reduced-motion", () => {
    render(<Progress label="Export" />);
    const className = indicatorOf().className;
    expect(className).toContain("animate-pulse");
    expect(className).toContain("motion-reduce:animate-none");
    expect(className).toContain("motion-reduce:opacity-70");
  });
});
