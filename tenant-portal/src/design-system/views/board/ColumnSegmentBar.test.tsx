// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ColumnSegmentBar } from "./ColumnSegmentBar";
import type { BoardColumnSegment } from "./types";

afterEach(cleanup);

const segments: BoardColumnSegment[] = [
  { id: "OVERDUE", label: "Overdue", value: 3, tone: "negative" },
  { id: "TODAY", label: "Due today", value: 1, tone: "caution" },
  { id: "FUTURE", label: "Upcoming", value: 0, tone: "positive" },
  { id: "NONE", label: "No open activity", value: 4, tone: "neutral" },
];

describe("ColumnSegmentBar", () => {
  // The bar is four coloured strips and nothing else, so without this it says
  // nothing at all to anyone who cannot see it.
  it("spells the whole distribution into one accessible name", () => {
    render(<ColumnSegmentBar segments={segments} label="Activity in this stage" />);
    expect(
      screen.getByRole("img", {
        name: "Activity in this stage — Overdue: 3 · Due today: 1 · No open activity: 4",
      }),
    ).toBeInTheDocument();
  });

  it("divides the width by count, and omits a bucket with nothing in it", () => {
    const { container } = render(
      <ColumnSegmentBar segments={segments} label="Activity in this stage" />,
    );
    const slices = Array.from(container.querySelectorAll("span"));
    expect(slices).toHaveLength(3);
    expect(slices.map((slice) => slice.style.flexGrow)).toEqual(["3", "1", "4"]);
  });

  it("renders nothing rather than an empty strip when the column holds no cards", () => {
    const { container } = render(
      <ColumnSegmentBar
        segments={segments.map((segment) => ({ ...segment, value: 0 }))}
        label="Activity in this stage"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
