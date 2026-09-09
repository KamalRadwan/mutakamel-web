import { describe, expect, it } from "vitest";
import { entityHistoryQuery, parseEntityHistory } from "./entity-history-contract";

describe("combined history contract", () => {
  it("uses the existing route query with a deduplicated, sorted related subject set", () => {
    expect(entityHistoryQuery(1, 10, ["b", "a", "b"])).toBe("page=1&limit=10&relatedPartyIds=a%2Cb");
    expect(entityHistoryQuery(1, 10)).toBe("page=1&limit=10");
  });
  it("uses grouped pagination totals and preserves all changes in a multi-contact request", () => {
    const diff = Array.from({ length: 25 }, (_, i) => ({ field: "phone", before: "old", after: "new",
      subjectId: String(i), subjectLabel: `Contact ${i}` }));
    const items = [{ id: "event", action: "UPDATE", createdAt: "2026-09-07", diff }];
    const result = parseEntityHistory({ items, page: 1, totalPages: 1 }, undefined, 1);
    expect(result.hasNext).toBe(false);
    expect(result.events[0].changes).toEqual(diff);
    expect(parseEntityHistory({ items, page: 1, totalPages: 2 }, undefined, 1).hasNext).toBe(true);
  });
});
