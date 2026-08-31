import { describe, expect, it } from "vitest";
import {
  countryFromBrowserTimezone,
  deriveTenantCode,
  findCountry,
  getAllTimezones,
  getCountryOptions,
  splitPhoneNumber,
} from "./country-data";

describe("country registry", () => {
  it("exposes flag, calling code and zones for a known country", () => {
    const egypt = findCountry("eg");

    expect(egypt).toMatchObject({
      isoCode: "EG",
      name: "Egypt",
      callingCode: "+20",
    });
    expect(egypt?.flag).not.toBe("");
    expect(egypt?.timezones).toContain("Africa/Cairo");
  });

  it("lists every country with a usable calling code", () => {
    const countries = getCountryOptions();

    expect(countries.length).toBeGreaterThan(200);
    expect(
      countries.every((country) => /^\+[1-9]\d{0,3}$/u.test(country.callingCode)),
    ).toBe(true);
    expect(countries.every((country) => /^[A-Z]{2}$/u.test(country.isoCode))).toBe(
      true,
    );
  });

  it("offers every zone, not just one country's", () => {
    const zones = getAllTimezones();

    expect(zones.length).toBeGreaterThan(400);
    expect(zones).toContain("Africa/Cairo");
    expect(zones).toContain("America/New_York");
    // Sorted and de-duplicated.
    expect([...new Set(zones)]).toHaveLength(zones.length);
  });
});

describe("countryFromBrowserTimezone", () => {
  it("resolves a zone to its country", () => {
    expect(countryFromBrowserTimezone("Africa/Cairo")).toBe("EG");
  });

  it("is case insensitive", () => {
    expect(countryFromBrowserTimezone("africa/cairo")).toBe("EG");
  });

  it.each([
    ["an unknown zone", "Mars/Olympus"],
    ["empty", ""],
    ["whitespace", "   "],
  ])("returns null for %s rather than guessing", (_label, zone) => {
    expect(countryFromBrowserTimezone(zone)).toBeNull();
  });

  it("falls back to the runtime zone when no argument is given", () => {
    // The default parameter resolves the host timezone, so an omitted
    // argument must not be treated as "no zone".
    const resolved = countryFromBrowserTimezone();

    expect(resolved === null || /^[A-Z]{2}$/u.test(resolved)).toBe(true);
  });
});

describe("splitPhoneNumber", () => {
  it("splits the documented Egyptian example", () => {
    expect(splitPhoneNumber("+20 105 0049 899")).toEqual({
      callingCode: "+20",
      nationalNumber: "1050049899",
    });
  });

  it("accepts the 00 international prefix", () => {
    expect(splitPhoneNumber("0020 1050049899")).toEqual({
      callingCode: "+20",
      nationalNumber: "1050049899",
    });
  });

  it("treats a NANP territory as +1 with the area code kept national", () => {
    // The Bahamas is country code +1, area 242 -- the registry stores it as
    // "+1-242". Both forms dial identically once rejoined.
    expect(splitPhoneNumber("+1242 3211234")).toEqual({
      callingCode: "+1",
      nationalNumber: "2423211234",
    });
    expect(splitPhoneNumber("+1 4155550123")).toEqual({
      callingCode: "+1",
      nationalNumber: "4155550123",
    });
  });

  it("has a prefix-free code set, so the longest match is unambiguous", () => {
    const codes = new Set(
      getCountryOptions().map((country) => country.callingCode.slice(1)),
    );
    const ambiguous = [...codes].filter(
      (code) => code.length > 1 && codes.has(code.slice(0, -1)),
    );

    expect(ambiguous).toEqual([]);
  });

  it("keeps a national number national when no international prefix is given", () => {
    // Guessing a country here would silently rewrite the number.
    expect(splitPhoneNumber("01050049899")).toEqual({
      callingCode: "",
      nationalNumber: "01050049899",
    });
  });

  it("strips punctuation and spacing", () => {
    expect(splitPhoneNumber("+44 (0) 20-7946.0958")).toEqual({
      callingCode: "+44",
      nationalNumber: "02079460958",
    });
  });

  it.each([["empty", ""], ["blank", "   "], ["no digits", "+"]])(
    "returns null for %s",
    (_label, raw) => {
      expect(splitPhoneNumber(raw)).toBeNull();
    },
  );
});

describe("deriveTenantCode", () => {
  it.each([
    ["Wallet Test LLC", "wallet-test-llc"],
    ["  Acme   Retail  ", "acme-retail"],
    ["Café & Co.", "cafe-co"],
    ["ACME", "acme"],
    ["شركة الاختبار", ""],
  ])("derives %s -> %s", (input, expected) => {
    expect(deriveTenantCode(input)).toBe(expected);
  });

  it("never produces a leading or trailing hyphen", () => {
    expect(deriveTenantCode("--Acme--")).toBe("acme");
    expect(deriveTenantCode("!!!")).toBe("");
  });

  it("stays inside the 63-character hostname label limit", () => {
    const code = deriveTenantCode("a".repeat(80));

    expect(code).toHaveLength(63);
    expect(code.endsWith("-")).toBe(false);
  });

  it("produces only hostname-safe characters, never an underscore", () => {
    const code = deriveTenantCode("Wallet_Test Co");

    expect(code).toBe("wallet-test-co");
    expect(code).toMatch(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u);
  });
});
