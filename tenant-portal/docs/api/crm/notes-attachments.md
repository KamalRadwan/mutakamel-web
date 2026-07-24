# CRM Notes & Attachments API

Base path: `/crm`

The CRM Notes and Attachments module provides shared endpoints to append rich text notes and binary files to any CRM source record (e.g., Leads, Opportunities, Customer Profiles, Parties, Activities).

## Notes

### `GET /crm/notes`
Returns a paginated list of notes attached to a specific CRM source record within a branch.
- **Permissions**: `crm.notes.read.*` (own, team, or all)
- **Queries**: `branchId`, `sourceType` (`LEAD`, `CUSTOMER_PROFILE`, `PARTY`, `OPPORTUNITY`, `ACTIVITY`), `sourceId`
- **Response**: `200 OK`

### `POST /crm/notes`
Creates a new note attached to a CRM source record.
- **Permissions**: `crm.notes.create.*`
- **Body**: `CreateNoteDto`
- **Response**: `201 Created`

### `PATCH /crm/notes/:id`
Updates the text content of a note.
- **Permissions**: `crm.notes.update.*`
- **Body**: `UpdateNoteDto`
- **Response**: `200 OK`

### `DELETE /crm/notes/:id`
Soft-deletes a note.
- **Permissions**: `crm.notes.delete.*`
- **Response**: `204 No Content`

## Attachments

### `GET /crm/attachments`
Returns a paginated list of attachment metadata linked to a CRM source record.
- **Permissions**: `crm.attachments.read.*`
- **Queries**: `branchId`, `sourceType`, `sourceId`
- **Response**: `200 OK`

### `POST /crm/attachments`
Creates attachment metadata for a file that is already stored in the tenant's bucket.
- **Permissions**: `crm.attachments.create.*`
- **Body**: `CreateAttachmentDto`
- **Response**: `201 Created`

### `POST /crm/attachments/upload`
Uploads a binary file (max 25 MB) and automatically creates the associated attachment metadata for a CRM source record.
- **Content-Type**: `multipart/form-data`
- **Permissions**: `crm.attachments.create.*`
- **Body Fields**: `file` (binary), `branchId`, `sourceType`, `sourceId`
- **Response**: `201 Created`

### `GET /crm/attachments/:id/download`
Streams the binary content of a stored attachment.
- **Permissions**: `crm.attachments.read.*`
- **Response**: `200 OK` (octet-stream)

### `DELETE /crm/attachments/:id`
Soft-deletes the attachment metadata and initiates a best-effort removal of the binary file from storage.
- **Permissions**: `crm.attachments.delete.*`
- **Response**: `204 No Content`
