# Mutakamel Tenant Portal

The standalone Next.js application for the Tenant browser experience. Caddy
routes the configured Tenant hosts to its fixed port `5002`.

Arabic-first and RTL by default, with full English LTR support. Bilingual and
dual-theme are requirements on every screen, not follow-up work.

For UI design and review, all agents use the
[shared Playwright MCP browser](../../backend/docs/operations/playwright-mcp.md)
at `http://127.0.0.1:8931/mcp`. Capture the real running screen and inspect
current component/computed styles before proposing a redesign. Use the
tenant host on `5002`, isolated MCP sessions, and Arabic/English plus
light/dark verification; no app startup or per-task browser containers.

## CRM dashboard read admission

Source reviewed **2026-10-31** (AUDIT29X-TPD-2): the default dashboard,
dashboard list and prebuilt reports start reads only for a tenant owner or a
session with `crm.dashboards.read` (including `.own`, `.team` and `.all`).
The default loader mounts inside `PermissionGate`; list, catalogue and report
effects and manual reloads skip requests while disabled. A session without
read access shows the existing permission boundary without sending requests.
Unit-spec execution and the tenant rebuild are pending lead verification.

## Trade dashboard request lifetime

Source reviewed **2026-10-31** (AUDIT29X-TPD-1, REVIEW-M-2): initial dashboard
detail loads and explicit reloads clear the previous dashboard, run, shares and
share targets before fetching. Successful mutations refresh detail and sharing
data without showing the loading skeleton or discarding the last run. Failed
mutations retain their action error and do not reload. Changing dashboard or
company/scope cancels outstanding loads and runs; late responses cannot restore
previous data or errors. Mutation refreshes and manual reloads share the same
load controller, so only the newest load can publish state.
Unit-spec execution and the tenant rebuild are pending lead verification.

## Core error messages

Workspace and branding saves (source reviewed **2026-10-31**, AUDIT29X-TPK-5)
re-read the singleton immediately before writing. If any field in the changed
payload differs from the loaded baseline, saving stops and the existing
bilingual conflict prompt asks the administrator to reload. The draft is kept;
unrelated server changes do not block a save. A failed or invalid fresh read
also prevents the write. This is a client-side check: writes after that read
still require future backend revision preconditions for atomic protection.

Source reviewed **2026-10-30** (AUDIT29X-TPK-2): workspace and email settings,
notification inbox/detail/preferences, the audit ledger, invite/password-reset
forms and profile security resolve API failures through `useCoreErrorText` or
`useCoreOperationsErrorText`. These surfaces never display normalized server or
transport messages. Known codes and request outcomes use Arabic/English copy;
status 0 uses the localized connection message and unknown failures use the
localized generic fallback. The support reference retains the correlation ID.
Profile password refusals use the existing localized current-password message.

## CRM record picker loading

Source reviewed **2026-10-31** (AUDIT29X-TPS-4): the shared custom-field and
outbound-email record picker clears its options when a search starts for a
different branch or source type. Options stay empty while the new list loads.
Text-only searches retain the current options until the response arrives to
avoid flicker while typing.

## CRM company websites

Source reviewed **2026-10-30** (AUDIT29X-TPC-1): customer grid cards, lead
company cards and both quick-edit dialogs use `crm/shared/safe-website-href.ts`.
Only parsed `http:` and `https:` URLs become links; bare hosts default to HTTPS.
Validated HTTP(S) values retain their trimmed spelling, including paths and
the absence of a trailing slash; only bare hosts are normalized.
Invalid or other-scheme stored values remain plain text. Customer creation,
the lead company editor and both quick-edit save flows use the same check and
retain unsafe input with the existing translated website field error. Optional
empty values remain allowed and existing length limits still apply.

## Commercial-account branch credit limits

Source reviewed **2026-10-31** (AUDIT29X-TPT-3): branch narrowing validation
canonicalizes both credit-limit strings and compares their exact BigInt units
through the shared fixed-decimal helpers. A branch limit of
`9007199254740993.01` exceeds a company ceiling of `9007199254740993.00`;
equal values remain valid regardless of decimal padding. Malformed or negative
limits invalidate the rule, including when the company ceiling is absent.
An omitted branch limit remains valid; a null company limit has no ceiling.

## Sales order confirmation deadlines

Source reviewed **2026-10-31** (AUDIT29X-TPT-8): confirmation validates a
nonempty requested deadline before entering the write flow. An invalid date
blocks the POST and shows an Arabic/English error toast naming the deadline
field. Valid dates are serialized to ISO 8601; an empty deadline still sends
an empty body. Regression specs cover invalid input and correction to a valid
deadline; execution and the tenant rebuild are pending lead verification.

## Inventory reservation releases

Inventory reservation releases (source reviewed **2026-10-18**, CXPORTAL-TRADE-116)
update the session ledger and dossier from the validated reservation response,
including its status, version and cumulative released quantity. Remaining reserved
quantity is calculated exactly as `quantity - releasedQuantity - consumedQuantity`.
Releasing 3 of 10 therefore shows “Partially released”, 7 remaining and 3 released;
a full release displays the server's terminal status, including `CLOSED` when stock
was both consumed and released. Releases entered manually by ID also appear in
the session ledger. These handles remain session-only; no read endpoint is added.

## Trade contract helpers

Source reviewed **2026-10-18** (CXPORTAL-TRADE-124): Trade contract modules
expose helpers and catalogues used by production screens. Unused error-code
extraction, reason presets, scope/status catalogues and inventory type guards
have been removed without compatibility aliases. Tests for the removed exports
are retired; production parsing and request validation remain unchanged.

## Lead module exports

Source reviewed **2026-10-18** (FE-LEADS-043): lead and lead-stage modules
keep component-only props and protected-stage constants private. Test-only
entry-stage lookup, phone normalization and error-section lookup helpers and
their tests are removed. Specs infer component props where needed; production
request validation, section error counts and lifecycle ordering are unchanged.
The shared rating ceiling remains exported because the lead parser and rating
control both use it.

## Notification refresh behavior

Source reviewed **2026-10-31** (AUDIT29X-TPS-1): item and unread-count changes,
including recipient updates outside the shell cache, use a 400 ms trailing
debounce before refreshing subscribed screens. Generation binding, clearing and
loading-state changes do not trigger queries. Generation changes and the last
subscriber leaving cancel scheduled invalidations. Listener refreshes never
overlap; changes during a refresh queue one trailing run. Explicit commands
bypass the debounce and await reconciliation, including a trailing read when a
refresh was already active.

The inbox refreshes its loaded page depth and current unread filter once per
event burst. Detail invalidation silently looks up its ID, preserving the current
notification object and status until validated replacement data arrives. An
authoritative 404 still renders not found; other background failures retain the
current detail. Initial loads, ID changes and explicit retries retain their
loading and error paths. A failed invalidation that supersedes an unfinished
initial lookup remains retryable. Regression spec execution is pending lead
verification.

## Runtime

- Next.js 16.2.11, React 19.2.4, Tailwind CSS 4, TypeScript strict.
- TypeScript enables `noUnusedLocals` across the portal, including specs
  (FE-LEADS-045). Remove unused imports and locals rather than suppressing
  the compiler diagnostic; JSX uses the automatic React runtime.
- Fixed development and production port: **`5002`**.
- Browser API traffic goes through API Gateway only.
- In development, Next proxies same-origin
  `/api/tenant/{core,crm,trade,webphone}/v1/*` to `DEV_API_TARGET`
  (default `http://localhost:9000`). Production keeps this rewrite disabled
  because deployment ingress owns the `/api/*` namespace.
- `TENANT_GATEWAY_INTERNAL_ORIGIN` is required by `next start`. It is a
  server-only Gateway origin used to verify the original Tenant `Host` before
  any authenticated provider or page renders. Origin only — no credentials,
  path, query or fragment. See `.env.example`.
- In the local Docker stack the portal runs its **production build**
  (`output: "standalone"`, `node tenant-portal/server.js`) behind `portal-edge`,
  which plays the production ingress for `/api/*`. Open it on the tenant host
  (`http://mersany.mutakamel.ai:5002`). Changes are live only after
  `pnpm run portal:rebuild` (= `node ../scripts/rebuild-portal.mjs tenant`); see
  [portal runtime](../docs/operations/portal-runtime.md).
- The rebuild script trims and removes surrounding quotes from `~/.npmrc`
  tokens. Only `compose build` receives `NODE_AUTH_TOKEN`; other Compose
  commands strip it from their environment, including when exported by the
  caller. Saved build logs and printed failure tails mask every occurrence.

Canonical tenant API prefixes:

```text
/api/tenant/core/v1/*     Core   — identity, session, notifications, workspace
/api/tenant/crm/v1/*      CRM    — leads, customers, opportunities, catalogues
/api/tenant/trade/v1/*    Trade  — catalogues, documents, inventory and governance
```

Worker has no tenant browser API. Its asynchronous results are read through
Core, CRM or Trade projections.

## Account menu navigation

Reviewed on **2026-10-17** (CXPORTAL-SHELL-117). The account menu's Profile
entry opens `/core/profile` in both Arabic and English.

## WebPhone extensions

Source reviewed on **2026-10-17** (CLXAPP-118). Extension create/update
requests and list responses have no `transport` field. The extensions screen
accepts these responses and offers creation, enable/disable and deletion
without an extension-level transport control. Each SIP server's
`websocketUrl` scheme (`ws://` or `wss://`) carries its transport; the server
controls remain the place to change it. SIP passwords stay write-only.

## Trade invoice and contract draft editing

Source reviewed on **2026-10-17** (CXPORTAL-TRADE-103, -104, -105). Create
requests include party and currency; draft updates omit those immutable fields
and show them read-only. Updates submit the full financial document with its
version and idempotency headers. Notes-only invoice edits preserve item
references, price/tax evidence, discounts, charges, totals and payment terms.
Contract edits hydrate stored totals directly and preserve negotiated legal
terms and source evidence, including nonzero tax and rounding. See
[the request/response details](docs/api/trade-documents.md).

## User placement editing

Reviewed on **2026-10-17** (CLXAPP-115). User edits send `null` when clearing
a home team or manager and omit unchanged team/manager values. Moving to a
different department clears the previous home team in the same save. See
[the Core user contract](docs/api/core-identity.md#request-bodies-1).

## Permission denial feedback

Reviewed on **2026-10-17** (FE-CORE-ERR-001). Advisory Core pickers,
the owner-only scope-role read, and WebPhone settings reads pass
`suppressForbiddenToast: true`. A denied request still rejects and publishes
its permission-denial event; the caller keeps its existing screen state.
This prevents company-picker denials on Taxes and unsubscribed WebPhone reads
from producing page-load toasts. Mutations retain normal denial feedback.

Other non-public 403 responses use translated Core error-code copy when
available, with a generic access-denied fallback. ToastProvider shows at most
one toast per denial code in four seconds; different codes remain distinct.

## CRM configuration and outbound-email access

Access-state handling reviewed against source on **2026-10-17**
(FE-CRM-CONFIG-001). CRM Settings and the tags, acquisition sources, custom
fields, lead stages and pipelines lists render server `403` responses through
`PermissionGate`, even when session permissions would admit the page.
Settings retains the read error's HTTP status separately from save errors.

Outbound-email list and detail pages show a bilingual plan message without
Retry for `403 CRM_FEATURE_DISABLED`. Other list `403` responses render the
forbidden boundary; detail `403` responses render `CrmScopeGate`. Server
failures such as `500` retain Retry, and detail `404` retains Not Found.
Navigation remains visible: no staff-readable entitlement contract is needed
for this page-level handling (lead authorization, 2026-10-17).

## CRM dashboard controls

Switching dashboards on `/crm/dashboard` starts a fresh workspace, clears the
previous definition, run and filter selection, and shows the loading skeleton
until the new dashboard loads. Filters use the new dashboard's defaults; a
failed definition request shows the existing failure boundary without exposing
the previous dashboard's widgets or revision.

Dashboard editing (including layout and widget placement changes) requires
both `OWNER` or `EDIT` access and `crm.dashboards.update`. Sharing and loading
the dashboard's share list require both `OWNER` access and
`crm.dashboards.share`. When access allows an action but its permission is
missing, the workspace hides the controls and explains the restriction in
Arabic or English. Dashboard read permission alone never enables these actions.
The share drawer shows retryable, translated errors when the share list or
target search fails. It clears the selected recipient and expiry only after the
share request succeeds; a rejected request keeps the draft available to retry.

## CRM outbound email controls

Verified **2026-10-17** (FE-CRM-EMAIL-001): Compose and Retry share a scoped
`crm.email.send` check accepting `.own`, `.team`, or `.all` grants. With
`crm.activities.read` access, a sender sees Compose and Retry on a FAILED
email; users without a send grant see neither action. The backend still
enforces access to the source record on each request.

## Documentation

Start with **[docs/README.md](docs/README.md)**.

The set is written so that an agent implementing a feature never has to stop
and ask a question. It covers the design system end to end (tokens, type,
geometry, motion, primitives, patterns, the three-view contract, shell,
theming, i18n, anti-patterns, enforcement), the file architecture and
dependency rules, the data layer, backend API contracts by domain, and the
exact permission and enum wire values.

If you are executing the rebuild, read
**[docs/build/HANDOFF.md](docs/build/HANDOFF.md)**.

## Current status

| Area | Status |
| --- | --- |
| Transport and session layer | Production-grade and tested. Not to be rewritten |
| Host admission | Implemented, fails closed, tested |
| Notifications + realtime | Implemented, Zod-validated, tested |
| CRM — leads, customers, opportunities, catalogues | Server-backed; presentation layer pending rebuild |
| Core — sign-in sessions | Server-backed |
| Trade | Backend real (231 routes); no portal screen |
| Design system | **Specified, not yet implemented** — see `docs/design/` |
| Sealed route scaffolds | 45 routes behind the unavailable boundary, scheduled for deletion |

Documentation is not runtime evidence. Verify each capability against current
source, tests, and an authenticated deployment before treating it as complete.

## Customer-profile addresses

Contract verified **2026-10-17** against `CreateCustomerProfileDto` and
`UpdateCustomerProfileDto`: neither accepts `address`. CRM create and profile
PATCH bodies omit it. The create modal has no address section or navigation
entry. Company details and corporate/individual quick edit display the existing
Party address as a read-only field with an Arabic/English explanation. Identity
saves preserve the server address; address changes belong to the Core party
directory.

## Customer-profile tag writes

The quick-edit modal and detail identity card send `{ tagIds: [id] }` to
`POST /api/tenant/crm/v1/customer-profiles/:id/tags` and replace the optimistic
chips with the validated `201` array. Tag writes are serialized per component.
A failed attach or detach restores the previous chips and shows the existing
Arabic/English tag-save error toast so the user can retry. Contract verified
2026-10-17 against `AttachRecordTagsDto` and the customer-profile controller.

## Opportunity terminal stage moves

Card and Table moves to Won or Lost open the shared terminal dialog using the
selected list row, independently of board data. Confirmation posts once to
`POST /api/tenant/crm/v1/opportunities/:id/stage` with optional `reason` for
Won or required `lostReason` for Lost, then reloads the list. A refusal keeps
the dialog open; uncertain writes are read back and reconciled without
automatic replay. Contract verified 2026-10-17 against the Gateway stage route,
`MoveOpportunityStageDto` and the opportunities controller/service.

## Opportunity bulk delete

Card and Table bulk delete require confirmation showing the number of selected,
loaded opportunities allowed by the delete capability. Confirmation snapshots
those IDs and rechecks their scope without expanding the deletion set. Each
row's delete result is checked; only confirmed deletions leave the selection.
A visible Arabic/English summary reports deleted, unconfirmed and skipped rows,
including partial failures. Review retained rows after refresh before retrying
an unconfirmed deletion. The bulk bar and confirmation stay busy for the entire
batch. Behaviour updated 2026-10-17 (FE-OPP-004).

## Billing checkout links

Updated 2026-10-30 (AUDIT29X-TPK-3): invoice and wallet checkout links are
parsed as absolute HTTPS URLs with a non-empty host and empty username/password.
Malformed URLs, whitespace/control characters and values over 2048 characters
fail with the existing invalid billing response error before reaching an anchor.
Missing or null links remain optional. Provider hosts are configured server side,
so the portal imposes no host allowlist and preserves accepted URLs exactly.

## Commands

From `C:\mutakamel.ai\frontend`:

```powershell
pnpm --filter tenant-portal dev
pnpm --filter tenant-portal verify
pnpm --filter tenant-portal build
```

From `tenant-portal/`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server on 5002 |
| `pnpm verify` | typecheck + lint + test + docs:check + design:rtl |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the design-system rules |
| `pnpm test` | Vitest |
| `pnpm docs:routes` | Regenerate the Gateway route inventory from backend source |
| `pnpm docs:api-reference` | Regenerate the per-app route reference pages |
| `pnpm docs:check` | Fail on stale generated docs, broken links, or missing metadata |
| `pnpm design:census -- --check` | Fail on design-system regressions |
| `pnpm design:rtl` | Fail on physical direction utilities |
| `pnpm build` | Production build |

Do not run this application on an alternate port.

> `pnpm typecheck` can fail on stale `.next` generated types after files move.
> Run `rm -rf .next` first. Tracked as D7 in
> [docs/build/DEFECTS.md](docs/build/DEFECTS.md).

## Opportunity custom fields in the edit drawer

Verified against the custom-field read routes and opportunity update DTO/service
on **2026-10-17** (FE-OPP-012). The existing owner-scoped update capability and
workspace mutation gate admit the edit drawer. It loads active `OPPORTUNITY`
definitions and stored values through `GET /custom-fields` and
`GET /custom-fields/values?branchId&ownerType=OPPORTUNITY&ownerId`; both reads
require `crm.custom_fields.read`. Inputs use the shared bilingual field controls
and mark UPDATE requirements. A failed read displays localized feedback and a
retry, with no editable fallback values. Other opportunity fields remain editable.

Saving sends only changed custom-field keys in `PATCH /opportunities/:id` as
`{ customFields: { fieldKey: value } }`, under the opportunity's update permission;
no `crm.custom_fields.manage` permission is needed. Untouched values are omitted,
false/zero/arrays retain their types, and an emptied input sends `null` to clear
its value. Required-field refusals retain the draft and use the existing localized
error handling. Revert restores the loaded values; a confirmed write reloads the
detail and reopening the drawer re-reads stored values.

## Lead stage age

The board, expanded board card, card grid and lead detail use
`formatLeadStageAge` with `stageEnteredAt` and the same translated
"{age} in stage" label. Editing another lead field does not reset this age.
Missing or invalid stage-entry timestamps hide the badge; creation and update
timestamps never substitute for stage entry.

## Outbound email retry

Updated 2026-10-18 (CXCRM-OPS-114): a successful retry opens the accepted
child email's detail page, showing its queued status and subsequent delivery
history. The failed parent links to its existing retry. Retry requires the
send permission, a loaded FAILED email, retained content and no existing child;
parents with a child and redacted failed emails show bilingual explanations.
The hook also checks eligibility before submitting. A 202 means queued,
not delivered; use the detail refresh action to check subsequent delivery.

## Record notes pagination

Updated **2026-10-30** (AUDIT29X-TPC-2): `useCrmNotes` reads 25 notes per
page from `/api/tenant/crm/v1/notes`. The shared record notes section shows
a localized loaded/total count and Load more while the validated response
has another page and the loaded count is below total. Further pages append
with IDs deduplicated; aborts and request epochs prevent superseded reads
from changing the list. A failed next page retains loaded notes. Create,
update and delete reconciliation reset the list to page 1. This behavior
applies to leads, customer profiles and opportunities.

## Toast session boundary

Updated **2026-10-31** (AUDIT29X-TPS-3): `ToastSessionReset` inside
`TenantAuthProvider` dismisses all Sonner toasts when the current user ID
changes, including to null on sign-out or session end (also across tabs).
Persistent messages and retry actions cannot carry into the next actor's
session. Toasts raised afterward remain until their normal dismissal; auth
rerenders for the same user do not clear them.
