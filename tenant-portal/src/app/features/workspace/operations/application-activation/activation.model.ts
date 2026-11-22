export type ActivationScopeKind = 'COMPANY' | 'BRANCH';
export type ActivationResourceScope = 'COMPANY' | 'BRANCH';
export type BindingState = 'NOT_CREATED' | 'STORED';
export type BranchOverrideMode = 'INHERIT' | 'DISABLED';
export type ObservationKind = 'LOCAL_PROJECTION';
export type OperationalUseKind = 'NOT_EVALUATED';

export type SelectionState = 'SELECTED' | 'NOT_SELECTED';
export type LifecycleStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'DISABLED';
export type DefinitionState = 'NOT_APPLICABLE' | 'PUBLISHED' | 'REVOKED' | 'UNAVAILABLE';
export type LocalSourceState = 'MISSING' | 'MATCHED' | 'UNMATCHED';

export type ActivationOperationKind =
  | 'ASSIGN_ADDON'
  | 'UNASSIGN_ADDON'
  | 'SET_APPLICATION_ACTIVATION'
  | 'SET_ADDON_ACTIVATION'
  | 'SET_BRANCH_OVERRIDE'
  | 'SET_COMPANY_CONFIGURATION'
  | 'SET_BRANCH_CONFIGURATION';

export type AddonCommandRejectionReason =
  | 'SOURCE_CHANGED'
  | 'AUTHORITY_CHANGED'
  | 'CONFIGURATION_REJECTED';

export interface ActivationScope {
  kind: ActivationScopeKind;
  companyId: string;
  branchId: string | null;
}

export interface ActivationTarget {
  applicationId: string;
  applicationKey: string;
  addonId: string | null;
  addonKey: string | null;
}

export interface ApplicationActivationResource {
  kind: 'APPLICATION_ACTIVATION';
  state: BindingState;
  id: string | null;
  revision: string;
  enabled: boolean | null;
}

export interface AddonActivationResource {
  kind: 'ADDON_ACTIVATION';
  state: BindingState;
  id: string | null;
  revision: string;
  enabled: boolean | null;
  definitionVersionId: string | null;
  configVersionId: string | null;
}

export interface BranchOverrideResource {
  kind: 'BRANCH_OVERRIDE';
  state: BindingState;
  id: string | null;
  revision: string;
  mode: BranchOverrideMode | null;
  definitionVersionId: string | null;
  configVersionId: string | null;
  companyApplicationEnabled: boolean;
  companyAddonEnabled: boolean;
}

export type ActivationResource =
  | ApplicationActivationResource
  | AddonActivationResource
  | BranchOverrideResource;

export interface ActivationListItem<R extends ActivationResource = ActivationResource> {
  scope: ActivationScope;
  target: ActivationTarget;
  resourceScope: ActivationResourceScope;
  resource: R;
  observation: ObservationKind;
  operationalUse: OperationalUseKind;
}

export interface ActivationPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ActivationListResponse {
  data: ActivationListItem[];
  meta: ActivationPageMeta;
}

export interface ApplicationReadSourceFacts {
  selectionState: SelectionState;
  applicationLifecycleStatus: LifecycleStatus;
  addonLifecycleStatus: LifecycleStatus | null;
  definitionState: DefinitionState;
  localSourceState: LocalSourceState;
  adoptionPending: boolean;
  observedAt: string;
  selectedDefinitionVersionId: string | null;
}

export interface ActivationSingleton<R extends ActivationResource = ActivationResource> {
  scope: ActivationScope;
  target: ActivationTarget;
  resource: R;
  source: ApplicationReadSourceFacts;
  operationalUse: OperationalUseKind;
}

export interface SetCompanyApplicationBody {
  expectedActivationRevision: string;
  enabled: boolean;
  reason: string;
}

export interface SetCompanyAddonBody {
  expectedActivationRevision: string;
  enabled: boolean;
  reason: string;
  definitionVersionId: string;
}

export interface SetBranchOverrideBody {
  expectedOverrideRevision: string;
  mode: BranchOverrideMode;
  reason: string;
}

export interface ActivationWriteReceipt {
  operationId: string;
  operationRevision: string;
  state: 'COMMITTED';
  operationKind: ActivationOperationKind;
  changed: boolean;
  resourceId: string;
  resourceRevision: string;
  completedAt: string;
}

/** 202 body and status poll while scanning. commandId is the original x-idempotency-key; the counters are decimal strings. */
export interface AddonActivationPendingCommand {
  commandId: string;
  revision: string;
  state: 'PENDING';
  operationKind: 'SET_ADDON_ACTIVATION';
  progress: {
    pageNumber: string;
    validatedBranchCount: string;
  };
  operationalUse: OperationalUseKind;
}

export interface AddonActivationRejectedCommand {
  commandId: string;
  revision: string;
  state: 'REJECTED';
  operationKind: 'SET_ADDON_ACTIVATION';
  reason: AddonCommandRejectionReason;
  operationalUse: OperationalUseKind;
}

export type SetCompanyAddonResponse = ActivationWriteReceipt | AddonActivationPendingCommand;

export type AddonCommandStatusResponse =
  | AddonActivationPendingCommand
  | AddonActivationRejectedCommand
  | ActivationWriteReceipt;

/** Reason length is counted in UTF-16 units, like the backend `reason()` check. */
export const ACTIVATION_REASON_MIN = 3;
export const ACTIVATION_REASON_MAX = 500;
export const ACTIVATION_REVISION_PATTERN = /^(0|[1-9][0-9]{0,18})$/;
export const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
