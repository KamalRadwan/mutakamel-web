# Subscriptions API — `/admin/subscriptions`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/subscriptions`
Guard: `AdminGuard`

---

## GET `/admin/subscriptions` — List Subscriptions

**Permission**: `admin.subscriptions.read`
**HTTP Status**: 200

### Query Parameters — `SubscriptionQueryDto`
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: SubscriptionStatusEnum;  // 'TRIAL' | 'PENDING_ACTIVATION' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'
  tenantId?: string;  // UUID - filter by tenant
}
```

### Response — Paginated
```typescript
{
  data: Array<{
    subscription: {
      id: string;
      tenantId: string;
      allowedUsers: number;
      status: SubscriptionStatusEnum;
      billingCycle: string;         // 'MONTHLY' etc.
      currencyCode: string;        // 'USD' etc.
      startedAt: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      pendingPeriodStart: string | null;
      pendingPeriodEnd: string | null;
      trialDays: number;
      trialStartedAt: string | null;
      trialEndsAt: string | null;
      activationScheduledAt: string | null;
      activatedAt: string | null;
      cancelAt: string | null;
      totalPrice: string;          // Decimal string
      createdAt: string;
      updatedAt: string;
    };
    effectiveAllowedUsers: number;
    enabledModules: string[];
    items: Array<{
      id: string;
      subscriptionId: string;
      moduleId: string;
      tierId: string;
      moduleKey: string;
      moduleName: string;
      tierKey: string;
      tierName: string;
      seats: number;
      lineTotal: string;
      currencyCode: string;
      features: string[];
    }>;
    tenant: {
      id: string;
      name: string;
      companyName: string;
      status: TenantStatusEnum;
    };
  }>;
  meta: { page, limit, totalItems, totalPages }
}
```

---

## POST `/admin/subscriptions/:tenantId/cancel` — Cancel Subscription

**Permission**: `admin.subscriptions.cancel`
**HTTP Status**: 200
**Idempotency**: Required

### Response
```typescript
{
  tenantId: string;
  subscriptionId: string;
  status: SubscriptionStatusEnum;
  cancelAt: string | null;
  scheduled: boolean;
  changed: boolean;
  appliedAt: string | null;
}
```

### Frontend Notes
- Use behind a confirmation action
- Display `cancelAt` date and refresh entitlement state
