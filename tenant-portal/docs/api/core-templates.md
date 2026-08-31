# Core — Template Platform

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **core-app**

Canonical prefix: `/api/tenant/core/v1/templates`

> **Upstream path note.** The three controllers are mounted on `templates`, not
> `tenant/templates` — the upstream is `/api/v1/templates/...`. Only the
> canonical browser path matters to the portal, but this trips anyone reading
> core-app source expecting the `tenant/` prefix.

Portal status: **built except the editor** — MASTER-PLAN Phase 7, tasks 7.10–7.19.

Source inspected:
`core-app/src/tenant/template-platform/template-platform.controller.ts`,
`core-app/src/tenant/template-platform/template-platform.errors.ts`,
`core-app/src/tenant/template-platform/dto/`,
`core-app/src/tenant/template-platform/pagination/template-cursor-codec.service.ts`,
`core-app/src/common/decorators/requires-feature.decorator.ts`.

**41 routes** — the largest single surface in Core, larger than all of
organization + users + roles combined.

---

## Two gates before any of this renders

**1. Entitlement.** Both authenticated controllers carry
`@RequiresFeature('core.template_designer')`. A tenant without that feature gets
**403**, and the correct surface is the entitlement-blocked page (task 4.28) —
not an empty list, and not a permission error.

**2. Permission.** Nine distinct permissions across the 41 routes:

```text
templates.read     templates.create    templates.update
templates.publish  templates.archive   templates.restore
templates.preview  templates.assets.manage  templates.assignments.manage
```

Two routes need **two** permissions (AND):
`GET /templates/:id/draft` needs `templates.read` **and** `templates.update` —
reading the editable draft is an authoring action, not a read.
`GET /templates/creation-scopes` needs `templates.read` **and**
`templates.create`.

---

## The lifecycle — read this before designing the editor

```text
definition ──> draft ──(validate)──> validation run ──(publish)──> version ──> assignment
                 ^                                                    │
                 └──────────────── restore ───────────────────────────┘
```

A **definition** owns metadata and exactly one mutable **draft**. Publishing
freezes the draft into an immutable **version**. An **assignment** points a
scope at a version with a priority and an effective window. Nothing renders to
an end user except through a resolved assignment.

### Publishing has three preconditions, all pinned

`POST /templates/:templateId/publish` requires:

1. the **definition revision** (`If-Match`),
2. the **draft revision** (in the body), and
3. a **passed validation run id** for that exact draft revision.

Change one character of the draft after validating and the run no longer
applies. **Surface all three states before enabling the button** (task 7.15) —
a publish button that fails on click is the thing this design is preventing.

---

## Routes

### Definitions and discovery

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates` | `templates.read` | Cursor-paginated |
| POST | `/api/tenant/core/v1/templates/search` | `templates.read` | **200**, `@ReadLikeOperation()` — the read-like POST for filter sets too large for a query string |
| POST | `/api/tenant/core/v1/templates` | `templates.create` | **201**, idempotency-required |
| GET | `/api/tenant/core/v1/templates/starters` | `templates.create` | Filtered by the exact doc/output/adapter/locale/schema tuple |
| GET | `/api/tenant/core/v1/templates/creation-scopes` | `templates.read` + `templates.create` | Scopes the user may create in |
| GET | `/api/tenant/core/v1/templates/data-sources` | `templates.read` | Registered adapters for the exact registry scope |
| GET | `/api/tenant/core/v1/templates/data-sources/:adapterKey/schema` | `templates.read` | The adapter's supported schema |
| GET | `/api/tenant/core/v1/templates/:templateId` | `templates.read` | Definition + draft + `ETag` |
| PATCH | `/api/tenant/core/v1/templates/:templateId` | `templates.update` | `If-Match` + idempotency |
| POST | `/api/tenant/core/v1/templates/:templateId/duplicate` | `templates.create` | **201.** Never copies assignments |
| POST | `/api/tenant/core/v1/templates/:templateId/archive` | `templates.archive` | **200**, **no body**, `If-Match` |
| POST | `/api/tenant/core/v1/templates/:templateId/restore` | `templates.archive` | **200**, **no body**, `If-Match` |
| DELETE | `/api/tenant/core/v1/templates/:templateId` | `templates.archive` | **204**, `If-Match`. Published or assigned is refused |

A **direction change** on `PATCH` additionally requires the draft revision in
the body — changing LTR/RTL rewrites the draft, so it cannot be done against the
definition revision alone.

### Draft and recovery

| Method | Canonical path | Permission |
| --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/:templateId/draft` | `templates.read` + `templates.update` |
| PATCH | `/api/tenant/core/v1/templates/:templateId/draft` | `templates.update` |
| GET | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots` | `templates.read` + `templates.update` |
| POST | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots/:snapshotId/restore` | `templates.restore` + `templates.update` |

Draft reads are `no-store, private` and carry `ETag`. **Autosave is an
`If-Match` write** — so a second tab, or a slow save racing a fast edit, is a
409 in the middle of typing. That is the conflict path task 7.13 has to design,
not an edge case to ignore.

Restoring a snapshot requires a **reason** and an explicit
**discard-acknowledgement** in the body, and the snapshot is checksum-pinned.
The UI must collect both; they are not optional fields to default.

### Validation and versions

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/templates/:templateId/validate` | `templates.update` | **200**, `If-Match` + idempotency. Validates against **exactly two** renderer targets |
| GET | `/api/tenant/core/v1/templates/:templateId/validation-runs/:validationRunId` | `templates.update` | One persisted run |
| POST | `/api/tenant/core/v1/templates/:templateId/publish` | `templates.publish` | **201.** Three pinned preconditions |
| GET | `/api/tenant/core/v1/templates/:templateId/versions` | `templates.read` | Cursor page |
| GET | `/api/tenant/core/v1/templates/:templateId/versions/:versionId` | `templates.read` | |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/restore` | `templates.restore` + `templates.update` | Replaces the draft. **Records an operator reason** |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/retire` | `templates.publish` | **200**, **no body**, `If-Match` |

### Preview — two synchronous, one asynchronous

| Method | Canonical path | Status | Shape |
| --- | --- | --- | --- |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/html` | **200** | Synchronous |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/email` | **200** | Synchronous — HTML **and** text |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/pdf` | **202** | **Async job**, idempotency-required |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId` | 200 | Job status, `no-store` |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId/artifact` | 200 | `application/pdf`, `private, no-store` |

The two synchronous previews render from a **pinned source** — either a draft
revision or a published version — never "whatever is current". Pass the
revision explicitly.

The PDF path is the async-job pattern: **202**, poll the job, then fetch the
artifact. The artifact **expires**, so "succeeded but the download is gone" is a
real fifth state alongside queued/running/succeeded/failed. Use the
`AsyncJobState` pattern (task 1.32).

### Assets

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/assets` | `templates.read` | Cursor page |
| POST | `/api/tenant/core/v1/templates/assets` | `templates.assets.manage` | **201.** Multipart, idempotency-required |
| GET | `/api/tenant/core/v1/templates/assets/:assetId` | `templates.read` | Projection + `ETag`, `private, no-store` |
| GET | `/api/tenant/core/v1/templates/assets/:assetId/content` | `templates.read` | Re-authorised, checksum-verified bytes |
| DELETE | `/api/tenant/core/v1/templates/assets/:assetId` | `templates.assets.manage` | **204**, `If-Match`. Unreferenced only |
| GET | `/api/tenant/core/v1/templates/public-assets/:assetId` | **`@Public()`** | `public, max-age=300`. Tenant resolves from the host |

The upload multipart is **exactly two parts and nothing else**: a `metadata`
JSON part (≤16 384 bytes) and a `file` part (≤5 MiB, PNG or JPEG). The
interceptor caps `files: 1, fields: 1, parts: 2` — a third part is rejected
outright, so do not add a stray hidden input.

**`EMAIL_PUBLIC` requires explicit confirmation.** Marking an asset public means
it is served without authentication, forever, to anyone with the id. That is a
deliberate, irreversible-feeling decision and needs its own confirmation step
(task 7.18) — not a checkbox in a form.

### Assignments

| Method | Canonical path | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/templates/assignments` | `templates.read` | Cursor page |
| POST | `/api/tenant/core/v1/templates/assignments` | `templates.assignments.manage` | **201**, idempotency |
| POST | `/api/tenant/core/v1/templates/assignments/resolve` | `templates.read` | **200**, `@ReadLikeOperation()`, `no-store` |
| GET | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.read` | + `ETag` |
| PATCH | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | `If-Match` + idempotency |
| DELETE | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `templates.assignments.manage` | **204.** Deactivates, preserving history |

`resolve` answers "which template actually renders for this selector at this
instant". Priority and effective windows can overlap; the server picks. **Give
the user a resolve preview** rather than letting them reason about precedence
themselves — overlapping-window bugs are otherwise invisible until a document
renders wrong.

`PATCH` revalidates compatibility, overlap, priority and scope, so an edit can
fail for a reason unrelated to the field the user changed. Say which.

---

## Pagination here is unlike the rest of Core

Template Platform uses **HMAC-signed cursors**, not page/limit:

- signed with the auth token pepper, **15-minute TTL**, fingerprint-bound,
  max 2048 characters;
- `CursorQueryDto` is `cursor` + `limit` (1–100, default 20).

**Preserve the cursor byte-for-byte.** Do not parse it, do not re-encode it, do
not persist it across a page reload — an expired or re-fingerprinted cursor is
rejected, and the correct UI response is to restart the list, not to retry.

Sorting is also its own dialect: definitions use `sortBy` + `sortDirection`
(**lowercase** `asc`/`desc`), and assets use a combined token like
`createdAt:desc`. This is the `sortDir` divergence recorded as gap G13 and task
3.37 — the shared `PaginationQueryDto` convention does **not** apply here.

---

## Concurrency

`ApiIfMatchHeader()` documents `^(?:W/)?"?[1-9][0-9]*"?$`, but that is only the
Swagger annotation. **The parser is stricter than the annotation** —
`parseRevisionEtag` in `template-platform.errors.ts` matches `^"([1-9][0-9]*)"$`,
so a weak tag or a bare integer is a `CORE.TEMPLATE.CONCURRENCY.STALE_REVISION`
**409**, and a missing header is
`CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED` **428**. Asset routes take a
namespaced form instead: `"asset:<assetId>:<revision>"`. Echo the server's own
`etag` field verbatim and neither shape can be got wrong — recorded as
[Q60](../build/OPEN-QUESTIONS.md#q60--apiifmatchheader-documents-a-looser-etag-than-parserevisionetag-accepts).

Idempotent commands additionally read
`x-mutakamel-idempotency-fingerprint` (`v1:sha256:<64 hex>`) alongside
`x-idempotency-key`. Replays return the stored response with
`Idempotency-Replayed: true`. Domain idempotency here is retained for
**seven years**, with a 2.5 MB cap on the stored response.

---

## What the portal does not have yet

**The editor.** Task 1.48 shipped `RichTextEditor`, which edits sanitized HTML
for one field. `TemplateDocumentV1` is a layout document — 18 node types, flow
and absolute layout, page configuration, theme, bindings and formula ASTs
(`@mutakamel/template-schema`) — and nothing in the design system can express
it. Phase 7 therefore built the **definition** screen and left 7.12 open rather
than shipping a list screen wearing an editor's name.

Two consequences follow, and both are deliberate:

- **`PATCH /templates/:templateId/draft` is never called.** Autosave would have
  to resend the `editorDocument` it just read.
- **`GET /templates/:templateId/draft` is never called either**, so
  `lastValidationRunId` is not available; the publish screen holds the run
  returned by `POST /validate` instead.

Three further routes have no portal caller yet, for stated reasons rather than
oversight: `POST /:templateId/duplicate` (no destination form),
`GET /data-sources` and `GET /data-sources/:adapterKey/schema` (the create form
uses the four adapter keys the DTO whitelists, and the schema view belongs to
the editor), and `GET /templates/:templateId/validation-runs/:validationRunId`
(see above). `GET /templates/public-assets/:assetId` is `@Public()` and is
served to mail clients, not to this app.

## Portal status per screen

| Screen | Plan task | State |
| --- | --- | --- |
| `/core/templates` list | 7.10 | built |
| Create from starter | 7.11 | built |
| `/core/templates/[id]` definition screen | 7.12 | built — **the editor is not**, see above |
| Draft recovery snapshots | 7.13 | restore built; autosave not — see above |
| Validation runs | 7.14 | built |
| Publish | 7.15 | built, all three preconditions surfaced |
| Versions | 7.16 | built |
| Preview HTML / email / PDF | 7.17 | built |
| `/core/templates/assets` | 7.18 | built |
| `/core/templates/assignments` | 7.19 | built, with the resolve preview |
