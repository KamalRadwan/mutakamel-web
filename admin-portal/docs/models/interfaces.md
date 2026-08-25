# Admin Portal — Key Interfaces & Types

Selected high-use response types. Last verified: **2026-08-09**.

---

## Auth Types

### `AdminMe` (`GET /api/admin/core/v1/auth/me` response)
```typescript
interface AdminMe {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  role: { id: string; name: string };
  status: UserStatusEnum;
  permissions: string[];
}
```

`roles` is not returned by `/auth/me`.

### `AdminAuthCookieResponse` (Admin Portal Login/Refresh)
```typescript
interface AdminAuthCookieResponse {
  tokenType: "Bearer";
  expiresIn: number;
  sessionExpiresIn: number;
  session: {
    id: string;
    clientType: string;
    createdAt: string;
    lastRefreshAt: string | null;
    lastUserActivityAt: string | null;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
    refreshUseCount: string;
    accessIssueCount: string;
    credentialVersion: number;
    authorizationVersion: number;
    profileVersion: number;
  };
}
```

In browser cookie mode both credentials are HttpOnly and intentionally absent
from JSON. The Portal rejects any cookie-mode response containing raw token
fields.

---

## Admin User Types

### `AdminUser`
```typescript
interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tier: AdminTierEnum;
  status: UserStatusEnum;
  roles: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}
```

### `AdminProfile`
```typescript
interface AdminProfile {
  themeKey: string;
  language: string;
  extensions: Record<string, unknown>;
}
```

---

## System Settings Types

```typescript
type SystemSettingValue = string | number | boolean;

interface MergedSystemSetting {
  key: string;
  value: SystemSettingValue;
  description: string;
  descriptionI18n: {
    en: string;
    ar: string;
  };
  isDefault: boolean;
  readOnly: boolean;
}

interface PlatformSmtpConfig {
  configured: boolean;
  revision: number | null;
  fromAddress: string | null;
  fromName: string | null;
  senderDomain: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpProtocol: 'smtp' | 'smtps' | null;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  updatedAt: string | null;
}

interface PlatformSmtpConfigHistory {
  id: string;
  action: 'CONFIGURED' | 'UPDATED' | 'CONNECTION_VERIFIED';
  revision: number | null;
  actor: string;
  changes: Array<{
    field: string;
    label: string;
    previousValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
  }>;
  createdAt: string;
}
```

The generic setting response does not expose schema constraints or timestamps.
SMTP credentials are write-only; only `smtpPasswordConfigured` is returned.
See the
[System Settings and Platform SMTP Frontend Contract](../api/system-settings.md).

---

## Tenant Types

### `TenantView`
```typescript
interface TenantView {
  id: string;
  name: string;
  companyName: string;
  countryName: string;
  countryIsoCode: string;
  industry?: string | null;
  timezone?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  address?: {
    city?: string;
    state?: string;
    district?: string;
    street1?: string;
    street2?: string;
    buildingNo?: string;
    postalCode?: string;
    landmark?: string;
    formattedAddress?: string;
  } | null;
  taxNumber?: string | null;
  commercialRegistrationNumber?: string | null;
  ownerEmail?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerPhoneCountryCode?: string | null;
  ownerPhone?: string | null;
  ownerJobTitle?: string | null;
  ownerLanguage?: string | null;
  ownerUsername?: string | null;
  ownerAccountLinked: boolean;
  databaseName: string;
  status: TenantStatusEnum;
  createdAt: string;
  updatedAt: string;
  fqdns: Array<{
    id: string;
    fqdn: string;
    isPrimary: boolean;
    validationStatus: TenantFqdnValidationStatus;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  subscription?: {
    status: SubscriptionStatusEnum;
    effectiveAllowedUsers: number;
    billingCycle: string | null;
    currencyCode: string | null;
    totalPrice: string | null;
    startedAt: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string;
    trialDays: number;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    activationScheduledAt: string | null;
    activatedAt: string | null;
    cancelAt: string | null;
  };
  databaseServer?: {
    id: string;
    name: string;
    driver: 'postgres';
    countryName?: string;
    countryIsoCode?: string;
    maxTenants?: number;
    currentTenants?: number;
    status: string;
  };
  storageServerId?: string | null;
  storageServer?: {
    id: string;
    name: string;
    provider: 'GARAGE';
    region: string;
    status: string;
    availabilityClass: string;
  };
}
```

The tenant response has no `code`, `primaryFqdn`, plan name, subscription id,
subscription items, database credentials, Storage Server endpoints/buckets/
credential references, or provisioning percentage. See the
[Admin Tenants Frontend Contract](../api/tenants.md) for derivation and
lifecycle rules.

### `AdminTenantUserView`
```typescript
interface AdminTenantUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  status: UserStatusEnum;
  isTenantOwner: boolean;
  organization: {
    company: { id: string; code: string | null; name: string | null };
    branch: { id: string; code: string | null; name: string | null };
    department: { id: string; code: string | null; name: string | null };
    team: { id: string; code: string | null; name: string | null } | null;
  };
  manager: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  roleAssignments: Array<{
    assignmentId: string;
    roleId: string;
    roleName: string;
    scope: 'TENANT' | 'COMPANY' | 'BRANCH';
    companyId: string | null;
    branchId: string | null;
  }>;
  webphone: WebphoneConfig;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

Deleted tenant users are identified by `deletedAt`, not by a `DELETED` user
status. SIP credentials are never returned. See
[Tenant Users and Access](../api/tenant-users.md).

---

## Database Server Types

### `DatabaseServerView`
```typescript
interface DatabaseServerView {
  id: string;
  deletedAt: string | null;
  name: string;
  host: string;
  port: number;
  sslMode: DatabaseServerSslMode;
  sslRejectUnauthorized: boolean;
  hasSslConfig: boolean;
  maintenanceDatabase: string;
  poolMin: number;
  poolMax: number;
  connectTimeoutMs: number;
  statementTimeoutMs: number;
  idleTimeoutMs: number;
  hasSecurityAdminCredentials: boolean;
  hasBackupCredentials: boolean;
  hasProvisioningCredentials: boolean;
  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;
  countryName?: string;
  countryIsoCode?: string;
  createdAt: string;
  updatedAt: string;
}
```

`deletedAt` is the deletion authority. It is null for ordinary registry rows
and non-null for rows returned by `GET /database-servers?deleted=true`.
The projection contains only purpose-specific configuration-presence booleans,
never stored credentials, Application passwords, credential references, or SSL
material. Dynamic Application readiness comes from `GET
/:id/applications`; it is not a fixed four-Application object. The server
projection also does not return `driver`, `region`, `runtimeCredentials`,
`utilization`, or `isPlacementTarget`; derive presentation fields as documented in the
[Database Servers Frontend Contract](../api/database-servers.md).

### `DatabaseServerHistoryItem`
```typescript
type DatabaseServerHistoryValue = string | number | boolean | null;

interface DatabaseServerHistoryItem {
  id: string;
  databaseServerId: string;
  action: DatabaseServerHistoryAction;
  serverName: string;
  changes: Array<{
    field: string;
    label: string;
    previousValue: DatabaseServerHistoryValue;
    newValue: DatabaseServerHistoryValue;
  }>;
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The history endpoint returns this as a newest-first array under the canonical
success envelope’s `data` property. It does not return actor profile data or
pagination `meta`.

### Application binding and credential receipts
```typescript
interface DatabaseServerApplicationBindingView {
  applicationId: string;
  applicationKey: string;
  applicationName: string;
  databasePrincipal: string;
  requiredOnDatabaseServer: boolean;
  status: DatabaseServerApplicationBindingStatus;
  credentialRevision: string;
  permissionManifestChecksum: string;
  policyRevision: string;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  rotationDueAt: string | null;
  lastRotationAttemptAt: string | null;
  lastRotationSucceededAt: string | null;
  retryAt: string | null;
  safeFailureCode: string | null;
  operationGeneration: string;
  hasStagedCandidate: boolean;
}

interface ApplicationCredentialBootstrapReceiptItem {
  applicationId: string;
  applicationKey: string;
  databasePrincipal: string;
  credentialRevision: string;
  permissionManifestChecksum: string;
  status: 'READY';
}

interface ApplicationCredentialBootstrapReceipt {
  databaseServerId: string;
  applications: ApplicationCredentialBootstrapReceiptItem[];
  status: 'READY';
  completedAt: string;
}

interface ApplicationCredentialMutationReceipt {
  databaseServerId: string;
  applicationKey: string;
  databasePrincipal: string;
  previousCredentialRevision: string;
  credentialRevision: string;
  status: 'READY';
  invalidatedTenantCount: number;
}
```

These projections are secret-free. They never contain an Application password,
encrypted credential reference, exported file, or recovery value.

---

## Storage Server Types

```typescript
interface StorageServerAdminView {
  id: string;
  code: string;
  name: string;
  provider: 'GARAGE';
  placementRole: 'GENERAL' | 'BACKUP_ONLY';
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  forcePathStyle: true;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  status: StorageServerStatus;
  availabilityClass: StorageServerAvailabilityClass;
  healthStatus: StorageServerHealthStatus;
  maxTenants: number;
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  observedNodeCount: number | null;
  observedZoneCount: number | null;
  observedReplicationFactor: number | null;
  usableCapacityBytes: string | null;
  usedCapacityBytes: string | null;
  allocatableCapacityBytes: string | null;
  activeReservedCapacityBytes: string;
  warningPercent: number;
  criticalPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface TenantCreateStoragePlacementOptionView {
  id: string;
  name: string;
  provider: 'GARAGE';
  region: string;
  status: 'ACTIVE';
  availabilityClass: 'HA_PRODUCTION_READY';
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  maxTenants: number;
  capacityPercent: number;
  allocatableCapacityBytes: string;
  availableReservationBytes: string;
}

interface StorageRecoveryDestinationView {
  id: string;
  code: string;
  name: string;
  kind: 'OFFLINE_RESTIC_MEDIA_V1';
  administrationBoundaryKey: string;
  status: 'DRAFT' | 'ACTIVE' | 'OFFLINE';
  credentialsConfigured: true;
  encryptionEvidenceSha256: string | null;
  disconnectEvidenceSha256: string | null;
  lastIsolatedRestoreAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StorageRecoveryPolicyView {
  id: string;
  sourceStorageServerId: string;
  onlineDestinationStorageServerId: string;
  offlineRecoveryDestinationId: string;
  sourceReadinessRevision: number;
  sourceDeploymentFingerprint: string;
  onlineDestinationReadinessRevision: number;
  onlineDestinationDeploymentFingerprint: string;
  sourceAdministrationBoundaryKey: string;
  onlineAdministrationBoundaryKey: string;
  offlineAdministrationBoundaryKey: string;
  failureDomainDisjointEvidenceSha256: string;
  administrationBoundaryDisjointEvidenceSha256: string;
  onlineCopyManifestSha256: string;
  offlineGenerationManifestSha256: string;
  isolatedRestoreManifestSha256: string;
  rpoSeconds: number;
  lastOnlineCopyAt: string;
  lastOfflineGenerationAt: string;
  lastIsolatedRestoreAt: string;
  evidenceRevision: number;
  status: 'DRAFT' | 'VERIFIED' | 'REVOKED';
  verifiedAt: string;
  verifiedExpiresAt: string;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
```

The registry view exposes administrative endpoints but never credentials,
credential references, bucket bindings, topology-member encryption evidence,
or recovery evidence. The tenant-create placement view is narrower and omits
endpoints too. Byte counters are decimal strings and require `BigInt`-safe
formatting. Recovery projections are separate, read-permission-gated
operational views; the destination view exposes only
`credentialsConfigured`, never its credential locator. Treat recovery
fingerprints, boundary keys, and evidence hashes as sensitive metadata. See the
[Storage Servers Frontend Contract](../api/storage-servers.md).

### Tenant Storage Server migration views

```typescript
interface TenantStorageMigrationView {
  migrationId: string;
  tenantId: string;
  sourceStorageServerId: string;
  targetStorageServerId: string;
  status: TenantStorageMigrationStatus;
  lastDurableStage: Exclude<
    TenantStorageMigrationStatus,
    'FAILED' | 'CANCELLED'
  >;
  sourcePlacementRevision: number;
  storageFenceRevision: number;
  attemptNumber: number;
  stageRevision: number;
  inventoryChecksum: string | null;
  inventoryCount: number | null;
  inventoryBytes: string | null;
  safeErrorCode: string | null;
  rollbackRetainUntil: string;
  replayed: boolean;
}

interface TenantStoragePostCutoverOperationView {
  operationId: string;
  migrationId: string;
  tenantId: string;
  operation: 'ROLLBACK' | 'FINALIZE';
  status: TenantStoragePostCutoverStatus;
  replayed: boolean;
}
```

These views belong to the separate default-off migration workflow.
`TenantView` intentionally does not embed them. The current API also lacks a
current-migration lookup and a post-cutover operation GET projection, so the
portal cannot safely recover the workflow after refresh. See
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md).

---

## Application Catalogue Types

Catalogue section verified against Core source: **2026-08-05**.

```typescript
type ApplicationPublicationStatus = 'UNPUBLISHED' | 'PUBLISHED';

interface ApplicationManifestEvidenceView {
  id: string;
  version: number;
  checksum: string;
  schemaVersion: number;
  contractPackage: string;
  contractVersion: string;
  publicationSource: string;
  publishedAt: string;
  publishedBy: string;
  active: boolean;
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

type ApplicationTechnicalReadinessReason =
  | 'RUNTIME_TARGET_REQUIRED'
  | 'COMPONENT_BINDING_REQUIRED'
  | 'ACTIVE_COMPONENT_REQUIRED'
  | 'PUBLISHED_RELEASE_REQUIRED'
  | 'MINIMUM_RELEASE_NOT_SATISFIED'
  | 'DATABASE_PERMISSION_MANIFEST_REQUIRED'
  | 'DATABASE_PERMISSION_MANIFEST_INVALID';

type ApplicationSelectionBlocker =
  | 'APPLICATION_LIFECYCLE_NOT_ACTIVE'
  | 'APPLICATION_NOT_PUBLISHED'
  | 'APPLICATION_NOT_PUBLIC'
  | 'APPLICATION_NON_BILLABLE'
  | 'TECHNICAL_READINESS_BLOCKED';

interface ApplicationTechnicalComponentView {
  id: string;
  key: string;
  ownerApp: string;
  workerTarget: string | null;
  kind: 'FOUNDATION' | 'MODULE';
  status: 'ACTIVE' | 'RETIRED';
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

interface ApplicationTechnicalReadinessView {
  contractVersion: 1;
  applicationId: string;
  applicationKey: string;
  runtimeTarget: string | null;
  commercialMode: ApplicationCommercialMode;
  catalogueVisibility: ApplicationCatalogueVisibility;
  lifecycleStatus: ApplicationLifecycleStatus;
  publicationStatus: ApplicationPublicationStatus;
  technicalDefinitionRevision: string;
  status: 'READY' | 'NOT_REQUIRED' | 'BLOCKED';
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

interface ApplicationView {
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
  databasePrincipal: string | null;
  requiredOnDatabaseServer: boolean;
  technicalDefinitionRevision: string;
  catalogueRevision: string;
  activeManifest: ApplicationManifestEvidenceView | null;
  databasePolicy: ApplicationDatabasePolicyView;
  serverSummary: {
    available: false;
    reason: 'SERVER_APPLICATION_BINDINGS_NOT_AVAILABLE';
  };
  createdAt: string;
  updatedAt: string;
}

type ApplicationCommandOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'ADOPT_TECHNICAL_PACKAGE'
  | 'PUBLISH'
  | 'DELETE'
  | 'UPDATE_DATABASE_POLICY'
  | 'ACTIVATE'
  | 'DEPRECATE'
  | 'DISABLE';

interface ApplicationMutationReceipt {
  contractVersion: 1;
  operation: ApplicationCommandOperation;
  applicationId: string;
  applicationKey: string;
  lifecycleStatus: ApplicationLifecycleStatus;
  runtimeTarget: string | null;
  publicationStatus: ApplicationPublicationStatus;
  publicationRevision: string;
  catalogueRevision: string;
  policyRevision: string;
  deleted: boolean;
  technicalIdentity?: {
    runtimeTarget: string;
    databasePrincipal: string;
    primaryComponentKey: string;
    contractVersion: 1;
  };
  technicalProvisioning?: {
    componentId: string;
    componentKey: string;
    ownerApp: string;
    workerTarget: string;
    contractVersion: 1;
  };
}

interface TierView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  rank: number;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FeatureView {
  id: string;
  moduleId: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TierFeatureGrantView {
  id: string;
  tierId: string;
  featureId: string;
  config: Record<string, unknown> | null;
  configRevision: number;
  createdAt: string;
  updatedAt: string;
}

interface PriceTierView {
  id: string;
  tierId: string;
  billingCycle: BillingCycleEnum;
  minUsers: number;
  maxUsers: number | null;
  unitPrice: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyRateView {
  currencyCode: string;
  currencyUnitsPerUsd: string;
  isActive: boolean;
}
```

Application lifecycle and publication are independent. `activationAllowed`
describes technical readiness only; activation additionally requires an
attributable `PUBLISHED` Application. `selectionAllowed` is the complete new
selection predicate. The `runtimeTarget` and each component `workerTarget` are
stored/read projections and must never be derived from the Application key.

Nested tier and feature rows still use `isActive`; current Core source
serializes their physical
foreign-key property as `moduleId` even though the public parent routes use
`/applications/:applicationId`. Do not silently rename a received field in
documentation or request payloads. Grant `config` is feature-specific. Keep
`unitPrice` and `currencyUnitsPerUsd` as decimal strings. The complete DTOs,
list envelopes, replacement semantics, and UI derivation rules are in the
[Application Catalogue Frontend Contract](../api/catalog.md).

---

## WebPhone Types

### `WebphoneConfig`
```typescript
interface WebphoneConfig {
  enabled: boolean;
  extension: string | null;
  sipUsername: string | null;
  displayName: string | null;
  outboundCallerId: string | null;
  transport: 'ws' | 'wss';
  passwordConfigured: boolean;
}
```

---

## Operation Types

### `TenantOperationSummaryView`
```typescript
interface TenantOperationSummaryView {
  id: string;
  tenantId: string;
  generation: number;
  type: TenantOperationTypeEnum;
  status: TenantOperationStatusEnum;
  currentPhase: string;
  planDigest: string;
  accessPolicyRevision: number;
  actor: { type: TenantOperationActorTypeEnum; id: string | null };
  reason: string | null;
  requestedAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  cancellationRequestedAt: string | null;
  completedAt: string | null;
  safeError: {
    code: string | null;
    message: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}
```

### `OperationProgress`
```typescript
interface OperationProgress {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalWeight: number;
  completedWeight: number;
  percent: number;
}
```

```typescript
interface TenantOperationDetailView extends TenantOperationSummaryView {
  progress: OperationProgress;
  timelineEventCount: number;
  steps: Array<{
    id: string;
    componentId: string | null;
    componentKey: string | null;
    stepKey: string;
    kind: TenantOperationStepKindEnum;
    status: TenantOperationStepStatusEnum;
    required: boolean;
    activationRequired: boolean;
    weight: number;
    attemptCount: number;
    retryable: boolean;
    dependsOnStepKeys: string[];
    fromVersion: string | null;
    targetVersion: string | null;
    appliedVersion: string | null;
    targetChecksum: string | null;
    appliedChecksum: string | null;
    producer: string | null;
    startedAt: string | null;
    heartbeatAt: string | null;
    finishedAt: string | null;
    safeError: { code: string | null; message: string | null } | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

Raw plans, idempotency values, stack traces, and worker payloads are excluded
from these projections. See
[Tenant Operations and Provisioning](../api/tenant-operations.md).

---

## Common Types

### `CurrentUserContext`
```typescript
interface CurrentUserContext {
  identityId: string;
  // ... auth context
}
```

### `IdParamDto`
```typescript
{
  id: string;  // @IsUUID('7')
}
```
