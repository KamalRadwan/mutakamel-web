import { afterEach, describe, expect, it, vi } from "vitest";
import { fromLocalCustomFieldDateTime, toLocalCustomFieldDateTime } from "./custom-field-datetime";

afterEach(() => vi.unstubAllEnvs());

describe("custom-field local date/time conversion", () => {
  it("serializes a local selection with seconds and a zone", () => {
    expect(fromLocalCustomFieldDateTime("2026-11-04T10:30"))
      .toBe(new Date(2026, 10, 4, 10, 30, 0, 0).toISOString());
    expect(fromLocalCustomFieldDateTime("2026-11-04T10:30:15.125"))
      .toBe(new Date(2026, 10, 4, 10, 30, 15, 125).toISOString());
  });

  it("displays an offset timestamp locally and preserves its exact untouched wire value", () => {
    const original = "2026-11-04T10:30:15.125+02:00";
    const local = toLocalCustomFieldDateTime(original);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:15\.125$/);
    expect(fromLocalCustomFieldDateTime(local, original)).toBe(original);
  });

  it("preserves a stored offset representation when equivalent native input omits zero seconds", () => {
    const original = new Date(2026, 10, 4, 10, 30, 0, 0).toISOString().replace(".000Z", "Z");
    expect(fromLocalCustomFieldDateTime("2026-11-04T10:30", original)).toBe(original);
  });

  it.each([
    "2026-02-29T10:30", "2026-02-30T10:30", "2026-04-31T10:30", "2026-13-01T10:30",
    "2026-00-01T10:30", "2026-11-00T10:30", "2026-11-04T24:00", "2026-11-04T10:60",
    "2026-11-04T10:30:60", "2026-11-04T10:30:00.1234", "0000-01-01T00:00", "not a date",
  ])("rejects an invalid wall time without normalizing it: %s", (value) => {
    expect(fromLocalCustomFieldDateTime(value)).toBeUndefined();
  });

  it("accepts leap day and keeps years below 100 out of the 1900s", () => {
    expect(fromLocalCustomFieldDateTime("2024-02-29T10:30")).toBe(new Date(2024, 1, 29, 10, 30).toISOString());
    const output = fromLocalCustomFieldDateTime("0099-06-15T12:00");
    expect(typeof output).toBe("string");
    expect(new Date(output as string).getFullYear()).toBe(99);
  });

  it("rejects a nonexistent daylight-saving wall time", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(fromLocalCustomFieldDateTime("2026-03-08T02:30")).toBeUndefined();
  });

  it.each(["2026-02-30T10:30:00Z", "2026-11-04T24:00:00Z", "2026-11-04T10:30", "2026-11-04T10:30:00+24:00", null])("does not display a malformed stored timestamp as a normalized valid value: %s", (value) => {
    expect(toLocalCustomFieldDateTime(value)).toBe("");
  });

  it("distinguishes an intentional clear from invalid input", () => {
    expect(fromLocalCustomFieldDateTime("")).toBeNull();
    expect(fromLocalCustomFieldDateTime(" ")).toBeUndefined();
  });
});
