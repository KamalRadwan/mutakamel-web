# DTO and Data-Model Contract

Status: **verified-current conventions; endpoint fields live in API pages**

Last source verification: **2026-07-25**

Owning apps: **Shared, Core, CRM, Trade**

Tenant Portal implementation: **not-started**

Authoring mode: **hand-written from current DTOs, pipes, envelopes, and tests**

## Purpose

Backend DTOs are the writable transport contract. Entities, database columns,
old frontend models, mocks, and form state are not writable contracts.

This page defines the shared model rules and points to the authoritative
domain DTO families. Exact fields for a route belong beside that route under
`docs/api/`; copying every backend class into one Markdown file would create a
second schema that drifts.

## Validation boundary

Core, CRM, and Trade use strict Nest validation:

```text
transform = true
whitelist = true
forbidNonWhitelisted = true
```

Their application setup also enables DTO transformation/coercion conventions
used by the imported validators. Unknown request properties fail validation;
they are not harmlessly ignored.

Frontend code must:

1. build an endpoint-specific input object;
2. omit UI-only and unmodified optional properties;
3. validate for immediate feedback;
4. send exact wire values;
5. preserve and display the backend's field-level validation response.

## Per-application success contracts

The three owning applications do not currently expose one identical success
shape. The shared client must select the parser from the canonical app
namespace.

### Core

Core wraps ordinary JSON `2xx` results:

```ts
interface CoreSuccess<T> {
  success: true;
  data: T | null;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}
```

`data` is always present and is `null` for intentional no-data operations.
`meta` is present when Core returns the shared paginated result.

### CRM

CRM has no global success-envelope interceptor. It returns controller/service
payloads directly:

```ts
type CrmSuccess<T> = T;

interface CrmPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

Some CRM features use opaque cursors or streams instead. The endpoint guide
owns the exact projection.

### Trade

Trade wraps ordinary handler results:

```ts
interface TradeSuccess<T> {
  success: true;
  data: T;
  correlationId: string | null;
  timestamp: string;
}
```

Trade pagination stays in the handler payload under `data`; the Trade
interceptor does not lift it into a top-level `meta`. It also passes through a
handler result that is already explicitly wrapped.

For every app, `204`, streams, files, and other route-specific responses bypass
ordinary JSON parsing. Do not guess pagination or body shape from the method.

## Error contracts

Core and CRM install the shared application error filter:

```ts
interface CoreOrCrmError {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, string[]>;
  correlationId: string;
  timestamp: string;
  errorCategory:
    | "VALIDATION"
    | "AUTH"
    | "AUTHORIZATION"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMIT"
    | "SERVER_ERROR";
  path: string;
}
```

Trade does not install that shared error filter. Current Trade domain and
validation exceptions use their Nest/exception response bodies and commonly
expose a stable `code` plus `message`; preserve the HTTP status and treat
unrecognized structure as a safe generic error.

The API Gateway produces Problem Details for failures originating at the edge
or in upstream transport. It otherwise proxies the owning app's status, headers,
and body. The shared client must normalize all three current error families
without discarding stable codes or correlation identifiers. See [Error
handling](validation/error-handling.md).

## Shared query model

The shared page query is:

| Field | Type | Default | Constraint |
| --- | --- | ---: | --- |
| `page` | integer | `1` | minimum `1`; one-based |
| `limit` | integer | `20` | `1..100` |
| `sort` | string | omitted | maximum 64 characters; `field:asc` or `field:desc`; field remains endpoint-allowlisted |
| `search` | string | omitted | maximum 200 characters; only active on endpoints that declare searchable fields |

Some features use a cursor or a custom list query. Never add page parameters
to a route unless its DTO accepts them.

## Shared value objects

### Money

```ts
interface MoneyDto {
  amount: string;
  currency: string;
  decimalPlaces?: number;
}
```

- `amount` is a decimal string preserving `numeric(18,4)` precision.
- `currency` is normalized to an uppercase supported currency code.
- `decimalPlaces`, when present, is an integer from `0` through `8`.
- Never transport authoritative monetary values as formatted strings or
  binary floating-point calculations.

### Phone

```ts
interface PhoneInput {
  countryCode: string; // 1..4 digits; an input "+" is stripped
  number: string;      // 4..15 digits
}

interface PhoneView extends PhoneInput {
  e164?: string;       // output-only
}
```

`e164` must not be submitted.

### Name

```ts
interface NameDto {
  fullName: string; // 2..150
  first?: string;   // 2..64
  middle?: string;  // 1..64
  last?: string;    // 2..64
}
```

`fullName` is the display/search source of truth; the decomposed fields are
optional.

### Address

```ts
interface AddressDto {
  country: string; // ISO 3166-1 alpha-2
  city: string;
  state?: string;
  district?: string;
  street1: string;
  street2?: string;
  buildingNo?: string;
  postalCode?: string;
  landmark?: string;
  formattedAddress?: string;
  coordinates?: {
    lat: number; // -90..90
    lng: number; // -180..180
  };
}
```

Do not assume every domain embeds this shared address. CRM party addresses and
Trade commercial records may use domain-specific DTOs.

## Optional, nullable, empty, and output-only

These values are distinct:

| Value | Meaning |
| --- | --- |
| property omitted | no input supplied; for PATCH usually leave unchanged |
| `null` | explicit absence, only where the DTO allows it |
| `""` | an empty string and usually invalid unless explicitly accepted |
| `[]` | explicit empty collection; can mean replace all when supported |
| `0` / `false` | valid values and must not be removed by truthy filtering |

Never pass output-only IDs, timestamps, derived totals, status projections,
permission decisions, audit fields, redacted-secret markers, or computed
display values back into a create/update DTO unless the exact DTO declares
them.

## Core DTO catalogue

| Area | Primary DTO source | Important request classes |
| --- | --- | --- |
| Authentication | `core-app/src/tenant/tenant-auth/dto/` | `LoginDto`, `AcceptInviteDto`, `ForgotPasswordDto`, `ResetPasswordDto`; refresh/logout have no body and read the reusable credential only from the HttpOnly session cookie |
| Organization | `core-app/src/tenant/organization/dto/` | create/update company, branch, department, and team DTOs; `OrganizationQueryDto` |
| Users | `core-app/src/tenant/tenant-users/dto/` | `CreateTenantUserDto`, `UpdateTenantUserDto`, `UpdateTenantProfileDto`, `TenantUserQueryDto`, team-membership DTOs |
| Roles | `core-app/src/tenant/tenant-roles/dto/` | create/update role, permission replacement, role assignment, and branch-role DTOs |
| Directory | `core-app/src/tenant/directory/dto/` | party, contact method, address, role, relationship, and directory-settings DTOs |
| Finance configuration | `core-app/src/tenant/{currencies,taxes,numbering-sequences}/dto/` | feature-specific create, update, query, and peek DTOs |
| Workspace/email | `core-app/src/tenant/{workspace-settings,email-config}/dto/` | workspace update and tenant email configuration DTOs |
| Activities | `core-app/src/tenant/activities/dto/activity.dto.ts` | create, update, list, transition, and target DTOs |
| Template platform | `core-app/src/tenant/template-platform/dto/template-platform.dto.ts` | definitions, drafts, validation, versions, assets, assignments, preview source/request, and cursor queries |
| Payments | `core-app/src/tenant/payments/dto/` | top-up, invoice payment, and reconciliation DTOs |

Template publishing is not represented by a generic
`CreateTemplateVersionDto`; the current request is `PublishTemplateDto`.

## CRM DTO catalogue

| Area | Primary DTO source | Important request classes |
| --- | --- | --- |
| Common lists | `crm-app/src/crm/common/dto/` | `CrmListQueryDto`, `BranchQueryDto` |
| Leads | `crm-app/src/crm/leads/dto/lead.dto.ts` | `CreateLeadDto`, `UpdateLeadDto`, `MoveLeadStageDto`, `ConvertLeadDto` and nested conversion DTOs |
| Customer profiles | `crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts` | create/update/profile contact requests |
| Opportunities | `crm-app/src/crm/opportunities/dto/` | create/update/move/transfer DTOs and board filter/query DTOs |
| Activities | `crm-app/src/crm/activities/dto/activity.dto.ts` | activity, task, calendar, and reminder requests |
| Pipelines and stages | `crm-app/src/crm/{pipelines,lead-stages}/dto/` | definitions, stage ordering, transitions, and assignments |
| Notes and attachments | `crm-app/src/crm/notes-attachments/dto/` | owner-scoped notes, attachment metadata, and list queries |
| Outbound email | `crm-app/src/crm/outbound-emails/dto/outbound-email.dto.ts` | send/retry and owner-context requests |
| Custom fields | `crm-app/src/crm/custom-fields/dto/custom-field.dto.ts` | definitions, requirements, options, and value updates |
| Dashboards | `crm-app/src/crm/dashboards/dto/` | builder, query, and drill-down DTOs |

CRM lead creation and conversion contain discriminated nested shapes.
Implement them from the current DTO and tests; do not flatten corporate and
individual inputs into one unvalidated form object.

## Trade DTO catalogue

| Area | Primary DTO source | Important request classes |
| --- | --- | --- |
| Catalogue | `trade-app/src/modules/catalog/dto/catalog.dto.ts` | UOMs, items, company/branch profiles, channels, listings, and search |
| Commercial accounts | `trade-app/src/modules/commercial-accounts/dto/commercial-account.dto.ts` | account create/update, role, credit, and transition inputs |
| Pricing | `trade-app/src/modules/pricing/dto/pricing.dto.ts` | price lists, rules, evaluations, locks, and context |
| Quotations/orders | `trade-app/src/modules/documents/dto/documents.dto.ts` | `CreateQuotationDto`, revisions/actions/conversion, `CreateSalesOrderDto`, updates and confirmation evidence |
| Purchasing | `trade-app/src/modules/purchasing/dto/purchasing.dto.ts` | purchase-order create/update/lifecycle and approval inputs |
| Purchase quotations | `trade-app/src/modules/purchase-quotations/dto/purchase-quotation.dto.ts` | RFQ create/update/issue inputs |
| Financial documents | `trade-app/src/modules/financial-documents/dto/financial-documents.dto.ts` | invoice and contract inputs |
| Inventory | `trade-app/src/modules/inventory/dto/inventory.dto.ts` | nodes, balances, reservations, receipts, deliveries, adjustments, and governance |
| Configuration scope | `trade-app/src/modules/configuration-scope/dto/configuration.dto.ts` | scoped definitions, assignments, effective dates, and resolution |
| Policy Studio | `trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts` | policies, versions, rules, tests, approvals, publication, and evaluation |
| Document platform | `trade-app/src/modules/document-platform/dto/document-profile.dto.ts` | governed profile versions, validation, publication, and resolution |
| Extensions/automation | `trade-app/src/modules/extensions-automation/dto/` | extensions, owner values, imports, webhooks, automations, and targets |
| Control Tower | `trade-app/src/modules/control-tower/dto/control-tower.dto.ts` | query, retry, resolve, and reconciliation actions |
| Dashboards | `trade-app/src/modules/dashboards/dto/dashboard.dto.ts` | dashboards, widgets, layouts, sharing, filters, execution, and drill-down |

Trade documents carry server-produced financial and orchestration evidence.
Do not recompute or synthesize that evidence in the browser.

## Frontend model layers

Keep three explicit shapes when they differ:

```text
Form model -> API input DTO -> API view model
```

- A form model can contain localized strings and temporary selections.
- The API input contains only accepted transport fields.
- The view model preserves server state, IDs, projections, and unknown enum
  values.

Use one conversion function per write operation. Avoid generic entity-to-DTO
spreads.

## Runtime response validation

Validate high-risk or drift-prone responses at the shared API boundary:

- session/identity and tenant-host admission;
- permissions, scopes, features, and access mode;
- money and document totals;
- async job status and result pointers;
- cursor/page metadata;
- external URLs and file metadata.

On validation failure, fail closed, attach the correlation ID, and log only
redacted structural information. Do not display partially trusted data.

## Source evidence

```text
../backend/mutakamel-apps/shared-libs/packages/common/src/dtos/
../backend/mutakamel-apps/shared-libs/packages/common/src/pipes/strict-validation-pipe.options.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/interceptors/response-envelope.interceptor.ts
../backend/mutakamel-apps/shared-libs/packages/common/src/filters/all-exceptions.filter.ts
../backend/mutakamel-apps/core-app/src/main.ts
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/core-app/src/tenant/**/dto/
../backend/mutakamel-apps/crm-app/src/main.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/crm-app/src/crm/**/dto/
../backend/mutakamel-apps/trade-app/src/main.ts
../backend/mutakamel-apps/trade-app/src/common/trade-response.interceptor.ts
../backend/mutakamel-apps/trade-app/src/modules/**/dto/
```

See [Request validation](validation/request-validation.md),
[Static data](static-data.md), and [API index](api/README.md).
