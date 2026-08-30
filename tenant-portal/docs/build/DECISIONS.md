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

## D2b · Q4 blocks the scale change — `open`

**Q4 is the repo's own named "last unverified visual assumption":** whether
Readex Pro's Arabic fits a **36 px** row at `text-xs`. It was never checked at
36 px, and this change takes the row to **32.4 px**.

**Blocking task 0.31.** Open a populated table in Arabic and look before this
ships. Recorded fallback if it does not fit: **Zain**.

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

## D9 · Virtualization — `assumed`

**Assumed.** `@tanstack/react-virtual`, applied to board columns above 50
cards, `CardView` above 100 items, and `DataTable` above 100 rows.

**Risk recorded:** virtualization and `@hello-pangea/dnd` can conflict — a
virtualized list unmounts the dragged node. This must be proven with a real
drag across a 200-card column before the task is marked done, not after.

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

## D13 · Test tenant for manual verification — `open`

**Question.** Manual end-to-end testing needs a running Gateway, a provisioned
tenant, and a tenant user with known credentials.

**Blocked on:** the environment. `pnpm dev` cannot currently start (defect D15,
fixed by task 0.1); `DEV_API_TARGET` must point at a reachable Gateway; a tenant
must exist with a verified FQDN, because host admission fails closed.

**Recorded here so the manual test plan does not silently become "it compiles".**

---

## Log

| Date | Change |
|---|---|
| 2026-08-30 | File created. D1, D2, D4 confirmed by the owner. D3, D5–D11 assumed by recommendation. D12, D13 open. |
