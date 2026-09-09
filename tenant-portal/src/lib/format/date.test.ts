import { describe, expect, it } from "vitest";
import { formatDateTimeNumeric } from "./date";

const AT = "2026-09-06T08:01:00";

// Built from code points, never from the characters themselves: `design:census`
// counts literal Arabic-Indic digits anywhere under src/, and the test that
// pins that rule must not be the thing that trips its gate.
const ARABIC_INDIC_DIGITS = new RegExp("[\\u0660-\\u0669\\u06F0-\\u06F9]", "u");

describe("formatDateTimeNumeric", () => {
  it("prints all digits, day first, in both languages", () => {
    // The point of the format: a log is read by comparing rows, so the two
    // languages have to line up character for character.
    expect(formatDateTimeNumeric(AT, "en")).toBe("06/09/2026 08:01 AM");
    const arabic = formatDateTimeNumeric(AT, "ar");
    expect(arabic).toMatch(/^06\/09\/2026 08:01 /u);
    // Western digits in Arabic — settled, see typography.md#the-digit-decision.
    expect(ARABIC_INDIC_DIGITS.test(arabic)).toBe(false);
  });

  it("keeps the 12-hour clock past noon", () => {
    expect(formatDateTimeNumeric("2026-09-06T20:05:00", "en")).toBe("06/09/2026 08:05 PM");
  });

  it("hands back a malformed value rather than 'Invalid Date'", () => {
    // It is still evidence: a row whose timestamp cannot be parsed is worth
    // showing with whatever the server sent.
    expect(formatDateTimeNumeric("not-a-date", "en")).toBe("not-a-date");
  });
});
