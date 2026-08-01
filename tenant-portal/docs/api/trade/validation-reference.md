# Trade Validation Reference

> Contract status: source-extracted transport validation reference
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`; source coverage: every routed Trade controller DTO plus controller-local path/query DTO
> Tenant Portal status: `tenant-portal` replaces the legacy Trade UI; use this reference to generate replacement request schemas, not response-derived forms.

## Runtime validation model

Trade installs a global `ValidationPipe` with transformation and implicit primitive conversion enabled, `whitelist: true`, `forbidNonWhitelisted: true`, and all validation errors collected. Rejected input uses code `TRADE.VALIDATION_FAILED`. Because Trade has no shared exception filter and the Gateway forwards upstream bodies unchanged, this validation failure remains a raw Nest body shaped as `{ code, message }`, not Gateway Problem Details.

Authoritative sources:

- `../backend/mutakamel-apps/trade-app/src/main.ts`
- DTO/controller files indexed below

Important interpretation:

- A TypeScript literal union does not enforce runtime membership unless an `IsIn`, `IsEnum`, `Matches`, or equivalent validator is present.
- Monetary and quantity values validated as decimal strings must remain strings in JSON.
- `Type(() => Number)` means query/body primitives are converted before integer/min/max validation.
- Service-level invariants, scope ownership, referential checks, concurrency, workflow transitions, and policy decisions are additional to this transport layer.
- Inherited fields are defined in the named base DTO; follow the inheritance link in the source index instead of dropping them.

## Closed runtime lists

This is a source-extracted index of every `IsIn(...)` validator found in the DTO/controller set:

| Property | Exact validator | Source |
|---|---|---|
| `CreateConfigurationDefinitionDto.riskClass` | `IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])` | `../backend/mutakamel-apps/trade-app/src/modules/configuration-scope/dto/configuration.dto.ts` |
| `ExceptionListQueryDto.status` | `IsIn([ "OPEN", "ACKNOWLEDGED", "ACTION_PENDING", "RECONCILIATION_PENDING", "RESOLVED", "QUARANTINED", ])` | `../backend/mutakamel-apps/trade-app/src/modules/control-tower/dto/control-tower.dto.ts` |
| `ExceptionListQueryDto.severity` | `IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])` | `../backend/mutakamel-apps/trade-app/src/modules/control-tower/dto/control-tower.dto.ts` |
| `ResolveExceptionDto.resolutionCode` | `IsIn(["SOURCE_CORRECTED", "OWNER_RESULT_APPLIED"])` | `../backend/mutakamel-apps/trade-app/src/modules/control-tower/dto/control-tower.dto.ts` |
| `DashboardDisplaySpecDto.legendPosition` | `IsIn(["TOP", "BOTTOM", "START", "END", "HIDDEN"])` | `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dto/dashboard.dto.ts` |
| `ShareChangeDto.accessLevel` | `IsIn(["VIEW", "EDIT"])` | `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dto/dashboard.dto.ts` |
| `CreateDocumentProfileDto.documentType` | `IsIn([ TradeDocumentFamily.QUOTATION, TradeDocumentFamily.SALES_ORDER, TradeDocumentFamily.PURCHASE_ORDER, ])` | `../backend/mutakamel-apps/trade-app/src/modules/document-platform/dto/document-profile.dto.ts` |
| `RenderTradeBusinessPdfDto.purpose` | `IsIn(["SUPPLIER_QUOTATION", "SALES_ORDER", "PURCHASE_ORDER", "INVOICE", "CONTRACT"])` | `../backend/mutakamel-apps/trade-app/src/modules/documents/business-document-pdf/business-document-pdf.dto.ts` |
| `RenderQuotationPdfDto.purpose` | `IsIn(["CUSTOMER_QUOTATION"])` | `../backend/mutakamel-apps/trade-app/src/modules/documents/quotation-pdf/quotation-pdf.dto.ts` |
| `ExtensionFieldDto.valueKind` | `IsIn(["SCALAR", "OBJECT", "COLLECTION"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionFieldDto.scalarType` | `IsIn(["STRING", "BOOLEAN", "DECIMAL", "DATE", "UUID", "ENUM"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionFieldDto.visibilityCode` | `IsIn(["INTERNAL", "USER", "EXTERNAL_SAFE"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionFieldDto.defaultStrategy` | `IsIn(["NONE", "LITERAL", "OWNER_DERIVED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateExtensionProfileDto.targetCode` | `IsIn(["CATALOG_ITEM", "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateExtensionProfileDto.scopeTarget` | `IsIn(["TENANT", "COMPANY"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionProfileListQueryDto.targetCode` | `IsIn(["CATALOG_ITEM", "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionProfileListQueryDto.status` | `IsIn(["DRAFT", "ACTIVE", "RETIRED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ExtensionProfileVersionListQueryDto.status` | `IsIn(["DRAFT", "TESTED", "PUBLISHED", "SUPERSEDED", "RETIRED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ImportMappingFieldDto.transformCode` | `IsIn([ "IDENTITY", "TRIM", "PARSE_DECIMAL", "PARSE_DATE", "NORMALIZE_CODE", "ENUM_MAP", ])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateImportMappingDto.targetCode` | `IsIn(["CATALOG_COMPANY_PROFILE", "CATALOG_BRANCH_ASSIGNMENT"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateImportMappingDto.scopeTarget` | `IsIn(["COMPANY", "BRANCH"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateImportMappingDto.executionMode` | `IsIn(["PER_ROW"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `UpdateImportMappingDto.executionMode` | `IsIn(["PER_ROW"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ImportMappingListQueryDto.status` | `IsIn(["DRAFT", "ACTIVE"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ImportMappingListQueryDto.targetCode` | `IsIn(["CATALOG_COMPANY_PROFILE", "CATALOG_BRANCH_ASSIGNMENT"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ImportRunListQueryDto.status` | `IsIn([ "PENDING", "PREVIEWING", "PREVIEWED", "EXECUTING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", ])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ImportResultListQueryDto.status` | `IsIn(["VALID", "INVALID", "SUCCEEDED", "FAILED", "SKIPPED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateWebhookSubscriptionDto.scopeTarget` | `IsIn(["TENANT", "COMPANY"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `CreateWebhookSubscriptionDto.retryPolicyCode` | `IsIn(["EXPONENTIAL_STANDARD", "EXPONENTIAL_CONSERVATIVE"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `UpdateWebhookSubscriptionDto.retryPolicyCode` | `IsIn(["EXPONENTIAL_STANDARD", "EXPONENTIAL_CONSERVATIVE"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `UpdateWebhookSubscriptionDto.status` | `IsIn(["ACTIVE", "DISABLED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `WebhookSubscriptionListQueryDto.status` | `IsIn(["DRAFT", "ACTIVE", "DISABLED"])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `WebhookDeliveryListQueryDto.status` | `IsIn([ "PENDING", "RETRY_PENDING", "DELIVERED", "FAILED", "EXHAUSTED", "DISABLED", ])` | `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts` |
| `ContractFinancialTermsDto.mode` | `IsIn(["FINANCIAL", "NON_FINANCIAL"])` | `../backend/mutakamel-apps/trade-app/src/modules/financial-documents/dto/financial-documents.dto.ts` |
| `CreateNodeDto.nodeType` | `IsIn(["WAREHOUSE", "STORE", "VIRTUAL"])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `UpdateNodeDto.status` | `IsIn(["ACTIVE", "INACTIVE"])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `InventoryPeriodListQueryDto.status` | `IsIn(["OPEN", "CLOSED"])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `InventoryUomConversionListQueryDto.status` | `IsIn(["DRAFT", "PUBLISHED", "RETIRED"])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `InventorySerialListQueryDto.state` | `IsIn(["ON_HAND", "RESERVED", "DELIVERED", "VOIDED"])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `InventoryDecisionListQueryDto.policyKind` | `IsIn([ "INVENTORY_RESERVATION", "INVENTORY_NEGATIVE", "INVENTORY_OVER_RECEIPT", ])` | `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts` |
| `GovernanceListQueryDto.status` | `IsIn(["ACTIVE", "INACTIVE"])` | `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts` |
| `CreatePolicyDefinitionDto.policyKind` | `IsIn([ "CREDIT", "PRICING_GUARD", "ORDER_CONFIRMATION", "PURCHASE_APPROVAL", "INVENTORY_NEGATIVE", "INVENTORY_RESERVATION", "INVENTORY_OVER_RECEIPT", ])` | `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts` |
| `CreateWorkflowDefinitionDto.workflowKind` | `IsIn([ "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER", "PRICE_PUBLICATION", "CONFIGURATION_PUBLICATION", ])` | `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts` |

## `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog-read.controller.ts`

### `CatalogReadItemParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/catalog/catalog.controller.ts`

### `IdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `ChannelBranchParamsDto extends IdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `branchId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `ItemListingParamsDto extends IdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `channelId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/catalog/dto/catalog.dto.ts`

### `CatalogListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `itemKind` | `ItemKind (optional)` | `—` | `IsOptional() IsEnum(ItemKind)` |
| `status` | `ItemStatus (optional)` | `—` | `IsOptional() IsEnum(ItemStatus)` |

### `ItemChannelListingListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `UomSourceEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `sourceKind` | `string` | `—` | `IsString() MinLength(1) MaxLength(80)` |
| `reference` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |
| `note` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(500)` |

### `CreateUomDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `IsString() MinLength(1) MaxLength(32) Matches(/^[A-Za-z][A-Za-z0-9._-]*$/)` |
| `displayName` | `string` | `—` | `IsString() MinLength(1) MaxLength(160)` |
| `localizedNames` | `Record<string, string>` | `—` | `IsObject()` |
| `sourceEvidence` | `UomSourceEvidenceDto` | `—` | `IsObject() ValidateNested() Type(() => UomSourceEvidenceDto)` |

### `UpdateUomDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `displayName` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsString() MinLength(1) MaxLength(160)` |
| `localizedNames` | `Record<string, string> (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsObject()` |
| `sourceEvidence` | `UomSourceEvidenceDto (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsObject() ValidateNested() Type(() => UomSourceEvidenceDto)` |
| `status` | `UomStatus (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsEnum(UomStatus)` |

### `UomListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `UomStatus (optional)` | `—` | `IsOptional() IsEnum(UomStatus)` |
| `search` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(32) Matches(/^[A-Za-z0-9._-]+$/)` |

### `UomCatalogueQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `purpose` | `inferred (optional)` | `UomCataloguePurpose.ANY` | `IsOptional() IsEnum(UomCataloguePurpose)` |
| `itemId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `search` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(36) Matches(/^[0-9a-fA-F-]+$/)` |

### `CreateItemDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `canonicalCode` | `string` | `—` | `IsString() MinLength(1) MaxLength(80)` |
| `itemKind` | `ItemKind` | `—` | `IsEnum(ItemKind)` |
| `localizedNames` | `Record<string, string>` | `—` | `IsObject()` |
| `baseUomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `categoryId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `variantIdentity` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |

### `UpdateItemDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `localizedNames` | `Record<string, string> (optional)` | `—` | `IsOptional() IsObject()` |
| `categoryId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `variantIdentity` | `Record<string, unknown> \| null (optional)` | `—` | `IsOptional() IsObject()` |
| `status` | `ItemStatus (optional)` | `—` | `IsOptional() IsEnum(ItemStatus)` |

### `UpsertItemCompanyProfileDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `canSell` | `boolean` | `—` | `IsBoolean()` |
| `canPurchase` | `boolean` | `—` | `IsBoolean()` |
| `trackInventory` | `boolean` | `—` | `IsBoolean()` |
| `trackingMode` | `ItemTrackingMode` | `—` | `IsEnum(ItemTrackingMode)` |
| `taxClassificationKey` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `defaultSalesUomId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `defaultPurchaseUomId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `capabilitySet` | `unknown[] (optional)` | `[]` | `IsOptional() IsArray()` |
| `accountingMappingKey` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

### `UpsertItemBranchProfileDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `defaultFulfillmentNodeId` | `\| string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `isAssorted` | `boolean` | `—` | `IsBoolean()` |
| `replenishmentPolicyKey` | `\| string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `restrictions` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateChannelDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `IsString() MinLength(1) MaxLength(80)` |
| `name` | `string` | `—` | `IsString() MinLength(1) MaxLength(160)` |
| `channelType` | `ChannelType` | `—` | `IsEnum(ChannelType)` |

### `UpdateChannelDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() MinLength(1) MaxLength(160)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsString()` |

### `ChannelBranchDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `branchId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `isActive` | `inferred (optional)` | `true` | `IsOptional() IsBoolean()` |

### `UpdateChannelBranchDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `isActive` | `boolean` | `—` | `IsBoolean()` |

### `ItemChannelListingDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `channelId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `publicationStatus` | `inferred (optional)` | `"DRAFT"` | `IsOptional() IsString()` |
| `saleConstraints` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `UpdateItemChannelListingDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `publicationStatus` | `inferred (optional)` | `"DRAFT"` | `IsOptional() IsString()` |
| `saleConstraints` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CatalogSearchFilterDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `field` | `"canonicalCode" \| "status" \| "itemKind"` | `—` | `IsString()` |
| `value` | `string` | `—` | `IsString()` |

### `CatalogSearchDto extends CatalogListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `filters` | `CatalogSearchFilterDto[]` | `[]` | `IsArray() ValidateNested({ each: true }) Type(() => CatalogSearchFilterDto)` |

## `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/commercial-accounts.controller.ts`

### `AccountIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `AccountBranchParamDto extends AccountIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `branchId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/commercial-accounts/dto/commercial-account.dto.ts`

### `CommercialAccountListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `accountRole` | `CommercialAccountRole (optional)` | `—` | `IsOptional() IsEnum(CommercialAccountRole)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsString()` |

### `CommercialAccountLookupQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `search` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `CreateCommercialAccountDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `partyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `accountRole` | `CommercialAccountRole` | `—` | `IsEnum(CommercialAccountRole)` |
| `paymentTermsId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `creditLimit` | `string \| null (optional)` | `—` | `IsOptional() Matches(DECIMAL_PATTERN)` |
| `creditCurrencyCode` | `string \| null (optional)` | `—` | `IsOptional() Matches(CURRENCY_PATTERN)` |
| `priceBookId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `creditPolicyVersionId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `terms` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `UpdateCommercialAccountDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `paymentTermsId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `creditLimit` | `string \| null (optional)` | `—` | `IsOptional() Matches(DECIMAL_PATTERN)` |
| `creditCurrencyCode` | `string \| null (optional)` | `—` | `IsOptional() Matches(CURRENCY_PATTERN)` |
| `priceBookId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `creditPolicyVersionId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `terms` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |

### `CreateAccountBranchRuleDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `branchId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `narrowingRules` | `Record<string, unknown>` | `—` | `IsObject()` |

### `UpdateAccountBranchRuleDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `narrowingRules` | `Record<string, unknown>` | `—` | `IsObject()` |
| `status` | `"ACTIVE" \| "RETIRED" (optional)` | `—` | `IsOptional() IsString()` |

### `CreditEvaluationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `proposedAmount` | `string` | `—` | `Matches(DECIMAL_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `sourceDocumentId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `sourceDocumentType` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(40)` |

### `AccountTransitionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `IsString() MaxLength(80)` |
| `evidenceRef` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |

## `../backend/mutakamel-apps/trade-app/src/modules/configuration-scope/configuration-scope.controller.ts`

### `ConfigurationIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/configuration-scope/dto/configuration.dto.ts`

### `ConfigurationDefinitionListDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `CreateConfigurationDefinitionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `key` | `string` | `—` | `IsString() Matches(/^trade\.[a-z0-9][a-z0-9_.-]{1,110}$/)` |
| `valueSchema` | `Record<string, unknown>` | `—` | `IsObject()` |
| `allowedScopes` | `TradeScopeTarget[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(3) IsEnum(TradeScopeTarget, { each: true })` |
| `mergeStrategy` | `ConfigurationMergeStrategy` | `—` | `IsEnum(ConfigurationMergeStrategy)` |
| `riskClass` | `string` | `—` | `IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])` |
| `companyLockPolicy` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateConfigurationVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `scopeTarget` | `TradeScopeTarget` | `—` | `IsEnum(TradeScopeTarget)` |
| `value` | `unknown` | `—` | `Allow()` |
| `effectiveFrom` | `string` | `—` | `IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |

### `ResolveConfigurationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `keys` | `string[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(100) Matches(/^trade\.[a-z0-9][a-z0-9_.-]{1,110}$/, { each: true })` |
| `facts` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

## `../backend/mutakamel-apps/trade-app/src/modules/control-tower/control-tower.controller.ts`

### `ExceptionIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/control-tower/dto/control-tower.dto.ts`

### `ExceptionListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn([ "OPEN", "ACKNOWLEDGED", "ACTION_PENDING", "RECONCILIATION_PENDING", "RESOLVED", "QUARANTINED", ])` |
| `severity` | `string (optional)` | `—` | `IsOptional() IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])` |
| `category` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(64)` |

### `RetryExceptionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reason` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |

### `ResolveExceptionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `resolutionCode` | `string` | `—` | `IsIn(["SOURCE_CORRECTED", "OWNER_RESULT_APPLIED"])` |
| `reason` | `string` | `—` | `IsString() MaxLength(240)` |
| `evidence` | `Record<string, unknown>` | `—` | `IsObject()` |

## `../backend/mutakamel-apps/trade-app/src/modules/dashboards/dto/dashboard.dto.ts`

### `DashboardIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `DashboardPlacementParamDto extends DashboardIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `placementId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `DashboardShareParamDto extends DashboardIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `shareId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `DashboardScopeTargetDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `companyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `branchIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_BRANCHES_PER_COMPANY) Matches(UUID_V7_PATTERN, { each: true })` |

### `DashboardFiltersDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `datePreset` | `TradeDashboardDatePreset (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardDatePreset)` |
| `dateFrom` | `string (optional)` | `—` | `IsOptional() IsDateString()` |
| `dateTo` | `string (optional)` | `—` | `IsOptional() IsDateString()` |
| `currencyCodes` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_FILTER_VALUES) Matches(/^[A-Z]{3}$/, { each: true }) Transform(({ value }: { value: unknown }) => Array.isArray(value) ? value.map((entry) => String(entry).trim().toUpperCase()) : value, )` |
| `comparisonMode` | `TradeDashboardPeriodComparisonMode (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardPeriodComparisonMode)` |
| `itemIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_FILTER_VALUES) Matches(UUID_V7_PATTERN, { each: true })` |
| `clauses` | `DashboardFilterClauseDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_FILTER_VALUES) ValidateNested({ each: true }) Type(() => DashboardFilterClauseDto)` |

### `PreferenceContextDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `kind` | `TradeDashboardPreferenceContextKind` | `—` | `IsEnum(TradeDashboardPreferenceContextKind)` |
| `companyId` | `string (optional)` | `—` | `ValidateIf((object: PreferenceContextDto) => object.kind === TradeDashboardPreferenceContextKind.COMPANY, ) Matches(UUID_V7_PATTERN)` |

### `DashboardFilterClauseDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `key` | `string` | `—` | `IsString() Matches(/^[a-z][a-z0-9_.-]{0,79}$/)` |
| `values` | `string[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_FILTER_VALUES) IsString({ each: true }) MinLength(1, { each: true }) MaxLength(120, { each: true }) Matches(PLAIN_TEXT_PATTERN, { each: true })` |

### `DashboardMetricSeriesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `metricKey` | `string` | `—` | `IsString() MinLength(3) MaxLength(160) Matches(/^trade\.[a-z0-9_.]+$/)` |
| `label` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(80) Matches(PLAIN_TEXT_PATTERN)` |
| `axis` | `TradeDashboardSeriesAxis (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardSeriesAxis)` |
| `aggregation` | `TradeDashboardAggregation (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardAggregation)` |

### `DashboardWidgetComparisonDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `mode` | `TradeDashboardWidgetComparisonMode` | `—` | `IsEnum(TradeDashboardWidgetComparisonMode)` |
| `target` | `string (optional)` | `—` | `ValidateIf((object: DashboardWidgetComparisonDto) => object.mode === TradeDashboardWidgetComparisonMode.TARGET, ) IsString() Matches(/^(?=.*[1-9])(?:0\|[1-9]\d*)(?:\.\d{1,8})?$/)` |

### `DashboardWidgetQuerySpecDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `series` | `DashboardMetricSeriesDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_WIDGET_SERIES) ValidateNested({ each: true }) Type(() => DashboardMetricSeriesDto)` |
| `dimensionKey` | `string (optional)` | `—` | `IsOptional() IsString() MinLength(1) MaxLength(40) Matches(/^[a-z][a-z0-9_]*$/)` |
| `grain` | `TradeDashboardTimeGrain (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardTimeGrain)` |
| `comparison` | `DashboardWidgetComparisonDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardWidgetComparisonDto)` |
| `filters` | `DashboardFilterClauseDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_FILTER_VALUES) ValidateNested({ each: true }) Type(() => DashboardFilterClauseDto)` |

### `DashboardDisplaySpecDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `title` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(120) Matches(PLAIN_TEXT_PATTERN)` |
| `subtitle` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(300) Matches(PLAIN_TEXT_PATTERN)` |
| `paletteToken` | `string (optional)` | `—` | `IsOptional() IsString() Matches(/^[a-z][a-z0-9_.-]{0,79}$/)` |
| `color` | `string (optional)` | `—` | `IsOptional() Matches(/^#[0-9A-Fa-f]{6}$/)` |
| `seriesColors` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_WIDGET_SERIES) Matches(/^#[0-9A-Fa-f]{6}$/, { each: true })` |
| `targetColor` | `string (optional)` | `—` | `IsOptional() Matches(/^#[0-9A-Fa-f]{6}$/)` |
| `numberFormatKey` | `string (optional)` | `—` | `IsOptional() IsString() Matches(/^[A-Z][A-Z0-9_]{0,79}$/) Transform(upper)` |
| `precision` | `number (optional)` | `—` | `IsOptional() IsInt() Min(0) Max(8)` |
| `legendPosition` | `string (optional)` | `—` | `IsOptional() IsIn(["TOP", "BOTTOM", "START", "END", "HIDDEN"])` |
| `axisLabels` | `Record<string, string> (optional)` | `—` | `IsOptional() IsObject()` |
| `targetDisplay` | `boolean (optional)` | `—` | `IsOptional() IsBoolean()` |
| `options` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |

### `CreateDashboardDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string` | `—` | `IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `description` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_DESCRIPTION_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `scopeCoverage` | `TradeDashboardScopeCoverage` | `—` | `IsEnum(TradeDashboardScopeCoverage)` |
| `scopeTargets` | `DashboardScopeTargetDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES) ValidateNested({ each: true }) Type(() => DashboardScopeTargetDto)` |
| `defaultFilters` | `DashboardFiltersDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardFiltersDto)` |

### `CreateDashboardFromTemplateDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `description` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_DESCRIPTION_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `defaultFilters` | `DashboardFiltersDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardFiltersDto)` |
| `preferenceContext` | `PreferenceContextDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => PreferenceContextDto)` |

### `UpdateDashboardDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `description` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_DESCRIPTION_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `scopeCoverage` | `TradeDashboardScopeCoverage (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardScopeCoverage)` |
| `scopeTargets` | `DashboardScopeTargetDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMinSize(1) ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES) ValidateNested({ each: true }) Type(() => DashboardScopeTargetDto)` |
| `defaultFilters` | `DashboardFiltersDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardFiltersDto)` |

### `DuplicateDashboardDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |

### `CreateWidgetDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string` | `—` | `IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `visualizationType` | `TradeDashboardVisualizationType` | `—` | `IsEnum(TradeDashboardVisualizationType)` |
| `querySpec` | `DashboardWidgetQuerySpecDto` | `—` | `ValidateNested() Type(() => DashboardWidgetQuerySpecDto)` |
| `displaySpec` | `DashboardDisplaySpecDto` | `—` | `ValidateNested() Type(() => DashboardDisplaySpecDto)` |

### `UpdateWidgetDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |
| `visualizationType` | `TradeDashboardVisualizationType (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardVisualizationType)` |
| `querySpec` | `DashboardWidgetQuerySpecDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardWidgetQuerySpecDto)` |
| `displaySpec` | `DashboardDisplaySpecDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardDisplaySpecDto)` |

### `CloneWidgetDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MinLength(1) MaxLength(TRADE_DASHBOARD_LIMITS.MAX_NAME_CHARACTERS) Matches(PLAIN_TEXT_PATTERN)` |

### `CreatePlacementDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `widgetId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `x` | `number (optional)` | `—` | `IsOptional() IsInt() Min(0) Max(11)` |
| `y` | `number (optional)` | `—` | `IsOptional() IsInt() Min(0) Max(TRADE_DASHBOARD_LIMITS.MAX_LAYOUT_Y)` |
| `width` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1) Max(12)` |
| `height` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1) Max(TRADE_DASHBOARD_LIMITS.MAX_WIDGET_HEIGHT)` |
| `sortOrder` | `number (optional)` | `—` | `IsOptional() IsInt() Min(0)` |

### `LayoutPlacementDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `placementId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `x` | `number` | `—` | `IsInt() Min(0) Max(11)` |
| `y` | `number` | `—` | `IsInt() Min(0) Max(TRADE_DASHBOARD_LIMITS.MAX_LAYOUT_Y)` |
| `width` | `number` | `—` | `IsInt() Min(1) Max(12)` |
| `height` | `number` | `—` | `IsInt() Min(1) Max(TRADE_DASHBOARD_LIMITS.MAX_WIDGET_HEIGHT)` |
| `sortOrder` | `number` | `—` | `IsInt() Min(0)` |

### `UpdateDashboardLayoutDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `placements` | `LayoutPlacementDto[]` | `—` | `IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_PLACEMENTS) ValidateNested({ each: true }) Type(() => LayoutPlacementDto)` |

### `RuntimeCompanyScopeDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `companyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `branchIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_BRANCHES_PER_COMPANY) Matches(UUID_V7_PATTERN, { each: true })` |
| `channelIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_CHANNELS_OR_NODES_PER_COMPANY) Matches(UUID_V7_PATTERN, { each: true })` |
| `fulfillmentNodeIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_CHANNELS_OR_NODES_PER_COMPANY) Matches(UUID_V7_PATTERN, { each: true })` |

### `DashboardScopeSelectionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `scopeMode` | `TradeDashboardScopeMode` | `—` | `IsEnum(TradeDashboardScopeMode)` |
| `companyScopes` | `RuntimeCompanyScopeDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES) ValidateNested({ each: true }) Type(() => RuntimeCompanyScopeDto)` |

### `RunDashboardDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `requestId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `scope` | `DashboardScopeSelectionDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardScopeSelectionDto)` |
| `filters` | `DashboardFiltersDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardFiltersDto)` |
| `widgetIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_PLACEMENTS) Matches(UUID_V7_PATTERN, { each: true })` |

### `PreviewWidgetDto extends CreateWidgetDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `requestId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `scope` | `DashboardScopeSelectionDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardScopeSelectionDto)` |
| `filters` | `DashboardFiltersDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => DashboardFiltersDto)` |

### `DashboardPreferenceQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `kind` | `TradeDashboardPreferenceContextKind (optional)` | `—` | `IsOptional() IsEnum(TradeDashboardPreferenceContextKind)` |
| `companyId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

### `SetDashboardDefaultDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `context` | `PreferenceContextDto` | `—` | `ValidateNested() Type(() => PreferenceContextDto)` |

### `SetDashboardFavoriteDto extends SetDashboardDefaultDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `favorite` | `boolean` | `—` | `IsBoolean()` |

### `ShareChangeDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `subjectType` | `TradeDashboardShareSubjectType` | `—` | `IsEnum(TradeDashboardShareSubjectType)` |
| `subjectId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `accessLevel` | `"VIEW" \| "EDIT"` | `—` | `IsIn(["VIEW", "EDIT"])` |
| `expiresAt` | `string (optional)` | `—` | `IsOptional() IsDateString()` |

### `BulkUpsertSharesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `resourceRevision` | `number` | `—` | `IsInt() Min(1)` |
| `changes` | `ShareChangeDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(TRADE_DASHBOARD_LIMITS.MAX_SHARE_TARGETS) ValidateNested({ each: true }) Type(() => ShareChangeDto)` |

### `ShareTargetsQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `search` | `string (optional)` | `—` | `IsOptional() IsString() Transform(trim) MaxLength(80)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `offset` | `inferred (optional)` | `0` | `IsOptional() Type(() => Number) IsInt() Min(0)` |

### `DashboardListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `offset` | `inferred (optional)` | `0` | `IsOptional() Type(() => Number) IsInt() Min(0)` |
| `context` | `PreferenceContextDto (optional)` | `—` | `IsOptional() ValidateNested() Type(() => PreferenceContextDto)` |

## `../backend/mutakamel-apps/trade-app/src/modules/document-platform/document-profile.controller.ts`

### `DocumentProfileIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/document-platform/dto/document-profile.dto.ts`

### `DocumentProfileListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `documentType` | `TradeDocumentFamily (optional)` | `—` | `IsOptional() IsEnum(TradeDocumentFamily)` |
| `versionStatus` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(24)` |

### `CreateDocumentProfileDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(/^[A-Z][A-Z0-9_.-]{1,99}$/)` |
| `documentType` | `TradeDocumentFamily` | `—` | `IsIn([ TradeDocumentFamily.QUOTATION, TradeDocumentFamily.SALES_ORDER, TradeDocumentFamily.PURCHASE_ORDER, ])` |
| `scopeTarget` | `TradeScopeTarget` | `—` | `IsEnum(TradeScopeTarget)` |

### `CreateDocumentProfileVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `content` | `Record<string, unknown>` | `—` | `IsObject()` |
| `requiredCases` | `unknown[] (optional)` | `[]` | `IsOptional() IsArray() ArrayMaxSize(20)` |
| `effectiveFrom` | `string` | `—` | `IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `restoredFromVersionId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `restorationReason` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |

### `PublishDocumentProfileVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `expectedActivePointerVersion` | `number` | `—` | `IsInt() Min(0)` |

## `../backend/mutakamel-apps/trade-app/src/modules/documents/business-document-pdf/business-document-pdf.dto.ts`

### `RenderTradeBusinessPdfDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `sourceVersion` | `number` | `—` | `IsInt() Min(1)` |
| `templateVersionId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `locale` | `string (optional)` | `—` | `IsOptional() Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/) MaxLength(35)` |
| `timeZone` | `string (optional)` | `—` | `IsOptional() IsString() Matches(/^(?:UTC\|[A-Za-z][A-Za-z0-9_+-]{0,31}\/[A-Za-z][A-Za-z0-9_+./-]{0,62})$/) MaxLength(64)` |
| `purpose` | `\| "SUPPLIER_QUOTATION" \| "SALES_ORDER" \| "PURCHASE_ORDER" \| "INVOICE" \| "CONTRACT"` | `—` | `IsIn(["SUPPLIER_QUOTATION", "SALES_ORDER", "PURCHASE_ORDER", "INVOICE", "CONTRACT"])` |

### `TradeBusinessPdfPathDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `documentId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `TradeBusinessPdfJobPathDto extends TradeBusinessPdfPathDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `renderJobId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/documents/documents.controller.ts`

### `DocumentIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `ConfirmationParamDto extends DocumentIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `attemptId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/documents/dto/documents.dto.ts`

### `DocumentListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsString()` |
| `partyId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

### `CreateQuotationDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `partyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `crmCustomerProfileId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `contactPartyId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `draftReference` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `sourceCrmOpportunityId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `sourceCrmOpportunityVersion` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1)` |

### `UpdateQuotationDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `contactPartyId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `draftReference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

### `CommercialLineInputDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `priceBookId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

### `QuotationCustomerOptionsQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `search` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `cursor` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(512)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `OrderLineFinancialEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `lineTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |

### `OrderCommercialLineInputDto extends CommercialLineInputDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `financial` | `OrderLineFinancialEvidenceDto` | `—` | `IsDefined() ValidateNested() Type(() => OrderLineFinancialEvidenceDto)` |

### `OrderTotalsEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `subtotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `roundingTotal` | `string` | `—` | `Matches(SIGNED_DECIMAL_PATTERN)` |
| `grandTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountPaid` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountDue` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |

### `CreateQuotationRevisionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `validUntil` | `string` | `—` | `IsISO8601({ strict: true })` |
| `lines` | `CommercialLineInputDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => CommercialLineInputDto)` |
| `terms` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `DocumentReasonDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `IsString() MaxLength(80)` |
| `evidenceRef` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |

### `ConvertQuotationLineEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `financial` | `OrderLineFinancialEvidenceDto` | `—` | `IsDefined() ValidateNested() Type(() => OrderLineFinancialEvidenceDto)` |

### `ConvertQuotationDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `lines` | `ConvertQuotationLineEvidenceDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => ConvertQuotationLineEvidenceDto)` |
| `totals` | `OrderTotalsEvidenceDto` | `—` | `IsDefined() ValidateNested() Type(() => OrderTotalsEvidenceDto)` |
| `terms` | `Record<string, unknown>` | `—` | `IsDefined() IsObject()` |

### `CreateSalesOrderDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `partyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `contactPartyId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `draftReference` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `lines` | `OrderCommercialLineInputDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => OrderCommercialLineInputDto)` |
| `totals` | `OrderTotalsEvidenceDto` | `—` | `IsDefined() ValidateNested() Type(() => OrderTotalsEvidenceDto)` |
| `terms` | `Record<string, unknown>` | `—` | `IsDefined() IsObject()` |

### `UpdateSalesOrderDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `contactPartyId` | `string \| null (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `draftReference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

### `ConfirmSalesOrderDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `requestedDeadline` | `string (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |

## `../backend/mutakamel-apps/trade-app/src/modules/documents/quotation-pdf/quotation-pdf.dto.ts`

### `RenderQuotationPdfDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `revisionId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `templateVersionId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `locale` | `string (optional)` | `—` | `IsOptional() Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/) MaxLength(35)` |
| `timeZone` | `string (optional)` | `—` | `IsOptional() IsString() Matches(/^(?:UTC\|[A-Za-z][A-Za-z0-9_+-]{0,31}\/[A-Za-z][A-Za-z0-9_+./-]{0,62})$/) MaxLength(64)` |
| `purpose` | `"CUSTOMER_QUOTATION"` | `—` | `IsIn(["CUSTOMER_QUOTATION"])` |

### `QuotationPdfPathDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `quotationId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `QuotationPdfJobPathDto extends QuotationPdfPathDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `renderJobId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extension-owner-values.dto.ts`

### `ExtensionValueInputDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `fieldKey` | `string` | `—` | `Matches(EXTENSION_FIELD_KEY)` |
| `value` | `unknown` | `—` | `Allow()` |

### `ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `extensionProfileVersionId` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) Matches(UUID_V7_PATTERN)` |
| `extensionValues` | `ExtensionValueInputDto[] (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsArray() ArrayMaxSize(100) ValidateNested({ each: true }) Type(() => ExtensionValueInputDto)` |

## `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts`

### `ExtensionFieldDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `fieldKey` | `string` | `—` | `Matches(FIELD_KEY)` |
| `valueKind` | `string` | `—` | `IsIn(["SCALAR", "OBJECT", "COLLECTION"])` |
| `scalarType` | `string (optional)` | `—` | `IsOptional() IsIn(["STRING", "BOOLEAN", "DECIMAL", "DATE", "UUID", "ENUM"])` |
| `schemaCode` | `string (optional)` | `—` | `IsOptional() Matches(SCHEMA_CODE)` |
| `schemaVersion` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1)` |
| `isRequired` | `inferred (optional)` | `false` | `IsOptional() IsBoolean()` |
| `isSearchable` | `inferred (optional)` | `false` | `IsOptional() IsBoolean()` |
| `visibilityCode` | `string` | `—` | `IsIn(["INTERNAL", "USER", "EXTERNAL_SAFE"])` |
| `maxLength` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1) Max(4096)` |
| `maxItems` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1) Max(100)` |
| `decimalScale` | `number (optional)` | `—` | `IsOptional() IsInt() Min(0) Max(8)` |
| `minimumDecimal` | `string (optional)` | `—` | `IsOptional() Matches(DECIMAL)` |
| `maximumDecimal` | `string (optional)` | `—` | `IsOptional() Matches(DECIMAL)` |
| `defaultStrategy` | `inferred (optional)` | `"NONE"` | `IsOptional() IsIn(["NONE", "LITERAL", "OWNER_DERIVED"])` |
| `defaultValue` | `unknown (optional)` | `—` | `IsOptional()` |
| `constraintPayload` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateExtensionProfileDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(CODE)` |
| `targetCode` | `string` | `—` | `IsIn(["CATALOG_ITEM", "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER"])` |
| `scopeTarget` | `string` | `—` | `IsIn(["TENANT", "COMPANY"])` |
| `fields` | `ExtensionFieldDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(100) ValidateNested({ each: true }) Type(() => ExtensionFieldDto)` |

### `UpdateExtensionProfileDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `fields` | `ExtensionFieldDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(100) ValidateNested({ each: true }) Type(() => ExtensionFieldDto)` |

### `ExtensionProfileListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `targetCode` | `string (optional)` | `—` | `IsOptional() IsIn(["CATALOG_ITEM", "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER"])` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["DRAFT", "ACTIVE", "RETIRED"])` |

### `ExtensionProfileVersionListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["DRAFT", "TESTED", "PUBLISHED", "SUPERSEDED", "RETIRED"])` |

### `ImportMappingFieldDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `sourceColumnCode` | `string` | `—` | `Matches(COLUMN_CODE)` |
| `sourceOrdinal` | `number` | `—` | `IsInt() Min(0) Max(999)` |
| `targetFieldCode` | `string` | `—` | `Matches(CODE)` |
| `transformCode` | `string` | `—` | `IsIn([ "IDENTITY", "TRIM", "PARSE_DECIMAL", "PARSE_DATE", "NORMALIZE_CODE", "ENUM_MAP", ])` |
| `lookupCode` | `string (optional)` | `—` | `IsOptional() Matches(CODE)` |
| `isRequired` | `inferred (optional)` | `false` | `IsOptional() IsBoolean()` |

### `CreateImportMappingDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(CODE)` |
| `targetCode` | `string` | `—` | `IsIn(["CATALOG_COMPANY_PROFILE", "CATALOG_BRANCH_ASSIGNMENT"])` |
| `scopeTarget` | `string` | `—` | `IsIn(["COMPANY", "BRANCH"])` |
| `branchId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `executionMode` | `inferred` | `"PER_ROW"` | `IsIn(["PER_ROW"])` |
| `fields` | `ImportMappingFieldDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(200) ValidateNested({ each: true }) Type(() => ImportMappingFieldDto)` |

### `UpdateImportMappingDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `executionMode` | `inferred` | `"PER_ROW"` | `IsIn(["PER_ROW"])` |
| `fields` | `ImportMappingFieldDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(200) ValidateNested({ each: true }) Type(() => ImportMappingFieldDto)` |

### `PreviewImportDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `mappingId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `sourceId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `predecessorRunId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

### `ImportMappingListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["DRAFT", "ACTIVE"])` |
| `targetCode` | `string (optional)` | `—` | `IsOptional() IsIn(["CATALOG_COMPANY_PROFILE", "CATALOG_BRANCH_ASSIGNMENT"])` |

### `ImportRunListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn([ "PENDING", "PREVIEWING", "PREVIEWED", "EXECUTING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", ])` |
| `mappingId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

### `ImportResultListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["VALID", "INVALID", "SUCCEEDED", "FAILED", "SKIPPED"])` |

### `WebhookEventDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `eventType` | `string` | `—` | `IsString() MaxLength(160)` |
| `eventVersion` | `number` | `—` | `IsInt() Min(1) Max(10)` |
| `fields` | `string[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(40) IsString({ each: true }) MaxLength(100, { each: true })` |

### `CreateWebhookSubscriptionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(CODE)` |
| `scopeTarget` | `string` | `—` | `IsIn(["TENANT", "COMPANY"])` |
| `endpointUri` | `string` | `—` | `IsString() MaxLength(2048)` |
| `retryPolicyCode` | `string` | `—` | `IsIn(["EXPONENTIAL_STANDARD", "EXPONENTIAL_CONSERVATIVE"])` |
| `maxAttempts` | `number` | `—` | `IsInt() Min(1) Max(10)` |
| `branchIds` | `string[] (optional)` | `[]` | `IsOptional() IsArray() ArrayMaxSize(100) Matches(UUID_V7_PATTERN, { each: true })` |
| `events` | `WebhookEventDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(30) ValidateNested({ each: true }) Type(() => WebhookEventDto)` |

### `UpdateWebhookSubscriptionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `endpointUri` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(2048)` |
| `retryPolicyCode` | `string (optional)` | `—` | `IsOptional() IsIn(["EXPONENTIAL_STANDARD", "EXPONENTIAL_CONSERVATIVE"])` |
| `maxAttempts` | `number (optional)` | `—` | `IsOptional() IsInt() Min(1) Max(10)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["ACTIVE", "DISABLED"])` |
| `branchIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMaxSize(100) Matches(UUID_V7_PATTERN, { each: true })` |
| `events` | `WebhookEventDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMinSize(1) ArrayMaxSize(30) ValidateNested({ each: true }) Type(() => WebhookEventDto)` |

### `RotateWebhookSecretDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `overlapHours` | `inferred (optional)` | `24` | `IsOptional() IsInt() Min(0) Max(168)` |

### `WebhookSubscriptionListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["DRAFT", "ACTIVE", "DISABLED"])` |

### `WebhookDeliveryListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn([ "PENDING", "RETRY_PENDING", "DELIVERED", "FAILED", "EXHAUSTED", "DISABLED", ])` |

### `RetryWebhookDeliveryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `Matches(SAFE_REASON_CODE)` |

## `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation/extensions-automation.controller.ts`

### `AutomationIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `ImportRunIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `runId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `ExtensionVersionParamDto extends AutomationIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `versionId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/financial-documents/dto/financial-documents.dto.ts`

### `FinancialTotalsDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `subtotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `roundingTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `grandTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountPaid` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountDue` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |

### `InvoiceLineInputDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `unitPrice` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `lineTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `priceSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |
| `taxSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |
| `description` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(500)` |

### `InvoiceDraftContentDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `dueDate` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `reference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `notes` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(8_000)` |
| `termsSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |
| `totalsSnapshot` | `FinancialTotalsDto` | `—` | `ValidateNested() Type(() => FinancialTotalsDto)` |
| `lines` | `InvoiceLineInputDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => InvoiceLineInputDto)` |

### `CreateInvoiceDto extends InvoiceDraftContentDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `partyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |

### `ContractClauseInputDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientClauseId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `title` | `string` | `—` | `IsString() MaxLength(500)` |
| `body` | `string` | `—` | `IsString() MaxLength(20_000)` |

### `ContractFinancialTermsDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `mode` | `"FINANCIAL" \| "NON_FINANCIAL"` | `—` | `IsIn(["FINANCIAL", "NON_FINANCIAL"])` |
| `sourceEvidence` | `Record<string, unknown>` | `—` | `IsObject()` |
| `totalsSnapshot` | `FinancialTotalsDto` | `—` | `ValidateNested() Type(() => FinancialTotalsDto)` |

### `ContractDraftContentDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `effectiveFrom` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `reference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `notes` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(8_000)` |
| `termsSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |
| `financialTerms` | `ContractFinancialTermsDto` | `—` | `ValidateNested() Type(() => ContractFinancialTermsDto)` |
| `clauses` | `ContractClauseInputDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(500) ValidateNested({ each: true }) Type(() => ContractClauseInputDto)` |

### `CreateContractDto extends ContractDraftContentDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `partyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/financial-documents/financial-documents.controller.ts`

### `FinancialDocumentIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/inventory/dto/inventory.dto.ts`

### `AvailabilityQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `nodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `lotKey` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `serialKey` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |

### `CreateNodeDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `IsString() MaxLength(80)` |
| `name` | `string` | `—` | `IsString() MaxLength(160)` |
| `nodeType` | `string` | `—` | `IsIn(["WAREHOUSE", "STORE", "VIRTUAL"])` |
| `timezone` | `string` | `—` | `IsString() MaxLength(64)` |
| `branchIds` | `string[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(100) Matches(UUID_V7_PATTERN, { each: true })` |

### `UpdateNodeDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `name` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(160)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["ACTIVE", "INACTIVE"])` |
| `timezone` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(64)` |
| `branchIds` | `string[] (optional)` | `—` | `IsOptional() IsArray() ArrayMinSize(1) ArrayMaxSize(100) Matches(UUID_V7_PATTERN, { each: true })` |

### `OpeningBalanceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `nodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL)` |
| `itemProfileVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `businessEffectiveAt` | `string` | `—` | `IsISO8601({ strict: true })` |
| `operationKey` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `tracking` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateReservationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `nodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL)` |
| `sourceDocumentVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `sourceLineVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `sourceDocumentId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `sourceLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `intentKey` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `expiresAt` | `string (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `tracking` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `ReleaseReservationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `quantity` | `string (optional)` | `—` | `IsOptional() Matches(POSITIVE_DECIMAL)` |
| `reasonCode` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

### `ReceiptLineDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `purchaseOrderLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `sourceLineVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL)` |
| `tracking` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateReceiptDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `nodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `purchaseOrderId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `operationKey` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `sourceDocumentVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `businessEffectiveAt` | `string` | `—` | `IsISO8601({ strict: true })` |
| `lines` | `ReceiptLineDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(500) ValidateNested({ each: true }) Type(() => ReceiptLineDto)` |

### `DeliveryLineDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `salesOrderLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `reservationId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `sourceLineVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL)` |
| `tracking` | `Record<string, unknown> (optional)` | `{}` | `IsOptional() IsObject()` |

### `CreateDeliveryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `nodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `salesOrderId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `operationKey` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `sourceDocumentVersion` | `number` | `—` | `Type(() => Number) IsInt() Min(1)` |
| `businessEffectiveAt` | `string` | `—` | `IsISO8601({ strict: true })` |
| `lines` | `DeliveryLineDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(500) ValidateNested({ each: true }) Type(() => DeliveryLineDto)` |

### `ReverseMovementLineDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `lineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL)` |

### `ReverseMovementDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `IsString() MaxLength(80)` |
| `businessEffectiveAt` | `string` | `—` | `IsISO8601({ strict: true })` |
| `lines` | `ReverseMovementLineDto[] (optional)` | `—` | `IsOptional() IsArray() ArrayMinSize(1) ArrayMaxSize(500) ValidateNested({ each: true }) Type(() => ReverseMovementLineDto)` |

### `InventoryPeriodListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `status` | `"OPEN" \| "CLOSED" (optional)` | `—` | `IsOptional() IsIn(["OPEN", "CLOSED"])` |
| `effectiveAt` | `string (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `CreateInventoryPeriodDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(INVENTORY_CODE)` |
| `startsOn` | `string` | `—` | `Matches(/^\d{4}-\d{2}-\d{2}$/)` |
| `endsOn` | `string` | `—` | `Matches(/^\d{4}-\d{2}-\d{2}$/)` |
| `maxBackdateDays` | `number` | `—` | `Type(() => Number) IsInt() Min(0) Max(366)` |

### `InventoryPeriodTransitionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `Matches(INVENTORY_CODE)` |

### `InventoryUomConversionListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `itemCompanyProfileId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `fromUomId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `toUomId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `status` | `"DRAFT" \| "PUBLISHED" \| "RETIRED" (optional)` | `—` | `IsOptional() IsIn(["DRAFT", "PUBLISHED", "RETIRED"])` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `CreateInventoryUomConversionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `itemCompanyProfileId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `fromUomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `toUomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `factorNumerator` | `string` | `—` | `Matches(POSITIVE_INTEGER_DECIMAL)` |
| `factorDenominator` | `string` | `—` | `Matches(POSITIVE_INTEGER_DECIMAL)` |
| `effectiveFrom` | `string` | `—` | `IsISO8601({ strict: true })` |

### `InventoryUomConversionActionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string` | `—` | `Matches(INVENTORY_CODE)` |

### `InventorySerialListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `itemId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `itemCompanyProfileId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `serialKey` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `state` | `"ON_HAND" \| "RESERVED" \| "DELIVERED" \| "VOIDED" (optional)` | `—` | `IsOptional() IsIn(["ON_HAND", "RESERVED", "DELIVERED", "VOIDED"])` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `InventoryDecisionListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `aggregateId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `policyKind` | `string (optional)` | `—` | `IsOptional() IsIn([ "INVENTORY_RESERVATION", "INVENTORY_NEGATIVE", "INVENTORY_OVER_RECEIPT", ])` |
| `limit` | `inferred (optional)` | `50` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |

### `InventoryExpiryScanOptionsDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `dryRun` | `boolean` | `—` | `IsBoolean()` |
| `maxReservations` | `number` | `—` | `Type(() => Number) IsInt() Min(1) Max(1_000)` |

## `../backend/mutakamel-apps/trade-app/src/modules/inventory/inventory.controller.ts`

### `InventoryIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/dto/policy-studio.dto.ts`

### `GovernanceListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `kind` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(40)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsIn(["ACTIVE", "INACTIVE"])` |

### `CreatePolicyDefinitionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(/^[A-Z][A-Z0-9_.-]{1,99}$/)` |
| `policyKind` | `string` | `—` | `IsIn([ "CREDIT", "PRICING_GUARD", "ORDER_CONFIRMATION", "PURCHASE_APPROVAL", "INVENTORY_NEGATIVE", "INVENTORY_RESERVATION", "INVENTORY_OVER_RECEIPT", ])` |
| `scopeTarget` | `TradeScopeTarget` | `—` | `IsEnum(TradeScopeTarget)` |

### `CreateWorkflowDefinitionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `Matches(/^[A-Z][A-Z0-9_.-]{1,99}$/)` |
| `workflowKind` | `string` | `—` | `IsIn([ "QUOTATION", "SALES_ORDER", "PURCHASE_ORDER", "PRICE_PUBLICATION", "CONFIGURATION_PUBLICATION", ])` |
| `scopeTarget` | `TradeScopeTarget` | `—` | `IsEnum(TradeScopeTarget)` |

### `CreateGovernedVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `content` | `Record<string, unknown>` | `—` | `IsObject()` |
| `testCases` | `unknown[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(100)` |
| `effectiveFrom` | `string` | `—` | `IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |

### `UpdateGovernedVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `content` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |
| `testCases` | `unknown[] (optional)` | `—` | `IsOptional() IsArray() ArrayMinSize(1) ArrayMaxSize(100)` |
| `effectiveFrom` | `string (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |

### `GovernanceActionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reason` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(240)` |
| `evidence` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |

### `DecisionProjectionQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reason` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

## `../backend/mutakamel-apps/trade-app/src/modules/policy-studio/policy-studio.controller.ts`

### `GovernanceIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/pricing/dto/pricing.dto.ts`

### `PriceBookListQueryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `page` | `inferred (optional)` | `1` | `IsOptional() Type(() => Number) IsInt() Min(1)` |
| `limit` | `inferred (optional)` | `25` | `IsOptional() Type(() => Number) IsInt() Min(1) Max(100)` |
| `purpose` | `PriceBookPurpose (optional)` | `—` | `IsOptional() IsEnum(PriceBookPurpose)` |
| `status` | `string (optional)` | `—` | `IsOptional() IsString()` |

### `CreatePriceBookDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `IsString() MaxLength(80)` |
| `purpose` | `PriceBookPurpose` | `—` | `IsEnum(PriceBookPurpose)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |

### `CompanyDefaultPriceBookPathDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `purpose` | `PriceBookPurpose` | `—` | `IsEnum(PriceBookPurpose)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |

### `UpsertCompanyDefaultPriceBookDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `priceBookId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

### `PriceEntryDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `minimumQuantity` | `string` | `—` | `Matches(DECIMAL_PATTERN)` |
| `maximumQuantity` | `\| string \| null (optional)` | `—` | `IsOptional() Matches(POSITIVE_DECIMAL_PATTERN)` |
| `unitPrice` | `string` | `—` | `Matches(DECIMAL_PATTERN)` |
| `minimumAllowedPrice` | `string \| null (optional)` | `—` | `IsOptional() Matches(DECIMAL_PATTERN)` |
| `priority` | `inferred (optional)` | `100` | `IsOptional() IsInt() Min(0) Max(10_000)` |

### `PromotionRuleDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `code` | `string` | `—` | `IsString() MaxLength(80) Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)` |
| `name` | `string` | `—` | `IsString() MaxLength(160)` |
| `itemId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `uomId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `branchId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `channelId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `partyId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `minimumQuantity` | `inferred (optional)` | `"0"` | `IsOptional() Matches(DECIMAL_PATTERN)` |
| `maximumQuantity` | `\| string \| null (optional)` | `—` | `IsOptional() Matches(POSITIVE_DECIMAL_PATTERN)` |
| `benefitType` | `PromotionBenefitType` | `—` | `IsEnum(PromotionBenefitType)` |
| `discountValue` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `priority` | `inferred (optional)` | `100` | `IsOptional() IsInt() Min(0) Max(10_000)` |
| `stackGroup` | `inferred (optional)` | `"DEFAULT"` | `IsOptional() IsString() MaxLength(80)` |
| `exclusive` | `inferred (optional)` | `false` | `IsOptional() IsBoolean()` |

### `CreatePriceBookVersionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `effectiveFrom` | `string` | `—` | `IsISO8601({ strict: true })` |
| `effectiveTo` | `string \| null (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `entries` | `PriceEntryDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(10_000) ValidateNested({ each: true }) Type(() => PriceEntryDto)` |
| `promotions` | `PromotionRuleDto[] (optional)` | `[]` | `IsOptional() IsArray() ArrayMaxSize(500) ValidateNested({ each: true }) Type(() => PromotionRuleDto)` |

### `PricingEvaluateDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `priceBookId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `purpose` | `PriceBookPurpose` | `—` | `IsEnum(PriceBookPurpose)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `partyId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing-read.controller.ts`

### `PriceBookVersionParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/pricing/pricing.controller.ts`

### `PricingIdParamDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/dto/purchase-quotation.dto.ts`

### `PurchaseQuotationLineDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `priceBookId` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) Matches(UUID_V7_PATTERN)` |

### `CreatePurchaseQuotationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `supplierPartyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(CURRENCY_PATTERN)` |
| `validUntil` | `string` | `—` | `IsISO8601({ strict: true })` |
| `reference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `notes` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(8_000)` |
| `terms` | `Record<string, unknown>` | `{}` | `IsObject()` |
| `lines` | `PurchaseQuotationLineDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => PurchaseQuotationLineDto)` |

### `UpdatePurchaseQuotationDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `supplierPartyId` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) Matches(CURRENCY_PATTERN)` |
| `validUntil` | `string (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsISO8601({ strict: true })` |
| `reference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(120)` |
| `notes` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(8_000)` |
| `terms` | `Record<string, unknown> (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsObject()` |
| `lines` | `PurchaseQuotationLineDto[] (optional)` | `—` | `ValidateIf((_object, value) => value !== undefined) IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => PurchaseQuotationLineDto)` |

## `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations/purchase-quotations.controller.ts`

### `PurchaseQuotationIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |

## `../backend/mutakamel-apps/trade-app/src/modules/purchasing/dto/purchasing.dto.ts`

### `PurchaseLineFinancialEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `lineTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxSnapshot` | `Record<string, unknown>` | `—` | `IsObject()` |

### `PurchaseOrderTotalsEvidenceDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `subtotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `discountTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `chargeTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `taxTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `roundingTotal` | `string` | `—` | `Matches(SIGNED_DECIMAL_PATTERN)` |
| `grandTotal` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountPaid` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |
| `amountDue` | `string` | `—` | `Matches(NON_NEGATIVE_DECIMAL_PATTERN)` |

### `PurchaseLineDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `clientLineId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `itemId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `uomId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `quantity` | `string` | `—` | `Matches(POSITIVE_DECIMAL_PATTERN)` |
| `priceBookId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `expectedDate` | `string (optional)` | `—` | `IsOptional() IsISO8601({ strict: true })` |
| `receivingNodeId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `financial` | `PurchaseLineFinancialEvidenceDto` | `—` | `ValidateNested() Type(() => PurchaseLineFinancialEvidenceDto)` |

### `CreatePurchaseOrderDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `supplierPartyId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `supplierAccountId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `currencyCode` | `string` | `—` | `Matches(/^[A-Z]{3}$/)` |
| `receivingNodeId` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
| `draftReference` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `lines` | `PurchaseLineDto[]` | `—` | `IsArray() ArrayMinSize(1) ArrayMaxSize(1_000) ValidateNested({ each: true }) Type(() => PurchaseLineDto)` |
| `totals` | `PurchaseOrderTotalsEvidenceDto` | `—` | `ValidateNested() Type(() => PurchaseOrderTotalsEvidenceDto)` |
| `terms` | `Record<string, unknown>` | `—` | `IsObject()` |

### `UpdatePurchaseOrderDto extends ExtensionOwnerValuesDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `receivingNodeId` | `string (optional)` | `—` | `IsOptional() Matches(UUID_V7_PATTERN)` |
| `draftReference` | `string \| null (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |

### `PurchaseActionDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `reasonCode` | `string (optional)` | `—` | `IsOptional() IsString() MaxLength(80)` |
| `evidence` | `Record<string, unknown> (optional)` | `—` | `IsOptional() IsObject()` |

## `../backend/mutakamel-apps/trade-app/src/modules/purchasing/purchasing.controller.ts`

### `PurchaseIdDto`

| Property | Type | Default | Transform/validators |
|---|---|---|---|
| `id` | `string` | `—` | `Matches(UUID_V7_PATTERN)` |
