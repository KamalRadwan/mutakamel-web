# Trade Extensions & Automation API

Base paths:
- `/trade/extensions`
- `/trade/import-mappings`
- `/trade/imports`
- `/trade/webhooks`

The Extensions & Automation module allows tenant developers and operators to extend Trade system behaviors, map bulk imports, and subscribe to real-time event webhooks.

## Extension Profiles

### `GET /trade/extensions/targets`
Lists available extension targets (hook points) in the Trade system.
- **Permissions**: `trade.extension.read.*`
- **Response**: `200 OK`

### `GET /trade/extensions/profiles`
Lists extension profiles.
- **Permissions**: `trade.extension.read.*`
- **Response**: `200 OK`

### `POST /trade/extensions/profiles`
Creates a new extension profile.
- **Permissions**: `trade.extension.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/extensions/profiles/:id`
Updates an extension profile.
- **Permissions**: `trade.extension.manage.*`
- **Response**: `200 OK`

### `POST /trade/extensions/profiles/:id/validate`
Validates the extension profile configuration.
- **Permissions**: `trade.extension.manage.*`
- **Response**: `200 OK`

### `POST /trade/extensions/profiles/:id/publish`
Publishes the extension profile to make it active.
- **Permissions**: `trade.extension.publish.*`
- **Response**: `200 OK`

## Import Mappings

### `GET /trade/import-mappings`
Lists defined mappings for bulk data imports (e.g., CSV to Catalog Item).
- **Permissions**: `trade.import.manage.*`
- **Response**: `200 OK`

### `POST /trade/import-mappings`
Creates a new import mapping schema.
- **Permissions**: `trade.import.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/import-mappings/:id`
Updates an import mapping schema.
- **Permissions**: `trade.import.manage.*`
- **Response**: `200 OK`

## Bulk Imports

### `POST /trade/imports/sources`
Uploads a source file (e.g., CSV, Excel) for processing.
- **Content-Type**: `multipart/form-data`
- **Permissions**: `trade.import.execute.*`
- **Response**: `201 Created`

### `POST /trade/imports/preview`
Generates a preview of how the import source will map to system entities.
- **Permissions**: `trade.import.execute.*`
- **Response**: `202 Accepted`

### `POST /trade/imports/:runId/execute`
Executes the bulk import operation asynchronously.
- **Permissions**: `trade.import.execute.*`
- **Response**: `202 Accepted`

### `GET /trade/imports`
Lists historical and active import runs.
- **Permissions**: `trade.import.execute.*`
- **Response**: `200 OK`

### `GET /trade/imports/:runId/results`
Returns row-by-row success/failure results for an import run.
- **Permissions**: `trade.import.execute.*`
- **Response**: `200 OK`

## Webhooks

### `GET /trade/webhooks/events`
Lists available business events that can be subscribed to.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `200 OK`

### `GET /trade/webhooks/subscriptions`
Lists webhook subscriptions.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `200 OK`

### `POST /trade/webhooks/subscriptions`
Registers a new webhook subscription.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `201 Created`

### `PATCH /trade/webhooks/subscriptions/:id`
Updates a webhook subscription URL or configuration.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `200 OK`

### `POST /trade/webhooks/subscriptions/:id/rotate-secret`
Rotates the signing secret used for webhook payloads.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `202 Accepted`

### `POST /trade/webhooks/subscriptions/:id/revoke-secret`
Revokes the signing secret.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `202 Accepted`

### `POST /trade/webhooks/subscriptions/:id/test`
Fires a test payload to the webhook endpoint.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `202 Accepted`

### `GET /trade/webhooks/deliveries`
Lists the delivery logs for webhooks.
- **Permissions**: `trade.webhook.manage.*`
- **Response**: `200 OK`

### `POST /trade/webhooks/deliveries/:id/retry`
Retries a failed webhook delivery.
- **Permissions**: `trade.webhook.replay.*`
- **Response**: `202 Accepted`
