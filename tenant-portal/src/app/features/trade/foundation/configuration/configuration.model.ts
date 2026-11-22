export type ScopeTarget = 'TENANT' | 'COMPANY' | 'BRANCH';

export type MergeStrategy = 'OVERRIDE' | 'MIN' | 'MAX' | 'UNION' | 'DENY_WINS' | 'FIRST_MATCH';

export type RiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type VersionStatus =
  | 'DRAFT'
  | 'TESTED'
  | 'APPROVAL_PENDING'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'RETIRED';

export type EffectiveVersionState =
  | 'DRAFT'
  | 'TESTED'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'REPLACED'
  | 'RETIRED';

export interface ValueSchema {
  type: 'boolean' | 'string' | 'number' | 'integer' | 'object' | 'array';
  enum?: unknown[];
  properties?: Record<string, ValueSchema>;
  required?: string[];
  items?: ValueSchema;
  additionalProperties?: false;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export interface ConfigVersion {
  id: string;
  versionNumber: number;
  version: number;
  scopeTarget: ScopeTarget;
  companyId: string | null;
  branchId: string | null;
  channelId: string | null;
  value: unknown;
  status: VersionStatus;
  effectiveState: EffectiveVersionState;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  supersededByVersionId: string | null;
  contentHash: string;
}

export interface VersionTestEvidence {
  evidenceId: string;
  passed: boolean;
  /** Flat list: [code, ...paths], e.g. ['BRANCH_WEAKENS_MIN'] or ['TRADE.CONFIGURATION.VALUE_INVALID', '$.x']. */
  diagnostics: string[];
  contentHash: string;
  testedAt: string;
}

export interface ConfigVersionDetail extends ConfigVersion {
  createdBy: string;
  createdByName: string;
  latestTestEvidence: VersionTestEvidence | null;
}

export interface ConfigDefinition {
  id: string;
  key: string;
  valueSchema: ValueSchema;
  allowedScopes: ScopeTarget[];
  mergeStrategy: MergeStrategy;
  riskClass: RiskClass;
  companyLockPolicy: { requireCompanyBaseline?: boolean };
  version: number;
  versions: ConfigVersion[];
}

export interface ConfigDefinitionDetail extends Omit<ConfigDefinition, 'versions'> {
  versions: ConfigVersionDetail[];
}

export interface TestResult {
  evidenceId: string;
  passed: boolean;
  /** Flat list: [code, ...paths], e.g. ['BRANCH_WEAKENS_MIN'] or ['TRADE.CONFIGURATION.VALUE_INVALID', '$.x']. */
  diagnostics: string[];
  mergeStrategy: MergeStrategy;
  contentHash: string;
  version: number;
}

export interface ListDefinitionsQuery {
  page?: number;
  limit?: number;
}

export interface CreateDefinitionBody {
  key: string;
  valueSchema: ValueSchema;
  allowedScopes: ScopeTarget[];
  mergeStrategy: MergeStrategy;
  riskClass: RiskClass;
  companyLockPolicy: { requireCompanyBaseline?: boolean };
}

export interface CreateVersionBody {
  scopeTarget: ScopeTarget;
  value: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CreatedConfigVersion extends ConfigVersion {
  createdBy: string;
}

export interface PublishVersionBody {
  supersedesVersionId?: string;
}

export interface PublishedConfigVersion extends ConfigVersion {
  configurationEpoch: number;
}

export const SCOPE_TARGETS: readonly ScopeTarget[] = ['TENANT', 'COMPANY', 'BRANCH'];

export const MERGE_STRATEGIES: readonly MergeStrategy[] = [
  'OVERRIDE',
  'MIN',
  'MAX',
  'UNION',
  'DENY_WINS',
  'FIRST_MATCH',
];

export const RISK_CLASSES: readonly RiskClass[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RISK_BADGE_CLASS: Record<RiskClass, string> = {
  LOW: 'bg-neutral-soft text-text',
  MEDIUM: 'bg-brand-soft text-on-brand-soft',
  HIGH: 'bg-danger-soft text-on-danger-soft',
  CRITICAL: 'bg-danger text-on-danger',
};
