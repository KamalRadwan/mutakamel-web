# CRM Outbound Emails API

Base path: `/crm/outbound-emails`

The CRM Outbound Emails module handles the creation, delivery tracking, and retries for direct email campaigns and one-off emails sent to CRM prospects and customers.

## Endpoints

### `POST /crm/outbound-emails`
Dispatches a new outbound email to a targeted CRM entity.
- **Permissions**: `crm.email.send.*`
- **Body**: `CreateCrmOutboundEmailDto`
- **Response**: `202 Accepted`

### `POST /crm/outbound-emails/preview`
Renders an HTML preview of the outbound email before sending, parsing any template variables.
- **Permissions**: `crm.email.send.*`
- **Body**: `PreviewCrmOutboundEmailDto`
- **Response**: `200 OK`

### `POST /crm/outbound-emails/options`
Retrieves sending options, tracking settings, and limits for outbound email campaigns.
- **Permissions**: `crm.email.send.*`
- **Body**: `CrmOutboundEmailOptionsRequestDto`
- **Response**: `200 OK`

### `GET /crm/outbound-emails`
Lists previously sent outbound emails with delivery statuses.
- **Permissions**: `crm.activities.read.*`
- **Queries**: Pagination parameters, source filters
- **Response**: `200 OK`

### `GET /crm/outbound-emails/:id`
Retrieves the full detail and content payload of a specific outbound email.
- **Permissions**: `crm.activities.read.*`
- **Response**: `200 OK`

### `POST /crm/outbound-emails/:id/retry`
Re-queues a failed or bounced outbound email for delivery retry.
- **Permissions**: `crm.email.send.*`
- **Body**: `RetryCrmOutboundEmailDto`
- **Response**: `202 Accepted`
