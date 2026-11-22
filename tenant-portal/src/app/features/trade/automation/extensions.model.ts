import type { ScopeTarget } from './automation-fake-actors';
import type {
  ExtensionDefaultStrategy,
  ExtensionScalarType,
  ExtensionTargetCode,
  ExtensionValueKind,
  ExtensionVisibility,
} from './extensions.registry';

export type ExtensionProfileStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

export type ExtVersionStatus = 'DRAFT' | 'TESTED' | 'PUBLISHED' | 'SUPERSEDED' | 'RETIRED';

export type ExtensionScopeTarget = Exclude<ScopeTarget, 'BRANCH'>;

/** One OBJECT property inside `constraintPayload.properties` (extension-value-schema.ts ObjectPropertySchema). */
export interface ExtensionObjectProperty {
  key: string;
  scalarType: ExtensionScalarType;
  isRequired: boolean;
  maxLength: number | null;
  decimalScale: number | null;
  minimumDecimal: string | null;
  maximumDecimal: string | null;
  allowedValues: string[] | null;
}

/** `{}` for most scalars, `{allowedValues}` for ENUM, `{properties}` for OBJECT. */
export interface ExtensionConstraintPayload {
  allowedValues?: string[];
  properties?: ExtensionObjectProperty[];
}

/** extension-profile-queries.service.ts fieldProjection. */
export interface ExtensionField {
  id: string;
  fieldKey: string;
  valueKind: ExtensionValueKind;
  scalarType: ExtensionScalarType | null;
  schemaCode: string | null;
  schemaVersion: number | null;
  isRequired: boolean;
  isSearchable: boolean;
  visibilityCode: ExtensionVisibility;
  maxLength: number | null;
  maxItems: number | null;
  decimalScale: number | null;
  minimumDecimal: string | null;
  maximumDecimal: string | null;
  defaultStrategy: ExtensionDefaultStrategy;
  defaultValue: unknown;
  constraintPayload: ExtensionConstraintPayload;
  ordinal: number;
}

/** dto/extensions-automation.dto.ts ExtensionFieldDto (no id, no ordinal: forbidNonWhitelisted). */
export interface ExtensionFieldInput {
  fieldKey: string;
  valueKind: ExtensionValueKind;
  scalarType?: ExtensionScalarType;
  schemaCode?: string;
  schemaVersion?: number;
  isRequired?: boolean;
  isSearchable?: boolean;
  visibilityCode: ExtensionVisibility;
  maxLength?: number;
  maxItems?: number;
  decimalScale?: number;
  minimumDecimal?: string;
  maximumDecimal?: string;
  defaultStrategy?: ExtensionDefaultStrategy | 'OWNER_DERIVED';
  defaultValue?: unknown;
  constraintPayload?: ExtensionConstraintPayload;
}

/** extension-profile-queries.service.ts versionProjection (+ fields on detail and version detail). */
export interface ExtVersion {
  id: string;
  profileId: string;
  version: number;
  versionNumber: number;
  registryVersion: number;
  targetSchemaCode: string;
  targetSchemaVersion: number;
  definitionHash: string;
  status: ExtVersionStatus;
  compatibilitySummary: Record<string, unknown>;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
  fields?: ExtensionField[];
}

/** profileProjection + versions; list summaries also carry `fieldCount` and versions without fields. */
export interface ExtensionProfile {
  id: string;
  version: number;
  code: string;
  targetCode: ExtensionTargetCode;
  scopeTarget: ExtensionScopeTarget;
  companyId: string | null;
  status: ExtensionProfileStatus;
  currentPublishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  fieldCount?: number;
  currentPublishedVersion: ExtVersion | null;
  editableDraftVersion: ExtVersion | null;
}

/** The saved profile entity as create/update/publish/retire return it (not the detail projection). */
export interface ExtensionProfileEntity {
  id: string;
  version: number;
  code: string;
  targetCode: ExtensionTargetCode;
  scopeTarget: ExtensionScopeTarget;
  companyId: string | null;
  status: ExtensionProfileStatus;
  currentPublishedVersionId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Version entity inside write responses. */
export interface ExtVersionEntity extends Omit<ExtVersion, 'fields'> {
  createdBy: string;
  updatedBy: string;
}

/** Field entity inside write responses. */
export interface ExtFieldEntity extends ExtensionField {
  profileVersionId: string;
  createdBy: string;
  updatedBy: string;
}

/** POST /extensions/profiles and PATCH /extensions/profiles/:id. */
export interface ExtensionProfileDraftResult extends ExtensionProfileEntity {
  draftVersion: ExtVersionEntity;
  fields: ExtFieldEntity[];
}

/** POST /extensions/profiles/:id/publish. */
export interface ExtensionProfilePublishResult extends ExtensionProfileEntity {
  publishedVersion: ExtVersionEntity;
}

/** DELETE /extensions/profiles/:id/draft. */
export interface ExtensionDraftDiscardResult {
  id: string;
  version: number;
  discardedVersionId: string;
}

export interface ExtValidateDiagnostic {
  fieldKey: string;
  code: string;
}

/** POST /extensions/profiles/:id/validate. */
export interface ExtValidateResult {
  profileId: string;
  versionId: string;
  passed: boolean;
  checkedAt: string;
  fieldCount: number;
  diagnostics: ExtValidateDiagnostic[];
  version: number;
}

export interface ExtensionProfileCounts {
  total: number;
  byTarget: Record<ExtensionTargetCode, number>;
  byStatus: Record<ExtensionProfileStatus, number>;
}

/** ExtensionProfileFiltersDto. */
export interface ExtensionProfileFilters {
  targetCode?: ExtensionTargetCode;
  status?: ExtensionProfileStatus;
}

/** ExtensionProfileListQueryDto. */
export interface ListExtensionProfilesQuery extends ExtensionProfileFilters {
  page?: number;
  limit?: number;
}

/** ExtensionProfileVersionListQueryDto. */
export interface ListExtVersionsQuery {
  page?: number;
  limit?: number;
  status?: ExtVersionStatus;
}

/** CreateExtensionProfileDto. */
export interface CreateExtensionProfileInput {
  code: string;
  targetCode: ExtensionTargetCode;
  scopeTarget: ExtensionScopeTarget;
  fields: ExtensionFieldInput[];
}
