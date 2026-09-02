import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "@/design-system";
import { routeTitleKey } from "./route-title";

function hrefFor(id: string): string {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.id === id) return item.href;
    }
  }
  throw new Error(`No nav item ${id}`);
}

describe("routeTitleKey", () => {
  it("names every navigable route, so no two tabs read alike", () => {
    // The defect this closes: all 132 routes shared one metadata block, so
    // every tab in a user's window carried the same title.
    const unnamed = NAV_SECTIONS.flatMap((section) =>
      section.items.filter((item) => routeTitleKey(item.href) === null),
    );
    expect(unnamed.map((item) => item.href)).toEqual([]);
  });

  it("gives a detail route its list's title", () => {
    const leads = hrefFor("leads");
    expect(routeTitleKey(`${leads}/0198c4a2-7f31-7c2e-9b40-1d5f8e2a6c11`)).toBe(
      routeTitleKey(leads),
    );
  });

  it("prefers the longest matching prefix", () => {
    // Nested routes exist under a shared parent — /crm/dashboards and
    // /crm/dashboards/reports both being nav entries is the shape that breaks
    // a first-match-wins lookup.
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        expect(routeTitleKey(item.href)).toBe(item.labelKey);
      }
    }
  });

  it("returns null for a route no nav entry owns", () => {
    expect(routeTitleKey("/login")).toBeNull();
    expect(routeTitleKey("/not-a-real-screen")).toBeNull();
  });

  it("does not let the root entry claim every path", () => {
    // "/" is a nav href; a naive startsWith would make it match everything and
    // every unknown route would inherit the workspace title.
    expect(routeTitleKey("/")).not.toBeNull();
    expect(routeTitleKey("/definitely-not-a-route")).toBeNull();
  });
});
