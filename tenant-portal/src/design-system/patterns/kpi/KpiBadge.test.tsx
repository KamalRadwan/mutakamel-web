// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Star } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n/useLanguage";
import { KpiBadge, type KpiBadgeTone } from "./KpiBadge";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("KpiBadge", () => {
  it("renders the label, formatted count chip, optional 11.5px icon, and tone classes", () => {
    setLanguage("en");
    render(<KpiBadge tone="rated" label="3★ Rated" count={1250} icon={<Star />} />);
    const button = screen.getByRole("button", { name: /3★ Rated/i });
    const countChip = screen.getByText("1,250");

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass(
      "h-6",
      "rounded-md",
      "border",
      "ps-[7.5px]",
      "pe-[5px]",
      "bg-kpi-rated-surface",
      "border-kpi-rated-line",
      "text-kpi-rated-text",
      "focus-visible:ring-2",
    );
    expect(countChip).toHaveClass(
      "min-w-[17px]",
      "h-4",
      "px-[4.5px]",
      "rounded-sm",
      "text-micro",
      "font-bold",
      "tabular-nums",
      "text-white",
      "bg-kpi-rated-count",
    );
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("reflects pressed state via aria-pressed and a 2px tone-line ring", () => {
    const { rerender } = render(
      <KpiBadge tone="new" label="New" count={12} pressed={false} />,
    );
    const button = screen.getByRole("button", { name: /New/i });

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveClass("ring-2", "ring-kpi-new-line");

    rerender(<KpiBadge tone="new" label="New" count={12} pressed />);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("ring-2", "ring-kpi-new-line");
  });

  it("invokes onClick when clicked and respects disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <KpiBadge tone="qualified" label="Qualified" count={8} onClick={onClick} />,
    );

    const button = screen.getByRole("button", { name: /Qualified/i });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <KpiBadge tone="qualified" label="Qualified" count={8} onClick={onClick} disabled />,
    );
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a placeholder chip and sets aria-busy when count is null", () => {
    render(<KpiBadge tone="overdue" label="Overdue" count={null} />);
    const button = screen.getByRole("button", { name: "Overdue" });
    const placeholder = button.querySelector('[data-slot="kpi-count-placeholder"]');

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveClass("h-4", "min-w-[17px]", "rounded-sm", "bg-kpi-overdue-count");
    expect(button).not.toHaveTextContent("null");
  });

  it("supports all five KPI tones without purple or indigo utilities", () => {
    const tones: KpiBadgeTone[] = ["total", "new", "rated", "qualified", "overdue"];

    for (const tone of tones) {
      const { unmount } = render(<KpiBadge tone={tone} label={tone} count={3} pressed />);
      const button = screen.getByRole("button", { name: new RegExp(tone) });
      expect(button.className).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
      unmount();
    }
  });
});
