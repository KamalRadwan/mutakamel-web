import type { OpportunityBoardLane, OpportunityCardRecord, OpportunityPipeline, OpportunityStage } from "../../hooks/pipeline-types";

export const boardStage: OpportunityStage = {
  id: "01950000-0000-7000-8000-000000000010", pipelineId: "01950000-0000-7000-8000-000000000020",
  opportunityStageId: "01950000-0000-7000-8000-000000000030", nameAr: "جديد", nameEn: "New",
  flag: "NEW", category: "OPEN", rank: 0, isActive: true, isSystem: true,
};

export const boardPipeline: OpportunityPipeline = {
  id: boardStage.pipelineId, code: "sales", nameAr: "المبيعات", nameEn: "Sales", isDefault: true, isActive: true, stages: [boardStage],
};

export const boardItem: OpportunityCardRecord = {
  id: "01950000-0000-7000-8000-000000000001", branchId: "01950000-0000-7000-8000-000000000002",
  customerProfileId: "01950000-0000-7000-8000-000000000003", pipelineId: boardPipeline.id,
  stageId: boardStage.id, stageFlag: "NEW", status: "IN_PROGRESS", title: "Supply contract", importance: 2,
  amount: "125.00", currencyCode: "USD", probabilityPercent: 50, expectedCloseDate: "2027-01-12",
  createdAt: "2026-10-14T12:00:00Z", updatedAt: "2026-10-14T12:00:00Z", cardColor: null,
  customerProfileType: "INDIVIDUAL", customerDisplayName: "Dina Ali", customerCompanyName: null,
  customerPhone: "", customerEmail: "dina@example.com", customerCountry: "EG", customerCity: "Cairo",
  primaryContact: null, leadSourceName: "Website referral", leadSourceIconUrl: null,
  ownerDisplayName: "Omar Ali", ownerAvatarUrl: null, openActivityCount: 0,
  nextOpenActivityAt: null, activityState: "NO_OPEN", tags: [],
};

export function boardLane(stage: OpportunityStage, items: OpportunityCardRecord[]): OpportunityBoardLane {
  return {
    stage, items, summary: { totalCount: 100, amountsByCurrency: { USD: "125.00" } },
    activitySummary: { totalCount: 100, noOpenCount: 25, overdueCount: 25, todayCount: 25, futureCount: 25 },
    pageInfo: { limit: 25, hasMore: false, nextCursor: null },
  };
}
