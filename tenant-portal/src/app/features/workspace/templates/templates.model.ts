/** Core route tabs inside the template detail page. */
export const TEMPLATE_PAGE_TABS = ['overview', 'design', 'preview', 'validation', 'versions', 'recovery'] as const;

export type TemplatePageTab = (typeof TEMPLATE_PAGE_TABS)[number];

/** Supported document families across print and CRM email templates. */
export type TemplateDocumentType =
  | 'QUOTATION'
  | 'CRM_OUTBOUND_EMAIL'
  | 'PURCHASE_QUOTATION'
  | 'PURCHASE_ORDER'
  | 'SALES_ORDER'
  | 'INVOICE'
  | 'CONTRACT'
  | 'LETTER';

export type TemplateOutputChannel = 'PRINT' | 'EMAIL';

export type TemplateLayoutMode = 'HYBRID_DOCUMENT' | 'EMAIL_FLOW' | 'FLOW_DOCUMENT' | 'FIXED_CANVAS';

export type TemplateConvertibleLayoutMode = 'HYBRID_DOCUMENT' | 'FLOW_DOCUMENT' | 'FIXED_CANVAS';

export type TemplateLifecycleStatus = 'ACTIVE' | 'ARCHIVED';

export type TemplateVersionStatus = 'PUBLISHED' | 'RETIRED';

export type TemplateValidationState = 'NOT_VALIDATED' | 'PASSED' | 'FAILED' | 'STALE';

export type TemplateValidationRunStatus = 'PASSED' | 'FAILED';

/** Backend issueDto maps template-schema INFO to WARNING, so issues are only ERROR | WARNING. */
export type TemplateIssueSeverity = 'ERROR' | 'WARNING';

export type TemplateLocale = 'ar-EG' | 'en-US';

export type TemplateDirection = 'AUTO' | 'LTR' | 'RTL';
/** Version reads resolve AUTO against the locale (backend resolveTemplateTextDirection): only LTR | RTL. */
export type TemplateResolvedDirection = 'LTR' | 'RTL';

export type TemplateDefinitionScopeType = 'TENANT' | 'COMPANY';

export type TemplateAssignmentScopeType = 'TENANT' | 'COMPANY' | 'BRANCH';

export type TemplateDataSourceKey =
  | 'TRADE_QUOTATION_PRINT_V1'
  | 'TRADE_PURCHASE_QUOTATION_PRINT_V1'
  | 'TRADE_SALES_ORDER_PRINT_V1'
  | 'TRADE_PURCHASE_ORDER_PRINT_V1'
  | 'TRADE_INVOICE_PRINT_V1'
  | 'TRADE_CONTRACT_PRINT_V1'
  | 'CORE_BUSINESS_LETTER_PRINT_V1'
  | 'CRM_LEAD_OUTBOUND_EMAIL_V1'
  | 'CRM_CUSTOMER_OUTBOUND_EMAIL_V1'
  | 'CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1';

/** Standard API success envelope (§0). */
export interface TemplateSuccessEnvelope<T> {
  success: true;
  data: T;
  correlationId: string;
  timestamp: string;
}

/** Standard API error envelope (§0). */
export interface TemplateErrorEnvelope {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory: string;
  message: string;
  details: Record<string, unknown> | null;
  correlationId: string;
  timestamp: string;
  path: string;
}

export interface TemplatePageInfo {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface TemplateCursorPage<T> {
  items: T[];
  pageInfo: TemplatePageInfo;
}

export interface TemplateAuthor {
  kind: 'USER';
  actorId: string;
  displayName: string;
}

export type TemplateCapabilityState = 'HIDDEN' | 'ENABLED' | 'DISABLED';

export type TemplateCapabilityReason =
  | 'ARCHIVED'
  | 'VALIDATION_REQUIRED'
  | 'NOT_ELIGIBLE'
  | 'REFERENCED'
  | 'NO_PUBLISHED_VERSION'
  | 'ACCESS_POLICY_READ_ONLY';

export interface TemplateCapability {
  state: TemplateCapabilityState;
  reason: TemplateCapabilityReason | (string & {}) | null;
}

export interface TemplateListActions {
  open: TemplateCapability;
  design: TemplateCapability;
  validate: TemplateCapability;
  duplicateFromDraft: TemplateCapability;
  duplicateFromVersion: TemplateCapability;
  preview: TemplateCapability;
  publish: TemplateCapability;
  manageAssignments: TemplateCapability;
  restoreVersion: TemplateCapability;
  archive: TemplateCapability;
  restore: TemplateCapability;
  delete: TemplateCapability;
}

export interface TemplateDetailCapabilities {
  update: TemplateCapability;
  validate: TemplateCapability;
  publish: TemplateCapability;
  preview: TemplateCapability;
  previewPdf: TemplateCapability;
  restoreVersion: TemplateCapability;
  manageRecovery: TemplateCapability;
  restoreRecovery: TemplateCapability;
  manageAssets: TemplateCapability;
  retireVersion: TemplateCapability;
  archive: TemplateCapability;
  restore: TemplateCapability;
  delete: TemplateCapability;
  manageAssignments: TemplateCapability;
}

export type TemplateDefinitionScope =
  | { type: 'TENANT' }
  | { type: 'COMPANY'; companyId: string };

export type TemplateScopeRef =
  | { type: 'TENANT' }
  | { type: 'COMPANY'; companyId: string }
  | { type: 'BRANCH'; companyId: string; branchId: string };

/** Thumbnail projection states (§1). */
export type TemplateThumbnailState = 'PENDING' | 'UNAVAILABLE' | 'READY';

export interface TemplateThumbnailPendingOrUnavailable {
  state: 'PENDING' | 'UNAVAILABLE';
  sourceChecksum: string;
}

export interface TemplateThumbnailReady {
  state: 'READY';
  sourceChecksum: string;
  contentChecksum: string;
  widthPx: number;
  heightPx: number;
  expiresAt: string;
  downloadPath: string;
}

export type TemplateThumbnail = TemplateThumbnailPendingOrUnavailable | TemplateThumbnailReady;

export type TemplateThumbnailSourceKind = 'DRAFT' | 'PUBLISHED';

export type TemplateThumbnailQuery =
  | { sourceKind: 'DRAFT'; draftRevision: number; sourceChecksum: string }
  | { sourceKind: 'PUBLISHED'; versionId: string; sourceChecksum: string };

export type TemplateThumbnailRetryRequest =
  | { sourceKind: 'DRAFT'; draftRevision: number; sourceChecksum: string }
  | { sourceKind: 'PUBLISHED'; versionId: string; sourceChecksum: string };

/**
 * 202 body of POST templates/:id/thumbnail/retry (backend TemplateThumbnailAcceptedMetadata).
 * The render runs on the worker; `location` is the pinned thumbnail GET path, which answers
 * 409 CORE.TEMPLATE.THUMBNAIL.NOT_READY while the job is PENDING.
 */
export interface TemplateThumbnailRetryResponse {
  kind: 'THUMBNAIL_ACCEPTED';
  thumbnailJobId: string;
  state: 'PENDING';
  generation: number;
  sourceChecksum: string;
  location: string;
}

/** Library list query and row DTOs (§1). */
export type TemplateListSortBy = 'updatedAt' | 'createdAt' | 'code' | 'name' | 'publishedVersionNumber';

export type TemplateSortDirection = 'asc' | 'desc';

export interface TemplateListRequestDto {
  assignmentScopeType: TemplateAssignmentScopeType;
  assignmentCompanyId?: string;
  assignmentBranchId?: string;
  name?: string;
  code?: string;
  documentType?: TemplateDocumentType;
  outputChannel?: TemplateOutputChannel;
  layoutMode?: TemplateLayoutMode;
  lifecycleStatus?: TemplateLifecycleStatus;
  locale?: string;
  definitionScopeType?: TemplateDefinitionScopeType;
  definitionCompanyId?: string;
  updatedFrom?: string;
  updatedTo?: string;
  updatedBy?: string;
  hasPublishedVersion?: boolean;
  sortBy?: TemplateListSortBy;
  sortDirection?: TemplateSortDirection;
  limit?: number;
  cursor?: string | null;
}

export type TemplateAssignmentMatchKind = 'EXACT' | 'DEFAULT';

export type TemplateAssignmentSummaryState = 'NONE' | 'SINGLE' | 'MULTIPLE';

export interface TemplateAssignmentCandidate {
  assignmentId: string;
  versionId: string;
  versionNumber: number;
  scope: TemplateScopeRef;
  locale: TemplateLocale | null;
  localeMatch: TemplateAssignmentMatchKind;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface TemplateRowAssignmentSummary {
  requestedTarget: TemplateScopeRef;
  evaluatedAt: string;
  state: TemplateAssignmentSummaryState;
  effectiveCandidateCount: number;
  primary: TemplateAssignmentCandidate | null;
  candidates: TemplateAssignmentCandidate[];
  additionalCount: number;
}

export interface TemplateRowDraftSummary {
  draftId: string;
  revision: number;
  validationState: TemplateValidationState;
}

export interface TemplateRowPublishedVersionSummary {
  versionId: string;
  versionNumber: number;
  status: TemplateVersionStatus;
  publishedAt: string;
}

export interface TemplateListRow {
  templateId: string;
  thumbnail: TemplateThumbnail;
  name: string;
  code: string;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  lifecycleStatus: TemplateLifecycleStatus;
  draft: TemplateRowDraftSummary;
  currentPublishedVersion: TemplateRowPublishedVersionSummary | null;
  locale: TemplateLocale;
  direction: TemplateDirection;
  resolvedDirection: TemplateResolvedDirection;
  definitionScope: TemplateDefinitionScope;
  assignment: TemplateRowAssignmentSummary;
  updatedAt: string;
  createdAt: string;
  author: TemplateAuthor;
  definitionRevision: number;
  definitionEtag: string;
  actions: TemplateListActions;
}

export interface TemplateListResponse {
  items: TemplateListRow[];
  totalCount: number;
  pageInfo: TemplatePageInfo;
  sort: {
    by: TemplateListSortBy;
    direction: TemplateSortDirection;
  };
  assignmentTarget: TemplateScopeRef;
  assignmentEvaluatedAt: string;
}

export type TemplateCreationScope =
  | { type: 'TENANT' }
  | { type: 'COMPANY'; companyId: string; label: string };

export interface TemplateCreationScopesResponse {
  scopes: TemplateCreationScope[];
}

/** Data sources, schemas, starters, create and duplicate (§2, §5). */
export interface TemplateDataSourcesQuery {
  scopeType: TemplateAssignmentScopeType;
  companyId?: string;
  branchId?: string;
  documentType?: TemplateDocumentType;
  outputChannel?: TemplateOutputChannel;
  layoutMode?: TemplateLayoutMode;
}

/** Backend productionDisabledReason for adapters outside PRODUCTION_ASSIGNABLE_TEMPLATE_TUPLES. */
export type TemplateProductionDisabledReason = 'OWNER_RUNTIME_UNAVAILABLE';

export interface TemplateDataSourceItem {
  adapterKey: TemplateDataSourceKey;
  productionAssignmentEnabled: boolean;
  productionDisabledReason: TemplateProductionDisabledReason | null;
  schemaVersion: number;
  schemaChecksum: string;
  documentType: TemplateDocumentType;
  allowedOutputChannels: TemplateOutputChannel[];
  allowedLayoutModes: TemplateLayoutMode[];
  supportedLocales: TemplateLocale[];
  fieldCount: number;
}

export interface TemplateDataSourcesResponse {
  registryVersion: string;
  registryChecksum: string;
  items: TemplateDataSourceItem[];
}

export type TemplateFieldDataType =
  | 'STRING'
  | 'NUMBER'
  | 'DECIMAL'
  | 'CURRENCY'
  | 'PERCENTAGE'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'IMAGE'
  | 'OBJECT'
  | 'ARRAY';

export type TemplateAllowedFormatKind =
  | 'TEXT'
  | 'NUMBER'
  | 'CURRENCY'
  | 'PERCENTAGE'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN';

export type TemplateValueEncoding =
  | 'UTF8_NFC'
  | 'ISO_DATE'
  | 'ISO_DATETIME'
  | 'BOOLEAN'
  | 'ASSET_UUIDV7'
  | 'OBJECT'
  | 'ARRAY'
  | 'DECIMAL_STRING_18_6'
  | 'DECIMAL_STRING_24_8'
  | 'DECIMAL_STRING_20_3'
  | 'INTEGER_STRING';

export interface TemplateSchemaField {
  path: string;
  labelKey: string;
  dataType: TemplateFieldDataType;
  nullable: boolean;
  parentNullable: boolean;
  sensitive: boolean;
  previewAllowed: boolean;
  allowedFormats: TemplateAllowedFormatKind[];
  valueEncoding: TemplateValueEncoding;
  maxLength: number | null;
  minItems: number | null;
  maxItems: number | null;
  itemPathPrefix: string | null;
}

export interface TemplateSyntheticFixture {
  fixtureKey: string;
  locale: TemplateLocale;
  labelKey: string;
  fixtureChecksum: string;
}

export interface TemplateDataSourceSchemaQuery {
  scopeType: TemplateAssignmentScopeType;
  companyId?: string;
  branchId?: string;
  schemaVersion: 1 | 2;
}

/** Backend TemplateProducerPackageName (registry/template-owner-context.ts). */
export type TemplateProducerPackageName =
  | '@mutakamel/template-schema'
  | '@mutakamel/template-engine'
  | '@mutakamel/trade-app-contracts'
  | '@mutakamel/crm-app-contracts'
  | '@mutakamel/core-app-contracts';

/** Backend TemplateProducerPackagePin. */
export interface TemplateProducerPackagePin {
  name: TemplateProducerPackageName;
  version: string;
  manifestSha256: string;
  entrypointSha256: string;
}

/** Backend TemplateOwnerContextPins. */
export interface TemplateOwnerContextPins {
  schema: TemplateProducerPackagePin;
  engine: TemplateProducerPackagePin;
  provider: TemplateProducerPackagePin;
}

/** The descriptor carried by admission and owner context (backend TemplateDataSchemaV1; only identity fields typed here). */
export interface TemplateOwnerDescriptor {
  key: TemplateDataSourceKey;
  version: number;
  checksum: string;
  [field: string]: unknown;
}

/** Backend TemplateDataSourceAdmissionV1. */
export interface TemplateDataSourceAdmission {
  contract: 'template-data-source-admission.v1';
  descriptorChecksum: string;
  pins: TemplateOwnerContextPins;
  fingerprint: string;
  descriptor: TemplateOwnerDescriptor;
}

/** Backend TemplateOwnerContextV1. */
export interface TemplateOwnerContext {
  contract: 'template-owner-context.v1';
  descriptorChecksum: string;
  descriptorCanonicalSha256: string;
  pins: TemplateOwnerContextPins;
  fingerprint: string;
  descriptor: TemplateOwnerDescriptor;
}

export interface TemplateDataSourceSchemaDto {
  adapterKey: TemplateDataSourceKey;
  productionAssignmentEnabled: boolean;
  productionDisabledReason: TemplateProductionDisabledReason | null;
  schemaVersion: number;
  schemaChecksum: string;
  documentType: TemplateDocumentType;
  allowedOutputChannels: TemplateOutputChannel[];
  allowedLayoutModes: TemplateLayoutMode[];
  supportedLocales: TemplateLocale[];
  fieldCount: number;
  /** Backend templateDataSourceOwnerContext(descriptor).admission; absent for adapters without an owner. */
  admission?: TemplateDataSourceAdmission;
  /** Backend templateDataSourceOwnerContext(descriptor).ownerContext; absent for adapters without an owner. */
  ownerContext?: TemplateOwnerContext;
  capabilities?: {
    /** Backend: `{ kind: SALES_DRAFT_SCHEMA_PRECONDITION, scope }` with the closed scope object. */
    draftSavePrecondition?: {
      kind: 'draft-schema';
      scope: TemplateDefinitionScope;
    };
  };
  fields: TemplateSchemaField[];
  syntheticFixtures: TemplateSyntheticFixture[];
}

export interface TemplateStartersQuery {
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  locale: TemplateLocale;
  direction: TemplateDirection;
  definitionScopeType: TemplateDefinitionScopeType;
  definitionCompanyId?: string;
}

export type TemplatePagePreset = 'A4' | 'A5' | 'LETTER' | 'CUSTOM';

export type TemplatePageOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface TemplateLogicalMarginsMm {
  top: number;
  end: number;
  bottom: number;
  start: number;
}

export interface TemplateStarterDefaultPage {
  preset: TemplatePagePreset;
  orientation: TemplatePageOrientation;
  marginMm: TemplateLogicalMarginsMm;
  widthMm?: number;
  heightMm?: number;
}

export interface TemplateStarterOption {
  starterKey: string;
  displayName: string;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  locale: TemplateLocale;
  resolvedDirection: TemplateResolvedDirection;
  editorSchemaVersion: 1;
  nodeRegistryVersion: 'mvp-v1';
  templateContentChecksum: string;
  descriptorChecksum: string;
  thumbnail: TemplateThumbnail;
  defaultPage?: TemplateStarterDefaultPage;
}

export interface TemplateStartersResponse {
  items: TemplateStarterOption[];
  count: number;
  registryVersion: string;
  registryFingerprint: string;
}

export interface CreateTemplatePageDto {
  preset: TemplatePagePreset;
  orientation: TemplatePageOrientation;
  widthMm?: number;
  heightMm?: number;
  marginMm: TemplateLogicalMarginsMm;
}

export interface CreateTemplateDto {
  code: string;
  name: string;
  description?: string;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  locale: TemplateLocale;
  direction: TemplateDirection;
  scope: TemplateDefinitionScope;
  page?: CreateTemplatePageDto;
  starterKey?: string;
}

export interface CreateTemplateResponse {
  definition: TemplateDefinitionDetail;
  draft: TemplateDraftDto;
}

export type DuplicateTemplateSource =
  | { kind: 'CURRENT_DRAFT'; expectedDraftRevision: number }
  | { kind: 'VERSION'; versionId: string };

export interface DuplicateTemplateDto {
  source: DuplicateTemplateSource;
  code: string;
  name: string;
  description?: string | null;
  scope: TemplateDefinitionScope;
  locale?: TemplateLocale;
  direction?: TemplateDirection;
  copyAssignments: false;
  conversion?: {
    layoutMode: TemplateConvertibleLayoutMode;
  };
}

/** Definition detail & metadata updates (§3). */
export interface TemplateVersionRef {
  templateDefinitionId: string;
  templateVersionId: string;
  versionNumber: number;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  locale: TemplateLocale;
  direction: TemplateResolvedDirection;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  templateContentChecksum: string;
  compiledChecksum: string;
  compilerFingerprint: string;
  lifecycleStatus: TemplateVersionStatus;
  publishedAt: string;
}

export interface TemplateDefinitionDraftRef {
  draftId: string;
  revision: number;
  contentChecksum: string;
  validationState: TemplateValidationState;
  etag: string;
}

export interface TemplateDefinitionDetail {
  templateId: string;
  thumbnail: TemplateThumbnail;
  code: string;
  name: string;
  description: string | null;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  locale: TemplateLocale;
  direction: TemplateDirection;
  resolvedDirection: TemplateResolvedDirection;
  scope: TemplateDefinitionScope;
  lifecycleStatus: TemplateLifecycleStatus;
  systemProtected: boolean;
  revision: number;
  etag: string;
  currentDraft: TemplateDefinitionDraftRef;
  currentPublishedVersion: TemplateVersionRef | null;
  createdAt: string;
  createdBy: TemplateAuthor;
  updatedAt: string;
  updatedBy: TemplateAuthor;
  archivedAt: string | null;
  capabilities: TemplateDetailCapabilities;
}

export interface PatchTemplateDefinitionDto {
  name?: string;
  description?: string | null;
  direction?: TemplateDirection;
  expectedDraftRevision?: number;
}

export interface PatchTemplateDefinitionResponse {
  definition: TemplateDefinitionDetail;
  draft: TemplateDraftDto | null;
}

/** Draft, validation & publish (§4). */
export interface TemplateDraftValidationSummary {
  state: TemplateValidationState;
  lastValidationRunId: string | null;
  validatedDraftRevision: number | null;
  errorCount: number;
  warningCount: number;
}

export interface TemplateDraftDto {
  draftId: string;
  templateId: string;
  editorDocument: TemplateDocumentV1;
  schemaVersion: 1;
  contentChecksum: string;
  baseVersionId: string | null;
  restoreSourceVersionId: string | null;
  validation: TemplateDraftValidationSummary;
  revision: number;
  etag: string;
  updatedAt: string;
  updatedBy: TemplateAuthor;
}

export interface TemplateMigrationRecoverySummary {
  snapshotId: string;
  fromSchemaVersion: number;
  toSchemaVersion: number;
  sourceDraftRevision: number;
  sourceContentChecksum: string;
  expiresAt: string;
}

export interface PatchTemplateDraftDto {
  editorDocument: TemplateDocumentV1;
  clientMutationId: string;
  changeSummary?: string;
}

export interface PatchTemplateDraftResponse {
  draft: TemplateDraftDto;
  thumbnail: TemplateThumbnail;
  migrationRecovery: TemplateMigrationRecoverySummary | null;
}

export type TemplateRendererTarget = 'HTML' | 'PDF' | 'EMAIL_HTML' | 'EMAIL_TEXT';

export interface ValidateTemplateDraftDto {
  draftRevision: number;
  rendererTargets: [TemplateRendererTarget, TemplateRendererTarget];
  fixtureKey?: string;
}

export interface TemplateValidationIssue {
  severity: TemplateIssueSeverity;
  code: string;
  jsonPointer: string;
  nodeId: string | null;
  messageKey: string;
  params: Record<string, string | number | boolean>;
}

export interface TemplateValidationRunDto {
  validationRunId: string;
  templateId: string;
  draftId: string;
  draftRevision: number;
  candidateChecksum: string;
  editorSchemaVersion: number;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  nodeRegistryVersion: string;
  compilerVersion: string;
  compilerFingerprint: string;
  rendererTargets: TemplateRendererTarget[];
  assetResolutionFingerprint: string;
  fixtureChecksum: string;
  issues: TemplateValidationIssue[];
  startedAt: string;
  completedAt: string;
  status: TemplateValidationRunStatus;
  compiledChecksum: string | null;
}

export interface PublishTemplateRequestDto {
  definitionRevision: number;
  draftRevision: number;
  validationRunId: string;
  changeNote?: string;
  setAsDefinitionPublished: true;
}

export interface PublishTemplateResponseDto {
  version: TemplateVersionDetail;
  thumbnail: TemplateThumbnail;
  definitionRevision: number;
  definitionEtag: string;
  consumedDraftRevision: number;
  draftEtag: string;
}

/** TemplateDocumentV1 editor schema (§7). */
export type SafeColor = string;

export type TemplatePageBackground =
  | { kind: 'SOLID'; color: SafeColor }
  | { kind: 'ASSET'; assetId: string; fit: 'COVER' | 'CONTAIN'; opacity: number };

export interface TemplatePageConfig {
  unit: 'MM';
  preset: TemplatePagePreset;
  widthMm: number;
  heightMm: number;
  orientation: TemplatePageOrientation;
  marginMm: TemplateLogicalMarginsMm;
  bleedMm?: 0;
  background?: TemplatePageBackground;
}

export interface TemplateCanvasPage {
  id: string;
  name: string;
  page: TemplatePageConfig;
  rootNodeIds: string[];
}

export type TemplateBindingNullBehavior = 'EMPTY' | 'FALLBACK' | 'ERROR';

export type TemplateTextTransform = 'NONE' | 'UPPERCASE' | 'LOWERCASE';

export type TemplateDateStyle = 'SHORT' | 'MEDIUM' | 'LONG';

export type TemplateTimeStyle = 'SHORT' | 'MEDIUM';

export type TemplateBindingFormat =
  | { kind: 'TEXT'; transform?: TemplateTextTransform }
  | { kind: 'NUMBER'; minFractionDigits?: number; maxFractionDigits?: number; useGrouping?: boolean }
  | {
      kind: 'CURRENCY';
      currencyCodePath?: string;
      minFractionDigits?: number;
      maxFractionDigits?: number;
      useGrouping?: boolean;
    }
  | { kind: 'PERCENTAGE'; minFractionDigits?: number; maxFractionDigits?: number; useGrouping?: boolean }
  | { kind: 'DATE'; dateStyle: TemplateDateStyle }
  | { kind: 'DATETIME'; dateStyle: TemplateDateStyle; timeStyle: TemplateTimeStyle }
  | { kind: 'BOOLEAN'; trueText: string; falseText: string };

export interface TemplateBinding {
  path: string;
  nullBehavior: TemplateBindingNullBehavior;
  fallback?: string;
  format?: TemplateBindingFormat;
}

export type TemplateTextSegment =
  | { kind: 'TEXT'; value: string }
  | { kind: 'BINDING'; binding: TemplateBinding };

export interface TemplateTextTemplate {
  segments: TemplateTextSegment[];
}

export interface TemplateEmailConfig {
  maxWidthPx: number;
  subject: TemplateTextTemplate;
  preheader?: TemplateTextTemplate;
  backgroundColor?: SafeColor;
}

export type TemplateFontFamilyToken = 'SYSTEM_SANS' | 'ARABIC_SANS' | 'SYSTEM_SERIF';

export interface TemplateTheme {
  fontFamilyToken: TemplateFontFamilyToken;
  baseFontSizePx: number;
  textColor: SafeColor;
  accentColor?: SafeColor;
  surfaceColor?: SafeColor;
  lineHeight: number;
}

export interface TemplateFlowWidth {
  value: number;
  unit: 'PERCENT' | 'MM' | 'PX';
}

export interface TemplateFlowMinHeight {
  value: number;
  unit: 'MM' | 'PX';
}

export interface TemplateFlowLayout {
  kind: 'FLOW';
  order: number;
  width?: TemplateFlowWidth;
  minHeight?: TemplateFlowMinHeight;
  keepTogether?: boolean;
  breakBefore?: boolean;
  breakAfter?: boolean;
}

export interface TemplateAbsoluteLayout {
  kind: 'ABSOLUTE';
  unit: 'MM';
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
  zIndex: number;
}

export type TemplateNodeLayout = TemplateFlowLayout | TemplateAbsoluteLayout;

export type TemplateFontWeight = 'NORMAL' | 'MEDIUM' | 'SEMIBOLD' | 'BOLD';

export type TemplateFontStyle = 'NORMAL' | 'ITALIC';

export type TemplateTextDecoration = 'NONE' | 'UNDERLINE';

export type TemplateTextAlign = 'START' | 'CENTER' | 'END' | 'JUSTIFY';

export type TemplateTableAlign = 'START' | 'CENTER' | 'END';

export type TemplateVerticalAlign = 'TOP' | 'MIDDLE' | 'BOTTOM';

export type TemplateBorderStyle = 'NONE' | 'SOLID' | 'DASHED' | 'DOTTED';

export type TemplateTableCellBorderStyle = 'SOLID' | 'DASHED' | 'DOTTED';

export type TemplateObjectFit = 'CONTAIN' | 'COVER' | 'FILL';

export type TemplateOverflowMode = 'VISIBLE' | 'HIDDEN' | 'WRAP';

export interface TemplateBoxSpacing {
  unit: 'PX' | 'MM';
  blockStart: number;
  inlineEnd: number;
  blockEnd: number;
  inlineStart: number;
}

export interface TemplateBorder {
  widthPx: number;
  style: TemplateBorderStyle;
  color: SafeColor;
}

export interface TemplateNodeStyle {
  fontFamilyToken?: TemplateFontFamilyToken;
  fontSizePx?: number;
  fontWeight?: TemplateFontWeight;
  fontStyle?: TemplateFontStyle;
  textDecoration?: TemplateTextDecoration;
  lineHeight?: number;
  letterSpacingPx?: number;
  color?: SafeColor;
  backgroundColor?: SafeColor;
  textAlign?: TemplateTextAlign;
  verticalAlign?: TemplateVerticalAlign;
  padding?: TemplateBoxSpacing;
  margin?: TemplateBoxSpacing;
  gapPx?: number;
  border?: TemplateBorder;
  borderRadiusPx?: number;
  objectFit?: TemplateObjectFit;
  opacity?: number;
  overflow?: TemplateOverflowMode;
}

export interface TemplateTableCellStyle {
  fontFamilyToken?: TemplateFontFamilyToken;
  fontSizePx?: number;
  fontWeight?: TemplateFontWeight;
  color?: SafeColor;
  backgroundColor?: SafeColor;
  paddingPx?: {
    top: number;
    end: number;
    bottom: number;
    start: number;
  };
  border?: {
    widthPx: number;
    style: TemplateTableCellBorderStyle;
    color: SafeColor;
  };
}

export type TemplateSafeLinkTarget = 'SAME_WINDOW' | 'NEW_WINDOW';

export type TemplateSafeLink =
  | { source: 'LITERAL'; href: string; target: TemplateSafeLinkTarget }
  | { source: 'BINDING'; binding: TemplateBinding; target: TemplateSafeLinkTarget };

export type TemplateVisibilityRuleOperator =
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'TRUTHY'
  | 'FALSY';

export interface TemplateVisibilityRule {
  path: string;
  operator: TemplateVisibilityRuleOperator;
  value?: string | number | boolean;
}

export type TemplateCompareOperator = 'EQ' | 'NE' | 'LT' | 'LTE' | 'GT' | 'GTE';

export type TemplateVisibilityExpression =
  | { kind: 'ALL'; operands: TemplateVisibilityExpression[] }
  | { kind: 'ANY'; operands: TemplateVisibilityExpression[] }
  | { kind: 'NOT'; operand: TemplateVisibilityExpression }
  | { kind: 'COMPARE'; operator: TemplateCompareOperator; path: string; value: string | number | boolean }
  | { kind: 'IS_NULL'; path: string }
  | { kind: 'IS_NOT_NULL'; path: string };

export type TemplateFormulaDimension = 'SCALAR' | 'MONEY' | 'QUANTITY' | 'UNIT_PRICE';

export type TemplateFormulaRounding = 'HALF_UP' | 'HALF_EVEN' | 'DOWN';

export type TemplateFormulaExpression =
  | {
      kind: 'DECIMAL_LITERAL';
      value: string;
      dimension?: TemplateFormulaDimension;
      currencyCode?: string;
      unitCode?: string;
    }
  | { kind: 'STRING_LITERAL'; value: string }
  | { kind: 'DATE_LITERAL'; value: string }
  | { kind: 'BOOLEAN_LITERAL'; value: boolean }
  | { kind: 'NULL_LITERAL' }
  | { kind: 'BINDING'; path: string; currencyCodePath?: string }
  | { kind: 'ROOT_BINDING'; path: string }
  | { kind: 'ROW_BINDING'; path: string }
  | { kind: 'FORMULA_REF'; formulaId: string }
  | { kind: 'PARAMETER'; name: string }
  | {
      kind: 'FUNCTION_CALL';
      functionVersionId: string;
      arguments: { name: string; expression: TemplateFormulaExpression }[];
    }
  | {
      kind: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'SUM' | 'MIN' | 'MAX' | 'COALESCE' | 'CONCAT';
      operands: TemplateFormulaExpression[];
    }
  | {
      kind: 'DIVIDE';
      dividend: TemplateFormulaExpression;
      divisor: TemplateFormulaExpression;
      scale: number;
      rounding: TemplateFormulaRounding;
    }
  | {
      kind: 'ROUND';
      value: TemplateFormulaExpression;
      scale: number;
      rounding: TemplateFormulaRounding;
    }
  | { kind: 'ABS' | 'NEGATE' | 'IS_NULL' | 'TRIM'; value: TemplateFormulaExpression }
  | { kind: 'DATE_ADD_DAYS'; date: TemplateFormulaExpression; days: TemplateFormulaExpression }
  | { kind: 'DATE_DIFF_DAYS'; left: TemplateFormulaExpression; right: TemplateFormulaExpression }
  | {
      kind: 'COMPARE';
      operator: TemplateCompareOperator;
      left: TemplateFormulaExpression;
      right: TemplateFormulaExpression;
    }
  | {
      kind: 'IF';
      condition: TemplateFormulaExpression;
      whenTrue: TemplateFormulaExpression;
      whenFalse: TemplateFormulaExpression;
    }
  | { kind: 'SUM_ROWS'; sourcePath: string; item: TemplateFormulaExpression };

export type TemplateRichTextMark =
  | { type: 'bold' | 'italic' | 'underline' }
  | { type: 'link'; attrs: TemplateSafeLink };

export type TemplateRichTextInline =
  | { type: 'text'; text: string; marks?: TemplateRichTextMark[] }
  | { type: 'variable'; attrs: { binding: TemplateBinding } }
  | { type: 'hardBreak' };

export interface TemplateRichTextParagraphBlock {
  type: 'paragraph';
  attrs?: { textAlign?: TemplateTextAlign };
  content?: TemplateRichTextInline[];
}

export interface TemplateRichTextHeadingBlock {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6; textAlign?: TemplateTextAlign };
  content?: TemplateRichTextInline[];
}

export interface TemplateRichTextListItem {
  type: 'listItem';
  content: [TemplateRichTextParagraphBlock];
}

export interface TemplateRichTextListBlock {
  type: 'bulletList' | 'orderedList';
  content: TemplateRichTextListItem[];
}

export type TemplateRichTextBlock =
  | TemplateRichTextParagraphBlock
  | TemplateRichTextHeadingBlock
  | TemplateRichTextListBlock;

export interface TemplateRichTextDocument {
  type: 'doc';
  content: TemplateRichTextBlock[];
}

export type TemplateTableCellValue =
  | { kind: 'TEXT'; value: string }
  | { kind: 'BINDING'; binding: TemplateBinding }
  | { kind: 'FORMULA'; expression: TemplateFormulaExpression; format?: TemplateBindingFormat };

export interface TemplateTableCell {
  id: string;
  columnId: string;
  rowSpan?: number;
  colSpan?: number;
  value: TemplateTableCellValue;
  style?: TemplateTableCellStyle;
}

export interface TemplateTableRow {
  id: string;
  cells: TemplateTableCell[];
}

export interface TemplateTableBand {
  id: string;
  rows: TemplateTableRow[];
}

export type TemplateTableRepeatHeader = 'EVERY_PAGE' | 'FIRST_PAGE_ONLY';

export type TemplateTableRowSplit = 'ALLOW' | 'AVOID';

export interface TemplateStaticTableColumn {
  id: string;
  width: { value: number; unit: 'MM' | 'PERCENT' };
  align: TemplateTableAlign;
  verticalAlign?: TemplateVerticalAlign;
  wrap?: boolean;
  visible: boolean;
  headerStyle?: TemplateTableCellStyle;
  cellStyle?: TemplateTableCellStyle;
}

export interface TemplateStaticTableFixedCanvasPolicy {
  rowHeightsMm: number[];
  overflow: 'REJECT';
  wrapCells?: boolean;
}

export interface TemplateProductImageColumnSpec {
  type: 'productImage';
  props: {
    alt?: string;
    heightMm: number;
    objectFit?: TemplateObjectFit;
  };
}

export type TemplateDynamicTableColumn = TemplateStaticTableColumn & {
  header: TemplateTableCellValue;
} & ({ value: TemplateTableCellValue } | { productImage: TemplateProductImageColumnSpec });

export type TemplateDynamicTableEmptyBehavior = 'MESSAGE' | 'HEADER_ONLY' | 'MIN_ROWS';

export interface TemplateDynamicTableFixedCanvasPolicy {
  maxRenderedRows: number;
  overflow: 'REJECT' | 'CLIP';
  clippingAcknowledged?: boolean;
}

export interface TemplateTotalsRow {
  id: string;
  label: string;
  binding: TemplateBinding;
  emphasis: 'NORMAL' | 'STRONG' | 'GRAND_TOTAL';
  visible: boolean;
}

export type TemplateNodeType =
  | 'text'
  | 'richText'
  | 'image'
  | 'dataField'
  | 'container'
  | 'group'
  | 'row'
  | 'column'
  | 'divider'
  | 'spacer'
  | 'link'
  | 'button'
  | 'totals'
  | 'pageBreak'
  | 'header'
  | 'footer'
  | 'staticTable'
  | 'dynamicTable'
  | 'formula';

export interface TemplateNodeBase {
  id: string;
  parentId: string | null;
  childIds: string[];
  name?: string;
  locked: boolean;
  hidden: boolean;
  layout: TemplateNodeLayout;
  style: TemplateNodeStyle;
  /** Mutually exclusive with `visibilityExpression`. */
  visibilityRule?: TemplateVisibilityRule;
  /** Mutually exclusive with `visibilityRule`. */
  visibilityExpression?: TemplateVisibilityExpression;
}

export interface TemplateTextNode extends TemplateNodeBase {
  type: 'text';
  props: { text: string };
}

export interface TemplateRichTextNode extends TemplateNodeBase {
  type: 'richText';
  props: { document: TemplateRichTextDocument };
}

export interface TemplateImageNode extends TemplateNodeBase {
  type: 'image';
  props: {
    assetId: string;
    alt: string;
    decorative: boolean;
    crop?: { focalX: number; focalY: number };
    link?: TemplateSafeLink;
  };
}

export interface TemplateDataFieldNode extends TemplateNodeBase {
  type: 'dataField';
  binding: TemplateBinding;
  props: {
    label?: string;
    labelPosition?: 'BEFORE' | 'ABOVE';
    separator?: string;
  };
}

export interface TemplateContainerNode extends TemplateNodeBase {
  type: 'container';
  props: {
    semanticRole?: 'SECTION' | 'CARD' | 'BODY';
  };
}

export interface TemplateGroupNode extends TemplateNodeBase {
  type: 'group';
  layout: TemplateAbsoluteLayout;
  props: {
    clipContent: false;
  };
}

export interface TemplateRowNode extends TemplateNodeBase {
  type: 'row';
  props: {
    stackOnMobile: boolean;
    verticalAlign: TemplateVerticalAlign;
  };
}

export interface TemplateColumnNode extends TemplateNodeBase {
  type: 'column';
  props: {
    widthPercent: number;
  };
}

export interface TemplateDividerNode extends TemplateNodeBase {
  type: 'divider';
  props: {
    thicknessPx: number;
    style: 'SOLID' | 'DASHED' | 'DOTTED';
    color: SafeColor;
  };
}

export interface TemplateSpacerNode extends TemplateNodeBase {
  type: 'spacer';
  props: {
    heightPx: number;
  };
}

export interface TemplateLinkNode extends TemplateNodeBase {
  type: 'link';
  props: {
    label: TemplateTextTemplate;
    link: TemplateSafeLink;
  };
}

export interface TemplateButtonNode extends TemplateNodeBase {
  type: 'button';
  props: {
    label: TemplateTextTemplate;
    link: TemplateSafeLink;
    fullWidthOnMobile: boolean;
  };
}

export interface TemplateTotalsNode extends TemplateNodeBase {
  type: 'totals';
  props: {
    rows: TemplateTotalsRow[];
  };
}

export interface TemplatePageBreakNode extends TemplateNodeBase {
  type: 'pageBreak';
  props: Record<string, never>;
}

export interface TemplateHeaderNode extends TemplateNodeBase {
  type: 'header';
  props: {
    zoneMode: 'FIXED' | 'FLOW';
    heightMm: number;
    repeat: 'EVERY_PAGE' | 'FIRST_PAGE';
  };
}

export interface TemplateFooterNode extends TemplateNodeBase {
  type: 'footer';
  props: {
    zoneMode: 'FIXED' | 'FLOW';
    heightMm: number;
    repeat: 'EVERY_PAGE' | 'LAST_PAGE';
  };
}

export interface TemplateStaticTableNode extends TemplateNodeBase {
  type: 'staticTable';
  props: {
    columns: TemplateStaticTableColumn[];
    rows: TemplateTableRow[];
    repeatHeader: TemplateTableRepeatHeader;
    keepRowsTogether: boolean;
    rowSplit: TemplateTableRowSplit;
    stripedRows: boolean;
    fixedCanvas?: TemplateStaticTableFixedCanvasPolicy;
  };
}

export interface TemplateDynamicTableNode extends TemplateNodeBase {
  type: 'dynamicTable';
  props: {
    sourcePath: string;
    rowKeyPath?: string;
    columns: TemplateDynamicTableColumn[];
    headerBands?: TemplateTableBand[];
    footerBands?: TemplateTableBand[];
    repeatHeader: TemplateTableRepeatHeader;
    keepRowsTogether: boolean;
    rowSplit: TemplateTableRowSplit;
    minimumEmptyRows: number;
    emptyBehavior: TemplateDynamicTableEmptyBehavior;
    emptyMessage?: string;
    stripedRows: boolean;
    fixedCanvas?: TemplateDynamicTableFixedCanvasPolicy;
  };
}

export interface TemplateFormulaNode extends TemplateNodeBase {
  type: 'formula';
  props: {
    formulaId: string;
    expression: TemplateFormulaExpression;
    format?: TemplateBindingFormat;
  };
}

export type TemplateNode =
  | TemplateTextNode
  | TemplateRichTextNode
  | TemplateImageNode
  | TemplateDataFieldNode
  | TemplateContainerNode
  | TemplateGroupNode
  | TemplateRowNode
  | TemplateColumnNode
  | TemplateDividerNode
  | TemplateSpacerNode
  | TemplateLinkNode
  | TemplateButtonNode
  | TemplateTotalsNode
  | TemplatePageBreakNode
  | TemplateHeaderNode
  | TemplateFooterNode
  | TemplateStaticTableNode
  | TemplateDynamicTableNode
  | TemplateFormulaNode;

export interface TemplateDocumentMetadata {
  editorNote?: string;
  starterKey?: string;
  migratedFromSchemaVersion?: number;
  schemaCapabilities?: Record<string, unknown>;
}

export interface TemplateDocumentV1 {
  schemaVersion: 1;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  dataSourceKey: TemplateDataSourceKey;
  locale: TemplateLocale;
  direction: TemplateDirection;
  page?: TemplatePageConfig;
  canvasPages?: TemplateCanvasPage[];
  email?: TemplateEmailConfig;
  theme: TemplateTheme;
  rootNodeIds: string[];
  nodes: Record<string, TemplateNode>;
  metadata?: TemplateDocumentMetadata;
}

/** Versions & recovery snapshots (§9). */
export interface TemplateVersionsListQuery {
  lifecycleStatus?: TemplateVersionStatus;
  publishedFrom?: string;
  publishedTo?: string;
  cursor?: string | null;
  limit?: number;
}

export interface TemplateVersionItem {
  templateDefinitionId: string;
  templateVersionId: string;
  versionNumber: number;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  layoutMode: TemplateLayoutMode;
  locale: TemplateLocale;
  direction: TemplateResolvedDirection;
  dataSourceKey: TemplateDataSourceKey;
  dataSourceSchemaVersion: number;
  dataSourceSchemaChecksum: string;
  templateContentChecksum: string;
  compiledChecksum: string;
  compilerFingerprint: string;
  lifecycleStatus: TemplateVersionStatus;
  publishedAt: string;
  restoredFromVersionId: string | null;
  changeNote: string | null;
  publishedBy: TemplateAuthor;
  retiredAt: string | null;
  retiredBy: TemplateAuthor | null;
}

export interface TemplateVersionManifestBinding {
  path: string;
  nodeId: string;
}

export interface TemplateVersionManifestAsset {
  assetId: string;
  nodeId: string | null;
}

export interface TemplateVersionDetail extends TemplateVersionItem {
  editorDocument: TemplateDocumentV1;
  editorSchemaVersion: 1;
  nodeRegistryVersion: string;
  compilerVersion: string;
  validationRunId: string;
  rendererTargets: TemplateRendererTarget[];
  bindingManifest: TemplateVersionManifestBinding[];
  assetManifest: TemplateVersionManifestAsset[];
}

export interface RestoreTemplateVersionDto {
  reason: string;
  discardCurrentDraft: boolean;
}

export interface RestoreTemplateVersionResponse {
  draft: TemplateDraftDto;
  migrationRecovery: TemplateMigrationRecoverySummary | null;
}

export interface RetireTemplateVersionResponse {
  version: TemplateVersionItem;
  definitionRevision: number;
  definitionEtag: string;
}

export type TemplateRecoveryCaptureReason = 'PRE_SCHEMA_MIGRATION' | 'MATERIALIZE_FIXED_PAGES';

export type TemplateRecoveryIntegrityStatus = 'AVAILABLE' | 'QUARANTINED';

export interface TemplateRecoverySnapshotItem {
  snapshotId: string;
  sourceDraftRevision: number;
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  sourceContentChecksum: string;
  snapshotChecksum: string;
  captureReason: TemplateRecoveryCaptureReason;
  captureAuditId: string;
  createdAt: string;
  createdBy: TemplateAuthor;
  expiresAt: string;
  integrityStatus: TemplateRecoveryIntegrityStatus;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  cleanupRequestedAt: string | null;
  restoredAt: string | null;
  restoredBy: TemplateAuthor | null;
  restoredToDraftRevision: number | null;
  objectDeletedAt: string | null;
}

export interface TemplateRecoverySnapshotsQuery {
  cursor?: string | null;
  limit?: number;
}

export interface RestoreRecoverySnapshotDto {
  expectedSnapshotChecksum: string;
  reason: string;
  discardCurrentDraft: true;
}

export interface RestoreRecoverySnapshotResponse {
  draft: TemplateDraftDto;
  migrationRecovery: null;
  /** Backend recoveryDto(locked): the full restored snapshot item. */
  recoveredFrom: TemplateRecoverySnapshotItem;
  replacedDraftRecovery: TemplateMigrationRecoverySummary | null;
}

/** Assets (§10). */
export type TemplateAssetQueryScope = 'ALL_AUTHORIZED' | 'REUSABLE' | 'DEFINITION';

export type TemplateAssetType = 'IMAGE' | 'LOGO' | 'BACKGROUND';

export type TemplateAssetDeliveryClass = 'PRIVATE_ONLY' | 'EMAIL_PUBLIC';

export type TemplateAssetStatus = 'ACTIVE' | 'RETIRED';

export type TemplateAssetSort = 'createdAt:desc' | 'createdAt:asc' | 'fileName:asc' | 'fileName:desc';

export interface TemplateAssetsListQuery {
  scope?: TemplateAssetQueryScope;
  definitionId?: string;
  assetType?: TemplateAssetType;
  deliveryClass?: TemplateAssetDeliveryClass;
  status?: TemplateAssetStatus;
  search?: string;
  sort?: TemplateAssetSort;
  cursor?: string | null;
  limit?: number;
}

export type TemplateAssetEmailRendition =
  | { kind: 'READY'; checksum: string }
  | { kind: 'NOT_REQUESTED' };

export interface TemplateAssetDto {
  assetId: string;
  definitionId: string | null;
  assetType: TemplateAssetType;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  checksum: string;
  deliveryClass: TemplateAssetDeliveryClass;
  emailRendition: TemplateAssetEmailRendition;
  status: TemplateAssetStatus;
  revision: number;
  etag: string;
  createdAt: string;
  createdBy: TemplateAuthor;
  updatedAt: string;
  updatedBy: TemplateAuthor;
}

export type TemplateAssetDelivery =
  | { kind: 'SAME_ORIGIN_AUTHENTICATED_READ'; url: string }
  | { kind: 'UNAVAILABLE'; reason: string };

export interface TemplateAssetDetailResponse {
  asset: TemplateAssetDto;
  delivery: TemplateAssetDelivery;
}

export type TemplateAssetDeclaredMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export interface UploadTemplateAssetMetadataDto {
  definitionId?: string | null;
  assetType: TemplateAssetType;
  deliveryClass: TemplateAssetDeliveryClass;
  fileName: string;
  declaredMimeType: TemplateAssetDeclaredMimeType;
  expectedRawSha256: string;
  confirmPublicEmailDelivery?: true;
}

export interface UploadTemplateAssetRequest {
  metadata: UploadTemplateAssetMetadataDto;
  file: File;
}

export interface UploadTemplateAssetResponse {
  asset: TemplateAssetDto;
  /** Fresh delivery attached after commit (and on replay); new uploads are SAME_ORIGIN_AUTHENTICATED_READ. */
  delivery: TemplateAssetDelivery;
}

/** Assignments (§11). */
export type TemplateAssignmentStatus = 'ACTIVE' | 'INACTIVE';

export interface TemplateAssignmentsListQuery {
  scopeType: TemplateAssignmentScopeType;
  companyId?: string;
  branchId?: string;
  documentType?: TemplateDocumentType;
  outputChannel?: TemplateOutputChannel;
  adapterKey?: TemplateDataSourceKey;
  locale?: string;
  status?: TemplateAssignmentStatus;
  versionId?: string;
  effectiveAt?: string;
  cursor?: string | null;
  limit?: number;
}

export interface TemplateAssignmentDto {
  assignmentId: string;
  definitionId: string;
  versionId: string;
  versionNumber: number;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  adapterKey: TemplateDataSourceKey;
  locale: TemplateLocale | null;
  scope: TemplateScopeRef;
  priority: number;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: TemplateAssignmentStatus;
  revision: number;
  etag: string;
  createdAt: string;
  createdBy: TemplateAuthor;
  updatedAt: string;
  updatedBy: TemplateAuthor;
}

export interface TemplateAssignmentAffectedSelector {
  scope: TemplateScopeRef;
  locale: TemplateLocale | null;
  previousEpoch: string;
  assignmentEpoch: string;
}

export interface TemplateAssignmentImpact {
  effectiveNow: boolean;
  affectedSelectors: TemplateAssignmentAffectedSelector[];
}

export interface CreateTemplateAssignmentDto {
  versionId: string;
  adapterKey: TemplateDataSourceKey;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  locale: TemplateLocale | null;
  scope: TemplateScopeRef;
  priority: number;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PatchTemplateAssignmentDto {
  versionId?: string;
  priority?: number;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  status?: TemplateAssignmentStatus;
}

export interface TemplateAssignmentWriteResponse {
  assignment: TemplateAssignmentDto;
  impact: TemplateAssignmentImpact;
}

export interface AssignmentScopeOption {
  key: string;
  scope: TemplateScopeRef;
  icon: string;
  tile: string;
  label: string;
}

export type TemplateAssignmentScopeOption = AssignmentScopeOption;

export interface DocumentVisualDescriptor {
  icon: string;
  tile: string;
  labelKey: string;
}

export interface AssignmentSelectorOption {
  adapterKey: TemplateDataSourceKey;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  labelKey: string;
}

export interface OverlapCandidate {
  scope: TemplateScopeRef;
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  adapterKey: TemplateDataSourceKey;
  locale: TemplateLocale | null;
  priority: number;
  isDefault: boolean;
  status: TemplateAssignmentStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface ResolveTemplateAssignmentRequestDto {
  documentType: TemplateDocumentType;
  outputChannel: TemplateOutputChannel;
  adapterKey: TemplateDataSourceKey;
  locale: string;
  scope: TemplateScopeRef;
  businessTime?: string;
}

export interface ResolveTemplateAssignmentResponseDto {
  evaluatedAt: string;
  selector: {
    scope: TemplateScopeRef;
    documentType: TemplateDocumentType;
    outputChannel: TemplateOutputChannel;
    adapterKey: TemplateDataSourceKey;
    locale: string;
  };
  chosen: {
    assignmentId: string;
    matchedScope: TemplateScopeRef;
    localeMatch: TemplateAssignmentMatchKind;
    priority: number;
    version: TemplateVersionRef;
  } | null;
  eligibleCandidateCount: 0 | 1;
  orderedSelectorEpochs: {
    selectorFingerprintPrefix: string;
    assignmentEpoch: string;
  }[];
  receiptChecksum: string;
}

/** Previews & PDF jobs (§12). */
export type TemplatePreviewSource =
  | { kind: 'DRAFT'; draftRevision: number }
  | { kind: 'VERSION'; versionId: string };

export type TemplatePreviewSourceResolved =
  | { kind: 'DRAFT'; draftId: string; draftRevision: number }
  | { kind: 'VERSION'; versionId: string; versionNumber: number };

export type TemplatePreviewViewport = 'DESKTOP' | 'MOBILE';

export interface TemplateHtmlOrEmailPreviewRequestDto {
  source: TemplatePreviewSource;
  fixtureKey: string;
  locale: TemplateLocale;
  timeZone: string;
  currencyCode?: string;
  viewport?: TemplatePreviewViewport;
}

export interface TemplatePreviewWarning {
  code: string;
  messageKey: string;
  nodeId?: string | null;
}

export interface TemplateHtmlPreviewResponseDto {
  templateId: string;
  source: TemplatePreviewSourceResolved;
  templateContentChecksum: string;
  compiledArtifactChecksum: string;
  kind: 'HTML';
  renderTarget: 'HTML';
  html: string;
  outputChecksum: string;
  warnings: TemplatePreviewWarning[];
}

export interface TemplateEmailPreviewResponseDto {
  templateId: string;
  source: TemplatePreviewSourceResolved;
  templateContentChecksum: string;
  compiledArtifactChecksum: string;
  kind: 'EMAIL';
  renderTarget: 'EMAIL';
  subject: string;
  preheader: string | null;
  html: string;
  text: string;
  outputChecksum: string;
  warnings: TemplatePreviewWarning[];
}

export type TemplatePdfOwnerApp = 'trade-app' | 'core-app';

export type TemplatePdfPreviewDataSource =
  | { kind: 'SYNTHETIC'; fixtureKey: string }
  | {
      kind: 'AUTHORIZED_SNAPSHOT';
      selectionId: string;
      ownerApp: TemplatePdfOwnerApp;
      expectedOwnerScope: { companyId?: string; branchId?: string };
    };

export type TemplatePdfOutputProfile = 'DOCUMENT_PRINT' | 'EMAIL_PRINT_PROJECTION';

export interface TemplatePdfPreviewRequestDto {
  source: TemplatePreviewSource;
  dataSource: TemplatePdfPreviewDataSource;
  outputProfile?: TemplatePdfOutputProfile;
  locale: TemplateLocale;
  timeZone: string;
  currencyCode?: string;
  viewport?: TemplatePreviewViewport;
}

export type TemplatePdfJobStatus = 'RESOLVING_SOURCE' | 'PENDING' | 'RETRYING' | 'COMPLETED' | 'FAILED';

export interface TemplatePdfPreviewAcceptedDto {
  templateId: string;
  source: TemplatePreviewSourceResolved;
  templateContentChecksum: string;
  compiledArtifactChecksum: string;
  kind: 'PDF_ACCEPTED';
  renderTarget: 'PDF';
  outputProfile: TemplatePdfOutputProfile;
  renderJobId: string;
  status: 'PENDING' | 'RESOLVING_SOURCE';
  location: string;
  createdAt: string;
  expiresAt: string;
}

export interface TemplatePdfLayoutProof {
  checksum: string;
  pageCount: number;
  downloadPath: string;
}

export interface TemplatePdfJobArtifact {
  downloadUrl: string;
  downloadUrlExpiresAt: string;
  checksum: string;
  sizeBytes: number;
  pageCount: number;
  rendererVersion: string;
  browserBuildFingerprint: string;
  createdAt?: string;
  layoutReceiptChecksum?: string;
  layoutProof?: TemplatePdfLayoutProof;
  pdfPackagingPolicyVersion?: string;
  pdfPackagingFingerprint?: string;
}

export interface TemplatePdfJobFailure {
  code: string;
  failedAt: string;
  retryable: false;
  phase?: 'SOURCE_RESOLUTION' | 'SOURCE_PREPARATION' | 'WORKER';
}

export interface TemplatePdfJobDto {
  templateId: string;
  source: TemplatePreviewSourceResolved;
  templateContentChecksum: string;
  compiledArtifactChecksum: string;
  renderJobId: string;
  renderTarget: 'PDF';
  attemptCount: number;
  createdAt: string;
  expiresAt: string;
  lifecycleRevision: number;
  status: TemplatePdfJobStatus;
  nextRetryAt: string | null;
  failure: TemplatePdfJobFailure | null;
  artifact: TemplatePdfJobArtifact | null;
  outputProfile?: TemplatePdfOutputProfile;
  ownerDownloadPath?: string;
}

export interface TemplateLayoutReceiptPage {
  pageIndex: number;
  width: number;
  height: number;
}

export interface TemplateLayoutReceiptFragment {
  nodeId: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateLayoutReceiptV1 {
  layoutRuntimeChecksum: string;
  pagedRuntimeChecksum?: string;
  geometryUnit: 'MM' | 'CSS_PX';
  pageLayoutMode: 'UNIFORM' | 'EXPLICIT';
  pages: TemplateLayoutReceiptPage[];
  fragments?: TemplateLayoutReceiptFragment[];
  objects?: Record<string, unknown>[];
  dataRows?: Record<string, unknown>[];
  fonts?: string[];
}
