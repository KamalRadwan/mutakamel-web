# DTO Field Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:dto`.
> Generator: `scripts/docs/generate-dto-reference.mjs`

Status: **verified** (parsed from controller DTO source)

Last source verification: **2026-09-05**

Classes: **46** · Fields: **295**

## How to read this

Every table is the exact request-body contract for one DTO, parsed from its
`class-validator` decorators.

Rules that apply to **every** DTO here:

- **`forbidNonWhitelisted: true`** — an undocumented key is a **422**, not a
  silent ignore. Send only fields listed below.
- **`stopAtFirstError: false`** — expect *multiple* field errors, and map all
  of them onto their `Field` components.
- Enum values are **case-sensitive**. See
  [enums.md](enums.md).
- `UUIDv7` means `@IsUUID('7')` — a v4 UUID is rejected. Never send a
  placeholder id.
- Decimal values are **strings**. Never `Number()` them.
- "Required" reflects the absence of `@IsOptional()`. A field can be required
  by the DTO and still be conditionally required by service logic — the API
  page notes those cases.

**This file lists request shapes only.** For routes, permissions, responses and
errors see the domain pages in [../api/README.md](../api/README.md).

## Leads

Source: `../backend/mutakamel-apps/crm-app/src/crm/leads/dto/lead.dto.ts`

### `LeadConversionContactMethodDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `methodType` | `PHONE` \| `MOBILE` \| `EMAIL` \| `WHATSAPP` \| `WEBSITE` \| `OTHER` | **yes** | — |
| `value` | string | **yes** | non-empty, max 255 |
| `label` | string | no | max 80 |

### `LeadConversionContactPersonDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `fullName` | string | no | non-empty, max 180 |
| `firstName` | string | no | max 80 |
| `lastName` | string | no | max 80 |
| `jobTitle` | string | no | max 120 |
| `email` | email | no | max 180 |
| `contactMethods` | array | no | max 20 items, nested, of `LeadConversionContactMethodDto` |

### `CreateLeadCorporateContactDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `contactPartyId` | UUIDv7 | no | — |
| `title` | string | no | max 40 |
| `honorificTitle` | string | no | max 40 |
| `jobTitle` | string | no | max 120 |
| `isPrimary` | boolean | no | transformed |
| `fullName` | string | no | non-empty, max 180 |
| `firstName` | string | no | max 80 |
| `lastName` | string | no | max 80 |
| `phone` | string | no | max 32 |
| `phones` | array | no | max 10 items, each item max 32 |
| `email` | email | no | max 180 |

### `CreateLeadPartyAddressDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `country` | string | no | max 120 |
| `city` | string | no | max 120 |
| `state` | string | no | max 120 |
| `street1` | string | no | max 160 |
| `street2` | string | no | max 80 |
| `area` | string | no | max 120 |
| `street` | string | no | max 160 |
| `buildingNo` | string | no | max 80 |
| `floor` | string | no | max 80 |
| `apartment` | string | no | max 80 |
| `landmark` | string | no | max 160 |
| `postalCode` | string | no | max 40 |

### `CreateLeadDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `leadProfileType` | enum CrmProfileTypeEnum | **yes** | — |
| `stageId` | UUIDv7 | no | — |
| `displayName` | string | no | non-empty, max 180 |
| `firstName` | string | no | max 80 |
| `lastName` | string | no | max 80 |
| `honorificTitle` | string | no | max 40 |
| `primaryMobile` | string | no | max 32 |
| `phones` | array | no | max 10 items, each item max 32 |
| `email` | email | no | max 180 |
| `companyName` | string | no | max 180 |
| `existingCompanyPartyId` | UUIDv7 | no | — |
| `legalName` | string | no | max 180 |
| `taxNumber` | string | no | max 64 |
| `commercialRegistrationNumber` | string | no | max 64 |
| `companyPhone` | string | no | max 32 |
| `companyPhones` | array | no | max 10 items, each item max 32 |
| `contacts` | array | no | max 20 items, nested, of `CreateLeadCorporateContactDto` |
| `address` | object | no | nested, of `CreateLeadPartyAddressDto` |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `description` | string | no | max 2000 |
| `interestSummary` | string | no | max 4000 |
| `expectedNeed` | string | no | max 4000 |
| `ownerUserId` | UUIDv7 | no | — |
| `customFields` | object | no | — |

### `UpdateLeadDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `displayName` | string | no | non-empty, max 180 |
| `firstName` | string | no | max 80 |
| `lastName` | string | no | max 80 |
| `honorificTitle` | string | no | max 40 |
| `primaryMobile` | string | no | max 32 |
| `phones` | array | no | max 10 items, each item max 32 |
| `email` | email | no | max 180 |
| `companyName` | string | no | max 180 |
| `companyPhones` | array | no | max 10 items, each item max 32 |
| `contacts` | array | no | max 20 items, nested, of `CreateLeadCorporateContactDto` |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `rating` | integer | no | >= CRM_LEAD_RATING_MIN, <= CRM_LEAD_RATING_MAX |
| `cardColor` | enum CrmLeadCardColorEnum | no | — |
| `description` | string | no | max 2000 |
| `interestSummary` | string | no | max 4000 |
| `expectedNeed` | string | no | max 4000 |
| `ownerUserId` | UUIDv7 | no | — |
| `customFields` | object | no | — |

### `MoveLeadStageDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `stageId` | UUIDv7 | **yes** | — |

### `LeadCompanyPartyParamDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `companyPartyId` | UUIDv7 | **yes** | — |

### `ConvertLeadOpportunityDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `pipelineId` | UUIDv7 | **yes** | — |
| `stageId` | UUIDv7 | **yes** | — |
| `title` | string | **yes** | non-empty, max 180 |
| `importance` | integer | no | >= 0, <= 3 |
| `amount` | number | no | >= 0 |
| `description` | string | no | max 2000 |
| `currencyCode` | string | no | length 3–3, transformed |
| `ownerUserId` | UUIDv7 | no | — |
| `expectedCloseDate` | ISO date string | no | — |
| `probabilityPercent` | integer | no | >= 0, <= 100 |
| `customFields` | object | no | — |

### `ConvertLeadDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `profileType` | enum CrmProfileTypeEnum | **yes** | — |
| `displayName` | string | no | non-empty, max 180 |
| `companyName` | string | no | non-empty, max 180 |
| `primaryContact` | LeadConversionContactPersonDto | no | nested, of `LeadConversionContactPersonDto` |
| `createOpportunity` | boolean | no | transformed |
| `opportunity` | ConvertLeadOpportunityDto | no | nested, of `ConvertLeadOpportunityDto` |

## Customer profiles

Source: `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts`

### `CustomerProfileContactMethodDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `methodType` | `PHONE` \| `MOBILE` \| `EMAIL` \| `WHATSAPP` \| `WEBSITE` \| `OTHER` | **yes** | — |
| `value` | string | **yes** | non-empty, max 255 |
| `label` | string | no | max 80 |

### `CustomerProfileContactPersonDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `contactPartyId` | UUIDv7 | no | — |
| `fullName` | string | no | non-empty, max 180 |
| `firstName` | string | no | max 80 |
| `lastName` | string | no | max 80 |
| `honorificTitle` | string | no | max 40 |
| `jobTitle` | string | no | max 120 |
| `isPrimary` | boolean | no | transformed |
| `email` | email | no | max 180 |
| `contactMethods` | array | no | max 20 items, nested, of `CustomerProfileContactMethodDto` |
| `phones` | array | no | max 10 items, each item max 32 |

### `CreateCustomerProfileDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `profileType` | enum CrmProfileTypeEnum | **yes** | — |
| `displayName` | string | no | non-empty, max 180 |
| `status` | enum CustomerStatusEnum | no | — |
| `ownerUserId` | UUIDv7 | no | — |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `companyName` | string | no | non-empty, max 180 |
| `taxCardNumber` | string | no | max 64 |
| `taxNumber` | string | no | max 64 |
| `commercialRegisterNumber` | string | no | max 64 |
| `commercialRegistrationNumber` | string | no | max 64 |
| `companyPhone` | string | no | non-empty, max 32 |
| `companyPhones` | array | no | max 10 items, each item max 32 |
| `companyEmail` | email | no | max 180 |
| `companyWebsite` | string | no | max 180 |
| `description` | string | no | max 2000 |
| `primaryContact` | CustomerProfileContactPersonDto | no | nested, of `CustomerProfileContactPersonDto` |
| `contacts` | array | no | max 20 items, nested, of `CustomerProfileContactPersonDto` |
| `customFields` | object | no | — |

### `UpdateCustomerProfileDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `displayName` | string | no | non-empty, max 180 |
| `status` | enum CustomerStatusEnum | no | — |
| `ownerUserId` | UUIDv7 | no | — |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `companyName` | string | no | non-empty, max 180 |
| `taxCardNumber` | string | no | max 64 |
| `taxNumber` | string | no | max 64 |
| `commercialRegisterNumber` | string | no | max 64 |
| `commercialRegistrationNumber` | string | no | max 64 |
| `companyPhone` | string | no | non-empty, max 32 |
| `companyPhones` | array | no | max 10 items, each item max 32 |
| `companyEmail` | email | no | max 180 |
| `companyWebsite` | string | no | max 180 |
| `description` | string | no | max 2000 |
| `primaryContact` | CustomerProfileContactPersonDto | no | nested, of `CustomerProfileContactPersonDto` |
| `contacts` | array | no | max 20 items, nested, of `CustomerProfileContactPersonDto` |
| `customFields` | object | no | — |

## Opportunities

Source: `../backend/mutakamel-apps/crm-app/src/crm/opportunities/dto/opportunity.dto.ts`

### `CreateOpportunityDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `customerProfileId` | UUIDv7 | **yes** | — |
| `leadId` | UUIDv7 | no | — |
| `contactPartyId` | UUIDv7 | no | — |
| `pipelineId` | UUIDv7 | **yes** | — |
| `stageId` | UUIDv7 | **yes** | — |
| `title` | string | **yes** | non-empty, max 180 |
| `importance` | integer | no | >= 0, <= 3 |
| `amount` | number | no | >= 0 |
| `description` | string | no | max 2000 |
| `currencyCode` | string | no | length 3–3, transformed |
| `ownerUserId` | UUIDv7 | no | — |
| `expectedCloseDate` | ISO date string | no | — |
| `probabilityPercent` | integer | no | >= 0, <= 100 |
| `customFields` | object | no | — |

### `UpdateOpportunityDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `title` | string | no | non-empty, max 180 |
| `importance` | integer | no | >= 0, <= 3 |
| `amount` | number | no | >= 0 |
| `description` | string | no | max 2000 |
| `currencyCode` | string | no | length 3–3, transformed |
| `ownerUserId` | UUIDv7 | no | — |
| `contactPartyId` | UUIDv7 | no | — |
| `expectedCloseDate` | ISO date string | no | — |
| `probabilityPercent` | integer | no | >= 0, <= 100 |
| `customFields` | object | no | — |

### `MoveOpportunityStageDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `stageId` | UUIDv7 | **yes** | — |
| `reason` | string | no | non-empty, max 1000 |
| `lostReason` | string | no | non-empty, max 1000 |

### `TransferOpportunityPipelineDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `pipelineId` | UUIDv7 | **yes** | — |
| `stageId` | UUIDv7 | no | — |
| `reason` | string | no | non-empty, max 1000 |
| `lostReason` | string | no | non-empty, max 1000 |

## Opportunity board

Source: `../backend/mutakamel-apps/crm-app/src/crm/opportunities/dto/opportunity-board.dto.ts`

### `OpportunityBoardParamsDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `pipelineId` | UUIDv7 | **yes** | — |

### `OpportunityBoardStageParamsDto` — extends `OpportunityBoardParamsDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `stageId` | UUIDv7 | **yes** | — |

### `OpportunityBoardFiltersDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `search` | string | no | max 200 |
| `status` | one of a fixed set | no | — |
| `ownerUserId` | UUIDv7 | no | — |
| `closing` | one of a fixed set | no | — |

### `OpportunityBoardQueryDto` — extends `OpportunityBoardFiltersDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `limitPerStage` | one of a fixed set | no | of `Number` |

### `OpportunityBoardStageQueryDto` — extends `OpportunityBoardFiltersDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `limit` | one of a fixed set | no | of `Number` |
| `cursor` | string | no | max 1024 |
| `activityState` | one of a fixed set | no | — |

### `OpportunityCardQueryDto` — extends `OpportunityBoardFiltersDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `stageId` | UUIDv7 | no | — |
| `limit` | one of a fixed set | no | of `Number` |
| `cursor` | string | no | max 1024 |

## Lead stages

Source: `../backend/mutakamel-apps/crm-app/src/crm/lead-stages/dto/lead-stage.dto.ts`

### `CreateLeadStageDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `nameAr` | string | **yes** | non-empty, max 80 |
| `nameEn` | string | **yes** | non-empty, max 80 |
| `flag` | enum LeadStageFlagEnum | **yes** | — |
| `category` | enum StageCategoryEnum | **yes** | — |
| `isDefault` | boolean | no | transformed |

### `UpdateLeadStageDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `nameAr` | string | no | non-empty, max 80 |
| `nameEn` | string | no | non-empty, max 80 |
| `flag` | enum LeadStageFlagEnum | no | — |
| `category` | enum StageCategoryEnum | no | — |
| `isActive` | boolean | no | transformed |

### `ReorderLeadStagesDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `orderedIds` | UUIDv7 | **yes** | max 500 items |

## Acquisition sources

Source: `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/dto/acquisition-source.dto.ts`

### `CreateAcquisitionSourceDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `nameAr` | string | **yes** | transformed, non-empty, max 120 |
| `nameEn` | string | **yes** | transformed, non-empty, max 120 |
| `isActive` | boolean | no | transformed |

### `UpdateAcquisitionSourceDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `nameAr` | string | no | transformed, non-empty, max 120 |
| `nameEn` | string | no | transformed, non-empty, max 120 |
| `isActive` | boolean | no | transformed |

### `ReorderAcquisitionSourcesDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `orderedIds` | UUIDv7 | **yes** | max 500 items |

### `ListAcquisitionSourcesQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `isActive` | boolean | no | transformed |

## Custom fields

Source: `../backend/mutakamel-apps/crm-app/src/crm/custom-fields/dto/custom-field.dto.ts`

### `CustomFieldOptionDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `key` | string | **yes** | non-empty, max 64 |
| `nameAr` | string | **yes** | non-empty, max 120 |
| `nameEn` | string | **yes** | non-empty, max 120 |
| `sortOrder` | integer | **yes** | >= 1 |
| `isActive` | boolean | **yes** | transformed |

### `CreateCustomFieldDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `ownerType` | one of a fixed set | no | — |
| `scope` | one of a fixed set | no | — |
| `fieldKey` | string | **yes** | non-empty, max 64 |
| `nameAr` | string | **yes** | non-empty, max 120 |
| `nameEn` | string | **yes** | non-empty, max 120 |
| `type` | enum CrmCustomFieldTypeEnum | **yes** | — |
| `placeholderAr` | string | no | max 180 |
| `placeholderEn` | string | no | max 180 |
| `options` | array | no | max 100 items, nested, of `CustomFieldOptionDto` |
| `isSearchable` | boolean | no | transformed |
| `sortOrder` | integer | no | >= 1 |

### `UpdateCustomFieldDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `fieldKey` | string | no | non-empty, max 64 |
| `nameAr` | string | no | non-empty, max 120 |
| `nameEn` | string | no | non-empty, max 120 |
| `placeholderAr` | string | no | max 180 |
| `placeholderEn` | string | no | max 180 |
| `options` | array | no | max 100 items, nested, of `CustomFieldOptionDto` |
| `isSearchable` | boolean | no | transformed |
| `isActive` | boolean | no | transformed |
| `sortOrder` | integer | no | >= 1 |

### `SetFieldRequirementDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `operation` | enum CrmFieldRequirementOperationEnum | **yes** | — |
| `entityScope` | one of a fixed set | no | — |
| `isRequired` | boolean | **yes** | transformed |

### `UpsertCustomFieldValueDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `fieldDefinitionId` | UUIDv7 | no | — |
| `fieldKey` | string | no | max 64 |
| `ownerType` | one of a fixed set | no | — |
| `entityType` | one of a fixed set | no | — |
| `ownerId` | UUIDv7 | no | — |
| `entityId` | UUIDv7 | no | — |
| `value` | unknown | no | — |
| `valueJson` | unknown | no | — |

### `CustomFieldValuesQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |
| `ownerType` | enum CrmCustomFieldOwnerTypeEnum | no | — |
| `entityType` | enum CrmCustomFieldOwnerTypeEnum | no | — |
| `ownerId` | UUIDv7 | no | — |
| `entityId` | UUIDv7 | no | — |

## CRM settings

Source: `../backend/mutakamel-apps/crm-app/src/crm/settings/dto/update-crm-settings.dto.ts`

### `AsteriskIntegrationSettingsDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `enabled` | boolean | no | transformed |
| `websocketUrl` | string | no | max 512 |
| `sipDomain` | string | no | max 180 |
| `realm` | string | no | max 180 |
| `outboundProxy` | string | no | max 512 |
| `defaultCallerId` | string | no | max 64 |
| `fromDomain` | string | no | max 180 |
| `registrarServer` | string | no | max 180 |
| `contactUri` | string | no | max 255 |
| `registerExpires` | integer | no | >= 60, <= 86400 |
| `sessionTimers` | boolean | no | transformed |
| `traceSip` | boolean | no | transformed |
| `allowInvalidTlsCertificate` | boolean | no | transformed |
| `stunServers` | array | no | max 16 items, each item max 512 |
| `turnServers` | array | no | max 16 items |
| `iceServers` | array | no | max 16 items |
| `extra` | object | no | — |

### `UpdateCrmSettingsDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `requireQualifiedStageForConversion` | boolean | no | transformed |
| `defaultLeadStageId` | UUIDv7 | no | — |
| `asteriskIntegration` | AsteriskIntegrationSettingsDto | no | nested, of `AsteriskIntegrationSettingsDto` |
| `outboundEmailContentRetentionDays` | integer | no | >= 30, <= 2555 |

## Shared list queries

Source: `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`

### `BranchListQueryDto` — extends `PaginationQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `branchId` | UUIDv7 | **yes** | — |

### `CustomerProfilesQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `profileType` | enum CrmProfileTypeEnum | no | — |
| `status` | enum CustomerStatusEnum | no | — |
| `ownerUserId` | UUIDv7 | no | — |

### `LeadsQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `acquisitionSourceId` | UUIDv7 | no | — |
| `leadProfileType` | enum CrmProfileTypeEnum | no | — |
| `status` | enum LeadStatusEnum | no | — |
| `stageFlag` | enum LeadStageFlagEnum | no | — |
| `stageId` | UUIDv7 | no | — |
| `ownerUserId` | UUIDv7 | no | — |

### `OpportunitiesQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `pipelineId` | UUIDv7 | no | — |
| `stageId` | UUIDv7 | no | — |
| `status` | enum OpportunityStatusEnum | no | — |
| `customerProfileId` | UUIDv7 | no | — |
| `ownerUserId` | UUIDv7 | no | — |
| `expectedCloseFrom` | ISO date string | no | — |
| `expectedCloseTo` | ISO date string | no | — |

### `ActivitiesQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `type` | enum CrmActivityTypeEnum | no | — |
| `sourceType` | `LEAD` \| `CUSTOMER_PROFILE` \| `PARTY` \| `OPPORTUNITY` | no | — |
| `sourceId` | UUIDv7 | no | — |
| `ownerUserId` | UUIDv7 | no | — |

### `TasksQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `status` | enum CrmTaskStatusEnum | no | — |

### `RemindersQueryDto` — extends `BranchListQueryDto`

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `status` | enum CrmReminderStatusEnum | no | — |
