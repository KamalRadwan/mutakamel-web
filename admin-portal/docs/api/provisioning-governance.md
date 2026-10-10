# Global Provisioning Governance API

Status: **[Verified]**

Last source verification: **2026-10-11** for current versus superseded
releases and their retirement (Core commit `d5af4407`), and for the fleet
preview's moved components and Core's refusal to retire a current release
(Core commit `77447fb9`); other route families retain their **2026-08-12**
evidence.

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

## Current and superseded releases

The provisioning catalogue holds exactly one current release per component
(today `core.foundation` 0.0.2, `crm` 0.0.2, `trade` 0.0.3, `webphone` 0.0.2,
all LOW risk with no backup or maintenance requirement). "Current" means "named
by the catalogue": Core selects it by catalogue identity, never as the newest
`PUBLISHED` row (`provisioning-current-release.ts`, `currentReleaseRows`). The
rows a control plane seeded for earlier releases stay `PUBLISHED` until an
operator retires them; nothing selects, offers, plans or executes them.

No release response carries a current flag. The portal reads it from
`GET /provisioning/components`, whose `latestPublishedRelease` is the
component's current release (null when the control plane holds none):

| Standing | Rule | `/provisioning/releases` |
| --- | --- | --- |
| Current | `latestPublishedRelease.id` of the release's component equals the release id | "Current" badge; the detail page explains why it cannot be retired and offers no retire form |
| Superseded | `PUBLISHED`, and the component names another current release | "Superseded" badge; the list counts them; the retire form offers **Use SUPERSEDED_BY_CURRENT_RELEASE** |
| Unknown | the component read needs `admin.tenants.read` and is missing, failed, or names no current release | no badge; the list shows that standing could not be read; the retire form warns never to retire a current release |

Retirement uses the existing `RELEASE_RETIRE` command with the row's
`expectedManifestChecksum` and the reason code `SUPERSEDED_BY_CURRENT_RELEASE`
(backend `mutakamel-apps/DATABASE_OPERATIONS.md`, "Retiring superseded
releases"). Core does not check pins on retire, so run the read-only pin check
first: no installation, open or retryable operation, prerequisite request,
execution or add-on binding, rollout or live preview may still pin the row.
The components table on `/provisioning` labels the same field **Current release**.

Core refuses to retire a current release itself: a row whose identity is its
component's catalogue release answers `409 TENANT_PROVISIONING_RELEASE_IS_CURRENT`
before anything changes (Core commit `77447fb9`), because retiring it would
fail every tenant's planning closed. The detail page already offers no retire
form for a row it judges current, so the refusal reaches an operator only when
standing was unknown or stale. The notice then shows the portal's own wording
(`RELEASE_COPY.commandErrors` in `release-shared.tsx`, en + ar) in place of the
generic conflict text, keeps the code beneath it, and re-reads the release and
the component catalogue.

## Fleet update preview rows

Core judges each tenant of an UPDATE preview with the update its planner would
build for that tenant (`TenantProvisioningPlanService.previewUpdate`, Core
commit `77447fb9`): the requested targets grow to every lagging component that
has to move with them, and compatibility is judged over that expanded set. So
`GET /fleet-rollout-previews/:previewId/tenants` returns `movedComponents` on
every row:

```ts
interface FleetMovedComponent {
  componentKey: string;
  requested: boolean; // selected (true), or pulled in because it was behind (false)
  fromReleaseId: string; // UUIDv7, the release the tenant runs
  fromReleaseVersion: string;
  toReleaseId: string; // UUIDv7, the component's current release
  toReleaseVersion: string;
  toManifestChecksum: string; // 64 lowercase hex
}

interface FleetPreviewTenant {
  tenantId: string;
  eligible: boolean;
  deterministicRank: number;
  safeReasonCode: string | null; // null exactly when eligible
  eligibilityDigest: string;
  // The moves of an eligible UPDATE row, in plan order; null for an
  // ineligible row and for every other operation type.
  movedComponents: FleetMovedComponent[] | null;
}
```

The reader (`provisioning-fleet/contracts.ts`) stays strict: it rejects a row
without the field, a move with any other key or a malformed id, version or
checksum, more than 100 moves, a component key listed twice, and moves on an
ineligible row. An UPDATE preview adds a **Moved components** column to its
tenant table, each move written `componentKey from → to`, with a **Pulled in**
label on every component the update moves although nobody selected it.

A planner refusal becomes the row's safe reason code:
`TENANT_PROVISIONING_UPDATE_INCOMPATIBLE` as `PROVISIONING_FLEET_RELEASE_INCOMPATIBLE`,
`TENANT_PROVISIONING_NO_ADMIN_MANAGED_UPDATES` as `PROVISIONING_FLEET_UPDATE_NOT_APPLICABLE`,
`TENANT_PROVISIONING_UPDATE_SELECTION_STALE` as `PROVISIONING_FLEET_CURRENT_PIN_STALE`,
`TENANT_PROVISIONING_CATALOG_INVALID` as `PROVISIONING_FLEET_COMPATIBILITY_EVIDENCE_INVALID`,
and any other code as itself. The moved set is part of the eligibility digest,
so a tenant whose expansion changes before dispatch fails stale instead of
moving further than previewed.

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
publication, releases, current/superseded standing, and retirement. Each module has typed readers, exact
permission gates, validation, mutation identity, bilingual states, and focused
tests. Authenticated runtime and deployment verification remain separate gates.

## Source map

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/dto/`
- `../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/provisioning-current-release.ts`
- `../backend/mutakamel-apps/DATABASE_OPERATIONS.md` (retiring superseded releases)
