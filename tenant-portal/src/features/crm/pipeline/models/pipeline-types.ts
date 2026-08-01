export type OpportunityView = "board" | "list" | "card";
export type OpportunityStatus = "IN_PROGRESS" | "ON_HOLD" | "WON" | "LOST";
export type OpportunityImportance = 0 | 1 | 2 | 3;
export type OpportunityActivityState = "NO_OPEN" | "OVERDUE" | "TODAY" | "FUTURE";
export type StageFlag = "NEW" | "OPEN" | "WON" | "LOST";

export interface OpportunityRecord {
  id: string;
  branchId: string;
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  stageFlag: StageFlag;
  status: OpportunityStatus;
  title: string;
  importance: OpportunityImportance;
  amount: number;
  currencyCode: string;
  description?: string;
  probabilityPercent: number;
  expectedCloseDate?: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
  nextOpenActivityAt?: string;
  activityState: OpportunityActivityState;
}

export interface OpportunityCardRecord extends OpportunityRecord {
  customerCompanyName?: string;
  customerPhone?: string;
  customerCountry?: string;
  customerCity?: string;
  leadSourceName?: string;
  ownerDisplayName?: string;
  ownerAvatarUrl?: string;
  openActivityCount: number;
}

export interface OpportunityStage {
  id: string;
  pipelineId: string;
  opportunityStageId: string; // The reference to a master stage
  nameAr: string;
  nameEn: string;
  flag: StageFlag;
  category: string;
  rank: number;
  isActive: boolean;
  isSystem: boolean;
  probabilityPercent: number;
  colorTheme?: string;
}

export interface OpportunityPipeline {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isDefault: boolean;
  isActive: boolean;
  stages: OpportunityStage[];
}

export interface OpportunityBoardLane {
  stage: OpportunityStage;
  items: OpportunityCardRecord[];
  summary: {
    totalCount: number;
    amountsByCurrency: Record<string, number>;
  };
  activitySummary: {
    noOpenCount: number;
    overdueCount: number;
    todayCount: number;
    futureCount: number;
  };
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface OpportunityBoard {
  pipeline: OpportunityPipeline;
  stages: OpportunityBoardLane[];
}

export interface SearchFilterToken {
  id: string;
  field: "sales_person" | "opportunity" | "phone" | "customer" | "all";
  fieldLabel: string;
  value: string;
}
