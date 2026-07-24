# CRM Settings API

Base paths:
- `/crm/settings`
- `/crm/pipelines`
- `/crm/lead-stages`
- `/crm/acquisition-sources`

This module manages the configuration of CRM environments, including pipelines, lead stages, acquisition sources, and global CRM limits.

## CRM Settings

### `GET /crm/settings`
Returns the tenant CRM settings singleton, including duplicate policies and CRM limits.
- **Permissions**: `crm.settings.read`
- **Response**: `200 OK`

### `PUT /crm/settings`
Updates mutable CRM limits and duplicate policies for the resolved tenant.
- **Permissions**: `crm.settings.manage`
- **Response**: `200 OK`

## Pipelines

### `POST /crm/pipelines`
Creates a pipeline and ranked memberships for reusable opportunity stages.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `201 Created`

### `GET /crm/pipelines`
Returns active pipelines available through ALL, direct-user, or team assignment access.
- **Permissions**: `crm.pipelines.read`
- **Response**: `200 OK`

### `GET /crm/pipelines/configuration`
Returns active and inactive pipelines with assignment configuration for administrators.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `GET /crm/pipelines/assignment-options`
Returns active/invited CRM-seat users or tenant owners and active teams for pipeline access configuration.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `GET /crm/pipelines/:id`
Returns an available pipeline with its ranked stage memberships.
- **Permissions**: `crm.pipelines.read`
- **Response**: `200 OK`

### `PATCH /crm/pipelines/:id`
Updates pipeline labels, description, or activation state.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `DELETE /crm/pipelines/:id`
Soft-deletes a non-default pipeline that has no active opportunities.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `204 No Content`

### `PUT /crm/pipelines/:id/default`
Atomically makes an active ALL-access pipeline the tenant default.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `POST /crm/pipelines/:id/reset`
Restores the canonical six stage definitions and ranks on the current default pipeline.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `GET /crm/pipelines/:id/assignments`
Returns direct user/team assignments and access mode.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `PUT /crm/pipelines/:id/assignments`
Atomically replaces direct user/team targets and the explicit ALL/RESTRICTED access mode.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `POST /crm/pipelines/:id/stages`
Adds an active reusable opportunity stage at the final rank.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `201 Created`

### `PATCH /crm/pipelines/:id/stages/reorder`
Atomically replaces dense pipeline membership ranks.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `200 OK`

### `DELETE /crm/pipelines/:id/stages/:pipelineStageId`
Removes an unused, non-required pipeline-stage membership.
- **Permissions**: `crm.pipelines.manage`
- **Response**: `204 No Content`

## Lead Stages

### `POST /crm/lead-stages`
Creates a tenant-defined lead stage with a fixed semantic flag.
- **Permissions**: `crm.lead_stages.manage`
- **Response**: `201 Created`

### `GET /crm/lead-stages`
Returns all lead stages for the tenant in workflow order.
- **Permissions**: `crm.lead_stages.read`
- **Response**: `200 OK`

### `PATCH /crm/lead-stages/reorder`
Atomically replaces the dense one-based stage order.
- **Permissions**: `crm.lead_stages.manage`
- **Response**: `200 OK`

### `PATCH /crm/lead-stages/:id`
Updates mutable display/order/activation fields for a lead stage.
- **Permissions**: `crm.lead_stages.manage`
- **Response**: `200 OK`

### `POST /crm/lead-stages/:id/default`
Marks an active lead stage as the tenant default for new leads.
- **Permissions**: `crm.lead_stages.manage`
- **Response**: `201 Created`

### `DELETE /crm/lead-stages/:id`
Removes or deactivates a lead stage.
- **Permissions**: `crm.lead_stages.manage`
- **Response**: `204 No Content`

## Acquisition Sources

### `POST /crm/acquisition-sources`
Creates a tenant-defined bilingual source.
- **Permissions**: `crm.acquisition_sources.manage`
- **Response**: `201 Created`

### `POST /crm/acquisition-sources/:id/icon`
Uploads or replaces an icon and stores its key.
- **Permissions**: `crm.acquisition_sources.manage`
- **Response**: `201 Created`

### `GET /crm/acquisition-sources/:id/icon`
Streams the stored icon.
- **Permissions**: `crm.acquisition_sources.read`
- **Response**: `200 OK`

### `GET /crm/acquisition-sources`
List sources.
- **Permissions**: `crm.acquisition_sources.read`
- **Response**: `200 OK`

### `PATCH /crm/acquisition-sources/reorder`
Reorders sources.
- **Permissions**: `crm.acquisition_sources.manage`
- **Response**: `200 OK`

### `PATCH /crm/acquisition-sources/:id`
Update source.
- **Permissions**: `crm.acquisition_sources.manage`
- **Response**: `200 OK`

### `DELETE /crm/acquisition-sources/:id`
Delete source.
- **Permissions**: `crm.acquisition_sources.manage`
- **Response**: `204 No Content`
