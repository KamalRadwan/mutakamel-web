# Canonical API Request Examples

Status: **Pattern examples**

Last verified: **2026-07-25**

## Core read

```http
GET /api/tenant/core/v1/auth/me HTTP/1.1
Host: tenant.example.test
Accept: application/json
Authorization: Bearer <access-token>
```

Illustrative success envelope:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "01900000-0000-7000-8000-000000000001",
      "email": "owner@example.test"
    }
  },
  "correlationId": "01900000-0000-7000-8000-000000000010",
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```

The exact `/auth/me` projection is defined in [Auth API](../api/auth.md).

## CRM list

```http
GET /api/tenant/crm/v1/leads?branchId=01900000-0000-7000-8000-000000000020&page=1&limit=20 HTTP/1.1
Host: tenant.example.test
Accept: application/json
Authorization: Bearer <access-token>
```

CRM successes are raw service projections. A common page is:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0,
  "hasNext": false,
  "hasPrev": false
}
```

Do not run this response through the Core/Trade envelope unwrapping path.

## Trade read

```http
GET /api/tenant/trade/v1/quotations/01900000-0000-7000-8000-000000000030 HTTP/1.1
Host: tenant.example.test
Accept: application/json
Authorization: Bearer <access-token>
```

Trade operating context requirements are route-specific. Never add a
company/branch/channel header based on guesswork.

Ordinary Trade JSON is wrapped as:

```json
{
  "success": true,
  "data": {},
  "correlationId": "01900000-0000-7000-8000-000000000011",
  "timestamp": "2026-07-25T10:00:00.000Z"
}
```

Trade page objects remain under `data`; there is no shared top-level page
`meta`.

## Idempotent write

```http
POST /api/tenant/core/v1/<documented-write-route> HTTP/1.1
Host: tenant.example.test
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access-token>
X-Idempotency-Key: 01900000-0000-7000-8000-000000000040

{
  "<documentedField>": "<value>"
}
```

Use a cryptographically generated UUIDv7. Retain it only for an exact replay
after an unknown outcome. Do not add this header to a route unless its Gateway
and owner-app contract supports/requires it.

## Core/CRM validation failure

```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "COMMON.GENERIC.VALIDATION_FAILED",
  "errorCategory": "VALIDATION",
  "message": "Validation failed",
  "details": {
    "email": ["email must be an email"]
  },
  "correlationId": "01900000-0000-7000-8000-000000000050",
  "timestamp": "2026-07-25T10:01:00.000Z",
  "path": "/api/v1/tenant/auth/login"
}
```

Trade does not use this shared error envelope. Codes/messages can be
app-specific; branch on normalized stable code/category/status, not English
text or raw validator objects.

## Gateway failure

Gateway-originated problems may use:

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "code": "GW.AUTH.FORBIDDEN",
  "correlationId": "01900000-0000-7000-8000-000000000060"
}
```

The shared client normalizes this separately from application `errorCode`.
