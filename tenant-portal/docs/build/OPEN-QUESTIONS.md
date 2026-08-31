# Open Questions

Last review: **2026-08-31**

Questions the documentation cannot answer. **Add to this file rather than
guessing or asking a human mid-build.** An entry here is a bug in the docs.

Format: the question, why it cannot be answered from source, what was done
instead, and who can settle it.

**Numbering.** Numbers are permanent and are never reused. Before opening a
question, scan every `## Q` heading in this file and take one higher than the
highest you find — do not count the entries, because resolved ones stay and
gaps are normal. Q15 was issued twice (2026-08-30 for the async-job status
enum, 2026-08-31 for the CRM scope headers); the second was renumbered to
**Q24** on 2026-08-31, after the collision had already reached a source
comment in `useCustomerProfilesCapabilities.ts`. That is the failure this rule
exists to prevent: a pointer that resolves to the wrong question is worse than
no pointer.

While several agents build in parallel, numbers are **reserved in blocks** so
two agents cannot pick the same one from the same snapshot of this file:

| Block | Owner |
| --- | --- |
| Q25-Q29 | Phase 6 - billing, subscription, branding |
| Q30-Q39 | Trade contract documentation (Phases 10-12) |
| Q40-Q49 | Phase 8A - CRM leads, opportunities, customer profiles |
| Q50-Q59 | Phase 8B - CRM catalogues and workflow |
| Q60-Q69 | Phase 7 - directory, templates, audit, activities |
| Q70-Q79 | Phase 10 - Trade foundation |
| Q110-Q119 | Phase 13 - global search, export, first-run onboarding |

Gaps left by a block that opened fewer questions than its size are permanent
and correct. Do not compact them.

## Backend defects found by reading source

Five entries in this file are not portal questions at all — they are defects
in backend services, found while verifying contracts. They are collected here
because a 1,200-line file is a good record and a poor alarm, and each one is
someone else's to fix:

| # | Defect | Consequence |
| --- | --- | --- |
| [Q17](#q17--crm-apps-permission-grants-were-only-partly-applied--backend-defect-blocks-all-crm-screens) | crm-app's permission grants were only partly applied on the live tenants — only `tenant_users` was granted | **Blocks every CRM screen from live testing**, on top of P4. CRM is blocked twice over |
| [Q36](#q36--the-gateway-pdf-location-contract-does-not-match-what-trade-app-emits) | The Gateway's PDF `Location` prefix does not match what trade-app emits | The confirm-202 flow answers **502** at the Gateway. Source-level reading of two components with no test covering them together |
| [Q72](#q72--a-malformed-item-or-channel-code-is-a-500-not-a-validation-error) | `normalizeTradeCode` throws a bare `TypeError` past the validation pipe | A malformed item or channel `code` is a **500**, not a 400. The portal validates client-side so a user does not meet it, which hides it rather than fixing it |
| [Q120](#q120--a-bare-for-share-with-a-left-join-is-rejected-by-postgresql--backend-defect) | crm-app takes a bare `FOR SHARE` on a query carrying a `LEFT JOIN` | PostgreSQL **rejects the statement outright**. Every request down that path is a 500, not a slow path. Reproduced here on PostgreSQL 16.15 |
| [Q121](#q121--78-of-98-crm-permission-labels-return-english-for-both-languages--backend-defect) | `permissionLabel`'s fallback returns the **identical** string for `en` and `ar` | 78 of 98 permission labels render untranslated in Arabic on `/crm/static-data-catalogue`, presented as if they were translations |

None is worked around in portal code beyond what is stated. Q72's client-side
guard is the one partial exception, and it is named as a mask, not a fix.
Q121's is the second: Phase 14 detects the equality rather than trusting it,
which stops the portal *asserting* a translation it does not have. It does not
translate anything.

**A third candidate was checked and is not a defect.** The CRM audit's P1-05
said `PATCH /widgets/:id` "replaces `query_spec` unconditionally", and
[D23](DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31)
recorded it that way. Re-reading `dashboard-widgets.service.ts` before acting on
it showed the SQL parameter is already `dto.querySpec ?? current.querySpec`
(line 102), so omitting the key preserves the stored spec and the contract is
sound. The data loss was entirely the portal's — it sent a rebuilt spec when it
could have sent nothing. Recorded here so the next reader does not re-open it as
a backend ask. **This is why claims get re-verified before they become work.**

## Status

**Q1–Q14 are settled** — nine during the 2026-08-27 documentation rebuild,
Q10 and Q11 during Phase 2/3 execution, Q13 and Q14 by explicit decision on
2026-08-28, and Q4 finally closed on 2026-08-30 by measurement rather than
argument. Q12 is a logged scope deferral, not a settled answer.

**Q15–Q24 are open, and they are a different kind of question.** The first
fourteen were gaps in *our* documentation. These are gaps in the *API*: a
state the portal must render that no endpoint returns, or two distinct
failures the backend collapses into one code. Each entry therefore records
what the screen does instead, and that behaviour is a deliberate choice, not
a placeholder. Q17 is the exception — a backend misconfiguration that blocks
live CRM testing outright.

Nothing is deleted from this file, including resolved entries. The reasoning
is the value; the answer alone would not have prevented the next mistake.

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

## Q17 — crm-app's permission grants were only partly applied · **backend defect, blocks all CRM screens**

Found 2026-08-31 by signing in as a real tenant owner and opening `/crm/leads`.

**Every CRM route returns 500.** `crm-app` logs:

```text
QueryFailedError: permission denied for table tenant_permissions
  path: /api/v1/crm/lead-stages
  errorCode: COMMON.GENERIC.INTERNAL_ERROR
```

`CrmPermissionsGuard` runs on every CRM request and resolves permissions from
those tables, so **no CRM route can succeed** — this is not leads-specific.

### The manifest is correct. The apply was partial.

The CRM permission manifest is at **version 2**, and it declares exactly the
relations the guard needs:

```text
tenant.tenant_users            tenant.tenant_permissions
tenant.tenant_roles            tenant.tenant_role_permissions
tenant.tenant_user_branch_roles  tenant.companies   tenant.branches
```

The binding's `permission_manifest_checksum` is `3fe960ded40e`, which **matches
manifest v2**, and `status` is **`READY`**.

But in the tenant database, `mutakamel_crm_app` actually holds grants on
**one** of those relations:

| Relation declared in v2 | Granted in the tenant DB |
| --- | --- |
| `tenant_users` | **yes** — SELECT on 14 columns |
| `tenant_permissions` | **no** |
| `tenant_roles` | **no** |
| `tenant_role_permissions` | **no** |
| `tenant_user_branch_roles` | **no** |
| `companies` | **no** |
| `branches` | **no** |

**Both provisioned tenants are identical** — `mersany` and `wallettest02` each
show the same partial state — so this is systemic, not a per-tenant miss.

### The part that matters beyond CRM

**`status = READY` with a matching checksum is not evidence that the grants
exist.** The binding reports success for a manifest that was only partly
applied. Anything that trusts that readiness signal — provisioning gates,
health checks, the fleet view — is trusting a value that does not reflect the
database.

> An earlier version of this entry guessed the manifest was missing those
> tables. That was wrong: the manifest lists them. The grants are what is
> missing. Recorded because the wrong diagnosis would have sent someone to edit
> a correct file.

### Consequence for this plan

Manual-test sections **C, D and E** (leads, conversion, opportunities, customer
profiles, the three views) cannot run against any tenant until this is fixed.
Core screens are unaffected and were verified working —
`/core/authentication` renders a live `DataTable` at the correct density.

**Not fixed here.** `AGENTS.md`: never edit backend source to resolve a frontend
problem. This needs a re-apply of the CRM grants, which is the backend's call.

## Q24 — do the four CRM `BRANCH_REQUIRED` routes reject a request with no scope headers?

Opened **2026-08-31** during MASTER-PLAN 3.22.

The Gateway validates organization-scope SHAPE per route before the handler
runs —
`api-gateway-app/src/common/middleware/route-context.middleware.ts`,
`validateOrganizationScope()`. For `BRANCH_REQUIRED` it requires **both**
`x-mutakamel-company-id` and `x-mutakamel-branch-id`, and throws
`REQUEST_INVALID` otherwise.

Four CRM routes carry that mode in `docs/generated/tenant-api-routes.json`,
and three of them are called by this portal today with a `branchId` **query
parameter and no headers at all**:

- `GET /api/tenant/crm/v1/customer-profiles/capabilities`
- `GET /api/tenant/crm/v1/leads/capabilities`
- `GET /api/tenant/crm/v1/opportunities/capabilities`

Read literally, every one of those is a 400 against a real Gateway. But the
CRM screens were driven manually on 2026-08-30 and the capabilities calls did
not obviously fail, which does not fit. Either the deployed route manifest
carries no `organizationScopeMode` for these rows (the middleware returns
early for legacy rows), or the failure was masked — `useLeads` treats a failed
capabilities call as "no capability" rather than an error.

This cannot be settled from source: it depends on the **deployed** manifest,
not the contract file.

**Assumed:** the contract is right and the headers belong there.
`src/lib/api/organization-scope.ts` resolves them and
`useCustomerProfilesCapabilities` now sends them — but **additively**: when
the branch's owning company cannot be derived from the user's team
memberships the resolver returns `{}` and the request goes out exactly as it
did before. A misreading here cannot blank a working screen.

**Settle with:** one authenticated request to
`/api/tenant/crm/v1/leads/capabilities?branchId=…` against a real Gateway,
with and without the two headers, and the response status of each. If the
header-less form is a 400, the same wiring is needed on `useLeads` and
`usePipelineWorkspace`, and every Core `OPTIONAL_COMPANY_BRANCH` route in
phases 5–7 needs it from the start.

## Q22 — the email DNS records a tenant must publish are not returned by the API

MASTER-PLAN 5.8 asks for "the DNS record values shown for copy-paste". Only the
record **host** is derivable: `DnsTenantEmailVerificationAdapter.verify` looks up
`${dkimSelector}._domainkey.${senderDomain}`, and both halves are in the safe
projection. The **expected value** lives in the deployment-side proof registry
(`TENANT_EMAIL_DKIM_PROOFS_V1_JSON`, an env var read in core-app) and is never
sent to the browser. **There is no SPF check at all** — the verifier reads DKIM
only, so an SPF row on that panel would be a fabricated record.

**Assumed:** `/core/settings/email` shows the sender domain, the DKIM selector
and the derived DKIM host, each copyable, plus verification status — and says
in as many words that the expected value and any SPF record are not returned by
the API and must come from the email provider. Nothing is invented.

**Settle with:** a decision on whether Core should project the tenant's own
proof row (host, record type, expected values) onto `GET /email-config`. Until
it does, the screen cannot show a value to paste.

## Q23 — device tokens can be registered and revoked but never listed

MASTER-PLAN 5.12 asks for register **and** revoke. Both exist
(`POST /notifications/device-tokens`, `DELETE /notifications/device-tokens/:id`),
but the 14 notification routes contain no listing, so a returning user cannot
see which devices are registered, and revoke can only ever target an id the
client already holds.

**Assumed:** the devices panel registers, shows what the registration response
returned for this session, and offers revoke on exactly those rows — with a line
saying the API exposes no listing. It does not render an empty list that would
read as "no devices".

**Settle with:** a `GET /notifications/device-tokens` route, or a decision that
device registration is fire-and-forget and the panel should not offer revoke at
all.

## Q18 — the session-ending reason cannot reach `/session-expired`

Found 2026-08-31 building MASTER-PLAN 4.24. **First half closed 2026-08-31 by
13.7; second half still open, and narrower than it looked.**

> **Status.** The code now rides `endedReason` on `TenantAuthContextValue` and
> the guard appends it to the `/session-expired` destination it already chose —
> permitted by HANDOFF.md's second 2026-08-31 amendment. What remains is the
> second problem below, and building the first half found the exact mechanism
> that makes it bite.
>
> `AuthContext`'s `router.replace("/login")` is not usually reached by a
> deliberate sign-out. It is reached because the **transport** ends the session
> first: on a definitive refresh failure `endTenantBrowserSession` publishes the
> same cross-tab tombstone another tab would send, that tombstone carries a
> session id and **no code**, and the handler for it here redirects to `/login`
> and clears the reason. So the reason is not merely un-routed — on that path it
> is destroyed before any component could read it.
>
> That splits the remaining work in two, and only the first is a one-line edit:
> re-point the two `router.replace("/login")` calls, **and** decide whether the
> code should ride the cross-tab `session-ended` event at all. The second is a
> change to the cross-tab session-sync payload, which is the spine behaviour the
> Tier-1 fence exists to protect — so it wants its own review, not a ride on a
> UX task.
>
> Still open alongside it: `SESSION_IDENTITY_INACTIVE` is one of the seven codes
> and belongs on `/account-suspended`, but choosing a different destination is a
> change to *which* destination the guard picks, which the amendment does not
> permit. Today it reaches `/session-expired` and gets the honest generic
> headline rather than an expiry message it does not deserve.

`/session-expired` is supposed to say *why* the session ended. The seven codes
that end a session are listed in `SESSION_ENDING_AUTH_CODES` in
`src/lib/auth/sessionErrors.ts`, and they map cleanly onto the four reasons the
task asks for — idle timeout, absolute expiry, ended elsewhere, security state
changed — plus `SESSION_IDENTITY_INACTIVE`, which is an account state and gets
`/account-suspended` instead.

**The code never reaches a component.** `SESSION_ENDING_AUTH_CODES` is a private
const, and `AuthContext` classifies the failure and then discards the code:
`setAuthState("ENDED")` carries no payload, and `TenantAuthContextValue` has no
field for it. Both files are Tier-1 (`docs/architecture/data-layer.md`), so the
one-line change that would fix this — put the code on the context value — is not
this phase's to make.

There is a second, narrower problem underneath it. `AuthContext` itself calls
`router.replace("/login")` on a cross-tab `session-ended` event and on the
lifecycle `ENDED` transition. The guard's redirect only wins on the bootstrap
path, where `AuthContext` does not redirect. So a session that ends *while the
user is working* still lands on `/login`, not on the new screen.

**Assumed:** `TenantAuthGuard` sends `authState === "ENDED"` to
`/session-expired`, and the page renders the specific reason when one arrives as
`?reason=` — validated against the exported `isSessionEndingAuthCode` so a
hand-edited query string cannot select an arbitrary message — and an honest
generic headline otherwise. Nothing invents a reason it was not given.

**Settle with:** adding `endedReason?: string` to `TenantAuthContextValue` and
routing `AuthContext`'s two `router.replace("/login")` calls through the same
decision the guard makes. Both are one-line Tier-1 edits and want their own
review.

## Q19 — three of the five tenant statuses cannot be observed by the portal

Found 2026-08-31 building MASTER-PLAN 4.26.

`TenantStatusEnum` has five values — PROVISIONING, PROVISIONING_FAILED, ACTIVE,
SUSPENDED, DELETED — and the task asks the portal to render the first, second
and fifth distinctly instead of 404-ing them.

**The endpoint cannot report them.** `TenantHostStatusService.resolve`
(`core-app/src/tenant/tenant-host/tenant-host-status.service.ts`) filters
`AND t.status IN ($3, $4)` with ACTIVE and SUSPENDED, and throws
`404 TENANT_HOST_NOT_FOUND` for every other row. Its own return type is
`{ status: ACTIVE | SUSPENDED }`. A provisioning tenant, a failed provision and
a deleted tenant are therefore **indistinguishable on the wire** from a hostname
that was never registered.

**Assumed:** `TenantHostStatus` stays a two-value union. Widening the client
enum to five would add three states the client can never enter, and any UI hung
off them would be unreachable code pretending to be a feature.

**Settle with:** returning the real status from the public host-status route
(and deciding what a DELETED tenant should be told), or an explicit decision
that the three states are deliberately opaque pre-authentication, in which case
4.26 should be struck rather than deferred.

## Q20 — expired, already-used and revoked action tokens share one error code

Found 2026-08-31 building MASTER-PLAN 4.30.

The task asks `/tenant/accept-invite` and `/tenant/reset-password` to render
expired, already-consumed and revoked as three distinct states.

**One code covers all three.** `TenantAuthService.findUsableActionToken` looks
the token up with `{ tokenHash, type, used: false }` and then checks `expiresAt`,
and every failure — not found, already used, past expiry — throws the same
`400 INVALID_ACTION_TOKEN`. `resetPassword` and `acceptInvite` reuse that code
again when the user is in the wrong status. The response body carries no
`details` that separate them.

**Assumed:** one rejected state that names all three possibilities plainly, plus
the flow's own next step, plus the correlation id. A **fourth** state is genuinely
client-detectable and is rendered separately: a link opened with no token in its
fragment, which is a different problem with a different fix.

**Settle with:** distinct codes — `ACTION_TOKEN_EXPIRED`,
`ACTION_TOKEN_ALREADY_USED`, `ACTION_TOKEN_REVOKED`. Note that discriminating
them leaks whether a token ever existed, so this is a security decision as much
as a UX one, and should be settled deliberately rather than assumed.

## Q21 — there is no resend-invitation route

Found 2026-08-31 building MASTER-PLAN 4.33.

The INVITED lifecycle asks for pending badge, resend, revoke and invite-expired.
Three are buildable: the badge from `UserStatusEnum.INVITED`, revoke from
`DELETE /users/:id`, and invite-expired from Q20's shared rejected state.

**Resend has no route.** `TenantUsersController` exposes 22 routes and none of
them re-sends an invitation; `TenantUsersService.invite` enqueues the email once
as part of `POST /users`. The admin-side controller has its own re-invite path,
but that is a platform-operator surface on a different audience, and the tenant
portal must not call it.

**Assumed:** `/core/users/[id]` states plainly that the invitation cannot be
re-sent from here and that a new invitation means revoking this one and inviting
the address again. No disabled "Resend" button — a control that can never work is
worse than none.

**Settle with:** a `POST /users/:id/resend-invite` route on the tenant
controller, or a decision that revoke-and-reinvite is the intended flow, in which
case 4.33's wording should drop "resend".

## How to add one

Do not delete a resolved entry — the reasoning is the value. Append new
questions below with the same shape:

```markdown
## Q<n> — <the question>

<why it cannot be answered from source>

**Assumed:** <what you did instead>
**Settle with:** <who or what closes it>
```

---

# Trade contract documentation — Q30-Q39

Opened 2026-08-31 while writing [../api/trade-foundation.md](../api/trade-foundation.md),
[../api/trade-documents.md](../api/trade-documents.md) and
[../api/trade-advanced.md](../api/trade-advanced.md) from `trade-app` source.
These are the reserved Q30-Q39 block. All ten are gaps in the **API**, not in
our documentation.

## Q30 — Trade exposes no `capabilities` endpoint

Standing requirement S6 says route admission comes from `/auth/me` and **action**
admission from the `capabilities` endpoints, because permission strings do not
account for branch and owner scope. CRM has three such endpoints.

**Trade has none.** Sweeping `trade-app/src` for `capabilit` returns only
database provisioning probes and the unrelated `capabilitySet` field on an item
company profile. There is no per-record and no per-scope capability route among
the 231.

This matters more in Trade than in CRM, because `TradePermissionsGuard` matches
`scope_target` **exactly** — a `TENANT` grant does not satisfy a `BRANCH`-target
route — and the only bypass is `tenant_users.is_tenant_owner`. So a permission
string alone genuinely cannot predict whether an action will be accepted.

**Assumed:** Phase 10-12 screens gate actions on the permission string from
`/auth/me` plus `user.isTenantOwner`, and treat a 403
`TRADE.AUTH.TARGET_DENIED` as an authoritative refusal rendered through
`PermissionGate` rather than as a bug. Optimistic enabling, honest failure.

**Settle with:** a Trade capabilities route per family, mirroring the CRM shape,
or an explicit decision that Trade action gating is permission-string-only and
S6 is scoped to CRM.

## Q31 — three Trade status fields have no enumerable value set

Three fields the portal must render as labelled badges are `varchar` with a
free-string validator, no exported enum, and no database check constraint:

| Field | Validator | Values proven from source |
| --- | --- | --- |
| item channel listing `publicationStatus` | `@IsString() @MaxLength(32)`, default `"DRAFT"` | `DRAFT` |
| channel `status` (`UpdateChannelDto`) | `@IsString() @MaxLength(32)` | `ACTIVE` — compared as a literal in `trade-scope.guard.ts` |
| commercial account `status` | list filter is `@IsString() @MaxLength(32)` | `ACTIVE`, `BLOCKED` — written by `block` and `unblock` |

`AGENTS.md` requires a `t.status.*` label for every rendered enum value and
forbids displaying a raw wire value. That cannot be guaranteed for these three.

A related but distinct case: the commercial-account branch rule `status` is
typed in TypeScript as `"ACTIVE" | "RETIRED"` but validated only as
`@IsString() @MaxLength(16)`, so the union is not enforced at runtime either.

**Assumed:** the three pages document the proven values and say the set is not
closed. Screens render a known label when the value matches a known member and
fall back to a neutral unknown-state chip — never the raw string — otherwise.

**Settle with:** exporting these three as enums in
`@mutakamel/trade-app-common` alongside the other 30, or adding database check
constraints the docs can cite.

## Q32 — `taxSnapshot`, `priceSnapshot` and `termsSnapshot` have no schema

Every commercial document write requires one or more opaque objects:

- every order and invoice line: `taxSnapshot` — `@IsObject()`, and
  `validateNewOrderFinancialEvidence` additionally requires it to be
  **non-empty**
- every invoice line: `priceSnapshot` — same
- invoices, contracts, purchase quotations: `termsSnapshot` / `terms`
- contracts: `financialTerms.sourceEvidence`
- control-tower resolve: `evidence`

Nothing in the DTOs, the validators or the services says what belongs inside
any of them. `@IsObject()` accepts `{ "a": 1 }`. The only rule discoverable
from source is that it must not be empty.

A portal cannot author a legally printable tax snapshot from a schema it
cannot see, and a wrong one is indistinguishable from a right one until the
document is rendered.

**Assumed:** nothing. This blocks the Phase 11 create forms outright — there is
no honest placeholder for a tax snapshot. The create screens cannot be built
until the shape is known.

**Settle with:** a published JSON schema per snapshot field, or a Trade
endpoint that returns the tax and price evidence for a line so the browser
forwards it rather than composing it.

## Q33 — fifteen distinct evidence failures share one code, one status and no field

`validateNewOrderFinancialEvidence`
(`trade-app/src/modules/documents/order-print-snapshot.service.ts`) throws
`incompleteSnapshot()` — **422 `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE`**,
with no `field`, no `details` and no index — for all of:

- a duplicate `clientLineId`
- a malformed or non-canonical decimal in any of five per-line amounts
- an empty `taxSnapshot`
- a line where `lineTotal` does not equal
  `quantity × unitPrice − discountTotal + chargeTotal + taxTotal`
- each of the six totals identities (`subtotal`, `discountTotal`,
  `chargeTotal`, `taxTotal`, `grandTotal`, `amountDue`)

The same code is also thrown from four other services. The portal receives one
422 and cannot say which line or which figure was rejected.

This is the exact failure mode the Phase 11 gate depends on catching — "every
total matching the server to the last decimal place" — and the API gives no way
to find the mismatch.

**Assumed:** the document create and edit screens recompute all seven
identities client-side before submitting and surface their own per-field
errors, so the server 422 is only ever reached on a genuine server/client
disagreement. That case renders as a whole-form error naming the code and the
correlation id, because nothing better is available.

**Settle with:** a `details` payload on the 422 naming the failed identity and,
where applicable, the `clientLineId`.

## Q34 — the confirmation-attempt `Location` is not a callable path

`POST /api/tenant/trade/v1/sales-orders/:id/confirm` returns **202** when
confirmation is queued and sets:

```text
Location: /trade/sales-orders/{orderId}/confirmation-attempts/{attemptId}
```

The Gateway rewrites a `Location` only when it matches one of the eight
mappings in `canonicalizeLegacyPublicPath`, all of which require an
`/api/v1/...` prefix. This one matches none, so it is forwarded verbatim. The
browser therefore receives a path that does not exist at the Gateway; calling
it is a 404.

**Assumed:** the portal ignores `Location` on this route and builds the poll
URL from the response body `orderId` and `attemptId`:
`/api/tenant/trade/v1/sales-orders/{orderId}/confirmation-attempts/{attemptId}`.
Documented on [../api/trade-documents.md](../api/trade-documents.md).

**Settle with:** trade-app emitting a canonical `Location`, or a decision that
async Trade operations are addressed from the body and the header is dropped.

## Q35 — a contract can be `SIGNED` but nothing can make it so

`ck_trade_contracts_final` allows `lifecycle_status` in `DRAFT`, `ACTIVE` and
`SIGNED`. `POST /contracts` writes `DRAFT` and `POST /contracts/:id/activate`
writes `ACTIVE`. **`SIGNED` is never written anywhere in `trade-app/src`.**

There is no sign route, no route that accepts a signature, and no route that
behaves differently for a signed contract.

**Assumed:** `/trade/contracts` renders all three states, because a row can
carry `SIGNED` from a projection or a migration, but offers no control that
produces it. The detail screen shows `SIGNED` as terminal and read-only.

**Settle with:** a `POST /contracts/:id/sign` route, or removing `SIGNED` from
the check constraint.

## Q36 — the Gateway PDF `Location` contract does not match what trade-app emits

`assertPublicLocationContract` in
`api-gateway-app/src/routing-proxy/routing-proxy.controller.ts` requires the
upstream `Location` on the six Trade `render-pdf` route keys to start with:

```text
/api/v1/trade/{segment}/{documentId}/render-jobs/
```

trade-app emits (`quotation-pdf.service.ts:566`,
`business-document-pdf.service.ts:604`, asserted by both services own unit
tests):

```text
/api/tenant/trade/v1/{segment}/{documentId}/render-jobs/{jobId}
```

The second does not start with the first. On that reading the Gateway raises
`GW.IDEM.RESPONSE_CONTRACT_BREACH` — **HTTP 502** — releases the idempotency
reservation, and the 202 never reaches the browser. No Gateway test exercises
this path; the route-policy spec only checks path patterns, not the assertion.

If correct, **every Trade PDF render fails at the edge**, and MASTER-PLAN task
11.7 ("the gateway enforces the exact `Location` prefix") describes an
enforcement that currently rejects the only producer.

**Assumed:** nothing built yet. The three Trade pages document the mismatch and
tell the portal to build the poll URL from `data.statusUrl` in the body, which
already carries the canonical form and is unaffected by whichever side is
corrected.

**Settle with:** a backend decision on which prefix is canonical, and a Gateway
test that covers the assertion. This is a backend defect, recorded here rather
than worked around, per `AGENTS.md`.

## Q37 — inventory movements can be created but never read

`/trade/inventory` exposes 26 routes. Receipts, deliveries, reservations and
opening balances can be **created, posted, released and reversed** — and not
listed, and not fetched by id. There is no `GET /inventory/receipts`, no
`GET /inventory/receipts/:id`, and no equivalent for the other three.

MASTER-PLAN task 12.27 asks for detail pages for receipts and deliveries.
There is no route behind either.

The only inventory reads are `availability` (one item at one node per call),
`nodes`, `periods`, `uom-conversions`, `serials` and `decisions`.

**Assumed:** the receipt and delivery detail pages in 12.27 cannot be built.
The inventory screens show movements only through the responses of the commands
that created them, and say so rather than linking to a page with no data
source.

**Settle with:** `GET` routes for the four movement families, or removing
receipts and deliveries from 12.27.

## Q38 — a document profile cannot be fetched by id

`/trade/document-profiles` exposes five routes: list, create, create-version,
validate-version, publish-version. There is **no `GET /document-profiles/:id`**
and **no `GET /document-profile-versions/:id`**.

A profile can therefore be created, versioned and published, but its current
state can only be read from a row in the paginated list.

**Assumed:** the Phase 12 document-profile screen is list-only, with an
expanding row rather than a detail route, and version history is not viewable.

**Settle with:** `GET` routes for the profile and the version.

## Q39 — import results cannot be downloaded

MASTER-PLAN task 12.28 asks for an import partial-success page whose
succeeded / failed / skipped rows are "downloadable".

`GET /api/tenant/trade/v1/imports/:runId/results` is a paginated JSON list
(`page`, `limit` up to 100, `status` filter). There is no CSV route, no export
route, and no signed-artifact route anywhere in the 231. `POST /imports/sources`
uploads a file; nothing in Trade serves one back.

**Assumed:** the results page paginates in the browser and offers no download.
If a download is required it would have to be composed client-side from the
paginated JSON, which contradicts the never-simulate rule for any run larger
than the page cap.

**Settle with:** a results-export route, or dropping "downloadable" from 12.28.

## Q25 — no tenant-facing module / tier catalogue for a plan change

`CreateSubscriptionPlanChangePreviewDto` accepts three operations. For a TENANT
actor `SubscriptionItemsService.preparePlanChange` refuses `REMOVE` outright
(`DOWNGRADE_NOT_ALLOWED`), which leaves `ADD` and `CHANGE`.

`ADD` requires **exactly one of** `moduleId`/`moduleKey` **and** exactly one of
`tierId`/`tierKey`, plus `seats` (`assertPlanChangeDtoShape`). `CHANGE` with a
tier upgrade requires a `tierId`/`tierKey` on the item's module.

**There is no tenant route that enumerates modules or tiers.** The generated
inventory carries no `/api/tenant/core/v1/...` catalogue path — the module and
tier catalogues live behind `AdminGuard`. `GET /subscription` returns
`moduleKey`/`tierKey` for the items the tenant **already has**, and nothing for
the ones it could add or upgrade to.

So the portal can express only `operation: CHANGE` with `itemId` + `seats`. A
module or tier picker would have to be a free-text key field, and a wrong key is
a `MODULE_NOT_FOUND` / `TIER_NOT_FOUND` — a guessing game with a rejection at
the end, which `anti-patterns.md#13-fake-data-and-fake-success` rules out.

**Assumed:** `/core/subscription` offers seat increases only, and states plainly
that adding a module or moving to a higher tier is arranged by support.
MASTER-PLAN 6.12 is marked `[/]` for this reason.

**Settle with:** a tenant-readable module/tier catalogue route (the shape
`SubscriptionItemView` already implies), or a decision that self-serve module
purchase stays out of the portal.

## Q26 — a wallet top-up's status cannot be read back

`POST /payments/topup` returns `{ paymentId, checkoutUrl }`, and the owner then
leaves for the hosted checkout. Reading that payment back is the whole point of
the "a URL success is never settlement authority" rule.

`GET /billing/payments/:paymentId` cannot serve it. `getTenantPaymentStatus`
requires `payment.purpose === INVOICE_SETTLEMENT` **and** a non-null
`invoiceId`, and a top-up is `WALLET_TOP_UP` with `invoiceId: null` — so it
throws `PAYMENT_NOT_FOUND` for the very payment the route just created.

The only readback is `GET /payments`, the paginated list, which does include
both purposes. There is no per-payment route for a top-up and no active-intent
route outside the invoice path.

**Assumed:** after a top-up the billing screen refreshes the wallet and the
payments list rather than polling one payment, and the copy says the wallet
updates when the provider confirms — not when the checkout page closes.

**Settle with:** relaxing the purpose check on `GET /billing/payments/:id`, or a
`GET /payments/:id` that covers both purposes.

## Q27 — `PublicBrandingView` carries two fields the contract page omits

`docs/api/core-billing.md` listed the public payload as six fields
(`primaryColor · secondaryColor · fontFamily · appName · tabTitle · loginHtml`)
and stated "There are no storage keys in it."

The no-storage-keys half is correct. The field list is not: `BrandingService.getPublic()`
returns **eight** fields — the six above plus `logoUrl` and `iconUrl`, which are
same-origin **paths** to the two public binary routes
(`/api/tenant/core/v1/branding/public/logo` and `.../icon`), or `null` when no
asset is stored or storage is unavailable. `branding.controller.ts` pins the same
shape in its Swagger example.

Corrected in the contract page in this task. Recorded here because the omission
is the same class of error the page itself was written to fix, and because a
future reader of that sentence would otherwise conclude the portal invented the
two fields it validates.

**Settle with:** nothing — already corrected. Listed for the record.

## Q28 — the nav could not express an owner-only route

`NavItem.hasAccess` was `(permissions: readonly string[]) => boolean`, and
`useNavTree` / `SubNav` passed only the permission array.

Billing and subscription carry **no permission strings at all** — both
controllers are `@UseGuards(TenantGuard, TenantOwnerGuard)` with no
`@RequirePermissions` anywhere — so there is nothing for `hasAccess` to look up.
Every available option was wrong: `() => true` shows Billing to every member of
staff, and any invented permission key either locks the owner out or admits
everybody.

**Resolved by** adding one optional field, `requiresTenantOwner?: boolean`, to
`NavItem`, and three lines across `useNavTree.ts` and `SubNav.tsx` that check
`user.isTenantOwner` for those items. Additive and backwards-compatible: every
existing item is untouched and still filtered by `hasAccess`.

Recorded because it is a change to `src/design-system/shell/`, which Phase 6 was
otherwise scoped out of. `core-settings-nav.test.ts` pins the new predicate.

## Q50 — the CRM task list cannot show three fields the task write accepts

`CreateTaskDto` and `UpdateTaskDto` both accept `description`,
`assigneeUserId` and `priority`
(`crm-app/src/crm/activities/dto/activity.dto.ts`).
`ActivitiesService.listScopedTasks` selects only

```text
id, branchId, sourceType, sourceId, title, dueAt, status,
createdAt, updatedAt, deletedAt
```

and there is **no `GET /tasks/:id`** to fill the gap. So a task's description,
priority and assignee can be written but never read back by this portal.

`listScopedEvents` and `listScopedReminders` have the same shape of gap:
an event's `description`, `location` and `attendees` and a reminder's `channel`
are all writable and none of them are returned.

**Done instead.** `/crm/tasks`' edit drawer offers only `title`, `status` and
`dueAt`, and says so in the drawer. The three unreadable fields are offered on
**create**, where the user is supplying them, and are never included in a
`PATCH` body — the service merges `{...task, ...dto}`, so omitting them
preserves the stored values, whereas submitting a blank input the user never
saw would silently erase one. `/crm/calendar` does the same for its three.

**Settle with:** crm-app. Either widen the list projections or add
`GET /tasks/:id`, `GET /calendar/events/:id` and `GET /reminders/:id`.

## Q51 — a calendar event's `attendees` has no declared item shape

`CreateCalendarEventDto.attendees` is `@IsArray() @ArrayMaxSize(100)
attendees?: unknown[]`, and `CrmCalendarEventEntity.attendees` is `unknown[]`.
Nothing in crm-app states what one entry contains — not a DTO, not the entity,
not a Swagger example, not the service, which only defaults it to `[]`.

**Done instead.** `buildCreateEventRequest` never sends the key, and the create
drawer says why. `forbidNonWhitelisted` would accept any array, so an invented
`{ name, email }` entry would be stored and would then be wrong for whoever
eventually reads it.

**Settle with:** crm-app — give `attendees` an item DTO, or drop the field.

## Q52 — four CRM records have a list route and no detail route

MASTER-PLAN 8.27 asks for detail pages for `/crm/activities`, `/crm/tasks`,
`/crm/calendar` and `/crm/reminders`. `ActivitiesController` exposes **no
`GET /:id`** for any of them, and none of the four list DTOs
(`ActivitiesQueryDto`, `TasksQueryDto`, `RemindersQueryDto`,
`BranchListQueryDto`) accepts an id filter — so a routed `/crm/tasks/[id]`
page has no request it could make to load the record it is addressed by.

**Done instead.** `/crm/pipelines/[id]` and `/crm/opportunity-stages/[id]` are
real routed detail pages, because `GET /pipelines/:id` and
`GET /opportunity-stages/:id` exist. For the other four the detail surface is a
drawer over the row the list already holds — every field the projection
returns, nothing invented, and a line saying no per-record route exists. The
alternative, scanning pages until an id matched, would be a fabricated fetch
that silently fails past page one.

**Settle with:** crm-app — add `GET /activities/:id`, `GET /tasks/:id`,
`GET /calendar/events/:id` and `GET /reminders/:id`, or add an `id` filter to
the four list queries.

## Q53 — `activities.update` has no capabilities signal

S6 and defect D11 require **action** admission to come from the CRM
capabilities endpoints rather than from `/auth/me` permission strings.
`LeadsCapabilitiesResponse` (`crm-app/src/crm/leads/leads.service.ts`) carries

```text
activities: { create: LeadsActionCapability | null }
```

and nothing else for this family. `PATCH /tasks/:id`,
`PATCH /calendar/events/:id` and `PATCH /reminders/:id/cancel` are all guarded
by the scoped `crm.activities.update`, whose owner boundary in a given branch
is exactly what a capability would report and a permission string cannot.

**Done instead.** Create controls on `/crm/tasks`, `/crm/calendar` and
`/crm/reminders` are gated on `activities.create` from
`GET /leads/capabilities?branchId=…` (`src/hooks/useCrmActivityCapabilities.ts`),
which requires no leads permission — only branch membership. Update and cancel
controls fall back to the scoped permission string, with the backend as the
authority. This is D11's exact failure mode, narrowed rather than closed: a
user with `crm.activities.update.own` still sees an edit control on a task they
do not own.

**Settle with:** crm-app — add `activities: { update }` to the capabilities
response, or expose `GET /activities/capabilities`.

## Q60 — `ApiIfMatchHeader()` documents a looser ETag than `parseRevisionEtag` accepts

**Asked by:** Phase 7 (template platform) · **Status:** answered from source,
recorded so the next reader does not trust the annotation

`docs/api/core-templates.md` said weak tags and bare integers were accepted on
every mutating template route, quoting the Swagger annotation
`ApiIfMatchHeader()`:

```text
^(?:W/)?"?[1-9][0-9]*"?$
```

The annotation is not the parser. `parseRevisionEtag`
(`core-app/src/tenant/template-platform/template-platform.errors.ts`) matches

```text
^"([1-9][0-9]*)"$          // and ^"asset:<assetId>:([1-9][0-9]*)"$ for assets
```

so `W/"7"` and `7` are both refused — as a **409**
`CORE.TEMPLATE.CONCURRENCY.STALE_REVISION`, which reads as "someone else edited
this" rather than "your header shape is wrong". A missing header is a **428**
`CORE.TEMPLATE.CONCURRENCY.PRECONDITION_REQUIRED`.

**Done instead.** No portal code constructs an ETag for these routes: every
write echoes the server's own `etag` field verbatim (`definitionEtag`,
`currentDraft.etag`, the asset's namespaced `etag`), so both shapes are correct
by construction. The templates API page has been corrected.

**Settle with:** core-app — either loosen `parseRevisionEtag` to the shape the
annotation advertises, or narrow `ApiIfMatchHeader()` so the generated Swagger
stops advertising a form the server rejects. Answering the strict-form refusal
with 428 rather than 409 would also stop it masquerading as a concurrency
conflict.

## Q61 — a party role cannot be scoped to a branch from the portal

**Asked by:** Phase 7 (directory) · **Status:** open, blocked on a branch picker

`CreatePartyRoleDto` accepts an optional `branchId`, and MASTER-PLAN 7.6 asks
for branch-scoped roles. `DirectoryService.addRole` re-checks the value against
the actor's branch scope and answers `BRANCH_PERMISSION_DENIED` when it is
outside it, so the field is only usable with a picker that offers the branches
the actor can actually use.

The directory screens have no branch selector — `GET /directory/parties` takes
`branchId` as a filter, but there is no tenant-side route that answers "which
branches may this actor assign a party role in", and reusing the organization
tree would mean gating a directory screen on `org.branch.read`.

**Done instead.** Roles are assigned tenant-wide (`branchId` omitted), and
`docs/api/core-directory.md` records the omission.

**Settle with:** either a shared branch picker fed by the actor's own scope, or
a directory-side branch list route.

## Q40 — `/crm/leads/[id]` and `/crm/opportunities/[id]` are not admitted by the proxy

**Asked by:** Phase 8 (8.1, 8.10) · **Status:** **resolved 2026-08-31 by the coordinator**

**It was worse than the question states.** Six CRM detail screens were built
and only `customer-profiles` was admitted: `leads`, `opportunities`,
`pipelines`, `opportunity-stages` and `outbound-emails` all redirected to
`/unavailable` before their page ever ran. Phase 8A could only see the two it
owned.

Fixed by replacing the single hardcoded pattern with a `CRM_DETAIL_PATHS`
regex that mirrors `CORE_DETAIL_PATHS` — the Core side had already hit this
and solved it. Tests pin all six, plus two negatives: a second segment
(`/crm/leads/:id/notes`) and a segment with no `[id]` route (`/crm/tasks/:id`),
so the pattern cannot silently widen.

**The lesson is the shape of the bug, not the fix.** A screen can be complete,
tested and green while being unreachable, because admission lives in a
different file from the route. Nothing in `pnpm verify` connects the two — the
only thing that would have caught it is opening the page. Every future phase
that adds a detail route must add it here in the same change.

`src/proxy.ts` matches `/crm/:path*` and redirects anything
`isSupportedCrmPath()` rejects to `/unavailable`. That predicate admits the CRM
exact paths plus exactly one detail pattern:

```ts
/^\/crm\/customer-profiles\/[^/]+$/u
```

The two detail routes built for 8.1 and 8.10 render correctly and are reachable
in tests, but a browser navigating to either one is redirected away before the
page runs.

`src/lib/navigation/tenant-routes.ts` is outside this phase's ownership — the
coordinator assigned `src/lib/**` to nobody in Phase 8 — so the predicate was
not widened here.

**Settle with:** one line in `isSupportedCrmPath()`, widening the detail pattern
to the three list routes that now have detail pages:

```ts
/^\/crm\/(?:customer-profiles|leads|opportunities)\/[^/]+$/u
```

`TENANT_ROUTES` needs no new entry: both pages are reached from their list, not
from the nav.

## Q41 — a customer profile's contacts cannot be listed, only added

**Asked by:** Phase 8 (8.7) · **Status:** open

`POST /customer-profiles/:id/contacts` creates a contact person and links it to
a corporate profile. Nothing reads them back: `GET /customer-profiles/:id`
returns `CustomerProfileReadModel`, and `selectPartySummary` joins the
acquisition source and a party summary — never `party_relationships`. The
`/leads/company-options/:companyPartyId/contacts` route does list an
organization's contacts, but it is gated on `crm.leads.create` and scoped to the
lead branch, so it is not the customer screen's route.

**Done instead.** The detail screen adds contacts and does not claim to show
them. A contacts card would either invent the data or call a route that does
not exist.

**Settle with:** crm-app — either join the contact relationships into
`CustomerProfileReadModel`, or add
`GET /customer-profiles/:id/contacts` gated on `crm.customer_profiles.read`.

## Q42 — the CRM attachment cap is 25 MiB, not the 26 MiB the plan states

**Asked by:** Phase 8 (8.25) · **Status:** resolved in source, docs still wrong

MASTER-PLAN 8.25 and 1.7 both give the CRM attachment cap as **26 MiB**, and
`FileUpload`'s own doc comment repeats it. The per-file cap is
`MAX_SIZE_BYTES[BUCKETS.ATTACHMENTS] = 25 * 1024 * 1024` = **26 214 400 bytes**
(`shared-libs/packages/storage/src/constants/buckets.constant.ts`), enforced
twice in crm-app — multer's `limits.fileSize` and an explicit
`PayloadTooLargeException` whose message says "25 MB".

26 MiB is a real number belonging to a **different** limit: the Gateway's
whole-body ceiling for `/crm/attachments/upload` is
`MAX_ATTACHMENT_BODY_BYTES`, default `27_262_976` = 26 MiB
(`api-gateway-app/src/config/app.config.ts`) — the file plus its multipart
envelope. Enforcing 26 MiB on the **file** admits one the Gateway accepts and
crm-app then refuses with 413.

**Done instead.** `CRM_ATTACHMENT_MAX_BYTES` is 25 MiB, with both numbers and
their sources recorded on the constant and pinned by a test.

**Settle with:** correct the figure in MASTER-PLAN 1.7 and 8.25 and in
`FileUpload`'s `maxSizeBytes` doc comment — both are outside Phase 8's ownership.

---

# Trade foundation — Q70-Q79

Opened 2026-08-31 while building MASTER-PLAN Phase 10 against
[../api/trade-foundation.md](../api/trade-foundation.md) and `trade-app`
source. These are the reserved Q70-Q79 block; Q73-Q79 are unused and stay that
way.

## Q70 — the Trade operating-context selector has no name source it may read

Task 10.5 asks for a company / branch / channel selector. Trade resolves a
route's scope target — and therefore *which permission is checked at all* —
from three request headers, so the selection is load-bearing rather than
cosmetic.

`/auth/me` carries `accessibleCompanies` and `accessibleBranches` as **id
arrays** and `teamMemberships` as `{ companyId, branchId }` pairs. No name
anywhere. Trade itself publishes no company or branch route. The only names
reachable are Core's `GET /organization/companies` and `.../branches`, which
require `org.company.read` and `org.branch.read` — grants a Trade operator has
no reason to hold, and which live in another route group this screen may not
import from (`docs/architecture/file-architecture.md`, dependency direction).

**Assumed:** company and branch render as **ids**, in a monospace `Select`,
exactly as `src/components/tenant/TenantBranchSelect.tsx` already does across
every CRM screen. Channels render their real `name`, because `GET /channels`
returns one. The precedent is established and consistent; it is still poor for
a user with more than two or three branches.

**Settle with:** either a Trade-side lookup returning `{ id, name }` for the
companies and branches in the actor's scope, or a decision that the portal may
read Core's organization tree from any route group and degrade to ids on a 403.

## Q71 — a configuration definition cannot be fetched by id

`ConfigurationScopeController` exposes `GET /configuration/definitions` and
nothing else for reading. `findDefinition` and `findVersion` are **private** to
`ConfigurationScopeService`, and there is no `GET /configuration/definitions/:id`
and no `GET /configuration/versions/:id` among the 231 routes.

A definition's versions are only reachable as an embedded `versions` array on
the list response, filtered to the resolved scope. So a `/trade/configuration/:id`
detail route would have to page the entire list — up to 100 rows per request,
unbounded in total — to render one record.

**Assumed:** `/trade/configuration` has **no detail route**. The versions of the
selected definition, and their test and publish actions, render on the list
screen itself, and `/trade/configuration/:id` is deliberately absent from
`TRADE_DETAIL_PATHS` so a stale deep link redirects to `/unavailable` rather
than 404ing inside the shell. MASTER-PLAN 10.21 is therefore `[/]` for its
configuration third.

**Settle with:** a `GET /configuration/definitions/:id` mirroring the list's
projection, at the same `OPERATING_CONTEXT` target.

## Q72 — a malformed item or channel code is a 500, not a validation error

`CreateItemDto.canonicalCode` and `CreateChannelDto.code` are validated only as
`@IsString() @MinLength(1) @MaxLength(80)`. `CatalogService.create` and
`CatalogService.createChannel` then call `normalizeTradeCode`
(`trade-app/packages/common/src/helpers/validation.ts`), which throws a bare
**`TypeError`** for anything outside `^[A-Z0-9][A-Z0-9._-]{0,79}$`.

A `TypeError` is not a Nest `HttpException`, so it is not mapped: a code
containing a space, or a leading dot, passes the global `ValidationPipe` and
crashes the handler with a **500**. The user sees a server error for a typo.

The same helper is reached from the import path, so a bad `ITEM_CODE` in an
uploaded file has the same outcome.

`CreateUomDto` is **not** affected — it pins `^[A-Za-z][A-Za-z0-9._-]*$` at the
DTO, and `normalizeUomCode` throws a 422 rather than a `TypeError`.

**Assumed:** both portal screens enforce the pattern client-side before
submitting, so the 500 is unreachable from the UI. The API is unchanged and
still returns a 500 to any other caller.

**Settle with:** a `@Matches` on both DTO fields, or catching the `TypeError`
in the service and rethrowing `TRADE.VALIDATION_FAILED`.
## Q80 — a quotation revision the portal creates can never be converted

`CreateQuotationRevisionDto.terms` is `@IsOptional() @IsObject()` with the
default `{}`, and Q32 says the portal has no schema for a document terms
snapshot, so the portal omits the field and the server writes its own default.

`assertQuotationConversionEvidence`
(`trade-app/src/modules/documents/documents.service.ts:2392`) then requires the
accepted revision's `termsSnapshot` to be **non-empty** *and* the conversion
body's `terms` to reproduce it byte for byte, comparing both through
`canonicalJson`. A revision created with the DTO's own default therefore fails
conversion permanently, with `TRADE.FINALIZED_DOCUMENT.SNAPSHOT_INCOMPLETE` and
no indication that the cause is a field the caller never set.

This is a second, independent reason quotation-to-sales-order conversion cannot
be built, on top of the `taxSnapshot` gap.

**Assumed:** the quotation revision drawer omits `terms`, and the detail screen
renders the conversion boundary instead of a convert action, naming both
causes. MASTER-PLAN 11.6 is `[/]`.

**Settle with:** a published schema for the terms snapshot (which also settles
Q32), or dropping the non-empty requirement so a document with no special terms
can still be converted.

## Q81 — document lineage is written and never read

`trade_document_lineage` is populated on exactly one path — quotation
conversion writes `sourceType: "QUOTATION_REVISION"`,
`targetType: "SALES_ORDER"`, `relationshipType: "CONVERTED_TO"` — and **no
route reads the table**. Grepping `trade-app/src` for
`TradeDocumentLineageEntity` returns the import and that single `create`.

The only lineage the API exposes is on the documents themselves, and it runs
one way:

| Edge | Readable? |
| --- | --- |
| sales order to its source quotation | **yes** — `sourceQuotationId`, `sourceQuotationRevisionId`, and `sourceQuotationLineId` per line |
| quotation to the orders raised from it | no — no field, and `DocumentListQueryDto` has no `sourceQuotationId` filter |
| invoice to its sales order | no — `FinancialDocumentsService.create` writes `sourceSalesOrderId: null` unconditionally, and no route ever sets it |
| sales order to its invoices | no |
| contract, purchase quotation, purchase order | no lineage fields at all |

MASTER-PLAN 11.19 asks for "quotation to order to invoice, rendered as a
`Timeline` on every document". One of those two edges exists, in one direction,
on one of the six families.

**Assumed:** the sales-order detail renders the backward edge to its source
quotation and states plainly that Trade records no other. 11.19 is `[/]`.

**Settle with:** a `GET /documents/:id/lineage` route over the existing table,
or a `sourceSalesOrderId` on `CreateInvoiceDto` plus a filter on the list
queries.

## Q82 — the purchase-order approval ladder has no readable history

`trade_approval_instances` and `trade_approval_steps` are written by
`PurchasingService` on every submit, withdraw, approve and reject, and both
carry the evidence a reviewer would want: `makerUserId`, `assignedUserId`,
`reasonCode`, `decidedByUserId`, `decidedAt`, `decisionEvidence`.

**No route returns either.** `GET /purchase-orders/:id` answers
`{ ...order, lines }`, and there is no approvals endpoint anywhere in the 231.

The consequence is worst at `withdraw`, which sets the **order's**
`approval_status` back to `NOT_REQUIRED` rather than `WITHDRAWN`. On the order
row a withdrawn order is indistinguishable from one that was never submitted;
the step row records the difference and cannot be read.

MASTER-PLAN 11.14 asks for the ladder "using the `Timeline` pattern". A
timeline needs events, and the only readable thing is the current position.

**Assumed:** the screen renders a `Stepper` showing where the order stands,
labelled as a position rather than a history, and says the order row does not
record a withdrawal.

**Settle with:** `GET /purchase-orders/:id/approval` returning the instance and
its steps.

## Q83 — purchasing has no supplier name source

A purchase quotation needs `supplierPartyId`. Two routes could supply a name
for one and neither does:

- **`GET /commercial-accounts`** returns `TradeCommercialAccountEntity` rows.
  The entity's only identity column is `party_id`; there is no name, no
  snapshot and no join.
- **`GET /commercial-accounts/lookups`** does not return accounts at all. It
  returns `paymentTerms`, `creditPolicies` and `limitations` — reference ids
  for the commercial-account form.

Quotations have `GET /quotations/customer-options`, which carries a
`displayName` drawn from the CRM projection. Purchasing has no equivalent, and
`crm_trade_quotation_customer_projection_v1` is customer-side only.

This is the same class as **Q14** (opportunities render raw ids) and **Q70**
(the operating-context selector has no name source it may read).

**Assumed:** the purchase-quotation supplier picker lists active supplier
accounts and labels each with its party id in a monospace face, saying that no
name exists rather than implying one was lost.

**Settle with:** a `displayName` on the commercial-account read projection, or
a `GET /commercial-accounts/party-options` mirroring `customer-options`.

## Q84 — nine corrections to trade-documents.md, verified from source

Building Phase 11 against the page surfaced nine places where the code and the
page disagree. Each one would have produced a wrong screen.

| # | The page says | The source says |
| --- | --- | --- |
| 1 | the confirmation-attempt `cancel` takes `If-Match` on the **order** | `cancelSalesOrderConfirmationAttempt` runs `assertVersion(attempt.version, expectedAttemptVersion)` — the **attempt's** version. The order's is a 409 |
| 2 | holding an order "also cancels any pending confirmation attempt" | the `hold` branch **refuses** while a pending attempt exists. Only `cancel` cancels one |
| 3 | on `PurchaseActionDto`, "`cancel` requires `reasonCode` at the service" | `reject` requires one too, also as a 409 |
| 4 | `submit` moves a purchase order to `DRAFT + PENDING` | it can also land on `NOT_REQUIRED`: when the document profile's `approvalMode` is `NONE` and the policy outcome is `ALLOW`, `submit` returns without creating an approval instance |
| 5 | a sales order's fourth axis is "fulfilment / billing / **settlement**" | there is **no `settlement_status` column** anywhere in the schema and no writer or reader in `trade-app/src`. `SettlementStatus` is an exported enum with no consumer |
| 6 | purchase orders have "two axes, not one" | three: `lifecycle_status`, `approval_status` and `dispatch_status`, the last defaulting to `NOT_REQUESTED` with no enum and no writer |
| 7 | the quotation revision's initial status "was not confirmed" | it is **`DRAFT`** — assigned by `createQuotationRevision` and required by the `send` branch |
| 8 | `TRADE.QUOTE.EXPIRED` is thrown "accepting past `validUntil`" | `send` throws it too, on the same check |
| 9 | `SNAPSHOT_INCOMPLETE` carries "no `field`, no `details`" | true of `order-print-snapshot.service.ts`. In `financial-documents.service.ts`, `invalidSnapshot(name)` **does** carry `field`, naming `termsSnapshot`, `priceSnapshot`, `taxSnapshot` or `sourceEvidence` |

Two further findings are additions rather than corrections:

- `parseTotals` refuses `subtotal < discountTotal` at the **document** level, a
  seventh identity beyond the six the page lists.
- `validateInvoiceTotals` compares with strict inequality on the raw strings,
  not `compareFixedDecimal`. The invoice family therefore requires the
  **canonical** decimal text, and `totals.amountPaid` must be exactly `"0"`
  with `amountDue` equal to `grandTotal` — Trade has no payment-settlement
  source, which `financial-documents.service.spec.ts` states outright.

**Assumed:** nothing. All eleven are implemented as the source describes, and
the page is corrected in the same task.

**Settle with:** nothing. Recorded so the next reader knows the page was
checked against the code rather than trusted.

## Q85 — an invoice line's `taxSnapshot` is conditional; its `priceSnapshot` is not

Q32 lists `taxSnapshot` and `priceSnapshot` together. On the invoice family
they are not equivalent. `assertInvoiceLineEvidence` refuses an **empty
`priceSnapshot` unconditionally**, and refuses an empty `taxSnapshot` **only
when `taxTotal` is not `"0"`**.

A zero-tax line may legally send `taxSnapshot: {}`. No line may ever send
`priceSnapshot: {}`. So a zero-tax, zero-discount invoice is blocked by one
unschematized object rather than two — which does not unblock it, but does mean
a single published schema would.

`termsSnapshot` on an invoice and a contract is *not* required to be non-empty:
`cloneSnapshot` validates depth, breadth and size and returns `{}` unchanged.
Contracts are the stricter case — `financialTerms.sourceEvidence` **must** be
non-empty, so a contract needs a schema no matter what its clauses contain.

**Assumed:** invoice and contract create and edit stay blocked. Recorded
because it narrows what settling Q32 would take.

**Settle with:** a published schema for `priceSnapshot` and for
`financialTerms.sourceEvidence`.

## Q90 — inventory periods cannot be fetched by id either

MASTER-PLAN task 12.27 asks for detail pages for "inventory nodes, periods,
receipts, deliveries, price-book versions, import runs and webhook deliveries",
and names movements (Q37) and document profiles (Q38) as the two that have no
route. **Periods are a third.**

`InventoryController` exposes `GET /inventory/periods` (limit-only) and the two
transitions, and nothing else. There is no `GET /inventory/periods/:id`
anywhere in the 231-route inventory. The same is true of
`/inventory/uom-conversions`: a list and two transitions, no read by id.

**Assumed:** the periods and UOM-conversion screens are list-only, with close /
reopen and publish / retire driven from the row. Both carry a `version`, so the
`If-Match` a transition needs is available from the list without a second read.

**Settle with:** a `GET /inventory/periods/:id`, or dropping periods from
12.27's list.

## Q91 — a policy or workflow version cannot be fetched by id

MASTER-PLAN tasks 12.13 and 12.14 describe a per-version governance ladder.
`PolicyStudioController` exposes, per family, a definition list, a definition
create, a version create, a `PATCH /…-versions/:id`, and eight action POSTs on
`/…-versions/:id`. **There is no `GET /policy-versions/:id` and no
`GET /workflow-versions/:id`.**

The only way to read a version is the `versions[]` array
`listDefinitions` embeds through `projectGovernedVersion` — id, versionNumber,
version, status, contentHash, registryVersion, effectiveFrom, effectiveTo,
submittedBy, approvedBy, approvedAt, restoredFromVersionId. **`content` and
`testCases` are not in that projection**, so the portal can run the ladder but
cannot show a version's rules or its test cases back to the person editing it.

**Assumed:** the ladder lives on the definition list screen, driven from the
embedded array, and `/trade/policy-versions/:id` and
`/trade/workflow-versions/:id` are absent from the route allowlist. A version
editor that reloads its own content is not possible.

**Settle with:** a `GET` on either version family that returns `content` and
`testCases`.

## Q92 — the import mapping DTO calls it `targetCode`, the API page calls it `mappingKind`

[trade-advanced.md](../api/trade-advanced.md#imports--11-routes) documents
`CreateImportMappingDto` as `code`, `mappingKind`, `scopeTarget`, `branchId?`,
`executionMode`, `fields[]`.

`trade-app/src/modules/extensions-automation/dto/extensions-automation.dto.ts`
declares:

```ts
@IsIn(["CATALOG_COMPANY_PROFILE", "CATALOG_BRANCH_ASSIGNMENT"])
targetCode!: string;
```

The accepted values match the page exactly; the key does not. `projectMapping`
returns `targetCode` as well, so the response and the request agree with each
other and disagree with the page. Under `forbidNonWhitelisted` a body carrying
`mappingKind` is a 400.

**Assumed:** the portal sends and reads `targetCode`. The API page's field name
is a documentation defect, not a second accepted spelling.

**Settle with:** correcting `mappingKind` to `targetCode` on the API page.

## Q93 — Trade has no capabilities endpoint, so S6 cannot be met on any Phase 12 screen

Recorded against Phase 12 as a whole rather than per screen. Standing
requirement S6 says route admission comes from `/auth/me` and **action**
admission from a capabilities endpoint. CRM has those endpoints; Trade has none
(Q30), and none of the 129 advanced routes answers "may this actor do this
here".

Every Phase 12 screen therefore judges an action from the permission string
plus `user.isTenantOwner`, which is wrong in one direction on purpose:
`TradePermissionsGuard` matches `scope_target` **exactly**, so a grant held at
the wrong target still fails server-side. The control is shown and the refusal
renders `PermissionGate` rather than being hidden pre-emptively — hiding a
control the server would have allowed is the worse failure.

Two Trade-specific holes make even that fallback partial:

* `DASHBOARD_CONTEXT` bypasses the permission guard entirely, so on the 31
  dashboard and widget routes the declared permission strings are not enforced
  at all and the portal deliberately does **not** gate on them.
* Two dashboard authorization failures arrive as **422**
  (`METRIC_PERMISSION_REQUIRED`, and `SCOPE_DENIED` on one of its two paths),
  so S7's 403-to-`PermissionGate` rule never fires for them; they are matched
  by code instead.

**Assumed:** advisory client-side gating, server authoritative, as above.

**Settle with:** a Trade capabilities endpoint, or an explicit note in the
standing requirements that S6 is CRM-only.

---

## Q100 — `repWorkload` returns `opentasks`, not `openTasks`, and nothing tests either

`crm-app/src/crm/dashboards/dashboards.service.ts`, `repWorkload`, projects
`COUNT(*)::int AS openTasks` **unquoted**. PostgreSQL folds an unquoted
identifier to lower case, so the JSON key on
`GET /api/tenant/crm/v1/dashboards/activities-productivity` is `opentasks`.
Every other camelCase alias in that file is quoted (`"ownerUserId"`,
`"currencyCode"`, `"contactPeople"`); this one is not.

No spec asserts the response key in either spelling, so the inconsistency is
invisible to the backend suite. A frontend written from the SQL's apparent
alias reads `undefined` on every row and renders an empty column.

**Assumed:** the wire key is `opentasks`, and the portal reads that. Recorded
in [../api/crm-dashboards.md](../api/crm-dashboards.md) and pinned by
`prebuilt-contract.test.ts`.

**Settle with:** quote the alias in crm-app and add a response-shape assertion.
That is a **breaking** change to the route, so it needs a version note rather
than a silent fix.

---

## Q101 — CRM dashboards send money as a JSON number; the rest of CRM sends decimal strings

Standing rule S5 and `AGENTS.md` both say money is an exact decimal string and
must never be `Number()`d. That holds for `/opportunities` and every other CRM
family. It does **not** hold here, and the divergence is server-side:

- `dashboards.service.ts` casts every aggregate `::float` —
  `COALESCE(SUM(o.amount), 0)::float AS value`, `o.amount::float AS value`.
- `dashboard-execution.service.ts` `toPoints` does `value: Number(row.value ?? 0)`,
  and the scalar path does `Number(firstData[0].value)`.

The precision loss therefore happens before serialization and the portal
cannot undo it. Phase 9 renders through `Money` / `formatDecimalString` with
the number's own exact string form, and discriminates on
`meta.unit === "MONEY"` rather than on the JS type, because the JS type is
always `number` here.

**Assumed:** the loss is accepted for aggregates, and the portal never
re-rounds. No Phase 9 screen offers an action on one of these numbers.

**Settle with:** a decision on whether dashboard aggregates should return
`numeric` as text the way the record endpoints do. If they should, it is a
breaking change across 47 route-and-metric combinations.

---

## Q102 — a CRM dashboard has no currency catalogue to build a currency filter from

`DashboardFiltersDto.currencyCode` is `@Matches(/^[A-Z]{3}$/)`, and a
multi-currency money widget is **blanked** with `CURRENCY_FILTER_REQUIRED`
until one is supplied. But no currency list is reachable from `/crm`: the
currencies catalogue is a Core screen, and `app/crm/**` may not import from
`app/core/**`.

Phase 9 builds the picker from the run's own `CURRENCIES:EGP,USD` warning,
which is server-supplied and so not invented. It is populated only by a run
that already reported more than one currency — which is the same run that
blanks the widget, so in practice both arrive together. A widget blanked for
any other reason would not populate it.

**Assumed:** the `CURRENCIES:` warning is the currency source for CRM
dashboards.

**Settle with:** either a tenant-currency list reachable from CRM, or a
`currencies` array on the run response beside `scope`.

---

## Q103 — `CartesianChart` cannot draw a qualitative multi-series chart

`docs/design/tokens.md#charts` says a qualitative breakdown uses top-N plus
"Other" on the single-hue `brand-200…brand-800` ramp, "or a stacked bar built
from `topNWithOther`". `DonutChart` accepts that shape. `CartesianChart` does
**not**: its `CartesianSeries` takes a `role` from the four outcome roles and
resolves it through `STATUS_FILL`, with no way to pass an explicit fill.

So a two-series line or column whose series are an identity rather than an
outcome — count vs value, or two owners — has no legal rendering. Giving both
`brand` draws them in one colour; giving them different roles colours an
identity, which the rule forbids.

Phase 9 charts a multi-series widget only when the outcome map yields
**distinct** roles (won vs lost) and renders every other multi-series widget as
its data table, with each series a column. That is honest, and it loses the
trend line.

`src/design-system/` is outside Phase 9's edit boundary, so no fix was
attempted here.

**Assumed:** table-instead-of-chart whenever the roles would collide.

**Settle with:** a `fills` escape hatch on `CartesianChart` fed by
`topNWithOther`, or an explicit statement that multi-series cartesian charts
are out of scope for this design system.

---

## Q104 — the widget builder cannot create a `MULTI_KPI` or a `COMBO`

> **Read [D23](DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31)
> with this entry.** Q104 as first written described a *creation* limit and read
> as cosmetic — "you cannot build this one widget type, use a template instead".
> It was not cosmetic. The same single-series assumption reached the **edit**
> path, where it silently deleted stored query specs. Anyone arriving at Q104
> looking for the size of the gap was, until 2026-08-31, given the small half of
> it. Corrected below.

Both declare `minSeries: 2` in the server catalogue. The Phase 9 widget form
builds one series, so it filters them out of the visualization picker rather
than offering a control whose every submission would be a
`422 CRM_WIDGET_SERIES_INVALID`.

**The original count here was wrong, and the wrong number pointed at the wrong
risk.** Counted from `CRM_DASHBOARD_TEMPLATES` in
`crm-app/src/crm/dashboards/dashboard-catalog.ts`: **three** of the eleven
templates ship multi-series widgets, not two — `CRM_DEFAULT`, `SALES_PIPELINE`,
and `TRENDS_COMPARISONS`, which ships two of the four. So eight templates are
single-series, not nine.

More important than the count: **none of those four widgets is a `MULTI_KPI` or
a `COMBO`.** They are `COLUMN` and `LINE_AREA`, whose `minSeries` is 1 and which
the picker therefore offers. That is the opposite of what this entry implied. A
`MULTI_KPI` at least announces the problem by having its type rewritten on save;
a two-series `COLUMN` presents an ordinary, correct-looking form and loses its
second series in silence.

**What is true after Phase 14.** The creation limit stands — this entry's
`Assumed` is unchanged. The edit path no longer narrows anything: a stored spec
the single-series form cannot represent in full is not opened in that form, and
an update that does not edit the query omits `querySpec` so the server preserves
it. See [crm-dashboards.md](../api/crm-dashboards.md#patch-widgetsid-replaces-queryspec-wholesale--it-never-merges).

**Assumed:** single-series only in the builder; the prebuilt templates remain
the way to get a multi-series widget. Editing one is now safe but still cannot
*change* its second series.

**Settle with:** a repeatable series row in the form, plus per-series `axis`
selection, which `CRM_WIDGET_AXIS_REQUIRED` makes mandatory for mixed units.
That is the same work that would let the editor open a multi-series widget for
real editing rather than read-only.

---

## Q105 — the `SEMANTIC_V1` engine is not offered by the builder

`DashboardWidgetQuerySpecDto` carries a second query engine: `engine:
'SEMANTIC_V1'` plus `semanticVersion: 1`, a `source` of `leads` or
`opportunities`, up to five `semanticFilters`, `topN` and `maxPoints`. It
accepts a **subset** of the metric catalogue (`findDashboardSemanticMetric`),
and sending any of those fields without the engine is
`422 CRM_WIDGET_ENGINE_INVALID`.

The catalogue publishes the subset as `catalog.semanticQuery.metricKeys`, so a
form could be built. Phase 9 leaves `engine` unset — the server reads that as
`LEGACY_V1` — because the legacy engine covers all 78 metrics while the
semantic one adds four more controls for a strictly smaller metric set.

**Assumed:** `LEGACY_V1` for every widget this portal creates. A stored
`SEMANTIC_V1` widget still renders and still runs; only the editor omits the
engine controls, and editing one preserves its stored spec.

> **That last clause was false when written, and is true now.** Until
> 2026-08-31 the editor rebuilt `querySpec` from scratch on every save, so
> editing a `SEMANTIC_V1` widget dropped `engine`, `source`, `semanticFilters`,
> `topN` and `maxPoints` — and, because the server derives `schema_version` from
> the spec that lands, silently demoted the row from `schemaVersion: 2` to `1`.
> Phase 14 closed it: such a widget is no longer opened in the single-series
> form at all. See
> [D23](DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31).

**Settle with:** a statement of what `SEMANTIC_V1` buys a user that
`LEGACY_V1` does not, since the catalogue does not say.

---

## Q106 — widget shares have no expiry control, and a lapsed grant is only visible from the dashboard

`ShareResourceDto.expiresAt` applies to both dashboard and widget shares. The
Phase 9 dashboard share drawer offers it; the widget share section does not.

The reason is the asymmetric consequence. A lapsed **dashboard** share removes
the dashboard from the recipient's list, which is legible. A lapsed **widget**
share leaves every placement of that widget on the recipient's dashboards
resolving to `unavailablePlacements` with `reason: WIDGET_ACCESS_REVOKED` — a
hole in a dashboard whose cause sits on a different screen owned by a
different person. Offering a timer for that without surfacing it on the
recipient's side is worse than not offering it.

**Assumed:** widget shares are granted without expiry from this portal. The
route still accepts one, and an expiry set elsewhere is displayed.

**Settle with:** either a recipient-side notice naming the owner of a revoked
widget, or a decision that widget shares should not carry expiry at all.

## Q110 — Trade items cannot be text-searched; the search route is an exact-code lookup

MASTER-PLAN 13.21 lists items as one of the five families a global search
covers. No route can do it.

`CatalogListQueryDto` (`trade-app/src/modules/catalog/dto/catalog.dto.ts`) is
`page`, `limit`, `itemKind`, `status` — there is **no** `search` field, and
under `forbidNonWhitelisted` sending one is a 400.

`POST /api/tenant/trade/v1/items/search` takes `CatalogSearchDto`, whose
`filters[]` entries are `{ field: 'canonicalCode' | 'status' | 'itemKind',
value: string }`. `CatalogRepository.list` applies each one as
`qb.andWhere('item.canonical_code = :filterN')` — an **equality** comparison,
not `ILIKE`. So the route finds an item whose code you already know, and cannot
find one by name at all. Item names live in `localizedNames`, a `jsonb` column
that no query touches.

**Assumed:** `/search` renders items as an explicitly non-searchable family,
naming the exact-code limitation and linking to `/trade/items`, where the
existing screen already uses this route for code lookups. Running the exact
lookup from a global search box would answer "0 results" for every ordinary
term, which reads as "there are none".

**Settle with:** either an `ILIKE` on `canonical_code` plus a
`localizedNames` text search in `CatalogRepository.list`, or a note on
[trade-foundation.md](../api/trade-foundation.md) that item lookup is by exact
code only.

## Q111 — no commercial-document list accepts a search term

`DocumentListQueryDto` (`trade-app/src/modules/documents/dto/documents.dto.ts`)
is `page`, `limit`, `status`, `partyId`. That one DTO serves the list route of
all six families — quotations, sales orders, purchase orders, purchase
quotations, invoices and contracts — **and** both `POST …/search` routes:
`QuotationsController.search` and the purchase-quotation equivalent bind the
same `DocumentListQueryDto` and call the same `listQuotations`. The `POST`
variants move the filters into a body; they add no term.

The only `search` anywhere in that file is on
`QuotationCustomerOptionsQueryDto`, which is a customer picker for the create
form, not a document search.

So a document reference — the number a user actually has in front of them —
cannot be searched for anywhere in the product, and `forbidNonWhitelisted`
makes a speculative `?search=` a 400 rather than a no-op.

**Assumed:** `/search` names commercial documents as non-searchable and points
at each list's own status/party filters.

**Settle with:** a `search` field on `DocumentListQueryDto` matched against the
document reference and the party display name.

## Q112 — a zero-data tenant cannot be asked whether it has any Trade data

13.23's checklist probes what it can: companies and branches come from
`/auth/me`, and lead stages, opportunity stages and pipelines have tenant-wide
list routes that take no `branchId`. The Trade step cannot be probed at all,
because both candidate routes need something a zero-data tenant does not have:

* `GET /api/tenant/trade/v1/items` resolves a `TradeRequestContext`, and
  `requireTradeContext` throws `AUTH_TARGET_DENIED` (400) when there is none.
* `GET /api/tenant/trade/v1/uoms` is `BRANCH_REQUIRED` in the Gateway route
  contract, so it needs both scope headers — which need a branch.

An item also needs a `baseUomId` (`CreateItemDto.baseUomId` is required), so
units of measure precede items and the same gap applies to both.

**Assumed:** the Trade row is listed in order with its prerequisite named and
carries no status claim. Reporting "unknown" for a reason the reader cannot act
on is worse than naming the action, and guessing "done" would hide work while
guessing "todo" would send someone to create a duplicate.

**Settle with:** a tenant-scoped count or existence route for the Trade
catalogue that answers before a company and branch exist.

## Q113 — CRM reminders accepts a search term and silently ignores it

Not a portal question — a backend one, found while enumerating which endpoints
genuinely search for 13.21.

`RemindersQueryDto extends BranchListQueryDto extends PaginationQueryDto`, so
`?search=` passes validation on `GET /api/tenant/crm/v1/reminders`.
`ActivitiesService.listScopedReminders` then calls `paginatedScopedQuery` with
`undefined` in the position every sibling fills — tasks pass
`['t.title', '%…%']`, calendar events pass `['e.title', '%…%']`, activities pass
`['a.subject', '%…%']`, reminders pass nothing.

The result is the worst of both: no 400 to say the parameter is unsupported,
and no filtering. A caller cannot tell an ignored term from a term that matched
everything.

**Assumed:** nothing in the portal sends `search` to the reminders list, and
`/search` does not offer reminders as a searchable family.

**Settle with:** either wiring the term to a real column on the reminder's
target, or `@Exclude`-ing `search` from `RemindersQueryDto` so an unsupported
parameter is rejected rather than swallowed.

## Q114 — there is no export route anywhere, for any list or any dashboard

MASTER-PLAN 13.22 asks for CSV/XLSX from every list and PDF from every
dashboard. Established against
[../generated/tenant-api-routes.json](../generated/tenant-api-routes.json)
rather than assumed: of 569 Gateway routes, exactly one matches
export/csv/xlsx/download — `GET /api/tenant/crm/v1/attachments/:id/download`,
which streams a stored attachment. Every other CSV/XLSX mention in `core-app`,
`crm-app` and `trade-app` is **ingest**: the attachment upload allow-list, the
CRM static-data catalogue, and `trade-app`'s import source reader.

There are twelve PDF routes and all twelve render a Trade **document**. No
route renders a dashboard, in any of the three services.

**Assumed:** export is assembled in the browser from rows the server returns,
bounded and labelled with what it actually contains
(`src/lib/export/`). Dashboard PDF is not built, because building it would mean
inventing an endpoint.

**Settle with:** a server-side export route per list family that streams the
full result set for a filter set, and a dashboard render route. Both would also
remove the row cap the client-side walk needs.

---

## Q120 — a bare `FOR SHARE` with a `LEFT JOIN` is rejected by PostgreSQL · **backend defect**

Opened by Phase 14 from the external CRM audit's **P1-06**. The audit's claim
was re-checked against source here before being recorded; it holds, and the blast
radius is narrower and more specific than "a broken lock".

`crm-app/src/crm/outbound-emails/repo/outbound-emails.repository.ts:96` builds
`const suffix = lock ? ' FOR SHARE' : ''` and appends it to a query that carries
three `LEFT JOIN`s — `crm_lead_stages`, `crm_acquisition_sources`,
`tenant_users`. PostgreSQL refuses that outright:

```
ERROR: FOR SHARE cannot be applied to the nullable side of an outer join
```

This is a **parse/plan-time rejection, not a runtime race**. It fails 100% of
the time it is reached, and it fails identically on an idle database.

**The correct form is used 118 lines further down the same file**, at line 214:
`FOR SHARE OF method, party`. So the codebase already knows the fix; one call
site did not get it.

**What the portal is exposed to.** `lock = true` reaches `resolveSource` from
exactly two places, and both are commit paths that the portal calls:

| Caller | Route the portal calls |
| --- | --- |
| `outbound-emails.service.ts:251` | `POST /outbound-emails` — the send itself, inside the idempotency-guarded commit |
| `outbound-emails.service.ts:452` | `POST /outbound-emails/:id/retry` |

Every read path — `options`, `detail`, the prepare step at line 598 — passes
`lock = false` and works. So the composer opens, the recipient picker populates,
validation passes, and the failure lands **only on send**, as a 500 with no
domain code. `/crm/outbound-emails` is built and calls both routes.

**Not reproduced by me.** [CRM-AUDIT-REVIEW.md](CRM-AUDIT-REVIEW.md) records a
reproduction of the query shape on PostgreSQL 16.15 in a rolled-back
transaction. What this entry adds is the source trace, the two affected call
sites, and the in-file counter-example — all independently read.

**Assumed:** nothing. No portal workaround exists or should exist; a send that
500s renders the error boundary, which is correct.

**Settle with:** `FOR SHARE OF lead` (and `OF profile`, `OF opportunity`) in
`resolveSource`, matching line 214. crm-app is another team's repository, so
this is an ask, not a task.

---

## Q121 — 78 of 98 CRM permission labels return English for both languages · **backend defect**

Opened by Phase 14 from the external CRM audit's **P2-19 / R4**. Re-counted here
rather than accepted; the audit's number is exact.

`crm-app/src/crm/static-data/static-data.service.ts:134` — `permissionLabel`
looks up `crm.label.permission.<permission>` in both dictionaries and, when
either is missing, composes a fallback:

```ts
return {
  en: `${this.capitalize(action)} ${resourceLabel} (${scope})`,
  ar: `${this.capitalize(action)} ${resourceLabel} (${scope})`,
};
```

**The two branches are the same expression.** `ar` is not a translation that
happens to be missing — it is the English string, returned under an Arabic key.

Counted from `crm-app/packages/common/src/constants/permissions.ts` against both
locale files:

| | Count |
| --- | ---: |
| CRM permissions total | 98 — 20 static, plus 26 scoped bases × 3 scopes |
| With a real `ar` translation | 20 |
| **Falling through to the identical-string fallback** | **78** |

The split is clean: **every one of the 78 is a scoped permission**
(`.own`/`.team`/`.all`). The 20 unscoped ones are all translated. So the
dictionary was written before scopes were expanded and never revisited.

**Where the portal renders them.** `GET /crm/static-data` →
`useCrmStaticCatalogue.ts:129`, which formats `${item.label[lang]} (${item.value})`
for the `/crm/static-data-catalogue` screen. In Arabic, 78 of those rows read as
English text in an Arabic UI, presented with the same authority as the 20 real
translations.

**What Phase 14 does about it (task 14.10) — and what it does not.** The portal
cannot translate 78 backend strings; inventing Arabic for a permission
vocabulary this portal does not own would be exactly the "never invent" rule
broken. What it can do is stop **asserting** a translation it does not have:
detect `label.ar === label.en`, and render the row through the portal's own
labelled composition instead, so an Arabic reader is told the label is
untranslated rather than shown English dressed as Arabic.

That is a display guard. It is named as one, and it does not close this entry.

**Settle with:** 78 `crm.label.permission.*.own|team|all` entries in
`crm-app/src/common/i18n/locales/ar.ts`, plus a test that asserts
`permissionLabel(p).ar !== permissionLabel(p).en` for every `p` in
`CRM_PERMISSIONS` — which is the check that would have caught this when the
scopes were added.

## Q130 — realtime carries no entity change event, so "reconcile every open list" has only a whole-session signal

Found 2026-08-31 building MASTER-PLAN 13.6.

13.6 asks that `realtime.sync.required.v1` reconcile every open list. Building
it surfaced the shape of the protocol rather than a bug in it: the V1 server
event set is `session.ready`, `presence.*`, `notification.*`,
`realtime.sync.required`, `system.*` and `realtime.error`. **There is no event
for an entity changing.** A lead moves stage, an opportunity is reassigned, an
invoice is finalised — and nothing is sent to say so.

The only signals a list can act on are therefore whole-session ones:

| Signal | Granularity |
| --- | --- |
| `realtime.sync.required.v1`, scope `ALL` | every list, all at once |
| a second or later `session.ready.v1` | every list, all at once |
| the browser's `online` | every list, all at once |

`RealtimeSyncScopeV1` is `NOTIFICATIONS | PRESENCE | ALL`, so even the sync
event cannot say *which* resource moved. The consequence is not subtle: a
tenant with several open lists refetches all of them on any `ALL`, and a
tenant whose colleague edits one record sees nothing until something unrelated
triggers a whole-session resync.

**Assumed:** `useRealtimeResync` acts on exactly those three signals, ignores
`NOTIFICATIONS` and `PRESENCE` (whose runtimes repair themselves), holds a
signal raised while the tab is hidden, and never fires on mount. A list opts in
with one line. No per-entity invalidation is invented, and no polling is added
to simulate one — a portal that quietly re-reads on a timer would be the same
"simulated liveness" the standing rules forbid.

**Settle with:** either a scoped resync — widening `RealtimeSyncScopeV1` so the
server can name the module or resource that moved — or an explicit decision that
tenant lists are read-through-on-navigation and whole-session resync is the
intended granularity, in which case 13.6's "every open list" wording is
satisfied as built and should say so.
