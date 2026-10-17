import { describe, expect, it } from "vitest";
import {
  FALLBACK_SWATCH_SURFACE_PALETTE,
  IDLE_SEGMENT_PILL_CLASSES,
  SWATCH_HUES,
  SWATCH_SURFACE_PALETTES,
  isSwatchHue,
  semanticSegmentDotClasses,
  semanticSegmentPillClasses,
  swatchSegmentPillClasses,
  swatchSurfacePalette,
} from "./swatch-palette";

describe("swatch-palette", () => {
  it("defines complete surface roles for all 11 theme-adaptive swatch hues", () => {
    expect(SWATCH_HUES).toHaveLength(11);
    for (const hue of SWATCH_HUES) {
      expect(isSwatchHue(hue)).toBe(true);
      const palette = SWATCH_SURFACE_PALETTES[hue];
      expect(palette.tileActive).toContain(`swatch-${hue}-soft`);
      expect(palette.tileIdle).toContain(`swatch-${hue}`);
      expect(palette.iconBoxActive).toContain(`bg-swatch-${hue}`);
      expect(palette.iconBoxIdle).toContain(`bg-swatch-${hue}-soft`);
      expect(palette.badge).toContain(`bg-swatch-${hue}-soft`);
      expect(palette.pillActive).toContain(`border-swatch-${hue}`);
      expect(palette.accentBorder).toBe(`border-s-swatch-${hue}`);
      expect(palette.sectionCard).toContain(`bg-swatch-${hue}-soft`);
      expect(palette.dot).toBe(`bg-swatch-${hue}`);
    }
  });

  it("falls back to neutral/primary tokens for unknown hues", () => {
    expect(isSwatchHue("unknown")).toBe(false);
    expect(swatchSurfacePalette(null)).toEqual(FALLBACK_SWATCH_SURFACE_PALETTE);
    expect(swatchSurfacePalette(undefined)).toEqual(FALLBACK_SWATCH_SURFACE_PALETTE);
  });

  it("returns idle or active classes for semantic and swatch segmented pills", () => {
    expect(semanticSegmentPillClasses("info", false)).toBe(IDLE_SEGMENT_PILL_CLASSES);
    expect(semanticSegmentPillClasses("info", true)).toContain("border-info");
    expect(semanticSegmentPillClasses("purple", true)).toContain("border-swatch-purple");
    expect(semanticSegmentPillClasses("warning", true)).toContain("border-warning");
    expect(semanticSegmentPillClasses("success", true)).toContain("border-success");
    expect(semanticSegmentPillClasses("destructive", true)).toContain("border-destructive");
    expect(semanticSegmentPillClasses("slate", true)).toContain("border-swatch-slate");

    expect(semanticSegmentDotClasses("info")).toBe("bg-info-vivid");
    expect(semanticSegmentDotClasses("purple")).toBe("bg-swatch-purple");
    expect(semanticSegmentDotClasses("slate")).toBe("bg-swatch-slate");

    expect(swatchSegmentPillClasses("indigo", false)).toBe(IDLE_SEGMENT_PILL_CLASSES);
    expect(swatchSegmentPillClasses("indigo", true)).toBe(SWATCH_SURFACE_PALETTES.indigo.pillActive);
  });
});
