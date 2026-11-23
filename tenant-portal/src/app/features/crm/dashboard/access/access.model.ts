export type AccessResourceType = 'DASHBOARD' | 'WIDGET';
export type AccessLevel = 'VIEW' | 'EDIT';
export type HeldAccessLevel = 'NONE' | 'VIEW' | 'EDIT' | 'MANAGE';
export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

/** `AccessRequestDto` (crm-app access-request.dto.ts). */
export interface AccessRequest {
  id: string;
  requestNumber: string;
  requesterUserId: string;
  resourceType: AccessResourceType;
  resourceId: string;
  /** The dashboard or widget name; null when the target is gone. */
  resourceName: string | null;
  requestedLevel: AccessLevel;
  heldLevelAtRequest: HeldAccessLevel;
  purpose: string;
  requestedExpiresAt: string | null;
  status: AccessRequestStatus;
  pendingUntil: string;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  grantedLevel: AccessLevel | null;
  grantedExpiresAt: string | null;
  shareId: string | null;
  revision: number;
  createdAt: string;
}

export type OwnerReviewTriggerReason = 'OWNER_INACTIVE' | 'OWNER_REMOVED' | 'ADMIN_INITIATED';
export type OwnerReviewStatus = 'OPEN' | 'TRANSFERRED' | 'OWNER_REACTIVATED' | 'LAPSED' | 'CANCELLED';

/** `AccessReviewDto` (crm-app owner-review.dto.ts). */
export interface OwnerReview {
  id: string;
  resourceType: AccessResourceType;
  resourceId: string;
  resourceName: string | null;
  ownerUserId: string;
  triggerReason: OwnerReviewTriggerReason;
  status: OwnerReviewStatus;
  ownerStatusChangedAt: string;
  openedAt: string;
  reviewUntil: string;
  proposedOwnerUserId?: string | null;
  proposalReason?: string | null;
  proposedByUserId?: string | null;
  proposedAt?: string | null;
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  revision: number;
}

export interface SubmitAccessRequestBody {
  resourceType: AccessResourceType;
  resourceId: string;
  requestedLevel: AccessLevel;
  purpose: string;
  requestedExpiresAt?: string | null;
}

export interface DecideAccessRequestBody {
  revision: number;
  decision: 'APPROVED' | 'REJECTED';
  grantedLevel?: AccessLevel;
  grantedExpiresAt?: string | null;
  note?: string;
}

/** POST owner-reviews/:id/proposal. A null or absent `proposedOwnerUserId` withdraws the proposal. */
export interface ProposeOwnerBody {
  revision: number;
  proposedOwnerUserId?: string | null;
  /** Required (non-blank, at most 500) when a new owner is proposed. */
  reason?: string | null;
}

export interface ExecuteOwnerTransferBody {
  revision: number;
  reason: string;
}

/** `OwnershipTransferSummary` (crm-app dashboard-ownership-transfer.dto.ts). */
export interface OwnershipTransferSummary {
  resourceType: AccessResourceType;
  id: string;
  name: string | null;
  ownerUserId: string;
  previousOwnerUserId: string;
  revision: number;
  governanceRevision?: number;
  renamedFrom?: string;
  revokedShareCount: number;
  retainedShareCount: number;
  ownerReviewId: string | null;
}

export interface ExecuteOwnerTransferResult {
  review: OwnerReview;
  transfer: OwnershipTransferSummary;
}

/**
 * GET access-requests. 'ALL' is sent as `status=ALL` and returns every status in both boxes (lead decision
 * 2026-11-22). No status returns every status for `box=mine` but only PENDING for `box=inbox` (a work queue).
 */
export interface ListAccessRequestsQuery {
  status?: AccessRequestStatus | 'ALL' | null;
  cursor?: string | null;
  limit?: number;
}

export interface ListOwnerReviewsQuery {
  status?: OwnerReviewStatus | 'ALL' | null;
  cursor?: string | null;
  limit?: number;
}

export interface RequestableResource {
  id: string;
  type: AccessResourceType;
  nameEn: string;
  nameAr: string;
  heldLevel: HeldAccessLevel;
}

export interface AccessPerson {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  active: boolean;
}
