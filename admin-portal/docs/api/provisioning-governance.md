# Global Provisioning Governance API

Status: **[Verified]**

Last source verification: **2026-08-12**

Owner: **Core**

Canonical browser prefix: `/api/admin/core/v1/provisioning`

## Route families

### Component/release catalogue

| Method and path | Permissions |
| --- | --- |
| `GET /api/admin/core/v1/provisioning/components` | `admin.tenants.read` |
| `GET /api/admin/core/v1/provisioning/components/:componentId/releases` | `admin.tenants.read` |

### Publisher keys

| Method and path | Permissions |
| --- | --- |
| `GET /api/admin/core/v1/provisioning/publisher-keys` | `admin.provisioning.publisher-keys.read` |
| `GET /api/admin/core/v1/provisioning/publisher-keys/:publisherKeyId` | `admin.provisioning.publisher-keys.read` |
| `POST /api/admin/core/v1/provisioning/publisher-keys/challenges` | `admin.provisioning.publisher-keys.manage` |
| `POST /api/admin/core/v1/provisioning/publisher-keys` | `admin.provisioning.publisher-keys.manage` + `admin.provisioning.critical` |
| `POST /api/admin/core/v1/provisioning/publisher-keys/:publisherKeyId/revoke` | `admin.provisioning.publisher-keys.manage` + `admin.provisioning.critical` |

The platform stores public-key registry material only. Publisher private signing
keys remain outside the browser and platform.

### Release drafts and releases

| Method and path | Permissions |
| --- | --- |
| `GET /api/admin/core/v1/provisioning/release-drafts` | `admin.provisioning.releases.read` |
| `GET /api/admin/core/v1/provisioning/release-drafts/:draftId` | `admin.provisioning.releases.read` |
| `POST /api/admin/core/v1/provisioning/release-drafts` | `admin.provisioning.releases.publish` |
| `PATCH /api/admin/core/v1/provisioning/release-drafts/:draftId` | `admin.provisioning.releases.publish` |
| `POST /api/admin/core/v1/provisioning/release-drafts/:draftId/validate` | `admin.provisioning.releases.publish` |
| `POST /api/admin/core/v1/provisioning/release-drafts/:draftId/publish` | `admin.provisioning.releases.publish` + `admin.provisioning.critical` |
| `GET /api/admin/core/v1/provisioning/releases` | `admin.provisioning.releases.read` |
| `GET /api/admin/core/v1/provisioning/releases/:releaseId` | `admin.provisioning.releases.read` |
| `POST /api/admin/core/v1/provisioning/releases/:releaseId/retire` | `admin.provisioning.releases.retire` + `admin.provisioning.critical` |

### Fleet rollout

| Method and path | Permissions |
| --- | --- |
| `POST /api/admin/core/v1/provisioning/fleet-rollout-previews` | `admin.provisioning.rollouts.create` |
| `GET /api/admin/core/v1/provisioning/fleet-rollout-previews/:previewId` | `admin.provisioning.rollouts.read` |
| `GET /api/admin/core/v1/provisioning/fleet-rollout-previews/:previewId/tenants` | `admin.provisioning.rollouts.read` |
| `POST /api/admin/core/v1/provisioning/fleet-rollouts` | `admin.provisioning.rollouts.create` + `admin.provisioning.critical` |
| `GET /api/admin/core/v1/provisioning/fleet-rollouts` | `admin.provisioning.rollouts.read` |
| `GET /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId` | `admin.provisioning.rollouts.read` |
| `GET /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/tenants` | `admin.provisioning.rollouts.read` |
| `POST /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/pause` | `admin.provisioning.rollouts.manage` + `admin.provisioning.critical` |
| `POST /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/resume` | `admin.provisioning.rollouts.manage` + `admin.provisioning.critical` |
| `POST /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/cancel` | `admin.provisioning.rollouts.manage` + `admin.provisioning.critical` |
| `GET /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/report` | `admin.provisioning.rollouts.report` |
| `POST /api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/report/attest` | `admin.provisioning.rollouts.report` + `admin.provisioning.critical` |

### Discovery and V1 retirement

| Method and path | Permissions |
| --- | --- |
| `POST /api/admin/core/v1/provisioning/discovery-runs` | `admin.provisioning.discovery.run` + `admin.provisioning.critical` |
| `GET /api/admin/core/v1/provisioning/discovery-runs` | `admin.provisioning.discovery.read` |
| `GET /api/admin/core/v1/provisioning/discovery-runs/:runId` | `admin.provisioning.discovery.read` |
| `GET /api/admin/core/v1/provisioning/v1-retirement` | `admin.provisioning.v1-retirement.read` |

## State and mutation rules

- Every write-sensitive command owns a stable UUIDv7 idempotency key.
- Preview and execution are separate intents.
- Accepted rollout/discovery work must be tracked through returned read models.
- Publisher/release/fleet critical controls require exact ALL permissions.
- Preserve version/checksum/digest fields and stale-update conflicts.
- Never fabricate release validation, rollout evidence, or tenant state.
- `cutoffAt` is an instant on the wire and is labelled UTC in the form, so the
  control is read and written as UTC. A `datetime-local` input carries no zone,
  and `new Date` reads a bare one as local: rendering the instant through the
  browser offset and parsing it back the same way is self-consistent on screen
  while shifting the boundary by that offset. `cutoff-time.ts` appends the `Z`
  the control omits, and its suite runs at `TZ=Asia/Riyadh` because a UTC
  machine cannot observe the difference.

## Current frontend status

All 31 current routes are source-integrated. `/provisioning` owns component and
discovery governance; `/provisioning/fleet` owns preview, rollout, tenant-impact,
lifecycle, report, and attestation; `/provisioning/publisher-keys` owns key and
challenge workflows; `/provisioning/releases` owns drafts, validation,
publication, releases, and retirement. Each module has typed readers, exact
permission gates, validation, mutation identity, bilingual states, and focused
tests. Authenticated runtime and deployment verification remain separate gates.

## Source map

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/dto/`
