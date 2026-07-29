# Admin Users API — `/admin/users`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/users`
Guard: `AdminGuard` (all endpoints)

Last source verification: **2026-07-25**

---

## POST `/admin/users` — Invite Admin User

**Permission**: `admin.users.invite`
**HTTP Status**: 201

### Request Body — `CreateAdminUserDto`
```typescript
{
  email: string;        // @IsEmail, @MaxLength(255), auto-trimmed & lowercased
  firstName: string;    // @IsString, @MinLength(1), @MaxLength(80), auto-trimmed
  lastName: string;     // @IsString, @MinLength(1), @MaxLength(80), auto-trimmed
  tier?: AdminTierEnum; // @IsOptional, 'SUPER_ADMIN' | 'ADMIN' | 'USER'
  roleIds?: string[];   // @IsOptional, @IsArray, @ArrayUnique, @IsUUID('7')
}
```

### Frontend Notes
- User starts as `INVITED` status
- Invite acceptance happens through `/admin/auth/accept-invite`

---

## GET `/admin/users` — List Admin Users

**Permission**: `admin.users.read`
**HTTP Status**: 200

### Query Parameters — `AdminUserQueryDto` (extends `PaginationQueryDto`)
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;    // default: 'createdAt'
  sortDir?: 'ASC' | 'DESC';
  search?: string;    // matches email, firstName, lastName
  status?: UserStatusEnum;  // 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  tier?: AdminTierEnum;     // 'SUPER_ADMIN' | 'ADMIN' | 'USER'
}
```

### Response — Paginated
```typescript
{
  data: AdminUser[];
  meta: { page, limit, totalItems, totalPages }
}
```

---

## GET `/admin/users/me/profile` — Get My Profile

**Permission**: Any authenticated admin
**HTTP Status**: 200

### Response
```typescript
{
  themeKey: string;
  language: string;
  extensions: Record<string, unknown>;
}
```

---

## PUT `/admin/users/me/profile` — Update My Profile

**Permission**: Any authenticated admin
**HTTP Status**: 200

### Request Body — `UpdateAdminProfileDto`
```typescript
{
  themeKey?: string;   // @IsOptional, @MaxLength(64)
  language?: string;   // @IsOptional, must be from SUPPORTED_LANGUAGES
  extensions?: Record<string, unknown>; // @IsOptional, shallow-merged
}
```

---

## GET `/admin/users/me/webphone` — Get My WebPhone Config

**Permission**: Any authenticated admin
**HTTP Status**: 200

```typescript
{
  enabled: boolean;
  extension: string | null;
  sipUsername: string | null;
  sipPassword: string | null; // returned only by this self-service route
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  outboundCallerId: string | null;
  transport: 'ws' | 'wss';
  passwordConfigured: boolean;
}
```

The floating phone keeps `sipPassword` in component memory only. It must not be
persisted in browser storage, logs, diagnostics, or analytics.

---

## GET `/admin/users/me/webphone/call-logs` — List My Call Logs

**Permission**: Any authenticated admin
**HTTP Status**: 200 (Latest 50 records)

---

## POST `/admin/users/me/webphone/call-logs` — Create Call Log

**Permission**: Any authenticated admin
**HTTP Status**: 201

### Request Body — `CreateAdminWebphoneCallLogDto`
```typescript
{
  type: WebphoneCallLogType;    // @IsIn(WebphoneCallLogType values)
  displayName?: string | null;  // @MaxLength(120)
  phoneNumber: string;          // @IsNotEmpty, @MaxLength(80)
  startedAt?: string | null;    // @IsDateString
  answeredAt?: string | null;   // @IsDateString
  endedAt?: string | null;      // @IsDateString
  durationSeconds?: number | null; // @IsInt, @Min(0), @Max(86400)
  cause?: string | null;        // @MaxLength(120)
}
```

---

## GET `/admin/users/:id` — Get Admin User

**Permission**: `admin.users.read`
**HTTP Status**: 200

---

## PATCH `/admin/users/:id` — Update Admin User

**Permission**: `admin.users.update`
**HTTP Status**: 200

### Request Body — `UpdateAdminUserDto`
```typescript
{
  firstName?: string;    // @IsOptional, @MinLength(1), @MaxLength(80)
  lastName?: string;     // @IsOptional, @MinLength(1), @MaxLength(80)
  tier?: AdminTierEnum;  // @IsOptional
}
```

### Frontend Notes
- Email is immutable (not in DTO)
- Role changes use the dedicated roles assignment endpoint

---

## GET `/admin/users/:id/webphone` — Get Admin WebPhone Config

**Permission**: `admin.users.read`
**HTTP Status**: 200

This administrative projection omits the SIP password and exposes only
`passwordConfigured`. The edit form must always initialize its password field
to an empty string.

---

## PATCH `/admin/users/:id/webphone` — Update Admin WebPhone Config

**Permission**: `admin.users.update`
**HTTP Status**: 200

### Request Body — `UpdateAdminUserWebphoneDto`
```typescript
{
  enabled?: boolean;
  extension?: string | null;       // @MaxLength(32)
  sipUsername?: string | null;     // @MaxLength(120)
  sipPassword?: string | null;    // @MaxLength(255)
  displayName?: string | null;    // @MaxLength(120)
  outboundCallerId?: string | null; // @MaxLength(64)
  transport?: 'ws' | 'wss';
}
```

---

## POST `/admin/users/:id/suspend` — Suspend Admin User

**Permission**: `admin.users.suspend`
**HTTP Status**: 201

### Frontend Notes
- Cannot self-suspend
- Cannot suspend last active SUPER_ADMIN

---

## POST `/admin/users/:id/activate` — Activate Admin User

**Permission**: `admin.users.suspend`
**HTTP Status**: 201

### Frontend Notes
- Pending invites must be accepted first

---

## DELETE `/admin/users/:id` — Delete Admin User

**Permission**: `admin.users.delete`
**HTTP Status**: 204 (No Content)

### Frontend Notes
- Soft-delete with self-deletion protection
- Cannot delete last active SUPER_ADMIN
- Remove row locally after success

---

## PUT `/admin/users/:id/roles` — Replace Admin User Roles

**Permission**: `admin.users.assign_roles`
**HTTP Status**: 204 (No Content)

### Request Body — `SetUserRolesDto`
```typescript
{
  roleIds: string[]; // @IsArray, @ArrayUnique, @IsUUID('7')
}
```

### Frontend Notes
- Full replacement (submit complete desired role set)
- Empty array removes all roles
- Invalidates target user sessions

---

## Current Admin Portal integration

- `/users/[id]` loads the admin record, role catalogue, assigned roles, and
  WebPhone configuration from the canonical Gateway APIs.
- Identity changes use `PATCH /api/admin/core/v1/users/:id`.
- Role replacement uses `PUT /api/admin/core/v1/users/:id/roles`.
- Suspend/activate actions use their dedicated `POST` routes.
- WebPhone changes use
  `PATCH /api/admin/core/v1/users/:id/webphone`; the shared client supplies the
  Gateway-required UUIDv7 idempotency header.
- Enabling WebPhone is validated client-side for extension, SIP username, and
  an existing or newly entered SIP password.
- The password field remains blank after every load/save. Leaving it blank
  preserves an already configured password.
- Backend security boundary still requiring remediation: the current
  control-plane `AdminUserEntity` stores `webphone_sip_password` as a hidden
  plaintext column (`select: false` is not encryption). The frontend does not
  cache the secret, but that does not provide encryption at rest.
