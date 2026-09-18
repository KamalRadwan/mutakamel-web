import { describe, expect, it } from "vitest";
import {
  buildOpportunityCardPatchBody,
  parseOpportunityCardColor,
  parseOpportunityCardPatchResponse,
} from "./opportunity-card-contract";

const ID = "01900100-0000-7000-8000-000000000001";

describe("opportunity card contract", () => {
  it("builds a bounded partial patch and preserves an explicit colour clear", () => {
    expect(buildOpportunityCardPatchBody({ importance: 2 })).toEqual({ importance: 2 });
    expect(buildOpportunityCardPatchBody({ cardColor: "TEAL" })).toEqual({
      cardColor: "TEAL",
    });
    expect(buildOpportunityCardPatchBody({ cardColor: null })).toEqual({ cardColor: null });
    expect(() => buildOpportunityCardPatchBody({ importance: 4 })).toThrow(
      "Invalid opportunity response.",
    );
  });

  it("reads only confirmed card fields from the narrow PATCH response", () => {
    expect(
      parseOpportunityCardPatchResponse(
        { id: ID, importance: 3, cardColor: "PINK", title: "Narrow entity" },
        ID,
        { importance: 1, cardColor: "TEAL" },
        { cardColor: "PINK" },
      ),
    ).toEqual({ importance: 1, cardColor: "PINK" });

    expect(
      parseOpportunityCardPatchResponse(
        { id: ID, importance: 3, cardColor: "PINK" },
        ID,
        { importance: 1, cardColor: "TEAL" },
        { importance: 3 },
      ),
    ).toEqual({ importance: 3, cardColor: "TEAL" });
  });

  it("rejects unknown filing colours and a receipt for another opportunity", () => {
    expect(() => parseOpportunityCardColor("MAUVE")).toThrow(
      "Invalid opportunity response.",
    );
    expect(() =>
      parseOpportunityCardPatchResponse(
        { id: "01900100-0000-7000-8000-000000000002", cardColor: "TEAL" },
        ID,
        { importance: 1, cardColor: null },
        { cardColor: "TEAL" },
      ),
    ).toThrow("Invalid opportunity response.");
    expect(() =>
      parseOpportunityCardPatchResponse(
        { id: ID, importance: 1 },
        ID,
        { importance: 1, cardColor: null },
        { cardColor: "TEAL" },
      ),
    ).toThrow("Invalid opportunity response.");
  });
});
