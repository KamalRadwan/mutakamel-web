import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { CrmErrorBag } from "./crm-form-validation";

describe.each([ar, en])("phone field validation", (dictionary) => {
  const messages = { ...dictionary.crmLeads.create.errors, url: dictionary.crmShared.fieldUrl };

  it.each(["abc", "1", "+", "1234", "001234"])("rejects %s with localized feedback", (value) => {
    const bag = new CrmErrorBag(messages);
    bag.phones("phones", [value]);
    expect(bag.errors).toEqual({ "phones.0": messages.phone });
  });

  it("accepts five normalized digits and skips optional blank rows", () => {
    const bag = new CrmErrorBag(messages);
    bag.phones("phones", ["", "   ", "12345", "+54 321", "0098765"]);
    expect(bag.errors).toEqual({});
  });

  it("retains normalized duplicate detection and length-error precedence", () => {
    const bag = new CrmErrorBag(messages);
    bag.phones("phones", ["0012345", "+12345", "x".repeat(33)]);
    expect(bag.errors["phones.1"]).toBe(messages.duplicatePhone);
    expect(bag.errors["phones.2"]).toContain("32");
  });
});
