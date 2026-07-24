# Roles & Permissions API

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

## Admin Roles — `/admin/roles`

Base Path: `admin/roles`
Guard: `AdminGuard`

---

### POST `/admin/roles` — Create Admin Role

**Permission**: `admin.roles.create`
**HTTP Status**: 201

#### Request Body — `CreateAdminRoleDto`
```typescript
{
  name: string;           // Role name (unique)
  description?: string;   // Optional description
  type: AdminTierEnum;    // 'SUPER_ADMIN' | 'ADMIN' | 'USER'
  permissionIds?: string[]; // Initial permission set (UUIDs)
}
```

---

### GET `/admin/roles` — List Admin Roles

**Permission**: `admin.roles.read`
**HTTP Status**: 200

#### Query Parameters — `AdminRoleQueryDto`
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;       // default: 'createdAt'
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  type?: AdminTierEnum;  // 'SUPER_ADMIN' | 'ADMIN' | 'USER'
  isSystem?: 'true' | 'false'; // Filter seeded vs custom roles
}
```

---

### GET `/admin/roles/:id` — Get Admin Role

**Permission**: `admin.roles.read`
**HTTP Status**: 200

---

### PATCH `/admin/roles/:id` — Update Admin Role

**Permission**: `admin.roles.update`
**HTTP Status**: 200

#### Request Body — `UpdateAdminRoleDto`
```typescript
{
  name?: string;
  description?: string;
}
```

#### Frontend Notes
- System roles cannot be edited
- Permission membership is changed via dedicated endpoint

---

### PUT `/admin/roles/:id/permissions` — Replace Role Permissions

**Permission**: `admin.roles.update`
**HTTP Status**: 200

#### Request Body — `SetRolePermissionsDto`
```typescript
{
  permissionIds: string[]; // Full replacement set of permission UUIDs
}
```

#### Frontend Notes
- Full replacement save from permissions matrix
- Empty array clears all permissions
- Invalidates sessions for affected role holders

---

### DELETE `/admin/roles/:id` — Delete Admin Role

**Permission**: `admin.roles.delete`
**HTTP Status**: 204

#### Frontend Notes
- Cannot delete system roles
- Cannot delete roles still assigned to users
- Use destructive confirmation UI

---

## Admin Permissions — `/admin/permissions`

### GET `/admin/permissions` — List Permission Catalogue

**Permission**: `admin.permissions.read`
**HTTP Status**: 200

#### Response
```typescript
Array<{
  id: string;
  key: string;        // e.g. 'admin.tenants.create'
  group: string;      // e.g. 'tenants'
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}>
```

#### Frontend Notes
- Read-only seeded catalogue (no write API)
- Use to render role-management permission matrices
- Cache briefly, refresh after deployments
