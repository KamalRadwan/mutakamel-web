# Invoice Administration API

Status: PARTIAL SOURCE INTEGRATION. Last source verification: 2026-09-09.

## Canonical commercial detail

The existing detail GET and `admin.invoices.read` permission return the single closed `{invoice,lines}` contract. There is no HTTP contractVersion, commercial version header, evidence-status union or fallback request. The private/no-store response is bounded to4MiB, with22safe invoice fields and1–200lines. The request has no body, query or idempotency key.

Complete source lines are valid for every current purpose: TRIAL_ACTIVATION, RENEWAL, PRORATION and MANUAL. They retain Application/Addon identity, parent item, selected definition, purchased seats, accepted price revision and1–100 complete marginal brackets. Their quantity1 represents the exact graduated charge, not one user. All amounts remain decimal strings and are checked with exact arithmetic; current catalogue prices never fill missing historical evidence.

Only MANUAL invoices may instead have entirely custom ordinary quantity/price lines with null source, lineage, accepted seats and pricing fields. Generated MANUAL invoices can retain complete subscription pricing; edited custom manual lines use the null-attribution shape. Mixed or incomplete evidence fails closed. Original descriptions are retained. Omitted FX or translated-description data is unavailable; it is not inferred.

Explicit PRORATION generation preserves the saved recurring-source charge under that purpose. It does not invoke the commercial plan-change proration calculator. Actual plan-change financial previews belong to the separately gated preparation/preview/apply owner.

Admin [invoice-commercial.ts](../../src/features/admin/invoices/model/invoice-commercial.ts) validates purpose, closed fields, selectors, amounts, periods and parent/child seat bounds. The shared-client detail adapter preserves correlation. The bilingual detail card displays full retained brackets or manual line semantics. Actor changes fence snapshots and late commands; successful existing writes refetch canonical detail before showing current state.

Current source verification is coordinated through task13. Historical passing suites and unauthenticated requests do not verify this revision. No invoice, payment or database fixture was created and no authenticated runtime or financial acceptance is claimed.

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

List rows carry the safe tenant identity Core resolves for them. It is absent
on single-invoice reads and `null` when the billed tenant no longer exists, so
keep `tenantId` as the rendering fallback.

```ts
interface InvoiceTenantSummary {
  id: string;
  name: string;
  companyName: string;
  status:
    | "PROVISIONING"
    | "PROVISIONING_FAILED"
    | "ACTIVE"
    | "SUSPENDED"
    | "DELETED";
}
```

`status` and `purpose` are wire enums. Resolve both to written bilingual
labels before display; do not print the code.

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
