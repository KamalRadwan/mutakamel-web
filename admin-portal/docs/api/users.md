# Admin Users, Profile, and WebPhone API

Status: **Verified backend contract; frontend COMPLETE**

Last source verification: **2026-07-30**

Owner: **Core**

Canonical browser prefix: `/api/admin/core/v1/users`

## Route matrix

| Method and canonical browser path | Permission mode | Success | Frontend |
| --- | --- | ---: | --- |
| `POST /api/admin/core/v1/users` | `admin.users.invite` + `admin.users.critical` | `201` | `DONE` |
| `GET /api/admin/core/v1/users` | `admin.users.read` | `200` | `DONE` |
| `GET /api/admin/core/v1/users/:id` | `admin.users.read` | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/:id` | `admin.users.update` + `admin.users.critical` | `200` | `DONE` |
| `POST /api/admin/core/v1/users/:id/suspend` | `admin.users.suspend` + `admin.users.critical` | `201` | `DONE` |
| `POST /api/admin/core/v1/users/:id/activate` | `admin.users.suspend` + `admin.users.critical` | `201` | `DONE` |
| `DELETE /api/admin/core/v1/users/:id` | `admin.users.delete` + `admin.users.critical` | `204` | `DONE` |
| `PATCH /api/admin/core/v1/users/:id/roles` | `admin.users.assign_roles` + `admin.users.critical` | `204` | `DONE` |
| `GET /api/admin/core/v1/users/:id/webphone` | `admin.users.read` | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/:id/webphone` | `admin.users.update` + `admin.users.critical` | `200` | `DONE` |
| `GET /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |
| `PATCH /api/admin/core/v1/users/me/profile` | Authenticated | `200` | `DONE` |
| `GET /api/admin/core/v1/users/me/webphone` | Authenticated | `200` | `DONE` |
| `GET /api/admin/core/v1/users/me/webphone/call-logs` | Authenticated | `200` | `DONE` |
| `POST /api/admin/core/v1/users/me/webphone/call-logs` | Authenticated | `201` | `DONE` |

Every paired permission uses ALL semantics.

## Invite

```ts
interface CreateAdminUserDto {
  email: string;      // email, lowercase, max 255
  firstName: string;  // trimmed, 1..80
  lastName: string;   // trimmed, 1..80
  roleId: string;     // UUIDv7
  isSuperAdmin?: boolean;
}
```

The returned user remains `INVITED` until invite acceptance. Only a current
super admin may create another super admin. Duplicate email/role/invariant
errors must be displayed from the authoritative response.

## List

The list accepts pagination/search/status, `isSuperAdmin`, and `roleId` filters
from `AdminUserQueryDto`. Rows are in `data`; the total is `meta.total`, never
`totalItems`.

```ts
type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
```

## Update and lifecycle

- Email is immutable.
- Identity, role, or super-admin changes use `PATCH /users/:id`.
- Dedicated role replacement uses `PATCH /users/:id/roles` with the complete
  desired role set.
- Suspend/activate enforce self-protection and last-active-super-admin
  invariants.
- Delete is a soft delete and returns `204` with no body.
- Refresh the user projection after mutations because affected sessions can be
  invalidated.

## Self profile

```ts
interface UpdateAdminProfileDto {
  themeKey?: string;
  language?: string;
  extensions?: Record<string, unknown>;
}
```

The current Portal has no self-profile page. Theme/language UI elsewhere does
not prove this profile contract is integrated.

## WebPhone

The self-service WebPhone route may return the SIP password required for active
browser registration. It may exist only in current component memory.

The administrative projection omits the password and returns
`passwordConfigured`. Initialize edit password fields empty; blank means
preserve unless the DTO explicitly represents a clear action.

Never write SIP passwords to browser storage, logs, analytics, diagnostics, or
fixtures.

Call logs use:

```ts
interface CreateAdminWebphoneCallLogDto {
  type: string;
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
}
```

## Idempotency and state

Gateway write-sensitive routes require UUIDv7 intent keys where declared in the
[generated inventory](../generated/admin-core-api-routes.md). Disable duplicate
submissions and retain the original key for an exact retry.

A missing read permission renders forbidden, not an empty user list.

## Current frontend evidence

- `src/app/users/hooks/useUsers.ts`
- `src/app/users/[id]/hooks/useUserDetail.ts`
- `src/components/layout/webphone/`
- `src/components/layout/hooks/useWebRTCPhone.ts`

The user list, invite, detail, lifecycle, role assignment, administrative
WebPhone, self WebPhone, and call-log foundations use real APIs. Self profile
remains missing and error/state typing still requires refactoring.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/admin-users/admin-users.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/admin-users/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/admin-roles/admin-user-roles.controller.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
