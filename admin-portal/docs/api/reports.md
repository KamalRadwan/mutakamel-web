# Reports API — `/admin/reports`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/reports`
Guard: `AdminGuard`
Permission: `admin.reports.read` (controller-level)

---

## GET `/admin/reports/overview` — Admin Overview Report

**Permission**: `admin.reports.read`
**HTTP Status**: 200

### Query Parameters
```typescript
{
  from?: string; // Optional ISO datetime (inclusive start)
  to?: string;   // Optional ISO datetime (inclusive end, must be >= from)
}
```

### Response
```typescript
{
  asOf: string;
  tenantsByStatus: {
    ACTIVE: number;
    SUSPENDED: number;
    PROVISIONING: number;
  };
  subscriptions: {
    count: number;
    totalAllowedUsers: number;
  };
  outstandingInvoices: {
    count: number;
    total: string;  // Decimal string (e.g. '1299.0000')
  };
}
```

---

## GET `/admin/reports/tenants` — Tenant Report

**Permission**: `admin.reports.read`
**HTTP Status**: 200

### Query Parameters
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: string;      // TenantStatusEnum
  serverId?: string;    // Database server UUID filter
}
```

### Response — Paginated
```typescript
{
  data: Array<{
    id: string;
    name: string;
    status: TenantStatusEnum;
    allowedUsers: number;
    subscriptionStatus: SubscriptionStatusEnum;
    createdAt: string;
  }>;
  meta: { page, limit, totalItems, totalPages }
}
```

---

## GET `/admin/reports/servers` — Database Server Report

**Permission**: `admin.reports.read`
**HTTP Status**: 200

### Frontend Notes
- Use for capacity charts and server health panels
- Utilization = `currentTenants / maxTenants`

---

## GET `/admin/reports/billing` — Billing Report

**Permission**: `admin.reports.read`
**HTTP Status**: 200

### Query Parameters
```typescript
{
  from?: string;    // Optional issuedAt start
  to?: string;      // Optional issuedAt end
  groupBy?: 'day' | 'week' | 'month';
}
```

### Response
```typescript
{
  asOf: string;
  buckets: Array<{
    status: InvoiceStatusEnum;
    total: string;     // Decimal string
    count: number;
  }>;
}
```

---

## GET `/admin/reports/provisioning` — Provisioning Health Report

**Permission**: `admin.reports.read`
**HTTP Status**: 200

### Query Parameters
```typescript
{
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}
```

### Response
```typescript
{
  asOf: string;
  stuck: number;    // Count of tenants stuck in provisioning
  items: Array<{
    id: string;
    name: string;
    status: 'PROVISIONING';
    createdAt: string;
  }>;
}
```

### Frontend Notes
- Highlight rows that have been provisioning longer than expected SLA
