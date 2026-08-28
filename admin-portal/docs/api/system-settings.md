# System Settings, Platform SMTP, Fatal Alerts, and Storage Runtime

Status: **[Verified]**

Last source verification: **2026-08-27**

Verified against the current API Gateway route contracts, Core controller,
DTOs, registry, services, entities, migrations, SMTP verifier, the private
Core-to-Realtime configuration contract, runtime consumers, and Admin Portal
settings screens.

This is the implementation contract for:

- `/settings/platform`
- `/settings/auth`
- `/settings/billing`
- `/settings/notifications`
- `/settings/asterisk`
- `/settings/smtp`
- `/settings/fatal-alerts`
- `/settings/storage`

It covers the DB-backed typed settings registry and the separate platform SMTP
Realtime fatal-alert, and storage-runtime singletons. Tenant workspace/email
settings are different tenant-portal APIs and are outside this Admin Portal
contract.

## Ownership and route inventory

| Concern | Contract |
|:---|:---|
| Backend owner | `core-app` |
| Browser prefix | `/api/admin/core/v1` |
| Core upstream prefix | `/api/v1/admin` |
| Guard | `AdminGuard` |
| Read permission | `admin.settings.read` |
| Mutation permission | Generic PUT, SMTP PATCH, fatal-alert PATCH, and storage-runtime PATCH: `admin.settings.update` + `admin.settings.critical`; SMTP verification: `admin.settings.update` |
| Generic registry keys | 31 |
| Gateway method/path contracts | 11 |
| Current Admin Portal integration | All eleven routes are source-integrated, including exact by-key reload, settings, Asterisk, SMTP, fatal-alert switching, storage-runtime controls, and verification states |

The Gateway exposes exactly these eleven method/path contracts:

| Method and canonical browser path | Permission | Success | UUIDv7 key | Purpose |
|:---|:---|:---:|:---:|:---|
| `GET /api/admin/core/v1/system-settings` | `admin.settings.read` | `200` | No | List registered settings, optionally by prefix |
| `GET /api/admin/core/v1/system-settings/:key` | `admin.settings.read` | `200` | No | Get a registered setting; `key=email` resolves the SMTP singleton |
| `PUT /api/admin/core/v1/system-settings/:key` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Store or replace one generic setting override |
| `GET /api/admin/core/v1/system-settings/email` | `admin.settings.read` | `200` | No | Read the redacted SMTP singleton |
| `PATCH /api/admin/core/v1/system-settings/email` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Configure or update the platform SMTP singleton |
| `GET /api/admin/core/v1/system-settings/email/audit` | `admin.settings.read` | `200` | No | Read the latest 25 redacted SMTP audit entries |
| `POST /api/admin/core/v1/system-settings/email/verify-connection` | `admin.settings.update` | `201` | Yes | Authenticate against the saved SMTP server without sending mail |
| `GET /api/admin/core/v1/system-settings/fatal-alerts` | `admin.settings.read` | `200` | No | Read the safe Core-owned Realtime fatal-alert configuration |
| `PATCH /api/admin/core/v1/system-settings/fatal-alerts` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Configure or enable/disable Realtime fatal-alert delivery |
| `GET /api/admin/core/v1/system-settings/storage-runtime` | `admin.settings.read` | `200` | No | Read only storage enablement, key state, broker readiness, and update time |
| `PATCH /api/admin/core/v1/system-settings/storage-runtime` | `admin.settings.update` + `admin.settings.critical` | `200` | Yes | Enable/disable the runtime or generate/rotate its server-side key |

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
are not paginated and have no `meta`. Fatal-alert and storage-runtime responses
use the same Core envelope. They never return stored token or key material.

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
- `asterisk.` returns twenty-two.
- `notifications.` returns four.
- an unknown prefix returns an empty array.
- absent or empty `prefix` returns all 36 settings.

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

> **Scheduled for removal.** Every `asterisk.*` key below is accurate today and
> remains the live contract, but all 22 are planned to move out of the
> key/value settings registry into typed WebPhone entities under a dedicated
> `webphone` schema, owned by a new `webphone-app` application.
>
> Reasons for the move: the registry cannot express structure (server lists and
> ICE servers are JSON text inside a `varchar`), cannot express per-tenant
> configuration at all, and stores TURN credentials in plaintext.
>
> Backend design: `backend/docs/LLD/00-shared/12_webphone/en/`. The
> key-by-key mapping is in `03_Configuration.md` §2 and the phased cutover —
> which keeps this contract working until the final contract phase — is in
> `09_Migration_Plan.md`.
>
> **Do not build new screens against these keys.** The Asterisk settings page is
> generated from the generic settings registry and will need a dedicated screen
> once the keys are removed.

| Key | Type | Default | Validation |
|:---|:---|:---|:---|
| `asterisk.enabled` | boolean | `false` | strict boolean |
| `asterisk.websocket_url` | string | `wss://callcenter.mersany.com:8089/ws` | empty or `ws://` / `wss://` without whitespace; max 512 |
| `asterisk.websocket_url_secondary` | string | empty | empty or `ws://` / `wss://` without whitespace; max 512 |
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
| `asterisk.turn_rest_enabled` | boolean | `false` | strict boolean |
| `asterisk.turn_rest_ttl_seconds` | integer | `3600` | `60..86400` |
| `asterisk.turn_rest_uris` | string | empty | max 2048; no server-side URL validation |
| `asterisk.ice_servers_json` | string | `[]` | max 10000; no server-side JSON validation |
| `asterisk.ice_transport_policy` | string | `all` | enum: `all`, `relay` |
| `asterisk.extra_json` | string | `{}` | max 10000; no server-side JSON validation |

The Admin WebPhone loads this prefix through the canonical Gateway endpoint
and parses the JSON-text settings client-side. The Asterisk settings UI now
validates the two server lists as JSON arrays of `RTCIceServer`-compatible
objects and `extra_json` as a JSON object before saving; Core currently checks
only that they are bounded strings.

`allow_invalid_tls_certificate` documents a backend-proxy capability. Browser
WebRTC cannot be made to trust an invalid certificate merely by changing this
value.

**Secondary SIP server (failover).** `asterisk.websocket_url_secondary` is an
optional backup WebSocket transport. When set, the webphone hands JsSIP both
endpoints as weighted sockets (primary weight 10, secondary weight 0) so it
tries the primary first and automatically fails over to the secondary on
connection loss — this is JsSIP's native multi-socket transport failover, not
custom reconnect logic. Only the transport URL fails over; the SIP domain/AOR,
outbound proxy, and registrar stay governed by the primary `asterisk.*` keys.
See `packages/webphone/src/config.ts` and
`admin-portal/src/components/layout/hooks/useWebRTCPhone.ts` (`connectPhone`).

**ICE transport policy.** `asterisk.ice_transport_policy` maps directly to
`RTCConfiguration.iceTransportPolicy`. Left at `all` (the default), calls
attempt direct/STUN paths before falling back to TURN; set to `relay` to
force every call's media through the configured TURN server(s) in
`asterisk.turn_servers_json` — useful behind restrictive corporate NATs or
firewalls where direct/STUN connectivity is unreliable. `all` is passed
through as `undefined` to the browser (its own default) rather than set
explicitly. See `packages/webphone/src/config.ts` (`pcConfigFromSettings`).

**Ephemeral TURN REST credentials.** `asterisk.turn_rest_enabled`,
`asterisk.turn_rest_ttl_seconds`, and `asterisk.turn_rest_uris` opt into
minting short-lived, per-admin TURN credentials on each `GET
me/webphone` call instead of relying only on the long-lived static
credentials in `asterisk.turn_servers_json`. This follows the widely
implemented "TURN REST API" convention (coturn's `--use-auth-secret`
mode): `username = "<expiryUnixSeconds>:<adminUserId>"`, `credential =
base64(HMAC-SHA1(secret, username))`. It additionally requires the
`ASTERISK_TURN_SHARED_SECRET` **environment variable** (≥32 bytes) on
Core, set to the exact same secret configured on the TURN server —
deliberately not a system setting, since secrets don't belong in that
registry (see its own header comment). Leaving `turn_rest_enabled` off
(the default) or the env var unset makes `getMyWebphoneConfig()`'s
`turnCredentials.enabled` field `false` with no other effect; nothing
about the existing static TURN config changes. Minted credentials are
appended to, not a replacement for, `asterisk.turn_servers_json` /
`asterisk.ice_servers_json` in `pcConfigFromSettings`. See
`mutakamel-apps/core-app/src/admin/system-settings/asterisk-turn-credentials.service.ts`
(backend) and `useWebRTCPhone.ts`'s TURN-credential refresh effect
(frontend, re-fetches ~60s before `expiresAt`).

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

## Realtime fatal alerts

This singleton is independent of both the generic 31-key registry and the SMTP
singleton. Core is the only database authority; Realtime never connects to
PostgreSQL and does not read `FATAL_ALERT_*` environment variables.

### Read configuration

`GET /api/admin/core/v1/system-settings/fatal-alerts`

```ts
interface RealtimeFatalAlertConfig {
  configured: boolean;
  enabled: boolean;
  revision: number | null;
  webhookUrl: string | null;
  webhookTokenConfigured: boolean;
  timeoutMs: number;
  updatedAt: string | null;
}
```

Before initial setup, Core returns `configured: false`, `enabled: false`, a
`null` revision/URL/timestamp, `webhookTokenConfigured: false`, and the safe
default timeout `5000`. Plaintext and encrypted token material are never
returned to an administrator.

### Configure or switch delivery

`PATCH /api/admin/core/v1/system-settings/fatal-alerts`

```ts
interface PatchRealtimeFatalAlertConfigDto {
  enabled?: boolean;
  webhookUrl?: string;   // HTTP(S), max 2048, no embedded credentials
  webhookToken?: string; // 1..2048 UTF-8 bytes, write-only
  timeoutMs?: number;    // integer 1..120000
}
```

- Send at least one field and a UUIDv7 `x-idempotency-key`.
- Initial enablement requires both URL and token.
- Omitted values retain their saved state; enabling an existing configuration
  does not require resending its token.
- Core normalizes the URL, encrypts the token with AES-256-GCM using a
  purpose-bound subkey, serializes updates under a row lock, increments the
  revision, and audits the row through the control-plane audit trigger.
- Disabling retains the encrypted configuration for later re-enable, but the
  private runtime response contains `null` URL/token while disabled.
- Realtime authenticates to Core over the private service contract, refreshes
  every 30 seconds, and atomically replaces its in-memory sink. A failed
  refresh retains the last valid state and does not crash the process.

## Storage runtime

This singleton controls whether application storage credential decryption is
available. Core owns the generated encryption key and the database state. The
Admin Portal never accepts, receives, displays, logs, or stores raw key
material.

### Read configuration

`GET /api/admin/core/v1/system-settings/storage-runtime`

```ts
interface StorageRuntimeConfig {
  enabled: boolean;
  configured: boolean;
  brokerConfigured: boolean;
  updatedAt: string | null;
}
```

The response projection is closed to these four fields. `brokerConfigured` is
only a secret-free readiness boolean for Core's three pairwise storage-runtime
broker secrets; no secret value, name, or raw key is returned. An enabled
runtime must always have its storage key configured, while
`brokerConfigured: false` can truthfully expose restart/configuration drift on
an already-enabled runtime.

### Generate, rotate, or switch the runtime

`PATCH /api/admin/core/v1/system-settings/storage-runtime`

```ts
interface PatchStorageRuntimeConfigDto {
  enabled?: boolean;
  rotateKey?: boolean;
}
```

- Send at least one field and a UUIDv7 `x-idempotency-key`.
- The Portal sends `rotateKey: true` for the explicit key action; there is no
  key input.
- `rotateKey: true` generates the initial key when unconfigured and atomically
  rotates the key when already configured.
- Enabling requires both an already configured key and
  `brokerConfigured: true`. Generating a key does not enable the runtime
  automatically.
- The Portal disables a new enable action and shows a clear warning while Core
  reports `brokerConfigured: false`; it still permits disabling an already
  enabled runtime. Core remains the authoritative mutation guard.
- Disabling denies new route resolution and therefore new storage operations.
  It does not revoke an operation already resolved or a previously issued
  signed URL, whose configured maximum lifetime is one hour. Emergency
  immediate cutoff requires revoking/rotating the provider credential.
- The Portal presents a separate enable/disable switch and an explicit
  confirmation before generate/rotate.
- The Portal retains an idempotency key only when retrying the exact same
  ambiguous mutation intent.

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
| `400` | `REALTIME_FATAL_ALERT_CONFIG_EMPTY_PATCH` | Require at least one changed field |
| `422` | `REALTIME_FATAL_ALERT_CONFIG_INVALID` | Show the URL/token/enablement validation message |
| `409` | `CORE.STORAGE_RUNTIME.NOT_CONFIGURED` | Generate a server-side key before enabling the runtime |
| `409` | `CORE.STORAGE.RUNTIME_AUTH_NOT_CONFIGURED` | Configure pairwise runtime broker authentication before enabling storage |
| `503/504` | Gateway/Core availability or timeout | Do not simulate success |

DTO validation errors, authentication failures, permission failures, and rate
limits use the shared Core/Gateway error shapes.

## Current Admin Portal evidence

The settings pages use canonical Gateway paths, the shared authenticated
client, strict Core-envelope readers, exact list and by-key reads, and
caller-owned UUIDv7 keys for saves and verification. Current UI behavior:

1. Gates reads with `admin.settings.read`, generic/SMTP/fatal-alert/storage
   saves with update plus critical, and SMTP verification with its exact
   permission.
2. Distinguishes loading, forbidden, unavailable, malformed, empty, read-only,
   saving, saved, and failed states while preserving code/correlation evidence.
3. Enforces key-specific constraints, Asterisk JSON validation, and the billing
   minimum/maximum invariant both during editing and at the save boundary.
4. Keeps SMTP unknown until the authoritative read settles, represents an
   unconfigured server without sample credentials, and keeps password input
   write-only.
5. Blocks connection verification while displayed fields differ from saved
   Core state, then tests the saved configuration with a bodyless request.
6. Reconciles mutation responses and uses authoritative reload after ambiguous
   or failed saves.
7. Keeps the fatal-alert token write-only and presents a dedicated persisted
   enable/disable switch with explicit configured/revision/update evidence.
8. Renders only `enabled`, `configured`, `brokerConfigured`, and `updatedAt`
   for storage runtime, blocks new enablement until both safe readiness signals
   pass, and confirmation-gates key generation or rotation without ever
   handling key or broker-secret values.

Authenticated runtime and deployed consumer-effect verification remain
separate release gates; source integration does not prove either one.

## Backend source map

Paths are relative to `C:\mutakamel.ai\frontend`:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/system-settings.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/system-settings.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/platform-smtp-config.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/realtime-fatal-alert-config.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/realtime-fatal-alert-config.internal.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/system-setting-query.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/upsert-system-setting.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/platform-smtp-config.dto.ts`
- `../backend/mutakamel-apps/core-app/src/admin/system-settings/dto/realtime-fatal-alert-config.dto.ts`
- `../backend/mutakamel-apps/core-app/src/common/system-settings/system-settings.registry.ts`
- `../backend/mutakamel-apps/core-app/src/common/email/smtp-connection-verifier.service.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/system-setting.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/platform-smtp-config.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/platform-smtp-config-history.entity.ts`
- `../backend/mutakamel-apps/core-app/packages/database/src/entities/control-plane/realtime-fatal-alert-config.entity.ts`
- `../backend/mutakamel-apps/realtime-app/src/observability/core-fatal-alert-config.client.ts`
- `../backend/mutakamel-apps/realtime-app/src/observability/core-managed-fatal-alert.sink.ts`
- `../backend/mutakamel-apps/core-app/src/common/notifications/notifications.service.ts`
- `../backend/mutakamel-apps/core-app/src/admin/billing/billing-cycle.service.ts`
- `../backend/mutakamel-apps/core-app/src/tenant/payments/payments.service.ts`

## Frontend source map

- `admin-portal/src/app/settings/hooks/useSettings.ts`
- `admin-portal/src/app/settings/hooks/useSettingsRegistry.ts`
- `admin-portal/src/app/settings/components/SettingField.tsx`
- `admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts`
- `admin-portal/src/app/settings/smtp/page.tsx`
- `admin-portal/src/app/settings/fatal-alerts/fatal-alert-contract.ts`
- `admin-portal/src/app/settings/fatal-alerts/hooks/useFatalAlertSettings.ts`
- `admin-portal/src/app/settings/fatal-alerts/page.tsx`
- `admin-portal/src/app/settings/storage/storage-runtime-contract.ts`
- `admin-portal/src/app/settings/storage/hooks/useStorageRuntimeSettings.ts`
- `admin-portal/src/app/settings/storage/page.tsx`


## DTOs (Migrated from dtos.md)

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
