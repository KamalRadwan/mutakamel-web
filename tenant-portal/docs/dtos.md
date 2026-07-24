# Tenant Portal Core Data Models (DTOs)

This document outlines the core Data Transfer Objects (DTOs) used across the Tenant, CRM, and Trade APIs. These structures govern the validation and shape of requests and responses.

## Tenant Module DTOs

### User & Organization DTOs
- `CreateTenantUserDto`: Captures email, `RoleType` assignments, and optional department links to invite a user into the workspace.
- `UpdateTenantUserDto`: Manages changes to language preferences, UI settings, and active status.
- `TeamMembershipDto`: Adds or removes a list of users to organizational branches or specific teams.
- `CreateCompanyBranchDto`: Defines the legal name, tax numbering schema, and localization for a new physical or logical branch.

### Templates DTOs
- `CreateTemplateDto`: Captures `TemplateLifecycleStatus` (DRAFT), the template subject, and raw HTML layout.
- `CreateTemplateVersionDto`: Triggers the publishing pipeline to transition a draft to `PUBLISHED` status.
- `TemplatePreviewDto`: Receives sample JSON data to merge against the active template version for rendering.

## CRM Module DTOs

### Lead DTOs
- `CreateLeadDto`: Captures `CrmProfileTypeEnum` (INDIVIDUAL/CORPORATE), contact fields (phones, emails), `LeadCompanyPartyParamDto` for existing linkages, and the assigned `stageId`.
- `MoveLeadStageDto`: Receives the target `stageId` to progress or disqualify a lead.
- `ConvertLeadDto`: Receives `LeadConversionContactPersonDto` to establish directory parties, and `ConvertLeadOpportunityDto` to open a new pipeline opportunity.

### Opportunity DTOs
- `CreateOpportunityDto`: Captures expected close date, probability scale (0-100), importance rank, and pipeline stage assignment.
- `MoveOpportunityStageDto`: Transitions the opportunity, deriving `IN_PROGRESS` or `WON` / `LOST` from semantic stage configurations.
- `TransferOpportunityPipelineDto`: Moves an opportunity across completely distinct pipelines, maintaining audit history.

## Trade Module DTOs

### Catalog DTOs
- `CreateItemDto`: Establishes the master catalog record, referencing base UOMs and barcode arrays.
- `UpsertItemCompanyProfileDto` & `UpsertItemBranchProfileDto`: Overrides base catalog descriptions, images, and active status per operating context.
- `ItemChannelListingDto`: Governs e-commerce or B2B portal visibility flags for items on specific distribution channels.

### Commercial Accounts DTOs
- `CreateCommercialAccountDto`: Captures credit limits, billing addresses, and primary contact relations.
- `CreditEvaluationDto`: Simulates a transaction sum against available account credit limits to prevent blocked sales.
- `AccountTransitionDto`: Manages the state machine transitions (e.g. `BLOCKED`, `ACTIVE`).

### Documents DTOs
- `CreateQuotationDto`: Constructs a draft sales quote including line items, discounts, and expiration rules.
- `CreateSalesOrderDto`: Creates an order (often from a converted quotation) capturing delivery dates and reservation demands.
- `ConfirmSalesOrderDto`: Triggers the async reservation engine to lock physical inventory for the order.

### Financial Documents DTOs
- `CreateInvoiceDto`: Creates a billing artifact from an order or lines.
- `CreateContractDto`: Establishes a legal B2B contract with dates and terms.

### Purchasing DTOs
- `CreatePurchaseOrderDto`: Drafts a procurement order directed at a vendor.
- `PurchaseActionDto`: Carries the execution payload for lifecycle shifts (Submit, Approve, Confirm).
- `CreatePurchaseQuotationDto`: Logs an RFQ draft.

### Control Tower & Policy Studio DTOs
- `CreatePolicyDefinitionDto`: Registers a new core business rule namespace.
- `RetryExceptionDto`: Carries a modified payload or directives to replay a failed automation block.
