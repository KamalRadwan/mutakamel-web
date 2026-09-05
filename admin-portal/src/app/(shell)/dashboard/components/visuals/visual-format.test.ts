import { describe, expect, it } from "vitest";
import { formatVisualExactValue, formatVisualValue } from "./visual-format";

/**
 * FE-B14. Every dashboard table headed "Exact values" — and the print sheet
 * built from the same markup — formatted its numbers with the approximate
 * helpers written for axes and hover labels. An operator reading that table
 * saw 2m where the payload said 90 seconds, 1.5 KB where it said 1,537 bytes,
 * and $10 where it said 10.49, with nothing on screen to reveal the rounding.
 */
describe("formatVisualExactValue", () => {
  it("keeps the minor unit of an amount of money", () => {
    expect(formatVisualExactValue("en", 10.49, "usd")).toBe("$10.49");
    // What the exact table used to print.
    expect(formatVisualValue("en", 10.49, "usd")).toBe("$10");
  });

  it("keeps digits beyond the minor unit when the payload carries them", () => {
    expect(formatVisualExactValue("en", 0.0125, "usd")).toBe("$0.0125");
  });

  it("does not invent digits a whole amount does not have", () => {
    expect(formatVisualExactValue("en", 1200, "usd")).toBe("$1,200");
  });

  it("reports a duration in the seconds it was measured in", () => {
    expect(formatVisualExactValue("en", 90, "seconds")).toBe("90s");
    expect(formatVisualExactValue("en", 5_400, "seconds")).toBe("5,400s");
    expect(formatVisualValue("en", 90, "seconds")).toBe("2m");
  });

  it("reports a size in bytes rather than a rounded multiple", () => {
    expect(formatVisualExactValue("en", 1537, "bytes")).toBe("1,537 B");
    expect(formatVisualValue("en", 1537, "bytes")).toBe("1.5 KB");
  });

  it("does not round a count to Intl's three-decimal default", () => {
    expect(formatVisualExactValue("en", 1.23456, "count")).toBe("1.23456");
    expect(formatVisualValue("en", 1.23456, "count")).toBe("1.235");
  });

  it("does not clamp a ratio above one down to 100%", () => {
    expect(formatVisualExactValue("en", 1.8, "ratio")).toBe("180%");
    expect(formatVisualValue("en", 1.8, "ratio")).toBe("100%");
  });

  it("keeps a fractional percentage the chart would round away", () => {
    expect(formatVisualExactValue("en", 0.12345, "ratio")).toBe("12.345%");
  });

  it("still refuses a value that is not a number", () => {
    expect(formatVisualExactValue("en", Number.NaN, "usd")).toBe("—");
    expect(formatVisualExactValue("en", Number.POSITIVE_INFINITY, "count")).toBe("—");
  });

  it("prints a float at the precision JavaScript itself shows, not its binary tail", () => {
    expect(formatVisualExactValue("en", 0.3, "count")).toBe("0.3");
  });
});
