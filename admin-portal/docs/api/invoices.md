# Invoices API — `/admin/invoices`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/invoices`
Guard: `AdminGuard`

---

## POST `/admin/invoices/generate` — Generate Invoice

**Permission**: `admin.invoices.create`
**HTTP Status**: 201

### Request Body — `GenerateInvoiceDto`
Billing period and optional currency for invoice generation.

---

## GET `/admin/invoices` — List Invoices

**Permission**: `admin.invoices.read`
**HTTP Status**: 200

### Query Parameters — `InvoiceQueryDto`
```typescript
{
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  tenantId?: string;              // UUID filter
  status?: InvoiceStatusEnum;     // 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID'
}
```

---

## GET `/admin/invoices/:id` — Get Invoice

**Permission**: `admin.invoices.read`
**HTTP Status**: 200

---

## PATCH `/admin/invoices/:id` — Update Draft Invoice

**Permission**: `admin.invoices.update`
**HTTP Status**: 200

### Request Body — `UpdateInvoiceDto`
Replaces draft invoice lines and/or due date.

### Frontend Notes
- Only DRAFT invoices can be edited
- Disable editing after issue

---

## POST `/admin/invoices/:id/issue` — Issue Invoice

**Permission**: `admin.invoices.update`
**HTTP Status**: 201

### Request Body — `IssueInvoiceDto`
Invoice due date for the issued document.

### Frontend Notes
- Require a future due date
- Use confirmation action

---

## POST `/admin/invoices/:id/void` — Void Invoice

**Permission**: `admin.invoices.void`
**HTTP Status**: 201

### Frontend Notes
- Can void DRAFT, ISSUED, or OVERDUE invoices
- Cannot void PAID or already VOID invoices
- Use confirmation action
