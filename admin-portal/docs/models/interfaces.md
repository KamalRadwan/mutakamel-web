# Admin Portal — Key Interfaces & Types

Selected high-use response types. Last verified: **2026-07-30**.

---

## Auth Types

### `AdminMe` (`GET /api/admin/core/v1/auth/me` response)
```typescript
interface AdminMe {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tier: AdminTierEnum;
  status: UserStatusEnum;
  permissions: string[];
}
```

`roles` is not returned by `/auth/me`.

### `AdminAuthCookieResponse` (Admin Portal Login/Refresh)
```typescript
interface AdminAuthCookieResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
}
```

In browser cookie mode the refresh token is stored only in an HttpOnly cookie
and is intentionally absent from the JSON response. Non-cookie clients receive
the full token pair, but that is not the Admin Portal contract.

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
  hasBackupCredentials: boolean;
  backupCredentialsUsesPrimary: boolean;
  hasProvisioningCredentials: boolean;
  runtimeCredentialsConfigured: {
    coreApp: boolean;
    crmApp: boolean;
    tradeApp: boolean;
    workerApp: boolean;
  };
  runtimePrincipalsReady: boolean;
  maxTenants: number;
  currentTenants: number;
  status: DatabaseServerStatus;
  countryName?: string;
  countryIsoCode?: string;
  region?: string;
  createdAt: string;
  updatedAt: string;
}
```

The projection contains configuration-presence booleans, never stored
credentials, credential references, or SSL material. It also does not return
`driver`, `utilization`, or `isPlacementTarget`; derive those UI fields as
documented in the
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

## Modules and Catalogue Types

```typescript
interface ModuleView {
  id: string;
  key: string;
  name: string;
  description: string | null;
  avatarDataUrl: string | null;
  rank: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

Catalogue activation is represented by `isActive`; module, tier, and feature
responses do not contain a general `status`. These flags are independent:
inactive catalogue rows remain administratively configurable, while the
materialized tenant policy omits inactive modules, tiers, and features. Grant
`config` is feature-specific. Keep `unitPrice` and `currencyUnitsPerUsd` as
decimal strings. The complete DTOs, list envelopes, replacement semantics, and
UI derivation rules are in the [Modules and Catalogue Frontend
Contract](../api/catalog.md).

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
