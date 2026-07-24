# CRM Opportunities API

Base path: `/crm/opportunities`

The CRM Opportunities module handles active sales processes associated with a customer profile, managing them through configured sales pipelines and stages.

All endpoints validate the actor's branch-scoped CRM visibility permissions (`@RequireBranchAccess`).

## Endpoints

### `POST /crm/opportunities`
Creates a sales opportunity under a customer profile and pipeline stage.
- **Permissions**: `crm.opportunities.create.own`, `crm.opportunities.create.team`, or `crm.opportunities.create.all`
- **Body**: `CreateOpportunityDto`
- **Response**: `201 Created`

### `GET /crm/opportunities`
Returns paginated opportunities filtered by branch and narrowed by scoped read access.
- **Permissions**: `crm.opportunities.read.*`
- **Queries**: `branchId`, `status`, `pipelineId`, `stageId`, `customerProfileId`, `ownerUserId`, `expectedCloseFrom`, `expectedCloseTo`, pagination parameters
- **Response**: `200 OK` (Paginated Opportunities)

### `GET /crm/opportunities/:id`
Loads one opportunity if it is inside the actor's scoped branch/owner visibility.
- **Permissions**: `crm.opportunities.read.*`
- **Response**: `200 OK`

### `PATCH /crm/opportunities/:id`
Updates mutable opportunity fields after scoped write access is validated.
- **Permissions**: `crm.opportunities.update.*`
- **Body**: `UpdateOpportunityDto`
- **Response**: `200 OK`

### `POST /crm/opportunities/:id/stage`
Moves an opportunity to another pipeline stage and derives WON/LOST/ON_HOLD/IN_PROGRESS status from semantic flags.
- **Permissions**: `crm.opportunities.update.*`
- **Body**: `MoveOpportunityStageDto`
- **Response**: `201 Created`

### `PUT /crm/opportunities/:id/pipeline`
Moves an opportunity to an accessible active pipeline and records the cross-pipeline stage transition.
- **Permissions**: `crm.opportunities.update.*`
- **Body**: `TransferOpportunityPipelineDto`
- **Response**: `200 OK`

### `GET /crm/opportunities/:id/stage-history`
Returns stage movement history plus safe from/to pipeline-stage label snapshots for an opportunity visible to the actor.
- **Permissions**: `crm.opportunities.read.*`
- **Response**: `200 OK`

### `DELETE /crm/opportunities/:id`
Soft deletes an opportunity after scoped delete access is validated.
- **Permissions**: `crm.opportunities.delete.*`
- **Response**: `204 No Content`
