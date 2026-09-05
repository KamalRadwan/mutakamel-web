# Known Defects

Written: **2026-08-27**

Found by survey of the working tree on 2026-08-27. Each was verified in source,
not inferred. Fix them **during** the phase named, not in a cleanup pass.

---

## D1 — Forgot-password sends the wrong address

> **STALE — this defect no longer exists.** Verified 2026-08-30 by driving the running app: typed a
> distinct address into the dialog while the login field held a different one,
> and captured the wire — the body carried the **dialog's** address. The field
> is bound. Left here with its original text because the reasoning is the
> value; do not re-fix it.

**Severity: functional. Users cannot reset their password reliably.**

`src/app/login/page.tsx` renders the reset dialog's email field with no
`value` and no `onChange` — it is entirely unbound:

```tsx
<input type="email" placeholder="name@company.com" className="…" required />
```

`useLogin.ts`'s `handleForgotPassword` posts `{ email }` from the **login
form's** state. Whatever the user types into the dialog is discarded; the
request goes to whatever is in the login field, including an empty string.

**Fix in phase 4.** Give the dialog its own state, or lift a shared
`resetEmail`. Add a test that types a distinct address into the dialog and
asserts it reaches the request body.

Files: `src/app/login/page.tsx`, `src/app/login/hooks/useLogin.ts`

---

## D2 — Seven animated surfaces have no animation

**Fixed.** The design system now carries 45 animation and transition utilities, and `docs/design/motion.md` states the budget each obeys — including the height-transition ban and its one narrow carve-out for library-measured disclosure panels.

`animate-in`, `fade-in`, `slide-in-from-top-2`, `zoom-in-95`,
`animate-fade-in` and `animate-gradient-x` are used across the notifications
dropdown, user dropdown, pipeline select, country select, toast and modal
scrim. **None are defined** — neither `tw-animate-css` nor
`tailwindcss-animate` is installed and `globals.css` imports no animation
plugin. Only `animate-bell-ring` is real.

**Fix in phase 2.** `pnpm add tw-animate-css` and import it in `globals.css`.
See [../design/motion.md](../design/motion.md#install-the-plugin).

---

## D3 — Dark mode applies only where the toggle mounts

**Fixed.** The `.dark` class is written by the pre-hydration bootstrap in `src/app/layout.tsx`, on `documentElement`, before the first paint. `ThemeProvider` then keeps it in sync through `useSyncExternalStore`, so it no longer depends on where the toggle happens to mount — see [theming.md](../design/theming.md).

`ThemeToggle` writes `document.documentElement.classList` from its own
`useEffect`. The stored theme is therefore applied only on pages that render
the toggle, and always one frame late. There is no `ThemeProvider` anywhere —
theme is a side effect of a button being mounted.

**Fix in phase 2.** Pre-hydration bootstrap script + a provider reading the
same key via `useSyncExternalStore`. See
[../design/theming.md](../design/theming.md#no-flash--the-mechanism).

---

## D4 — Wrong direction on the first frame for English users

**Fixed.** The same pre-hydration bootstrap sets `lang` and `dir` on `documentElement` before React hydrates, so an English user never sees an RTL first frame.

`src/app/layout.tsx` hardcodes `lang="ar" dir="rtl"`; `I18nContext` corrects
it in a `useEffect` after hydration. Every English-preferring user sees one
RTL frame on every load.

**Fix in phase 2**, same mechanism as D3.

---

## D5 — Login page is entirely hardcoded Arabic

**Fixed.** No hardcoded user-facing strings remain in `src/app/login/page.tsx` — the only non-ASCII characters left are em-dashes inside English code comments. The ESLint language gate covers the file, and it now catches nested ternaries too, which is how a hardcoded pair slipped past it once.

`src/app/login/page.tsx` renders the language toggle and contains **zero**
dictionary lookups. Switching to English changes nothing on the one page every
user must pass through.

**Fix in phase 4.** Every string into both dictionaries.

---

## D6 — Three conflicting shell heights

**Fixed.** One height token, `--size-topbar`, used everywhere in the shell. `Topbar.tsx` carries the note.

| Site | Value |
| --- | --- |
| `Navbar.tsx` header | `h-[45px]` |
| `NotificationsDropdown` / `UserDropdown` anchor | `top-[49px]` |
| `leads-workspace.tsx` container | `h-[calc(100vh-3.5rem)]` = 56px |

An 11px overshoot on the leads view, and three magic numbers for one dimension.

**Fix in phase 3.** One `--size-topbar` token. Also switch `100vh` → `100dvh`
so mobile browser chrome does not clip the board.

---

## D7 — `typecheck` is red on a stale artifact

**Fixed.** `tsc --noEmit` reports zero errors in `.next/types/`. Verified 2026-08-31, when every error in the tree was in an agent's in-flight `src/app/(tenant)/trade/**` file and none was a stale generated artifact.

`tsc --noEmit` exits 1 with six errors, **all** in `.next/types/`, pointing at
a `src/app/page.tsx` that an uncommitted change moved to
`(tenant)/page.tsx`. Zero real source errors.

`tsconfig.json` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`,
so the stale generated types are typechecked.

**Workaround now:** `rm -rf .next` before `pnpm typecheck`.
**Fix in phase 1:** add a `pretypecheck` that clears `.next/types`, or drop the
generated types from `include`. Do not leave the gate red.

---

## D8 — `docs:routes:check` cannot pass on Windows

**Fixed.** `pnpm docs:routes:check` passes on Windows. Verified 2026-08-31.

`core.autocrlf=true` and there is no `.gitattributes`, so the committed
`docs/generated/tenant-api-routes.json` has CRLF while the generator writes LF.
The drift check compares text and always fails.

Regenerating on 2026-08-27 confirmed the route content is byte-identical —
573 routes, same 199/143/231 split. Only the timestamp and the backend source
hash moved.

**Fixed in this docs rebuild** by adding `.gitattributes`:

```text
docs/generated/** text eol=lf
*.mjs text eol=lf
```

**Verified 2026-08-31** (MASTER-PLAN task 3.40). With `core.autocrlf=true`
still set globally, a fresh `git clone` of the frontend repository checks the
generated files out as LF:

```text
$ git ls-files --eol tenant-portal/docs/generated/
i/lf  w/lf  attr/text eol=lf   tenant-portal/docs/generated/tenant-api-routes.json
i/lf  w/lf  attr/text eol=lf   tenant-portal/docs/generated/tenant-api-routes.md
```

`w/lf` is the load-bearing column: the working tree is LF *despite*
`autocrlf=true`, which is exactly the condition that made the drift check
unpassable. `npm run docs:routes:check` then reports **"Tenant route inventory
is current (569 routes)"**.

One loose end, harmless: `scripts/docs/generate-route-inventory.mjs` still
shows `w/crlf` in the *existing* working tree, because it was written before
`.gitattributes` landed and has not been re-checked-out since. A fresh clone
gets LF. Only the generated output's line endings affect the check.

---

## D9 — Transport's forbidden toast is hardcoded English

> **STALE — this defect no longer exists.** Verified 2026-08-31 by reading
> `src/lib/api/axiosClient.ts`: `dispatchForbiddenToast()` reads the same
> `tenant_lang` key `useLanguage()` does and selects between the same two
> dictionary objects `I18nContext` does, so the toast is
> `t.errors.accessDenied` / `t.errors.accessDeniedMessage` in both languages.
> The strings live only in `i18n/dictionaries/`, not duplicated in the
> transport. Left here with its original text because the reasoning is the
> value; do not re-fix it. MASTER-PLAN 4.4 is closed on that basis.

`dispatchForbiddenToast()` in `src/lib/api/axiosClient.ts` hardcodes
`"Access Denied"` / `"You do not have permission to perform this action."`

This is the **one permitted i18n change inside the transport** — see
[../architecture/data-layer.md](../architecture/data-layer.md#permitted-changes).
Everything else in that file is out of scope.

**Fix in phase 4.**

---

## D10 — Hue-coded view switcher

**Fixed.** `ViewSwitcher` marks the active option with `bg-secondary` and never a coloured fill; `BoardColumn` identifies a column by position and label, never a hue. Both files carry the reasoning inline.

`leads-workspace.tsx` tints the active view button **purple, emerald or
amber** depending on which view is selected. Three hues, one control, no
meaning.

**Fix in phase 3** by replacing it with `ViewSwitcher` — see
[../design/views.md](../design/views.md#the-switcher).

---

## D11 — Actions gated by permission strings, not capabilities

**Narrowed, not closed — deliberately deferred.** Phases 8A and 8B wired the `capabilities` endpoints for every screen they own, and 8A found the real cause: the three CRM capabilities routes are `BRANCH_REQUIRED`, and only the `branchId` *query parameter* was being sent, so the Gateway answered `400 GW.REQUEST.INVALID` and every control degraded silently to "unavailable". That is fixed. What remains is a backend gap, not a portal one: **`activities.update` is exposed by no capabilities endpoint at all**, so update and cancel still fall back to a scoped permission string — recorded as Q53.

`useLeads.ts` derives `canCreate` / `canUpdateLead` / `canDeleteLead` from
`/auth/me` permission strings. CRM exposes per-branch `capabilities`
endpoints that already account for branch **and owner** scope.

Consequence: a user with `crm.leads.update.own` currently sees an edit control
on records they do not own.

**Fix in phase 4.** See [../api/crm-leads.md](../api/crm-leads.md#get-leadscapabilities).

---

## D12 — "Kanban" in user-facing copy

**Fixed.** `grep -rni kanban src/` returns zero hits. Verified 2026-08-31.

`t.crm.kanbanBoard`, `t.crm.pipelinesKanbanBoards`,
`t.crm.buildInteractiveKanbanStyle`. The view is called **board**.

**Fix in phase 4.** See [../design/views.md](../design/views.md#naming--kanban-is-dead).

---

## D13 — Three fabricated Trade endpoints

**Superseded by a gate.** `pnpm docs:verify-called-routes` now fails the build on any path absent from the Gateway contract, so a fabricated endpoint cannot survive a green run. It is currently reporting in-flight Trade paths from Phases 10-12; re-confirm at the close of Phase 12 rather than treating this entry as the record.

`src/app/(tenant)/trade/dashboard-widgets/hooks/useTradeDashboardWidgets.ts`
calls three paths that **do not exist**:

```text
/api/tenant/trade/v1/analytics/daily-revenue
/api/tenant/trade/v1/credit/available-limit
/api/tenant/trade/v1/products/top-selling
```

Not "not Gateway-exposed" — **not implemented at all**. `grep` across
`trade-app/src` returns **zero controllers** for any of them. They were invented
alongside the widget scaffold and could only ever have produced a Gateway 404.

This is the clearest evidence yet that the sealed Trade tree is speculative UI
rather than an unfinished integration.

**Fix in phase 1:** deleted with the rest of `(tenant)/trade/`. Nothing to
port, nothing to reconcile with the backend. **Do not** ask for Gateway routes
to be added to make them work.

Found by `pnpm docs:verify-called-routes`, which is now a standing gate — see
[../architecture/data-layer.md](../architecture/data-layer.md).

---

## D14 — Missing `"use client"` took every route down

**Fixed.** `next build` compiles. 117 of 120 `page.tsx` files are client components; the three that are not are server components by design.

**Severity: total outage. Found by driving the app, not by any gate.**

`src/design-system/views/board/BoardColumn.tsx` imports `Droppable` from
`@hello-pangea/dnd` without the `"use client"` directive. Its two siblings —
`BoardCard.tsx` and `BoardView.tsx` — both have it.

Because the `@/design-system` barrel is imported by the **root layout**, that
one omission pulled a React class component into the server module graph for
*every* route:

```
TypeError: Class extends value undefined is not a constructor or null
  at BoardColumn.tsx  →  design-system/index.ts  →  app/layout.tsx
```

`/` and `/login` both returned **500**. The app could not serve a single page.

**Fixed** by adding the directive (matching the siblings). Verified by
restarting the dev server and reloading both routes.

### Why nothing caught it

`typecheck`, `lint`, `test` and `build` were all green — none of them execute
a server render. Only loading a page in a browser surfaces it.

**The lesson worth keeping:** a green gate run is not evidence the app runs.
Every phase needs one actual page load.

### The wider risk

22 of 25 primitives — including `Button` and `Dialog` — also omit
`"use client"`. They are **not** currently breaking: Radix's hook-based
exports have no top-level `class extends`, which is what `@hello-pangea/dnd`
does. But the inconsistency is real, and it is one dependency change away from
repeating this outage.

**Action:** add `"use client"` to every primitive that imports a client-only
library, so the rule is "all of them" rather than "the ones that happen to
break".

---

## D15 — `pnpm dev` cannot start

**Fixed.** `pnpm dev` starts and serves pages — driven on 2026-08-31 through the tenant-host proxy, which is how the login screen, the theme flip and the density preference were all measured live.

Next 16 defaults to Turbopack. `next.config.ts` still carries a `webpack()`
customization and the `dev` script does not pass `--webpack` — so the dev
server exits immediately:

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
[ELIFECYCLE] Command failed with exit code 1.
```

`build` already passes `--webpack`; `dev` was never updated. **Pre-existing** —
confirmed present before the rebuild via `git show 68466d3^`.

**Workaround:** `npx next dev -p 5002 --webpack`.

**Fix:** either add `--webpack` to the `dev` script, or migrate the
`watchOptions` block to a `turbopack` config and drop the webpack one. The
second is the better end state; the first unblocks today.

---

## D16 — Two auth screens were never converted · **fixed 2026-08-31**

`src/components/auth/TenantAuthGuard.tsx` and
`TenantHostStateBoundary.tsx` still carry the **original** pre-rebuild code:
raw `slate-950` / `amber-*` / `blue-600` palette classes, `rounded-xl` and
`rounded-2xl`, and **unconditionally hardcoded Arabic** with no English path.

They render on every session-loading flicker and on any degraded or suspended
tenant state — the paths a real outage actually goes through.

They were missed because they fit neither bucket in the phase plan: they do
not import `components/ui/*` (so the delete sweep did not reach them) and they
are not one of the 11 screens in Phase 4 (they are cross-cutting auth chrome).

**Fix:** convert both onto the design system and move every string into both
dictionaries. Together they account for most of the remaining census debt in
D17 below.

**Done** (MASTER-PLAN 3.12–3.14). Both now use tokens, `Button`, and the new
`sessionGuard` / `hostState` dictionary namespaces. The loading state gained
`role="status"` + `aria-busy`, which is also the spinner's reduced-motion
fallback, and the degraded state gained `role="alert"`.

Two notes on how:

- `HANDOFF.md` fenced `src/components/auth/` as Tier 1. It was **amended
  first**, adding a third permitted change scoped to presentation only —
  a binding document is not amended by editing the files it protects
  ([HANDOFF.md](HANDOFF.md#amendment--2026-08-31--a-third-permitted-change)).
  `TenantHostAdmission.tsx` and `TenantPortalRuntime.tsx` stay fenced in full.
- `TenantHostStateBoundary` sits **above** the app's `I18nProvider` —
  `TenantHostAdmission` wraps `TenantPortalRuntime`, not the other way round —
  so its chrome brings its own provider rather than reordering the runtime
  tree. `I18nProvider` holds no state of its own, so the nesting on the
  `/login` path costs nothing.

With those files converted, `eslint.config.mjs`'s `src/components/auth/**`
exclusion came out: the design rules now cover all four files.

---

## D17 — The census baseline was banked with violations in it · **fixed 2026-08-31**

`docs/design/census.baseline.json` was committed carrying
`roundedXlOrAbove: 4`, `languageTernaries: 19`, `colorFamiliesInUse: 3` and
`colorUtilityTotal: 19` — rather than being driven to the zero targets that
[enforcement.md](../design/enforcement.md) and
[anti-patterns.md](../design/anti-patterns.md) actually state.

`pnpm design:census -- --check` therefore reports **clean**, which is true
against its own baseline and misleading against the documented standard.

Most of the remaining count is D16's two files. Of the 19 counted
`languageTernaries`, roughly 13–15 are
`lang === "ar" ? item.nameAr : item.nameEn` — selecting between two
**backend-supplied bilingual data fields**, not choosing UI copy. That is
architecturally different from what the zero-ternary rule targets, and
[i18n.md](../design/i18n.md) never carved out the exception.

**Fix, in order:**

1. Convert D16's two files — that clears most of the color and radius counts.
2. Decide explicitly whether bilingual **data-field** selection is exempt from
   the zero-ternary rule, and write that into `i18n.md` either way.
3. Only then re-baseline, so the numbers mean what the docs say they mean.

**Done** (MASTER-PLAN 3.12, 3.15, 3.17, 3.30), and one step was added in front
of all three: **the census itself was wrong**, so re-baselining against it
could not have been honest. It skipped `src/design-system/` entirely, counted
only the 22 Tailwind families (so every `brand-*`/`ink-*` ramp step in feature
code was invisible), and its gradient matcher used Tailwind v3's spelling
against a v4 codebase. All three are fixed —
[enforcement.md](../design/enforcement.md#the-three-things-330-fixed).

Outcome: `colorUtilityTotal`, `colorFamiliesInUse`, `roundedXlOrAbove`,
`fontBoldOrHeavier`, `arbitraryTypeSize` and `handRolledTables` are all **0**
in feature code. Two counters have a floor above zero, and both have every
site named in
[enforcement.md](../design/enforcement.md#the-two-counters-that-cannot-reach-zero-and-why)
rather than a footnote: `languageTernaries` 5 and `handRolledButtons` 2.

---

## Not defects

Deliberate, do not "fix":

- **45 sealed routes** — a release boundary that prevents fabricated data
  reaching users. They get deleted, not unsealed.
- **Arabic-first defaults** — a product decision.
- **`/trade` rendering unavailable** — the Trade backend is real; the UI is not
  built.

## Now scheduled

- **Security headers and CSP.** Nothing in `next.config.ts` or `proxy.ts` sets
  them today. Resolved: **Nginx Proxy Manager** owns the transport headers, the
  app owns CSP because it needs a per-request nonce for the theme bootstrap
  script. Full configuration in
  [../architecture/security-headers.md](../architecture/security-headers.md).

---

## D18 — Host admission could never succeed · **fixed 2026-08-30**

**Severity: total outage. Every page 404'd against a real Gateway.**

`fetchTenantHostStatus` sent the tenant's Host header through `fetch`. `host` is
a **forbidden header name** in the fetch standard, so undici drops it silently.
The Gateway saw the internal origin's own authority and answered
`TENANT_HOST_NOT_FOUND`; admission fails closed, so `notFound()` fired on every
request.

### Why nothing caught it

The unit test asserted `new Headers(init.headers).get("host")` on the init
object handed to a **mock** fetch. That records what the caller *intended* to
send, never what the socket carried. It passed throughout.

**Fixed** by moving the probe to `node:http`, where `Host` is settable, and
adding a test that stands up a real server and asserts the header that arrived.

**The lesson worth keeping:** a header assertion against a mock transport proves
nothing about the wire.

---

## D19 — A first-time visitor could never reach the login form · **fixed 2026-08-30**

**Severity: total. Nobody who was not already signed in could sign in.**

`GET /auth/me` with no cookie returns `401 COMMON.AUTH.MISSING_BEARER_TOKEN`.
That code is not in `SESSION_ENDING_AUTH_CODES`, so `isDefinitiveAuthFailure`
was false, bootstrap fell through to `DEGRADED`, and the app rendered
"تعذر التحقق من الجلسة حاليًا" with a retry button instead of the login form.

Two independent causes:

1. The transport attempted a **session refresh for a session that never
   existed** — a 401 with an unrecognised code classifies as `"refresh"` — and
   threw the refresh's own coordination failure in place of the honest 401.
2. `bootstrap` had no state for "signed out" as distinct from "inconclusive".

**Fixed:** refresh now requires prior session metadata
(`request.hadSessionMetadata`), and a missing-credentials 401 resolves to
`UNAUTHENTICATED`.

---

## D20 — Readex Pro never drew a glyph · **fixed 2026-08-30**

**Severity: the entire typography system was inert.**

`globals.css` declared the font bridge with `@theme inline`. Under Tailwind v4
`inline` means *substitute this value into utilities and do not emit the custom
property* — so `--font-sans` did not exist at runtime and
`body { font-family: var(--font-sans) }` resolved to nothing. Both faces were
downloaded on every page load and the app rendered in the browser's system
stack.

Proven by measuring a probe in the running app: forcing `"Readex Pro"` changed
its width by **18 %** before the fix and **0 %** after.

**Fixed** by having `body` reference `--font-readex` directly. `@theme` alone is
not enough — Tailwind v4 tree-shakes a theme variable that no generated utility
uses.

**Consequence:** every typography decision in `docs/design/typography.md` — the
one-superfamily premise, the Arabic lift, the 13px floor, `font-synthesis-weight`
— had never actually been exercised. Q4's measurement was taken with the real
face loaded manually, so its answer stands.

**Superseded 2026-09-01:** the faces are now IBM Plex Sans, IBM Plex Sans
Arabic and IBM Plex Mono, so `--font-readex` no longer exists — `body`
references `var(--font-plex-latin), var(--font-plex-arabic), …` directly. The
fix survived the port unchanged in shape, and deliberately: `globals.css` still
declines to route `body` through `--font-sans`, and carries a comment recording
this defect as the reason. The lesson is the durable part — Tailwind v4
tree-shakes a theme variable no generated utility uses, so a font bridge
declared with `@theme inline` alone is inert at runtime. Q4's answer is itself
superseded on other grounds; see OPEN-QUESTIONS.md.

---

## D21 — The zebra contrast check could never fail · **fixed 2026-08-31**

**Severity: the only gate covering zebra separation was vacuous, and it was
checking a pair the product does not render.**

`scripts/design/contrast.mjs` carried one zebra claim:

```js
["zebra row separation (non-text)", "ink-25", "white", 1.0, null],
```

Two independent faults in one line:

1. **A required ratio of `1.0` is satisfied by two identical colours.** The
   contrast of a colour with itself is exactly 1.00, and `1.00 >= 1.0` passes.
   The check could not fail for any input, including the input it exists to
   catch.
2. **It compared the zebra against `white`** — that is `--card`. But
   `DataTable`'s wrapper sets no background at all
   (`overflow-x-auto rounded-md border border-border`), and `AppShell` renders
   the workspace on `bg-canvas`. Rows therefore stripe against `--canvas`, in
   both themes. The gate measured a pairing that never appears on screen.

Found while verifying task 0.9 against the running app. The route there is
worth recording, because the first conclusion was wrong: reading the dark
tokens showed `--row-zebra` and `--card` are **both** `ink-950`, which looked
like an invisible zebra and was nearly filed as a token defect. It is not one —
tables do not sit on `--card`. Checking *what the component actually renders
on* turned a false defect into a real one, one level down in the gate.

**Fixed** by replacing the single claim with the two pairs the product renders,
at a threshold identical colours fail:

```js
["zebra vs canvas · light (non-text)", "ink-25",  "ink-100",  1.02, null],
["zebra vs canvas · dark (non-text)",  "ink-950", "ink-1000", 1.02, null],
```

Measured 1.08 light and 1.06 dark — real separation in both themes, so no
token needed changing. `1.02` is not a legibility threshold; zebra is non-text
separation and is meant to be barely there. It is set just above 1.00 so that
sameness is the thing that fails.

**Verified by making it fail.** Pointing the dark pair at `ink-950` on both
sides produced `FAIL 1.00` and a non-zero exit; the same input passed before
the fix. The report also printed its own threshold through `toFixed(1)`, which
rendered `1.02` as `1.0` — the very value it replaced — so the report was
corrected too. A gate that misdescribes its own threshold invites the next
person to re-introduce the bug.

---

## D22 — Seven CRM screens are built and reachable but absent from the sidebar · **open**

**Severity: a user who does not know the URL cannot find them.**

Phase 8B built `/crm/pipelines`, `/crm/opportunity-stages`, `/crm/activities`,
`/crm/tasks`, `/crm/calendar`, `/crm/reminders` and `/crm/outbound-emails`.
Both files that would link them — `src/lib/navigation/tenant-routes.ts` and
`src/design-system/shell/nav-config.ts` — were outside that phase's ownership.

**Half fixed 2026-08-31.** `tenant-routes.ts` now admits all seven and includes
them in `CRM_ENTRY_ROUTES`, so the pages load by URL and an actor whose only
CRM grant is `crm.activities.read` lands on `/crm/activities` instead of being
told they have no CRM access. Ordering was corrected in the same pass: the
seven were first placed *ahead* of leads, which would have dropped a pipeline
manager onto a configuration screen instead of their records. A test now pins
that records outrank configuration.

**Still open:** the `nav-config.ts` sidebar rows and their seven `t.nav.*`
dictionary keys. Deferred deliberately — three Trade agents are appending to
`nav-config.ts` and both dictionaries right now, and an edit landing in the
middle of theirs is how the `en.ts`/`ar.ts` divergence already broke typecheck
repo-wide once today.

Permissions to use, read off each screen's route rather than guessed:
`crm.pipelines.read` for pipelines; **`crm.pipelines.manage` for
opportunity-stages** — all five of its routes require `.manage`, including
both GETs; `crm.activities.read` (scoped) for the other five.

This is the same failure shape as [Q40](OPEN-QUESTIONS.md): a screen is
complete, tested and green while nothing can reach it, because admission and
linking live in files the builder does not own. Neither `pnpm verify` nor any
test connects a route to its entry point.

---

## D23 — Editing a widget's name can destroy its query spec · **fixed 2026-08-31**

**Severity: silent, irreversible data loss on a user's own saved work.**

Found by the external CRM audit (P1-05 / R3) and **verified here on both sides
of the wire** rather than accepted:

- `widgets/widget-form.ts:121` — `buildQuerySpec` constructs a **fresh** object
  carrying only `series: [{ metricKey }]`, `dimension`, and optionally
  `comparison`. Any `filters`, any second series, and any semantic settings on
  the stored widget are not read and not re-emitted.
- `widgets/widget-form.ts:148` — `widgetToForm` reads `series[0].metricKey` and
  discards the rest.
- `crm-app/src/crm/dashboards/dashboard-widgets.service.ts:181` — the UPDATE
  sets `query_spec = $6::jsonb` **unconditionally**, while `name` and
  `display_spec` are guarded by `CASE WHEN $3 THEN … ELSE … END`.

So the API already has a "leave this field alone" mechanism and does not use it
for the one field a client cannot safely reconstruct.

**It is reachable, not theoretical.** `widgets/[id]/components/widget-detail-workspace.tsx:201`
calls `widgetToForm(widget)` with **no guard on series count**, so the editor
opens for a `MULTI_KPI` or `COMBO` widget. The visualization picker deliberately
excludes those types (`minSeries: 2`, see Q104), so a user who opens such a
widget and presses save changes **both** its visualization type and collapses
its spec to a single series. Two of the eleven built-in templates ship
multi-series widgets.

**Q104 recorded the creation limit and missed this.** Phase 9 reasoned "we do
not offer multi-series creation, so filter those types out of the picker" —
correct as far as it goes, and it left the *edit* path open.

**This is a contract defect before it is a UI defect.** Fixing only the portal
leaves every other client able to do the same damage. The durable fix is on the
API: make `query_spec` conditional like its two neighbours, so a metadata-only
update is expressible. The portal fix is then to send exactly what it changed.

### Correction, 2026-08-31 — the backend half of this entry was wrong

Phase 14 re-read `dashboard-widgets.service.ts` before acting on it, per the
"verify claims, do not relay them" rule, and **the paragraph above about the API
does not hold.**

`dashboard-widgets.service.ts:102` — three lines before the `SELECT` that this
entry quotes — reads:

```ts
const querySpec = (dto.querySpec ?? current.querySpec) as DashboardWidgetQuerySpec;
```

`$6` is therefore **already the coalesced value**. The SQL is unconditional; the
*contract* is not. `UpdateWidgetDto.querySpec` is optional-with-`ValidateIf`, so
omitting the key leaves the stored spec untouched — exactly the "leave this
field alone" behaviour the entry said was missing. `visualizationType` is
guarded the same way, in TypeScript rather than in SQL. Two of the four fields
are guarded in each language; the net contract is identical for all four.

**So there is no backend defect here, and none is claimed.** The whole of D23 is
portal-side: the portal *chose* to send a reconstructed spec on every update
when it could have omitted the key. `widget-contract.ts:64-70` had even
documented the hazard correctly — "a partial spec would silently drop the parts
the form does not edit" — and `buildQuerySpec` sent one anyway. The contract was
known and the form did not honour it.

This also **removes the ordering constraint** the entry imposed. There was
nothing on the API side to wait for.

### Two things this entry understated

1. **The exposure is not `MULTI_KPI`/`COMBO`, and that makes it worse.** The
   four multi-series widgets in the eleven built-in templates are `COLUMN` and
   `LINE_AREA` — `minSeries: 1`, both offered by the picker. Opening one shows
   an ordinary, correct-looking form; saving a rename drops series 2 with **no**
   visualization-type change to notice. `MULTI_KPI` and `COMBO` at least
   announce themselves by having their type silently rewritten.
2. **Three templates ship them, not two** — `CRM_DEFAULT`, `SALES_PIPELINE` and
   `TRENDS_COMPARISONS` (which ships two). A further **seven of the 80 template
   widgets carry `filters`**, and those are lost on a rename even when the
   widget has a single series. `Q105`'s claim that editing a `SEMANTIC_V1`
   widget "preserves its stored spec" was false for the same reason.

### Fixed 2026-08-31 — Phase 14, tasks 14.6, 14.7, 14.8

Portal-side, and complete on its own:

- `widget-form.ts` — `isSpecEditable` reports whether the single-series form can
  represent a stored spec in full. `buildWidgetUpdate` omits `querySpec`
  entirely unless the form owns every part of it, so a rename sends
  `{ revision, name, visualizationType }` and the stored spec is untouched.
- `widget-detail-workspace.tsx` — a widget the form cannot represent no longer
  opens the editor. It renders read-only with a plain statement of which part of
  the spec the editor does not model.
- `widget-form.test.ts` — six cases, and the first four fail against the
  pre-fix code.

The contract is now written down where it would have prevented this, in
[crm-dashboards.md](../api/crm-dashboards.md#patch-widgetsid-replaces-queryspec-wholesale--it-never-merges).

---

## D24 — Row reorder has no single-pointer alternative · **open**

Written: **2026-09-04**

**Severity: conformance. WCAG 2.2 AA `dragging-alternative` (2.5.7) fails on
the lead-stages catalogue.**

`DataTable`'s `rowReorder` shipped on 2026-09-04 with a grip *and* two
earlier/later buttons in its handle column. The buttons were removed the same
day at the product owner's instruction — the requirement was drag only — so
reordering a lead stage now requires a sustained press-move-release.

What remains covers half the rule: `@hello-pangea/dnd`'s keyboard sensor still
rides on the grip (space to lift, arrows to move, space to drop). The half that
is gone is the **single-pointer** path. A user with a tremor, a motor
impairment, a trackpad they struggle with, or a switch device can focus the grip
but cannot complete a drag, and there is no other control that writes the order.
This is the same failure the board carried as audit
[B3](../design/SKILL-AUDIT.md), which was closed by giving every card a
**Move to…** menu — [views.md](../design/views.md#every-card-carries-a-move-to-action--not-optional)
states plainly that the keyboard path alone "satisfies only half of it".

Not fatal to the screen the way B3 was to the board: a stage's rank is a
setup-time preference on a five-to-fifteen row catalogue, not the only thing the
screen is for, and every other action on it — create, edit, delete, set default
— is an ordinary button.

**To close it**, restore the two buttons, or put a Move-to menu on the grip
(first / earlier / later / last), gated by the same `isPinned` rule the drop is.
The order math is already there and already tested: `moveRowKey` in
`src/design-system/patterns/data-table/row-reorder.ts` refuses exactly the moves
the server would answer `422` for.

Files: `src/design-system/patterns/data-table/DataTableRow.tsx`,
`src/design-system/patterns/data-table/types.ts`,
`src/app/(tenant)/crm/lead-stages/page.tsx`

---

## D25 — A lead created into a branch other than the list's is reported as failed · **open**

Written: **2026-09-05**

**Severity: a successful create is shown to the user as a failure, and the
obvious response to that is to create the lead a second time.**

The create-lead modal now carries its own branch picker (`branchId` on
`CreateLeadForm`, rendered at the top of `LeadClassificationSection` whenever
the account can reach more than one branch), so the branch a lead is filed
under no longer has to be the branch the list page is scoped to.

`useLeads.handleCreate` still assumes it is:

```ts
const response = await axiosClient.post(…, buildCreateLeadRequest(form, branchId), …);
parseLeadResponse(response.data, branchId);   // ← the PAGE's branch
```

`parseLead` throws `Invalid leads response.` when the returned lead's
`branchId` is not the one passed in (`useLeads.ts:115-118`). On a divergent
pick the POST succeeds, the server stores the lead, and the throw is caught by
the same handler that reports a network failure — the modal stays open on
`createFailed` with every field still filled. There is no second request to
distinguish it from a real failure, and `isAmbiguousMutationError` does not
match a local parse error, so the "uncertain result" path does not run either.

The list would not show the lead in any case: it is scoped to the page's
branch, so a lead filed elsewhere is invisible until the branch selector is
moved.

**To close it**, take the branch out of the response check — the created
lead's own `branchId` is the authority on where it landed — and have the modal
hand its branch back to the screen on success, so `TenantBranchSelect` and the
list follow the lead that was just created. Both changes are in
`useLeads.ts`/`page.tsx`, which were owned by another session while this
picker landed; that ownership is the only reason the fix is not in the same
commit as the defect.

Files: `src/app/(tenant)/crm/leads/hooks/useLeads.ts`,
`src/app/(tenant)/crm/leads/page.tsx`,
`src/app/(tenant)/crm/leads/components/CreateLeadsModal.tsx`
