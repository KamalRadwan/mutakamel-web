import { describe, expect, it } from "vitest";
import { parseLeadBoardResponse } from "./useLeadBoard";

const BRANCH_ID = "01900100-0000-7000-8000-000000000001";
const STAGE_ID = "01900100-0000-7000-8000-000000000002";

describe("Lead board response", () => {
  it("parses a lightweight stage lane without Card/Table contact details", () => {
    const lanes = parseLeadBoardResponse(
      {
        stages: [{
          stage: {
            id: STAGE_ID,
            nameAr: "جديد",
            nameEn: "New",
            flag: "NEW",
            sortOrder: 10,
          },
          items: [{
            id: "01900100-0000-7000-8000-000000000003",
            branchId: BRANCH_ID,
            partyId: "01900100-0000-7000-8000-000000000004",
            displayName: "Kamal Radwan",
            companyName: null,
            leadProfileType: "INDIVIDUAL",
            stageId: STAGE_ID,
            ownerUserId: null,
            rating: 0,
            cardColor: null,
            owner: null,
            nextActivity: null,
            primaryContactName: null,
            tags: [],
          }],
          total: 51,
          page: 1,
          limit: 50,
          totalPages: 2,
          hasNext: true,
          hasPrev: false,
        }],
      },
      BRANCH_ID,
      [STAGE_ID],
    );

    expect(lanes[STAGE_ID]).toMatchObject({ total: 51, page: 1, hasMore: true });
    expect(lanes[STAGE_ID]?.items[0]).toMatchObject({
      leadProfileType: "INDIVIDUAL",
      country: "",
      primaryContact: null,
      phones: [],
    });
  });
});
