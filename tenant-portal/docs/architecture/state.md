# State Ownership

Status: **Specification**

Written: **2026-08-27**

## The table

Every piece of state in this app belongs to exactly one owner. If two owners
hold the same fact, one of them is stale.

| State | Owner | Notes |
| --- | --- | --- |
| Backend resource data | Feature hook | Fetched, validated, never duplicated into a store |
| Auth generation, session metadata | `lib/auth` + `AuthContext` | Never read directly by a feature |
| Current user, permissions | `AuthContext`, from `/auth/me` | Advisory in the UI; backend is authoritative |
| Per-branch action capabilities | Feature hook, from the capabilities endpoint | Re-derived, never cached across branch changes |
| Filters, page, sort, view | **URL search params** | Shareable, survives refresh |
| Selected branch | Actor-scoped `sessionStorage["tenant_branch_selection_v1:<actor>"]` | Shared by `useTenantBranchSelection` consumers within the current tab; survives navigation and reload |
| Scroll position on back-navigation | Browser (table) / persisted (board) | See below — a board column scrolls inside its own container |
| Unsaved form draft | Feature-local form state | Discarded on close; when guarded via `useUnsavedChangesGuard`, intercepts same-origin `<a href>` clicks, registers `beforeunload`, and wraps explicit reload/discard actions (does not block browser Back/Forward or direct `router.push()`) |
| Selected app | `tenant_app` cookie | Read server-side, no flash. The only shell state that persists — the two nav bars have no collapsed state, so `tenant_sidebar` went with the sidebar |
| Theme | `localStorage["tenant_theme"]` | Pre-hydration bootstrap |
| Language | `localStorage["tenant_lang"]`, mirrored to the `tenant_lang` cookie | Read server-side from the cookie for the first render; the dictionary loads as one async chunk ([i18n](../design/i18n.md#loading-and-the-client-bundle-fe-bundle-001-2026-10-28)) |
| Per-screen view preference | `localStorage["tenant_view_<screen>"]` | Fallback when no `?view=` |
| Toasts | `sonner` | Transient; never the only record of a result |
| Realtime notifications | `lib/notifications` runtime | `useSyncExternalStore` |

### Scroll position

Filters and pagination come back for free because they live in the URL. Scroll
position does not, and it is the one users notice: inspecting row 40 and
returning to row 1 means re-finding your place on every record.

The **table** view scrolls the page — Next's scroll restoration covers it, so
do not fight it with a `scrollTo(0)` on mount. The **board** view scrolls
inside its own column container, which the browser does not restore; persist
that offset alongside the view preference.

A filter change is a new result set — resetting to the top is correct there.

## Rules

Branch preference updated **2026-11-03**: Leads, Customers and Opportunities
restore the same selected branch in the current tab. The shared hook validates
the stored UUID against the current actor's accessible branches. Required
screens keep their primary/sole-branch fallback; optional screens keep their
null fallback. Only the selected branch ID is persisted, without permissions
or capabilities. Same-tab consumers update together; `localStorage`, storage
events and cross-tab broadcasts are not used. If session storage is unavailable,
the preference continues in memory for the current page session.

Search and first-run probes use `useStablePermissions` so an identical `/me`
profile refresh does not restart their request fan-outs. People and audit-label
lookups use `useAuthScopeKey`, memoized by actor and permission, branch, company
and team-membership values. Their scope serialization runs only when those
values or the caller's session, enabled or language fence changes; an actual
scope change still invalidates cached labels immediately.

**The URL is the source of truth for anything shareable.** A filtered, sorted,
paginated board view must be reproducible from its URL alone. If a colleague
cannot paste a link and see the same screen, the state is in the wrong place.

**No global client store for server data.** There is no Redux, no Zustand (it is removed in
phase 1). Server data lives in the hook that fetched it; UI preferences live
in the URL, `localStorage`, or tab-scoped `sessionStorage`. A global store for server data is how two
components end up disagreeing about the same record.

**Permissions and capabilities are never persisted.** They are re-derived on
every load. Caching an authorization decision is how a revoked permission keeps
working until a refresh.

**Never mirror server state into local state.** A `useState` initialized from a
prop and then updated independently will drift. Derive during render.

## Optimistic updates

Permitted for board drag-and-drop and inline toggles. Required behavior:

1. Apply immediately.
2. Fire the mutation.
3. On failure, restore the exact previous value and surface the error.
4. Never leave the UI showing a state the server rejected.

Not permitted for creates, deletes, or anything where a duplicate would be
harmful — those wait for the server.

## Storage access

Quotation PDF jobs remain feature-hook state, keyed by document, current source
revision and immutable scope headers. Unknown writes retain their original
payload and idempotency key; they fence a new render until recovery. Link
expiry triggers a read of the same completed job. Binary preview state uses
the same context identity and revokes its Blob URL on cleanup. It is never
persisted into a global store or handoff snapshot.

The quotation template editor maintains an unsaved schema document and a
bounded 50-step undo history separately from its last confirmed draft. Writes
pin the server draft ETag. Conflicts preserve the local document; an unknown
save freezes editing and retains exact-document/key recovery. A successful
save installs the returned draft revision before fixture preview or release.

All `localStorage` and `sessionStorage` access goes through
`src/lib/safeStorage.ts`. Direct access throws in a private window and in some
embedded contexts. A storage failure must degrade to the default, never crash.
