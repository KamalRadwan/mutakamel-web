import { describe, expect, it } from "vitest";
import { getCountryOptions, splitPhoneNumber } from "./country-data";

describe("splitPhoneNumber", () => {
  it("splits a pasted international number into its two parts", () => {
    expect(splitPhoneNumber("+20 105 0049 899")).toEqual({
      callingCode: "+20",
      nationalNumber: "1050049899",
    });
  });

  it("takes the longest matching code, because codes are not prefix-free", () => {
    // +1 and +1721 both exist — the one collision in the table. Matching the
    // shortest would file every Sint Maarten number under North America.
    expect(splitPhoneNumber("+1721 555 0123")?.callingCode).toBe("+1721");
    expect(splitPhoneNumber("+1 415 555 0123")?.callingCode).toBe("+1");
  });

  it("reads 00 as an international prefix, the way a dialled number carries it", () => {
    expect(splitPhoneNumber("00201050049899")).toEqual({
      callingCode: "+20",
      nationalNumber: "1050049899",
    });
  });

  it("never guesses a code for a number that carries no prefix", () => {
    // Guessing here would silently rewrite a national number into another
    // country's.
    expect(splitPhoneNumber("01050049899")).toEqual({
      callingCode: "",
      nationalNumber: "01050049899",
    });
  });

  it("leaves an unassigned code as national digits rather than inventing one", () => {
    expect(splitPhoneNumber("+999123")).toEqual({ callingCode: "", nationalNumber: "999123" });
  });

  it("has nothing to split in blank or letter-only input", () => {
    expect(splitPhoneNumber("   ")).toBeNull();
    expect(splitPhoneNumber("call me")).toBeNull();
  });
});

describe("getCountryOptions", () => {
  const egypt = (lang: "ar" | "en") =>
    getCountryOptions(lang).find((country) => country.isoCode === "EG");

  it("names each country in the reader's own language", () => {
    expect(egypt("ar")?.name).toBe("مصر");
    expect(egypt("en")?.name).toBe("Egypt");
  });

  it("carries the calling code with its plus, and a flag built from the ISO pair", () => {
    expect(egypt("en")?.callingCode).toBe("+20");
    expect(egypt("en")?.flag).toBe("🇪🇬");
  });

  it("sorts by the localized name, so the order follows the language", () => {
    const arabic = getCountryOptions("ar").map((country) => country.name);
    expect([...arabic].sort((a, b) => a.localeCompare(b, "ar-EG-u-nu-latn"))).toEqual(arabic);
  });

  it("gives every entry a plus-prefixed code of one to four digits", () => {
    for (const country of getCountryOptions("en")) {
      expect(country.callingCode).toMatch(/^\+[1-9]\d{0,3}$/u);
    }
  });

  it("builds each language once, since a picker asks on every keystroke", () => {
    expect(getCountryOptions("en")).toBe(getCountryOptions("en"));
  });
});
