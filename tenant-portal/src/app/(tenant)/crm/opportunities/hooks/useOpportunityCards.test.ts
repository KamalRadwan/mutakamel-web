import { describe, expect, it } from "vitest";
import { parseOpportunityCardsResponse } from "./useOpportunityCards";

const pipelineId = "01900100-0000-7000-8000-000000000100";
const stageId = "01900100-0000-7000-8000-000000000101";

function opportunityTags(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `01900100-0000-7000-8000-${index.toString(16).padStart(12, "0")}`,
    name: `Tag ${index + 1}`,
  }));
}

const card = {
  id: "01900100-0000-7000-8000-000000000110",
  title: "Renew annual subscription",
  stageId,
  stageFlag: "PROPOSAL",
  status: "IN_PROGRESS",
  customerPartyId: "01900100-0000-7000-8000-000000000124",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerEmail: "sales@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: {
    partyId: "01900100-0000-7000-8000-000000000122",
    displayName: "Mona Ibrahim",
    jobTitle: "Procurement Director",
    isPrimary: true,
    email: "mona@acme.example",
    phones: ["+201111111111"],
  },
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  ownerUserId: "01900100-0000-7000-8000-000000000121",
  ownerDisplayName: "Sara Sales",
  ownerAvatarUrl: "/api/tenant/core/v1/directory/parties/01900100-0000-7000-8000-000000000120/image?v=1",
  importance: 3,
  amount: "150000.00",
  currencyCode: "EGP",
  expectedCloseDate: "2026-10-31",
  probabilityPercent: 65,
  openActivityCount: 2,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  activityState: "FUTURE",
  tags: [{ id: "01900100-0000-7000-8000-000000000123", name: "VIP", color: null }],
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

  it("rejects an invalid rich card projection", () => {
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

  it("keeps exact commercial values and rejects malformed ones", () => {
    const parsed = parseOpportunityCardsResponse(
      {
        pipeline: { id: pipelineId, stages: [] },
        totalCount: 1,
        items: [card],
        pageInfo: { limit: 50, hasMore: false, nextCursor: null },
      },
      pipelineId,
    );

    expect(parsed.items[0]).toMatchObject({
      stageFlag: "PROPOSAL",
      amount: "150000.00",
      currencyCode: "EGP",
      expectedCloseDate: "2026-10-31",
      probabilityPercent: 65,
    });
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: pipelineId, stages: [] },
          totalCount: 1,
          items: [{ ...card, amount: 150000 }],
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
    expect(() =>
      parseOpportunityCardsResponse(
        {
          pipeline: { id: pipelineId, stages: [] },
          totalCount: 1,
          items: [{ ...card, probabilityPercent: 101 }],
          pageInfo: { limit: 50, hasMore: false, nextCursor: null },
        },
        pipelineId,
      ),
    ).toThrow("Invalid opportunity cards response.");
  });

  it("accepts more than one attach batch of tags up to the 500-tag catalogue limit", () => {
    const response = (tags: ReturnType<typeof opportunityTags>) => ({
      pipeline: { id: pipelineId, stages: [] },
      totalCount: 1,
      items: [{ ...card, tags }],
      pageInfo: { limit: 50, hasMore: false, nextCursor: null },
    });

    expect(
      parseOpportunityCardsResponse(response(opportunityTags(51)), pipelineId)
        .items[0]?.tags,
    ).toHaveLength(51);
    expect(
      parseOpportunityCardsResponse(response(opportunityTags(500)), pipelineId)
        .items[0]?.tags,
    ).toHaveLength(500);
    expect(() =>
      parseOpportunityCardsResponse(response(opportunityTags(501)), pipelineId),
    ).toThrow("Invalid opportunity cards response.");
  });

  it("requires the status and customer party supplied by the card endpoint", () => {
    const response = (item: unknown) => ({
      pipeline: { id: pipelineId, stages: [] },
      totalCount: 1,
      items: [item],
      pageInfo: { limit: 50, hasMore: false, nextCursor: null },
    });

    expect(() =>
      parseOpportunityCardsResponse(response({ ...card, status: "DRAFT" }), pipelineId),
    ).toThrow("Invalid opportunity cards response.");
    expect(() =>
      parseOpportunityCardsResponse(response({ ...card, customerPartyId: null }), pipelineId),
    ).toThrow("Invalid opportunity cards response.");
    expect(
      parseOpportunityCardsResponse(response({ ...card, stageFlag: null }), pipelineId).items[0]
        .stageFlag,
    ).toBeNull();
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
