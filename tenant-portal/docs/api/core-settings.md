# Core — Workspace Settings and Catalogues

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefixes: `/api/tenant/core/v1/workspace-settings`, `.../currencies`,
`.../taxes`, `.../numbering`, `.../email-config`, `.../notifications`

Portal status: **built** — all six screens ship in MASTER-PLAN Phase 5. Every
route on this page is called except the three alias halves the portal
deliberately does not use (`POST /:id/ack`, `POST /mark-all-read`,
`POST /:id/dismiss`).

Source inspected:
`core-app/src/tenant/workspace-settings/workspace-settings.controller.ts`,
`core-app/src/tenant/currencies/currencies.controller.ts`,
`core-app/src/tenant/taxes/taxes.controller.ts`,
`core-app/src/tenant/numbering-sequences/numbering-sequences.controller.ts`,
`core-app/src/tenant/email-config/tenant-email-config.controller.ts`,
`core-app/src/tenant/notifications/notifications.controller.ts`,
and each module's `dto/` folder.

**33 routes.** Workspace 2 · Currencies 5 · Taxes 4 · Numbering 4 ·
Email config 4 · Notifications 14.

Everything under [core-identity.md § What applies to every route](core-identity.md#what-applies-to-every-route-on-this-page)
applies here too — `TenantGuard`, AND-semantics permissions, `forbidNonWhitelisted`,
UUID v7, the `data` envelope.

---

## Workspace settings — 2 routes

| Method | Canonical path | Permission | Body |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/workspace-settings` | `workspace.read` | — |
| PUT | `/api/tenant/core/v1/workspace-settings` | `workspace.manage` | `UpdateWorkspaceSettingsDto` |

`UpdateWorkspaceSettingsDto` — every field optional:

| Field | Rule |
| --- | --- |
| `defaultLanguage?` | trim + lowercase, must be one of the supported set, ≤8 |
| `defaultCurrencyCode?` | trim + **uppercase**, exactly 3 characters |
| `timezone?` | trim, non-empty, ≤48 |
| `allowSupport?` | strict boolean — `"true"`/`"false"` accepted, arbitrary truthy strings are not |

**A missing provisioning row answers `TENANT_NOT_READY`.** That is a real state
for a freshly-created tenant, not an error to swallow — render it as "your
workspace is still being prepared", not as a failed save.

The currency must already exist in the tenant catalogue and be active; the
timezone and language are validated server-side. Each is a 422 with its own
code, not a generic failure.

---

## Currencies — 5 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/currencies` | `currencies.currency.read` | `CurrencyQueryDto` |
| POST | `/api/tenant/core/v1/currencies` | `currencies.currency.manage` | `CreateCurrencyDto` |
| PATCH | `/api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | `UpdateCurrencyDto` |
| POST | `/api/tenant/core/v1/currencies/:id/set-default` | `currencies.currency.manage` | — |
| DELETE | `/api/tenant/core/v1/currencies/:id` | `currencies.currency.manage` | — |

`CurrencyQueryDto` extends `PaginationQueryDto` with `status?` and `isDefault?`.

### The invariants the UI must reflect, not enforce

- **Exactly one default.** `set-default` promotes the target and demotes the
  previous one **in one transaction**. Do not model this as two calls, and do
  not optimistically clear the old default before the response.
- **`DELETE` is a deactivation, not a delete** — it returns **204** and marks
  the row inactive. History is preserved. Label the control accordingly.
- **The default currency cannot be deactivated**, and neither can one referenced
  by workspace settings. Both are 409s naming the reason.
- Exchange rates are **decimal strings**. Render through `Money`; never
  `Number()` one.

---

## Taxes — 4 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/taxes` | `taxes.tax.read` | `TaxQueryDto` |
| POST | `/api/tenant/core/v1/taxes` | `taxes.tax.manage` | `CreateTaxDto` |
| PATCH | `/api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | `UpdateTaxDto` |
| DELETE | `/api/tenant/core/v1/taxes/:id` | `taxes.tax.manage` | — |

`TaxQueryDto` extends `PaginationQueryDto` with `status?`, `companyId?`,
`isInclusive?`.

A tax is optionally **company-scoped**, and its `code` is unique **within that
scope** — the same code may exist for two companies. A duplicate is a 409 that
should name the company, otherwise the message is baffling.

`DELETE` is a deactivation returning **204**, for the same reason as currencies:
posted documents must keep resolving their tax.

---

## Numbering sequences — 4 routes

| Method | Canonical path | Permission | Body / query |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/numbering` | `numbering.read` | `NumberingSequenceQueryDto` |
| POST | `/api/tenant/core/v1/numbering` | `numbering.manage` | `CreateNumberingSequenceDto` |
| PATCH | `/api/tenant/core/v1/numbering/:id` | `numbering.manage` | `UpdateNumberingSequenceDto` |
| GET | `/api/tenant/core/v1/numbering/:code/peek` | `numbering.read` | `PeekNumberingSequenceQueryDto` |

**`nextValue` is serialised as a string.** It is a bigint on the server. Never
parse it into a JavaScript number — that is exactly the decimal-string rule, and
a sequence can outrun `Number.MAX_SAFE_INTEGER`.

`:code` is validated against `/^[A-Z0-9][A-Z0-9._:-]{0,63}$/` and **upper-cased**
before lookup, so the URL is case-insensitive but the stored code is not.

### `peek` is the whole point of the screen

`GET /numbering/:code/peek` returns `{ code, companyId, nextValue, formatted }`
and **consumes nothing**. Wire it to the create/edit form so prefix, padding and
start value render a live preview of the next document number. That is the only
way a user can tell what they are configuring.

**`nextValue` may never move backward** — a lower value is a **422**, not a
generic failure. Say what the current value is.

---

## Email configuration — 4 routes

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/email-config` | `workspace.email.read` | Safe projection — **no secrets** |
| PATCH | `/api/tenant/core/v1/email-config` | `workspace.email.manage` | Idempotency + `If-Match` required |
| POST | `/api/tenant/core/v1/email-config/verify` | `workspace.email.manage` | **No body.** Idempotency + `If-Match` |
| POST | `/api/tenant/core/v1/email-config/verify-connection` | `workspace.email.manage` | **No body** |

### This module has the strictest concurrency contract in Core

Writes require an **exact strong** `If-Match: "<n>"`:

| Situation | Status | Code |
| --- | --- | --- |
| Header absent | **428** | `TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED` |
| Header malformed or stale | **409** | `TENANT_EMAIL_CONFIG_STALE_REVISION` |

Weak etags (`W/"n"`) are **not** accepted here, unlike `activities`. Every
response carries `ETag: "<revision>"` and `Cache-Control: no-store, private`.

428 and 409 need **different** messages: one means "reload and try again", the
other means "someone else changed this while you were editing". Collapsing them
into one error is the mistake this contract exists to prevent — see the
`ConflictDialog` pattern.

**The password and provider references are write-only.** They go up in `PATCH`
and never come back in `GET`. A settings form must therefore show "configured"
rather than a masked value it does not have, and must not clear the stored
secret when the user saves without retyping it.

`verify` checks the saved sender domain (DKIM/SPF) at the exact revision;
`verify-connection` runs a bounded TLS-verified SMTP probe. Both return **201**.
The probe result is deliberately vague about network detail — do not present it
as a diagnostic log.

---

## Notifications — 14 routes

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/notifications` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/config` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/unread-count` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/read` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/acknowledge` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/ack` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/:id/dismiss` | `notifications.notification.read` |
| DELETE | `/api/tenant/core/v1/notifications/:id` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/mark-all-read` | `notifications.notification.read` |
| POST | `/api/tenant/core/v1/notifications/read-all` | `notifications.notification.read` |
| GET | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.read` |
| PUT | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.manage` |
| POST | `/api/tenant/core/v1/notifications/device-tokens` | `notifications.device_token.manage` |
| DELETE | `/api/tenant/core/v1/notifications/device-tokens/:id` | `notifications.device_token.manage` |

### Four of these fourteen are aliases — pick one and stay on it

| Prefer | Alias, same behaviour |
| --- | --- |
| `POST /:id/acknowledge` | `POST /:id/ack` (legacy) |
| `POST /mark-all-read` | `POST /read-all` (LLD-aligned) |
| `DELETE /:id` | `POST /:id/dismiss` |

Aliases exist for compatibility. A screen that mixes them is harder to reason
about, not more compatible. The portal currently calls `/read-all` and
`/:id/read`.

### Shape

**This list is cursor-paginated**, not page/limit like the rest of Core:
`limit` (1–50, default 20), `cursor` (opaque), `unreadOnly`. The response is
`{ items, nextCursor }`. **Preserve the cursor exactly** — it is opaque and
must not be parsed, rebuilt or logged as meaningful.

All read/ack/dismiss routes return **204**.

Every route is scoped to the calling user. `dismiss` hides a notification **for
that user only**; it is not a delete for anyone else.

### The realtime interaction

Live updates arrive through `@mutakamel/realtime-app-client` as
`notification.created.v1`, `notification.updated.v1` and
`notification.unread-count.changed.v1`. `src/lib/notifications/tenant-notification-runtime.ts`
already owns this and validates every payload with zod.

**One contract note that is easy to get wrong:** `lastNotificationCursor` in the
realtime handshake may only be a cursor committed after a **fully applied REST
sync page**. A cursor observed on a socket item must never be sent back — doing
so silently skips notifications.

---

## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/settings/workspace` | 5.1 | live |
| `/core/settings/currencies` | 5.2 | live |
| `/core/settings/taxes` | 5.3 | live |
| `/core/settings/numbering` | 5.4–5.6 | live |
| `/core/settings/email` | 5.7–5.9 | live — DNS panel shows the host only, see below |
| `/core/notifications` | 5.10–5.13 | live — inbox, preferences, devices |
| `/core/notifications/[id]` | 5.19 | live — resolved from the list, no by-id route exists |
| `/core/settings` hub | 5.14 | live |

### Three things the contract does not give the UI

Recorded so the next reader does not go looking for them:

- **`mark-all-read` / `read-all` answer `200 { updated: n }`, not 204.** The
  "all read/ack/dismiss routes return 204" line above covers the per-id
  commands; the two bulk aliases return a body.
- **The DKIM record's expected value is never projected**, and no SPF record is
  checked at all — `DnsTenantEmailVerificationAdapter` compares against a
  deployment env registry. The screen shows the derived host
  `${dkimSelector}._domainkey.${senderDomain}` and says the value is not
  available. See [Q22](../build/OPEN-QUESTIONS.md#q22--the-email-dns-records-a-tenant-must-publish-are-not-returned-by-the-api).
- **Device tokens cannot be listed**, only registered and revoked. See
  [Q23](../build/OPEN-QUESTIONS.md#q23--device-tokens-can-be-registered-and-revoked-but-never-listed).
