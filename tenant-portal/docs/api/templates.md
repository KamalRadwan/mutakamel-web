# Tenant Templates & Business Letters API

Base paths:
- `/templates`
- `/business-letters`

This module manages the Template Designer platform, template assignments, and generated business documents (like Business Letters).

## Template Platform

### `GET /templates` & `POST /templates/search`
Lists or searches templates visible to the tenant.
- **Permissions**: `templates.read`

### `GET /templates/starters`
Lists template starters (base templates) available for creation.
- **Permissions**: `templates.create`

### `GET /templates/creation-scopes`
Returns creation scopes allowed for the current actor.
- **Permissions**: `templates.read`, `templates.create`

### `POST /templates`
Creates a new template.
- **Permissions**: `templates.create`

### Data Sources
- **`GET /templates/data-sources`**: List data sources available for templates.
- **`GET /templates/data-sources/:adapterKey/schema`**: Retrieve the schema for a specific data source.

### Assets
- **`POST /templates/assets`**: Upload a new template asset (images, fonts).
- **`GET /templates/assets`**: List assets.
- **`GET /templates/assets/:assetId`**: Get asset.
- **`DELETE /templates/assets/:assetId`**: Retire asset.

### Assignments
- **`POST /templates/assignments`**: Create an assignment between a template and an event/trigger.
- **`GET /templates/assignments`**: List assignments.
- **`GET /templates/assignments/:assignmentId`**: Get specific assignment.
- **`PATCH /templates/assignments/:assignmentId`**: Update assignment.
- **`DELETE /templates/assignments/:assignmentId`**: Delete assignment.
- **`GET /templates/assignments/production-readiness`**: Inventory unsupported production assignments.
- **`POST /templates/assignments/production-readiness/remediate`**: Remediate unsupported assignments.
- **`POST /templates/assignments/resolve`**: Resolve which template assignment matches a payload.

## Template Definition Management

Path: `/templates/:templateId`

### Core Template Operations
- **`GET /templates/:templateId`**: Get template metadata.
- **`PATCH /templates/:templateId`**: Update template definition.
- **`POST /templates/:templateId/duplicate`**: Duplicate template.
- **`POST /templates/:templateId/archive`**: Archive template.
- **`POST /templates/:templateId/restore`**: Restore archived template.
- **`DELETE /templates/:templateId`**: Delete template entirely.

### Drafts & Recovery
- **`GET /templates/:templateId/draft`**: Get the current working draft.
- **`PATCH /templates/:templateId/draft`**: Save changes to the draft.
- **`GET /templates/:templateId/draft/recovery-snapshots`**: List recovery snapshots.
- **`POST /templates/:templateId/draft/recovery-snapshots/:snapshotId/restore`**: Restore a recovery snapshot.

### Validation & Publishing
- **`POST /templates/:templateId/validate`**: Trigger draft validation.
- **`GET /templates/:templateId/validation-runs/:validationRunId`**: Check validation status.
- **`POST /templates/:templateId/publish`**: Publish the validated draft as a new version.

### Versions
- **`GET /templates/:templateId/versions`**: List published versions.
- **`GET /templates/:templateId/versions/:versionId`**: Get specific version.
- **`POST /templates/:templateId/versions/:versionId/restore`**: Rollback/Restore a version.
- **`POST /templates/:templateId/versions/:versionId/retire`**: Retire a version.

### Previews
- **`POST /templates/:templateId/preview/html`**: Generate an HTML preview.
- **`POST /templates/:templateId/preview/email`**: Generate an Email preview.
- **`POST /templates/:templateId/preview/pdf`**: Trigger PDF preview generation.
- **`GET /templates/preview-jobs/:jobId`**: Check PDF preview generation job status.

## Business Letters

### `POST /business-letters`
Create a draft business letter.
- **Permissions**: `business_letters.create`

### `GET /business-letters`
List business letters.
- **Permissions**: `business_letters.read`

### `GET /business-letters/:letterId`
Get details of a specific business letter.
- **Permissions**: `business_letters.read`

### `PATCH /business-letters/:letterId`
Update/Replace business letter draft content.
- **Permissions**: `business_letters.update`

### `POST /business-letters/:letterId/issue`
Issue the business letter (lock the draft into final state).
- **Permissions**: `business_letters.issue`

### `POST /business-letters/:letterId/render-pdf`
Trigger PDF rendering of the business letter.
- **Permissions**: `business_letters.render`
- **Response**: `202 Accepted`

### `GET /business-letters/:letterId/render-jobs/:renderJobId`
Check status of the PDF rendering job.
- **Permissions**: `business_letters.read`
