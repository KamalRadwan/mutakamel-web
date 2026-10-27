import { describe, expect, it } from "vitest";
import { formatStorageBytes, isStorageByteLimit } from "./storage-byte-capacity";

describe("storage byte capacity", () => {
  it.each(["", "1", "9007199254740993", "9223372036854775807"])("accepts %s", (value) => {
    expect(isStorageByteLimit(value)).toBe(true);
  });

  it.each(["0", "-1", "+1", "01", "1.0", "1e3", " 1", "1 ", "9223372036854775808", "9999999999999999999", "10000000000000000000"])("rejects %s", (value) => {
    expect(isStorageByteLimit(value)).toBe(false);
  });

  it("formats large integers without rounding in either language", () => {
    expect(formatStorageBytes("9007199254740993", "en")).toBe("9,007,199,254,740,993");
    expect(formatStorageBytes("9007199254740993", "ar")).toBe("٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩٣");
  });
});
