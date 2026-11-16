import { describe, expect, it } from "vitest";
import { parseCrmCustomField, type CrmCustomFieldType } from "./custom-field-contract";
import { parseCustomFieldValues, validateCustomFieldValue } from "./custom-field-values-contract";

const base = parseCrmCustomField({ id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "details",
  nameAr: "التفاصيل", nameEn: "Details", type: "TEXT", options: [], isActive: true, isSearchable: false, sortOrder: 1 });
const option = { key: "phone", nameAr: "الهاتف", nameEn: "Phone", sortOrder: 1, isActive: true };
const field = (type: CrmCustomFieldType) => ({ ...base, type, options: [option, { ...option, key: "retired", isActive: false }] });

describe("typed custom-field record values", () => {
  it.each([
    ["TEXT", "Notes"], ["TEXTAREA", "Longer notes"], ["NUMBER", 10.5], ["BOOLEAN", false], ["DATE", "2026-11-03"],
    ["DATETIME", "2026-11-03T10:30:00+02:00"], ["URL", "https://orbit.example"], ["EMAIL", "dina@orbit.example"],
    ["PHONE", "+20 (100) 123-4567"], ["SELECT", "phone"], ["MULTI_SELECT", ["phone"]],
  ] as [CrmCustomFieldType, unknown][])("accepts a valid %s wire value", (type, value) => {
    expect(validateCustomFieldValue(field(type), value, "LEAD")).toBeNull();
  });
  it.each([
    ["TEXT", "x".repeat(501)], ["TEXTAREA", "x".repeat(5001)], ["NUMBER", Infinity], ["BOOLEAN", "false"],
    ["DATE", "2026-02-31"], ["DATETIME", "2026-11-03T10:30"], ["URL", "javascript:alert(1)"],
    ["EMAIL", "dina@"], ["PHONE", "123"], ["SELECT", "retired"], ["MULTI_SELECT", ["phone", "phone"]],
  ] as [CrmCustomFieldType, unknown][])("rejects invalid %s values before a write", (type, value) => {
    expect(validateCustomFieldValue(field(type), value, "LEAD")).toBe(type);
  });
  it("distinguishes a clearable optional field from an update-required field, including false and zero", () => {
    const required = { ...field("TEXT"), requirements: [{ operation: "UPDATE" as const, entityScope: null, isRequired: true }] };
    expect(validateCustomFieldValue(required, " ", "LEAD")).toBe("required");
    expect(validateCustomFieldValue(field("TEXT"), null, "LEAD")).toBeNull();
    expect(validateCustomFieldValue(field("NUMBER"), 0, "LEAD")).toBeNull();
    expect(validateCustomFieldValue(field("BOOLEAN"), false, "LEAD")).toBeNull();
  });
  it("rejects duplicate owner values and values for another record", () => {
    const row = { fieldDefinitionId: base.id, ownerType: "LEAD", ownerId: base.id, value: "Value" };
    expect(() => parseCustomFieldValues([row, row], "LEAD", base.id)).toThrow();
    expect(() => parseCustomFieldValues([row], "LEAD", "another-record")).toThrow();
    expect(() => parseCustomFieldValues(Array.from({ length: 101 }, () => row), "LEAD", base.id)).toThrow();
  });
  it("counts international phone digits after normalizing the 00 prefix", () => {
    expect(validateCustomFieldValue(field("PHONE"), "0012345", "LEAD")).toBe("PHONE");
    expect(validateCustomFieldValue(field("PHONE"), "00123456789012345", "LEAD")).toBeNull();
    expect(validateCustomFieldValue(field("PHONE"), "+0012345", "LEAD")).toBeNull();
  });
});
