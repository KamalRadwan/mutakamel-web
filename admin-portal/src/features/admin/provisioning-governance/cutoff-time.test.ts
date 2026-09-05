import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isoToUtcInput, utcInputToIso } from "./cutoff-time";

/**
 * FE-G02. The field is labelled "Evidence cutoff (UTC)" / "حد الأدلة الزمني
 * (UTC)". It was rendered through the browser's offset and read back with a
 * bare `new Date(value)`, which parses a `datetime-local` string as local time.
 *
 * Both halves shifted by the same amount, so the round trip was self-consistent
 * and nothing looked wrong on screen. What was wrong was the instant: an
 * operator in UTC+3 who typed 10:00 got a 07:00 UTC boundary - three hours of
 * discovery evidence silently included or excluded.
 *
 * A UTC machine cannot see any of this, so the suite runs in a zone with a real
 * offset. Both assertions below hold trivially at TZ=UTC and fail under the old
 * helpers here.
 */

const ORIGINAL_TZ = process.env.TZ;

describe("evidence cutoff conversions (TZ=Asia/Riyadh, UTC+3)", () => {
  beforeAll(() => {
    process.env.TZ = "Asia/Riyadh";
  });

  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("runs in a zone that can expose the shift", () => {
    // Guards the guard: if TZ did not take effect, every assertion below would
    // pass against the defective implementation too.
    expect(new Date("2026-09-05T10:00:00.000Z").getHours()).toBe(13);
  });

  it("renders an instant with its UTC clock time, not the local one", () => {
    // The old helper subtracted the offset first, so this read "13:00".
    expect(isoToUtcInput("2026-09-05T10:00:00.000Z")).toBe("2026-09-05T10:00:00");
  });

  it("reads the typed digits as UTC, not as local time", () => {
    // The old helper parsed this as 10:00 local, i.e. 07:00Z.
    expect(utcInputToIso("2026-09-05T10:00:00")).toBe("2026-09-05T10:00:00.000Z");
  });

  it("round-trips an instant unchanged", () => {
    const instant = "2026-01-31T23:45:12.000Z";
    expect(utcInputToIso(isoToUtcInput(instant))).toBe(instant);
  });

  it("crosses the UTC date boundary without moving the day", () => {
    // 01:00Z is the previous day at 22:00 local. The old helper rendered
    // "2026-09-05T04:00" for this, changing the date the operator reads.
    expect(isoToUtcInput("2026-09-05T01:00:00.000Z")).toBe("2026-09-05T01:00:00");
    expect(utcInputToIso("2026-09-05T01:00:00")).toBe("2026-09-05T01:00:00.000Z");
  });

  it("accepts the minute-only form some browsers emit at step=1", () => {
    // With `step={1}` the control reports seconds, but several browsers drop
    // them when they are zero. The Z suffix keeps that form UTC too.
    expect(utcInputToIso("2026-09-05T10:00")).toBe("2026-09-05T10:00:00.000Z");
  });

  it("treats an empty or unparseable value as no cutoff", () => {
    expect(isoToUtcInput("")).toBe("");
    expect(isoToUtcInput("not a date")).toBe("");
    expect(utcInputToIso("")).toBe("");
    expect(utcInputToIso("not a date")).toBe("");
  });
});
