# System Settings and Platform SMTP Frontend Contract

Status: **Verified backend contract; frontend DONE/PARTIAL/REFACTOR**

Last source verification: **2026-07-30**

Verified against the current API Gateway route contracts, Core controller,
DTOs, registry, services, entities, SMTP verifier, runtime consumers, and
Admin Portal settings screens.

This is the implementation contract for:

- `/settings/platform`
- `/settings/auth`
- `/settings/billing`
- `/settings/notifications`
- `/settings/asterisk`
- `/settings/smtp`

It covers the DB-backed typed settings registry and the separate platform SMTP
singleton. Tenant workspace/email settings are different tenant-portal APIs
and are outside this Admin Portal contract.

## Ownership and route inventory

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser prefix | `/api/admin/core/v1` |
| Core upstream prefix | `/api/v1/admin` |
| Guard | `AdminGuard` |
| Read permission | `admin.settings.read` |
| Mutation permission | Generic PUT and SMTP PATCH: `admin.settings.update` + `admin.settings.critical`; SMTP verification: `admin.settings.update` |
| Generic registry keys | 31 |
| Gateway method/path contracts | 7 |
| Current Admin Portal integration | Generic settings and Asterisk are live; SMTP is partially integrated and retains the gaps below |

The Gateway exposes exactly these seven method/path contracts:

| Method and canonical browser path | Permission | Success | UUIDv7 key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/system-settings` | `admin.settings.read` | `200` | No | List registered settings, optionally by prefix |
| `GET /api/admin/core/v1/system-settings/:key` | `admin.settings.read` | `200` | No | Get a registered setting; `key=email` resolves the SMTP singleton |
| `PUT /api/admin/core/v1/system-settings/:key` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Store or replace one generic setting override |
| `GET /api/admin/core/v1/system-settings/email` | `admin.settings.read` | `200` | No | Read the redacted SMTP singleton |
| `PATCH /api/admin/core/v1/system-settings/email` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Configure or update the platform SMTP singleton |
| `GET /api/admin/core/v1/system-settings/email/audit` | `admin.settings.read` | `200` | No | Read the latest 25 redacted SMTP audit entries |
| `POST /api/admin/core/v1/system-settings/email/verify-connection` | `admin.settings.update` | `201` | Yes | Authenticate against the saved SMTP server without sending mail |

Every mutation is `WRITE_SENSITIVE` at the Gateway. Send
`x-idempotency-key: <UUIDv7>`, including the bodyless connection test and the
generic `PUT`, even though not every Core method has
`@IdempotencyRequired()`.

## Shared HTTP contract

Successes use the Core envelope:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string;
  timestamp: string;
}
```

The generic setting list and SMTP audit are direct arrays under `data`. They
are not paginated and have no `meta`.

The browser can receive either Core or Gateway errors:

```ts
interface CoreErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  errorCategory: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  path: string;
}

interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  correlationId: string;
  errors?: Record<string, string[]>;
}
```

Normalize `errorCode` and `code` while preserving `correlationId`.

## Idempotency

For `PUT`, `PATCH`, and the connection-verification `POST`:

1. Generate one UUIDv7 when the user starts the mutation.
2. Reuse it only for an exact retry of the same method, path, body, and actor.
3. Generate a new key after any value or command intent changes.
4. `GW.IDEM.IN_FLIGHT` means the prior command may still be running; refetch
   rather than issuing a second intent.
5. `GW.IDEM.MISMATCH` means a key was reused for a different request.

The required header is `x-idempotency-key`. `Idempotency-Key` is a different
header, and `crypto.randomUUID()` normally produces UUIDv4 rather than UUIDv7.

## Generic settings registry

### Read model

```ts
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
```

- `isDefault: true` means no stored override is active.
- `readOnly: true` means an environment-managed value is exposed and cannot be
  changed through the DB API.
- All 31 currently registered keys are editable and return
  `readOnly: false`. The read-only mechanism exists for future registry keys.
- A custom `description` replaces both `descriptionI18n.en` and
  `descriptionI18n.ar` with that same custom text.
- The response does **not** expose schema type, default value, enum choices,
  minimum, maximum, maximum length, or pattern. Admin Portal must keep verified
  UI metadata in sync with the backend registry or the backend must gain a
  schema endpoint.

There is no generic setting id, revision, `createdAt`, or `updatedAt` in this
projection.

### List settings

`GET /api/admin/core/v1/system-settings`

```ts
interface SystemSettingQueryDto {
  prefix?: string; // trimmed string, max 120
}
```

Filtering is a case-sensitive `key.startsWith(prefix)` operation. Examples:

- `billing.` returns five settings.
- `asterisk.` returns seventeen.
- `notifications.` returns four.
- an unknown prefix returns an empty array.
- absent or empty `prefix` returns all 31 settings.

The list follows registry insertion order. It is not searchable, sortable, or
paginated.

### Get one setting

`GET /api/admin/core/v1/system-settings/:key`

Generic keys must:

- be a trimmed string of at most 120 characters;
- contain at least two lower-case dotted segments;
- match `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`.

Unknown, retired, or unregistered keys return `SETTING_KEY_UNKNOWN`.

### Upsert one setting

`PUT /api/admin/core/v1/system-settings/:key`

```ts
interface UpsertSystemSettingDto {
  value: unknown;       // required; checked against the selected key schema
  description?: string; // trimmed, max 255
}
```

Core rejects unknown DTO fields. Value types are strict:

- number settings require a JSON number, not `"14"`;
- boolean settings require `true` or `false`, not `"true"`;
- string settings require a JSON string;
- `null`, arrays, and objects are invalid for every current key.

Writes are last-writer-wins. There is no optimistic revision field. A
concurrent first-write uniqueness race is recovered by reloading the winning
row and applying the latest value.

There is no DELETE/reset endpoint. Writing the registry default still creates
an override and therefore returns `isDefault: false`. Omitting `description`
preserves an existing custom description; an empty string is accepted and
becomes the displayed description.

## Registered setting catalogue

The tables below are the current backend schema. Bounds are inclusive.

### Billing and tenants

| Key | Type | Default | Validation | Verified runtime effect |
|:---|:---|:---|:---|:---|
| `billing.default_currency` | string | `USD` | `USD`, `EUR`, `EGP`, `AED`, or `SAR`; exactly 3 uppercase characters | Registry value only today; invoice settlement remains canonical USD |
| `billing.invoice_lead_days` | integer | `14` | `1..365` | Read by the billing-cycle service |
| `billing.dunning_grace_days` | integer | `7` | `0..90` | Read by the billing-cycle service |
| `billing.min_topup_usd` | integer | `1` | `1..1,000,000,000` | Read for every wallet top-up |
| `billing.max_topup_usd` | integer | `100000` | `1..1,000,000,000` | Read for every wallet top-up |
| `tenants.trial_days` | integer | `14` | `1..365` | Registry value only in current runtime code |

The registry validates the two top-up values independently. It permits
`min_topup_usd > max_topup_usd`, but payment processing then fails with
`TOPUP_LIMITS_INVALID`. The UI must validate the pair before either write and
sequence two changes so no invalid intermediate range is created.

### Authentication, support, and platform

| Key | Type | Default | Validation | Verified runtime effect |
|:---|:---|:---|:---|:---|
| `auth.invite_token_ttl_minutes` | integer | `1440` | `5..43200` | Registry value only in current auth runtime |
| `auth.reset_token_ttl_minutes` | integer | `60` | `5..1440` | Registry value only in current auth runtime |
| `support.email` | string | `support@mutakamel.ai` | email-like pattern, max 254 | Registry/display value only |
| `platform.maintenance_mode` | boolean | `false` | strict boolean | Registry value only; current login code does not read it |

The descriptions express intended product behavior, but the verified runtime
boundary above is authoritative. In particular, toggling maintenance mode does
not currently prove that tenant login is blocked.

### Asterisk and WebRTC

| Key | Type | Default | Validation |
|:---|:---|:---|:---|
| `asterisk.enabled` | boolean | `false` | strict boolean |
| `asterisk.websocket_url` | string | `wss://callcenter.mersany.com:8089/ws` | empty or `ws://` / `wss://` without whitespace; max 512 |
| `asterisk.sip_domain` | string | `callcenter.mersany.com` | empty or domain-like text with optional port; max 253 |
| `asterisk.realm` | string | `asterisk` | max 253 |
| `asterisk.outbound_proxy` | string | empty | empty or `sip:` URI without whitespace; max 512 |
| `asterisk.default_caller_id` | string | empty | max 64 |
| `asterisk.from_domain` | string | empty | empty or domain-like text with optional port; max 253 |
| `asterisk.registrar_server` | string | empty | empty or `sip:` URI without whitespace; max 512 |
| `asterisk.contact_uri` | string | empty | empty or `sip:` URI without whitespace; max 512 |
| `asterisk.register_expires` | integer | `600` | `30..86400` |
| `asterisk.session_timers` | boolean | `false` | strict boolean |
| `asterisk.trace_sip` | boolean | `false` | strict boolean |
| `asterisk.allow_invalid_tls_certificate` | boolean | `false` | strict boolean |
| `asterisk.stun_servers` | string | `stun:stun.l.google.com:19302` | max 2048; no server-side URL validation |
| `asterisk.turn_servers_json` | string | `[]` | max 10000; no server-side JSON validation |
| `asterisk.ice_servers_json` | string | `[]` | max 10000; no server-side JSON validation |
| `asterisk.extra_json` | string | `{}` | max 10000; no server-side JSON validation |

The Admin WebPhone loads this prefix through the canonical Gateway endpoint
and parses the JSON-text settings client-side. The Asterisk settings UI now
validates the two server lists as JSON arrays of `RTCIceServer`-compatible
objects and `extra_json` as a JSON object before saving; Core currently checks
only that they are bounded strings.

`allow_invalid_tls_certificate` documents a backend-proxy capability. Browser
WebRTC cannot be made to trust an invalid certificate merely by changing this
value.

### Notifications

| Key | Type | Default | Runtime rule |
|:---|:---|:---|:---|
| `notifications.in_app_enabled` | boolean | `true` | Controls persisted in-app notification availability |
| `notifications.realtime_enabled` | boolean | `false` | Also requires global notification and realtime environment flags |
| `notifications.push_enabled` | boolean | `false` | Also requires global/push environment flags and Firebase provider configuration |
| `notifications.email_enabled` | boolean | `false` | Also requires global/email environment flags |

These values are desired DB switches, not the complete effective runtime
configuration. A stored `true` cannot override a disabled environment feature
or missing Firebase configuration.

## Platform SMTP

The SMTP singleton is independent of the generic 31-key registry. Do not
attempt to write SMTP fields with `PUT /system-settings/:key`.

### Read configuration

`GET /api/admin/core/v1/system-settings/email`

```ts
type PlatformSmtpProtocol = 'smtp' | 'smtps';

interface PlatformSmtpConfig {
  configured: boolean;
  revision: number | null;
  fromAddress: string | null;
  fromName: string | null;
  senderDomain: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpProtocol: PlatformSmtpProtocol | null;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  updatedAt: string | null;
}
```

When no row exists, `configured` is false and every configuration field is
null except `smtpPasswordConfigured: false`. Do not hydrate fabricated SMTP
defaults.

The plaintext or encrypted SMTP password is never returned.

### Configure or update

`PATCH /api/admin/core/v1/system-settings/email`

```ts
interface PatchPlatformSmtpConfigDto {
  fromAddress?: string;   // valid email, max 320
  fromName?: string;      // 1..200
  senderDomain?: string;  // max 253
  smtpHost?: string;      // max 253
  smtpPort?: number;      // integer 1..65535
  smtpSecure?: boolean;   // strict boolean
  smtpProtocol?: 'smtp' | 'smtps';
  smtpUsername?: string;  // 1..320
  smtpPassword?: string;  // 1..1024, write-only
}
```

Cross-field and normalization rules:

- an empty patch returns `PLATFORM_SMTP_CONFIG_EMPTY_PATCH`;
- initial setup must produce a complete configuration, including password;
- later patches retain every omitted field and retain the stored password when
  `smtpPassword` is omitted;
- `fromAddress` is trimmed, lowercased, and revalidated;
- `fromName` is trimmed and may not be empty or contain CR/LF;
- `senderDomain` and `smtpHost` are trimmed, lowercased, and must be
  multi-label domain names; IP addresses and `localhost` are rejected;
- `smtpUsername` is trimmed;
- `smtps` requires `smtpSecure: true`;
- port `465` requires both `smtpProtocol: 'smtps'` and
  `smtpSecure: true`;
- other ports may use the supported combinations accepted by the service.

A successful patch is transactional, increments `revision`, records a
redacted `CONFIGURED` or `UPDATED` audit entry, publishes the changed
configuration for email workers, and returns the complete safe
`PlatformSmtpConfig`.

There is no optimistic `expectedRevision` request field. Concurrent patches
are serialized with a row lock, and each successful patch applies to the
latest stored row.

### Connection verification

`POST /api/admin/core/v1/system-settings/email/verify-connection`

- Save the form first; verification always uses the stored configuration.
- Send no JSON body at all. Explicit `{}` returns
  `PLATFORM_SMTP_CONNECTION_VERIFICATION_BODY_FORBIDDEN`.
- Send a UUIDv7 `x-idempotency-key`.
- Core decrypts the credential only for Nodemailer's authenticated
  verification call and does not send an email.
- SMTP connection, greeting, and socket timeouts are bounded; Gateway total
  timeout is 30 seconds.
- Success is HTTP `201` with `{ verified: true }`.
- Only a successful connection creates a `CONNECTION_VERIFIED` audit entry.

### SMTP audit

`GET /api/admin/core/v1/system-settings/email/audit`

```ts
type PlatformSmtpConfigHistoryAction =
  | 'CONFIGURED'
  | 'UPDATED'
  | 'CONNECTION_VERIFIED';

type PlatformSmtpHistoryValue = string | number | boolean | null;

interface PlatformSmtpConfigHistory {
  id: string;
  action: PlatformSmtpConfigHistoryAction;
  revision: number | null;
  actor: string;
  changes: Array<{
    field: string;
    label: string;
    previousValue: PlatformSmtpHistoryValue;
    newValue: PlatformSmtpHistoryValue;
  }>;
  createdAt: string;
}
```

The response contains at most 25 entries, newest first. It is not paginated.
`actor` is a display label, not an actor object or stable id:

- current admin name when available;
- otherwise admin email;
- `Platform administrator` when a historical actor id no longer resolves;
- `Platform system` for a null actor id.

Password audit changes contain only `Configured` or `Updated` state labels.
Neither plaintext nor encrypted credential material appears in HTTP or audit
responses. `CONNECTION_VERIFIED` entries have an empty `changes` array.

There is no generic system-setting audit endpoint in this module; this audit
route is SMTP-only.

## Error catalogue

| HTTP | Code | Frontend behavior |
|---:|:---|:---|
| `400` | `GW.IDEM.MISSING` | Generate and attach a UUIDv7 key |
| `400` | `GW.IDEM.BAD_VALUE` | Fix the key generator; UUIDv4 is invalid |
| `409` | `GW.IDEM.IN_FLIGHT` | Keep a processing state, then refetch |
| `422` | `GW.IDEM.MISMATCH` | Never reuse a key after intent changes |
| `404` | `SETTING_KEY_UNKNOWN` | Remove/refresh unsupported local metadata |
| `409` | `SETTING_READ_ONLY` | Refetch and disable the editor |
| `422` | `SETTING_VALUE_INVALID` | Show the key-specific type/bounds/pattern error |
| `400` | `PLATFORM_SMTP_CONFIG_EMPTY_PATCH` | Require at least one changed field |
| `422` | `PLATFORM_SMTP_CONFIG_INVALID` | Show the returned SMTP cross-field message |
| `400` | `PLATFORM_SMTP_CONNECTION_VERIFICATION_BODY_FORBIDDEN` | Retry with no body |
| `503` | `SMTP_CONNECTION_VERIFICATION_FAILED` | Keep settings saved but show verification failure |
| `503/504` | Gateway/Core availability or timeout | Do not simulate success |

DTO validation errors, authentication failures, permission failures, and rate
limits use the shared Core/Gateway error shapes.

## Current Admin Portal gaps

The generic settings and Asterisk pages now use canonical Gateway paths, the
shared authenticated client, Core envelopes, real loading/error states,
mutation-response values, optimistic rollback by refetch, and
consumer-required Asterisk JSON validation. Remaining material gaps are:

1. Controls are not proactively gated by `admin.settings.read` and
   `admin.settings.update`; they currently surface backend `403` responses.
2. The shared client generates UUIDv7 keys automatically, but an exact mutation
   retry after a refresh must retain the original key rather than create a new
   user intent.
3. SMTP initializes some form defaults before the read completes instead of
   preserving the all-null unconfigured projection exactly.
4. SMTP read failures clear audit rows but do not expose a distinct load error.
5. SMTP adapters still use broad `any` types and do not preserve every error
   code, validation-detail field, and correlation id.
6. The UI presents registry descriptions such as maintenance mode and token
   TTLs as effective even where current runtime code does not consume them.
7. Forbidden, retry/in-flight, and some empty/read-only states remain
   incomplete outside the Asterisk page.

## Frontend implementation checklist

1. Move every request to the shared authenticated client and canonical Gateway
   paths.
2. Model the Core success envelope and normalize both error shapes.
3. Gate pages with `admin.settings.read` and mutations with
   `admin.settings.update`.
4. Use one UUIDv7 key per save/test intent and preserve it for exact retries.
5. Keep the 31-key UI schema synchronized with the backend registry until a
   schema endpoint exists.
6. Render `isDefault` and `readOnly` honestly; do not claim a reset action that
   the API does not provide.
7. Validate strict types, key-specific constraints, JSON text, and the
   top-up min/max pair before saving.
8. Use mutation responses as the new source of truth and roll back failed
   optimistic values.
9. Represent unconfigured SMTP with null/empty form fields, not sample
   credentials.
10. Keep the password write-only, omit it when unchanged, save before testing,
    and send no body to verification.
11. Treat SMTP configuration save and connection verification as distinct
    outcomes.
12. Remove fail-open preview and simulated-success behavior before describing
    the screens as server-backed.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/system-settings.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/system-settings.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/platform-smtp-config.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/system-setting-query.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/upsert-system-setting.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/platform-smtp-config.dto.ts`
- `../backend/mutakamel-apps/core-app/src/common/system-settings/system-settings.registry.ts`
- `../backend/mutakamel-apps/core-app/src/common/email/smtp-connection-verifier.service.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/system-setting.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/platform-smtp-config.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/platform-smtp-config-history.entity.ts`
- `../backend/mutakamel-apps/core-app/src/common/notifications/notifications.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/billing/billing-cycle.service.ts`
- `../backend/mutakamel-apps/core-app/src/tenant/payments/payments.service.ts`

## Frontend source map

- `admin-portal/src/app/settings/hooks/useSettings.ts`
- `admin-portal/src/app/settings/hooks/useSettingsRegistry.ts`
- `admin-portal/src/app/settings/components/SettingField.tsx`
- `admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts`
- `admin-portal/src/app/settings/smtp/page.tsx`
