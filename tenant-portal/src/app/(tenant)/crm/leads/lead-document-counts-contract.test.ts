import { describe, expect, it } from "vitest";
import { parsePartyDocumentCountsResponse } from "./lead-document-counts-contract";

const PARTY_A = "01900100-0000-7000-8000-000000000001";
const PARTY_B = "01900100-0000-7000-8000-000000000002";

describe("lead document counts contract", () => {
  it("unwraps the Trade envelope and keeps explicit zero counts", () => {
    expect([
      ...parsePartyDocumentCountsResponse(
        {
          success: true,
          data: {
            items: [
              { partyId: PARTY_A, count: 3 },
              { partyId: PARTY_B, count: 0 },
            ],
          },
        },
        [PARTY_A, PARTY_B],
      ),
    ]).toEqual([
      [PARTY_A, 3],
      [PARTY_B, 0],
    ]);
  });

  it("rejects partial responses so a missing count is never shown as zero", () => {
    expect(() =>
      parsePartyDocumentCountsResponse(
        { data: { items: [{ partyId: PARTY_A, count: 1 }] } },
        [PARTY_A, PARTY_B],
      ),
    ).toThrow("Invalid document counts response.");
  });
});
