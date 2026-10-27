# Tenant audit trail

Status: **verified**

Last source verification: **2026-10-17** (PLATFORM-AUDIT-008). Sources: Gateway
`core.route-contracts.ts`, Core `tenant/audit/{tenant-audit.controller,audit-query.dto,tenant-audit.service}.ts`,
and the entity declarations in each app's `packages/database/src/entities`.

All reads use `/api/tenant/core/v1/audit`, require **any** of `audit.read`,
`audit.read.branch`, `audit.read.own`, and use `Cache-Control: no-store`.
The server applies tenant, authorized branch, or actor/stored-owner scope.
The portal's permission check is advisory; a server 403 renders PermissionGate.

| Read | Path suffix | Response inside Core's data envelope |
| --- | --- | --- |
| Ledger | none | `{ items, nextCursor }` |
| Deleted records | `/deleted` | `{ items, nextCursor }` |
| Event | `/events/:id` | stored event, redacted before/after and diff |
| Record history | `/entities/:entityType/:entityId` | `{ items, nextCursor }` |

The screen sends `limit=25`; history sends `limit=10`. Cursors are opaque and
round-trip unchanged. There is no total count, offset, page number, or guessed
continuation. Filters reset the cursor; previous navigation reuses prior cursors.
The ledger supports application, entity type/id, action, actor, branch, owner,
sensitivity, outcome, source kind, correlation ID and date bounds. HTTP_COMMAND
is hidden by the server unless explicitly selected. Label-prefix search (`q`)
is sent only to the Deleted records subset. Dates use inclusive `from` and
exclusive `to` bounds. No destructive or restore operation is exposed here.

The drawer and `/core/audit/events/:id` show the stored redacted field diff and
snapshots; they never reconstruct changes from live records. A missing or
out-of-scope event receives the same 404 screen. Deleted events have no live-record
link. Unknown notification keys or malformed JSON parameters keep the server text;
`record.owner_changed` and `record.deleted` decode the current publisher's
`metadata.params` JSON string and render with the selected ar/en dictionary.
The inbox, notification detail and shell dropdown use the same renderer.

`RecordHistoryTab` uses the shared cursor history reader. Existing CRM dossiers
keep their related-party grouping and person/reference labels. History triggers
and content disappear when no audit read grant exists. Core user/role/organization,
CRM catalogue/dashboard/email and Trade record detail layouts use the same tab.
Party and template details retain their embedded history sections. Permission and
record changes fence stale requests; a failed continuation retains prior history
and can be retried.

Per-app catalogues in `src/lib/audit/catalogue` derive exact stored entity names,
translated labels and detail routes from the checked-in declarations and explicit
domain publishers, as authorized by the lead on 17/10 18:05. They do not rename
domain subjects into entity class names. CRM's lead, customer and opportunity
registrations in `crm-record-audit.ts` enable both notification flags. Core and
Trade registrations currently leave them disabled. Future registrations must
update the descriptive flags alongside their catalogue.

Decorated child subjects such as item company profiles and user branch-role
assignments remain selectable in the ledger. Their catalogue route is null
because their entity ID is not a standalone record-page ID.

This is the **tenant** audit reader. Control-plane billing invoices, subscription
operations/receipts and application-admission workflows are outside this API;
they are not given a fabricated tenant history. Notification details remain the
message viewer and link to the event named by the publisher.

Verification prepared: cursor contract/redaction tests, ledger race/reset tests,
history access/continuation tests, catalogue translation checks, notification
JSON/language cases and route admission tests. No tests, typecheck, lint or build
were run in the implementer's sandbox; lead verification is required.
