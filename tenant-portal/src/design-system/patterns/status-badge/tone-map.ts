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
  | "CrmReminderStatus"
  | "TenantStatus"
  | "UserStatus"
  | "SubscriptionStatus"
  | "AccessMode";

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
  // The four Core lifecycles below are transcribed from
  // ../backend/mutakamel-apps/core-app/packages/common/src/enums/ —
  // tenant-status.enum.ts, user-status.enum.ts, subscription-status.enum.ts
  // and access-mode.enum.ts. Verified 2026-08-30. Note SubscriptionStatusEnum
  // has FIVE values: PENDING_ACTIVATION is real and was missing from the
  // four-value list in MASTER-PLAN's L2 lifecycle table.
  TenantStatus: {
    ACTIVE: "positive",
    PROVISIONING_FAILED: "negative",
    DELETED: "negative",
    SUSPENDED: "caution",
    PROVISIONING: "pending",
  },
  UserStatus: {
    ACTIVE: "positive",
    DEACTIVATED: "negative",
    SUSPENDED: "caution",
    INVITED: "pending",
  },
  // Roles follow what the subscription actually permits, per
  // SubscriptionEnforcementGuard.statusAccessMode: PAST_DUE is DUNNING,
  // CANCELLED is READ_ONLY, and PENDING_ACTIVATION falls to BLOCKED.
  SubscriptionStatus: {
    ACTIVE: "positive",
    CANCELLED: "negative",
    PAST_DUE: "caution",
    PENDING_ACTIVATION: "caution",
    TRIAL: "pending",
  },
  AccessMode: {
    FULL: "positive",
    BLOCKED: "negative",
    DUNNING: "caution",
    READ_ONLY: "caution",
  },
};

export function resolveStatusRole(kind: StatusKind, value: string): StatusRole | undefined {
  return TONE_MAP[kind][value];
}
