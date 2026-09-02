import { describe, expect, it } from "vitest";
import { formatBytes } from "./number";

describe("formatBytes", () => {
  it("translates the unit instead of appending an English word", () => {
    // The defect: a locale-less number conversion with the English word
    // "bytes" spliced onto it — an English unit on an Arabic screen (U10).
    const arabic = formatBytes(10 * 1024 * 1024, "ar");
    expect(arabic).not.toMatch(/bytes/i);
    expect(arabic).toMatch(/10/);
    expect(formatBytes(10 * 1024 * 1024, "en")).toMatch(/10\s*MB/);
  });

  it("is deterministic — no locale-less Intl call", () => {
    // A locale-conversion call with no argument resolves to the runtime's
    // default, so the same build produced different separators on a
    // developer's machine, a user's browser and CI. Both languages are pinned.
    expect(formatBytes(1536, "en")).toBe(formatBytes(1536, "en"));
    expect(formatBytes(1536, "en")).toBe("2 kB");
  });

  it("keeps Western digits under Arabic", () => {
    // The settled numeral rule (U9) — `INTL_LOCALE.ar` is ar-EG-u-nu-latn.
    // The Arabic-Indic block is written as escapes so the census counter that
    // must read 0 is not tripped by the test pinning the rule.
    expect(formatBytes(2048, "ar")).toMatch(/[0-9]/);
    expect(formatBytes(2048, "ar")).not.toMatch(/[\u0660-\u0669]/);
  });

  it("steps through the units and leaves whole bytes unrounded", () => {
    expect(formatBytes(512, "en")).toMatch(/512/);
    expect(formatBytes(1024, "en")).toMatch(/1\s*kB/);
    // Whole numbers below a megabyte, one decimal above — the rounding
    // `formatFileSize` already shipped, now shared rather than duplicated.
    expect(formatBytes(1536, "en")).toBe("2 kB");
    expect(formatBytes(1_572_864, "en")).toBe("1.5 MB");
    expect(formatBytes(5 * 1024 ** 3, "en")).toMatch(/5\s*GB/);
    // Stops at gigabyte rather than inventing a unit Intl does not name.
    expect(formatBytes(3 * 1024 ** 4, "en")).toMatch(/GB/);
  });

  it("renders nothing for a value that is not a byte count", () => {
    expect(formatBytes(Number.NaN, "en")).toBe("");
    expect(formatBytes(-1, "en")).toBe("");
  });
});
