# Tenant users API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/users`
> **Controller-relative prefix:** `/tenant/users`
> **Tenant Portal status:** Planned. The legacy settings area has a live partial users client; it is not a complete specification.
> **Documentation:** Hand-written and source-verified; not generated.

Directory parties are a separate Core resource documented in [directory.md](directory.md). Role assignments are documented in [roles.md](roles.md), and licensed module seats in [user-modules.md](user-modules.md).

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/tenant-users`
- User/team enums: `../backend/mutakamel-apps/core-app/packages/common/src/enums`
- Database entities: `../backend/mutakamel-apps/core-app/packages/database/src/entities/tenant`
- Historical consolidated UI reference (absent from the current checkout): `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings`

## Security and transport

Every route requires a tenant JWT, verified host matching the token, current session/subscription, and effective branch/company authorization. Management routes additionally require the listed permission. The `/me` routes are self-only and deliberately have no management permission.

Core rejects unknown DTO fields. All IDs are UUIDv7. Paginated routes use `page` default 1, `limit` default 20/max 100, `search` max 200, and return `data` plus `meta`. Standard JSON envelopes apply; `204` has no body.

Mutations do not expose application-level idempotency. Refetch before retrying
an ambiguous create/update. Role and access-scope changes advance the affected
user's `authorizationVersion`: stale access JWTs must be reissued and
`/auth/me` reloaded, but the reusable Auth Sessions remain active. A separate
security action such as suspension, password change, compromise response, or
logout-all can end the applicable sessions.

User/profile/Webphone responses are private and must not be shared-cached; Webphone self runtime explicitly requires no-store handling. These routes are synchronous from the portal contract. Invitation email delivery does not expose a client-polled async job.

## Self-service routes

| Method and canonical browser path | Access | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/users/me/profile` | Authenticated self | Profile preferences |
| `PUT /api/tenant/core/v1/users/me/profile` | Authenticated self | Merge accepted preference fields |
| `GET /api/tenant/core/v1/users/me/webphone` | Authenticated self | Runtime SIP configuration; `private, no-store` |
| `GET /api/tenant/core/v1/users/me/webphone/call-logs` | Authenticated self | Recent self call logs |
| `POST /api/tenant/core/v1/users/me/webphone/call-logs` | Authenticated self | Store one self call log |

Profile accepts `themeKey` (maximum 64), `language` (`en|ar`, maximum 8), and `extensions` (object). Serialized extensions are capped at 32 KiB; excess returns `PROFILE_EXTENSIONS_TOO_LARGE`.

Call-log create fields:

- `type`: `IN_ANS|IN_NOANS|OUT`.
- `phoneNumber`: required/non-empty, maximum 80.
- `displayName`: optional/nullable, maximum 120.
- `startedAt`, `answeredAt`, `endedAt`: optional/nullable ISO date strings.
- `durationSeconds`: optional/nullable integer 0–86,400.
- `cause`: optional/nullable, maximum 120.

The self webphone response may contain `sipPassword` because it is runtime secret material. It must never enter logs, analytics, error telemetry, persisted client state, or another user's projection.

## User-management routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `POST /api/tenant/core/v1/users` | `users.user.invite` | Create invited user; counts against user limits |
| `GET /api/tenant/core/v1/users` | `users.user.read` | Paginated, scope-filtered |
| `GET /api/tenant/core/v1/users/:id` | `users.user.read` | Scope-filtered detail |
| `PATCH /api/tenant/core/v1/users/:id` | `users.user.update` | Identity/placement update |
| `PATCH /api/tenant/core/v1/users/:id/webphone` | `users.user.update` | Webphone administration |
| `POST /api/tenant/core/v1/users/:id/suspend` | `users.user.deactivate` | Invalidate sessions and suspend |
| `POST /api/tenant/core/v1/users/:id/activate` | `users.user.deactivate` | Activate valid suspended/invited state; seat checks apply |
| `DELETE /api/tenant/core/v1/users/:id` | `users.user.delete` | `204`, protected soft delete |

User status wire values are `INVITED`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`. List filters: `status`, `companyId`, `branchId`, `departmentId`, and `teamId`, plus common pagination/search.

Create accepts:

- Required: `email` (trimmed/lowercased email, max 255), `firstName` and `lastName` (trimmed, non-empty, max 80), `companyId`, `branchId`, `departmentId`.
- Optional: `employeeCode` (32), `teamId`, `managerId`, `partyId`, `jobTitle` (120).
- Optional `roleAssignments`: unique `{branchId,roleId}` UUIDv7 pairs.
- Optional `teamMemberships`: unique by `teamId`; each `{teamId, role?, isPrimary?}`.

Update accepts first/last name, employee code, placement IDs, manager, job title, and team memberships. It does not accept email, `partyId`, or role assignments.

Validation is DTO-driven (field lengths, strict enums/booleans, UUIDv7) and then domain-driven for placement, scope, uniqueness, manager cycles, status, owner protection, and subscribed user limits.

Safe invitation example:

```http
POST /api/tenant/core/v1/users
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{
  "email":"person@example.test",
  "firstName":"Example",
  "lastName":"User",
  "companyId":"019f9872-0a1a-7cc0-914d-a57aa437fc41",
  "branchId":"019f9872-1a1a-7cc0-914d-a57aa437fc42",
  "departmentId":"019f9872-2a1a-7cc0-914d-a57aa437fc43"
}
```

### Webphone administration

Accepted fields are `enabled` boolean; nullable `extension` (32), `sipUsername` (120), `sipPassword` (255), `displayName` (120), `outboundCallerId` (64); and `transport=ws|wss`. Enabling requires a complete valid configuration. Extension and SIP username are unique. Other-user responses never return the SIP password.

## Team memberships

| Method and canonical path | Permission |
|---|---|
| `GET /api/tenant/core/v1/users/:id/team-memberships` | `users.user.read` |
| `PUT /api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` |
| `POST /api/tenant/core/v1/users/:id/team-memberships` | `users.user.manage_memberships` |
| `DELETE /api/tenant/core/v1/users/:id/team-memberships/:membershipId` | `users.user.manage_memberships` |

Membership role is `MEMBER|LEAD|MANAGER`; `isPrimary` is a strict optional boolean. PUT body is `{memberships:[...]}` with a non-empty unique-by-team array, so it cannot be used to clear all memberships. POST accepts one membership object. A primary membership is protected from direct deletion.

## Domain rules and expected errors

Placement must be internally consistent (company → branch → department → team), active, and within actor scope. Manager cycles are rejected. Self-delete/deactivation, tenant-owner mutation, and unsafe status transitions are protected. Invitation/activation/user creation is subject to subscribed user limits.

Expected errors include:

- Identity/placement: `TENANT_USER_NOT_FOUND`, `TENANT_EMAIL_TAKEN`, `EMPLOYEE_CODE_TAKEN`, `PLACEMENT_INCONSISTENT`, `MANAGER_NOT_FOUND`, `MANAGER_CYCLE`, `BRANCH_ACCESS_DENIED`, `PERMISSION_SCOPE_UNAVAILABLE`.
- Protection/status: `USER_SELF_FORBIDDEN`, `TENANT_OWNER_PROTECTED`, `INVALID_STATUS_TRANSITION`, `USER_LIMIT_REACHED`.
- Teams: `TEAM_MEMBERSHIP_NOT_FOUND`, `TEAM_MEMBERSHIP_PRIMARY_CONFLICT`, `PRIMARY_TEAM_MEMBERSHIP_PROTECTED`.
- Webphone/profile: `WEBPHONE_CONFIG_INCOMPLETE`, `WEBPHONE_EXTENSION_TAKEN`, `WEBPHONE_SIP_USERNAME_TAKEN`, `PROFILE_EXTENSIONS_TOO_LARGE`.

## AI implementation rules

- Never expose `sipPassword` outside the in-memory self runtime.
- Build placement choices top-down and submit the full consistent tuple.
- Refetch current user/session after self-profile changes. After an
  access-affecting mutation, refresh/reissue the access JWT and reload
  `/auth/me`; do not force login merely because `authorizationVersion`
  advanced.
- Treat owner-protection failures as product constraints, not errors to bypass.
