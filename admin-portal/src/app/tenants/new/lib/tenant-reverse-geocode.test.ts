import { describe, expect, it } from "vitest";
import {
  parseCoordinate,
  readTenantReverseGeocodedAddress,
} from "./tenant-reverse-geocode";

describe("tenant reverse-geocode contract", () => {
  it("accepts bounded coordinates with at most seven decimal places", () => {
    expect(parseCoordinate("30.0444123", "latitude")).toBe(30.0444123);
    expect(parseCoordinate("-180", "longitude")).toBe(-180);
    expect(parseCoordinate("90.0000000", "latitude")).toBe(90);
  });

  it.each([
    ["", "latitude"],
    ["30.12345678", "latitude"],
    ["1e2", "longitude"],
    ["+30", "latitude"],
    ["091", "latitude"],
    ["90.1", "latitude"],
    ["180.1", "longitude"],
  ] as const)("rejects invalid coordinate %s", (raw, field) => {
    expect(() => parseCoordinate(raw, field)).toThrow();
  });

  it("allowlists the canonical editable address projection", () => {
    const suggestion = readTenantReverseGeocodedAddress({
      countryName: "Egypt",
      countryIsoCode: "EG",
      state: "Cairo",
      stateCode: "C",
      city: "Cairo",
      cityId: 31802,
      district: "Downtown",
      street1: "Tahrir Street",
      buildingNo: "10",
      postalCode: "11511",
      landmark: "Square",
      formattedAddress: "10 Tahrir Street, Cairo, Egypt",
    });
    expect(suggestion).toEqual({
      countryName: "Egypt",
      countryIsoCode: "EG",
      state: "Cairo",
      stateCode: "C",
      city: "Cairo",
      cityId: 31802,
      district: "Downtown",
      street1: "Tahrir Street",
      buildingNo: "10",
      postalCode: "11511",
      landmark: "Square",
      formattedAddress: "10 Tahrir Street, Cairo, Egypt",
    });
  });

  it.each([
    { countryName: "", countryIsoCode: "EG" },
    { countryName: "Egypt", countryIsoCode: "eg" },
    { countryName: "Egypt", countryIsoCode: "EG", cityId: 0 },
    { countryName: "Egypt", countryIsoCode: "EG", endpoint: "secret" },
    {
      countryName: "Egypt",
      countryIsoCode: "EG",
      formattedAddress: "x".repeat(501),
    },
  ])("rejects malformed or non-allowlisted projections", (payload) => {
    expect(() => readTenantReverseGeocodedAddress(payload)).toThrow(
      "INVALID_REVERSE_GEOCODE_RESPONSE",
    );
  });
});
