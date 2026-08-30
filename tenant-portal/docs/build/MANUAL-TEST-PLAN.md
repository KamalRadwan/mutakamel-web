# Manual Test Plan

Written: **2026-08-30** · Status: **written, blocked on a login** (see
[DECISIONS.md#d13](DECISIONS.md))

A green `pnpm verify` proves *type-validated, lint-validated, unit-tested*. It
does **not** prove the app works in a real authenticated session. This is the
script that does.

Every step is run **four times** — Arabic RTL and English LTR, each in light and
dark — unless the step says otherwise. Record the result inline: `PASS`, `FAIL`
with what happened, or `BLOCKED` with why.

## Prerequisites

| # | Requirement | State |
|---|---|---|
| P1 | Backend stack up | ✅ gateway 9000, core 8001, crm 8003, trade 8004, realtime 8005, postgres, rabbit, redis — all healthy |
| P2 | Portal reaches the gateway | ✅ `.env.local` with `DEV_API_TARGET` and `TENANT_GATEWAY_INTERNAL_ORIGIN` |
| P3 | Request `Host` matches a verified FQDN | ❌ **blocked** — browser sends `localhost`, which has no `tenant_fqdns` row |
| P4 | An ACTIVE tenant user with a known password | ❌ **blocked** — the one user is `INVITED`, both invite tokens expired |

P3 and P4 are the whole blockage. Both unblocks are in
[DECISIONS.md#d13](DECISIONS.md).

---

## A · Session

| # | Step | Expect |
|---|---|---|
| A1 | Load `/login` | Renders in Arabic RTL by default. No layout flash, no theme flash — the pre-hydration script sets `lang`, `dir` and `.dark` before React |
| A2 | Toggle language | Every string switches. **Zero** untranslated strings. Direction mirrors: sidebar side, chevrons, toast corner |
| A3 | Toggle theme | Light ⇄ dark. The new primary `#066de9` reads as a bright cold blue, not navy |
| A4 | Submit an empty form | Inline field errors, focus moves to the first invalid field. **Not** a toast |
| A5 | Wrong password | A message distinguishable from a suspended account, a suspended tenant, a 429 and an offline failure (task 4.31) |
| A6 | Rate-limit — 6 failed logins in a minute | A 429 surface distinct from "wrong password". Login is throttled 5/min |
| A7 | Forgot password with a **different** address than the login field | The dialog's own address reaches the request body. This is defect **D1** — the field is currently unbound |
| A8 | Correct password | Lands on `/`. Session cookie set; **no token in `localStorage` or `sessionStorage`** — only non-secret metadata |
| A9 | Password manager | `autocomplete` attributes let it save and refill (audit B9) |
| A10 | Open a second tab | Cross-tab session sync — both tabs authenticated, one refresh between them |
| A11 | Sign out in tab 2 | Tab 1 notices and lands on `/login` |

## B · Shell

| # | Step | Expect |
|---|---|---|
| B1 | Sidebar | Only permitted items. Active item is a 2px logical bar + weight 500, **never a filled pill** |
| B2 | `Ctrl/Cmd+B` | Collapses to the 43.2px rail; tooltips appear on the correct side per direction |
| B3 | Reload while collapsed | Still collapsed, **no flash** — the state is read server-side from a cookie |
| B4 | Topbar | 39.6px at `--ui-scale` 0.9 |
| B5 | Below `lg` | Sidebar becomes a Sheet opening from the reading-start edge |
| B6 | Notifications | Unread count announced to a screen reader (audit B13) |
| B7 | `Tab` from the top | A skip link is the first focusable element (audit B6) |
| B8 | Density control | Compact / Default / Comfortable change row height live and survive reload |

## C · CRM — leads

| # | Step | Expect |
|---|---|---|
| C1 | `/crm/leads` | Table view. Rows 32.4px. **Count the rows visible at 1366×768 — expect 15** |
| C2 | **Arabic, populated table** | Diacritics and dots are not clipped. Measured headroom is **1.42px** on a fully-vocalised worst case (Q4) — this is the step that confirms it |
| C3 | Empty search | Empty state with a next action — **not** an error |
| C4 | Break the network, reload | Error state **with a retry**, and the empty state does **not** also render (task 3.25) |
| C5 | Create a lead | `FormDrawer`. Validate on blur, not per keystroke. 16px inputs on mobile widths |
| C6 | Close the drawer dirty | Discard confirmation — from the backdrop, `Escape` **and** Cancel alike |
| C7 | Submit | One toast. The row appears. **No second toast** for the same outcome |
| C8 | Create with a duplicate | The real backend message, not "failed" |
| C9 | Switch to **board** | Same data, grouped by lead stage from the tenant catalogue |
| C10 | Drag a card between stages | Optimistic move, then reconciliation. On failure it rolls back **and says so in-body**, not only in a toast |
| C11 | **Move a card without dragging** | The "Move to…" menu on the card. This is the WCAG AA fix (task 2.7) and the plan's highest-severity item |
| C12 | Keyboard: space, arrows, space | Card lifts, moves, drops |
| C13 | Switch to **card** view | Same data as a responsive grid |
| C14 | Paginate in table, then switch view | **Page, sort, filters and selection survive the switch** (task 2.6) |
| C15 | Deep-link `?view=board` | Lands on board. Refresh keeps it |
| C16 | Select rows, switch view | Selection survives; the bulk bar shows the count |
| C17 | Delete a lead | Confirm dialog. Cancel does nothing; confirm removes the row |

## D · CRM — conversion

| # | Step | Expect |
|---|---|---|
| D1 | Open a lead detail | Task 8.1 — does not exist yet |
| D2 | Convert to opportunity | The three-step `Stepper` (task 8.2) |
| D3 | Complete the conversion | An **in-body success panel** with links to the new customer and opportunity — `detail-screens.md` is explicit that this is **not a toast** |
| D4 | Convert again with the same idempotency key | Replay recognised as success, not a duplicate |
| D5 | Kill the network mid-convert | The **ambiguous-outcome panel** with the idempotency key and a retry-exact action — persistent, in-body |
| D6 | Check the opportunity | Appears in the pipeline, in the right stage |

## E · CRM — opportunities and customers

| # | Step | Expect |
|---|---|---|
| E1 | `/crm/opportunities` | Board grouped by the selected pipeline's stages |
| E2 | Tenant with no pipeline | An **empty state with a create action** — not a red error banner (task 3.28) |
| E3 | Drag to a terminal stage (WON/LOST) | A reason dialog first; cancelling leaves the card put |
| E4 | All three views | Consistent data, working pagination |
| E5 | `/crm/customer-profiles` | Three views; status changes reflect the real lifecycle |
| E6 | Open a customer detail | Contacts, custom fields, and the capability-gated action cluster |
| E7 | Open a **deleted** customer by URL | A not-found surface with a back action and **no retry button** |

## F · Permissions and lifecycle

| # | Step | Expect |
|---|---|---|
| F1 | A user without `crm.leads.read` | `/crm/leads` is not in the nav, and the URL lands on the release boundary |
| F2 | A user with `crm.leads.update.own` on someone else's record | No edit control — driven by the `capabilities` endpoint, not permission strings (defect D11) |
| F3 | Force a 403 in-body | `PermissionGate`, **never** an empty state |
| F4 | A `PAST_DUE` tenant | A `DegradedBanner`; writes blocked; only the owner can sign in |
| F5 | A `READ_ONLY` tenant | Every mutating affordance suppressed everywhere |
| F6 | A `SUSPENDED` tenant | Suspension panel, but `/login` still works for the owner |
| F7 | A `PROVISIONING` tenant | A real page, not Next's unstyled 404 (task 4.26) |
| F8 | Seat limit reached | An actionable message linking to the plan-change path |

## G · Cross-cutting

| # | Step | Expect |
|---|---|---|
| G1 | Every screen, keyboard only | Full traversal, visible focus, no trap, `Escape` closes, `Enter` activates |
| G2 | Dropdown inside a dialog, then a toast | The z-ladder holds: toast above overlay above dropdown (task 0.20) |
| G3 | Horizontal scroll with a sticky first column | The header stays above the column, not under it |
| G4 | Any money value | Rendered from the decimal **string**. Compare with the API response to the last decimal |
| G5 | Any UUID or correlation id | Monospace, wraps rather than overflowing, copyable |
| G6 | Force a 500 in a CRM route | The segment `error.tsx` catches it and **`AppShell` stays mounted** |
| G7 | Go offline | An offline surface. `TenantRealtimeProvider` already emits the events — something listens now |
| G8 | Leave a dirty page form | Unsaved-changes guard |
| G9 | Every enum on screen | A translated label, never a raw wire value |
| G10 | Arabic numerals | Western digits under `ar-EG-u-nu-latn` |

## H · Trade

Runs after Phase 10. Same shape as C–E: items, commercial accounts, quotations,
sales orders, the three views on each list, entitlement-blocked rendering when a
Trade feature is not subscribed, and the document lifecycle ladders with their
reason dialogs.

---

## Recording results

Append a dated run below. State the tenant, the user, and the browser. A step
that could not be reached is `BLOCKED`, never silently skipped.

### Run 1 — not yet started

Blocked on P3 and P4.
