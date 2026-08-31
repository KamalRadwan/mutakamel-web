import { describe, expect, it } from "vitest";
import { ar } from "./ar";
import { en } from "./en";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.keys(value)
    .sort()
    .flatMap((key) =>
      collectKeyPaths((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key),
    );
}

describe("dictionary parity", () => {
  it("has the exact same set of key paths in ar and en", () => {
    const arKeys = collectKeyPaths(ar);
    const enKeys = collectKeyPaths(en);

    expect(enKeys.filter((key) => !arKeys.includes(key))).toEqual([]);
    expect(arKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});
