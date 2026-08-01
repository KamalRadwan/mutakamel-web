# Static Data and Wire Enums

Status: **verified-current**

Last source verification: **2026-07-25**

Owning apps: **Shared, Core, CRM, Trade**

Tenant Portal implementation: **not-started**

Authoring mode: **hand-written from current enum and constant sources**

## Contract

Values in this page are case-sensitive transport values. Store and send the
value, translate only its label, and render an unknown-value fallback when
reading data created by a newer backend. Do not derive values from labels,
colors, list order, or an entity column that is not exposed by a DTO.

This is the cross-feature catalogue needed by the replacement application. An
endpoint-specific DTO or API page remains authoritative when it defines a
narrower subset.

## Shared transport and identity

| Type | Exact values |
| --- | --- |
| `UserType` | `TENANT_USER`, `SUPER_ADMIN`, `PARTNER` |
| `TokenAudience` | `tenant`, `super-admin`, `partner` |
| `ErrorCategory` | `VALIDATION`, `AUTH`, `AUTHORIZATION`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `SERVER_ERROR` |
| `SortDirectionEnum` | `ASC`, `DESC` |
| `FilterConditionEnum` | `and`, `or` |
| `ImportModeEnum` | `CREATE_ONLY`, `UPSERT` |
| `ExportFormatEnum` | `CSV`, `XLSX` |

Shared page pagination defaults to page `1`, limit `20`, and a maximum limit of
`100`. A domain DTO may impose a different limit or use a cursor, so the
endpoint page must be checked before building pagination.

## Core tenant and subscription

| Type | Exact values |
| --- | --- |
| `UserStatusEnum` | `INVITED`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED` |
| `TenantStatusEnum` | `PROVISIONING`, `PROVISIONING_FAILED`, `ACTIVE`, `SUSPENDED`, `DELETED` |
| `SubscriptionStatusEnum` | `TRIAL`, `PENDING_ACTIVATION`, `ACTIVE`, `PAST_DUE`, `CANCELLED` |
| `BillingCycleEnum` | `MONTHLY`, `ANNUAL` |
| `AccessModeEnum` | `FULL`, `DUNNING`, `READ_ONLY`, `BLOCKED` |
| Tenant email configuration status | `ACTIVE`, `SUSPENDED` |

Important distinctions:

- `SUSPENDED` is a valid user and tenant state; it is not `DEACTIVATED`.
- `CANCELLED` uses a double `L`.
- subscription access mode and subscription status are separate projections;
  never infer one from the other in the browser.
- tenant provisioning states are control-plane states. The Portal must wait for
  server-reported readiness and must not infer readiness from DNS or one
  downstream module.

## Core organization and directory

| Type | Exact values |
| --- | --- |
| `OrgNodeStatusEnum` | `ACTIVE`, `INACTIVE` |
| `PartyTypeEnum` | `PERSON`, `ORGANIZATION` |
| `PartyStatusEnum` | `ACTIVE`, `INACTIVE`, `BLOCKED` |
| `PartyRoleTypeEnum` | `CUSTOMER`, `SUPPLIER`, `EMPLOYEE`, `LEAD`, `SHIPPING_RECIPIENT`, `CONTACT_PERSON`, `BILLING_CONTACT`, `LEGAL_ENTITY`, `GUARANTOR`, `PARTNER` |
| `PartyContactMethodTypeEnum` | `PHONE`, `MOBILE`, `EMAIL`, `WHATSAPP`, `WEBSITE`, `OTHER` |
| `PartyAddressTypeEnum` | `LEGAL`, `BILLING`, `SHIPPING`, `HOME`, `WORK`, `OTHER` |
| `TeamMembershipRoleEnum` | `MEMBER`, `LEAD`, `MANAGER` |
| Scope-role assignment target | `TENANT`, `COMPANY`, `BRANCH` |

Party business roles, party status, and CRM profile status are independent.
For example, a party can retain a historical `CUSTOMER` role while a CRM
customer profile is `INACTIVE`.

## Core activities

| Type | Exact values |
| --- | --- |
| Status | `PLANNED`, `DONE`, `CANCELLED` |
| Priority | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| Direction | `INBOUND`, `OUTBOUND`, `INTERNAL` |
| Target app | `CRM`, `CORE`, `TRADE` |
| Target role | `PRIMARY`, `CONTEXT` |
| Activity type | `TODO`, `CALL`, `MEETING`, `EMAIL`, `VISIT`, `FOLLOW_UP`, `OTHER` |
| CRM target type | `LEAD`, `CUSTOMER_PROFILE`, `OPPORTUNITY` |
| Core target type | `PARTY` |
| Trade target type | `QUOTATION`, `SALES_ORDER` |

Core activity priority uses `NORMAL`; CRM activity priority uses `MEDIUM`.
They must not share one frontend enum.

## Core template platform

| Type | Exact values |
| --- | --- |
| Document type | `QUOTATION`, `CRM_OUTBOUND_EMAIL` |
| Output | `PRINT`, `EMAIL` |
| Layout | `HYBRID_DOCUMENT`, `EMAIL_FLOW` |
| Direction | `AUTO`, `LTR`, `RTL` |
| Definition scope | `TENANT`, `COMPANY` |
| Assignment route scope | `TENANT`, `COMPANY`, `BRANCH` |
| Definition status | `ACTIVE`, `ARCHIVED` |
| Draft validation status | `NOT_VALIDATED`, `VALID`, `INVALID`, `STALE` |
| Version status | `PUBLISHED`, `RETIRED` |
| Engine | `HANDLEBARS_HTML`, `HANDLEBARS_MJML` |
| Asset type | `IMAGE`, `LOGO`, `BACKGROUND` |
| Asset delivery | `PRIVATE_ONLY`, `EMAIL_PUBLIC` |
| Email rendition | `NOT_REQUESTED`, `READY` |
| Asset status | `ACTIVE`, `RETIRED` |
| Validation run status | `PASSED`, `FAILED` |
| Assignment status | `ACTIVE`, `INACTIVE` |
| Preview source | `DRAFT_PREVIEW`, `PUBLISHED_VERSION` |
| Preview job status | `PENDING`, `RETRYING`, `COMPLETED`, `FAILED` |
| Supported template locale | `ar-EG`, `en-US` |

Production-ready data-source keys currently exposed by Core are:

```text
TRADE_QUOTATION_PRINT_V1
TRADE_QUOTATION_PRINT_V2
CRM_LEAD_OUTBOUND_EMAIL_V1
CRM_CUSTOMER_OUTBOUND_EMAIL_V1
CRM_OPPORTUNITY_OUTBOUND_EMAIL_V1
```

Do not assume a data-source adapter is production-ready merely because a
template definition accepts its name.

## Core business letters

| Type | Exact values |
| --- | --- |
| Letter status | `DRAFT`, `ISSUED` |
| PDF render job status | `PENDING`, `RETRYING`, `COMPLETED`, `FAILED` |

An issued letter is an immutable revision. PDF generation is asynchronous and
has a lifecycle separate from the letter.

## CRM

### Records and pipelines

| Type | Exact values |
| --- | --- |
| Profile type | `INDIVIDUAL`, `CORPORATE` |
| Customer status | `PROSPECT`, `ACTIVE_CUSTOMER`, `INACTIVE`, `BLACKLISTED` |
| Lead status | `OPEN`, `CONVERTED`, `DISQUALIFIED`, `ON_HOLD` |
| Lead flag | `NEW`, `CONTACTED`, `QUALIFYING`, `QUALIFIED`, `DISQUALIFIED`, `CONVERTED`, `NURTURING`, `ON_HOLD` |
| Stage category | `OPEN`, `POSITIVE`, `NEGATIVE`, `IN_PROGRESS` |
| Opportunity status | `IN_PROGRESS`, `ON_HOLD`, `WON`, `LOST` |
| Opportunity flag | `NEW`, `DISCOVERY`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `CONTRACTING`, `ON_HOLD`, `WON`, `LOST` |
| Pipeline access type | `ALL`, `RESTRICTED` |

### Custom fields

| Type | Exact values |
| --- | --- |
| Owner type | `PARTY`, `LEAD`, `LEAD_AND_PARTY`, `CUSTOMER_PROFILE`, `OPPORTUNITY` |
| Field type | `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE` |
| Requirement operation | `CREATE`, `UPDATE`, `CONVERT` |

### Work management

| Type | Exact values |
| --- | --- |
| Activity type | `CALL`, `MEETING`, `EMAIL`, `VISIT`, `NOTE`, `FOLLOW_UP`, `OTHER` |
| Activity direction | `INBOUND`, `OUTBOUND`, `INTERNAL` |
| Activity status | `OPEN`, `DONE` |
| Activity priority | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| Task status | `OPEN`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| Reminder target | `TASK`, `CALENDAR_EVENT` |
| Reminder channel | `IN_APP`, `EMAIL`, `SMS` |
| Reminder status | `PENDING`, `SENT`, `CANCELLED` |
| Record access scope suffix | `own`, `team`, `all` |

## Trade

### Scope, catalogue, and channels

| Type | Exact values |
| --- | --- |
| Scope | `TENANT`, `COMPANY`, `BRANCH` |
| Item kind | `PRODUCT`, `SERVICE` |
| Item status | `DRAFT`, `ACTIVE`, `INACTIVE`, `DISCONTINUED` |
| Tracking | `NONE`, `LOT`, `SERIAL` |
| Channel | `INTERNAL_SALES`, `POS`, `ECOMMERCE`, `B2B_PORTAL`, `MARKETPLACE`, `FIELD_SALES`, `API` |
| Commercial account role | `CUSTOMER`, `SUPPLIER` |

### Commercial document state

| Type | Exact values |
| --- | --- |
| Document family | `QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `SALES_RETURN`, `PURCHASE_RETURN`, `POS_SALE` |
| Lifecycle | `DRAFT`, `CONFIRMED`, `CANCELLED`, `CLOSED` |
| Approval | `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `EXPIRED` |
| Confirmation orchestration | `NOT_STARTED`, `PENDING`, `READY_TO_FINALIZE`, `COMPLETED`, `REJECTED`, `FAILED`, `CANCELLED` |
| Fulfilment | `NOT_APPLICABLE`, `UNPLANNED`, `PLANNED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `BLOCKED` |
| Billing | `NOT_APPLICABLE`, `NOT_BILLED`, `PARTIALLY_BILLED`, `BILLED`, `CREDIT_PENDING` |
| Settlement | `UNKNOWN`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED` |

Quotation actions such as send, accept, reject, and convert are commands and
permissions. They are not extra members of the shared lifecycle enum.

### Governance and operations

| Type | Exact values |
| --- | --- |
| Governed version | `DRAFT`, `TESTED`, `APPROVAL_PENDING`, `SCHEDULED`, `PUBLISHED`, `SUPERSEDED`, `RETIRED` |
| Merge strategy | `OVERRIDE`, `MIN`, `MAX`, `UNION`, `DENY_WINS`, `FIRST_MATCH` |
| Decision type | `CONFIGURATION`, `ELIGIBILITY`, `SALES_PRICE`, `PURCHASE_PRICE`, `CREDIT`, `APPROVAL`, `FISCAL_CONTEXT`, `PROMISE`, `SOURCING`, `REPLENISHMENT` |
| Policy output | `ALLOW_DENY`, `REQUIRE_APPROVAL`, `SELECT`, `SCORE`, `VALIDATE`, `PRICE_ADJUSTMENT` |
| Integration status | `NOT_REQUIRED`, `PENDING`, `IN_PROGRESS`, `SUCCEEDED`, `RETRYING`, `FAILED`, `RECONCILIATION_REQUIRED` |
| Severity | `INFO`, `WARNING`, `HIGH`, `CRITICAL` |
| Retry class | `NEVER`, `SAME_REQUEST`, `AFTER_REFRESH`, `AFTER_DEPENDENCY_RECOVERY`, `MANUAL_RECONCILIATION` |

### Dashboard builder

| Type | Exact values |
| --- | --- |
| Scope coverage | `SINGLE_COMPANY`, `MULTI_COMPANY_AUTHORIZED_UNION` |
| Scope mode | `CURRENT_CONTEXT`, `SAVED_TARGETS`, `SELECTED_SCOPES`, `ALL_ACCESSIBLE` |
| Access | `OWNER`, `EDIT`, `VIEW` |
| Share subject | `USER`, `TEAM` |
| Preference context | `COMPANY`, `CONSOLIDATED` |
| Responsive layout | `DESKTOP_12`, `TABLET_6`, `MOBILE_1` |
| Data shape | `SCALAR`, `TIME_SERIES`, `CATEGORY`, `XY`, `INTERVAL`, `GRAPH`, `ROWS` |
| Unit | `COUNT`, `MONEY`, `PERCENT`, `QUANTITY`, `DURATION`, `SCORE` |
| Date preset | `TODAY`, `CURRENT_WEEK`, `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_30_DAYS`, `CUSTOM` |
| Period comparison | `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR` |
| Widget comparison | `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`, `TARGET` |
| Grain | `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR` |
| Aggregation | `COUNT`, `SUM`, `AVERAGE`, `MIN`, `MAX`, `PERCENT` |
| Axis | `LEFT`, `RIGHT` |
| Run status | `COMPLETE`, `PARTIAL` |
| Widget execution | `READY`, `EMPTY`, `LIMITED`, `STALE`, `UNAVAILABLE`, `FAILED` |
| Unavailable reason | `WIDGET_DELETED`, `WIDGET_ACCESS_REVOKED`, `WIDGET_PERMISSION_REQUIRED`, `METRIC_RETIRED_OR_INCOMPATIBLE` |

Visualization values:

```text
METRIC_CARD
LINE
AREA
LINE_AREA
COLUMN
BAR
STACKED_BAR
PIE
DONUT
SCATTER
BUBBLE
GANTT
FLOWCHART
SEMI_CIRCLE_GAUGE
THREE_QUARTER_GAUGE
CIRCULAR_PROGRESS_GAUGE
DETAILED_SPEEDOMETER
TABLE
FUNNEL
HEATMAP
```

### Feature keys

```text
trade.catalog
trade.pricing
trade.sales
trade.purchasing
trade.inventory
trade.pos
trade.channels
trade.contracts_recurring
trade.policy_studio
trade.intercompany
trade.automation
trade.extension_marketplace
trade.analytics
trade.control_tower_advanced
trade.intelligence
```

The current MVP feature subset is:

```text
trade.catalog
trade.pricing
trade.sales
trade.purchasing
trade.inventory
trade.policy_studio
trade.automation
trade.analytics
```

Feature keys represent subscription/feature capability, not a substitute for
permissions or company/branch/channel scope.

### Transport and governance limits

| Limit | Value |
| --- | ---: |
| Document lines per request | 1000 |
| Bulk items per request | 500 |
| Custom fields per extension profile | 100 |
| Extension-value payload | 16384 bytes |
| Rules per policy | 2000 |
| Policy evaluation budget | 100 ms |
| Policy explanation payload | 32768 bytes |
| Policy cache payload | 262144 bytes |

Validate these for user feedback, then handle the backend validation response.
Do not silently truncate.

Trade dashboard limits:

| Limit | Value |
| --- | ---: |
| Dashboard name characters | 120 |
| Dashboard description characters | 500 |
| Grid columns | 12 |
| Placements per dashboard | 20 |
| Series per widget | 4 |
| Points per widget | 1000 |
| Dashboards per owner | 100 |
| Widgets per owner | 500 |
| Explicit company scopes | 25 |
| Branches per company | 250 |
| Channels or nodes per company | 100 |
| Filter values | 200 |
| Concurrent metric providers | 6 |
| Share targets | 100 |
| Synchronous date range | 24 months |
| Maximum layout Y | 10000 |
| Widget height | 24 |

## Frontend representation rule

Prefer domain-specific readonly constants:

```ts
export const CORE_ACTIVITY_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
] as const;

export type CoreActivityPriority =
  (typeof CORE_ACTIVITY_PRIORITIES)[number];
```

Do not create one global `Status`, `Priority`, `Scope`, or `DocumentState`
enum. Identical words can have different semantics and allowed transitions.

## Source evidence

```text
../backend/mutakamel-apps/shared-libs/packages/auth/src/contracts/enums/
../backend/mutakamel-apps/shared-libs/packages/common/src/enums/
../backend/mutakamel-apps/shared-libs/packages/common/src/dtos/pagination-query.dto.ts
../backend/mutakamel-apps/shared-libs/packages/database/src/enums/
../backend/mutakamel-apps/core-app/packages/common/src/enums/
../backend/mutakamel-apps/core-app/packages/database/src/entities/tenant/template-platform.types.ts
../backend/mutakamel-apps/core-app/packages/database/src/entities/tenant/business-letter.entity.ts
../backend/mutakamel-apps/core-app/packages/database/src/entities/tenant/business-letter-pdf-render-job.entity.ts
../backend/mutakamel-apps/core-app/src/tenant/template-platform/dto/template-platform.dto.ts
../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts
../backend/mutakamel-apps/crm-app/packages/common/src/constants/permissions.ts
../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts
../backend/mutakamel-apps/trade-app/packages/common/src/constants/features.ts
../backend/mutakamel-apps/trade-app/packages/common/src/constants/limits.ts
```
