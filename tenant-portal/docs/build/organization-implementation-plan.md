# Organization implementation plan — 2026-11-01

Owner and acceptance: Codex lead. Implementation: five concurrent Antigravity sessions via `agy --model gemini-4-argon-high`.

Execution amendment, 2026-11-01: following the user's latest instruction, Gemini is design-only from this point. Codex performs all remaining inspection and source fixes. Rebuild the collected implementation first, collect live and static defects in one batch, fix that batch, then rebuild and recheck. The initial five concurrent AGY sessions and their work remain recorded in the execution ledger. Tenant rebuilds are serialized with the Settings chat through its shared exclusive-lock wrapper; do not rebuild while the other chat has a fixed QA window.

QA scope amendment: Codex may make the narrow `SubNav` presentation/controller repair confirmed by authenticated testing: select only the longest matching visible destination and contain mobile scrolling. Existing permission predicates are preserved. This touches `src/design-system/shell/SubNav.tsx`, new `useSubNav.ts` and a regression test, without changing the global navigation map or auth transport.

## Scope and immutable requirements

Implement the approved `C:/mutakamel.ai/designs/organization-tenant-study-v1/` design suite against the existing backend. References: `index.html`, `STUDY.html`, `api-inventory.json`, `dto-inventory.json`, `error-inventory.json`, the individual PNGs and the editable rendering sources. These files contain illustrative data: no example rows, counters, identifiers, successful writes or API results may be copied into the application.

- Seven primary pages: organization, companies, branches, departments, teams, users, roles. Keep existing detail deep links.
- Full-width main pages. No Aside, drawer, split inspector or side navigation within these workspaces. Use the existing `FormModal` at `size="wide"` or `size="card"`, with no `sections`, `asideSlot`, `sidebarHeader` or `headerAside`. Use ordinary centered Dialog for read-only previews. Do not alter global shell behavior.
- All create/edit/view/delete states, field validation, meaningful server failures, permission denials, loading, empty, and recoverable errors. Preserve dirty drafts on failure and guard accidental discard.
- Department creation: company → branch → department name/code. Team creation: company → branch → department → team name/code/optional lead. Company and branch context are filters only when not fields in the owning DTO.
- Automatically select the sole eligible option only after an unsearched, completed response proves there is one. Never infer uniqueness from a searched result, a partial first page, a failed read or missing permissions. Changing a parent clears every descendant, and stale requests cannot restore old selections.
- Arabic RTL and English LTR, light and dark; Western digits in Arabic and LTR identifiers. Use the existing design-system barrel and dictionary keys. Accessible labels, focus restoration/trapping, inline validation and keyboard operation.
- All calls use the canonical Gateway, existing transport, runtime parsers, UUIDv7 conventions and actual permissions. Preserve company/branch scoping and owner/self protections. No new backend routes or invented wire fields.
- `CreateDepartmentDto` receives `branchId`, not `companyId`; `CreateTeamDto` receives `departmentId`, not company/branch UI context. Codes/organization parents stay immutable on edit. User team/manager clears send `null` explicitly.
- Base application seats and purchased Addon assignments remain distinct. The additive COMPANY/TENANT/BRANCH permission model has no narrower Deny override. Do not promise absolute company non-discovery for tenant-wide catalogues.

## Coordination and preservation

Work directly on `main`, as required by AGENTS.md. Do not create branches/worktrees, commit, reset, clean, stash or overwrite existing changes. The workspace has substantial unrelated edits; preserve them. No backend writes, package/lockfile changes, app launches or port changes. Do not modify auth/transport/global shell/design-system primitives.

Each lane owns only its listed files. Other lanes may read them. Request a change from the owning lane through a checkpoint note instead of editing outside ownership. Shared source interface names below are fixed before parallel work. The lead alone edits this plan/ledger, runs final repository gates, rebuilds the production portal and accepts work. Subtasks are parts of one implementation run, so they must not independently rebuild or alter the running container.

Execution records, briefs and verification evidence live under `C:/mutakamel.ai/designs/organization-tenant-study-v1/implementation/`.

## Executor permission profile

The AGY headless probe could read files but its RunCommand permission was automatically denied. Do not broaden or bypass those permissions. Executors must use their allowed file reading/editing tools only and must not invoke terminal/RunCommand. The lead already ran `git branch --show-current` in the frontend repository and recorded `main` in `implementation/baseline.json` for this coordinated run; read that evidence rather than repeating the denied command. The lead runs all test/verification commands. Executors write meaningful tests, list the exact suggested test commands, and mark them not run by executor. A tool denial is reported as a blocker, never evaded with alternate command syntax or helper scripts. No permission settings are changed.

## Phase 0 — baseline and dispatch

| ID | Small task | Acceptance |
|---|---|---|
| P0.1 | Record branch, scoped Git status and SHA-256/source copies before edits | main confirmed; existing changes preserved |
| P0.2 | Save initial typecheck and focused identity tests | Existing failures distinguished from regressions |
| P0.3 | Launch lanes A–E as five separate Argon CLI sessions | PID/start records plus observed progress, not just queued prompts |

## Phase 1 — five parallel implementation lanes

### A — cascading selections and shared picker metadata

Own: `src/app/(tenant)/core/hooks/useCoreOptions.ts`, its tests; new `useOrganizationCascade.ts`, its tests and narrow supporting files in that hooks folder prefixed `organization-cascade`. Do not edit `useCoreErrorText.ts`.

| ID | Task | Lead verification |
|---|---|---|
| A.1 | Preserve total/hasNext/unsearched readiness in org picker results | Multiple pages and searched singleton do not auto-select |
| A.2 | Implement shared controlled cascade hook | Single legitimate option selected, several left unselected |
| A.3 | Reset descendants on upstream change and fence stale responses | Company/branch/department race tests |
| A.4 | Gate dependent loading and expose empty/error/retry | No child fetch without parent; 403 not treated as empty |

Fixed integration API: `useOrganizationCascade({ enabled, companyId, branchId, departmentId, teamId?, onChange })`. `onChange` accepts a partial object of those same IDs. Return `companies`, `branches`, `departments`, `teams` as `RemoteOptions`, plus `selectCompany`, `selectBranch`, `selectDepartment`, `selectTeam`. `RemoteOptions` additions are optional to preserve consumers: `total?: number`, `hasNext?: boolean`, `isUnsearchedReady?: boolean`. Add `includeTeams?: boolean` default false and `includeDepartments?: boolean` default true if needed; document final API in A checkpoints. Effects must not call synchronous state setters in violation of project lint. Keep pagination metadata accurate; don't fetch an unbounded catalogue to prove uniqueness.

### B — organization tree and the four organization levels

Own: `src/app/(tenant)/core/organization/**`; also migrate organization-form imports, the shared test mock, and the Organization/Roles cases in existing `src/app/(tenant)/core/permission-scopes.test.tsx` when required by this redesign. Preserve its Settings assertions and use targeted edits rather than replacing that file. Do not edit shared hooks, contracts, dictionaries or design-system files.

| ID | Task | Lead verification |
|---|---|---|
| B.1 | Full-width organization tree and bounded-tree fallback | Tree navigation, permission/error/empty states |
| B.2 | Consistent four-level tables using shared level configuration | Server total/search/sort/page retained; no invented aggregates |
| B.3 | Replace organization FormDrawer with centered FormModal | No aside; dirty guard; valid disabled/submitting behavior |
| B.4 | Company/branch create/edit fields and headquarters behavior | Exact DTO keys; code/parent immutable; currency clear rules |
| B.5 | Department/team cascade forms consuming lane A hook | Required company/branch/department sequence; exact request body |
| B.6 | Quick detail Dialog and retained independent detail routes | Authorized name resolution or explicit unavailable fallback |
| B.7 | Delete confirmation and blocker/HQ-transfer outcomes | No success on rejection; preserve backend error semantics |
| B.8 | Add focused organization regression tests | CRUD integration, null clearing, parent reset, forbidden paths |

### C — users, memberships, access and lifecycle

Own: `src/app/(tenant)/core/users/**`, including its existing detail `components/user-subresources.test.tsx`. Files ending `.lead.test.ts` are independent lead verification tests: preserve their assertions and fix production behavior instead. Do not edit core contracts, shared hooks, dictionaries or global components.

| ID | Task | Lead verification |
|---|---|---|
| C.1 | Full-width users table and lifecycle filters | All four status values; scoped names and permission gates |
| C.2 | Invite and edit centered modals consuming A | Required placement, email immutability, parent reset and explicit null clear |
| C.3 | Full-width details with readable work/access sections | No split; protected owner/self remain protected |
| C.4 | Branch role assignment and owner-only exact-scope modals | Authorized option pairs; no raw-ID labels; full-replacement diff |
| C.5 | Team memberships and base module centered dialogs | Single primary membership, seat failures, no self module write |
| C.6 | Suspend/activate/delete and session revoke confirmations | Permission/owner/self gates; returned lifecycle authoritative |
| C.7 | Resend invitation using E contract | INVITED only, QUEUED means queued; no fake delivery success |
| C.8 | Focused regression tests for user tasks | Placement payload, lifecycle safety, access diffs and failure preservation |

Fixed lane E contract names: `resendTenantUserInvite(id): Promise<{ deliveryStatus: "QUEUED" }>` and `revokeTenantUserSessions(id): Promise<TenantUser>` in `../contracts/user-contract.ts`. Verify permissions and retry/idempotency behavior from actual existing transport conventions. No raw fetch.

### D — roles and permission editing

Own: `src/app/(tenant)/core/roles/**`. Do not edit contracts, dictionaries, shared hooks or user access components.

| ID | Task | Lead verification |
|---|---|---|
| D.1 | Full-width role list with system/custom distinction | No unsupported role holder counts; server filter/sort retained |
| D.2 | Create/rename/description centered dialogs | Correct DTO, uniqueness/max lengths, dirty preservation |
| D.3 | Full-width grouped permission editor | Server-localized catalogue labels; 200 cap; loaded catalogue before save |
| D.4 | Grant authority/system role read-only states | No wider write from company/branch grants; unknown IDs fail closed |
| D.5 | Save diff confirmation and role deletion/blockers | Full replacement clear; immediate-holder effect; no deletion for system/in-use |
| D.6 | Focused role regression tests | User-visible action gating and actual contract behavior |

### E — current contracts, copy and documentation integration

Own: `src/app/(tenant)/core/contracts/user-contract.ts` and its focused tests; `src/app/(tenant)/core/hooks/useCoreErrorText.ts` and its focused tests; only the `coreIdentity` portions of `src/i18n/dictionaries/ar.ts` and `en.ts`; `docs/api/core-identity.md`; new identity-specific source tests. Do not overwrite entire dictionaries or edit unrelated keys. Do not modify generated reference files by hand.

| ID | Task | Lead verification |
|---|---|---|
| E.1 | Source-verified resend/revoke transport functions and parsers | Correct Gateway paths, response validation and replay behavior |
| E.2 | Add minimal shared dictionary copy needed by lanes | Equal AR/EN key shape; no language ternaries or developer jargon |
| E.3 | Correct stale lifecycle/placement/error descriptions | Resend exists; placement is not the complete authorization model |
| E.4 | Current error handling and actionable messages | Permission, quota, conflict, validation, offline and correlation ID behavior |
| E.5 | Update identity API documentation from current source | Distinguish runtime/source evidence and Swagger status mismatch |
| E.6 | Add focused tests for runtime and copy changes | Malformed response rejected; unknown failures safe; existing MFA mapping retained |

Shared copy keys to publish under `coreIdentity` (keep existing keys too): `cascade.{company,branch,department,team,autoSelected,singleOption,noOptions,chooseCompanyFirst,chooseBranchFirst,chooseDepartmentFirst,loadFailed,retry}`, `actions.{view,edit,close,delete,refresh}`, `users.{resendInvite,resendInviteTitle,resendInviteDescription,inviteQueued,inviteQueuedDescription,revokeSessions,revokeSessionsTitle,revokeSessionsDescription}`. E may add needed confirm labels in the existing confirm object. Other lanes should first reuse existing keys; communicate any additional necessary keys through their checkpoint.

## Phase 2 — independent lead verification and rework

For every A–E task the executor writes `implementation/checkpoints/<ID>.json` with `status: "ready_for_verification"`, exact changed files, completed acceptance behavior, own test commands/results, contract references, and blockers. No executor may mark a task `verified` or edit the lead's ledger. Write checkpoints atomically if possible. Continue independent work in the same lane after reporting a checkpoint.

The lead independently reads the actual diff, checks ownership against the baseline, executes relevant tests, records exact results and returns failed work to its originating Argon session. A declaration of success, compilation alone, a screenshot alone, or the executor's assertion alone does not satisfy acceptance. Final verification must re-check any earlier acceptance affected by subsequent edits.

## Phase 3 — integration, production build and visual acceptance

| ID | Task | Acceptance |
|---|---|---|
| V.1 | Reconcile interfaces and scoped regression tests | All A–E acceptance cases independently checked |
| V.2 | Run ordered tenant gates from package scripts | Typecheck, lint, RTL/identifier/key guards, census, contrast, tests, docs, build/budget, unused code |
| V.3 | Rebuild once using frontend production runbook | `node scripts/rebuild-portal.mjs tenant` final ready/HTTP line retained |
| V.4 | Inspect authenticated existing portal on 5002 | Seven primary pages and CRUD dialogs; Arabic/English × light/dark |
| V.5 | Exercise safe UI validation/permission/error cases | Keyboard/focus, no aside/split, cascade singleton/reset, no invalid payloads |
| V.6 | Final evidence and task ledger | No task marked verified without evidence; exact pending constraints reported |

Read-only live checks and opening/closing unsaved dialogs are authorized. Do not create, delete, suspend users, grant privileges or modify tenant business data simply to obtain screenshots. Use controlled unit/integration mocks for write behavior and clearly distinguish those from live server verification. If a live destructive/security-changing scenario is necessary, prepare its exact reviewed inputs and follow the applicable approval policy.

## Completion

Complete only when all required acceptance cases have passed independently, the production portal rebuild is ready, and visual checks have evidence. Pre-existing unrelated failures are reported accurately and never hidden or “fixed” outside scope. Backend security hardening identified in the earlier investigation is documented separately; this frontend implementation does not claim to eliminate shared-catalogue or existence-disclosure boundaries.
