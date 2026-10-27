import { describe, expect, it } from "vitest";
import { entityHistoryQuery, parseEntityHistory } from "./entity-history-contract";

describe("combined history contract", () => {
  it("uses the existing route query with a deduplicated, sorted related subject set", () => {
    expect(entityHistoryQuery(null, 10, ["b", "a", "b"])).toBe("limit=10&relatedPartyIds=a%2Cb");
    expect(entityHistoryQuery(null, 10)).toBe("limit=10");
    expect(entityHistoryQuery("a+/=", 10)).toBe("limit=10&cursor=a%2B%2F%3D");
  });
  it("uses grouped pagination totals and preserves all changes in a multi-contact request", () => {
    const diff = Array.from({ length: 25 }, (_, i) => ({ field: "phone", before: "old", after: "new",
      subjectId: String(i), subjectLabel: `Contact ${i}` }));
    const items = [{ id: "event", action: "UPDATE", createdAt: "2026-09-07", diff }];
    const result = parseEntityHistory({ items, nextCursor: null });
    expect(result.nextCursor).toBeNull();
    expect(result.events[0].changes).toEqual(diff);
    expect(parseEntityHistory({ items, nextCursor: "next" }).nextCursor).toBe("next");
    expect(() => parseEntityHistory({ items })).toThrow();
  });
});
