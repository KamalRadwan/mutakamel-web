# System Settings API — `/admin/system-settings`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/system-settings`
Guard: `AdminGuard`

---

## GET `/admin/system-settings/email` — Get Platform SMTP Config
**Permission**: `admin.settings.read`

## GET `/admin/system-settings/email/audit` — Get SMTP Audit Log
**Permission**: `admin.settings.read`

## PATCH `/admin/system-settings/email` — Update SMTP Config
**Permission**: `admin.settings.update`
**Idempotency**: Required

## POST `/admin/system-settings/email/verify-connection` — Verify SMTP Connection
**Permission**: `admin.settings.update`
**Note**: No request body allowed

---

## GET `/admin/system-settings` — List System Settings

**Permission**: `admin.settings.read`
**HTTP Status**: 200

### Query Parameters — `SystemSettingQueryDto`
```typescript
{
  prefix?: string;  // Dotted-namespace filter e.g. 'billing.'
}
```

### Response
```typescript
Array<{
  key: string;         // e.g. 'billing.default_currency'
  value: any;
  description: string;
  descriptionI18n: { en: string; ar: string };
  isDefault: boolean;  // true = inherited default, false = admin override
  readOnly: boolean;   // true = env-managed, cannot be edited via API
}>
```

---

## GET `/admin/system-settings/:key` — Get System Setting

**Permission**: `admin.settings.read`
**HTTP Status**: 200

### Params
- `key`: Registered system-setting key (dotted notation, e.g. `billing.default_currency`)

---

## PUT `/admin/system-settings/:key` — Upsert System Setting

**Permission**: `admin.settings.update`
**HTTP Status**: 200

### Request Body — `UpsertSystemSettingDto`
Setting override value and optional operator-facing description.

### Frontend Notes
- Render inputs from the setting registry contract
- Disable writes when `readOnly` is true
- Show 422 validation errors for type, bounds, enum, or pattern failures
