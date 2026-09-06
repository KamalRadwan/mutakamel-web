# Manual Test Plan

Written: **2026-08-30** · Status: **Run 1 partially executed** — section A done,
B–H blocked on a usable login (see [DECISIONS.md#d13](DECISIONS.md))

> **The token layer moved on 2026-09-01.** The design system was replaced with
> the admin portal's, and the density default went from compact (`--ui-scale`
> 0.9) to standard (1). The **steps above the "Recording results" heading have
> been updated** to the sizes that now ship — two 45px full-width nav bars
> (2026-09-06, replacing the 48px topbar / 240px sidebar / 52px rail), 44px
> rows, 32px buttons, 36px fields, IBM Plex rather than Readex Pro.
>
> The **recorded runs below have not been rewritten.** They are the log of what
> a person actually observed on the date given, and editing an observation to
> agree with today's code destroys the only thing a run record is for. Where a
> run measured a value the port has since changed, it carries a superseded
> marker. Treat every figure below as historical.

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
| P3 | Request `Host` matches a verified FQDN | ✅ owner added the `hosts` entry; a localhost proxy presents the tenant Host to the Browser pane |
| P4 | An ACTIVE tenant user with a known password | ❌ **blocked** — the one user is `INVITED`, both invite tokens expired |

P4 is the remaining blockage. The supported unblock is
`POST /api/v1/admin/tenants/:id/users/:userId/resend-invite` from a super-admin
session, or accepting the invite from the email. See
[DECISIONS.md#d13](DECISIONS.md).

---

## A · Session

| # | Step | Expect |
|---|---|---|
| A1 | Load `/login` | Renders in Arabic RTL by default. No layout flash, no theme flash — the pre-hydration script sets `lang`, `dir` and `.dark` before React |
| A2 | Toggle language | Every string switches. **Zero** untranslated strings. Direction mirrors: brand zone and menu row swap edges, the nav sheet opens from the reading-start edge, chevrons, toast corner |
| A3 | Toggle theme | Light ⇄ dark. The primary `#1d4ed8` (`--color-brand-600`) reads as a saturated cobalt, not navy and not violet |
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
| B1 | Global nav | Only permitted sections. A section with one permitted screen is a **link**, not a menu. The active section's trigger carries a 2px bottom bar + weight 500, **never a filled pill** |
| B2 | `Ctrl/Cmd+B` | Collapses to the 52px rail; tooltips appear on the correct side per direction |
| B3 | Reload while collapsed | Still collapsed, **no flash** — the state is read server-side from a cookie |
| B4 | The two bars | 45px each at `--ui-scale` 1, 90px together. Brand zone 250px. Content column is the **full viewport width** |
| B5 | Below `xl` | The section menus disappear and the menu trigger opens a Sheet from the reading-start edge, listing every section with its full heading |
| B6 | Notifications | Unread count announced to a screen reader (audit B13) |
| B7 | `Tab` from the top | A skip link is the first focusable element (audit B6) |
| B8 | Density control | **Compact / Standard / Comfortable**. Standard is the default and writes no inline `--ui-scale`; compact writes `0.9`, comfortable `1.1`. All three change row height live and survive reload |
| B9 | Side by side with the admin portal | A button, an input and a table row are the **same physical size** in both portals. The chrome is deliberately **not** comparable any more — admin has a sidebar, this has two bars |

## C · CRM — leads

| # | Step | Expect |
|---|---|---|
| C1 | `/crm/leads` | Table view. Rows **44px**. **Count the rows visible at 1366×768 and record the number** — Run 1 measured 15 at the old 32.4px row, which the geometry port superseded. A derivation from that measurement lands near 10–11, but it compounds three assumptions (topbar +8.4px, `h-9` table header, `md:p-6`), so it is a sanity check, not the expectation. The count this run produces is the new baseline |
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
| C18 | Basic search, default field | The value control is a text box. Typing narrows by name, phone **or email** — a phone that is only on a contact method still matches |
| C19 | Switch the field to **Status** | The text box is replaced by a select, and the previous value is **cleared** — a name is not a status |
| C20 | Pick a value, then pick **All** | The filter is removed and the full list returns. `All` is the only way back, so it must exist on every value select |
| C21 | Filter on page 3 | The list returns to **page 1**. A filtered page 3 is not the page 3 you left |
| C22 | Watch the network tab through all of it | **One** filter key per request, never two, and never an empty one (`?status=` is a `400`) |
| C23 | Open **Create lead**, look at a contact row | Honorific, name, job title, number and email sit on **one line**, each box the width of what goes in it — an honorific is not as wide as an email |
| C24 | Open the job-title picker | A hundred titles, searchable, sorted in the language on screen, with **Other** last. Picking Other replaces the picker with a text box; the icon beside it goes back to the list |
| C25 | Look at the phone box before touching it | The code is already the country of **your own timezone**. Change it, then paste a full international number into the number box — the pasted code wins and the number splits across both boxes |
| C26 | Pick a contact from the directory | Only the name (read-only) and the job title remain. The honorific, phone and email disappear, because the service discards them for a reused party |
| C27 | Add a second number to a contact | It appears **below** the line, numbered, with its own remove control — the line itself does not grow sideways |
| C28 | On a customer profile, choose **Add contact** | It opens as a centred **card**, not a side drawer, and the same one-line contact fields are inside it |
| C29 | In the lead address, open **Country** | A searchable list of flag + country name. A country saved in the other language still shows its flag, and the stored text is not rewritten by opening the form |
| C30 | Open any source picker | Each row shows the tenant's uploaded icon; a source with none gets the megaphone; the “no source” row keeps an empty tile so the labels stay aligned |
| C31 | Look at any field on any CRM form | The label is **inside** the control's box, above the value — and it is a real label: click it and the control focuses, type and it stays |
| C32 | Switch Lead type between Company and Individual | The person's line and a contact's line are the **same** control set in the same widths. The only difference is the job title, which a person does not have |
| C33 | On a contact line, press the green **+** | A second number appears **under the first**, inside the phone column — not across the line and not under the honorific |
| C34 | Compare a form against the old screenshots | Every text control is one step smaller (`sm`). On a phone, a focused input is still 16px — iOS must not zoom |
| C35 | On Leads or Opportunities, switch to Card or Table | A chevron stage bar sits above the list: `All` first, then one segment per stage, each pointing into the next. In Arabic the arrows point the other way and the labels do not |
| C36 | Press a stage, then press it again | The list filters, then clears. Press one and switch Card↔Table — the choice survives. Change the pipeline or the branch — it clears, and no request goes out carrying the old pipeline's stage |

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
| E8 | On `/crm/customer-profiles`, run C18–C22 again | The same basic search, over this screen's four fields: free text, Status, Customer type, Source. **One** filter key per request, never two, never empty, and a change returns to page 1 |
| E9 | Pick **Source**, and compare a row with the create modal's picker | The same icon-and-name row. The catalogue is fetched **once** for the screen — the bar reuses the modal's, so no second `/acquisition-sources` request appears |
| E10 | `/crm/pipelines`, type in the search box | One box, no field picker. It narrows by **Arabic name, English name and code**, with no network request at all — `GET /pipelines` takes no query parameters, so the filter can only be client-side |

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

### Run 1 — 2026-08-30

Tenant `mersany` · host `mersany.mutakamel.ai` · backend stack live · Chromium
via a localhost proxy that presents the tenant Host (the Browser pane only
reaches `localhost`; the proxy is a test harness in the scratchpad, nothing
shipped).

**P3 resolved.** The owner added the `hosts` entry. Getting from there to a
served page took three fixes, all of which had every gate green — see the
"Defects found by driving the app" section below.

**P4 still open.** The one tenant user is `INVITED` with no password and both
invite tokens expired. The supported unblock is
`POST /api/v1/admin/tenants/:id/users/:userId/resend-invite`, which needs a
super-admin session, or activating the account through the invite email.

| Step | Result | Notes |
|---|---|---|
| A1 login renders | **PASS** | Only after fixing three defects; it was a 404, then a degraded screen |
| A2 language toggle | **PASS** | `ar`/`rtl` → `en`/`ltr`; heading, submit, labels and the forgot link all switch. No untranslated string on this screen |
| A3 theme toggle | **PASS** | dark → light, no flash, strings unaffected |
| A4 empty submit | **PASS** | Native `required` blocks it and focus lands on the first invalid field. Note: satisfied by the browser, not by `Field` — the design system's own error path is untested here |
| A5 wrong password | **PASS** | Real backend message: "Sign-in failed / Invalid email or password." Surfaced **only as a toast**; there is no in-body error. **Not** discriminated from suspended-account / suspended-tenant / 429 / offline — that is task 4.31, still open |
| A6 rate limit | not run | Needs 6 attempts; deferred so as not to throttle the shared dev tenant |
| A7 forgot-password address | **PASS — and D1 is stale** | Typed `LOGIN-FIELD@…` into the login field and `DIALOG-FIELD@…` into the dialog, then captured the wire: the body carried `{"email":"DIALOG-FIELD@mersany.com"}`. The dialog's field **is** bound. `DEFECTS.md` D1 describes a bug that no longer exists |
| A8–A11 session, cross-tab | **BLOCKED** | P4 |
| B, C, D, E, F, H | **BLOCKED** | P4 |
| Design tokens in situ | **PASS · superseded 2026-09-01** | As measured on the day: `--ui-scale` 0.9 live: control `lg` 32.4 px, input 32.4 px, Arabic `text-sm` 15 px, radius unchanged at 4 px. `--primary` resolves to `oklch(0.716 0.147 258)` in dark (brand-400) and `oklch(0.56 0.204 258)` in light (brand-600). **Every figure in this row was changed by the port**: scale 1, control `lg` 36 px, radius 4 px unchanged but `xs` 2→3 px, and `--primary` is now the admin cobalt (`oklch(0.488198 0.217165 264.376)` light, `brand-400` dark). Re-run this check |
| Q4 Arabic at a 32.4 px row | **PASS · superseded 2026-09-01** | Measured with the real face: 24.4 px available ink, 15 px for ordinary Arabic, 22.98 px fully vocalised — 1.42 px headroom. **Two inputs changed**: the row is now 44 px, and the face is IBM Plex Sans Arabic, not Readex Pro. The headroom this bought can only have grown — a taller row with the same type — so nothing is at risk, but the 1.42 px number no longer describes anything. Re-measure against Plex Arabic before quoting it |

### Defects found by driving the app — Run 1

None of these was catchable from `pnpm verify`; all three were green throughout.

1. **Host admission could never succeed.** `fetch` silently drops the `host`
   header — it is forbidden by the fetch standard — so the Gateway saw the
   internal origin's own authority and answered `TENANT_HOST_NOT_FOUND`. Every
   page 404'd. The unit test asserted the header on the init object passed to a
   **mock** fetch, so it verified intent and never the wire. **Fixed**, with a
   test that stands up a real server and asserts the header that arrived.

2. **A first-time visitor could never reach the login form.** An unauthenticated
   `/auth/me` returns `COMMON.AUTH.MISSING_BEARER_TOKEN`, which is not in
   `SESSION_ENDING_AUTH_CODES`, so bootstrap fell through to DEGRADED and
   rendered "we could not verify your session". Two causes: the transport
   attempted a refresh for a session that never existed and threw the refresh's
   coordination failure in place of the honest 401, and bootstrap had no notion
   of "signed out" distinct from "inconclusive". **Fixed** on both sides.

3. **Readex Pro never drew a glyph.** The font block used `@theme inline`,
   which in Tailwind v4 means "inline into utilities, do not emit the
   variable" — so `--font-sans` did not exist and `body { font-family:
   var(--font-sans) }` resolved to nothing. Both faces downloaded on every page
   load and the app rendered in the system stack. Proven by measuring a probe:
   forcing the family changed its width by 18 % before the fix, 0 % after.
   **Fixed.**

   The face named here is gone — the 2026-09-01 port swapped Readex Pro for IBM
   Plex — but the defect is not about a face, it is about `@theme inline`, and
   that trap is still live in `globals.css`. The port kept the plain `@theme`
   this fix installed, and the probe described above is still the way to prove
   a font is drawn rather than merely downloaded.

### Confirmed live, still open

- **`cursor: default` on the primary button** — audit B8, task 3.4.
- **No in-body error on login** — every failure is a toast.
- `TenantAuthGuard`'s loading and degraded screens are still hardcoded Arabic
  with raw palette classes — defect D16, tasks 3.12–3.14.

---

## Run 2 — 2026-08-31 · pre-auth surfaces and the token layer

**Still blocked at P4.** The one tenant user is `INVITED`; both invite tokens
have expired, so no authenticated session exists and sections B–H remain
unrunnable. Sections that need no session were run instead.

| Check | Result |
| --- | --- |
| Stack reachable | All nine containers healthy; Gateway answers `200` for the tenant Host |
| `GET /branding/public` (pre-auth) | **200** — the three `@Public()` branding routes the login screen needs do resolve from the host |
| `GET /auth/me` unauthenticated | **401**, then the login form renders. Correct fail-closed path |
| Login screen renders | Yes — heading, email, password, forgot-password, remember-session, submit, footer |
| Readex Pro | Loads and applies (`"Readex Pro", "Readex Pro Fallback", …`) — D20 stays fixed. **Superseded 2026-09-01:** the portal now loads IBM Plex Sans + Plex Sans Arabic + Plex Mono. What this row really verified — that the face reaches the page rather than silently falling back to the system stack — is still the check worth re-running, against the new family names |
| Theme flip, light → dark | **Verified.** All 23 semantic tokens remap onto the new ramps; `--primary` is exactly D1's pair; `--card`'s literal `white` becomes `ink-950`. **Superseded 2026-09-01:** there are more than 23 roles now (the `info`/`success`/`warning` families, `-subtle`/`-vivid`, `selected`, the `chart-*` and `sidebar-*` sets all arrived with the port), and `--primary` is the admin cobalt. The mechanism is unchanged; the inventory is not |
| Density, stored preference | **Verified.** `comfortable` → bootstrap writes `--ui-scale: 1.1` before hydration; row 32.4 px → **39.6 px**, sidebar 208.8 px → **255.2 px**. **Superseded 2026-09-01:** the base is now scale 1, so comfortable reads row 44 → **48.4 px**, sidebar 240 → **264 px**. Note the inverted case to re-test: *standard* is now the density that writes nothing, where compact used to be |
| Density, live change with no reload | **Not verifiable in this harness** — see below |

### The harness cannot observe live style changes, and nearly cost two false defects

Changing density without a reload appeared to do nothing, and the same appeared
true of an attribute-driven rewrite. Both readings were wrong. The control that
settled it: setting a plain `height: 77px` — no custom property anywhere — on
the same element still read back as `32.3906px`. **The browser pane was not
re-running layout at all**, so every live-mutation measurement taken in it was
meaningless.

Fresh-load measurements *are* reliable, which is why the table above is stated
in those terms. Anything requiring observation of an in-place change needs a
real browser session.

**The rule this earns: a measurement is not trustworthy until it has been seen
to detect a change you know you made.** It is the instrument-side twin of *a
gate is not done until it has rejected something* — the rule that had already
caught the dead z-index selector and, this run, the vacuous zebra check
([DEFECTS.md](DEFECTS.md) D21).

### What P4 is still blocking

- MASTER-PLAN **0.10, 0.20, 0.28, 0.33** — every remaining Phase 0 task is an
  eyes-on pass over authenticated screens
- **3.19** — the keyboard-only pass, which `accessibility.md` is explicit no
  mechanical gate can replace
- Manual test sections **B–H**, including the whole CRM script
- CRM specifically is blocked twice over: **Q17** (grants) would still stop it
  even with a session
