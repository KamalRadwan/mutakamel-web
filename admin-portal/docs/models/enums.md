# Admin Portal — Enums Reference

Transport values extracted from the current Core common/database packages and
admin APIs. Last verified: **2026-07-30**.

Enum values are case-sensitive. Keep translated UI labels separate from these
wire values and render a safe fallback for unknown additive values.

---

## User & Identity Enums

### `AdminTierEnum`
```typescript
enum AdminTierEnum {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}
```

### `UserStatusEnum`
```typescript
enum UserStatusEnum {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}
```

---

## System Settings Values

### `PlatformSmtpProtocol`

```typescript
type PlatformSmtpProtocol = 'smtp' | 'smtps';
```

### `PlatformSmtpConfigHistoryAction`

```typescript
enum PlatformSmtpConfigHistoryAction {
  CONFIGURED = 'CONFIGURED',
  UPDATED = 'UPDATED',
  CONNECTION_VERIFIED = 'CONNECTION_VERIFIED',
}
```

Generic system-setting values have no shared enum. Each registered key has its
own strict string, integer, or boolean schema. See
[System Settings and Platform SMTP](../api/system-settings.md).

---

## Tenant Enums

### `TenantStatusEnum`
```typescript
enum TenantStatusEnum {
  PROVISIONING = 'PROVISIONING',
  PROVISIONING_FAILED = 'PROVISIONING_FAILED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}
```

### `AdminTenantUserVisibilityEnum`
```typescript
enum AdminTenantUserVisibilityEnum {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
  ALL = 'ALL',
}
```

`DELETED` here controls soft-deleted-row visibility; it is not a
`UserStatusEnum` member.

### `TenantFqdnValidationStatus`
```typescript
enum TenantFqdnValidationStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
}
```

There is no `VERIFIED` FQDN wire value.

### `TeamMembershipRoleEnum`
```typescript
enum TeamMembershipRoleEnum {
  MEMBER = 'MEMBER',
  LEAD = 'LEAD',
  MANAGER = 'MANAGER',
}
```

---

## Database Server Enums

### `DatabaseServerStatusEnum`
```typescript
enum DatabaseServerStatusEnum {
  ACTIVE = 'ACTIVE',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
}
```

`DELETED` is not a transport status. Deleting a database server soft-deletes
the row, which removes it from normal list and detail queries.

### `DatabaseServerSslModeEnum`
```typescript
enum DatabaseServerSslModeEnum {
  DISABLE = 'disable',
  REQUIRE = 'require',
  VERIFY_CA = 'verify-ca',
  VERIFY_FULL = 'verify-full',
}
```

### `DatabaseServerHistoryAction`
```typescript
enum DatabaseServerHistoryAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  ACTIVATE = 'ACTIVATE',
  DRAIN = 'DRAIN',
  OFFLINE = 'OFFLINE',
  DELETE = 'DELETE',
}
```

Database-server history has no generic `LIFECYCLE` action. See the
[Database Servers Frontend Contract](../api/database-servers.md) for transition
and deletion preconditions.

---

## Storage Server Enums

```typescript
enum StorageServerProvider {
  GARAGE = 'GARAGE',
}

enum StorageServerPlacementRole {
  GENERAL = 'GENERAL',
  BACKUP_ONLY = 'BACKUP_ONLY',
}

enum StorageServerStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DRAINING = 'DRAINING',
  OFFLINE = 'OFFLINE',
}

enum StorageServerAvailabilityClass {
  DEGRADED_SINGLE_NODE = 'DEGRADED_SINGLE_NODE',
  SINGLE_NODE_OPERATIONAL = 'SINGLE_NODE_OPERATIONAL',
  BACKUP_TARGET_OPERATIONAL = 'BACKUP_TARGET_OPERATIONAL',
  HA_PRODUCTION_READY = 'HA_PRODUCTION_READY',
}

enum StorageServerHealthStatus {
  UNKNOWN = 'UNKNOWN',
  HEALTHY = 'HEALTHY',
  UNHEALTHY = 'UNHEALTHY',
}

enum StoragePrincipal {
  CORE = 'CORE',
  CRM = 'CRM',
  TRADE = 'TRADE',
  WORKER = 'WORKER',
  BACKUP = 'BACKUP',
  PROBE = 'PROBE',
}

enum StorageCredentialRole {
  OPERATION = 'OPERATION',
  SIGNING = 'SIGNING',
}

enum StorageVerificationRunStatus {
  PENDING = 'PENDING',
  PASS = 'PASS',
  FAIL = 'FAIL',
  EXPIRED = 'EXPIRED',
}

enum StorageRecoveryDestinationKind {
  OFFLINE_RESTIC_MEDIA_V1 = 'OFFLINE_RESTIC_MEDIA_V1',
}

enum StorageRecoveryDestinationStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  OFFLINE = 'OFFLINE',
}

enum StorageRecoveryPolicyStatus {
  DRAFT = 'DRAFT',
  VERIFIED = 'VERIFIED',
  REVOKED = 'REVOKED',
}

enum StorageServerHistoryAction {
  BOOTSTRAPPED = 'BOOTSTRAPPED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  BINDINGS_CHANGED = 'BINDINGS_CHANGED',
  PRINCIPAL_ROTATED = 'PRINCIPAL_ROTATED',
  VERIFIED = 'VERIFIED',
  ACTIVATED = 'ACTIVATED',
  DRAINED = 'DRAINED',
  OFFLINED = 'OFFLINED',
  DELETED = 'DELETED',
}
```

`DELETED` is a history action, not a Storage Server status. Recovery
destination `ACTIVE` describes registered current offline evidence; it is not
the Storage Server `ACTIVE` placement state. The full principal-role matrix,
attestation-key statuses, recovery evidence rules, and lifecycle preconditions
are in the
[Storage Servers Frontend Contract](../api/storage-servers.md).

### Tenant Storage Server migration enums

```typescript
enum TenantStorageMigrationStatus {
  REQUESTED = 'REQUESTED',
  FENCING = 'FENCING',
  FENCED = 'FENCED',
  COPYING = 'COPYING',
  VERIFYING = 'VERIFYING',
  CUTOVER = 'CUTOVER',
  ROLLBACK_WINDOW = 'ROLLBACK_WINDOW',
  ROLLBACK_FENCING = 'ROLLBACK_FENCING',
  ROLLBACK_FENCED = 'ROLLBACK_FENCED',
  ROLLBACK_COPYING = 'ROLLBACK_COPYING',
  ROLLBACK_VERIFYING = 'ROLLBACK_VERIFYING',
  ROLLBACK_CUTOVER = 'ROLLBACK_CUTOVER',
  FINALIZING = 'FINALIZING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

enum TenantStoragePostCutoverOperation {
  ROLLBACK = 'ROLLBACK',
  FINALIZE = 'FINALIZE',
}

enum TenantStoragePostCutoverStatus {
  FENCING = 'FENCING',
  FENCED = 'FENCED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  VERIFYING = 'VERIFYING',
  PURGING = 'PURGING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
```

`lastDurableStage` uses the migration status set except `FAILED` and
`CANCELLED`. These are backend source values for a default-off feature; keep
an unknown-value fallback and see
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md) before
building UI.

---

## Subscription & Billing Enums

### `BillingCycleEnum`
```typescript
enum BillingCycleEnum {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}
```

The catalogue pricing API does not accept `YEARLY`. See the
[Modules and Catalogue Frontend Contract](../api/catalog.md) for price-ladder
replacement rules.

### `SubscriptionStatusEnum`
```typescript
enum SubscriptionStatusEnum {
  TRIAL = 'TRIAL',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
}
```

### `InvoiceStatusEnum`
```typescript
enum InvoiceStatusEnum {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}
```

### `InvoicePurposeEnum`
```typescript
enum InvoicePurposeEnum {
  TRIAL_ACTIVATION = 'TRIAL_ACTIVATION',
  RENEWAL = 'RENEWAL',
  PRORATION = 'PRORATION',
  MANUAL = 'MANUAL',
}
```

### `InvoiceAllocationSourceEnum`
```typescript
enum InvoiceAllocationSourceEnum {
  WALLET = 'WALLET',
  PAYMENT = 'PAYMENT',
}
```

---

## Payment Enums

### `PaymentStatusEnum`
```typescript
enum PaymentStatusEnum {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}
```

### `PaymentReconciliationStatusEnum`
```typescript
enum PaymentReconciliationStatusEnum {
  PROPOSED = 'PROPOSED',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
}
```

### `PaymentReconciliationActionEnum`
```typescript
enum PaymentReconciliationActionEnum {
  CONFIRM_SUCCEEDED = 'CONFIRM_SUCCEEDED',
  CONFIRM_FAILED = 'CONFIRM_FAILED',
  CONFIRM_REFUNDED = 'CONFIRM_REFUNDED',
  CONFIRM_REFUND_FAILED = 'CONFIRM_REFUND_FAILED',
}
```

---

## Wallet Enums

### `WalletStatusEnum`
```typescript
enum WalletStatusEnum {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}
```

### `LedgerDirectionEnum`
```typescript
enum LedgerDirectionEnum {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}
```

### `LedgerReasonEnum`
```typescript
enum LedgerReasonEnum {
  TOP_UP = 'TOP_UP',
  SUBSCRIPTION_CHARGE = 'SUBSCRIPTION_CHARGE',
  PRORATION_CREDIT = 'PRORATION_CREDIT',
  REFUND = 'REFUND',
  PROMO = 'PROMO',
  ADJUSTMENT = 'ADJUSTMENT',
}
```

---

## Provisioning Enums

### `TenantOperationTypeEnum`
```typescript
enum TenantOperationTypeEnum {
  INITIAL_PROVISION = 'INITIAL_PROVISION',
  RETRY = 'RETRY',
  RECONCILE = 'RECONCILE',
  UPDATE = 'UPDATE',
  ADD_MODULE = 'ADD_MODULE',
  REPAIR = 'REPAIR',
  DECOMMISSION = 'DECOMMISSION',
}
```

### `TenantOperationStatusEnum`
```typescript
enum TenantOperationStatusEnum {
  REQUESTED = 'REQUESTED',
  PLANNING = 'PLANNING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  WAITING_RETRY = 'WAITING_RETRY',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED_RETRYABLE = 'FAILED_RETRYABLE',
  MANUAL_RECOVERY_REQUIRED = 'MANUAL_RECOVERY_REQUIRED',
  CANCELLED = 'CANCELLED',
}
```

### `TenantOperationActorTypeEnum`
```typescript
enum TenantOperationActorTypeEnum {
  ADMIN = 'ADMIN',
  TENANT_USER = 'TENANT_USER',
  SYSTEM = 'SYSTEM',
}
```

### `TenantOperationStepKindEnum`
```typescript
enum TenantOperationStepKindEnum {
  DATABASE = 'DATABASE',
  SCHEMA = 'SCHEMA',
  SYSTEM_SEED = 'SYSTEM_SEED',
  REFERENCE_SEED = 'REFERENCE_SEED',
  IDENTITY = 'IDENTITY',
  CONFIG = 'CONFIG',
  VERIFICATION = 'VERIFICATION',
  NOTIFICATION = 'NOTIFICATION',
  ACTIVATION = 'ACTIVATION',
}
```

### `TenantOperationStepStatusEnum`
```typescript
enum TenantOperationStepStatusEnum {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CONFLICT = 'CONFLICT',
  CANCELLED = 'CANCELLED',
}
```

### `TenantComponentInstallationStateEnum`
```typescript
enum TenantComponentInstallationStateEnum {
  NOT_INSTALLED = 'NOT_INSTALLED',
  PENDING = 'PENDING',
  INSTALLING = 'INSTALLING',
  READY = 'READY',
  FAILED = 'FAILED',
  OUTDATED = 'OUTDATED',
  DRIFTED = 'DRIFTED',
  DISABLED_RETAINED = 'DISABLED_RETAINED',
  INCOMPATIBLE = 'INCOMPATIBLE',
}
```

### `ApplicationComponentKindEnum`
```typescript
enum ApplicationComponentKindEnum {
  FOUNDATION = 'FOUNDATION',
  MODULE = 'MODULE',
}
```

### `ApplicationComponentStatusEnum`
```typescript
enum ApplicationComponentStatusEnum {
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}
```

### `ComponentReleaseStatusEnum`
```typescript
enum ComponentReleaseStatusEnum {
  PUBLISHED = 'PUBLISHED',
  RETIRED = 'RETIRED',
}
```

### `ComponentReleaseRiskEnum`
```typescript
enum ComponentReleaseRiskEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
```

### `TenantComponentSelectionSourceEnum`
```typescript
enum TenantComponentSelectionSourceEnum {
  FOUNDATION = 'FOUNDATION',
  ENTITLEMENT = 'ENTITLEMENT',
  DEPENDENCY = 'DEPENDENCY',
}
```

### `TenantComponentEvidenceOriginEnum`
```typescript
enum TenantComponentEvidenceOriginEnum {
  PROVISIONED = 'PROVISIONED',
  LEGACY_DISCOVERED = 'LEGACY_DISCOVERED',
}
```

`LEGACY_DISCOVERED` is discovery evidence only; it does not prove that a
release was successfully applied.

### `TenantSeedPolicyEnum`
```typescript
enum TenantSeedPolicyEnum {
  SYSTEM_MANAGED = 'SYSTEM_MANAGED',
  CREATE_ONCE = 'CREATE_ONCE',
  CREATE_IF_MISSING = 'CREATE_IF_MISSING',
  PATCH_IF_UNMODIFIED = 'PATCH_IF_UNMODIFIED',
  ADDITIVE = 'ADDITIVE',
  TRANSFORM = 'TRANSFORM',
  MANUAL_CONFLICT = 'MANUAL_CONFLICT',
}
```

### `TenantSeedStateStatusEnum`
```typescript
enum TenantSeedStateStatusEnum {
  PENDING = 'PENDING',
  APPLYING = 'APPLYING',
  APPLIED = 'APPLIED',
  NOOP = 'NOOP',
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
  SKIPPED_NOT_SELECTED = 'SKIPPED_NOT_SELECTED',
}
```

---

## Logging Enums

### `LoggingOverrideScopeEnum`
```typescript
enum LoggingOverrideScopeEnum {
  GLOBAL = 'GLOBAL',
  APP = 'APP',
  TENANT = 'TENANT',
  TENANT_APP = 'TENANT_APP',
}
```

### `LogLevelEnum`
```typescript
enum LogLevelEnum {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}
```

`TRACE` exists in the shared enum and may be used by read/live-log filters, but
`UpsertLoggingLevelOverrideDto.level` intentionally accepts only `debug`,
`info`, `warn`, `error`, and `fatal`.

---

## Organization Enums

### `OrgNodeStatusEnum`
```typescript
enum OrgNodeStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
```

### `PartyTypeEnum`
```typescript
enum PartyTypeEnum {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
}
```

### `PartyStatusEnum`
```typescript
enum PartyStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}
```
