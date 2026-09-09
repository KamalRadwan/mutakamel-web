import { describe, expect, it } from "vitest";
import {
  buildLeadCompanyFieldRequest,
  buildLeadCompanyPhonesRequest,
  type LeadCompanyField,
} from "./lead-write-contract";

/** The four the DTO types `string | null`, i.e. everything but `companyName`. */
const NULLABLE_COMPANY_FIELDS: LeadCompanyField[] = [
  "companyEmail",
  "companyWebsite",
  "taxNumber",
  "commercialRegistrationNumber",
];

describe("lead company card, one field at a time", () => {
  it("sends the touched field and nothing else", () => {
    expect(buildLeadCompanyFieldRequest("companyName", "Acme Group")).toEqual({
      companyName: "Acme Group",
    });
    expect(buildLeadCompanyFieldRequest("companyEmail", "info@acme.test")).toEqual({
      companyEmail: "info@acme.test",
    });
    expect(
      buildLeadCompanyFieldRequest("companyWebsite", "https://acme.test"),
    ).toEqual({ companyWebsite: "https://acme.test" });
    expect(buildLeadCompanyFieldRequest("taxNumber", "100-200-300")).toEqual({
      taxNumber: "100-200-300",
    });
    expect(
      buildLeadCompanyFieldRequest("commercialRegistrationNumber", "CR-99887"),
    ).toEqual({ commercialRegistrationNumber: "CR-99887" });
  });

  it("trims what the user typed", () => {
    expect(buildLeadCompanyFieldRequest("taxNumber", "  100-200-300  ")).toEqual({
      taxNumber: "100-200-300",
    });
    expect(buildLeadCompanyFieldRequest("companyName", "  Acme Group  ")).toEqual({
      companyName: "Acme Group",
    });
  });

  it("clears each nullable field with an explicit null", () => {
    // `undefined` would mean "leave it alone" on a PATCH, so the user would
    // empty the box, save, and watch the old value come back.
    for (const field of NULLABLE_COMPANY_FIELDS) {
      expect(buildLeadCompanyFieldRequest(field, "")).toEqual({ [field]: null });
      expect(buildLeadCompanyFieldRequest(field, "   ")).toEqual({ [field]: null });
    }
  });

  it("refuses to clear companyName, which has no null form on the DTO", () => {
    // An empty request rather than a throw: the caller skips the PATCH the same
    // way it does for any other "nothing to send", and telling the user the box
    // is required stays the form's own validation.
    expect(buildLeadCompanyFieldRequest("companyName", "")).toEqual({});
    expect(buildLeadCompanyFieldRequest("companyName", "   ")).toEqual({});
    expect(buildLeadCompanyFieldRequest("companyName", "")).not.toHaveProperty(
      "companyName",
    );
  });

  it("does not send a companyEmail that @IsEmail() would 400 on", () => {
    expect(buildLeadCompanyFieldRequest("companyEmail", "acme.test")).toEqual({});
    expect(buildLeadCompanyFieldRequest("companyEmail", "info@acme")).toEqual({});
    expect(buildLeadCompanyFieldRequest("companyEmail", "info @acme.test")).toEqual({});
    // Clearing is not malformed — an empty box is still a real edit.
    expect(buildLeadCompanyFieldRequest("companyEmail", "")).toEqual({
      companyEmail: null,
    });
    // And the shape check is the loose one, so an address the server accepts is
    // never refused here.
    expect(buildLeadCompanyFieldRequest("companyEmail", " INFO+crm@acme.co.uk ")).toEqual({
      companyEmail: "INFO+crm@acme.co.uk",
    });
  });

  it("never sends a key the caller did not name", () => {
    const payload = buildLeadCompanyFieldRequest("companyWebsite", "https://acme.test");
    expect(Object.keys(payload)).toEqual(["companyWebsite"]);
    expect(payload).not.toHaveProperty("companyName");
    expect(payload).not.toHaveProperty("stageId");
  });
});

describe("lead company phones payload", () => {
  it("sends the whole list, trimmed", () => {
    expect(
      buildLeadCompanyPhonesRequest(["  +201001112223 ", "+201009998887"]),
    ).toEqual({ companyPhones: ["+201001112223", "+201009998887"] });
  });

  it("drops the blank row the card keeps around for the next entry", () => {
    expect(buildLeadCompanyPhonesRequest(["+201001112223", "", "   "])).toEqual({
      companyPhones: ["+201001112223"],
    });
  });

  it("sends an empty array rather than omitting the key, which is how the last number goes", () => {
    expect(buildLeadCompanyPhonesRequest([])).toEqual({ companyPhones: [] });
    expect(buildLeadCompanyPhonesRequest(["  "])).toEqual({ companyPhones: [] });
  });

  it("caps at the server's ArrayMaxSize(10)", () => {
    const payload = buildLeadCompanyPhonesRequest(
      Array.from({ length: 14 }, (_, index) => `+20100111222${index}`),
    );
    expect(payload.companyPhones).toHaveLength(10);
    expect(payload.companyPhones?.[9]).toBe("+201001112229");
  });

  it("sends the number as typed rather than normalised", () => {
    // The server compares normalised values when it rejects a duplicate;
    // rewriting `00966…` here would hide which entry it objected to.
    expect(buildLeadCompanyPhonesRequest(["00966500000000"])).toEqual({
      companyPhones: ["00966500000000"],
    });
  });
});
