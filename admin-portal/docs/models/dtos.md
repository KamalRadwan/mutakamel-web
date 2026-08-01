# Admin Portal — Selected DTOs Reference

High-use request DTOs and validation rules extracted from the current backend.
Last verified: **2026-07-30**.

This page is not a substitute for each domain API page. The backend DTO remains
authoritative, and the Core global validation pipe rejects unknown fields.

---

## Dashboard DTOs

### `AdminDashboardQueryDto`
```typescript
{
  date?: string; // @IsOptional, @IsDateString; overrides from/to
  from?: string; // @IsOptional, @IsDateString
  to?: string;   // @IsOptional, @IsDateString
}
```

- No fields selects the current UTC calendar month.
- Supplying only `from` or only `to` selects a single day when the value is
  `YYYY-MM-DD`; a lone full timestamp currently produces HTTP `422`.
- An invalid or reversed range is rejected. See
  [the dashboard contract](../api/dashboard.md) for exact range semantics and
  response types.

---

## Auth DTOs

### `LoginDto`
```typescript
{
  email: string;        // @IsEmail, @MaxLength(255), auto-trim & lowercase
  password: string;     // @IsString, @MinLength(1), @MaxLength(128)
}
```

### `RefreshDto`
```typescript
{
  refreshToken?: string; // @IsOptional, @IsString, @MinLength(16), @MaxLength(512)
}
```

### `ForgotPasswordDto`
```typescript
{
  email: string;        // @IsEmail, @MaxLength(255), auto-trim & lowercase
}
```

### `ResetPasswordDto`
```typescript
{
  token: string;        // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string;  // @IsString, @MinLength(12), @MaxLength(128), @IsStrongPassword(PASSWORD_POLICY)
}
```

### `AcceptInviteDto`
```typescript
{
  token: string;        // @IsString, @MinLength(16), @MaxLength(512)
  newPassword: string;  // @IsString, @MinLength(12), @MaxLength(128), @IsStrongPassword(PASSWORD_POLICY)
}
```

---

## Admin Users DTOs

### `CreateAdminUserDto`
```typescript
{
  email: string;           // @IsEmail, @MaxLength(255), auto-trim & lowercase
  firstName: string;       // @IsString, @MinLength(1), @MaxLength(80), auto-trim
  lastName: string;        // @IsString, @MinLength(1), @MaxLength(80), auto-trim
  tier?: AdminTierEnum;    // @IsOptional, @IsEnum
  roleIds?: string[];      // @IsOptional, @IsArray, @ArrayUnique, @IsUUID('7')
}
```

### `UpdateAdminUserDto`
```typescript
{
  firstName?: string;      // @IsOptional, @MinLength(1), @MaxLength(80)
  lastName?: string;       // @IsOptional, @MinLength(1), @MaxLength(80)
  tier?: AdminTierEnum;    // @IsOptional, @IsEnum
}
```

### `AdminUserQueryDto` (extends `PaginationQueryDto`)
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: UserStatusEnum;
  tier?: AdminTierEnum;
}
```

### `UpdateAdminProfileDto`
```typescript
{
  themeKey?: string;                    // @IsOptional, @MaxLength(64)
  language?: string;                   // @IsOptional, @IsIn(SUPPORTED_LANGUAGES)
  extensions?: Record<string, unknown>; // @IsOptional, @IsObject, shallow-merged
}
```

### `UpdateAdminUserWebphoneDto`
```typescript
{
  enabled?: boolean;
  extension?: string | null;          // @MaxLength(32)
  sipUsername?: string | null;        // @MaxLength(120)
  sipPassword?: string | null;       // @MaxLength(255)
  displayName?: string | null;       // @MaxLength(120)
  outboundCallerId?: string | null;  // @MaxLength(64)
  transport?: 'ws' | 'wss';
}
```

### `CreateAdminWebphoneCallLogDto`
```typescript
{
  type: WebphoneCallLogType;
  displayName?: string | null;       // @MaxLength(120)
  phoneNumber: string;               // @IsNotEmpty, @MaxLength(80)
  startedAt?: string | null;         // @IsDateString
  answeredAt?: string | null;        // @IsDateString
  endedAt?: string | null;           // @IsDateString
  durationSeconds?: number | null;   // @IsInt, @Min(0), @Max(86400)
  cause?: string | null;             // @MaxLength(120)
}
```

---

## Roles DTOs

### `CreateAdminRoleDto`
```typescript
{
  name: string;
  description?: string;
  type: AdminTierEnum;
  permissionIds?: string[];
}
```

### `UpdateAdminRoleDto`
```typescript
{
  name?: string;
  description?: string;
}
```

### `SetRolePermissionsDto`
```typescript
{
  permissionIds: string[];  // Full replacement set
}
```

### `SetUserRolesDto`
```typescript
{
  roleIds: string[];  // @IsArray, @ArrayUnique, @IsUUID('7')
}
```

---

## Common Pagination DTOs

### `PaginationQueryDto`
```typescript
{
  page?: number;       // integer >= 1; default: 1
  limit?: number;      // integer 1..100; default: 20
  sortBy?: string;     // max 100; endpoint-specific allowlist/fallback
  sortDir?: 'ASC' | 'DESC'; // default: 'ASC'
  search?: string;     // max length: 200
}
```

### Repository Pagination Shape

Backend services build this intermediate result:

```typescript
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

The global response interceptor converts it to the browser-visible form:

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}

type PaginatedHttpResponse<T> = SuccessResponse<T[]> & {
  meta: NonNullable<SuccessResponse<T[]>['meta']>;
};
```

Therefore HTTP list rows are in `data`, not `items`, and their pagination
values are in `meta`. The field is `total`, not `totalItems`.

---

## System Settings DTOs

### `SystemSettingQueryDto`

```typescript
{
  prefix?: string; // trimmed, max 120
}
```

### `SystemSettingKeyParamDto`

```typescript
{
  key: string; // trimmed, max 120;
               // /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
}
```

### `UpsertSystemSettingDto`

```typescript
{
  value: unknown;       // required; validated by the selected registry schema
  description?: string; // trimmed string, max 255
}
```

### `PatchPlatformSmtpConfigDto`

```typescript
{
  fromAddress?: string;  // valid email, max 320
  fromName?: string;     // 1..200
  senderDomain?: string; // max 253
  smtpHost?: string;     // max 253
  smtpPort?: number;     // integer 1..65535
  smtpSecure?: boolean;
  smtpProtocol?: 'smtp' | 'smtps';
  smtpUsername?: string; // 1..320
  smtpPassword?: string; // 1..1024, write-only
}
```

Initial SMTP setup must be complete. SMTP hostname/domain normalization,
TLS/protocol/port compatibility, the 31 registered key schemas, bodyless
connection verification, runtime-effect boundaries, and UUIDv7 idempotency
rules are documented in the
[System Settings and Platform SMTP Frontend Contract](../api/system-settings.md).

---

## Database Server DTOs

The database-server create, connectivity, query, history-query, and update DTOs
contain credential, SSL, pool, timeout, capacity, and lifecycle rules that are
too interdependent for a short shared excerpt. Use the verified
[Database Servers Frontend Contract](../api/database-servers.md), including its
normalization table and cross-field validation rules.

---

## Storage Server DTOs

Storage Server registration, base update, full routing-profile replacement,
principal-reference rotation, verification, lifecycle, attestation-key, and
source-bound recovery-evidence DTOs are documented in the verified
[Storage Servers Frontend Contract](../api/storage-servers.md).

Important shared constraints:

- all Storage Server and attestation-key mutations require UUIDv7
  `x-idempotency-key`;
- create/update endpoint URLs are absolute and credential-free, and the public
  endpoint is HTTPS;
- routing profile is a full replacement with an
  `expectedBindingRevision`, four distinct mandatory class buckets, nine
  principal references, and six attestation key IDs;
- principal references match exact `env:S3_<PREFIX>_<PRINCIPAL>_<ROLE>`
  suffixes and are never secret material;
- rotation, verification, lifecycle, key promotion, and delete requests have
  no body where the API contract says none;
- recovery-destination registration accepts a write-only
  `env:STORAGE_RECOVERY_*` locator, while policy verification is
  revision-fenced and requires a trusted source-bound evidence package;
- recovery evidence uses canonical millisecond UTC timestamps, distinct
  lowercase SHA-256 digests, and three distinct administration boundaries;
- no DTO accepts an access key, secret key, Ed25519 private key, raw
  fingerprint, or force-activation flag.

---

## Tenant DTOs

Tenant registration, identity/FQDN preflight, placement, provisioning preview,
subscription quote, optimistic profile update, lifecycle, permanent destroy,
and FQDN request contracts are documented in the verified
[Admin Tenants Frontend Contract](../api/tenants.md).

Tenant-user directory, summary, access catalogue, invite, profile/placement,
password, WebPhone, branch-role replacement, and lifecycle DTOs are documented
in [Tenant Users and Access](../api/tenant-users.md).

Tenant operation history, timeline, retry/cancel, update selection,
prerequisite evidence, managed-operation, component-state, and seed-state DTOs
are documented in
[Tenant Operations and Provisioning](../api/tenant-operations.md).

Important shared constraints:

- Core's global validation rejects unknown request fields.
- Tenant, quote, catalogue, organization-placement, operation, and
  idempotency identifiers that explicitly require UUIDv7 cannot use mock UUIDs.
- Tenant creation requires a current server-issued `quoteId`; do not submit
  invented plan labels, `placementMode`, or frontend-computed totals.
- Tenant creation requires an explicit UUIDv7 `storageServerId` loaded from
  the safe placement-options endpoint; it is part of the durable command
  fingerprint.
- `UpdateTenantDto.expectedUpdatedAt` is an exact ISO timestamp used for
  optimistic concurrency.
- `UpdateTenantDto` does not accept `storageServerId`; existing placement is
  read-only in ordinary profile edit. A separate fenced migration contract
  exists but is default-off and lacks the complete frontend-safe read model.
- Tenant-user `DELETED` is a visibility value, not `UserStatusEnum`.
- Branch-role updates are full replacement sets, not add/remove deltas.
- Gateway tenant mutations require an `x-idempotency-key` UUIDv7 even where an
  individual Core controller lacks `@IdempotencyRequired()`.

### Tenant Storage Server migration DTOs

```typescript
interface CreateTenantStorageMigrationDto {
  targetStorageServerId: string;               // UUIDv7
  expectedSourcePlacementRevision: number;    // integer >= 1
  expectedSourceStorageFenceRevision: number; // integer >= 1
  rollbackRetentionDays?: number;              // integer 1..90, default 7
}

interface RollbackTenantStorageMigrationDto {
  expectedPlacementRevision: number;    // integer >= 1
  expectedStorageFenceRevision: number; // integer >= 1
}

interface FinalizeTenantStorageMigrationDto {
  expectedRetainedUntil: string; // strict ISO-8601 timestamp
}
```

All migration mutations require UUIDv7 `x-idempotency-key`. Retry, cancel,
and post-cutover retry/cancel have no body. The ordinary tenant response does
not currently expose the source revisions required by create, so the portal
must not invent them. See
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md).

---

## Modules and Catalogue DTOs

Use the verified [Modules and Catalogue Frontend Contract](../api/catalog.md)
as the source of truth for module, tier, feature, grant, price-ladder, and
managed-currency requests. It records immutable keys, strict unknown-field
rejection, per-field bounds, decimal-string formats, UUIDv7 idempotency
requirements, and the cross-field rules that cannot be represented by isolated
TypeScript property types.
