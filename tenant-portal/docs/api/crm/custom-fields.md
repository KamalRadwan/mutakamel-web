# CRM Custom Fields API

Base path: `/crm/custom-fields` (Also accessible via `/crm/settings/custom-fields`)

The CRM Custom Fields module allows tenant administrators to define dynamic fields for CRM entities (Leads, Opportunities, Customer Profiles, Parties) and manage validation requirements based on operations.

## Definitions

### `GET /crm/custom-fields`
Lists all custom field definitions defined by the tenant across CRM owner types.
- **Permissions**: `crm.custom_fields.read`
- **Response**: `200 OK`

### `POST /crm/custom-fields`
Creates a new tenant-defined custom field definition for a specific CRM owner type.
- **Permissions**: `crm.custom_fields.manage`
- **Body**: `CreateCustomFieldDto`
- **Response**: `201 Created`

### `PATCH /crm/custom-fields/:id`
Updates mutable metadata of an existing custom field definition (e.g. labels, descriptions).
- **Permissions**: `crm.custom_fields.manage`
- **Body**: `UpdateCustomFieldDto`
- **Response**: `200 OK`

### `POST /crm/custom-fields/:id/requirements`
Creates or updates an operation-specific requirement rule for a custom field (e.g., making a field required during Lead Conversion).
- **Permissions**: `crm.custom_fields.manage`
- **Body**: `SetFieldRequirementDto`
- **Response**: `201 Created`

## Values

### `GET /crm/custom-fields/values`
Returns custom field values attached to a specific CRM owner record inside a branch.
- **Permissions**: `crm.custom_fields.read`
- **Queries**: `branchId`, `ownerType` (`LEAD`, `PARTY`, `CUSTOMER_PROFILE`, `OPPORTUNITY`), `ownerId`
- **Response**: `200 OK`

### `POST /crm/custom-fields/values`
Creates or updates a custom field value for a CRM owner record after validating branch access.
- **Permissions**: `crm.custom_fields.manage`
- **Body**: `UpsertCustomFieldValueDto`
- **Response**: `201 Created`
