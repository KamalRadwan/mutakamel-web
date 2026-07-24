# CRM Leads API

Base path: `/crm/leads`

The CRM Leads module handles the capture, qualification, and stage progression of prospective business opportunities before they are converted into customer profiles. 

All endpoints in this module are protected by branch-scoped CRM access control logic (`@RequireBranchAccess`) to ensure users only interact with leads within their authorized scopes (own, team, or all).

## Endpoints

### `POST /crm/leads`
Creates a raw or partially qualified lead in a branch.
- **Permissions**: `crm.leads.create.own`, `crm.leads.create.team`, or `crm.leads.create.all`
- **Body**: `CreateLeadDto`
- **Response**: `201 Created`

### `GET /crm/leads`
Returns paginated leads filtered by branch and narrowed by scoped read access.
- **Permissions**: `crm.leads.read.own`, `crm.leads.read.team`, or `crm.leads.read.all`
- **Queries**: `branchId`, `leadProfileType`, `status`, `stageId`, `stageFlag`, `acquisitionSourceId`, `ownerUserId`, pagination parameters
- **Response**: `200 OK` (Paginated Leads)

### `GET /crm/leads/capabilities`
Returns action capabilities for a branch the tenant user belongs to, without requiring Leads read access.
- **Permissions**: Derived from branch context
- **Queries**: `branchId`
- **Response**: `200 OK` (Object outlining scope capabilities for create, update, delete, convert)

### `GET /crm/leads/company-options`
List existing corporate lead companies to safely link new leads to existing active organizations.
- **Permissions**: `crm.leads.create.*`
- **Queries**: `branchId`
- **Response**: `200 OK`

### `GET /crm/leads/company-options/:companyPartyId/contacts`
List the active contact people already associated with a permitted organization party.
- **Permissions**: `crm.leads.create.*`
- **Queries**: `branchId`
- **Response**: `200 OK`

### `GET /crm/leads/:id`
Loads one lead detail if it is inside the actor's scoped branch/owner visibility.
- **Permissions**: `crm.leads.read.*`
- **Response**: `200 OK`

### `PATCH /crm/leads/:id`
Updates mutable lead fields after scoped write access is validated.
- **Permissions**: `crm.leads.update.*`
- **Body**: `UpdateLeadDto`
- **Response**: `200 OK`

### `POST /crm/leads/:id/stage`
Moves a lead to another tenant-defined lead stage and derives lifecycle status from semantic flags.
- **Permissions**: `crm.leads.update.*`
- **Body**: `MoveLeadStageDto`
- **Response**: `201 Created`

### `POST /crm/leads/:id/convert`
Converts a qualified lead into customer/contact records and optionally creates an initial opportunity.
- **Permissions**: `crm.leads.convert.*`
- **Body**: `ConvertLeadDto`
- **Response**: `201 Created` (Returns the updated Lead, new CustomerProfile, and new Opportunity)

### `DELETE /crm/leads/:id`
Soft deletes a lead after scoped delete access is validated.
- **Permissions**: `crm.leads.delete.*`
- **Response**: `204 No Content`
