# Error Code Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:errors`.
> Generator: `scripts/docs/generate-error-reference.mjs`

Status: **verified** (parsed from `throw new *Exception` sites)

Last source verification: **2026-08-30**

Codes: **95** across **8** areas

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

Source: `../backend/mutakamel-apps/crm-app/src/crm/leads` · 16 codes

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
| `LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN` | 422 |
| `LEAD_EXISTING_COMPANY_INVALID` | 422 |
| `LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH` | 403 |
| `PARTY_DUPLICATE_CONTACT_METHOD` | 422 |

## Customer profiles

Source: `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles` · 8 codes

| Error code | HTTP |
| --- | --- |
| `CUSTOMER_PROFILE_CONTACT_INVALID` | 422 |
| `CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED` | 422 |
| `CUSTOMER_PROFILE_CONTACT_OUTSIDE_BRANCH` | 403 |
| `CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID` | 422 |
| `CUSTOMER_PROFILE_CONTACTS_CORPORATE_ONLY` | 422 |
| `CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN` | 422 |
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
