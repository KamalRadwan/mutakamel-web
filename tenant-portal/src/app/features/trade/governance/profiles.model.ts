import type { TradeContext } from '../shared/trade-api';
import type { ScopeTarget } from './policy.model';
import type { DocumentType } from './profiles.registry';

// Shapes follow trade-app document-platform (document-profile.service.ts, dto/document-profile.dto.ts).

export interface ProfileWriteOptions {
  idempotencyKey?: string;
  ifMatch?: number;
  ctx?: TradeContext;
}

export type ProfileVersionStatus = 'DRAFT' | 'TESTED' | 'SCHEDULED' | 'PUBLISHED' | 'SUPERSEDED';

/** Document profiles exist at TENANT or COMPANY scope only. */
export type ProfileScopeTarget = Exclude<ScopeTarget, 'BRANCH'>;

export interface ProfileFieldConfig {
  code: string;
  required: boolean;
  visible: boolean;
}

export interface ProfileComponentConfig {
  code: string;
  order: number;
  visible: boolean;
}

export interface ProfileEvidenceConfig {
  code: string;
  /** UI-only flag in `profile-content-editor`; stripped before sending to the backend (G-9). */
  include?: boolean;
  required: boolean;
}

export interface ProfileContent {
  fields: ProfileFieldConfig[];
  components: ProfileComponentConfig[];
  modes: Record<string, string | boolean>;
  evidence: ProfileEvidenceConfig[];
}

/** A required case the author adds (compileRequiredCases): input keys are field codes. */
export interface ProfileRequiredCaseInput {
  code: string;
  input: Record<string, unknown>;
  expectedValid: boolean;
}

/** A stored required case (server cases and author cases). */
export interface ProfileRequiredCase {
  id: string;
  code: string;
  input: Record<string, unknown>;
  expectedHash: string;
}

/** executeProfileCases result row (validate response). */
export interface ProfileCaseExecution {
  code: string;
  actualHash: string;
  expectedHash: string;
  passed: boolean;
  durationMs: number;
}

/** POST document-profile-versions/:id/validate. */
export interface ProfileValidateResult {
  validationRunId: string;
  passed: boolean;
  status: ProfileVersionStatus;
  checksum: string;
  registryChecksum: string;
  results: ProfileCaseExecution[];
  version: number;
}

export interface ProfileValidationDiagnostic {
  caseCode: string;
  code: string;
}

export interface ProfileValidationRunResult {
  code: string | undefined;
  requiredCaseId: string;
  actualHash: string;
  expectedHash: string | undefined;
  passed: boolean;
  durationMs: number;
  diagnosticCode: string | null;
}

/** latestValidationRun on the version read. */
export interface ProfileValidationRun {
  id: string;
  passed: boolean;
  diagnostics: ProfileValidationDiagnostic[];
  validatedAt: string;
  results: ProfileValidationRunResult[];
}

/** projectVersion: content only for PUBLISHED/SUPERSEDED rows, or with include=content. */
export interface ProfileVersion {
  id: string;
  profileVersion: number;
  schemaVersion: string;
  registryVersion: string;
  runtimeVersion: string;
  checksum: string;
  status: ProfileVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  supersededByVersionId: string | null;
  version: number;
  authorUserId: string;
  validatedBy: string | null;
  publishedBy: string | null;
  content?: ProfileContent;
}

export interface ProfileVersionProfileRef {
  id: string;
  code: string;
  documentType: DocumentType;
  scopeTarget: ProfileScopeTarget;
  pointerVersion: number;
  currentPublishedVersionId: string | null;
}

/** GET document-profile-versions/:id. DRAFT/TESTED content is hidden without manage or validate. */
export interface ProfileVersionDetail extends ProfileVersion {
  contentHidden?: true;
  requiredCases: ProfileRequiredCase[];
  latestValidationRun: ProfileValidationRun | null;
  profile: ProfileVersionProfileRef;
}

/** The saved version entity (create and publish responses). */
export interface ProfileVersionRecord extends ProfileVersion {
  profileId: string;
  content: ProfileContent;
  restoredFromVersionId: string | null;
  restorationReason: string | null;
  scheduledExpectedPointerVersion: number | null;
}

export interface ProfileVersionCreated extends ProfileVersionRecord {
  requiredCaseCount: number;
}

export interface ProfilePublishResult extends ProfileVersionRecord {
  activePointerVersion: number;
  active: boolean;
}

export interface ProfileDeleteResult {
  id: string;
  deleted: true;
  version: number;
}

/** The profile entity (create response). */
export interface DocumentProfileRecord {
  id: string;
  scopeTarget: ProfileScopeTarget;
  companyId: string | null;
  companyScopeKey: string;
  code: string;
  documentType: DocumentType;
  currentPublishedVersionId: string | null;
  pointerVersion: number;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET document-profiles/:id, and each list item. */
export interface DocumentProfile extends DocumentProfileRecord {
  versions: ProfileVersion[];
}

export interface ProfileList {
  items: DocumentProfile[];
  total: number;
  page: number;
  limit: number;
}

/** GET document-profiles/counts: every document family is a key. */
export interface ProfileCounts {
  total: number;
  byDocumentType: Record<string, number>;
}

/** DocumentProfileFilterQueryDto. */
export interface ProfileFilterQuery {
  documentType?: DocumentType;
  versionStatus?: ProfileVersionStatus;
  q?: string;
}

/** DocumentProfileListQueryDto. */
export interface ListProfilesQuery extends ProfileFilterQuery {
  page?: number;
  limit?: number;
  include?: 'content';
}

export interface CreateProfileInput {
  code: string;
  documentType: DocumentType;
  scopeTarget: ScopeTarget;
}

export interface CreateProfileVersionInput {
  content: ProfileContent;
  requiredCases?: ProfileRequiredCaseInput[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  restoredFromVersionId?: string;
  restorationReason?: string;
}
