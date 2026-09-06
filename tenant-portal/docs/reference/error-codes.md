# Error Code Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:errors`.
> Generator: `scripts/docs/generate-error-reference.mjs`

Status: **verified** (parsed from `throw new *Exception` sites)

Last source verification: **2026-09-05**

Codes: **313** across **36** areas

## Scope

These are the error codes the **built screens** can receive. The backend
defines many more, belonging to features with no portal screen; listing those
would produce documentation that rots before anyone reads it.

Add an area to `SCOPES` in the generator when a new screen ships.

## How to use this

- **Branch on the code, never on the message.** Messages are localized by
  request language and are not a stable contract. See
  [errors.md](errors.md).
- **An unknown code is not a crash.** Fall back to a generic message keyed by
  HTTP status. A backend adding a code must never break a screen.
- Every code the UI handles specifically needs a `t.errors.*` entry in **both**
  dictionaries. Codes with no entry fall back to the status-level message.
- A code appearing with **two statuses** is thrown from more than one site with
  different semantics — read the service before treating it as one condition.

## Leads

Source: `../backend/mutakamel-apps/crm-app/src/crm/leads` · 17 codes

| Error code | HTTP |
| --- | --- |
| `CUSTOM_FIELD_LIMIT_EXCEEDED` | 422 |
| `LEAD_ALREADY_CONVERTED` | 409 |
| `LEAD_COMPANY_NAME_REQUIRED` | 422 |
| `LEAD_CONTACT_NAME_REQUIRED` | 422 |
| `LEAD_CONTACT_PRIMARY_INVALID` | 422 |
| `LEAD_CONTACT_REQUIRED` | 422 |
| `LEAD_CONVERSION_INVALID` | 422 |
| `LEAD_CONVERSION_OPPORTUNITY_REQUIRED` | 422 |
| `LEAD_CONVERSION_OPPORTUNITY_STAGE_TERMINAL` | 422 |
| `LEAD_CONVERSION_OPPORTUNITY_UNEXPECTED` | 422 |
| `LEAD_CONVERSION_REQUIRED` | 422 |
| `LEAD_CORPORATE_FIELDS_FORBIDDEN` | 422 |
| `LEAD_DISPLAY_NAME_REQUIRED` | 422 |
| `LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN` | 422 |
| `LEAD_EXISTING_COMPANY_INVALID` | 422 |
| `LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH` | 403 |
| `PARTY_DUPLICATE_CONTACT_METHOD` | 422 |

## Customer profiles

Source: `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles` · 9 codes

| Error code | HTTP |
| --- | --- |
| `CUSTOMER_PROFILE_CONTACT_INVALID` | 422 |
| `CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED` | 422 |
| `CUSTOMER_PROFILE_CONTACT_OUTSIDE_BRANCH` | 403 |
| `CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID` | 422 |
| `CUSTOMER_PROFILE_CONTACTS_CORPORATE_ONLY` | 422 |
| `CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN` | 422 |
| `CUSTOMER_PROFILE_DISPLAY_NAME_REQUIRED` | 422 |
| `CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES` | 409 |
| `PARTY_DUPLICATE_CONTACT_METHOD` | 422 |

## Opportunities & pipelines

Source: `../backend/mutakamel-apps/crm-app/src/crm/opportunities` · 8 codes

| Error code | HTTP |
| --- | --- |
| `CRM_BRANCH_MISMATCH` | 422 |
| `CUSTOMER_PROFILE_BLACKLISTED` | 409 |
| `OPPORTUNITY_BOARD_CURSOR_INVALID` | 400 |
| `OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH` | 422 |
| `OPPORTUNITY_LEAD_CUSTOMER_MISMATCH` | 422 |
| `OPPORTUNITY_LOST_REASON_REQUIRED` | 422 |
| `OPPORTUNITY_PIPELINE_UNCHANGED` | 422 |
| `PARTY_NOT_FOUND` | 404 |

## Pipelines

Source: `../backend/mutakamel-apps/crm-app/src/crm/pipelines` · 27 codes

| Error code | HTTP |
| --- | --- |
| `CRM_MODULE_SEAT_REQUIRED` | 403 |
| `OPPORTUNITY_STAGE_CATEGORY_INVALID` | 422 |
| `OPPORTUNITY_STAGE_IN_USE` | 409 |
| `OPPORTUNITY_STAGE_NOT_FOUND` | 404 |
| `PIPELINE_ASSIGNMENT_TEAMS_INVALID` | 422 |
| `PIPELINE_ASSIGNMENT_USERS_INVALID` | 422 |
| `PIPELINE_ASSIGNMENTS_INVALID` | 422 |
| `PIPELINE_CATALOG_LIMIT_EXCEEDED` | 422 |
| `PIPELINE_CODE_TAKEN` | 409 |
| `PIPELINE_DEFAULT_DEACTIVATE` | 422 |
| `PIPELINE_DEFAULT_DELETE` | 422 |
| `PIPELINE_DEFAULT_INACTIVE` | 422 |
| `PIPELINE_DEFAULT_MISSING` | 409 |
| `PIPELINE_DEFAULT_RESTRICTED` | 422 |
| `PIPELINE_IN_USE` | 409 |
| `PIPELINE_NOT_FOUND` | 404 |
| `PIPELINE_RESET_BLOCKED` | 409 |
| `PIPELINE_RESET_CATALOG_MISSING` | 409 |
| `PIPELINE_RESET_DEFAULT_ONLY` | 422 |
| `PIPELINE_STAGE_ALREADY_ASSIGNED` | 409 |
| `PIPELINE_STAGE_IN_USE` | 409 |
| `PIPELINE_STAGE_LIMIT` | 422 |
| `PIPELINE_STAGE_REORDER_INVALID` | 422 |
| `PIPELINE_STAGE_REQUIRED` | 422 |
| `PIPELINE_STAGE_SELECTION_INVALID` | 422 |
| `PIPELINE_STAGE_SEMANTIC_DUPLICATE` | 422 |
| `PIPELINE_STAGES_REQUIRED` | 422 |

## Lead stages

Source: `../backend/mutakamel-apps/crm-app/src/crm/lead-stages` · 6 codes

| Error code | HTTP |
| --- | --- |
| `LEAD_STAGE_CATEGORY_INVALID` | 422 |
| `LEAD_STAGE_DEFAULT_CONVERTED` | 422 |
| `LEAD_STAGE_DEFAULT_DEACTIVATE` | 422 |
| `LEAD_STAGE_DEFAULT_DELETE` | 422 |
| `LEAD_STAGE_DEFAULT_INACTIVE` | 422 |
| `LEAD_STAGE_REORDER_INVALID` | 422 |

## Acquisition sources

Source: `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources` · 9 codes

| Error code | HTTP |
| --- | --- |
| `CRM_ACQUISITION_SOURCE_ICON_CONTENT_INVALID` | 415 |
| `CRM_ACQUISITION_SOURCE_ICON_EMPTY` | 400 |
| `CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED` | 415 |
| `CRM_ACQUISITION_SOURCE_ICON_REQUIRED` | 400 |
| `CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE` | 413 |
| `CRM_ACQUISITION_SOURCE_ICON_TYPE_UNSUPPORTED` | 415 |
| `CRM_ACQUISITION_SOURCE_IN_USE` | 409 |
| `CRM_ACQUISITION_SOURCE_INACTIVE` | 422 |
| `CRM_ACQUISITION_SOURCE_REORDER_INVALID` | 422 |

## Custom fields

Source: `../backend/mutakamel-apps/crm-app/src/crm/custom-fields` · 14 codes

| Error code | HTTP |
| --- | --- |
| `CUSTOM_FIELD_INACTIVE` | 422 |
| `CUSTOM_FIELD_INVALID_OWNER_TYPE` | 422 |
| `CUSTOM_FIELD_KEY_AMBIGUOUS` | 422 |
| `CUSTOM_FIELD_KEY_INVALID` | 422 |
| `CUSTOM_FIELD_NOT_FOUND` | 404 |
| `CUSTOM_FIELD_OPTIONS_INVALID` | 422 |
| `CUSTOM_FIELD_OPTIONS_REQUIRED` | 422 |
| `CUSTOM_FIELD_OWNER_BRANCH_MISMATCH` | 422 |
| `CUSTOM_FIELD_OWNER_ID_REQUIRED` | 422 |
| `CUSTOM_FIELD_OWNER_NOT_FOUND` | 404 |
| `CUSTOM_FIELD_OWNER_TYPE_REQUIRED` | 422 |
| `CUSTOM_FIELD_REFERENCE_REQUIRED` | 422 |
| `CUSTOM_FIELD_VALUE_INVALID` | 422 |
| `CUSTOM_FIELD_VALUE_REQUIRED` | 422 |

## CRM activities

Source: `../backend/mutakamel-apps/crm-app/src/crm/activities` · 4 codes

| Error code | HTTP |
| --- | --- |
| `CRM_EVENT_TIME_INVALID` | 422 |
| `CRM_REMINDER_TIME_INVALID` | 422 |
| `CRM_SOURCE_BRANCH_MISMATCH` | 422 |
| `CRM_SOURCE_INVALID` | 422 |

## CRM notes & attachments

Source: `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments` · 7 codes

| Error code | HTTP |
| --- | --- |
| `CRM_ATTACHMENT_FILE_EMPTY` | 400 |
| `CRM_ATTACHMENT_FILE_REQUIRED` | 400 |
| `CRM_ATTACHMENT_FILE_TOO_LARGE` | 413 |
| `CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED` | 415 |
| `CRM_ATTACHMENT_INVALID` | 422 |
| `CRM_ATTACHMENT_UPLOAD_COMMAND_REQUIRED` | 422 |
| `CRM_SOURCE_BRANCH_MISMATCH` | 422 |

## CRM outbound email

Source: `../backend/mutakamel-apps/crm-app/src/crm/outbound-emails` · 1 codes

| Error code | HTTP |
| --- | --- |
| `CRM_VALIDATION_FAILED` | 400 |

## CRM dashboards

Source: `../backend/mutakamel-apps/crm-app/src/crm/dashboards` · 33 codes

| Error code | HTTP |
| --- | --- |
| `CRM_DASHBOARD_ACTOR_INVALID` | 401 |
| `CRM_DASHBOARD_CURRENCY_FILTER_REQUIRED` | 422 |
| `CRM_DASHBOARD_DATE_RANGE_EXCEEDED` | 422 |
| `CRM_DASHBOARD_DEFINITION_ACCESS_DENIED` | 403 |
| `CRM_DASHBOARD_DRILLDOWN_CURRENCY_REQUIRED` | 422 |
| `CRM_DASHBOARD_DRILLDOWN_CURSOR_INVALID` | 400 |
| `CRM_DASHBOARD_DRILLDOWN_DATE_RANGE_INVALID` | 422 |
| `CRM_DASHBOARD_DRILLDOWN_RESULT_INVALID` | 500 |
| `CRM_DASHBOARD_DRILLDOWN_WIDGET_NOT_FOUND` | 404 |
| `CRM_DASHBOARD_FILTER_INVALID` | 422 |
| `CRM_DASHBOARD_LAYOUT_OVERLAP` | 409 |
| `CRM_DASHBOARD_LAYOUT_STALE` | 409 |
| `CRM_DASHBOARD_NAME_CONFLICT` | 409 |
| `CRM_DASHBOARD_NOT_FOUND` | 404 |
| `CRM_DASHBOARD_PLACEMENT_NOT_FOUND` | 404 |
| `CRM_DASHBOARD_RESOURCE_NOT_FOUND` | 404 |
| `CRM_DASHBOARD_REVISION_UPDATE_FAILED` | 500 |
| `CRM_DASHBOARD_TEMPLATE_BATCH_INSERT_FAILED` | 500 |
| `CRM_DASHBOARD_WIDGET_ALREADY_ADDED` | 409 |
| `CRM_DASHBOARD_WIDGET_LIMIT` | 409 |
| `CRM_DASHBOARD_WIDGET_LIMIT_EXCEEDED` | 422 |
| `CRM_DASHBOARD_WIDGET_SELECTION_INVALID` | 422 |
| `CRM_SHARE_EXPIRY_INVALID` | 422 |
| `CRM_SHARE_NOT_FOUND` | 404 |
| `CRM_SHARE_SELF_INVALID` | 422 |
| `CRM_SHARE_TARGET_INVALID` | 422 |
| `CRM_WIDGET_METRIC_INVALID` | 422 |
| `CRM_WIDGET_NOT_FOUND` | 404 |
| `CRM_WIDGET_QUERY_INVALID` | 422 |
| `CRM_WIDGET_REVISION_CONFLICT` | 409 |
| `CRM_WIDGET_SERIES_INVALID` | 422 |
| `CRM_WIDGET_SHAPE_INCOMPATIBLE` | 422 |
| `PIPELINE_NOT_FOUND` | 404 |

## Authentication & session

Source: `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth` · 7 codes

| Error code | HTTP |
| --- | --- |
| `ACCOUNT_NOT_ACTIVE` | 403 |
| `AUTH_SESSION_LIMIT_REACHED` | 409 |
| `INVALID_ACTION_TOKEN` | 400 |
| `INVALID_CREDENTIALS` | 401 |
| `INVALID_REFRESH_TOKEN` | 401 |
| `SUBSCRIPTION_PAST_DUE` | 403 |
| `TENANT_NOT_RESOLVABLE` | 404 |

## Organization

Source: `../backend/mutakamel-apps/core-app/src/tenant/organization` · 6 codes

| Error code | HTTP |
| --- | --- |
| `CURRENCY_NOT_ENABLED` | 422 |
| `ORG_HQ_EXISTS` | 409 |
| `ORG_LEAD_USER_NOT_FOUND` | 404 |
| `ORG_PARENT_INACTIVE` | 409 |
| `ORG_TREE_TOO_LARGE` | 422 |
| `PERMISSION_SCOPE_AUTHORITY_INCONSISTENT` | 422 |

## Users

Source: `../backend/mutakamel-apps/core-app/src/tenant/tenant-users` · 15 codes

| Error code | HTTP |
| --- | --- |
| `ACCESS_POLICY_UNAVAILABLE` | 503 |
| `BRANCH_ACCESS_DENIED` | 403 |
| `INVALID_STATUS_TRANSITION` | 409 |
| `MANAGER_NOT_FOUND` | 404 |
| `PRIMARY_TEAM_MEMBERSHIP_PROTECTED` | 409 |
| `PROFILE_EXTENSIONS_TOO_LARGE` | 422 |
| `TEAM_MEMBERSHIP_ALREADY_EXISTS` | 409 |
| `TEAM_MEMBERSHIP_LIMIT_EXCEEDED` | 422 |
| `TEAM_MEMBERSHIP_NOT_FOUND` | 404 |
| `TEAM_MEMBERSHIP_PRIMARY_CONFLICT` | 422 |
| `TENANT_OWNER_PROTECTED` | 409 |
| `TENANT_USER_NOT_FOUND` | 404 |
| `TENANT_USER_TEAM_QUERY_INVALID` | 422 |
| `USER_LIMIT_REACHED` | 403 |
| `USER_SELF_FORBIDDEN` | 403 |

## Roles

Source: `../backend/mutakamel-apps/core-app/src/tenant/tenant-roles` · 14 codes

| Error code | HTTP |
| --- | --- |
| `ACTOR_NOT_FOUND` | 403 |
| `ASSIGNMENT_EXISTS` | 409 |
| `ASSIGNMENT_NOT_FOUND` | 404 |
| `BRANCH_ACCESS_DENIED` | 403 |
| `BRANCH_OR_ROLE_INVALID` | 422 |
| `PERMISSION_UNKNOWN` | 422 |
| `ROLE_IN_USE` | 409 |
| `ROLE_NOT_FOUND` | 404 |
| `ROLE_PERMISSION_AUTHORITY_EXCEEDED` | 422 |
| `ROLE_SELF_ASSIGNMENT_FORBIDDEN` | 403 |
| `TENANT_OWNER_PROTECTED` | 409 |
| `TENANT_ROLE_ASSIGNMENT_LIMIT_EXCEEDED` | 409, 422 |
| `TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED` | 409 |
| `TENANT_USER_NOT_FOUND` | 404 |

## Scope role assignments

Source: `../backend/mutakamel-apps/core-app/src/tenant/scope-role-assignments` · 4 codes

| Error code | HTTP |
| --- | --- |
| `SCOPE_ROLE_ASSIGNMENT_INVALID` | 422 |
| `SCOPE_ROLE_ASSIGNMENT_LIMIT_EXCEEDED` | 422 |
| `SCOPE_ROLE_ASSIGNMENT_OWNER_REQUIRED` | 403 |
| `TENANT_USER_NOT_FOUND` | 404 |

## User modules

Source: `../backend/mutakamel-apps/core-app/src/tenant/user-modules` · 8 codes

| Error code | HTTP |
| --- | --- |
| `ASSIGNMENT_NOT_FOUND` | 404 |
| `MODULE_NOT_FOUND` | 422 |
| `MODULE_NOT_SUBSCRIBED` | 422 |
| `SEAT_LIMIT_REACHED` | 422 |
| `SUBSCRIPTION_NOT_FOUND` | 404 |
| `TENANT_CONTEXT_MISSING` | 401 |
| `TENANT_PERMISSION_SCOPE_UNAVAILABLE` | 403 |
| `TENANT_USER_NOT_FOUND` | 404 |

## Workspace settings

Source: `../backend/mutakamel-apps/core-app/src/tenant/workspace-settings` · 4 codes

| Error code | HTTP |
| --- | --- |
| `CURRENCY_NOT_ENABLED` | 422 |
| `LANGUAGE_INVALID` | 422 |
| `TENANT_NOT_READY` | 503 |
| `TIMEZONE_INVALID` | 422 |

## Currencies

Source: `../backend/mutakamel-apps/core-app/src/tenant/currencies` · 6 codes

| Error code | HTTP |
| --- | --- |
| `CURRENCY_CODE_INVALID` | 422 |
| `CURRENCY_DEFAULT_DELETE` | 409 |
| `CURRENCY_EXCHANGE_RATE_REQUIRED` | 422 |
| `CURRENCY_IN_USE` | 409 |
| `CURRENCY_INACTIVE_DEFAULT` | 409 |
| `CURRENCY_NOT_FOUND` | 404 |

## Taxes

Source: `../backend/mutakamel-apps/core-app/src/tenant/taxes` · 3 codes

| Error code | HTTP |
| --- | --- |
| `COMPANY_INVALID` | 422 |
| `PERMISSION_SCOPE_UNAVAILABLE` | 403 |
| `TAX_NOT_FOUND` | 404 |

## Numbering sequences

Source: `../backend/mutakamel-apps/core-app/src/tenant/numbering-sequences` · 5 codes

| Error code | HTTP |
| --- | --- |
| `COMPANY_INVALID` | 422 |
| `PERMISSION_SCOPE_UNAVAILABLE` | 403 |
| `SEQUENCE_NOT_FOUND` | 404 |
| `SEQUENCE_TRANSACTION_REQUIRED` | 500 |
| `SEQUENCE_VALUE_INVALID` | 422 |

## Email configuration

Source: `../backend/mutakamel-apps/core-app/src/tenant/email-config` · 9 codes

| Error code | HTTP |
| --- | --- |
| `TENANT_EMAIL_CONFIG_EMPTY_PATCH` | 400 |
| `TENANT_EMAIL_CONFIG_INVALID` | 422 |
| `TENANT_EMAIL_CONFIG_NO_CHANGES` | 422 |
| `TENANT_EMAIL_CONFIG_QUOTA_EXCEEDS_PLAN` | 422 |
| `TENANT_EMAIL_CONFIG_SECRET_REF_INVALID` | 422 |
| `TENANT_EMAIL_CONFIG_STALE_REVISION` | 409 |
| `TENANT_EMAIL_CONFIG_VERIFICATION_FAILED` | 422 |
| `TENANT_EMAIL_CONFIG_VERIFY_BODY_FORBIDDEN` | 400 |
| `TENANT_SMTP_CONNECTION_VERIFICATION_UNAVAILABLE` | 422 |

## Billing

Source: `../backend/mutakamel-apps/core-app/src/tenant/billing` · 2 codes

| Error code | HTTP |
| --- | --- |
| `SUBSCRIPTION_NOT_FOUND` | 404 |
| `TENANT_CONTEXT_MISSING` | 401 |

## Subscription

Source: `../backend/mutakamel-apps/core-app/src/tenant/subscription` · 1 codes

| Error code | HTTP |
| --- | --- |
| `TENANT_CONTEXT_MISSING` | 401 |

## Payments

Source: `../backend/mutakamel-apps/core-app/src/tenant/payments` · 47 codes

| Error code | HTTP |
| --- | --- |
| `CURRENCY_CODE_INVALID` | 422 |
| `IDEMPOTENCY_KEY_REQUIRED` | 422 |
| `IDEMPOTENCY_KEY_REUSED` | 409 |
| `INVOICE_ACCOUNTING_INCONSISTENT` | 409 |
| `INVOICE_NOT_CANONICAL_USD` | 409 |
| `INVOICE_NOT_PAYABLE` | 409 |
| `OFFLINE_PAYMENT_EXCEEDS_OUTSTANDING` | 422 |
| `OFFLINE_PAYMENT_REFERENCE_TAKEN` | 409 |
| `PAYMENT_COLLECTION_RECONCILIATION_HOLD` | 409 |
| `PAYMENT_INTENT_ALREADY_ACTIVE` | 409 |
| `PAYMENT_INVOICE_REQUIRED` | 409 |
| `PAYMENT_NOT_FOUND` | 404 |
| `PAYMENT_NOT_SETTLEABLE` | 409 |
| `PAYMENT_PROVIDER_AMOUNT_INVALID` | 400 |
| `PAYMENT_PROVIDER_CURRENCY_INVALID` | 400 |
| `PAYMENT_PROVIDER_CURRENCY_UNSUPPORTED` | 422 |
| `PAYMENT_PROVIDER_ERROR` | 503 |
| `PAYMENT_PROVIDER_REFUND_AMOUNT_INVALID` | 400 |
| `PAYMENT_PROVIDER_REFUND_REFERENCE_REQUIRED` | 400 |
| `PAYMENT_PROVIDER_REQUEST_INVALID` | 400 |
| `PAYMENT_PROVIDER_SUCCESS_EVIDENCE_MISSING` | 409 |
| `PAYMENT_PROVIDER_TRANSACTION_REF_INVALID` | 400 |
| `PAYMENT_PROVIDER_TRANSACTION_REF_REQUIRED` | 400 |
| `PAYMENT_PROVIDER_UNCONFIGURED` | 503 |
| `PAYMENT_PURPOSE_MISMATCH` | 409 |
| `PAYMENT_QUOTE_INVOICE_MISMATCH` | 409 |
| `PAYMENT_QUOTE_METADATA_INVALID` | 409 |
| `PAYMENT_QUOTE_STALE` | 409 |
| `PAYMENT_RECONCILIATION_CHECKER_REQUIRED` | 409 |
| `PAYMENT_REFUND_ALLOCATION_MISMATCH` | 409 |
| `PAYMENT_REFUND_ALREADY_REQUESTED` | 409 |
| `PAYMENT_REFUND_EVIDENCE_MISSING` | 409 |
| `PAYMENT_REFUND_PROVIDER_EVIDENCE_INVALID` | 409 |
| `PAYMENT_REFUND_PROVIDER_OUTCOME_MISMATCH` | 409 |
| `PAYMENT_REFUND_PROVIDER_REFERENCE_MISSING` | 409 |
| `PAYMENT_REFUND_RECONCILIATION_REQUIRED` | 409 |
| `PAYMENT_REFUND_RESERVATION_MISSING` | 409 |
| `PAYMENT_REFUND_WALLET_INSUFFICIENT` | 422 |
| `PAYMENT_REFUND_WALLET_INVALID` | 409 |
| `PAYMENT_SETTLEMENT_AMOUNT_INVALID` | 409 |
| `SUBSCRIPTION_NOT_FOUND` | 404 |
| `TENANT_CONTEXT_MISSING` | 401 |
| `TOPUP_AMOUNT_OUT_OF_RANGE` | 422 |
| `TOPUP_LIMITS_INVALID` | 503 |
| `WEBHOOK_HMAC_INVALID` | 401 |
| `WEBHOOK_INVALID` | 401 |
| `WEBHOOK_STATE_INVALID` | 401 |

## Branding

Source: `../backend/mutakamel-apps/core-app/src/tenant/branding` · 6 codes

| Error code | HTTP |
| --- | --- |
| `BRANDING_ASSET_NOT_FOUND` | 404 |
| `BRANDING_FILE_REQUIRED` | 400 |
| `BRANDING_FILE_TOO_LARGE` | 413 |
| `BRANDING_FILE_TYPE_UNSUPPORTED` | 415 |
| `BRANDING_STORAGE_UNAVAILABLE` | 503 |
| `TENANT_NOT_RESOLVABLE` | 404 |

## Directory

Source: `../backend/mutakamel-apps/core-app/src/tenant/directory` · 18 codes

| Error code | HTTP |
| --- | --- |
| `BRANCH_PERMISSION_DENIED` | 403 |
| `DIRECTORY_PARTY_CHILD_AUTHORITY_EXCEEDED` | 422 |
| `PARTY_ADDRESS_LIMIT_EXCEEDED` | 422 |
| `PARTY_ADDRESS_NOT_FOUND` | 404 |
| `PARTY_CHILD_BATCH_INVALID` | 422 |
| `PARTY_CONTACT_METHOD_LIMIT_EXCEEDED` | 422 |
| `PARTY_CONTACT_METHOD_NOT_FOUND` | 404 |
| `PARTY_IMAGE_INVALID` | 415 |
| `PARTY_IMAGE_REQUIRED` | 400 |
| `PARTY_IMAGE_STORAGE_UNAVAILABLE` | 503 |
| `PARTY_IMAGE_TOO_LARGE` | 413 |
| `PARTY_NOT_FOUND` | 404 |
| `PARTY_RELATIONSHIP_INVALID` | 409, 422 |
| `PARTY_RELATIONSHIP_NOT_FOUND` | 404 |
| `PARTY_ROLE_ALREADY_EXISTS` | 409 |
| `PARTY_ROLE_LIMIT_EXCEEDED` | 422 |
| `PARTY_ROLE_NOT_FOUND` | 404 |
| `PERMISSION_SCOPE_UNAVAILABLE` | 403 |

## Templates

Source: `../backend/mutakamel-apps/core-app/src/tenant/template-platform` · 1 codes

| Error code | HTTP |
| --- | --- |
| `TENANT_NOT_RESOLVABLE` | 404 |

## Core activities

Source: `../backend/mutakamel-apps/core-app/src/tenant/activities` · 4 codes

| Error code | HTTP |
| --- | --- |
| `ACCESS_POLICY_UNAVAILABLE` | 503 |
| `ACTIVITY_IDEMPOTENCY_IN_FLIGHT` | 409 |
| `ACTIVITY_IDEMPOTENCY_KEY_INVALID` | 422 |
| `ACTIVITY_IDEMPOTENCY_MISMATCH` | 422 |

## Trade documents

Source: `../backend/mutakamel-apps/trade-app/src/modules/documents` · 2 codes

| Error code | HTTP |
| --- | --- |
| `CONFIRMATION_MODE_INVALID` | 503 |
| `NUMERIC_FACT_OUT_OF_RANGE` | 503 |

## Trade financial documents

Source: `../backend/mutakamel-apps/trade-app/src/modules/financial-documents` · 1 codes

| Error code | HTTP |
| --- | --- |
| `INVOICE` | 409 |

## Trade purchasing

Source: `../backend/mutakamel-apps/trade-app/src/modules/purchasing` · 1 codes

| Error code | HTTP |
| --- | --- |
| `NUMERIC_FACT_OUT_OF_RANGE` | 503 |

## Trade purchase quotations

Source: `../backend/mutakamel-apps/trade-app/src/modules/purchase-quotations` · 1 codes

| Error code | HTTP |
| --- | --- |
| `PURCHASE_QUOTATION_NUMBER_SEQUENCE_UNAVAILABLE` | 422 |

## Trade inventory

Source: `../backend/mutakamel-apps/trade-app/src/modules/inventory` · 11 codes

| Error code | HTTP |
| --- | --- |
| `INVALID_BUSINESS_EFFECTIVE_AT` | 422 |
| `NON_EXACT_INVERSE_RESULT` | 422 |
| `NON_EXACT_PROPORTIONAL_RESULT` | 422 |
| `PARTIAL_REQUIRES_POSITIVE_AVAILABILITY` | 422 |
| `POLICY_BATCH_DUPLICATE_AGGREGATE` | 422 |
| `POLICY_BATCH_EXCEEDS_LIMIT` | 422 |
| `POLICY_BATCH_TIME_MISMATCH` | 422 |
| `POLICY_NUMBER_OUT_OF_RANGE` | 422 |
| `POLICY_OPERATION_UNSUPPORTED` | 422 |
| `SERIAL_REQUIRES_ONE_BASE_UNIT` | 422 |
| `UOM_REQUIRED_FOR_AMBIGUOUS_BALANCE` | 422 |

## Trade policy studio

Source: `../backend/mutakamel-apps/trade-app/src/modules/policy-studio` · 1 codes

| Error code | HTTP |
| --- | --- |
| `AMBIGUOUS_PRECEDENCE` | 422 |

## Trade extensions & automation

Source: `../backend/mutakamel-apps/trade-app/src/modules/extensions-automation` · 1 codes

| Error code | HTTP |
| --- | --- |
| `IMPORT_SOURCE_FILE_REQUIRED` | 400 |
