import { describe, expect, it } from "vitest";
import { formatLocaleNumber, localeForLanguage } from "./locale";

describe("Admin Portal locale policy", () => {
  it("uses the explicit DS-07 locales and their default numeral systems", () => {
    expect(localeForLanguage("ar")).toBe("ar-EG");
    expect(localeForLanguage("en")).toBe("en-US");
    expect(formatLocaleNumber("ar", 1234)).toBe("١٬٢٣٤");
    expect(formatLocaleNumber("en", 1234)).toBe("1,234");
  });
});
