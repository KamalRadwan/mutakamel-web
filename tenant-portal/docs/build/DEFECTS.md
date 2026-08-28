# Known Defects

Written: **2026-08-27**

Found by survey of the working tree on 2026-08-27. Each was verified in source,
not inferred. Fix them **during** the phase named, not in a cleanup pass.

---

## D1 — Forgot-password sends the wrong address

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

`ThemeToggle` writes `document.documentElement.classList` from its own
`useEffect`. The stored theme is therefore applied only on pages that render
the toggle, and always one frame late. There is no `ThemeProvider` anywhere —
theme is a side effect of a button being mounted.

**Fix in phase 2.** Pre-hydration bootstrap script + a provider reading the
same key via `useSyncExternalStore`. See
[../design/theming.md](../design/theming.md#no-flash--the-mechanism).

---

## D4 — Wrong direction on the first frame for English users

`src/app/layout.tsx` hardcodes `lang="ar" dir="rtl"`; `I18nContext` corrects
it in a `useEffect` after hydration. Every English-preferring user sees one
RTL frame on every load.

**Fix in phase 2**, same mechanism as D3.

---

## D5 — Login page is entirely hardcoded Arabic

`src/app/login/page.tsx` renders the language toggle and contains **zero**
dictionary lookups. Switching to English changes nothing on the one page every
user must pass through.

**Fix in phase 4.** Every string into both dictionaries.

---

## D6 — Three conflicting shell heights

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

Verify `pnpm docs:routes:check` passes after a fresh checkout.

---

## D9 — Transport's forbidden toast is hardcoded English

`dispatchForbiddenToast()` in `src/lib/api/axiosClient.ts` hardcodes
`"Access Denied"` / `"You do not have permission to perform this action."`

This is the **one permitted i18n change inside the transport** — see
[../architecture/data-layer.md](../architecture/data-layer.md#permitted-changes).
Everything else in that file is out of scope.

**Fix in phase 4.**

---

## D10 — Hue-coded view switcher

`leads-workspace.tsx` tints the active view button **purple, emerald or
amber** depending on which view is selected. Three hues, one control, no
meaning.

**Fix in phase 3** by replacing it with `ViewSwitcher` — see
[../design/views.md](../design/views.md#the-switcher).

---

## D11 — Actions gated by permission strings, not capabilities

`useLeads.ts` derives `canCreate` / `canUpdateLead` / `canDeleteLead` from
`/auth/me` permission strings. CRM exposes per-branch `capabilities`
endpoints that already account for branch **and owner** scope.

Consequence: a user with `crm.leads.update.own` currently sees an edit control
on records they do not own.

**Fix in phase 4.** See [../api/crm-leads.md](../api/crm-leads.md#get-leadscapabilities).

---

## D12 — "Kanban" in user-facing copy

`t.crm.kanbanBoard`, `t.crm.pipelinesKanbanBoards`,
`t.crm.buildInteractiveKanbanStyle`. The view is called **board**.

**Fix in phase 4.** See [../design/views.md](../design/views.md#naming--kanban-is-dead).

---

## D13 — Three fabricated Trade endpoints

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
