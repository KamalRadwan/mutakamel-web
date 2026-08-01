# Storage Server Modal and Edit-Mode Contract

Last source verification: **2026-07-30**.

This component specification complements the authoritative
[Storage Servers API contract](../api/storage-servers.md). It defines the
frontend behavior for:

- the **Add Storage Server** modal opened from `/storage-servers`;
- the base-configuration edit mode embedded in `/storage-servers/[id]`;
- critical confirmations for routing, verification, lifecycle, attestation
  keys, credential-reference rotation, recovery evidence, and deletion.

It does not define a separate `/storage-servers/new` or
`/storage-servers/[id]/edit` route.

Current implementation status: the add modal, embedded base-configuration edit
mode, verification/lifecycle/delete confirmations, dirty-state protection,
permission gates, bilingual direction-aware UI, and same-intent UUIDv7 retry
handling are implemented. Routing-profile, principal-rotation, attestation,
and recovery evidence modals remain intentionally unavailable.

It also does not define a tenant migration modal. The backend has a separate
eight-route fenced migration authority with four-app write-drain
acknowledgements, copy verification, rollback, and finalization. That feature
is default-off, operationally gated, and currently lacks the public read model
needed for refresh-safe frontend control. Do not add “move tenants here”,
“rollback migration”, or “finalize retained source” actions from this
component contract. See
[Tenant Storage Server Migrations](../api/tenant-storage-migrations.md).

## Add modal

Open the modal only when the current admin has both:

- `admin.storage_servers.create`;
- `admin.storage_servers.critical`.

Submit with `POST /api/admin/core/v1/storage-servers`.

Permissions:
`admin.storage_servers.create` + `admin.storage_servers.critical`.

The form maps exactly to `CreateStorageServerDto`. It contains only:

- code and name;
- internal and public endpoints;
- region and placement role;
- desired node, zone, and replication-factor targets;
- tenant limit;
- warning and critical capacity percentages;
- the fixed path-style value `true`.

The modal must not contain access keys, secret keys, bucket configuration,
principal references, attestation private keys, or an activation switch.

Both endpoint fields accept origins only: no credentials, non-root path, query,
or fragment. Public storage requires HTTPS. Internal HTTPS may use a DNS name;
internal plain HTTP is limited to localhost, loopback, or an RFC1918 IPv4
literal.

Keep these states explicit:

- pristine;
- dirty;
- field validation;
- submitting;
- Gateway idempotency in flight;
- duplicate identity conflict;
- server validation failure;
- ambiguous outcome requiring catalogue refetch;
- success.

Generate one UUIDv7 `x-idempotency-key` when the admin confirms. Reuse it only
for an exact retry while the outcome remains unknown. On confirmed success,
clear form state, close the modal, refetch the list, and expose a link to the
new detail route.

Closing a dirty modal requires confirmation. Never retain field values in
browser storage.

## Detail edit mode

The detail screen owns one server query. Entering edit mode copies only these
fields:

```text
name
internalEndpoint
publicEndpoint
region
placementRole
desiredNodeCount
desiredZoneCount
requiredReplicationFactor
maxTenants
warningPercent
criticalPercent
```

The following remain read-only:

```text
id
code
provider
forcePathStyle
configRevision
bindingRevision
readinessRevision
status
availabilityClass
healthStatus
all tenant counters
all observed topology
all capacity observations
createdAt
updatedAt
```

Edit mode requires:

- `admin.storage_servers.update`;
- `admin.storage_servers.critical`;
- a freshly loaded status of `DRAFT` or `OFFLINE`;
- zero current, retained, and reserved tenants; and
- zero visible active reserved capacity.

These client checks improve clarity only. The safe response omits retained and
reserved capacity counters, so Core's transaction-locked empty-server check
remains authoritative and can return a conflict after a concurrent or hidden
capacity change.

Submit only changed keys with
`PATCH /api/admin/core/v1/storage-servers/:id`. The DTO has no optimistic
concurrency field. Refetch before editing and after every success, conflict, or
ambiguous response. Cancel restores the last server response.

Permissions:
`admin.storage_servers.update` + `admin.storage_servers.critical`.

## Full routing-profile replacement

Routing configuration is not a normal detail edit. Open it as a separate
critical flow from the detail route.

The current backend has no safe read endpoint for bucket names, credential
references, or selected attestation key IDs. Therefore this form:

- starts empty;
- requires all four mandatory class buckets;
- requires all nine principal reference slots;
- requires all six attestation-key selections;
- obtains `expectedBindingRevision` from the latest server detail;
- clearly labels the operation as a full replacement;
- never caches or redisplays submitted references.

Do not prefill from environment variables or the previous submission.

## Critical confirmation rules

| Intent | Confirmation evidence |
|:---|:---|
| Replace routing profile | Server name/code, current binding revision, full-replacement warning |
| Rotate principal material | Server name, exact principal/role, out-of-band secret-store rotation acknowledgement |
| Start verification | Server name, current revision triplet, 15-minute run expiry |
| Activate | Server name and server-authoritative production-readiness warning |
| Drain | Server name and statement that new tenant placement stops |
| Offline | Server name, zero current/retained/reserved tenant counters, and zero visible active reserved capacity |
| Promote attestation key | Principal, key ID, validity window |
| Revoke attestation key | Principal, key ID, uppercase reason, affected-server readiness invalidation |
| Register recovery destination | Destination code/name, immutable boundary, write-only credential-locator warning |
| Verify recovery policy | Source and online server IDs/revisions, destination revision, evidence expiry, trusted-package acknowledgement |
| Revoke recovery policy | Source server, current evidence revision, readiness-invalidation warning |
| Delete | Server code/name, zero current/retained/reserved tenant counters, and zero visible active reserved capacity |

Every confirmation:

- is permission-gated;
- creates a fresh UUIDv7 idempotency key;
- disables duplicate submission;
- preserves the exact key for an ambiguous retry;
- refetches authoritative state before another action.

Do not use a generic success toast as the only feedback for verification or
lifecycle operations. Render the resulting server/run state.

Recovery verification is not a free-form modal built from the normal detail
response. That response omits the deployment identities and evidence package.
Enable this critical flow only when the trusted operator-evidence acquisition
contract described in the API document is available; never invent, reuse, or
client-compute evidence hashes.

## Accessibility and internationalization

- Trap focus while a modal is open and restore focus to the invoking action.
- Associate validation messages with their exact inputs.
- Expose pending state with text, not animation alone.
- Use logical direction-aware layout properties.
- Keep wire enum values separate from translated labels.
- Do not place endpoint or credential-reference text in automatically copied
  telemetry or analytics attributes.

## Test matrix

Cover:

- both required permission combinations and read-only behavior;
- create success, validation, duplicate, forbidden, and ambiguous retry;
- dirty close/cancel;
- base edit field allowlist and unchanged-field omission;
- edit blocked by status or tenant counters;
- URL credential/query/fragment rejection;
- topology and warning/critical cross-field validation;
- routing-profile completeness and stale binding revision;
- each supported principal/credential-role pair and unsupported pairs;
- verification pending/pass/fail/expired;
- recovery destination registration, policy-not-configured, verify/revoke
  revision conflicts, evidence expiry, and absent trusted evidence packages;
- every lifecycle precondition;
- delete counter gates;
- exact idempotency-key reuse only for the same intent;
- no secret or private-key persistence.
- no tenant-migration action while the migration read-model and release gates
  remain open.
