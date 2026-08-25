# Invoice Administration API

Status: **[Verified]**

Last source verification: **2026-08-12**

Owner: **Core**

## Routes

| Method and canonical browser path | Permissions | Success |
| --- | --- | ---: |
| `POST /api/admin/core/v1/invoices/generate` | `admin.invoices.create` | `201` |
| `GET /api/admin/core/v1/invoices` | `admin.invoices.read` | `200` |
| `GET /api/admin/core/v1/invoices/:id` | `admin.invoices.read` | `200` |
| `PATCH /api/admin/core/v1/invoices/:id` | `admin.invoices.update` | `200` |
| `POST /api/admin/core/v1/invoices/:id/issue` | `admin.invoices.update` + `admin.invoices.critical` | `201` |
| `POST /api/admin/core/v1/invoices/:invoiceId/offline-payments` | `admin.wallet.manage` + `admin.billing.critical` | `201` |
| `POST /api/admin/core/v1/invoices/:id/void` | `admin.invoices.void` + `admin.invoices.critical` | `201` |

Permission pairs use ALL semantics.

## DTOs

```ts
interface GenerateInvoiceDto {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  currencyCode?: string;
  purpose?: "TRIAL_ACTIVATION" | "RENEWAL" | "PRORATION" | "MANUAL";
}

interface InvoiceLineInputDto {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface UpdateInvoiceDto {
  lines?: InvoiceLineInputDto[];
  dueAt?: string;
}

interface IssueInvoiceDto {
  dueAt: string;
}
```

Read the current offline-payment DTO before implementing its form.

## Wire values

```ts
type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";
```

Keep quantity, price, subtotal, tax, discount, paid, due, and total fields as
decimal strings. Do not use browser floating-point arithmetic for invoice
truth.

## Lifecycle rules

- Only eligible draft invoices can be edited/issued.
- Issue, offline payment, and void are authoritative commands.
- Critical commands require explicit confirmation and stable UUIDv7 intent
  keys.
- Refresh the invoice and billing summary after a command.
- Render conflicts for invalid lifecycle transitions.
- List rows are under `data`; pagination uses `meta.total`.

## Current frontend status

`/invoices`, `/invoices/new`, and `/invoices/[id]` source-integrate the full
seven-route family: directory, detail, metadata update, generation, issue,
void, and tenant offline payment. The screens apply exact permission/critical
gates, DTO-aligned validation, caller-owned intents, bilingual resource states,
and focused tests. Authenticated runtime and deployment verification remain
separate gates.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/invoices/invoices.controller.ts`
- `../backend/mutakamel-apps/core-app/src/admin/invoices/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
