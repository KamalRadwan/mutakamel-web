import { describe, expect, it } from "vitest";
import { parseOpportunitiesListResponse } from "./useOpportunitiesList";

const branchId = "01900100-0000-7000-8000-000000000099";

const item = {
  id: "01900100-0000-7000-8000-000000000110",
  branchId,
  customerProfileId: "01900100-0000-7000-8000-000000000112",
  pipelineId: "01900100-0000-7000-8000-000000000100",
  stageId: "01900100-0000-7000-8000-000000000101",
  stageFlag: "QUALIFICATION",
  status: "IN_PROGRESS",
  title: "Annual renewal",
  importance: 2,
  ownerUserId: "01900100-0000-7000-8000-000000000120",
  expectedCloseDate: "2026-09-01",
  createdAt: "2026-08-25T10:00:00.000Z",
};

describe("Opportunities list API contract", () => {
  it("reads the flat CRM page shape", () => {
    // crm-app's paginatedReadModels returns these fields at the TOP level.
    // This test used to wrap them in `meta` — Core's shape, not CRM's — so it
    // passed while the parser threw on every real response.
    const parsed = parseOpportunitiesListResponse(
      { items: [item], page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      branchId,
    );

    expect(parsed.items).toEqual([item]);
    expect(parsed.pageInfo).toEqual({ page: 1, limit: 25, total: 1 });
  });

  it("rejects a Core-shaped {items, meta} payload", () => {
    // The regression guard. If this ever parses again, the parser has drifted
    // back onto Core's envelope and every CRM list is one refactor from
    // throwing on real data.
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [item], meta: { page: 1, limit: 25, total: 1 } },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("rejects an item from a different branch", () => {
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [{ ...item, branchId: "01900100-0000-7000-8000-000000000098" }], page: 1, limit: 25, total: 1 },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("rejects a null ownerUserId that isn't actually null", () => {
    expect(() =>
      parseOpportunitiesListResponse(
        { items: [{ ...item, ownerUserId: "not-a-uuid" }], page: 1, limit: 25, total: 1 },
        branchId,
      ),
    ).toThrow("Invalid opportunities response.");
  });

  it("accepts a null owner and rejects the old {data} envelope", () => {
    expect(
      parseOpportunitiesListResponse(
        { items: [{ ...item, ownerUserId: null }], page: 1, limit: 25, total: 1 },
        branchId,
      ).items[0].ownerUserId,
    ).toBeNull();
    expect(() =>
      parseOpportunitiesListResponse({ success: true, data: { items: [item] } }, branchId),
    ).toThrow("Invalid opportunities response.");
  });
});
