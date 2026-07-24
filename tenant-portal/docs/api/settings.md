# Tenant Settings API

Base paths:
- `/tenant/workspace-settings`
- `/tenant/branding`
- `/tenant/numbering`

This module manages the global settings for the tenant workspace, including regional configurations, visual branding, and system-wide numbering sequences.

## Workspace Settings

### `GET /tenant/workspace-settings`
Returns the tenant workspace settings singleton (language, timezone, default currency, and support access toggles).
- **Permissions**: `workspace.read`
- **Response**: `200 OK`

### `PUT /tenant/workspace-settings`
Updates the tenant workspace settings singleton.
- **Permissions**: `workspace.manage`
- **Body**: `UpdateWorkspaceSettingsDto`
- **Response**: `200 OK`

## Branding

### `GET /tenant/branding/public`
Returns display-only tenant branding for pre-auth screens resolved by the tenant request host.
- **Permissions**: Public
- **Response**: `200 OK`

### `GET /tenant/branding`
Returns the tenant branding singleton used by authenticated branding settings screens.
- **Permissions**: `branding.read`
- **Response**: `200 OK`

### `PUT /tenant/branding`
Updates tenant branding colors, font, application labels, and sanitized login-page HTML.
- **Permissions**: `branding.manage`
- **Body**: `UpdateBrandingDto`
- **Response**: `200 OK`

### `POST /tenant/branding/logo`
Uploads/replaces the tenant logo using the platform storage layer.
- **Permissions**: `branding.manage`
- **Body**: `multipart/form-data` with a `file` field
- **Response**: `201 Created`

### `POST /tenant/branding/icon`
Uploads/replaces the tenant icon using the platform storage layer.
- **Permissions**: `branding.manage`
- **Body**: `multipart/form-data` with a `file` field
- **Response**: `201 Created`

## Numbering Sequences

### `POST /tenant/numbering`
Creates a tenant numbering sequence, optionally scoped to a company, with prefix, padding, and starting value.
- **Permissions**: `numbering.manage`
- **Body**: `CreateNumberingSequenceDto`
- **Response**: `201 Created`

### `GET /tenant/numbering`
Returns tenant numbering sequences with pagination, search, sorting, company, and exact code filters.
- **Permissions**: `numbering.read`
- **Response**: `200 OK` (Paginated)

### `PATCH /tenant/numbering/:id`
Updates a numbering sequence prefix, padding, or next value.
- **Permissions**: `numbering.manage`
- **Body**: `UpdateNumberingSequenceDto`
- **Response**: `200 OK`

### `GET /tenant/numbering/:code/peek`
Returns the current next value and formatted preview for a numbering sequence code.
- **Permissions**: `numbering.read`
- **Queries**: `companyId` (Optional)
- **Response**: `200 OK`
