# Logging API — `/admin/logging/level-overrides`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/logging/level-overrides`
Guard: `AdminGuard`

---

## GET `/admin/logging/level-overrides` — List Overrides

**Permission**: `admin.logging.read`
**HTTP Status**: 200

### Query Parameters — `LoggingLevelOverrideQueryDto`
```typescript
{
  scope?: LoggingOverrideScopeEnum;  // 'GLOBAL' | 'APP' | 'TENANT' | 'TENANT_APP'
  appName?: LoggingAppEnum;          // Service name enum
  tenantId?: string;                 // UUID filter
}
```

### Response
```typescript
Array<{
  id: string;
  scope: LoggingOverrideScopeEnum;
  appName: string | null;
  tenantId: string | null;
  level: string;       // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  reason: string;
  expiresAt: string;
  updatedAt: string;
}>
```

### Frontend Notes
- Scope precedence: `TENANT_APP > TENANT > APP > GLOBAL`
- Hide expired entries by default

---

## GET `/admin/logging/level-overrides/history` — Change History

**Permission**: `admin.logging.read`
**HTTP Status**: 200

### Query Parameters — `LoggingLevelOverrideHistoryQueryDto`
```typescript
{
  overrideId?: string;   // UUID
  action?: string;       // 'CREATE' | 'UPDATE' | 'DELETE'
  scope?: LoggingOverrideScopeEnum;
  appName?: LoggingAppEnum;
  tenantId?: string;
  limit?: number;        // 1-200, default 50
}
```

---

## GET `/admin/logging/level-overrides/effective` — Resolve Effective Level

**Permission**: `admin.logging.read`
**HTTP Status**: 200

### Query Parameters — `EffectiveLoggingLevelQueryDto`
```typescript
{
  appName: LoggingAppEnum;
  tenantId?: string;
}
```

### Response
```typescript
{
  level: string;   // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string;  // Override scope that determined the level
}
```

---

## SSE `/admin/logging/level-overrides/live` — Stream Live Logs

**Permission**: `admin.logging.read`
**Protocol**: Server-Sent Events (`Accept: text/event-stream`)

### Query Parameters — `LiveLoggingQueryDto`
```typescript
{
  appName?: LoggingAppEnum;
  tenantId?: string;
  minLevel?: LogLevelEnum;
}
```

---

## PUT `/admin/logging/level-overrides` — Upsert Override

**Permission**: `admin.logging.update`
**HTTP Status**: 200

### Request Body — `UpsertLoggingLevelOverrideDto`
```typescript
{
  scope: LoggingOverrideScopeEnum;
  appName?: LoggingAppEnum;
  tenantId?: string;
  level: string;       // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  reason: string;
  expiresAt: string;   // Max 24 hours in the future
}
```

---

## DELETE `/admin/logging/level-overrides/:id` — Delete Override

**Permission**: `admin.logging.update`
**HTTP Status**: 204
