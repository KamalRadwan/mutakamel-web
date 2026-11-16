import { describe, expect, it } from "vitest";
import { designerViewportMatrix } from "./designer-viewport-mapping";
import type { ViewportMapping } from "./designer-interaction-contract";
const view: ViewportMapping = { clientLeft: 100, clientTop: 80, clientWidth: 1200, inlineOffsetPx: 32, blockOffsetPx: 24, scrollLeft: 65, scrollTop: 120, panX: 15, panY: -6, zoom: 0.5, direction: "LTR", pageWidthMm: 200, pageKey: "test-page" };
describe("physical mm viewport contract", () => {
  it("places the page origin using pan and scroll exactly once", () => {
    const [a, b, c, d, x, y] = designerViewportMatrix(view);
    expect([b, c, x, y]).toEqual([0, 0, 82, -22]);
    expect(a * 25.4).toBeCloseTo(48, 12); expect(d).toBe(a);
  });
  it("anchors RTL without reflecting authored x and retains signed DOM scroll offsets", () => {
    const rest = designerViewportMatrix({ ...view, direction: "RTL", scrollLeft: 0 });
    const scrolled = designerViewportMatrix({ ...view, direction: "RTL", scrollLeft: -65 });
    expect(rest[0]).toBeGreaterThan(0); expect(rest[3]).toBeGreaterThan(0);
    expect(scrolled[4] - rest[4]).toBe(65); expect(scrolled[5]).toBe(-22);
    expect(rest[4] + 200 * rest[0]).toBeCloseTo(1283, 10);
  });
  it.each([{ zoom: 0 }, { zoom: 2.01 }, { scrollLeft: Number.NaN }, { scrollTop: Number.POSITIVE_INFINITY }, { pageWidthMm: 0 }, { clientWidth: 0 }])("refuses an unusable measured viewport $zoom $scrollLeft", patch => {
    expect(() => designerViewportMatrix({ ...view, ...patch })).toThrow();
  });
});
