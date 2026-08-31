import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";
import { fromIsoDate, toIsoDate } from "./iso-date";
import {
  definitionsForOwnerType,
  parseCrmCustomFieldDefinitions,
  parseCrmCustomFieldValues,
} from "./custom-fields-contract";

const FIELD_ID = "01900100-0000-7000-8000-000000000070";
const OTHER_FIELD_ID = "01900100-0000-7000-8000-000000000071";
const OWNER_ID = "01900100-0000-7000-8000-000000000001";
const VALUE_ID = "01900100-0000-7000-8000-000000000080";

function definition(overrides: Record<string, unknown> = {}) {
  return {
    id: FIELD_ID,
    ownerType: "LEAD",
    fieldKey: "budget_range",
    nameAr: "نطاق الميزانية",
    nameEn: "Budget range",
    type: "SELECT",
    options: [
      { key: "high", nameAr: "مرتفع", nameEn: "High", sortOrder: 10, isActive: true },
    ],
    isActive: true,
    sortOrder: 1,
    ...overrides,
  };
}

describe("file size formatting", () => {
  it("labels the binary cap with the decimal unit both languages decline", () => {
    // 25 MiB is what the backend enforces; Intl has no mebibyte unit, so the
    // number is divided by 1024^2 and labelled MB, the convention every file
    // listing uses.
    expect(formatFileSize(26_214_400, "en")).toContain("25");
    expect(formatFileSize(26_214_400, "ar")).toContain("25");
  });

  it("steps through bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(512, "en")).toMatch(/512/);
    expect(formatFileSize(2048, "en")).toMatch(/2/);
    expect(formatFileSize(0, "en")).toMatch(/0/);
  });

  it("returns nothing for a value that is not a size", () => {
    expect(formatFileSize(Number.NaN, "en")).toBe("");
    expect(formatFileSize(-1, "en")).toBe("");
  });
});

describe("date-only round trip", () => {
  it("keeps the local calendar day rather than shifting through UTC", () => {
    // `toISOString().slice(0,10)` on a date built at local midnight returns the
    // PREVIOUS day anywhere east of UTC, which is where this app runs.
    const first = new Date(2026, 0, 1);
    expect(toIsoDate(first)).toBe("2026-01-01");
    expect(toIsoDate(fromIsoDate("2026-01-01"))).toBe("2026-01-01");
  });

  it("accepts a full ISO timestamp and keeps only the date", () => {
    expect(toIsoDate(fromIsoDate("2026-07-31T22:00:00.000Z"))).toBe("2026-07-31");
  });

  it("returns nothing for an absent or malformed value", () => {
    expect(toIsoDate(undefined)).toBe("");
    expect(fromIsoDate("")).toBeUndefined();
    expect(fromIsoDate("31-07-2026")).toBeUndefined();
    expect(fromIsoDate(null)).toBeUndefined();
  });
});

describe("custom field definitions and values", () => {
  it("keeps the option list, which the list screen's projection drops", () => {
    const [parsed] = parseCrmCustomFieldDefinitions([definition()]);
    expect(parsed.options).toEqual([
      { key: "high", nameAr: "مرتفع", nameEn: "High", sortOrder: 10, isActive: true },
    ]);
  });

  it("rejects a lowercase type — the enum is uppercase", () => {
    expect(() => parseCrmCustomFieldDefinitions([definition({ type: "select" })])).toThrow();
  });

  it("gives a lead its own fields plus the LEAD_AND_PARTY scope", () => {
    const definitions = parseCrmCustomFieldDefinitions([
      definition(),
      definition({ id: OTHER_FIELD_ID, ownerType: "LEAD_AND_PARTY", sortOrder: 2 }),
      definition({ id: VALUE_ID, ownerType: "OPPORTUNITY", sortOrder: 3 }),
    ]);
    expect(definitionsForOwnerType(definitions, "LEAD").map(({ id }) => id)).toEqual([
      FIELD_ID,
      OTHER_FIELD_ID,
    ]);
    // A customer profile takes only its own scope — LEAD_AND_PARTY is a
    // lead-and-party pairing, not a wildcard.
    expect(definitionsForOwnerType(definitions, "CUSTOMER_PROFILE")).toHaveLength(0);
  });

  it("drops an inactive definition and sorts by sortOrder", () => {
    const definitions = parseCrmCustomFieldDefinitions([
      definition({ id: OTHER_FIELD_ID, sortOrder: 5 }),
      definition({ sortOrder: 1 }),
      definition({ id: VALUE_ID, sortOrder: 2, isActive: false }),
    ]);
    expect(definitionsForOwnerType(definitions, "LEAD").map(({ sortOrder }) => sortOrder)).toEqual([
      1, 5,
    ]);
  });

  it("reads values for one owner and rejects another owner's rows", () => {
    const expected = { ownerType: "LEAD" as const, ownerId: OWNER_ID };
    expect(
      parseCrmCustomFieldValues(
        [{ id: VALUE_ID, fieldDefinitionId: FIELD_ID, ownerType: "LEAD", ownerId: OWNER_ID, value: "high" }],
        expected,
      ),
    ).toEqual([
      {
        id: VALUE_ID,
        fieldDefinitionId: FIELD_ID,
        ownerType: "LEAD",
        ownerId: OWNER_ID,
        value: "high",
      },
    ]);
    expect(() =>
      parseCrmCustomFieldValues(
        [{ id: VALUE_ID, fieldDefinitionId: FIELD_ID, ownerType: "LEAD", ownerId: FIELD_ID, value: "high" }],
        expected,
      ),
    ).toThrow();
  });
});
