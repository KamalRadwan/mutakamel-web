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
| Filters, page, sort, view, branch | **URL search params** | Shareable, survives refresh |
| Scroll position on back-navigation | Browser (table) / persisted (board) | See below — a board column scrolls inside its own container |
| Unsaved form draft | Feature-local form state | Discarded on close, guarded when dirty |
| Sidebar collapsed | `tenant_sidebar` cookie | Read server-side, no flash |
| Theme | `localStorage["tenant_theme"]` | Pre-hydration bootstrap |
| Language | `localStorage["tenant_lang"]` | Pre-hydration bootstrap |
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

**The URL is the source of truth for anything shareable.** A filtered, sorted,
paginated board view must be reproducible from its URL alone. If a colleague
cannot paste a link and see the same screen, the state is in the wrong place.

**No global client store.** There is no Redux, no Zustand (it is removed in
phase 1). Server data lives in the hook that fetched it; UI preferences live
in the URL or `localStorage`. A global store for server data is how two
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

All `localStorage` and `sessionStorage` access goes through
`src/lib/safeStorage.ts`. Direct access throws in a private window and in some
embedded contexts. A storage failure must degrade to the default, never crash.
