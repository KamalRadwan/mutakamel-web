// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmRating, type CrmRatingLabels } from "./CrmRating";

afterEach(cleanup);

const labels: CrmRatingLabels = {
  group: "Importance",
  setStars: "Rate {count} of {max}",
  clear: "Clear rating",
};

describe("CrmRating", () => {
  it("renders 3 star buttons inside a labelled group", () => {
    render(<CrmRating value={2} onChange={vi.fn()} labels={labels} />);
    const group = screen.getByRole("group", { name: "Importance" });
    expect(group).toBeInTheDocument();

    const stars = within(group).getAllByRole("button");
    expect(stars).toHaveLength(3);
    expect(stars[0]).toHaveAttribute("aria-pressed", "true");
    expect(stars[1]).toHaveAttribute("aria-pressed", "true");
    expect(stars[2]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with clicked rating", () => {
    const onChange = vi.fn();
    render(<CrmRating value={1} onChange={onChange} labels={labels} />);
    const thirdStar = screen.getByRole("button", { name: "Rate 3 of 3" });
    fireEvent.click(thirdStar);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("clears rating when the current star is clicked", () => {
    const onChange = vi.fn();
    render(<CrmRating value={2} onChange={onChange} labels={labels} />);
    const clearBtn = screen.getByRole("button", { name: "Clear rating" });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<CrmRating value={1} onChange={onChange} disabled labels={labels} />);
    const stars = screen.getAllByRole("button");
    fireEvent.click(stars[2]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
