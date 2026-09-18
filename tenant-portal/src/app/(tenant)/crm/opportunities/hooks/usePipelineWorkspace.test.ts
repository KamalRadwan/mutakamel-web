import { describe, expect, it, vi } from "vitest";
import { formatCurrencyAmount, formatOpportunityAmountSummary } from "./pipeline-types";
import {
  buildStageMoveRequest,
  opportunityCapabilityAllowsOwner,
  parseOpportunityBoardResponse,
  parseOpportunityCapabilitiesResponse,
  parseOpportunityStagePageResponse,
  parsePipelinesResponse,
  reconcileOpportunityBoardAfterConfirmedCardPatch,
} from "./usePipelineWorkspace";

const pipelineId = "01900100-0000-7000-8000-000000000100";
const stageId = "01900100-0000-7000-8000-000000000101";

const pipeline = {
  id: pipelineId,
  code: "STD_SALES",
  nameAr: "المبيعات",
  nameEn: "Sales",
  isDefault: true,
  isActive: true,
  stages: [
    {
      id: stageId,
      pipelineId,
      opportunityStageId: "01900100-0000-7000-8000-000000000102",
      nameAr: "تأهيل",
      nameEn: "Qualification",
      flag: "QUALIFICATION",
      category: "IN_PROGRESS",
      rank: 1,
      isActive: true,
      isSystem: true,
    },
  ],
};

const opportunity = {
  id: "01900100-0000-7000-8000-000000000110",
  branchId: "01900100-0000-7000-8000-000000000111",
  customerProfileId: "01900100-0000-7000-8000-000000000112",
  pipelineId,
  stageId,
  stageFlag: "QUALIFICATION",
  status: "IN_PROGRESS",
  title: "Annual renewal",
  importance: 2,
  cardColor: "TEAL",
  amount: "9007199254740991.25",
  currencyCode: "EGP",
  probabilityPercent: 20,
  activityState: "TODAY",
  openActivityCount: 1,
  nextOpenActivityAt: "2026-09-18T09:00:00.000Z",
  customerProfileType: "CORPORATE",
  customerDisplayName: "Acme Trading",
  customerCompanyName: "Acme Trading LLC",
  customerPhone: "+201000000000",
  customerEmail: "sales@acme.example",
  customerCountry: "Egypt",
  customerCity: "Cairo",
  primaryContact: {
    partyId: "01900100-0000-7000-8000-000000000114",
    displayName: "Mona Ibrahim",
    jobTitle: "Procurement Director",
    isPrimary: true,
    email: "mona@acme.example",
    phones: ["+201111111111"],
  },
  leadSourceName: "Website",
  leadSourceIconUrl: null,
  ownerDisplayName: "Kamal Radwan",
  ownerAvatarUrl: null,
  tags: [{ id: "01900100-0000-7000-8000-000000000115", name: "VIP" }],
  createdAt: "2026-08-25T10:00:00.000Z",
  updatedAt: "2026-08-25T10:00:00.000Z",
};

describe("Pipeline API contracts", () => {
  it("selects real available pipelines from the canonical raw response", () => {
    expect(
      parsePipelinesResponse([pipeline]).map(({ id }) => id),
    ).toEqual([pipelineId]);
    expect(() =>
      parsePipelinesResponse({ success: true, data: [pipeline] }),
    ).toThrow("Invalid pipelines response.");
  });

  it("parses the board contract and preserves decimal money", () => {
    const board = parseOpportunityBoardResponse({
        pipeline,
        stages: [
          {
            stage: pipeline.stages[0],
            items: [opportunity],
            summary: {
              totalCount: 1,
              amountsByCurrency: [
                { currencyCode: "EGP", amount: "18014398509481982.50" },
              ],
            },
            activitySummary: {
              totalCount: 1,
              noOpenCount: 0,
              overdueCount: 0,
              todayCount: 1,
              futureCount: 0,
            },
            pageInfo: { limit: 50, hasMore: false, nextCursor: null },
          },
        ],
    });

    expect(board.stages[0].items[0]).toMatchObject({
      amount: "9007199254740991.25",
      cardColor: "TEAL",
      customerProfileType: "CORPORATE",
      customerDisplayName: "Acme Trading",
      primaryContact: { displayName: "Mona Ibrahim" },
      ownerDisplayName: "Kamal Radwan",
      tags: [{ name: "VIP" }],
    });
    expect(board.stages[0].summary.amountsByCurrency).toEqual({
      EGP: "18014398509481982.50",
    });
    expect(formatCurrencyAmount("9007199254740991.25", "EGP")).toBe(
      "EGP 9,007,199,254,740,991.25",
    );
    expect(
      formatOpportunityAmountSummary({ USD: "12.50", EGP: "18014398509481982.50" }),
    ).toBe("EGP 18,014,398,509,481,982.50 · USD 12.50");
  });

  it("uses the branch owner boundary for update affordances", () => {
    const capabilities = parseOpportunityCapabilitiesResponse(
      {
        branchId: opportunity.branchId,
        opportunities: {
          create: null,
          update: {
            scope: "team",
            ownerUserIds: ["01900100-0000-7000-8000-000000000113"],
          },
          delete: { scope: "all", ownerUserIds: null },
        },
      },
      opportunity.branchId,
    );
    expect(
      opportunityCapabilityAllowsOwner(
        capabilities.update,
        "01900100-0000-7000-8000-000000000113",
      ),
    ).toBe(true);
    expect(
      opportunityCapabilityAllowsOwner(capabilities.update, null),
    ).toBe(false);
    expect(
      opportunityCapabilityAllowsOwner(capabilities.delete, null),
    ).toBe(true);
  });

  it("parses one cursor page for a stage without discarding pagination", () => {
    const stage = parsePipelinesResponse([pipeline])[0].stages[0];
    const page = parseOpportunityStagePageResponse(
      {
        stageId,
        items: [{ ...opportunity, id: "01900100-0000-7000-8000-000000000120" }],
        summary: { totalCount: 51, amountsByCurrency: [] },
        activitySummary: {
          totalCount: 51,
          noOpenCount: 50,
          overdueCount: 0,
          todayCount: 1,
          futureCount: 0,
        },
        pageInfo: {
          limit: 50,
          hasMore: true,
          nextCursor: "opaque_cursor",
        },
      },
      stage,
    );

    expect(page.pageInfo).toEqual({
      limit: 50,
      hasMore: true,
      nextCursor: "opaque_cursor",
    });
    expect(() =>
      parseOpportunityStagePageResponse(
        {
          stageId,
          items: [],
          summary: { totalCount: 51, amountsByCurrency: [] },
          activitySummary: {
            totalCount: 51,
            noOpenCount: 51,
            overdueCount: 0,
            todayCount: 0,
            futureCount: 0,
          },
          pageInfo: { limit: 50, hasMore: true, nextCursor: null },
        },
        stage,
      ),
    ).toThrow("Invalid opportunity board response.");
  });

  it("rejects the old mock summary shape", () => {
    expect(() =>
      parseOpportunityBoardResponse({
          pipeline,
          stages: [
            {
              stage: pipeline.stages[0],
              items: [opportunity],
              summary: {
                totalCount: 1,
                amountsByCurrency: { SAR: 100 },
              },
              activitySummary: {
                totalCount: 1,
                noOpenCount: 0,
                overdueCount: 0,
                todayCount: 1,
                futureCount: 0,
              },
              pageInfo: { limit: 50, hasMore: false, nextCursor: null },
            },
          ],
      }),
    ).toThrow("Invalid opportunity board response.");
    expect(() =>
      parseOpportunityBoardResponse({
        pipeline,
        stages: [
          {
            stage: pipeline.stages[0],
            items: [{ ...opportunity, amount: 9007199254740991 }],
            summary: { totalCount: 1, amountsByCurrency: [] },
            activitySummary: {
              totalCount: 1,
              noOpenCount: 1,
              overdueCount: 0,
              todayCount: 0,
              futureCount: 0,
            },
            pageInfo: { limit: 50, hasMore: false, nextCursor: null },
          },
        ],
      }),
    ).toThrow("Invalid opportunity board response.");
    expect(() =>
      parseOpportunityBoardResponse({
        pipeline,
        stages: [
          {
            stage: pipeline.stages[0],
            items: [{ ...opportunity, id: "../outside" }],
            summary: { totalCount: 1, amountsByCurrency: [] },
            activitySummary: {
              totalCount: 1,
              noOpenCount: 1,
              overdueCount: 0,
              todayCount: 0,
              futureCount: 0,
            },
            pageInfo: { limit: 50, hasMore: false, nextCursor: null },
          },
        ],
      }),
    ).toThrow("Invalid opportunity board response.");
  });

  it("uses the CRM terminal-reason fields", () => {
    expect(buildStageMoveRequest(stageId, "LOST", "  Budget  ")).toEqual({
      stageId,
      lostReason: "Budget",
    });
    expect(buildStageMoveRequest(stageId, "WON", "  Signed  ")).toEqual({
      stageId,
      reason: "Signed",
    });
    expect(buildStageMoveRequest(stageId, "QUALIFICATION")).toEqual({
      stageId,
    });
  });

  it("reloads an enabled board after importance changes but not colour-only changes", async () => {
    const reloadBoard = vi.fn().mockResolvedValue(true);

    await reconcileOpportunityBoardAfterConfirmedCardPatch(
      { importance: 3 },
      true,
      pipelineId,
      reloadBoard,
    );
    await reconcileOpportunityBoardAfterConfirmedCardPatch(
      { cardColor: "BLUE" },
      true,
      pipelineId,
      reloadBoard,
    );

    expect(reloadBoard).toHaveBeenCalledTimes(1);
    expect(reloadBoard).toHaveBeenCalledWith(pipelineId);
  });
});
