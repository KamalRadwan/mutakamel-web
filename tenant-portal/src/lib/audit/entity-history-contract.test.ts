import { describe, expect, it } from "vitest";
import { entityHistoryQuery, parseEntityHistory } from "./entity-history-contract";

describe("combined history contract", () => {
  it("uses the existing route query with a deduplicated, sorted related subject set and optional historyCategory", () => {
    expect(entityHistoryQuery(null, 10, ["b", "a", "b"])).toBe("limit=10&relatedPartyIds=a%2Cb");
    expect(entityHistoryQuery(null, 10, ["b", "a"], "quotation")).toBe(
      "limit=10&relatedPartyIds=a%2Cb&historyCategory=quotation",
    );
    expect(entityHistoryQuery(null, 10, undefined, "quotation")).toBe("limit=10");
    expect(entityHistoryQuery(null, 10)).toBe("limit=10");
    expect(entityHistoryQuery("a+/=", 10)).toBe("limit=10&cursor=a%2B%2F%3D");
  });

  it("uses grouped pagination totals and preserves all changes in a multi-contact request", () => {
    const diff = Array.from({ length: 25 }, (_, i) => ({
      field: "phone",
      before: "old",
      after: "new",
      subjectId: String(i),
      subjectLabel: `Contact ${i}`,
    }));
    const items = [{ id: "event", action: "UPDATE", createdAt: "2026-09-07", diff }];
    const result = parseEntityHistory({ items, nextCursor: null });
    expect(result.nextCursor).toBeNull();
    expect(result.events[0].changes).toEqual(diff);
    expect(parseEntityHistory({ items, nextCursor: "next" }).nextCursor).toBe("next");
    expect(() => parseEntityHistory({ items })).toThrow();
  });

  it("parses subjectKind, subjectId, and referenceLabel from both grouped related rows and standalone entity rows", () => {
    const grouped = parseEntityHistory({
      items: [
        {
          id: "g1",
          action: "QUOTATION_CREATED",
          createdAt: "2026-09-08T10:00:00Z",
          subjectKind: "quotation",
          subjectId: "01900100-0000-7000-8000-000000000010",
          referenceLabel: "QT-2026-0018",
          diff: [],
        },
        {
          id: "s1",
          action: "CREATE",
          entityType: "TradeSalesInvoiceEntity",
          entityId: "01900100-0000-7000-8000-000000000020",
          entityLabel: "INV-2026-0042",
          createdAt: "2026-09-08T11:00:00Z",
          diff: [],
        },
      ],
      nextCursor: null,
    });
    expect(grouped.events[0]).toMatchObject({
      subjectKind: "quotation",
      subjectId: "01900100-0000-7000-8000-000000000010",
      referenceLabel: "QT-2026-0018",
    });
    expect(grouped.events[1]).toMatchObject({
      subjectKind: "invoice",
      subjectId: "01900100-0000-7000-8000-000000000020",
      referenceLabel: "INV-2026-0042",
    });
  });
});
