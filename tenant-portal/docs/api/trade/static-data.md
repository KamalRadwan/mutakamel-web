# Trade Static Data, Features, Permissions and Enums

> Contract status: source-extracted static contract reference
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`; scope: all Trade capabilities
> Tenant Portal status: `tenant-portal` replaces the legacy Trade UI; generated clients and authorization-aware navigation should consume these exact values.

Static data here means stable code constants and request wire enums. Database-managed catalog data such as items, UOM records, channels, policies, workflows, price books, document profiles, dashboard templates, and webhook destinations must be fetched from APIs and must not be hard-coded.

## Feature entitlement keys

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/constants/features.ts`.

| Symbol | Wire value |
|---|---|
| `CATALOG` | `trade.catalog` |
| `PRICING` | `trade.pricing` |
| `SALES` | `trade.sales` |
| `PURCHASING` | `trade.purchasing` |
| `INVENTORY` | `trade.inventory` |
| `POS` | `trade.pos` |
| `CHANNELS` | `trade.channels` |
| `CONTRACTS_RECURRING` | `trade.contracts_recurring` |
| `POLICY_STUDIO` | `trade.policy_studio` |
| `INTERCOMPANY` | `trade.intercompany` |
| `AUTOMATION` | `trade.automation` |
| `EXTENSION_MARKETPLACE` | `trade.extension_marketplace` |
| `ANALYTICS` | `trade.analytics` |
| `CONTROL_TOWER_ADVANCED` | `trade.control_tower_advanced` |
| `INTELLIGENCE` | `trade.intelligence` |

## Permissions

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/constants/permissions.ts`.

| Symbol | Wire value |
|---|---|
| `CONFIGURATION_READ` | `trade.configuration.read` |
| `CONFIGURATION_MANAGE` | `trade.configuration.manage` |
| `CATALOG_MASTER_MANAGE` | `trade.catalog_master.manage` |
| `ITEM_READ` | `trade.items.read` |
| `ITEM_MANAGE` | `trade.items.manage` |
| `COMMERCIAL_ACCOUNT_READ` | `trade.commercial_accounts.read` |
| `COMMERCIAL_ACCOUNT_MANAGE` | `trade.commercial_accounts.manage` |
| `CREDIT_VIEW` | `trade.credit.view` |
| `CREDIT_OVERRIDE` | `trade.credit.override` |
| `PRICING_READ` | `trade.pricing.read` |
| `PRICING_MANAGE` | `trade.pricing.manage` |
| `PRICING_VIEW_COST` | `trade.pricing.view_cost` |
| `PRICING_OVERRIDE` | `trade.pricing.override` |
| `POLICY_READ` | `trade.policy.read` |
| `POLICY_MANAGE` | `trade.policy.manage` |
| `POLICY_TEST` | `trade.policy.test` |
| `POLICY_APPROVE` | `trade.policy.approve` |
| `POLICY_PUBLISH` | `trade.policy.publish` |
| `POLICY_VIEW_SENSITIVE_FACTS` | `trade.policy.view_sensitive_facts` |
| `DOCUMENT_PROFILE_READ` | `trade.document_profiles.read` |
| `DOCUMENT_PROFILE_MANAGE` | `trade.document_profiles.manage` |
| `DOCUMENT_PROFILE_VALIDATE` | `trade.document_profiles.validate` |
| `DOCUMENT_PROFILE_PUBLISH` | `trade.document_profiles.publish` |
| `EXTENSION_READ` | `trade.extensions.read` |
| `EXTENSION_MANAGE` | `trade.extensions.manage` |
| `EXTENSION_PUBLISH` | `trade.extensions.publish` |
| `IMPORT_MANAGE` | `trade.import.manage` |
| `IMPORT_EXECUTE` | `trade.import.execute` |
| `WEBHOOK_MANAGE` | `trade.webhooks.manage` |
| `WEBHOOK_REPLAY` | `trade.webhooks.replay` |
| `AUTOMATION_MANAGE` | `trade.automation.manage` |
| `QUOTATION_CREATE` | `trade.quotations.create` |
| `QUOTATION_READ` | `trade.quotations.read` |
| `QUOTATION_UPDATE` | `trade.quotations.update` |
| `QUOTATION_SEND` | `trade.quotations.send` |
| `QUOTATION_ACCEPT` | `trade.quotations.accept` |
| `QUOTATION_REJECT` | `trade.quotations.reject` |
| `QUOTATION_CANCEL` | `trade.quotations.cancel` |
| `QUOTATION_CONVERT` | `trade.quotations.convert` |
| `SALES_ORDER_CREATE` | `trade.sales_orders.create` |
| `SALES_ORDER_READ` | `trade.sales_orders.read` |
| `SALES_ORDER_UPDATE` | `trade.sales_orders.update` |
| `SALES_ORDER_CONFIRM` | `trade.sales_orders.confirm` |
| `SALES_ORDER_HOLD` | `trade.sales_orders.hold` |
| `SALES_ORDER_CANCEL` | `trade.sales_orders.cancel` |
| `SALES_ORDER_AMEND` | `trade.sales_orders.amend` |
| `PURCHASE_ORDER_CREATE` | `trade.purchase_orders.create` |
| `PURCHASE_ORDER_READ` | `trade.purchase_orders.read` |
| `PURCHASE_ORDER_UPDATE` | `trade.purchase_orders.update` |
| `PURCHASE_ORDER_SUBMIT` | `trade.purchase_orders.submit` |
| `PURCHASE_ORDER_APPROVE` | `trade.purchase_orders.approve` |
| `PURCHASE_ORDER_CONFIRM` | `trade.purchase_orders.confirm` |
| `PURCHASE_ORDER_CANCEL` | `trade.purchase_orders.cancel` |
| `PURCHASE_QUOTATION_CREATE` | `trade.purchase_quotations.create` |
| `PURCHASE_QUOTATION_READ` | `trade.purchase_quotations.read` |
| `PURCHASE_QUOTATION_UPDATE` | `trade.purchase_quotations.update` |
| `PURCHASE_QUOTATION_ISSUE` | `trade.purchase_quotations.issue` |
| `INVOICE_CREATE` | `trade.invoices.create` |
| `INVOICE_READ` | `trade.invoices.read` |
| `INVOICE_UPDATE` | `trade.invoices.update` |
| `INVOICE_ISSUE` | `trade.invoices.issue` |
| `CONTRACT_CREATE` | `trade.contracts.create` |
| `CONTRACT_READ` | `trade.contracts.read` |
| `CONTRACT_UPDATE` | `trade.contracts.update` |
| `CONTRACT_ACTIVATE` | `trade.contracts.activate` |
| `PURCHASING_OVERRIDE` | `trade.purchasing.override` |
| `INVENTORY_READ` | `trade.inventory.read` |
| `INVENTORY_VIEW_COST` | `trade.inventory.view_cost` |
| `INVENTORY_NODES_MANAGE` | `trade.inventory.nodes.manage` |
| `INVENTORY_OPENING_BALANCE` | `trade.inventory.opening_balance` |
| `INVENTORY_RESERVE` | `trade.inventory.reserve` |
| `INVENTORY_RECEIVE` | `trade.inventory.receive` |
| `INVENTORY_DELIVER` | `trade.inventory.deliver` |
| `INVENTORY_ADJUST` | `trade.inventory.adjust` |
| `INVENTORY_GOVERNANCE_MANAGE` | `trade.inventory.governance.manage` |
| `CONTROL_TOWER_READ` | `trade.control_tower.read` |
| `CONTROL_TOWER_RETRY` | `trade.control_tower.retry` |
| `CONTROL_TOWER_RESOLVE` | `trade.control_tower.resolve` |
| `CONTROL_TOWER_VIEW_SENSITIVE` | `trade.control_tower.view_sensitive` |
| `DASHBOARD_READ` | `trade.dashboards.read` |
| `DASHBOARD_CREATE` | `trade.dashboards.create` |
| `DASHBOARD_UPDATE` | `trade.dashboards.update` |
| `DASHBOARD_DELETE` | `trade.dashboards.delete` |
| `DASHBOARD_SHARE` | `trade.dashboards.share` |
| `WIDGET_READ` | `trade.widgets.read` |
| `WIDGET_CREATE` | `trade.widgets.create` |
| `WIDGET_UPDATE` | `trade.widgets.update` |
| `WIDGET_DELETE` | `trade.widgets.delete` |
| `WIDGET_SHARE` | `trade.widgets.share` |

Permission checks remain server-authoritative. UI permission awareness is for hiding/disabling affordances, never for granting access.

## Shared and DTO-declared enums

### `TradeScopeTarget`

Wire values: `TENANT`, `COMPANY`, `BRANCH`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ItemKind`

Wire values: `PRODUCT`, `SERVICE`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ItemStatus`

Wire values: `DRAFT`, `ACTIVE`, `INACTIVE`, `DISCONTINUED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ItemTrackingMode`

Wire values: `NONE`, `LOT`, `SERIAL`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ChannelType`

Wire values: `INTERNAL_SALES`, `POS`, `ECOMMERCE`, `B2B_PORTAL`, `MARKETPLACE`, `FIELD_SALES`, `API`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `CommercialAccountRole`

Wire values: `CUSTOMER`, `SUPPLIER`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDocumentFamily`

Wire values: `QUOTATION`, `SALES_ORDER`, `PURCHASE_ORDER`, `SALES_RETURN`, `PURCHASE_RETURN`, `POS_SALE`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `DocumentLifecycleStatus`

Wire values: `DRAFT`, `CONFIRMED`, `CANCELLED`, `CLOSED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ApprovalStatus`

Wire values: `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ConfirmationOrchestrationStatus`

Wire values: `NOT_STARTED`, `PENDING`, `READY_TO_FINALIZE`, `COMPLETED`, `REJECTED`, `FAILED`, `CANCELLED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `FulfillmentStatus`

Wire values: `NOT_APPLICABLE`, `UNPLANNED`, `PLANNED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `BLOCKED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `BillingStatus`

Wire values: `NOT_APPLICABLE`, `NOT_BILLED`, `PARTIALLY_BILLED`, `BILLED`, `CREDIT_PENDING`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `SettlementStatus`

Wire values: `UNKNOWN`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `GovernedVersionStatus`

Wire values: `DRAFT`, `TESTED`, `APPROVAL_PENDING`, `SCHEDULED`, `PUBLISHED`, `SUPERSEDED`, `RETIRED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ConfigurationMergeStrategy`

Wire values: `OVERRIDE`, `MIN`, `MAX`, `UNION`, `DENY_WINS`, `FIRST_MATCH`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `DecisionType`

Wire values: `CONFIGURATION`, `ELIGIBILITY`, `SALES_PRICE`, `PURCHASE_PRICE`, `CREDIT`, `APPROVAL`, `FISCAL_CONTEXT`, `PROMISE`, `SOURCING`, `REPLENISHMENT`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `PolicyOutputKind`

Wire values: `ALLOW_DENY`, `REQUIRE_APPROVAL`, `SELECT`, `SCORE`, `VALIDATE`, `PRICE_ADJUSTMENT`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `IntegrationStatus`

Wire values: `NOT_REQUIRED`, `PENDING`, `IN_PROGRESS`, `SUCCEEDED`, `RETRYING`, `FAILED`, `RECONCILIATION_REQUIRED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `ExceptionSeverity`

Wire values: `INFO`, `WARNING`, `HIGH`, `CRITICAL`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `RetryClass`

Wire values: `NEVER`, `SAME_REQUEST`, `AFTER_REFRESH`, `AFTER_DEPENDENCY_RECOVERY`, `MANUAL_RECONCILIATION`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardScopeCoverage`

Wire values: `SINGLE_COMPANY`, `MULTI_COMPANY_AUTHORIZED_UNION`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardScopeMode`

Wire values: `CURRENT_CONTEXT`, `SAVED_TARGETS`, `SELECTED_SCOPES`, `ALL_ACCESSIBLE`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardAccessLevel`

Wire values: `OWNER`, `EDIT`, `VIEW`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardShareSubjectType`

Wire values: `USER`, `TEAM`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardPreferenceContextKind`

Wire values: `COMPANY`, `CONSOLIDATED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardResponsiveLayout`

Wire values: `DESKTOP_12`, `TABLET_6`, `MOBILE_1`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardDataShape`

Wire values: `SCALAR`, `TIME_SERIES`, `CATEGORY`, `XY`, `INTERVAL`, `GRAPH`, `ROWS`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardMetricUnit`

Wire values: `COUNT`, `MONEY`, `PERCENT`, `QUANTITY`, `DURATION`, `SCORE`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardDatePreset`

Wire values: `TODAY`, `CURRENT_WEEK`, `CURRENT_MONTH`, `CURRENT_QUARTER`, `CURRENT_YEAR`, `LAST_30_DAYS`, `CUSTOM`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardPeriodComparisonMode`

Wire values: `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardWidgetComparisonMode`

Wire values: `NONE`, `PREVIOUS_PERIOD`, `PREVIOUS_YEAR`, `TARGET`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardTimeGrain`

Wire values: `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardAggregation`

Wire values: `COUNT`, `SUM`, `AVERAGE`, `MIN`, `MAX`, `PERCENT`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardSeriesAxis`

Wire values: `LEFT`, `RIGHT`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardVisualizationType`

Wire values: `METRIC_CARD`, `LINE`, `AREA`, `LINE_AREA`, `COLUMN`, `BAR`, `STACKED_BAR`, `PIE`, `DONUT`, `SCATTER`, `BUBBLE`, `GANTT`, `FLOWCHART`, `SEMI_CIRCLE_GAUGE`, `THREE_QUARTER_GAUGE`, `CIRCULAR_PROGRESS_GAUGE`, `DETAILED_SPEEDOMETER`, `TABLE`, `FUNNEL`, `HEATMAP`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardRunStatus`

Wire values: `COMPLETE`, `PARTIAL`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeWidgetExecutionStatus`

Wire values: `READY`, `EMPTY`, `LIMITED`, `STALE`, `UNAVAILABLE`, `FAILED`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `TradeDashboardUnavailablePlacementReason`

Wire values: `WIDGET_DELETED`, `WIDGET_ACCESS_REVOKED`, `WIDGET_PERMISSION_REQUIRED`, `METRIC_RETIRED_OR_INCOMPATIBLE`.

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/enums/trade.enums.ts`.

### `UomCataloguePurpose`

Wire values: `ANY`, `SALES`, `PURCHASE`.

Source: `../backend/mutakamel-apps/trade-app/src/modules/catalog/dto/catalog.dto.ts`.

### `UomStatus`

Wire values: `ACTIVE`, `RETIRED`.

Source: `../backend/mutakamel-apps/trade-app/src/modules/catalog/dto/catalog.dto.ts`.

### `PriceBookPurpose`

Wire values: `SALES`, `PURCHASE`.

Source: `../backend/mutakamel-apps/trade-app/src/modules/pricing/dto/pricing.dto.ts`.

### `PromotionBenefitType`

Wire values: `PERCENTAGE`, `FIXED_AMOUNT`.

Source: `../backend/mutakamel-apps/trade-app/src/modules/pricing/dto/pricing.dto.ts`.

DTO properties using `IsIn([...])` but not a declared enum are indexed in [validation-reference.md](validation-reference.md). A TypeScript union without a runtime membership validator is not promoted to a guaranteed wire enum here.

## Limits

Source: `../backend/mutakamel-apps/trade-app/packages/common/src/constants/limits.ts`.

| Constant | Value expression | Group |
|---|---:|---|
| `MAX_DOCUMENT_LINES` | `1_000` | `TRADE_LIMITS` |
| `MAX_BULK_ITEMS` | `500` | `TRADE_LIMITS` |
| `MAX_CUSTOM_FIELDS_PER_PROFILE` | `100` | `TRADE_LIMITS` |
| `MAX_EXTENSION_VALUE_BYTES` | `16 * 1024` | `TRADE_LIMITS` |
| `MAX_POLICY_RULES_PER_VERSION` | `2_000` | `TRADE_LIMITS` |
| `MAX_POLICY_EVALUATION_MS` | `100` | `TRADE_LIMITS` |
| `MAX_EXPLANATION_BYTES` | `32 * 1024` | `TRADE_LIMITS` |
| `MAX_CACHE_VALUE_BYTES` | `256 * 1024` | `TRADE_LIMITS` |
| `MAX_NAME_CHARACTERS` | `120` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_DESCRIPTION_CHARACTERS` | `500` | `TRADE_DASHBOARD_LIMITS` |
| `GRID_COLUMNS` | `12` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_PLACEMENTS` | `20` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_WIDGET_SERIES` | `4` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_WIDGET_POINTS` | `1_000` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_DASHBOARDS_PER_OWNER` | `100` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_WIDGETS_PER_OWNER` | `500` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_EXPLICIT_COMPANY_SCOPES` | `25` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_BRANCHES_PER_COMPANY` | `250` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_CHANNELS_OR_NODES_PER_COMPANY` | `100` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_FILTER_VALUES` | `200` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_PROVIDER_CONCURRENCY` | `6` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_SHARE_TARGETS` | `100` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_SYNC_RANGE_MONTHS` | `24` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_LAYOUT_Y` | `10_000` | `TRADE_DASHBOARD_LIMITS` |
| `MAX_WIDGET_HEIGHT` | `24` | `TRADE_DASHBOARD_LIMITS` |

These are server limits, not suggested batch sizes. Frontend code should validate early where useful and still handle server rejection because limits can change independently.
