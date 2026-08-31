import { describe, expect, it } from "vitest";
import { parseOpportunityCardsResponse } from "./useOpportunityCards";

const pipelineId = "01900100-0000-7000-8000-000000000100";
const stageId = "01900100-0000-7000-8000-000000000101";

const card = {
  id: "01900100-0000-7000-8000-000000000110",
  title: "Renew annual subscription",
  stageId,
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  leadSourceName: "Website",
  ownerDisplayName: "Sara Sales",
  ownerAvatarUrl: "/api/tenant/core/v1/directory/parties/01900100-0000-7000-8000-000000000120/image?v=1",
  importance: 3,
  openActivityCount: 2,
};

describe("Opportunity cards API contract", () => {
  it("parses the canonical purpose-built card projection", () => {
    const parsed = parseOpportunityCardsResponse(
      {
        pipeline: { id: pipelineId, stages: [] },
        selectedStageId: null,
        totalCount: 143,
        items: [card],
        pageInfo: { limit: 50, hasMore: true, nextCursor: "opaque-cursor" },
      },
      pipelineId,
    );

    expect(parsed.items).toEqual([card]);
    expect(parsed.totalCount).toBe(143);
    expect(parsed.pageInfo).toEqual({ limit: 50, hasMore: true, nextCursor: "opaque-cursor" });
  });

  it("rejects a card without the required amount-free projection fields", () => {
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: pipelineId, stages: [] },
          totalCount: 1,
          items: [{ ...card, customerProfileType: "GOVERNMENT" }],
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
  });

  it("rejects a response for the wrong pipeline", () => {
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: "01900100-0000-7000-8000-000000000999", stages: [] },
          totalCount: 1,
          items: [card],
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
  });

  it("rejects hasMore/nextCursor disagreement and duplicate ids", () => {
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: pipelineId, stages: [] },
          totalCount: 1,
          items: [card],
          pageInfo: { limit: 50, hasMore: true, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: pipelineId, stages: [] },
          totalCount: 2,
          items: [card, card],
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
  });
});
