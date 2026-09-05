export type ApplicationType = "SYSTEM" | "TENANT";

export type ApplicationCommercialMode =
  | "NON_BILLABLE"
  | "INCLUDED"
  | "SUBSCRIPTION";

export type ApplicationCatalogueVisibility =
  | "PUBLIC"
  | "INTERNAL";

export type ApplicationLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DEPRECATED"
  | "DISABLED";

export type ApplicationPublicationStatus =
  | "UNPUBLISHED"
  | "PUBLISHED";

type ApplicationDatabaseAccessMode =
  | "NONE"
  | "TENANT_DATABASE";

export type ApplicationDatabaseDeployment =
  | "NONE"
  | "ON_DEMAND"
  | "PREWARM"
  | "REQUIRED";

type ApplicationCommandOperation =
  | "CREATE"
  | "UPDATE"
  | "ADOPT_TECHNICAL_PACKAGE"
  | "PUBLISH"
  | "DELETE"
  | "UPDATE_DATABASE_POLICY"
  | "ACTIVATE"
  | "DEPRECATE"
  | "DISABLE";

export type BillingCycle = "MONTHLY" | "ANNUAL";

type ApplicationManifestPublicationSource = "MIGRATION" | "SIGNED_API";

export type CatalogueAuditEntityType =
  | "MODULE"
  | "MODULE_ORDER"
  | "APPLICATION"
  | "TIER"
  | "FEATURE"
  | "TIER_FEATURE_GRANTS"
  | "PRICE_LADDER"
  | "TIER_STORAGE_ENTITLEMENT";

export interface ApplicationManifestEvidenceView {
  id: string;
  version: number;
  checksum: string;
  schemaVersion: number;
  contractPackage: string;
  contractVersion: string;
  publicationSource: ApplicationManifestPublicationSource;
  publishedAt: string;
  publishedBy: string;
  active: boolean;
}

export type ApplicationTechnicalReadinessReason =
  | "RUNTIME_TARGET_REQUIRED"
  | "COMPONENT_BINDING_REQUIRED"
  | "ACTIVE_COMPONENT_REQUIRED"
  | "PUBLISHED_RELEASE_REQUIRED"
  | "MINIMUM_RELEASE_NOT_SATISFIED"
  | "DATABASE_PERMISSION_MANIFEST_REQUIRED"
  | "DATABASE_PERMISSION_MANIFEST_INVALID";

type ApplicationTechnicalReadinessStatus =
  | "READY"
  | "NOT_REQUIRED"
  | "BLOCKED";

export type ApplicationSelectionBlocker =
  | "APPLICATION_LIFECYCLE_NOT_ACTIVE"
  | "APPLICATION_NOT_PUBLISHED"
  | "APPLICATION_NOT_PUBLIC"
  | "APPLICATION_NON_BILLABLE"
  | "TECHNICAL_READINESS_BLOCKED";

interface ApplicationTechnicalComponentView {
  id: string;
  key: string;
  ownerApp: string;
  workerTarget: string | null;
  kind: "FOUNDATION" | "MODULE";
  status: "ACTIVE" | "RETIRED";
  contractVersion: number;
  required: boolean;
  activationRequired: boolean;
  minimumRelease: string | null;
  latestPublishedRelease: {
    id: string;
    releaseVersion: string;
    manifestVersion: number;
    manifestChecksum: string;
    publishedAt: string;
  } | null;
}

export interface ApplicationTechnicalReadinessView {
  contractVersion: 1;
  applicationId: string;
  applicationKey: string;
  runtimeTarget: string | null;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
  lifecycleStatus: ApplicationLifecycleStatus;
  publicationStatus: ApplicationPublicationStatus;
  technicalDefinitionRevision: string;
  status: ApplicationTechnicalReadinessStatus;
  activationAllowed: boolean;
  selectionAllowed: boolean;
  selectionBlockers: ApplicationSelectionBlocker[];
  reasons: ApplicationTechnicalReadinessReason[];
  checks: {
    runtimeTarget: boolean;
    componentBinding: boolean;
    activeComponents: boolean;
    publishedReleases: boolean;
    minimumReleases: boolean;
    databasePermissionManifest: boolean;
  };
  components: ApplicationTechnicalComponentView[];
}

export interface CreateApplicationProvisioningBindingDto {
  expectedTechnicalDefinitionRevision: string;
  reason: string;
}

export interface AdoptApplicationTechnicalPackageDto {
  expectedTechnicalDefinitionRevision: string;
  reason: string;
}

interface ApplicationTechnicalIdentityView {
  runtimeTarget: string;
  primaryComponentKey: string;
  databasePrincipal: string | null;
  databaseDeployment: ApplicationDatabaseDeployment;
  contractVersion: 1;
}

interface ApplicationDatabasePolicyView {
  enableOnNewServers: boolean;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  policyRevision: string;
  updatedAt: string;
}

export interface ApplicationServerSummaryView {
  available: true;
  rolloutRequired: boolean;
  eligible: number;
  ready: number;
  pending: number;
  degraded: number;
  coveragePercent: number;
}

export interface ApplicationView {
  contractVersion: 1;
  id: string;
  key: string;
  name: string;
  description: string | null;
  avatarDataUrl: string | null;
  rank: number;
  applicationType: ApplicationType;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
  lifecycleStatus: ApplicationLifecycleStatus;
  runtimeTarget: string | null;
  publicationStatus: ApplicationPublicationStatus;
  publicationRevision: string;
  publishedAt: string | null;
  publishedBy: string | null;
  databaseAccessMode: ApplicationDatabaseAccessMode;
  databaseDeployment: ApplicationDatabaseDeployment;
  databasePrincipal: string | null;
  requiredOnDatabaseServer: boolean;
  technicalDefinitionRevision: string;
  catalogueRevision: string;
  activeManifest: ApplicationManifestEvidenceView | null;
  databasePolicy: ApplicationDatabasePolicyView;
  serverSummary: ApplicationServerSummaryView;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationMutationReceipt {
  contractVersion: 1;
  operation: ApplicationCommandOperation;
  applicationId: string;
  applicationKey: string;
  lifecycleStatus: ApplicationLifecycleStatus;
  runtimeTarget: string | null;
  databaseAccessMode: ApplicationDatabaseAccessMode;
  databaseDeployment: ApplicationDatabaseDeployment;
  databasePrincipal: string | null;
  technicalDefinitionRevision: string;
  publicationStatus: ApplicationPublicationStatus;
  publicationRevision: string;
  catalogueRevision: string;
  policyRevision: string;
  deleted: boolean;
  technicalIdentity?: ApplicationTechnicalIdentityView;
  technicalProvisioning?: {
    componentId: string;
    componentKey: string;
    ownerApp: string;
    workerTarget: string;
    contractVersion: 1;
  };
}

export type ApplicationDatabaseServerBindOutcome =
  | "BOUND"
  | "ALREADY_BOUND"
  | "FAILED";

export interface ApplicationDatabaseServerCandidateView {
  databaseServerId: string;
  name: string;
  host: string;
  port: number;
  serverStatus: string;
  countryIsoCode: string | null;
  currentTenants: number;
  maxTenants: number;
  bindingStatus: string | null;
  credentialRevision: string | null;
  safeFailureCode: string | null;
  /** The exact READY pin already exists, so re-binding is a no-op. */
  bound: boolean;
  bindable: boolean;
  blockedReason: string | null;
}

export interface ApplicationDatabaseServerCandidatesView {
  applicationId: string;
  applicationKey: string;
  applicationName: string;
  databasePrincipal: string | null;
  catalogueRevision: string;
  policyRevision: string | null;
  bindable: boolean;
  blockedReason: string | null;
  servers: ApplicationDatabaseServerCandidateView[];
}

export interface ApplicationDatabaseServerBindResult {
  databaseServerId: string;
  databaseServerName: string | null;
  outcome: ApplicationDatabaseServerBindOutcome;
  databasePrincipal: string | null;
  credentialRevision: string | null;
  bindingStatus: string | null;
  code: string | null;
  message: string | null;
}

export interface ApplicationDatabaseServerBindReceipt {
  applicationId: string;
  applicationKey: string;
  requested: number;
  bound: number;
  alreadyBound: number;
  failed: number;
  results: ApplicationDatabaseServerBindResult[];
  completedAt: string;
}

export interface BindApplicationDatabaseServersDto {
  databaseServerIds: string[];
  expectedCatalogueRevision: string;
  expectedPolicyRevision: string;
  reason: string;
}

export interface ApplicationListQueryDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  search?: string;
  applicationType?: ApplicationType;
  commercialMode?: ApplicationCommercialMode;
  catalogueVisibility?: ApplicationCatalogueVisibility;
  lifecycleStatus?: ApplicationLifecycleStatus;
  publicationStatus?: ApplicationPublicationStatus;
  databaseAccessMode?: ApplicationDatabaseAccessMode;
  databaseDeployment?: ApplicationDatabaseDeployment;
}

export interface CreateApplicationDto {
  key: string; // /^[a-z][a-z0-9_]{0,31}$/
  name: string; // 1..128 after trim
  description?: string; // max 512
  avatarDataUrl?: string; // PNG data URL, max 2,000,000
  applicationType: ApplicationType;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
}

export interface OnboardApplicationDto extends CreateApplicationDto {
  databaseDeployment: ApplicationDatabaseDeployment;
  reason: string; // non-empty, max 256
}

export interface UpdateApplicationDto {
  expectedCatalogueRevision: string; // positive integer string
  name?: string;
  description?: string | null;
  avatarDataUrl?: string | null;
  commercialMode?: ApplicationCommercialMode;
  catalogueVisibility?: ApplicationCatalogueVisibility;
}

export interface ApplicationLifecycleCommandDto {
  expectedCatalogueRevision: string;
  reason: string; // non-empty, max 256
}

export interface PublishApplicationDto {
  expectedCatalogueRevision: string;
  expectedPublicationRevision: string;
  reason: string; // non-empty, max 256
}

export interface UpdateApplicationDatabasePolicyDto {
  expectedPolicyRevision: string;
  enableOnNewServers?: boolean;
  rotationEnabled?: boolean;
  rotationIntervalHours?: number; // 24..8760 hours
  maintenanceWindowStartUtc?: number; // 0..23
  maintenanceWindowHours?: number; // 1..24
  reason: string; // non-empty, max 256
}

/* ==========================================================================
   Tiers, Features, Grants, Pricing, Currency Rates & Audit Interfaces/DTOs
   ========================================================================== */

export interface TierView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  rank: number;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateTierDto {
  key: string;
  name: string;
  color?: string;
  isActive?: boolean;
}

export interface UpdateTierDto {
  name?: string;
  rank?: number;
  color?: string;
  isActive?: boolean;
}

export interface FeatureView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateFeatureDto {
  key: string;
  name: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}

export interface UpdateFeatureDto {
  name?: string;
  description?: string;
  rank?: number;
  isActive?: boolean;
}

interface OutboundEmailConfig {
  dailyQuota: number;
  rateLimitPerMin: number;
}

export interface TierFeatureGrantView {
  id: string;
  tierId: string;
  featureId: string;
  config: OutboundEmailConfig | Record<string, unknown> | null;
  configRevision: number;
  createdAt: string;
  updatedAt: string;
}

interface TierFeatureInput {
  featureId: string;
  config?: OutboundEmailConfig | Record<string, unknown>;
}

export interface SetTierFeaturesDto {
  features: TierFeatureInput[];
}

export interface PriceTierView {
  id: string;
  tierId: string;
  billingCycle: BillingCycle;
  minUsers: number;
  maxUsers: number | null;
  unitPrice: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTierInput {
  minUsers: number;
  maxUsers?: number | null;
  unitPrice: string;
}

export interface SetPriceTiersDto {
  billingCycle: BillingCycle;
  brackets: PriceTierInput[];
}

export interface CurrencyRateView {
  currencyCode: string;
  currencyUnitsPerUsd: string;
  isActive: boolean;
}

export interface UpsertCurrencyRateDto {
  currencyUnitsPerUsd: string;
  isActive?: boolean;
}

export interface SetCurrencyRatesDto {
  rates: Array<UpsertCurrencyRateDto & { currencyCode: string }>;
}

export interface CatalogueAuditEventView {
  id: string;
  schemaVersion: number;
  entityType: CatalogueAuditEntityType;
  action: string;
  entityId: string;
  moduleId: string | null;
  tierId: string | null;
  actorAdminId: string | null;
  actorLabel: string | null;
  operationId: string | null;
  idempotencyKey: string | null;
  sourceType: string;
  sourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Array<Record<string, unknown>>;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface CatalogueAuditPageView {
  items: CatalogueAuditEventView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CatalogueAuditQueryDto {
  page?: number;
  limit?: number;
  entityType?: CatalogueAuditEntityType;
  action?: string;
  actorAdminId?: string;
  from?: string;
  to?: string;
}
