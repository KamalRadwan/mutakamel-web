# Phase 4 — Screens

Written: **2026-08-27**

Convert the 25 reachable files onto the design system, and build the views
that do not exist yet.

## Order — ascending risk

| # | Screen | Files | Work |
| --- | --- | ---: | --- |
| 1 | `/login` | 2 | Convert; fix **D1** (unbound reset field) and **D5** (hardcoded Arabic) |
| 2 | `/core/authentication` | 1 | Convert to `DataTable`; move 17 inline ternaries into the dictionary |
| 3 | `/crm/lead-stages` | 3 | Convert; `FormDrawer` |
| 4 | `/crm/acquisition-sources` | 3 | Convert; `FormDrawer` |
| 5 | `/crm/custom-fields` | 2 | Convert; field-type to primitive mapping |
| 6 | `/crm/static-data-catalogue` | 1 | Convert to `DataTable` |
| 7 | `/crm/settings` | 1 | Convert |
| 8 | `/crm/customer-profiles` | 4 | **Build all three views** |
| 9 | `/crm/leads` | 6 | Restyle board and card; `list` becomes `DataTable`; wire capabilities |
| 10 | `/crm/opportunities` | 4 | **Build card and table**; rename route |
| 11 | Workspace home | 1 | Convert |

One commit per screen. Each must pass the gate before the next starts.

## Per screen

1. Read that screen's `docs/api/*.md` page.
2. Read [../design/views.md](../design/views.md) if it has views.
3. Replace markup with primitives and patterns. **Do not change the hook's
   logic** unless a defect is listed against it — the hooks are already
   server-backed and validated.
4. Move every string into both dictionaries; delete the ternaries.
5. Wire action visibility to `capabilities`, not permission strings (**D11**).
6. Verify: light, dark, Arabic, English, keyboard.
7. Update that screen's tests.

## The three-view work

Three screens need it, and only one is close:

| Screen | board | card | table |
| --- | --- | --- | --- |
| Leads | exists — restyle | exists — restyle | rename `list`, rebuild on `DataTable` |
| Customer profiles | **build** — axis is `CustomerStatusEnum` | **build** | **build** |
| Opportunities | exists — restyle | **build** | **build** |

The board grouping axis differs per screen and is **not guessable**.
[views.md](../design/views.md#the-grouping-axis--this-is-not-uniform) has the
table. Getting this wrong is the most likely error in the phase.

Also in this phase: rename `/crm/pipeline` to `/crm/opportunities` with a
redirect from the old path, and remove "Kanban" from all user-facing copy
(**D12**).

## Transport

Exactly one permitted change: localize `dispatchForbiddenToast()` (**D9**).
Nothing else in `axiosClient.ts` or `lib/auth/`.

## Delete the old presentation layer

After screen 11, delete `src/components/ui/`, `src/components/layout/` and
`src/components/shared/` — section 5 of
[PHASE-1-DELETE.md](PHASE-1-DELETE.md). Confirm nothing imports them first:

```bash
grep -rn "components/ui/\|components/layout/\|components/shared/" src --include="*.tsx" --include="*.ts"
```

That must return empty.

## Gate

Per screen:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

At the end of the phase:

```bash
pnpm build && pnpm design:census -- --check && pnpm design:rtl
```

Targets at phase end: color utilities **0**, arbitrary type sizes **0**,
bold-or-heavier **0**, `rounded-xl` and above **0**, gradients **at most 2**,
`backdrop-blur` **at most 1**, physical RTL utilities **0**, language ternaries
**0**.
