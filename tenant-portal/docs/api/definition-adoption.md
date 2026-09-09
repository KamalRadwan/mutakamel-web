# Tenant Addon definition adoption

Source integration: **2026-09-09**. Coordinated Tenant executable checks and authenticated runtime acceptance are pending for this packet. The Gateway discovery packet independently passed production TypeScript, scoped lint and 61 existing cases; those checks do not verify this consumer.

The mounted page is `/core/subscription/definition-adoption`. The existing Application access navigation item also admits the exact `applications.addon_definitions.adopt` permission. Its entry link appears on that landing page for a current Owner or the exact ADOPT permission, outside the unchanged activation-read gate. Ordinary subscription detail, items, offers and purchase pages remain Owner-only. This page does not request their APIs.

## Discovery

| Method | Canonical browser path | Input | Success |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections` | Optional `after` cursor | 200 |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections/:addonSelectionId/targets` | Stored selection ID; optional `after` cursor | 200 |

Only one `after` query is supported. Stored IDs and cursors use canonical lowercase UUID versions 1–8, including existing v4 IDs. There is no client limit, request body, idempotency key or organization selector. Cookie transport and private/no-store remain unchanged. The consumer validates the complete cursor-page object inside Core's `data`; it does not apply offset-pagination unwrapping.

Selections contain exactly `expectedSubscriptionRevision`, `items` and `nextCursor`. Each item contains `addonSelectionId`, `applicationKey`, `addonKey` and `currentDefinition`. The latter contains `definitionVersionId`, positive bigint-string `version` and nullable canonical `revokedAt`.

Targets contain exactly `expectedSubscriptionRevision`, `addonSelectionId`, `currentDefinition`, `items` and `nextCursor`. Each item contains `targetDefinitionVersionId`, positive bigint-string `version` and canonical `publishedAt`. Targets differ from the current definition and are published, non-revoked definitions of the same Addon. No version-direction, compatibility, readiness, Company data, configuration or price is inferred from their presence.

Each page contains at most 50 rows in strictly increasing ID order after the requested cursor. A non-null next cursor requires 50 rows and equals the last returned ID. The owner reads one additional row to determine continuation. The 65,536-byte bound applies to data, excluding envelope overhead; transport retains the existing 4 MiB commercial response ceiling.

Each page is a fresh revision observation. A changed subscription revision or selected current-definition metadata clears fresh draft choices and requires an explicit discovery refresh. Same-revision pages may contribute to a draft of at most 100 distinct Addon selections. Refresh and actor/session changes retire unsent reviews; they never replace a retained unresolved command.

Core uses current Tenant ADOPT/session/placement checks before and after its read-only snapshot. Gateway supplies current Tenant audience/session admission and validates path/query/body framing. The browser mirrors the actual Owner-or-exact-ADOPT RBAC rule for discovery and commands. This administrative RBAC exception does not bypass Company, source, preparation or current-history checks. Every server 403 is rendered as a permission denial, not an empty list. Missing subscription or Addon, unavailable source and malformed response remain distinct from successful empty discovery.

## Preparation, preview and confirmation

The editor uses the existing canonical command families:

| Method and browser suffix under `/api/tenant/core/v1/subscription` | Success |
| --- | --- |
| POST `/preparations` | 202, actual retained operation |
| POST `/plan-change-previews` | 201, original preview |
| POST `/plan-change-previews/:previewId/apply` | 200, immutable applied receipt |
| POST `/operations/:operationId/recovery` | 202, actual retained operation |
| GET `/operations/:operationId` | 200, actual current progress |
| GET `/plan-change-previews/:previewId/receipt` | 200, original immutable receipt |

Every change is exactly `{sourceKind:'ADDON',operation:'ADOPT_DEFINITION',selectionKey,addonSelectionId,targetDefinitionVersionId}`. The complete ordered changes, expected subscription revision and optional normalized reason are retained before dispatch, with a generated UUIDv7 command key. The current definition ID captured from discovery is retained separately as an independent response-validation pin, never added to the public body. No ordinary money change may be mixed into an ADOPT request.

Discovery and preparation do not expose a subscription ID. The pure-ADOPT preview parser therefore binds its first response to the independently retained preparation ID, full original request, revision, row count/ordinals, selection keys, selection IDs, current definition IDs and target definition IDs. Only after those checks does it retain the actual returned subscription ID. The ordinary purchase parser still requires an independently read subscription ID.

The preview's new `operationId` is distinct in meaning from `preparation.preparationId`; they are never equated. Stored preview identity also retains its actor/target digests and original priced/expiry timestamps. An uncertain apply first retrieves its original preview with the unchanged preview request/key and verifies that identity before resending the original apply key. Returned digests and `canApply` are owner observations, not cached browser authority. Apply performs current server authorization again.

Pure preview validation requires all Addon changes to preserve seats and complete accepted-pricing snapshots. From/to definition IDs differ. Per-row and aggregate deltas and prorated amounts are exactly `0.0000`; recurring totals are unchanged. Direction is `NONE`, wallet status is `NOT_APPLICABLE`, and both wallet amounts are null. The UI displays not-applicable values without converting them into zero balances or claiming that a wallet was checked.

The closed receipt preserves the existing nine-field shape, with homogeneous ADOPT Addon changes, unchanged selection IDs, no removed IDs and null settlement. A response to apply is checked against its independently verified original preview, including operation identity, revision increment and totals. A saved receipt read binds the actual committed reference and preparation, original ordered selection changes and expected next revision. Saved projection `PENDING` remains historical; current operation progress is a separate read and never establishes operational access.

## Retained requests and recovery

ADOPT uses its own actor-scoped session-storage namespace. An ordinary purchase intent cannot be restored into the ADOPT editor. The journal contains the original request/key, discovery source pins, known preparation/preview references and previous rejected or expired request references. It contains no configuration values or credentials.

Unknown outcomes retain their exact original body/key. No automatic command retry or operation polling runs. Manual current-progress reads are available without an Owner subscription read. Actual COMMITTED plus its verified receipt, or actual ABORTED, resolves the journal. A generic conflict, unavailable response or network failure does not clear it or permit a replacement.

Operation status and full receipt access have different authority requirements. When ADOPT status verifies COMMITTED but the subsequent full receipt is denied or unavailable, the UI preserves that verified operation and the original unresolved journal. Receipt-only 403 appears inside its receipt panel; it does not hide Tenant-authorized status. The retained command is shown as saved, with manual status/receipt refresh available, and no new mutation is admitted for that verified terminal operation. COMMITTED status alone never fabricates a receipt or clears the journal. An actual operation GET 403 still denies the status view; ordinary Owner history error behavior is unchanged.

Only the source-proven `SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED` apply rejection permits a new preview of the same preparation. Only the actual `COMMERCIAL_RECOVERY_REVISION_STALE` rejection retires that unaccepted recovery command while preserving its original history; a fresh status read and explicit review are required before another recovery request. Recovery acceptance itself does not imply READY or clear exhausted adoption preparation. A BLOCKED or NEEDS_REVIEW observation remains visible without fabricated continuation success.

Actor, authentication-state and session-generation changes retire active results and abort requests. Discovery refresh retires fresh choices independently of the command journal. The backend remains authoritative for Tenant and complete affected-Company admission at each actual command/history boundary.

## Verification boundary

Producer source: Core controller `29D7F85D`, discovery reader `84C72B80`, contract `8EE3EBCE`; Gateway discovery rows `1A1F3B09`, aggregate `C8AD6C2B`, guard `FD13E120`, resolver `B99B042A`. Tasks 04, 14 and 27 reviewed their respective consumer bindings during implementation. Final frozen consumer review and Task 13 executable checks remain pending.

No new test/spec/case, package/lock change, backend modification or local application/runtime command was introduced by this Tenant packet. Task 13 alone schedules its TypeScript, scoped lint, existing affected suites and required design/document/build checks behind the main Docker/Admin work. Source mounting is not current-container or authenticated-browser acceptance.
