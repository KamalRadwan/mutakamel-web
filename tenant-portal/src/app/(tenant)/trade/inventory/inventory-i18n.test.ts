import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const inventoryRoot = dirname(fileURLToPath(import.meta.url));

function screenFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return screenFiles(path);
    return path.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(path) ? [path] : [];
  });
}

describe("inventory translations", () => {
  it("keeps Arabic and English keys and interpolation tokens in parity", () => {
    const arabicCopy = leaves(ar.tradeInventory);
    const englishCopy = leaves(en.tradeInventory);
    expect(Object.keys(arabicCopy).sort()).toEqual(Object.keys(englishCopy).sort());
    for (const [key, arabic] of Object.entries(arabicCopy)) {
      const english = englishCopy[key];
      expect(arabic.trim(), `ar.tradeInventory.${key}`).not.toBe("");
      expect(english.trim(), `en.tradeInventory.${key}`).not.toBe("");
      expect((arabic.match(/\{\w+\}/g) ?? []).sort(), key)
        .toEqual((english.match(/\{\w+\}/g) ?? []).sort());
    }
  });

  it("keeps inventory screens free of isAr string branches and hard-coded revision labels", () => {
    for (const path of screenFiles(inventoryRoot)) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/\bisAr\b/);
      expect(source, path).not.toContain("Rev #");
      for (const match of source.matchAll(/t\.tradeInventory\.(\w+)/g)) {
        expect(ar.tradeInventory, path).toHaveProperty(match[1]);
        expect(en.tradeInventory, path).toHaveProperty(match[1]);
      }
    }
  });
});

function leaves(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") return [[path, entry]];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) return Object.entries(leaves(entry as Record<string, unknown>, path));
    throw new Error(`Invalid inventory copy at ${path}`);
  }));
}
