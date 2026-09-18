import { describe, expect, it } from "vitest";
import { parseOpportunityDocumentCounts } from "./opportunity-document-counts-contract";

const PARTY = "01900100-0000-7000-8000-000000000001";
const OTHER = "01900100-0000-7000-8000-000000000002";

describe("Opportunity trade count contract", () => {
  it("parses one bounded count for every requested customer party", () => {
    expect(
      parseOpportunityDocumentCounts(
        { data: { items: [{ partyId: PARTY, count: 2 }, { partyId: OTHER, count: 0 }] } },
        [PARTY, OTHER],
      ),
    ).toEqual(new Map([[PARTY, 2], [OTHER, 0]]));
  });

  it("rejects missing, duplicate, negative, and unrequested rows", () => {
    expect(() => parseOpportunityDocumentCounts({ items: [] }, [PARTY])).toThrow();
    expect(() =>
      parseOpportunityDocumentCounts(
        { items: [{ partyId: PARTY, count: 1 }, { partyId: PARTY, count: 2 }] },
        [PARTY],
      ),
    ).toThrow();
    expect(() =>
      parseOpportunityDocumentCounts({ items: [{ partyId: PARTY, count: -1 }] }, [PARTY]),
    ).toThrow();
    expect(() =>
      parseOpportunityDocumentCounts({ items: [{ partyId: OTHER, count: 1 }] }, [PARTY]),
    ).toThrow();
  });
});
