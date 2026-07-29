# Storage Server Modal and Edit-Mode Contract

Last source verification: **2026-07-29**.

This component specification complements the authoritative
[Storage Servers API contract](../api/storage-servers.md). It defines the
frontend behavior for:

- the **Add Storage Server** modal opened from `/storage-servers`;
- the base-configuration edit mode embedded in `/storage-servers/[id]`;
- critical confirmations for routing, verification, lifecycle, attestation
  keys, credential-reference rotation, and deletion.

It does not define a separate `/storage-servers/new` or
`/storage-servers/[id]/edit` route.

## Add modal

Open the modal only when the current admin has both:

- `admin.storage_servers.create`;
- `admin.storage_servers.critical`.

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
- zero current and retained tenants.

These client checks improve clarity only. Core remains authoritative and can
return a conflict after concurrent state changes.

Submit only changed keys with
`PATCH /api/admin/core/v1/storage-servers/:id`. The DTO has no optimistic
concurrency field. Refetch before editing and after every success, conflict, or
ambiguous response. Cancel restores the last server response.

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
| Offline | Server name and zero current/retained tenant evidence |
| Promote attestation key | Principal, key ID, validity window |
| Revoke attestation key | Principal, key ID, uppercase reason, affected-server readiness invalidation |
| Delete | Server code/name and zero current/retained/reserved counters |

Every confirmation:

- is permission-gated;
- creates a fresh UUIDv7 idempotency key;
- disables duplicate submission;
- preserves the exact key for an ambiguous retry;
- refetches authoritative state before another action.

Do not use a generic success toast as the only feedback for verification or
lifecycle operations. Render the resulting server/run state.

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
- every lifecycle precondition;
- delete counter gates;
- exact idempotency-key reuse only for the same intent;
- no secret or private-key persistence.
