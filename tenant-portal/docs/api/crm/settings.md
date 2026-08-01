# CRM tenant settings

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live-partial`
> Authorship: hand-written from current source

CRM settings are a tenant singleton. This page covers only the two settings routes; pipeline/stage/source/custom-field administration has separate pages.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/settings` | `/api/v1/crm/settings` | `crm.settings.read` | `200`, settings |
| `PUT` | `/api/tenant/crm/v1/settings` | `/api/v1/crm/settings` | `crm.settings.manage` | `200`, settings |

These are tenant-wide static permissions. The controller does not use `crm.settings.update`; current writes require `crm.settings.manage`.

## Update validation

`PUT` is a partial update. Send only changed fields; unknown fields are rejected.

| Field | Contract |
|---|---|
| `requireQualifiedStageForConversion` | optional strict boolean |
| `defaultLeadStageId` | optional UUIDv7 |
| `outboundEmailContentRetentionDays` | optional integer `30..2555` |
| `asteriskIntegration` | optional nested partial object |

The response also contains server-owned `defaultPipelineId` and `outboundEmailRetentionPolicyRevision`; neither is accepted in this DTO. Manage the default pipeline through [Pipelines](./pipelines-opportunity-stages.md). The server increments the retention-policy revision only when the retention-day value changes.

### Asterisk integration

| Field | Contract |
|---|---|
| `enabled` | strict boolean |
| `websocketUrl` | `ws://` or `wss://`, maximum 512, nullable |
| `sipDomain`, `realm` | maximum 180, nullable |
| `outboundProxy` | maximum 512, nullable |
| `defaultCallerId` | maximum 64, nullable |
| `fromDomain`, `registrarServer` | maximum 180, nullable |
| `contactUri` | maximum 255, nullable |
| `registerExpires` | integer `60..86400`, nullable |
| `sessionTimers`, `traceSip`, `allowInvalidTlsCertificate` | strict booleans |
| `stunServers` | string array, each maximum 512 |
| `turnServers`, `iceServers` | arrays of objects; public item schema is currently unresolved |
| `extra` | object; schema is intentionally opaque |

The service merges supplied Asterisk subfields into the current object rather than replacing omitted subfields.

No SIP username/password field is accepted by this DTO. Do not add credentials to `extra`, browser storage, logs, or documentation examples.

`allowInvalidTlsCertificate: true` weakens transport security. The portal must present it as a high-risk administrative setting, default to false, and never turn it on implicitly.

## Seed state

Fresh settings are:

```json
{
  "requireQualifiedStageForConversion": true,
  "defaultLeadStageId": null,
  "outboundEmailContentRetentionDays": 730,
  "outboundEmailRetentionPolicyRevision": 1,
  "asteriskIntegration": {
    "enabled": false,
    "registerExpires": 600,
    "sessionTimers": false,
    "traceSip": false,
    "allowInvalidTlsCertificate": false,
    "stunServers": [],
    "turnServers": [],
    "iceServers": [],
    "extra": {}
  }
}
```

The seed also stores the seeded default pipeline ID. Always read live settings because tenants can change mutable values and seed details can evolve.

## Responses, errors, and retry

Both endpoints return the raw settings entity, not `{success,data}`. Update is synchronous and audited inside the transaction.

Neither route uses Gateway idempotency. After an ambiguous `PUT`, re-read settings before retrying. Unknown/nonnested fields produce `CRM_VALIDATION_FAILED`; invalid referenced stages and semantic settings can produce domain `404`/`422` errors.

Settings can expose infrastructure topology. Keep responses out of client analytics, crash dumps, and shared caches; use same-origin authenticated requests with `no-store`.

## Safe example

```http
PUT /api/tenant/crm/v1/settings
Content-Type: application/json

{
  "requireQualifiedStageForConversion": true,
  "outboundEmailContentRetentionDays": 730
}
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/settings/crm-settings.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/settings/dto/update-crm-settings.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/settings/crm-settings.service.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
