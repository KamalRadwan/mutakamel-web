# Admin WebPhone API

Status: **[Verified]**

Last source verification: **2026-09-03**

Owner: **Core**

Canonical browser prefix: `/api/admin/webphone/v1`

WebPhone is a library mounted into `core-app`, but it is its own Gateway
namespace — not a section of `core`. Its routes therefore live in
`webphone.route-contracts.ts` and do not appear in the
[generated Core inventory](../generated/admin-core-api-routes.md), whose stated
scope is Core Admin routes only.

Unlike the tenant surface, admin access is **never entitlement-gated**: support
staff must be able to diagnose a customer's telephony without a subscription
check standing in the way. Admin extensions carry no seat limit and no price.

The previous implementation stored per-user SIP state as `webphone_*` columns on
`admin_users` and `tenant_users`. Those columns, the
`public.admin_webphone_call_logs` table, and the 22 `asterisk.*` settings keys
are all removed. See [users.md](users.md), [tenant-users.md](tenant-users.md),
and [system-settings.md](system-settings.md).

## Self-service route matrix

Authorization is holding an extension, not a permission: these carry no
`admin.webphone.*` requirement and are guarded by `WebphoneExtensionOwnerGuard`.

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/me` | Extension owner | `200` | `DONE` |
| `GET /api/admin/webphone/v1/me/call-logs` | Extension owner | `200` | `DONE` |
| `POST /api/admin/webphone/v1/me/call-logs` | Extension owner | `201` | `DONE` |

Call the `/me` read on widget mount and re-fetch about 60 seconds before
`turnCredentials.expiresAt`.

`/me` returns `servers[]` — the caller's chain, ordered, each entry carrying its
own connection fields, its resolved `timeoutSeconds` / `maxRetries`, and its own
nested `iceServers[]`. It replaced the single `config` object, which could only
describe a scope that held one server. There is no `transport` field.

## Platform settings route matrix

`/config` now carries the scope settings only — the master switch, the TURN REST
toggle, and its TTL. Everything about reaching a SIP host moved to `/servers`.

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/config` | `admin.webphone.read` | `200` | `NOT CALLED` |
| `PATCH /api/admin/webphone/v1/config` | `admin.webphone.update` | `200` | `NOT CALLED` |

**No admin-portal screen calls `/config`.** `/settings/webphone` is the SIP
server chain and nothing else — the module switch and TURN REST minting were
removed from it, and no other screen picked them up. The routes are live and
correct on the server; they have no browser caller in this app today. `NOT
CALLED` is about wiring, not about health.

`PATCH /config { enabled: true }` is refused `422 WEBPHONE_CONFIG_NO_SERVER`
while the scope holds no enabled server. Whoever wires it next must present it as
an ordered setup — add a server, then switch the module on — not as a failed save
on a toggle the operator cannot satisfy from where they are standing.

## SIP server route matrix

A scope holds an **ordered list** of SIP servers, not one. Each is a complete
registration target: its own domain, WebSocket URL, realm, registrar, proxy,
contact URI, ICE policy, ICE servers, and failover budget.

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/servers` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/servers` | `admin.webphone.update` | `201` | `DONE` |
| `PUT /api/admin/webphone/v1/servers/order` | `admin.webphone.update` | `200` | `DONE` |
| `PATCH /api/admin/webphone/v1/servers/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/servers/:id` | `admin.webphone.update` | `204` | `DONE` |
| `GET /api/admin/webphone/v1/servers/:serverId/ice-servers` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/servers/:serverId/ice-servers` | `admin.webphone.update` | `201` | `DONE` |
| `PATCH /api/admin/webphone/v1/servers/:serverId/ice-servers/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/servers/:serverId/ice-servers/:id` | `admin.webphone.update` | `204` | `DONE` |

`config/endpoints/*` and `config/ice-servers/*` no longer exist on either
audience. Endpoints became servers outright, and ICE servers moved under the
server they belong to, because a relay is only reachable inside its own server's
network. The Gateway answers the old paths `404 GW.ROUTE.UNKNOWN`; there is no
shim.

Server priority is unique per scope; a duplicate returns `409`, not `500`.

### `iceEnabled` — the master switch above a server's ICE entries

Each server carries `iceEnabled` (boolean, defaults `true`). `PATCH
/servers/:id` accepts it **alone**: `{ "iceEnabled": false }` is the entire body
the settings screen's switch sends, and that switch persists on change rather
than waiting for a Save.

The two surfaces read it differently, deliberately:

- `GET /servers` returns `iceEnabled` **and** the server's ICE entries in full,
  whatever its value. This is the screen the switch is put back from, so hiding
  the entries would leave nothing to restore.
- `GET /me` omits the flag and returns `iceServers: []` for a server whose ICE
  is off, and mints it no TURN credential. The browser uses what it is handed.

Switching it off changes no ICE row, which is the whole point of it being a
column: the entries come back exactly as they were, including which ones were
already parked individually.

`relay` transport on an enabled server whose ICE is off is refused `422
WEBPHONE_RELAY_WITHOUT_TURN` — the same code as `relay` with no enabled TURN
entry, because both leave that server with an empty ICE set. The settings screen
pre-empts it against the transport-policy field before sending.

### Two controls that are not fields

**Protocol** is a display control over `websocketUrl`. Selecting `wss` rewrites
the URL's scheme — there is no `protocol` to submit, and a form that kept one
would let the two disagree about which the phone actually uses.

**Priority** is never editable in a row. `PATCH /servers/:id` does not accept it.
Reordering is `PUT /servers/order` carrying **every** server id in the scope
exactly once; a partial list is refused `422 WEBPHONE_SERVER_ORDER_INVALID`. A
drag-and-drop expressed as one PATCH per row breaks the unique index partway
through and leaves an order nobody asked for. The server renumbers contiguously
from 1 on every reorder, so the number shown is the number stored.

## Admin extension route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/extensions` | `admin.webphone.read` | `200` | `DONE` |
| `POST /api/admin/webphone/v1/extensions` | `admin.webphone.update` | `201` | `DONE` |
| `PATCH /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `200` | `DONE` |
| `DELETE /api/admin/webphone/v1/extensions/:id` | `admin.webphone.update` | `204` | `NOT CALLED` |
| `GET /api/admin/webphone/v1/extensions/:id/servers` | `admin.webphone.read` | `200` | `DONE` |
| `PUT /api/admin/webphone/v1/extensions/:id/servers` | `admin.webphone.update` | `200` | `DONE` |

**An extension is edited from its owner's page**, `/users/:id` — never from
`/settings/webphone`, which holds no extension list at all. That is why the reads
above are answered by a list-and-match on `ownerId` (the module has no by-owner
read) and why the `DELETE` has no caller: the user panel creates and updates an
extension but does not delete one, and no other screen offers to.

An extension is one identity but an **ordered chain** of servers it registers
against, replaced wholesale by the `PUT`. Each link may override the server's
`timeoutSeconds` and `maxRetries`; `null` inherits, which is the normal case. An
empty list is valid and means the user registers nowhere — `/me` then reports a
phone that does not render, rather than an error.

There is no `transport` on an extension any more. Protocol belongs to the server.

## Cross-tenant and fleet route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `GET /api/admin/webphone/v1/tenants/:tenantId/config` | `admin.webphone.read` | `200` | `NOT CALLED` |
| `PATCH /api/admin/webphone/v1/tenants/:tenantId/config` | `admin.webphone.update` + `admin.webphone.critical` | `200` | `NOT CALLED` |
| `GET /api/admin/webphone/v1/tenants/:tenantId/extensions` | `admin.webphone.read` | `200` | `NOT CALLED` |
| `GET /api/admin/webphone/v1/fleet/seats` | `admin.webphone.read` | `200` | `NOT CALLED` |

Paired permissions use ALL semantics. Writing another tenant's configuration is
the one command here that additionally requires `critical`; cross-tenant reads
are audited.

Nothing in this app calls any of them. Verified 2026-09-03 by grepping every
`/api/admin/webphone/v1` literal in `src/`: only `/servers`, `/servers/order`,
`/servers/:id/ice-servers`, `/extensions`, `/extensions/:id`,
`/extensions/:id/servers` and the `/me` reads appear. The fleet seat view lived
on `/settings/webphone` and went with the extensions section.

## Idempotency and state

Gateway write-sensitive routes require UUIDv7 intent keys. Disable duplicate
submissions and retain the original key for an exact retry. Call-log create is
the exception and takes no key: a duplicate suppressed by key would silently
lose a real second call.

Both `PUT`s here — the server order and an extension's chain — are
write-sensitive rather than cacheable replaces. Each rewrites live telephony
wholesale, so they carry intent keys like any other mutation.

Responses carry `Cache-Control: no-store` from a controller-level interceptor,
because the `/me` payload contains minted TURN credentials.

## Current frontend evidence

- `src/app/(shell)/settings/webphone/` — page, hooks, components. The SIP server
  chain only: a server list with drag-and-drop failover ordering, a per-server
  card, and an **Add server** button that creates a disabled placeholder row and
  lets the operator finish it in place. No create form, no module switch, no
  TURN REST block, no extensions.

  Each card shows the three reachability fields (name, SIP domain, WebSocket URL
  plus its protocol) and hides the rest behind an **Advanced** disclosure,
  grouped as SIP identity and routing / Registration / Media and ICE /
  Diagnostics / Failover defaults. ICE entries live in the Media group, with the
  server they belong to.

### Two save rules, both stated on screen

The screen writes on two different gestures, and each control says which one it
follows rather than leaving it to be inferred from a nearby button:

| Written immediately | Written by a Save button |
| --- | --- |
| Failover order (`PUT /servers/order`) | Every typed field on a server card |
| A server's `enabled` switch | Every typed field on an ICE entry |
| An ICE entry's `enabled` switch | |

The two `enabled` switches write optimistically and revert on refusal — which is
a real outcome, not a theoretical one: `WEBPHONE_LAST_SERVER` and
`WEBPHONE_RELAY_WITHOUT_TURN` both reject a disable. Each carries its own
mutation target (`server:enabled:<id>`, `ice:enabled:<id>`) so its result never
reports against the Save button next to it.
- `src/app/(shell)/users/` — where a user's extension and failover chain are
  edited, via `adminUsersApi.ts`
- `src/app/(shell)/settings/webphone/webphone-contract.ts` — the single parser
  and type for server, ICE, and extension responses, shared by both screens
- `src/components/layout/AdminWebPhone.tsx` — binds the shared widget to
  `/api/admin/webphone/v1`
- Shared client: `@mutakamel/webphone` (`packages/webphone`)

## Source map

- `../backend/mutakamel-apps/core-app/src/webphone/admin/admin-webphone.controller.ts`
- `../backend/mutakamel-apps/core-app/src/webphone/admin/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/webphone.route-contracts.ts`
- `../backend/mutakamel-apps/shared-libs/packages/webphone`

## AI implementation rules

- Never persist, log, or forward `turnCredentials`; they are short-lived secret
  material and the responses are `no-store` for that reason.
- If `/fleet/seats` is ever wired again, re-fetch it after a tenant extension
  mutation rather than adjusting a local count; the authoritative check runs
  inside the create transaction.
- Never send a `protocol` or `transport` field. Write the scheme into
  `websocketUrl` and read it back from there.
- Never PATCH `priority`. Re-fetch the server list after `PUT /servers/order`
  rather than renumbering locally; the server owns the numbering.
- `POST /servers` requires `name`, `sipDomain` and `websocketUrl`, and the last
  two are pattern-matched — a one-click "add" therefore has to send a
  placeholder, not a blank. It sends `example.invalid` (RFC 2606: can never
  resolve) and `enabled: false`, so a half-finished row appended to a live chain
  cannot take a call.
- An ICE entry's stored `credential` is never returned, so an edit form always
  shows that field blank. Validate the TURN username/credential pair against
  `credentialConfigured`, not against what is typed — otherwise the username of
  every configured TURN entry becomes uneditable, because the credential the
  rule demands was never shown to the operator to retype.
- Changing an entry's `kind` to `STUN` clears the draft's `username` and
  `credential` in the same update (`iceDraftWithKind`). The module rejects a
  STUN entry carrying either, and the form stops rendering both the moment STUN
  is selected: values left behind fail a validator whose message has no field to
  appear on, so Save returns before sending with nothing on screen saying why.
- Any validation code left on a field the current `kind` does not render is
  shown as a form-level alert on the entry (`unrenderedIceDraftErrors`). A read
  supplies this case on its own — `GET /servers` accepts a `username` on a STUN
  row — so a saved entry can arrive already invalid in a way no field can
  report.
