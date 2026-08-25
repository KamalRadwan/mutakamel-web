export type OpportunityStatus = "IN_PROGRESS" | "ON_HOLD" | "WON" | "LOST";
export type OpportunityImportance = 0 | 1 | 2 | 3;
export type OpportunityActivityState = "NO_OPEN" | "OVERDUE" | "TODAY" | "FUTURE";
export type StageFlag =
  | "NEW"
  | "DISCOVERY"
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CONTRACTING"
  | "ON_HOLD"
  | "WON"
  | "LOST";

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
  amount: string | null;
  currencyCode: string | null;
  description?: string | null;
  probabilityPercent: number | null;
  expectedCloseDate?: string | null;
  ownerUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  wonAt?: string | null;
  lostAt?: string | null;
  lostReason?: string | null;
  nextOpenActivityAt?: string | null;
  activityState: OpportunityActivityState;
}

export interface OpportunityCardRecord extends OpportunityRecord {
  customerDisplayName?: string;
  contactDisplayName?: string;
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
    amountsByCurrency: Record<string, string>;
  };
  activitySummary: {
    totalCount: number;
    noOpenCount: number;
    overdueCount: number;
    todayCount: number;
    futureCount: number;
  };
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface OpportunityBoard {
  pipeline: OpportunityPipeline;
  stages: OpportunityBoardLane[];
}

export function formatCurrencyAmount(
  amount: string | null,
  currencyCode: string | null,
): string {
  if (amount === null || !/^-?\d+(?:\.\d{1,2})?$/.test(amount)) return "—";
  const negative = amount.startsWith("-");
  const unsigned = negative ? amount.slice(1) : amount;
  const [whole, fraction = ""] = unsigned.split(".");
  const grouped = new Intl.NumberFormat("en-US").format(BigInt(whole));
  const decimal = fraction ? `.${fraction.padEnd(2, "0")}` : "";
  return `${currencyCode ? `${currencyCode} ` : ""}${negative ? "-" : ""}${grouped}${decimal}`;
}
