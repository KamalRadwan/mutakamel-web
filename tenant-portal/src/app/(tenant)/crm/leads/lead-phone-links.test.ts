import { describe, expect, it } from "vitest";
import { normalizePhoneDigits, normalizeWhatsAppDigits } from "./lead-phone-links";

describe("normalizeWhatsAppDigits", () => {
  it.each([
    ["050 123 4567", "SA", "966501234567"],
    ["050 123 4567", "Saudi Arabia", "966501234567"],
    ["010 5004 9899", "Egypt", "201050049899"],
    ["010 5004 9899", "مصر", "201050049899"],
    ["01050049899", " eg ", "201050049899"],
    ["1050049899", "EG", "201050049899"],
  ])("completes %s using %s", (phone, country, expected) => {
    expect(normalizeWhatsAppDigits(phone, country)).toBe(expected);
  });

  it.each(["+20 105 004 9899", "0020 105 004 9899"])(
    "preserves the explicit country code in %s",
    (phone) => {
      expect(normalizeWhatsAppDigits(phone, "SA")).toBe("201050049899");
      expect(normalizeWhatsAppDigits(phone)).toBe("201050049899");
    },
  );

  it("preserves a significant zero in an explicit international number", () => {
    expect(normalizeWhatsAppDigits("+39 06 6982", "EG")).toBe("39066982");
  });

  it.each([undefined, null, "", "Unknown country", "ZZ"])(
    "withholds chat digits for a local number with country %s",
    (country) => {
      expect(normalizeWhatsAppDigits("01050049899", country)).toBe("");
    },
  );

  it.each(["", "   ", "not a phone", "0", "+20", "+9991234567"])(
    "withholds chat digits for unusable input %s",
    (phone) => {
      expect(normalizeWhatsAppDigits(phone, "EG")).toBe("");
    },
  );
});

describe("normalizePhoneDigits", () => {
  it("keeps local dialing and normalizes an international prefix", () => {
    expect(normalizePhoneDigits("010 5004 9899")).toBe("01050049899");
    expect(normalizePhoneDigits("0020 105 004 9899")).toBe("+201050049899");
  });
});
