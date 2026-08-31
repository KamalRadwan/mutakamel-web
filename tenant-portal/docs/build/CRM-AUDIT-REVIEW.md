# Review of the CRM documentation-vs-implementation audit

Reviewed: **2026-08-31** · Subject: the CRM audit dated 31 August 2026
· Reviewer scope: this portal's plan, plus independent verification of the
audit's claims against backend and portal source.

## 1. Verdict on the report

**It is sound, and its evidence discipline is better than most.** It separates
*proven by source trace* from *reproduced in PostgreSQL* from *not proven*, it
refuses to call a `CREATE TABLE` a feature, and it states plainly that no live
tenant was exercised. Those are the right distinctions and it holds them
consistently.

I did not take it on trust. Four claims were re-verified independently, chosen
because they were the most consequential and the most falsifiable:

| Claim | My verification | Result |
| --- | --- | --- |
| **P1-06** — bare `FOR SHARE` with `LEFT JOIN` is rejected | Re-ran the query shape on **this project's own PostgreSQL 16.15** in a rolled-back transaction | **Confirmed.** `ERROR: FOR SHARE cannot be applied to the nullable side of an outer join`. `FOR SHARE OF lead` returns the row |
| **P1-05 / R3** — editing a widget can destroy its query spec | Read `buildQuerySpec`, `widgetToForm`, and the backend UPDATE | **Confirmed, and worse than stated** — see below |
| **P2-18 / R5** — histogram count renders as currency | Read `widget-view.ts` `numeric()` and its `BINNED_DISTRIBUTION` call site | **Confirmed.** `numeric()` formats as money whenever the metric's unit is MONEY, and it is called on `bin.count`, a record count |
| **P2-19 / R4** — 78 Arabic permission labels are English | Read the `permissionLabel` fallback | **Confirmed.** The fallback returns the *identical string* for `en` and `ar` |

Four for four, each at the line cited. That is a high enough hit rate that I
accept the claims I did not re-verify as likely-true, while still treating them
as claims rather than facts.

### Where it is more right than it says

**P1-05 is live, not latent, and it is a contract defect before it is a UI
defect.**

The report frames it as a frontend form rebuilding a partial spec. Two things
sharpen it:

1. `widget-detail-workspace.tsx:201` calls `widgetToForm(widget)` with **no
   guard on series count**, so the editor opens for a `MULTI_KPI` or `COMBO`
   widget. The visualization picker deliberately excludes those types, so
   pressing save changes **both** the visualization type and collapses the spec.
   Two of the eleven built-in templates ship multi-series widgets.
2. The backend UPDATE sets `query_spec = $6::jsonb` unconditionally while
   `name` and `display_spec` are guarded by `CASE WHEN … THEN … ELSE … END`.
   **The API already has a "leave this field alone" mechanism and does not use
   it for the one field a client cannot safely reconstruct.**

So fixing only the portal leaves every other client able to do the same damage.
Recorded as [D23](DEFECTS.md).

### Where it is stale rather than wrong

The report reads the working tree, and this portal's working tree moved under
it during the audit window. Three items have since changed:

- **Pagination `meta` vs flat.** Listed as an open conflict. It is now closed,
  in the direction the report recommends. `useOpportunitiesList` required
  `payload.meta` and threw `"Invalid opportunities response."` on every real
  response — its own test fed the same wrong shape back, so it passed. Both the
  parser and `docs/api/README.md`'s example are corrected, with a regression
  guard that rejects the Core shape.
- **"26 CRM routes with route-level documentation only."** Phase 9 added
  `docs/api/crm-dashboards.md`; the number has moved and needs recounting.
- Several frontend observations predate Phases 8A, 8B and 9.

None of these is an error in the report. They are the cost of auditing a
moving tree, which the report itself flags.

### Where I would put it differently

**The "NOT READY" verdict is right, and it is right for a second reason the
report could not see.** Its evidence is backend-side: authorization gaps, a
concurrency defect, a broken SQL lock. The portal has an independent gap of the
same weight:

> **131 screens; 2 of them are ever rendered in a test.** 1,333 tests across
> 153 files, of which 47 are contract/parser suites and **two** render anything.
> No authenticated session has ever existed against this stack (P4 — the only
> tenant user is `INVITED` and both invite tokens expired). Every phase's gate
> line claims "the eleven-state checklist passed for every screen"; every
> phase's own report then caveats it as "satisfied by construction and by unit
> test rather than by observation."

So "not ready" holds on both sides of the wire, for different reasons, and
neither is fixed by the other.

---

## 2. The decisions

The report ends with ten open questions. Leaving them open is what produces
re-litigation — this project has already answered the same "id with no display
name" question three times under three different numbers (Q14, Q70, Q83). Each
gets a recommendation here, with the reasoning, so the next builder inherits an
answer rather than a question.

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | Individual → Corporate lead conversion | **Do not convert the Party. Create a new organization Party and a relationship, and keep lineage on both.** Correct the doc that promises type change | Core Party type immutability is an identity invariant. A workflow promise does not outrank it, and mutating it would corrupt every projection that already resolved that Party |
| 2 | Is `BLACKLISTED` sticky? | **Sticky until an explicit re-activation with audit.** A WON opportunity must not silently clear it | Blacklist is a compliance/consent state, not a sales outcome. Letting a deal clear it means the system forgets a decision a human made deliberately |
| 3 | Single authority for default lead stage | **`stage.isDefault` is the authority. Delete `defaultLeadStageId` from Settings** (or make it a read-through). Protect a `CONVERTED` stage the way `NEW` is protected | One of the two is already dead — the reader consults `isDefault` only. Keeping a stored field nobody reads is how a config screen lies to its user |
| 4 | `fieldKey` uniqueness: per ownerType or tenant-global | **Keep the implemented scoped uniqueness (`ownerType` + key)** and correct the doc | Global uniqueness is a migration with a collision survey attached, bought for no user-visible gain. Scoped is also the more useful model: `priority` on a Lead and on an Opportunity are different fields |
| 5 | Reminder recipient and lifecycle | **Owner of the source record at fire time, re-resolved at delivery, auto-cancelled on DONE/CANCELLED, and a failure is a durable recorded fact** | Resolving the recipient at creation time is what makes reassignment silently misdeliver. "Re-check at fire" is the same rule as the email module's final-scope recheck — one rule, two places |
| 6 | Dashboard editor scope now | **Metadata-only editing that provably preserves the spec, first.** Multi-series and semantic authoring is a separate, later scope | This is D23. The unsafe editor is worse than a limited one: a user who can only rename is inconvenienced, a user whose rename deletes their filters has lost work they cannot recover |
| 7 | Close legacy attachment upload? | **Keep legacy open during the transition, behind one documented MIME + scan policy**, and close it only when V2 can accept every file legacy accepts | Closing uploads before the replacement lands removes a working capability to make a roadmap look tidy. The risk to manage is the *policy split*, not the endpoint's existence |
| 8 | Release policy: fresh-only or populated tenants | **Declare fresh-only today, in writing.** Populated-tenant upgrade is its own gated workstream | The audit proved fresh install works and proved nothing about upgrade. Saying "fresh-only" costs nothing and stops a green test being read as an upgrade guarantee |
| 9 | Retention: per-row isolation or per-tenant batch | **Per-tenant atomic batch with a poison-row quarantine** | A retention job that dies on one bad row and leaves the rest unredacted is the worst outcome. Atomic batch plus quarantine keeps the guarantee and still makes progress |
| 10 | One source-read policy for legacy aggregates and builder | **Yes — the builder's stricter policy wins, applied to legacy.** Never by deleting the builder's checks | This is P1-02 and P1-03. The builder already demonstrates the correct restriction on both sources; the fix is to raise legacy to it |

**Two decisions the report did not ask for, which this portal needs:**

- **The eleven-state claim is retired until it can be executed.** No API page is
  marked `verified`, and no phase may claim the checklist passed on the strength
  of construction. `built` is the honest ceiling. Already applied across
  `docs/api/`.
- **`query_spec` becomes a conditional update on the API before the portal
  guards it.** Landing the portal guard first would make the two disagree about
  what a partial update means.

---

## 3. What changes in the plan

The plan is **362 of 379 resolved**. The explicit reason for this review was to
avoid causing a code rewrite, so nothing resolved is reopened on the strength of
an audit of a different service.

What the findings actually touch, portal-side:

| Finding | Portal impact | Where it lands |
| --- | --- | --- |
| P1-05 / R3 widget spec loss | **Confirmed defect in shipped code** | D23 · Phase 14 |
| P2-18 / R5 histogram unit | Confirmed display defect | Phase 14 |
| P2-19 / R4 Arabic labels | Portal renders them; backend owns the fix | Phase 14, as a display guard + a backend ask |
| P2-17 / R6 no activity composer | Already recorded — Phase 8B marked 8.20 `[/]` for exactly this | No change |
| Pagination `meta` vs flat | **Already fixed**, in the recommended direction | No change |
| 26 route-level-only CRM docs | Recount and close | Phase 14 |
| Everything else (P1-01…04, 06…10, G-01…03) | **Backend, not this repo** | Recorded as external dependencies, not portal tasks |

The portal cannot fix a backend authorization gap, and pretending otherwise in
this plan would be the same category error the audit warns about — treating a
document as evidence of a system.

Phase 14 is therefore small, ordered **docs before code**, and every item is
either something this repo owns or an explicitly-labelled external dependency.

---

## 4. What Phase 14 changed — re-run 2026-08-31

Task 14.14. Each of the audit's portal-side checks was re-run after the code
landed, so the next audit starts from a measured point rather than re-deriving
one. **Two of the findings above were wrong in this document and are corrected
here**, which is the more useful half of this section.

| Audit finding | Then | Now |
| --- | --- | --- |
| **P1-05 / R3** widget spec loss | Live in shipped code, both sides of the wire | **Closed portal-side.** Two independent guards: the editor is withheld for a spec the form cannot represent, and a rename omits `querySpec` so the server preserves it. 6 tests that fail without them |
| **P2-18 / R5** histogram unit | `bin.count` rendered as currency on any MONEY metric | **Fixed.** Bin counts format as numbers; `WATERFALL` and `HIERARCHY` values still format as money, pinned by test |
| **P2-19 / R4** Arabic labels | 78 render as English, unmarked | **Guarded, not fixed.** The catalogue no longer presents an untranslated string as a translation. The 78 labels remain the backend's — [Q121](OPEN-QUESTIONS.md#q121--78-of-98-crm-permission-labels-return-english-for-both-languages--backend-defect) |
| **P1-06** `FOR SHARE` | Reproduced on PostgreSQL 16.15 | **Source-traced and recorded** — [Q120](OPEN-QUESTIONS.md#q120--a-bare-for-share-with-a-left-join-is-rejected-by-postgresql--backend-defect). Two call sites, both portal-reachable: `POST /outbound-emails` and its retry |
| Pagination `meta` vs flat | Fixed on opportunities; unverified elsewhere | **Re-verified across all 10 CRM paginated parsers.** None requires `meta`. Explicit reject-`meta` guards exist on 2 of the 10 |
| 26 route-level-only CRM routes | Assumed to have dropped since `crm-dashboards.md` | **Still exactly 26**, and the reason is the correction below |

### Two corrections to this document

**1. The backend half of P1-05 does not hold.** Section 1 says the API "already
has a 'leave this field alone' mechanism and does not use it for the one field a
client cannot safely reconstruct". Re-reading `dashboard-widgets.service.ts`
before acting on it — the rule this review itself sets out — showed line 102 is
`dto.querySpec ?? current.querySpec`. The SQL parameter is already coalesced, so
omitting `querySpec` preserves the stored spec. `name` and `display_spec` are
guarded in SQL; `query_spec` and `visualization_type` are guarded in TypeScript;
the net contract is the same for all four.

Two things follow. **There is no backend defect in P1-05**, so none is claimed —
the loss was entirely the portal's choice to send a rebuilt spec when it could
have sent nothing. And the ordering constraint this document imposed — "the API
becomes conditional *before* the portal guards it" — **had nothing to wait
for**. 14.3 still landed before 14.7, because writing the contract down first is
what made the omission obviously correct rather than merely convenient.

**2. The exposure is broader than "`MULTI_KPI` or `COMBO`", and worse.** Counted
from `CRM_DASHBOARD_TEMPLATES`: **three** of the eleven templates ship
multi-series widgets, not two — four widgets in total — and **none of them is a
`MULTI_KPI` or a `COMBO`**. They are `COLUMN` and `LINE_AREA`, whose `minSeries`
is 1, so the picker offers them. A `MULTI_KPI` at least announced itself by
having its visualization type rewritten on save; a two-series `COLUMN` presented
an ordinary form and lost its second series in silence. A further **7 of the 80
template widgets carry `filters`**, lost on a rename even with one series.

### What the re-run did not prove

The verdict of section 1 stands unchanged: **NOT READY**, on both sides of the
wire. Nothing here was exercised against a live authenticated session — CRM is
still blocked twice over, by P4 and by
[Q17](OPEN-QUESTIONS.md#q17--crm-apps-permission-grants-were-only-partly-applied--backend-defect-blocks-all-crm-screens).
The evidence for every claim in the table above is source reading plus unit and
render tests, which is what this project means by `built`.

One thing did improve on the portal's own gap. Section 1 recorded **131 screens,
2 of them ever rendered in a test**. Task 14.13 added the first render suite for
a CRM analytics screen: ten cases covering loading, 403, not-found, two distinct
read-only paths, and the D23 guard. It immediately found a defect nothing else
had — the widget detail screen answered a **server 403 with a blank page**,
because it re-derived the state from a client-side permission check that had
already passed at the route. That is the argument for 14.13 in one example: a
contract test proves a parser, and only a render proves a screen.

---

## 4. Addendum — the packaging defect is wider than the audit found

The audit's **B-01** reports that `crm-app`'s production Docker build calls a
script outside its build context. Verified, and **it is not only `crm-app`**:

| App | `build` script | Script inside the build context? |
| --- | --- | --- |
| `crm-app` | `node ../../scripts/qual-05-swagger-build.mjs crm` | **No** |
| `trade-app` | `node ../../scripts/qual-05-swagger-build.mjs trade` | **No** |
| `core-app` | `nest build` | n/a |
| `api-gateway-app` | `nest build` | n/a |
| `worker-app` | local `tsc -p tsconfig.build.json` | n/a |
| `realtime-app` | local `scripts/build-runtime.cjs` | Yes |

The script lives at `backend/scripts/qual-05-swagger-build.mjs`. Each service's
compose build context is its own directory (`./crm-app`, `./trade-app`), and the
Dockerfile's `WORKDIR` is `/workspace/<app>` — so `../../scripts/…` resolves to
`/scripts/…` inside the image, which does not exist. The `builder` stage's
`RUN pnpm run build` therefore cannot succeed for **two** services, not one.

Local builds work because run from the app directory `../../scripts/` resolves
correctly on the host, and the running containers use `target: dev`, which
never enters the `builder` stage. That is exactly why this survives: **the
thing that is broken is the only thing nobody runs.**

### What I did not do, and why

**I did not prove it by building.** The `deps` stage needs a private registry
token, and handling that credential is not something I will do. My one attempt
failed on my own error — I passed an `.npmrc` file where a bare token was
expected — and that failure says nothing about B-01. The evidence here is
structural: script location, build context, `WORKDIR`, and the resolved path.

**I did not restructure the build.** Three fixes are viable — widen the build
context, vendor the script per app, or move it into a workspace package that is
already a dependency — and choosing between them changes how every service is
packaged. Doing that blind, on a build I cannot execute, in a repository owned
by another team, would be the kind of speculative change this review exists to
argue against. It is reported with the evidence and the options instead.

### What was verified about the containers

All six services rebuilt from current source (`docker compose build`, exit 0)
and recreated. Typecheck is **0 errors in all six** — `core-app`, `crm-app`,
`trade-app`, `worker-app`, `realtime-app`, `api-gateway-app`. The 502 burst seen
during this work was `core-app` restarting, and the gateway's own logging named
the cause in one line — `connect ECONNREFUSED 172.18.0.5:8001`, then
`getaddrinfo ENOTFOUND mutakamel-core-app` — which is the observability fix from
earlier today earning its place a second time.
