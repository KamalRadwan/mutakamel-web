// Exhaustive enum -> role mapping — docs/design/tokens.md#status-mapping.
// Do not extend by guessing: an unmapped value means the enum changed and
// reference/enums.md needs regenerating from source.
export type StatusRole = "positive" | "negative" | "caution" | "pending";

export type StatusKind =
  | "LeadStatus"
  | "LeadStageFlag"
  | "OpportunityStatus"
  | "OpportunityStageFlag"
  | "CustomerStatus"
  | "StageCategory"
  | "CrmTaskStatus"
  | "CrmActivityStatus"
  | "CrmReminderStatus";

const TONE_MAP: Record<StatusKind, Record<string, StatusRole>> = {
  LeadStatus: {
    CONVERTED: "positive",
    DISQUALIFIED: "negative",
    ON_HOLD: "caution",
    OPEN: "pending",
  },
  LeadStageFlag: {
    CONVERTED: "positive",
    QUALIFIED: "positive",
    DISQUALIFIED: "negative",
    ON_HOLD: "caution",
    NURTURING: "caution",
    NEW: "pending",
    CONTACTED: "pending",
    QUALIFYING: "pending",
  },
  OpportunityStatus: {
    WON: "positive",
    LOST: "negative",
    ON_HOLD: "caution",
    IN_PROGRESS: "pending",
  },
  OpportunityStageFlag: {
    WON: "positive",
    LOST: "negative",
    ON_HOLD: "caution",
    NEW: "pending",
    DISCOVERY: "pending",
    QUALIFICATION: "pending",
    PROPOSAL: "pending",
    NEGOTIATION: "pending",
    CONTRACTING: "pending",
  },
  CustomerStatus: {
    ACTIVE_CUSTOMER: "positive",
    BLACKLISTED: "negative",
    INACTIVE: "caution",
    PROSPECT: "pending",
  },
  StageCategory: {
    POSITIVE: "positive",
    NEGATIVE: "negative",
    OPEN: "pending",
    IN_PROGRESS: "pending",
  },
  CrmTaskStatus: {
    DONE: "positive",
    CANCELLED: "negative",
    OPEN: "pending",
    IN_PROGRESS: "pending",
  },
  CrmActivityStatus: {
    DONE: "positive",
    OPEN: "pending",
  },
  CrmReminderStatus: {
    SENT: "positive",
    CANCELLED: "negative",
    PENDING: "caution",
  },
};

export function resolveStatusRole(kind: StatusKind, value: string): StatusRole | undefined {
  return TONE_MAP[kind][value];
}
