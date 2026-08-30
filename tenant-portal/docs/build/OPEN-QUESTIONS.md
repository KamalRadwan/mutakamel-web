# Open Questions

Last review: **2026-08-28**

Questions the documentation cannot answer. **Add to this file rather than
guessing or asking a human mid-build.** An entry here is a bug in the docs.

Format: the question, why it cannot be answered from source, what was done
instead, and who can settle it.

## Status

**Thirteen of fourteen questions opened during the rebuild are resolved** —
nine during the 2026-08-27 documentation rebuild, two (Q10, Q11) during
Phase 2/3 execution, and two (Q13, Q14) by explicit decision on 2026-08-28
once Phase 5 closed out. Q12 is a logged scope deferral rather than a
settled answer — see below.
The list is kept as a record of how each was settled, because the reasoning
matters more than the answer.

| # | Question | Resolution |
| --- | --- | --- |
| Q1 | Who owns security headers? | **Nginx Proxy Manager** for transport headers; the app owns CSP (nonce) — [security-headers.md](../architecture/security-headers.md) |
| Q2 | Detail routes for leads and customers? | **Build both** — [detail-screens.md](../design/detail-screens.md) |
| Q3 | Lead conversion flow? | **Three-step drawer** with a persistent success panel — [detail-screens.md](../design/detail-screens.md#lead-conversion) |
| Q4 | Font validation | Availability + Arabic subset **verified**; visual density check deferred to phase 2 — see below |
| Q5 | Request-body field shapes | **Generated** — [dto-fields.md](../reference/dto-fields.md), 46 classes, 293 fields |
| Q6 | Test strategy | **Written** — [testing.md](../architecture/testing.md) |
| Q7 | Accessibility checklist | **Written** — [accessibility.md](../design/accessibility.md) |
| Q8 | Palette never rendered | **Computed and fixed** — `pnpm design:contrast`; see below |
| Q9 | Core / Trade enums and permissions | Core **extracted** (64 permissions); Trade deliberately deferred |

---

## Q4 — Font validation · partially closed

**Verified 2026-08-28** by fetching the Google Fonts CSS directly:

- **Readex Pro** — available, three weights, and a genuine Arabic subset
  (`U+0600-06FF`, `U+0750-077F`, `U+FB50-FDFF`, `U+FE70-FEFC`) alongside latin
  and latin-ext.
- **DM Mono** — available at 400 and 500.
- **Zain** — available, confirmed as a viable fallback.

**Still open:** whether Readex Pro's Arabic is too wide for a **36px** table row at
`text-xs`. That needs a rendered look, which this environment could not
reliably produce.

**Action:** the fonts are loaded and the app now renders — open a populated
table in Arabic and look. This is the last unverified visual assumption in the
system. If rows overflow, switch to **Zain** and record the change in
[typography.md](../design/typography.md).

---

## Q8 — Palette · closed, and it caught three real defects

`node scripts/design/contrast.mjs` now computes every ratio from the OKLCH
values rather than estimating them. Running it the first time found:

1. **Five brand steps were outside the sRGB gamut** (500–900, chroma 6–15% too
   high). The browser would have silently clipped them to a different color
   than specified. Chroma reduced to 96% of the in-gamut maximum; all steps now
   resolve cleanly.
2. **"`negative-600` fails contrast" was false** — it measures 5.09 and would
   have been acceptable. `negative-700` is kept as a *margin* choice, and the
   documented reason is corrected.
3. **"No amber step clears AA against both labels" was false** —
   `caution-500` with an `ink-950` label measures 8.42. The rule *"amber is
   never a filled button"* stands, but on **semantic** grounds, not contrast.

All twelve required pairings now pass. The tightest is `brand-500` as the light
focus ring at **3.74** against a 3.0 bar (it was 3.19 under the superseded
warm palette) — noted in
[tokens.md](../design/tokens.md#contrast-resolution) so nobody erodes it.

---

## Q9 — Trade permissions · deliberately deferred

Core's 64 tenant permissions are extracted into
[permissions.md](../reference/permissions.md#core-tenant-permissions), from the
controllers — there is no packaged catalogue for them.

Trade has 231 Gateway routes and **no portal screen**. Enumerating its
permissions now would produce documentation that rots before it is read.
Extract from `trade-app/src/**/*.controller.ts` when a Trade screen is first
built, and add the section in the same change.

---

## Q10 — Hand-rolled theme mechanism vs. `next-themes` · resolved

`docs/build/PHASE-2-FOUNDATION.md`'s theming step and
[theming.md](../design/theming.md) give exact code for a hand-rolled
`ThemeProvider` (`useSyncExternalStore` over `tenant_theme`, driven by the
same inline bootstrap script that also fixes D4's language/direction flash).
[DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md)'s library table separately
lists `next-themes` — "Well-tested flash prevention; do not reimplement" —
among the full system's dependencies.

DESIGN-SYSTEM.md's supersession notice at the top names exactly what it
overrides: "the warm-neutral palette and the 36px/40px density in
tokens.md and geometry.md." It does not name theming.md, and its library
table reads as a survey of every dependency the finished system uses across
all phases (it also lists 16 Radix packages and `sonner`, which are Phase 3
material), not a phase-2-specific instruction.

**Assumed:** implemented Phase 2 exactly as theming.md/PHASE-2-FOUNDATION.md
specify — no `next-themes`. One atomic inline script sets both `lang`/`dir`
and the initial `.dark` class before hydration; a second, separate
`next-themes` script would only cover the theme half and add a second
blocking script for no compounding benefit. `ThemeProvider` lives at
`src/design-system/theme/ThemeProvider.tsx` (no path was specified for it).

**Settle with:** if a later phase wants `next-themes` specifically, swapping
it in is a contained change — `ThemeProvider`'s public shape
(`{ theme, isDark, setTheme }`) and the `tenant_theme` storage key can stay
the same either way.

## Q11 — Shell size tokens: shell.md vs. DESIGN-SYSTEM.md · resolved

[shell.md](../design/shell.md) defines `--size-topbar: 3rem` (48px),
`--size-sidebar: 15rem` (240px), `--size-sidebar-rail: 3.25rem` (52px).
[DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md) §3 defines the same three
concerns under slightly different names — `--size-topbar: 2.75rem` (44px),
`--size-sidebar: 14.5rem` (232px), `--size-rail: 3rem` (48px) — and opens §7
with "Shell for every authenticated page: 232px sidebar (48px rail) + 44px
topbar," restating shell numbers directly rather than only general density.

Same resolution as Q10: DESIGN-SYSTEM.md is the newer (2026-08-28 vs
2026-08-27), more specific "decisions" file, and gives explicit conflicting
values for tokens it names itself — not silence on a mechanism shell.md
owns. **Assumed:** DESIGN-SYSTEM.md's numbers (44px/232px/48px) win; already
implemented in `globals.css`'s Phase 2 commit (`--size-topbar`,
`--size-sidebar`, `--size-rail`). Use these same token names and values when
building `AppShell` in Phase 3 — do not reintroduce shell.md's
`--size-sidebar-rail` name or its 48/240/52 values.

## Q12 — Customer detail's full action cluster and custom fields · deferred, not resolved

`docs/design/detail-screens.md` specs a capabilities-gated action cluster
(Add contact, Edit via `FormDrawer` on `UpdateCustomerProfileDto`, Change
status, Delete via `AlertDialog`) and a custom-fields rail card (`GET
/custom-fields` + `GET /custom-fields/values`, rendered by
`CrmCustomFieldTypeEnum`) for `/crm/customer-profiles/[id]`. This is not a
documentation gap — the spec is exact — it is a scope decision made
during Phase 4 screen 8: the detail page was restyled onto the new
primitives (PageHeader, Card, StatusBadge, two-column layout) but the
action cluster and custom-fields card were not built.

**Why:** each of those four actions plus the custom-fields rendering is
comparable in size to a full additional screen (new DTOs to verify against
`docs/reference/dto-fields.md`, a mutation flow per action, an
unverified `/custom-fields/values` response shape). Building placeholder
buttons that do not work would violate
[anti-patterns.md](../design/anti-patterns.md#13-fake-data-and-fake-success);
building all four correctly did not fit this session's remaining budget
alongside the leads and opportunities workspaces still ahead.

**Settle with:** implement Add contact / Edit / Change status / Delete and
the custom-fields card as their own follow-up pass, using the capabilities
hook already built (`useCustomerProfilesCapabilities`) and the same
`FormDrawer`/`AlertDialog` patterns already proven on the lead-stages and
acquisition-sources screens. The lead-conversion three-step drawer in the
same doc is a separate, larger piece of work with its own definition of
done — treat it independently, not as part of this gap.

## Q13 — `features/` layer specified but not followed · resolved 2026-08-28

[file-architecture.md](../architecture/file-architecture.md) specifies every
screen as a thin `app/(tenant)/<module>/<segment>/page.tsx` delegating to
`features/<module>/<feature>/` with a fixed six-part shape (`api.ts`,
`schema.ts`, `types.ts`, `use<Name>.ts`, `<Name>Workspace.tsx`,
`components/`). Screens 1 through 9 of this rebuild (login through leads)
instead colocated everything under the route folder itself —
`app/(tenant)/crm/<screen>/{page.tsx, hooks/, components/}`, with `page.tsx`
holding the full composition rather than staying thin. The pre-rebuild
pipeline screen used the documented `features/` shape (loosely — `models/`
instead of a `schema.ts`/`types.ts` split), so building opportunities is the
first point where the two conventions actually collide.

**Why this cannot be resolved from source:** file-architecture.md is dated
the same day as the screens that don't follow it, and nothing in `docs/`
flags screens 1–9 as a deviation — the spec and the shipped code simply
disagree, and the doc gives no migration note.

**Assumed:** matched the nine already-shipped screens rather than the
written spec — moved the pipeline screen's `features/crm/pipeline/*` into
`app/(tenant)/crm/opportunities/{hooks/,components/}`, same as leads and
customer-profiles. Introducing a third structure for one screen would make
the inconsistency worse, not better. The hook keeps its documented name
(`usePipelineWorkspace`, per [views.md](../design/views.md)) since only its
file location changed.

**Settled 2026-08-28, explicit human decision:** the colocated shape is
canonical. [file-architecture.md](../architecture/file-architecture.md) is
rewritten to describe it — the "Screen module shape" and "Route files"
sections, the dependency-direction rules, and the "Where a new thing goes"
table no longer mention `features/`. No code moved; screens 1–10 already
matched this shape. [data-layer.md](../architecture/data-layer.md)'s API/
validation example is corrected to match (request function + validator
together in `hooks/use<Name>.ts`, not split `api.ts`/`schema.ts` files).

## Q14 — Opportunities table has no customer/owner display names · resolved 2026-08-28

[views.md](../design/views.md#opportunities-pipeline) specs the table's
columns as "Title · Customer · Stage · Status · Owner · Expected close ·
Actions," implying `Customer`/`Owner` render names. The table's data source,
`GET /opportunities`, returns `PaginatedResult<OpportunityEntity>` — verified
directly against `opportunities.service.ts`'s `findAll` return type and the
Swagger `opportunity` example in `swagger.examples.ts`, neither of which
carries a customer or owner display name, only `customerProfileId` and
`ownerUserId`. The purpose-built card endpoint (`/pipelines/:id/cards`) does
carry `customerDisplayName`/`ownerDisplayName`, but the docs are explicit
that the table must use the generic list, not the card projection.

**Why this cannot be resolved from source:** the column spec and the
verified response contract for the endpoint it names contradict each other,
and nothing in `docs/` notes the gap.

**Assumed:** `Customer` renders as a link to the existing
`/crm/customer-profiles/:id` detail route (screen 8), labelled with the raw
`customerProfileId` in monospace — a real, working affordance rather than a
fabricated name. `Owner` renders the raw `ownerUserId` in monospace, or "Not
provided" when null — there is no owner-directory lookup anywhere in this
app to resolve it further.

**Settled 2026-08-28, explicit human decision:** keep the shipped workaround
as final, and correct the spec rather than wait on a backend change.
[views.md](../design/views.md#opportunities-pipeline)'s table-columns row and
its "Consequences you must design for" list are updated to document
`Customer` as a link (not a name) and `Owner` as a raw id, with the same
reasoning recorded there. No code changed — `page.tsx` already implemented
this. If the backend ever decorates `GET /opportunities` with display names,
or the app grows a directory-lookup hook for another screen, that is new
work with its own decision, not a reopening of this one.

## Q4 — Readex Pro's Arabic in a dense row · resolved 2026-08-30 by measurement

The repo's own "last unverified visual assumption": whether Readex Pro's Arabic
fits a table row at `text-xs`. Never checked at the old 36px row, and
`--ui-scale: 0.9` takes the row to **32.4px**, so it had to be settled before
the density change could ship.

**Measured in the running app**, loading the real Readex Pro Arabic subset face
and measuring true ink extents (`actualBoundingBoxAscent` + `Descent`, which
include dots and diacritics) rather than the line box:

| | value |
| --- | ---: |
| Row height at `--ui-scale` 0.9 | **32.40 px** |
| Cell padding (`py-1`, top + bottom) | 8 px |
| **Available ink height** | **24.40 px** |
| Arabic `text-xs` font-size (with the lift) | 14 px |
| Line-height | 20 px |
| Ordinary CRM Arabic — ink height | **15.00 px** (9.40 px headroom) |
| Fully diacritised worst case — ink height | **22.98 px** (**1.42 px headroom**) |

Test string for the worst case: `مُتَكَامِلٌ — جِهَةُ الاتِّصالِ بِـ ٩٩ عَمِيلًا`
— every short vowel, a shadda, tanween, a descender and Arabic-Indic digits.

**Resolved: it fits.** Ordinary tenant data — names, statuses, company names —
sits at 15px ink with 9.4px to spare. Even the pathological fully-vocalised
string clears, by 1.42px.

**The caveat, recorded rather than hidden:** 1.42px is not much. If a screen
ever renders fully-vocalised Arabic *and* tightens cell padding below `py-1`,
diacritics will clip. The mitigation is padding, not font size — the 14px
Arabic floor stays.

**Zain is not needed.** The recorded fallback stands unused; do not switch
without re-running this measurement.

---

## Q15 — A 202 async job publishes no status enum the browser can read · open

**Opened 2026-08-30 while building `AsyncJobState` (MASTER-PLAN 1.32).**

The task names five states — queued, running, succeeded, failed,
artifact-expired — and 1.32's consumers are 7.17 (template PDF preview) and
11.7 / 11.12 / 11.15 (Trade document render jobs).

**Why it cannot be answered from source.** Nothing in `docs/api/` documents an
async-job status shape. `docs/api/README.md#async-work` says only *"Poll the
operation route documented by the command's owner"*, and
`docs/api/core-notifications.md#async-ownership` repeats that a `202` is not
completion. Grepping the backend for a tenant-facing job enum finds only
`TenantOperationStatusEnum`, which belongs to **admin** tenant provisioning
(`../backend/mutakamel-apps/core-app/src/admin/tenants/provisioning/`) and is
not reachable from this portal. Trade's render routes are in phase 10+ and
their contracts have not been read yet.

**Done instead.** `AsyncJobStatus` is declared in
`src/design-system/patterns/async-job/AsyncJobState.tsx` as a **UI state
union**, labelled as such in the file, with an explicit instruction that the
consuming screen maps its own proven wire values onto it. No value is claimed
to be a wire value, none is sent to a server, and none is compared against a
response inside the pattern.

**Settle with:** the Trade render-job route contract, read at 11.7. If its
status values differ, the mapping lives in the screen's hook — the pattern
does not change.

---

## Q16 — Access mode is not readable by a non-owner user · open

**Opened 2026-08-30 while building `useAccessMode()` (MASTER-PLAN 1.29).**

1.29 calls access mode *"one source of truth for FULL / READ_ONLY / DUNNING /
BLOCKED that suppresses every mutating affordance,"* consumed by every screen
in phases 4–12. The browser cannot currently obtain it.

**What is proven, 2026-08-30:**

| Source | Carries `accessMode`? |
| --- | --- |
| `GET /auth/me` → `TenantMe` in `../backend/mutakamel-apps/core-app/src/tenant/tenant-auth/tenant-auth.service.ts` | **no** — id, email, names, `isTenantOwner`, `status`, accessible branches/companies, permissions, team memberships, `accessScope` |
| `GET /billing/summary` → `subscription.accessMode` | yes, but `TenantBillingController` is `@UseGuards(TenantGuard, TenantOwnerGuard)` — **owner only**, so every staff user gets 403 |
| `SubscriptionEnforcementGuard` | enforces it, and answers `403 ACCESS_POLICY_BLOCKED`. That is a rejection **after** the action, not a mode the UI can read before offering one |

The four wire values themselves are not in doubt — `AccessModeEnum` in
`../backend/mutakamel-apps/core-app/packages/common/src/enums/access-mode.enum.ts`
is `FULL · DUNNING · READ_ONLY · BLOCKED`, and the guard's own
`enforceAccessMode` fixes their meaning: BLOCKED refuses reads too, READ_ONLY
and DUNNING refuse writes, and DUNNING re-opens only routes carrying
`@AllowedDuringDunning()`.

**Done instead — the mode was not invented.** `src/lib/access-mode.ts` carries
the four values and the capability rules transcribed from the guard;
`src/hooks/useAccessMode.ts` returns `mode: null, isResolved: false` with a
`TODO(access-mode)` naming exactly what is missing; and
`ReadOnlyGate` takes `AccessMode | null` as a prop so the one screen that
*does* have the value (owner billing) can use it today.

**The deliberate choice inside that:** an unresolved mode reports **full**
capability, not restricted. Client checks are advisory and the backend is
authoritative; failing closed on a value the browser has no way to read would
seal the entire product for every non-owner user. The cost is that a
READ_ONLY tenant's staff still see Save buttons that 403 — which is exactly
today's behaviour, unchanged, rather than a new regression.

**Settle with:** adding `accessMode` to the `TenantMe` projection (one field
on a route every session already calls), or exposing a non-owner-readable
entitlement snapshot route. Either one makes this hook resolve with no other
edit in the portal.

## How to add one

Do not delete a resolved entry — the reasoning is the value. Append new
questions below with the same shape:

```markdown
## Q10 — <the question>

<why it cannot be answered from source>

**Assumed:** <what you did instead>
**Settle with:** <who or what closes it>
```
