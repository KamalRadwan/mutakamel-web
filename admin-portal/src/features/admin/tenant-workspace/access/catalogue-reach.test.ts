import { describe, expect, it } from "vitest";

import { catalogueReach, catalogueSearchQuery } from "./catalogue-reach";

/**
 * UI-019. The access selectors loaded one page — roles and branches at 50,
 * departments and teams at 100 — and offered no search and no next page. Once a
 * tenant grew past those counts an administrator could not choose a later-page
 * record at all, and nothing on screen said the list was a subset.
 */
describe("catalogue reach", () => {
  it("says a page is a subset when the catalogue is larger", () => {
    expect(catalogueReach({ items: [1, 2], total: 90 })).toEqual({
      shown: 2,
      total: 90,
      truncated: true,
    });
  });

  it("says nothing when the page is the whole catalogue", () => {
    expect(catalogueReach({ items: [1, 2], total: 2 }).truncated).toBe(
      false,
    );
  });

  it("does not claim a truncation it cannot see", () => {
    // No total reported: assume what is shown is what there is, rather than
    // implying a larger catalogue nobody reported. `PageResult` puts `total` at
    // the top level, so reading a nested `meta.total` would land here always.
    expect(catalogueReach({ items: [1] })).toEqual({
      shown: 1,
      total: 1,
      truncated: false,
    });
    expect(catalogueReach(null).truncated).toBe(false);
  });
});

describe("catalogue search query", () => {
  it("always asks for the first page, because a search is a new question", () => {
    expect(catalogueSearchQuery("acme", 50)).toEqual({
      q: "acme",
      page: 1,
      limit: 50,
    });
  });

  it("drops an empty term rather than asking the server to match nothing", () => {
    expect(catalogueSearchQuery("   ", 50)).toEqual({ page: 1, limit: 50 });
  });

  it("keeps the scope a nested catalogue is read within", () => {
    expect(catalogueSearchQuery("ops", 100, { branchId: "branch-1" })).toEqual({
      branchId: "branch-1",
      q: "ops",
      page: 1,
      limit: 100,
    });
  });
});
