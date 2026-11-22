import type { CorePage, CorePageMeta } from '../../settings/core-response.model';

export type AddonReadinessStatus = 'READY' | 'NOT_READY' | 'BLOCKED';

export type AddonSeatOperationKind = 'ASSIGN_ADDON' | 'UNASSIGN_ADDON';

/** Core's paginated envelope part: { data, meta }. */
export type AddonPageMeta = CorePageMeta;
export type AddonListResponse<T> = CorePage<T>;

export interface AddonAssignment {
  userId: string;
  assignmentId: string;
  assignmentRevision: string;
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  addonSelectionId: string;
  allowanceRevision: string;
  parentAssignmentId: string;
  parentAssignmentRevision: string;
  selectedDefinitionVersionId: string;
  assignedAt: string;
  observation: 'LOCAL_PROJECTION';
  operationalUse: 'NOT_EVALUATED';
}

export interface AddonOptionRef {
  id: string;
  revision: string;
}

export interface AddonOptionLocalState {
  parentReadiness: AddonReadinessStatus;
  addonReadiness: AddonReadinessStatus;
  parentDenied: boolean;
  addonDenied: boolean;
  adoptionPending: boolean;
  capacityChangePending: boolean;
}

export interface AddonOption {
  userId: string;
  targetActive: boolean;
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  addonSelectionId: string;
  allowanceId: string;
  allowanceRevision: string;
  selectedDefinitionVersionId: string;
  parentAssignment: AddonOptionRef | null;
  assignment: AddonOptionRef | null;
  localState: AddonOptionLocalState;
  observation: 'LOCAL_PROJECTION';
  operationalUse: 'NOT_EVALUATED';
}

export interface AddonSeatWriteReceipt {
  operationId: string;
  operationRevision: string;
  state: 'COMMITTED';
  operationKind: AddonSeatOperationKind;
  changed: boolean;
  resourceId: string;
  resourceRevision: string;
  completedAt: string;
}

export interface AssignAddonBody {
  addonSelectionId: string;
  expectedAllowanceRevision: string;
  expectedParentAssignmentRevision: string;
}

export interface RemoveAddonQuery {
  expectedAssignmentRevision: string;
  expectedAllowanceRevision: string;
}
