# Decisions and Open Questions

Started: **2026-08-30**

Every question this build raised, the answer taken, and **who decided it**.

Standing instruction from the owner: *"use recommendations if I didn't reply."*
So an unanswered question is not a blocker — it is answered with the
recommendation, recorded here as **assumed**, and carried forward. Anything
marked `assumed` is reversible and is what to review first.

| Status | Meaning |
|---|---|
| `confirmed` | The owner stated this explicitly |
| `assumed` | No reply; the recommendation was taken and applied |
| `open` | Genuinely blocked; work routed around it |

---

## D1 · Palette vividness — `confirmed`

**Question.** The palette reads muted. How much brighter, and bounded by what?

**Owner said:** *"محتاج اولا يكون الالوان فيه زاهية بلاش تكون كاتمة لان دى للمستخدم"*
— vivid, not muted, because end users live in this.

**Decision.** Replace all five ramps with the gamut-fitted values in
`MASTER-PLAN.md#02-the-colour-problem--measured-not-asserted`. Chroma rises
9–20 % on the chromatic ramps and 67 % on `ink`; `--primary` moves from
`#1364ce` (L .520) to `#066de9` (L .560).

**Bounded by, and proven:**
- All 57 steps inside the sRGB gamut.
- All 21 contrast claims pass; primary fill 4.79 against a 4.5 bar.
- The negative control still fails, at 4.07.

**Not available:** pushing the primary fill past L ≈ 0.57 drops white-label
contrast below 4.5. That is sRGB, not preference.

### D1a · The brand hue stays cold blue — `confirmed`

**Owner said:** *"primary color cold blue"*.

**Decision.** **The hue does not move.** `brand` stays at **OKLCH hue 258**,
exactly where it is today, and the `ink` neutral stays at **hue 240**. Only
*chroma* and *lightness* change.

This matters because "make it vivid" is easy to misread as "change the colour".
It is not. The correction is the same cold blue, more saturated and brighter:

| | hue | chroma | lightness | renders |
|---|---:|---:|---:|---|
| `--primary` today | 258 | 0.180 | 0.520 | `#1364ce` — cold blue, dark |
| `--primary` proposed | **258** | 0.204 | 0.560 | `#066de9` — **same cold blue, vivid** |

The cold identity is also *strengthened*, not weakened: the `ink` ramp's chroma
rises from 0.030 to 0.050 at hue 240, so surfaces read more distinctly cool
rather than washing to grey. The three deliberate hue choices in
`DESIGN-SYSTEM.md` — teal-green positive at ~164, crimson negative at ~15,
warm amber caution at ~64 — are all preserved for the same reason they were
chosen: they sit correctly against a cold ground.

---

## D2 · UI scale — `confirmed` with an `assumed` sub-decision

**Question.** The owner prefers the app at 90 % of current size.

**Owner said:** *"انا افضل ان ال Size يكون 90% من ال Web View بشوفه افضل من ال 100%"*

**Decision.** `--ui-scale: 0.9` on `:root`, driving every `rem` token.

**Sub-question (not asked back, answered by recommendation).** A naive 0.9
puts Arabic `text-xs` at 12.6 px, below the 13 px floor `typography.md` calls
non-negotiable.

**Assumed.** Scale the **geometry**, hold the **type floor**.

**First implementation was wrong, and the gates did not catch it.** The obvious
approach — `html { font-size: calc(100% * var(--ui-scale)) }` with the type
tokens rebased by `1/0.9` to compensate — failed twice over:

1. `html { font-size }` is a **banned selector** in `globals.css`
   (`DESIGN-SYSTEM.md#banned-in-that-file`: *"Element selectors beyond `body`
   and `html[lang]`"*), a rule printed at the top of that very file.
2. **Tailwind v4 strips it.** Verified by walking `document.styleSheets` in the
   running app — the rule reached no stylesheet. The compensating division on
   the type tokens *did* apply, so the interface rendered **11 % larger**: the
   exact opposite of the goal, with `typecheck`, `lint`, `build`, `census` and
   `contrast` all green.

**What shipped.** The geometry tokens scale themselves:

```css
:root {
  --ui-scale: 0.9;
  --size-control-md: calc(2rem    * var(--ui-scale));
  --size-row:        calc(2.25rem * var(--ui-scale));
  --size-topbar:     calc(2.75rem * var(--ui-scale));
}
```

No element selector, no root font-size, and the type floor is untouched **by
construction** rather than by a compensating division. Radius stays fixed at
2/4/6/8 — it is a shape constant, not a density one.

**Measured live, not asserted** (driving `--ui-scale` in the running app at
1366×768 with this app's real chrome):

| scale | row | topbar | control | rows visible |
|---|---:|---:|---:|---:|
| 1.00 | 36 px | 44 px | 32 px | 14 |
| **0.90** | **32.4** | **39.6** | **28.8** | **15** |
| 0.85 | 30.6 | 37.4 | 27.2 | 17 |

**One row, not the two an earlier draft claimed.** `geometry.md` separately says
16 rows at the current density; it counts a barer screen with no filter bar and
no pager. Both numbers now carry their chrome budget.

**Consequence accepted:** `hitArea` widened from 6 px to 8 px, because a
28.8 px control with 6 px expansion reaches only 40.8 px — under the 44 px touch
floor the helper exists to clear.

**Reverse it by:** setting `--ui-scale: 1`. One line.

---

## D2a · Q11 is deliberately overturned — `assumed`

**Q11 settled the shell tokens at 44 / 232 / 48 px** by explicit human decision
on 2026-08-28. `--ui-scale: 0.9` changes all three to 39.6 / 208.8 / 43.2.

**Recorded as a reversal, not a silent change.** The reasoning that settled Q11
was about *proportion* — a 44 px topbar against 36 px rows. That proportion is
preserved exactly, because every token moves by the same factor. What changed is
the absolute density, which is the thing the owner asked for.

**Reopen if:** the 44 px touch floor turns out to matter for the topbar itself
rather than for the controls inside it.

---

## D2b · Q4 blocked the scale change — `resolved`

**Q4 is the repo's own named "last unverified visual assumption":** whether
Readex Pro's Arabic fits a **36 px** row at `text-xs`. It was never checked at
36 px, and this change takes the row to **32.4 px**.

**Resolved 2026-08-30 by measurement, not by looking.** Loaded the real Readex
Pro Arabic face and measured true ink extents including dots and diacritics.
At the 32.4px row there is **24.4px of available ink height**; ordinary Arabic
uses 15px, and a fully-vocalised worst case uses 22.98px — **1.42px of
headroom**. It fits. Full numbers in
[OPEN-QUESTIONS.md#q4](OPEN-QUESTIONS.md).

**Zain is not needed.** The caveat that survives: 1.42px is thin, so the
mitigation for any future tightening is *padding*, never a smaller Arabic
font.

---

## D3 · Density as a user preference — `assumed`

**Question.** Should 0.9 be hard-coded or a preference?

**Assumed.** A three-step preference — Compact 0.9 / Default 1.0 /
Comfortable 1.1 — defaulting to **Compact**, persisted like the theme and
applied in the same pre-hydration bootstrap so there is no flash.

**Why.** The owner stated a personal preference. Tenant staff on other hardware
may not share it, and this costs one token plus one menu item.

---

## D4 · Board naming — `confirmed`

**Owner said:** *"kanaban والى هنعيد تسميته و نخليه board"*.

**Decision.** The view is **board**, in code and in copy. "Kanban" must not
appear in any user-facing string. Defect D12 tracks the three dictionary keys
that still say it.

---

## D5 · The three-view contract — `assumed`

**Question.** The three views share no type — `items` / `rows` /
`cardsByColumn`, three different prop APIs. Unify, or leave them independent?

**Assumed.** Unify behind one generic `WorkspaceViewProps<T>`, and lift
pagination, sorting, selection and scroll restoration to the contract so a view
switch stops silently dropping capability.

**Why.** The owner named the three views as one feature. Today Table has
pagination, sorting and selection and the other two have none, so switching
view loses the user's place. That is a defect, not a design.

---

## D6 · Chart library — `assumed`

**Question.** 71 dashboard and widget routes need rendering. No chart
dependency exists.

**Assumed.** `recharts`.

**Why.** React-native API, composable, works with an existing token palette,
and does not pull a second rendering paradigm into the app. The alternative
(`visx`) is more powerful and considerably more code per chart.

**Constraint carried:** chart colours come from the four role ramps only; the
categorical sequence is defined once and colourblind-checked. No fifth hue
enters through the charts.

---

## D7 · Form library — `assumed`

**Question.** Every form today is hand-rolled `useState` plus a
`JSON.stringify` dirty-check. Adopt `react-hook-form`?

**Assumed.** **No, not yet.** Keep hand-rolled forms through Phase 8.

**Why.** The existing pattern works, is tested, and `FormDrawer`'s dirty-guard
is built around it. Introducing a form library while also changing the palette,
the scale and the view contract puts three large refactors in flight at once.
Revisit at Phase 10, when Trade's document line editors arrive — those are the
first forms complex enough to justify it.

**Reverse it by:** adopting it at the `FormDrawer` boundary, which is the only
component that would need to change.

---

## D8 · Date picker — `assumed`

**Assumed.** `react-day-picker` + `date-fns`.

**Why.** It is the only mature React date picker with real RTL support and
locale-aware rendering, and it is headless enough to take the design system's
tokens rather than fighting them. Dates render through `Intl` with an explicit
locale — `ar-EG-u-nu-latn` (Arabic locale, Western digits), per the settled
typography decision.

---

## D9 · Virtualization — `assumed`, **split by surface** on 2026-08-31

**Assumed.** `@tanstack/react-virtual`, applied to board columns above 50
cards, `CardView` above 100 items, and `DataTable` above 100 rows.

**Risk recorded:** virtualization and `@hello-pangea/dnd` can conflict — a
virtualized list unmounts the dragged node. This must be proven with a real
drag across a 200-card column before the task is marked done, not after.

### The de-risk (task 1.46), and what it actually found

Run before the dependency was locked, against
`@hello-pangea/dnd@18.0.1` as installed.

**What the library requires.** Read from its own source, not its README —
`src/view/droppable/use-validation.ts` runs a separate `virtual` check set:

- `mode="virtual"` **must** be paired with a `renderClone` function, or the
  component throws `Must provide a clone render function (renderClone) for
  virtual lists`.
- A virtual droppable **must not** render `provided.placeholder`
  (`Expected virtual list to not have a placeholder`).
- The clone is portalled out of the list, through `getContainerForClone`,
  which defaults to `document.body`.

`DroppableMode` is `'standard' | 'virtual'` — the mode exists and is real.
What the package ships is `/dist` and `/src` only: **`docs/patterns/virtual-lists.md`
is referenced from the README but is not in the tarball**, so the worked
examples are not vendored here. Those examples are written against
`react-window` and `react-virtualized`; nothing in the repository exercises
`@tanstack/react-virtual`.

**The concrete collision.** Both libraries position an item with `transform`.
`@tanstack/react-virtual`'s documented pattern is
`transform: translateY(${item.start}px)` on the item element, and
`provided.draggableProps.style` sets `transform` on that same element while a
drag is in flight. Object spread cannot merge two `transform` values — one
silently wins. It is avoidable (position with `top` instead of `transform`, or
put the virtualizer's offset on an outer wrapper and the `Draggable` on an
inner element), but it is a hazard the `react-window` path does not have,
because `react-window` hands the row renderer a `style` object the consumer is
expected to merge.

**What could not be proven here, stated plainly.** jsdom has no layout, so
every box `@hello-pangea/dnd` measures is 0×0 and no sensor can produce a
meaningful drag. `DECISIONS.md#d13--test-tenant-for-manual-verification--open-needs-the-owner`
records that a real authenticated session — and therefore the board — is not
reachable yet, and `src/app/**` is out of bounds for a throwaway harness. **A
real 200-card drag has not been performed.** What exists is
`src/design-system/views/board/virtual-dnd.probe.test.tsx`, which proves the
structural half: the two libraries mount together, a windowed subset renders,
every mounted `Draggable` carries its **absolute** index rather than its window
index, no placeholder is emitted, and the `renderClone` invariant is satisfied.
That is composition, not behaviour.

### Decision

**Split by surface, and name the fallback rather than assume past it.**

| Surface | Library | Why |
| --- | --- | --- |
| Board columns (2.8) | **`react-window`** | The only pairing `@hello-pangea/dnd`'s virtual mode is actually exercised against. It hands the row a `style` to merge, so the transform collision does not arise |
| `DataTable` rows (2.9) | `@tanstack/react-virtual` | It can window inside a real `<tbody>` using spacer rows, with no absolute positioning. `react-window` structurally cannot — it would replace the `<table>`, taking `aria-sort`, the sticky header and the sticky columns with it |
| `CardView` (2.9) | `@tanstack/react-virtual` | No drag-and-drop; no reason to add a second library |

`@tanstack/react-virtual` is installed now (task 1.1). **`react-window` is
deliberately not installed yet** — an unused dependency fails `pnpm knip`, and
2.8 is the task that earns it.

**2.8 does not get marked done until a real drag across a 200-card column has
been performed in a browser** — mouse and keyboard, both directions, in Arabic
and English. If `react-window` also fails that, the fallback is 2.18's
position: ship 2.7 (the Move-to menu, the WCAG AA fix) and leave the columns
unvirtualized. Virtualization is a performance improvement; the accessibility
fix is not optional, and they must not share a gate.

---

## D10 · Tenant branding into tokens — `assumed`

**Question.** The backend serves `primaryColor`, `secondaryColor`, `logoStorageKey`,
`appName` and `tabTitle` on a public endpoint. Nothing reads any of it.

**Assumed.** Wire it. `--primary` and `--ring` are the only semantic consumers
of the brand ramp, so a runtime `:root` override repaints the product.

**Guard, non-negotiable:** a tenant's `primaryColor` must not be allowed to
break contrast. Derive the ramp the same way Phase 0 does — hold lightness, fit
chroma to gamut — then re-check the fill pair before applying. If it fails,
fall back to the system brand and say so in the settings screen rather than
shipping an unreadable button.

---

## D11 · Response envelope — `confirmed by existing rule`

Core wraps responses in `data`; **CRM does not**. Stated in `AGENTS.md`,
absent from the first draft of the plan, now standing rule **S1** and task 3.20.

---

## D12 · Trade scope — `open`, routed around

**Question.** Trade is 231 routes — larger than Core and CRM combined. Is the
whole surface in scope for this build, or a subset?

**Routed around by:** planning all 231 across phases 10–12, ordered so that
foundation → documents → advanced each ship independently. If the owner later
scopes Trade down, whole phases drop out cleanly without stranding half-built
screens.

**Needs an answer before Phase 10 starts.**

---

## D13 · Test tenant for manual verification — `open`, needs the owner

**Everything except the login now works.** Findings from 2026-08-30:

| Component | State |
|---|---|
| Backend stack | **All up and healthy** — gateway 9000, core 8001, crm 8003, trade 8004, realtime 8005, postgres, rabbit, redis |
| Gateway host-status for `mersany.mutakamel.ai` | **200 `{"status":"ACTIVE"}`** |
| Portal → gateway wiring | **Fixed.** The portal had no `DEV_API_TARGET` in its environment, so `TenantHostAdmission` had no origin to call and `notFound()` on every request. Added `.env.local` (gitignored) |
| Two ACTIVE tenants with VALID, verified FQDNs | `mersany.mutakamel.ai`, `wallettest02.mutakamel.ai` |

**Two things block a real login, and both were correctly refused by the
sandbox.** Recorded rather than worked around:

1. **The browser cannot send the right `Host`.** Host admission fails closed and
   matches the request Host against `tenant_fqdns`. The browser sends
   `localhost`, which has no row. The fixes are a `hosts` entry (a system
   settings change — out of bounds) or a `tenant_fqdns` row for `localhost`
   (a control-plane write — refused).
2. **The one tenant user cannot log in.** `kamal.radwan@mersany.com` is the
   owner but is still `INVITED`, with no password set. Both invite tokens in
   `tenant_action_tokens` are **expired**, and only their HMAC hashes are
   stored. Minting a fresh one needs the auth pepper (refused — reading an auth
   secret to forge a token is exactly what that guard is for), and seeding an
   Argon2 password hash needs the same pepper.

### What unblocks it — any one of these

- **Add a hosts entry** and hand over a working tenant login:
  `127.0.0.1  mersany.mutakamel.ai` in `C:\Windows\System32\drivers\etc\hosts`,
  then browse `http://mersany.mutakamel.ai:5002`.
- **Or** insert a dev FQDN row so `localhost` resolves to a tenant:
  ```sql
  INSERT INTO tenant_fqdns (id, tenant_id, fqdn, is_primary, verified_at, validation_status)
  SELECT uuid_generate_v7(), id, 'localhost', false, now(), 'VALID'
  FROM tenants WHERE name = 'mersany';
  ```
- **And** an ACTIVE tenant user with a known password — accept the owner invite
  through the real UI, or create one through the API from an existing session.

**Until then:** everything that does not need an authenticated session
continues — the design system, the token layer, the boundary pages, the state
components, the three views, and every gate in `pnpm verify`. The manual
end-to-end script (login → CRM → create lead → convert → three views → Trade)
is written and waiting in `docs/build/MANUAL-TEST-PLAN.md`.

---

## D14 · `FileUpload` has no progress bar — `assumed`

**Question (task 1.45).** `FileUpload` was specified with "per-file progress".
`fetch` cannot report upload progress — there is no upstream progress event in
the Fetch standard, and `ReadableStream` request bodies are a download-side
feature. Only `XMLHttpRequest` exposes `upload.onprogress`. And `AGENTS.md`
says: *"`fetch` is called in exactly one file: `src/lib/api/axiosClient.ts`."*

Three options, and only three:

| | Option | Cost |
|---|---|---|
| a | Amend the rule; add an `XMLHttpRequest` upload transport | A second transport that must re-implement session refresh on 401, the idempotency key, the correlation id, error normalization and the forbidden-toast. Every one of those is a place the two paths can drift, on the axis where drift is a security bug |
| b | Ship no progress bar | The 26 MiB CRM attachment gets a "working" state instead of a percentage |
| c | Animate a bar on a timer | **Banned twice over** — `anti-patterns.md#13-fake-data-and-fake-success`, and it is a fabricated claim about the state of a write |

**Decision: (b).** No progress bar, and no fake one.

`FileUpload` renders the **indeterminate** `Progress` bar while a file is in
flight. That is honest: `Progress` with a null value omits `aria-valuenow`
entirely, so it announces as indeterminate rather than as a number nobody
measured. It says *working*, which is exactly what is known.

**The door is left open, deliberately.** `FileUpload` takes an optional
`progress` number per file. If a transport ever reports real bytes-transferred,
the caller passes it and the same bar becomes determinate — no component
change. **Nothing may pass that prop from a timer.**

**(a) was also not available to this task on ownership grounds**, which is
worth recording separately: `src/lib/api/**` is outside the scope Phase 1 was
given, so the rule could not have been amended here even if (a) had won. If
progress on the 26 MiB attachment later proves to matter, (a) is reopened as
its own task, against `axiosClient.ts`, with the drift list above as its
acceptance criteria.

**Reverse it by:** implementing (a) and passing `progress` per file. The
component does not change.

---

## D15 · Third-party components take no stylesheet — `assumed`

**Question (task 1.40).** Two dependencies ship their own CSS.
`react-day-picker` has `react-day-picker/style.css`; `cmdk` documents styling
through `[cmdk-root]`, `[cmdk-item]`, `[cmdk-group-heading]` and friends —
attribute selectors, which are still selectors. `DESIGN-SYSTEM.md#5--no-stylesheet-of-component-classes`
says `globals.css` declares tokens and styles nothing, and bans any class
selector, `@apply`, and `@layer components` in it.

**Decision. Neither library gets a stylesheet, and neither needs one.** Both
expose a per-part `className`, so every rule they would have shipped is written
as design-system utilities at the call site.

**`react-day-picker`** — `Calendar.tsx` passes a `classNames` map keyed by the
library's own `UI` / `DayFlag` / `SelectionState` enums. This is cheap because
the library's markup is a native `<table>`: the seven-column grid, the RTL
mirror and the arrow-key roving all come from table layout, not from CSS.

> The trap, recorded because it is silent: `classNames` **merges over** the
> library's defaults. A key that is not listed keeps an inert `rdp-*` class
> that matches no rule. Cosmetic keys degrade harmlessly; a key that carries
> layout renders the calendar unstyled. Verify visually, not by type-checking.

**`cmdk`** — the `[cmdk-*]` attributes are emitted whether or not anything
selects on them. They are a *convenience* for consumers who want a stylesheet,
not the library's styling contract: `Command`, `Command.Input`, `Command.List`,
`Command.Item`, `Command.Group`, `Command.Empty` and `Command.Separator` each
take a `className`. `CommandPalette.tsx` passes all seven. The attributes stay
in the DOM, unmatched and inert — the same harmless residue as the `rdp-*`
names.

One `cmdk` behaviour genuinely cannot be reached from `className` and is worth
naming: the library hides a filtered-out item with `[cmdk-item][aria-hidden]`
rather than unmounting it in some configurations. That is handled by leaving
`shouldFilter` on and letting `cmdk` own the list, rather than by a CSS rule.

**Rejected:** a scoped `<style>` tag inside the component. It is a component
stylesheet that has learned to hide in a `.tsx` file, and it would put a second
styling mechanism next to CVA for exactly two components.

**Reverse it by:** nothing short of adopting a third library with a mandatory
stylesheet — at which point the rule, not the workaround, is what gets
revisited.

## Log

| Date | Change |
|---|---|
| 2026-08-30 | File created. D1, D2, D4 confirmed by the owner. D3, D5–D11 assumed by recommendation. D12, D13 open. |
| 2026-08-31 | Phase 1: D14 and D15 added. D9 split by surface after the 1.46 de-risk — board columns move to `react-window`, the two non-dnd surfaces keep `@tanstack/react-virtual`. |
