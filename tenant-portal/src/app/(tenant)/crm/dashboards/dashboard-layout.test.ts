import { describe, expect, it } from "vitest";
import {
  movePlacement,
  orderedBoxes,
  packPlacements,
  type PlacementBox,
} from "./dashboard-layout";

const box = (id: string, width: number, height: number): PlacementBox => ({
  id,
  x: 0,
  y: 0,
  width,
  height,
});

function overlaps(left: PlacementBox, right: PlacementBox): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

describe("Dashboard layout packing", () => {
  it("fills a row left to right and wraps at 12 columns", () => {
    const packed = packPlacements([box("a", 6, 4), box("b", 6, 4), box("c", 6, 4)], []);
    expect(packed[0]).toMatchObject({ x: 0, y: 0 });
    expect(packed[1]).toMatchObject({ x: 6, y: 0 });
    expect(packed[2]).toMatchObject({ x: 0, y: 4 });
  });

  it("keeps every widget's own size — the server validates size per visualization", () => {
    const packed = packPlacements([box("a", 3, 2), box("b", 9, 8)], []);
    expect(packed.map(({ width, height }) => [width, height])).toEqual([
      [3, 2],
      [9, 8],
    ]);
  });

  it("packs around placements the editor cannot see", () => {
    // `updateLayout` runs assertNoOverlap over the submitted boxes PLUS the
    // ones hidden from this viewer, so a naive repack is a 409.
    const hidden: PlacementBox = { id: "hidden", x: 0, y: 0, width: 12, height: 2 };
    const packed = packPlacements([box("a", 6, 4)], [hidden]);
    expect(packed[0].y).toBe(2);
    expect(overlaps(packed[0], hidden)).toBe(false);
  });

  it("never produces an overlap for a full 20-widget dashboard", () => {
    const boxes = Array.from({ length: 20 }, (_, index) =>
      box(`w${index}`, (index % 3) + 3, (index % 4) + 2),
    );
    const packed = packPlacements(boxes, []);
    for (let left = 0; left < packed.length; left += 1) {
      for (let right = left + 1; right < packed.length; right += 1) {
        expect(overlaps(packed[left], packed[right])).toBe(false);
      }
      expect(packed[left].x + packed[left].width).toBeLessThanOrEqual(12);
    }
  });

  it("moves one placement and reports the ends honestly", () => {
    const boxes = [box("a", 3, 2), box("b", 3, 2), box("c", 3, 2)];
    expect(movePlacement(boxes, "b", -1)?.map(({ id }) => id)).toEqual(["b", "a", "c"]);
    expect(movePlacement(boxes, "a", -1)).toBeNull();
    expect(movePlacement(boxes, "c", 1)).toBeNull();
  });

  it("orders by sort_order, then y, then x, then id — the server's own order", () => {
    const ordered = orderedBoxes([
      { id: "b", x: 6, y: 0, width: 3, height: 2, sortOrder: 1 },
      { id: "a", x: 0, y: 0, width: 3, height: 2, sortOrder: 0 },
      { id: "c", x: 0, y: 4, width: 3, height: 2, sortOrder: 1 },
    ]);
    expect(ordered.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});
