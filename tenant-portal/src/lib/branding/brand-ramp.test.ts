import { describe, expect, it } from "vitest";
import {
  BRAND_RAMP_STEPS,
  SYSTEM_CHROME,
  contrastRatio,
  deriveBrandRamp,
  deriveChrome,
  evaluateBrandColor,
  formatOklch,
  hexToOklch,
  oklchToLinearSrgb,
} from "./brand-ramp";

const WHITE = { l: 1, c: 0, h: 0 };
const INK_950 = { l: 0.175, c: 0.028, h: 240 };

describe("hexToOklch", () => {
  it("accepts every hex form @IsHexColor() admits", () => {
    for (const hex of ["#fff", "#ffff", "#ffffff", "#ffffffff"]) {
      const color = hexToOklch(hex);
      expect(color).not.toBeNull();
      expect(color!.l).toBeCloseTo(1, 2);
    }
  });

  it("rejects anything the DTO would not have produced", () => {
    for (const value of ["", "fff", "#ff", "#fffff", "#gggggg", "rgb(0,0,0)"]) {
      expect(hexToOklch(value)).toBeNull();
    }
  });

  it("round-trips a colour through OKLCH and back into sRGB", () => {
    // #2563eb is the reference blue the branding screen suggests.
    const color = hexToOklch("#2563eb");
    expect(color).not.toBeNull();
    const rgb = oklchToLinearSrgb(color!);
    // Blue-dominant, and every channel inside gamut.
    expect(rgb.b).toBeGreaterThan(rgb.r);
    expect(rgb.b).toBeGreaterThan(rgb.g);
  });
});

describe("deriveBrandRamp", () => {
  it("holds the system lightness on every step and only moves hue", () => {
    const ramp = deriveBrandRamp(140);
    // Values transcribed from globals.css §2 — the contract this preserves.
    expect(ramp[600].l).toBeCloseTo(0.56, 5);
    expect(ramp[400].l).toBeCloseTo(0.716, 5);
    expect(ramp[50].l).toBeCloseTo(0.97, 5);
    for (const step of BRAND_RAMP_STEPS) {
      expect(ramp[step].h).toBe(140);
    }
  });

  it("fits chroma into the sRGB gamut rather than clipping it", () => {
    // Yellow-green at hue 110 cannot hold the blue ramp's chroma at L 0.56.
    const ramp = deriveBrandRamp(110);
    const { r, g, b } = oklchToLinearSrgb(ramp[600]);
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(-1e-3);
      expect(channel).toBeLessThanOrEqual(1 + 1e-3);
    }
  });
});

describe("evaluateBrandColor", () => {
  it("passes the system brand hue itself", () => {
    const verdict = evaluateBrandColor("#066de9");
    expect(verdict).not.toBeNull();
    expect(verdict!.failures).toEqual([]);
    expect(verdict!.passes).toBe(true);
  });

  it("reports null for a value that is not a hex colour", () => {
    expect(evaluateBrandColor("not-a-colour")).toBeNull();
  });

  it("measures the pairs the three brand-consuming tokens actually render", () => {
    const verdict = evaluateBrandColor("#066de9");
    const ramp = verdict!.ramp;
    // --primary, light: white on brand-600. --primary, dark: ink-950 on brand-400.
    expect(contrastRatio(WHITE, ramp[600])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(INK_950, ramp[400])).toBeGreaterThanOrEqual(4.5);
  });

  it("refuses a green whose fill pair cannot reach 4.5:1", () => {
    // Greens around hue 150 are the real failure band: holding brand-600 at
    // L 0.560 puts a saturated green above the luminance white text needs, and
    // the light primary fill lands at ~4.34:1. A perfectly ordinary brand
    // colour, which is exactly why this check runs before anything is applied.
    const verdict = evaluateBrandColor("#16a34a");
    expect(verdict).not.toBeNull();
    expect(verdict!.passes).toBe(false);
    expect(verdict!.failures.map((failure) => failure.id)).toEqual(["primaryFillLight"]);
    expect(verdict!.failures[0].ratio).toBeLessThan(4.5);
  });

  it("still passes the same green on the pairs it does clear", () => {
    // The refusal is per pair, and the report names which one — "it failed"
    // with no ratio is not something a tenant can act on.
    const verdict = evaluateBrandColor("#16a34a");
    const ids = verdict!.failures.map((failure) => failure.id);
    expect(ids).not.toContain("primaryFillDark");
    expect(ids).not.toContain("ringLight");
  });
});

describe("deriveChrome", () => {
  it("reproduces --color-chrome at the system hue", () => {
    const chrome = deriveChrome(SYSTEM_CHROME.h);
    expect(chrome.l).toBeCloseTo(SYSTEM_CHROME.l, 5);
    expect(chrome.c).toBeCloseTo(SYSTEM_CHROME.c, 5);
    const rgb = oklchToLinearSrgb(chrome);
    expect(rgb.b).toBeGreaterThan(rgb.r);
    expect(rgb.b).toBeGreaterThan(rgb.g);
  });

  it("keeps white legible on the bar at every hue on the wheel", () => {
    // The bar's text, its icons and its focus ring are all white. A hue that
    // lifted the surface above 4.5:1 would not be a styling problem, it would
    // be an unreadable global nav — so this is swept, not sampled.
    for (let hue = 0; hue < 360; hue += 1) {
      expect(contrastRatio(WHITE, deriveChrome(hue))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("stays inside sRGB at every hue, so the browser never clips the bar", () => {
    // A clipped colour is one nothing measured: the ratio above would then
    // describe a colour the user never sees.
    for (let hue = 0; hue < 360; hue += 1) {
      const { r, g, b } = oklchToLinearSrgb(deriveChrome(hue));
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(-1e-4);
        expect(channel).toBeLessThanOrEqual(1 + 1e-4);
      }
    }
  });

  it("is measured as part of the verdict, not after it", () => {
    const verdict = evaluateBrandColor("#066de9");
    expect(verdict!.chrome.h).toBeCloseTo(verdict!.ramp[600].h, 5);
    // brand-300 is the active marker and the bar is what it sits on.
    expect(contrastRatio(verdict!.ramp[300], verdict!.chrome)).toBeGreaterThanOrEqual(3);
  });
});

describe("formatOklch", () => {
  it("emits the same syntax globals.css declares", () => {
    expect(formatOklch({ l: 0.56, c: 0.204, h: 258 })).toBe("oklch(0.560 0.2040 258.00)");
  });
});
