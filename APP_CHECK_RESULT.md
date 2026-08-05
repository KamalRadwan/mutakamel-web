# Frontend Application Check Result

> Maintained by the **Frontend Checker** skill. Report-only audit; application code is not changed by the checker.

<!-- FC-META {"schemaVersion":1,"auditState":"IN PROGRESS","generatedAt":"2026-08-04T16:37:04.782Z","repository":"frontend","gitHead":"625295f8ddcc91d8c47d6c5c10fd4166f0f3fbff","gitBranch":"codex/admin-storage-docs","inventorySha256":"7748270466449efce590b2c181452c6c30378fffffe1845ba32abfb0a9be83a3"} -->

- **Audit state:** IN PROGRESS
- **Last inventory:** 2026-08-04T16:37:04.782Z
- **Repository:** `frontend`
- **Git branch / commit:** `codex/admin-storage-docs` / `625295f8ddcc91d8c47d6c5c10fd4166f0f3fbff`
- **Inventory fingerprint:** `7748270466449efce590b2c181452c6c30378fffffe1845ba32abfb0a9be83a3`
- **Persistent write boundary:** only this report
- **Requested semantic scope:** `admin-portal/**` only

## Executive Summary

### Current result

All **328 / 328** Admin Portal files have current eight-phase review evidence. The repository audit remains **IN PROGRESS** because sibling portals, packages, and root files are outside the requested scope and are reset to pending coverage. Repository validation therefore cannot pass in this scoped turn.

Highest risk: tenant-detail first-render failure; UI-only lifecycle/destruction; bypassable registration; fabricated wallet FX; unsafe SMTP partial failure; unstable idempotency. Typecheck, lint, tests, source-aware docs validation, and dependency audit are independently red. No authenticated browser/API, deployment, or release success is claimed.

### Counts

| Metric | Count |
|---|---:|
| Inventoried project-owned files | 1426 |
| Semantic/structured text files | 1421 |
| Metadata-audited assets/symlinks | 5 |
| Admin Portal files reviewed | 328 |
| Pending or stale files | 1098 |
| Open findings | 42 |
| Open P0 / P1 / P2 / P3 / P4 | 7 / 25 / 10 / 0 / 0 |
| Open Critical / High | 5 / 26 |
| Open Medium / Low / Info | 10 / 1 / 0 |

### Highest-priority conclusions

1. Hide or repair tenant crash and false-live admin workflows before operator use.
2. Unify UUIDv7 and exact-intent idempotency across retries, secret DTOs, and non-replayable commands.
3. Restore independent type, lint, test, docs, and dependency gates before trusting build output.
4. Keep cookie-only browser auth authoritative; fix teardown, AuthGuard mounting, and contradictory Bearer docs.
5. Regenerate Gateway docs: current extraction finds 231 routes while artifacts/checks encode 243.

### Prior report reconciliation

| Existing ID | Decision |
|---|---|
| FC-P1-0001 | FALSE_POSITIVE; valid configuration retained |
| FC-P3-0001 | RESOLVED; current lint diagnostics are separate |
| FC-P4-0001 | Reopened for remaining direct sessionStorage paths |
| FC-P5-0001 | Reopened for current dependency advisories |

## Repository Profile

| Area | Evidence |
|---|---|
| Stack | Next 16.2.11, React 19.2.4, TypeScript 5.9.3, ESLint 9.39.5, Vitest 4.1.10, Tailwind 4.3.3 |
| Packages | npm lockfile v3; 535 resolved entries |
| Runtime | App Router, React context/hooks, custom same-origin fetch |
| Auth | HttpOnly cookie mode; no browser Authorization header |
| RBAC | Frontend key helpers; backend guards authoritative |
| API | Gateway /api/admin/core/v1 plus bounded Worker routes |
| i18n | Arabic/English dictionaries, RTL/LTR |
| Verification | Unit/contract source checks only; no authenticated runtime/deployment proof |

## Scope, Inventory, and Exclusions

### Included scope

- Canonical root: `C:/mutakamel.ai/frontend`.
- Admin Portal: 327 semantic files and one structured lockfile.
- Categories: 232 source, 23 test/story, 61 docs, six other text, two config/script, two data-schema, one style, one lockfile.
- Sensitive values were redacted; only environment variable names were inspected.
- Review batches: docs/config 78; app/context/i18n 134; components/features/lib 116.

### File-class summary

<!-- FC-FILE-CLASS-SUMMARY-START -->
| Classification | Files |
|---|---:|
| Audit mode: excluded | 1 |
| Audit mode: metadata | 5 |
| Audit mode: semantic | 1409 |
| Audit mode: structured | 12 |
| Category: asset-binary | 5 |
| Category: configuration-script | 16 |
| Category: data-schema | 17 |
| Category: documentation | 196 |
| Category: lockfile | 4 |
| Category: other-text | 234 |
| Category: source | 928 |
| Category: style | 4 |
| Category: test-story | 23 |
<!-- FC-FILE-CLASS-SUMMARY-END -->

### Exact-content duplicate groups discovered by inventory

<!-- FC-DUPLICATE-GROUPS-START -->
| Group | Files | Bytes each | SHA-256 | Paths |
|---:|---:|---:|---|---|
| 1 | 5 | 87 | e8db26198e5e… | `packages/webphone/node_modules/zustand/esm/react/shallow.d.mts`<br>`packages/webphone/node_modules/zustand/esm/react/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/react/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/react/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/react/shallow.d.ts` |
| 2 | 5 | 64 | 9950c31763b3… | `packages/webphone/node_modules/zustand/esm/vanilla/shallow.d.mts`<br>`packages/webphone/node_modules/zustand/esm/vanilla/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/vanilla/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/vanilla/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/vanilla/shallow.d.ts` |
| 3 | 4 | 90 | 751bd502523a… | `packages/webphone/node_modules/zustand/esm/index.d.ts`<br>`packages/webphone/node_modules/zustand/index.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/index.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/index.d.ts` |
| 4 | 4 | 208 | 2c9f51d489ce… | `packages/webphone/node_modules/zustand/esm/middleware.d.ts`<br>`packages/webphone/node_modules/zustand/middleware.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/middleware.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware.d.ts` |
| 5 | 4 | 208 | 685e133328ba… | `packages/webphone/node_modules/zustand/esm/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/shallow.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/shallow.d.ts` |
| 6 | 3 | 480 | 207e265ff490… | `admin-portal/.gitignore`<br>`partner-portal/.gitignore`<br>`tenant-portal/.gitignore` |
| 7 | 3 | 11 | 336cc4fbf19b… | `admin-portal/CLAUDE.md`<br>`partner-portal/CLAUDE.md`<br>`tenant-portal/CLAUDE.md` |
| 8 | 3 | 465 | 870f1adccecf… | `admin-portal/eslint.config.mjs`<br>`partner-portal/eslint.config.mjs`<br>`tenant-portal/eslint.config.mjs` |
| 9 | 3 | 94 | dfac7ac2d86d… | `admin-portal/postcss.config.mjs`<br>`partner-portal/postcss.config.mjs`<br>`tenant-portal/postcss.config.mjs` |
| 10 | 3 | 904 | a69cb4aaad88… | `packages/webphone/node_modules/zustand/context.d.ts`<br>`packages/webphone/node_modules/zustand/esm/context.d.mts`<br>`packages/webphone/node_modules/zustand/esm/context.d.ts` |
| 11 | 3 | 3432 | 634d7cb046d6… | `packages/webphone/node_modules/zustand/esm/vanilla.d.mts`<br>`packages/webphone/node_modules/zustand/esm/vanilla.d.ts`<br>`packages/webphone/node_modules/zustand/vanilla.d.ts` |
| 12 | 2 | 58 | 40ca9b967f16… | `admin-portal/.env.production`<br>`tenant-portal/.env.production` |
| 13 | 2 | 1006 | 93c348de2232… | `admin-portal/src/lib/safeStorage.ts`<br>`tenant-portal/src/lib/safeStorage.ts` |
| 14 | 2 | 773 | 48ae8d033f44… | `admin-portal/tsconfig.json`<br>`tenant-portal/tsconfig.json` |
| 15 | 2 | 6165 | c5e807dc7f94… | `packages/webphone/node_modules/@types/react/canary.d.ts`<br>`packages/webphone/node_modules/@types/react/ts5.0/canary.d.ts` |
| 16 | 2 | 5603 | 2664f6714020… | `packages/webphone/node_modules/@types/react/experimental.d.ts`<br>`packages/webphone/node_modules/@types/react/ts5.0/experimental.d.ts` |
| 17 | 2 | 7573 | 4d0fb04bb044… | `packages/webphone/node_modules/@types/react/global.d.ts`<br>`packages/webphone/node_modules/@types/react/ts5.0/global.d.ts` |
| 18 | 2 | 773 | cd91972a243c… | `packages/webphone/node_modules/@types/react/jsx-dev-runtime.d.ts`<br>`packages/webphone/node_modules/@types/react/ts5.0/jsx-dev-runtime.d.ts` |
| 19 | 2 | 556 | 9f78824ede09… | `packages/webphone/node_modules/@types/react/jsx-runtime.d.ts`<br>`packages/webphone/node_modules/@types/react/ts5.0/jsx-runtime.d.ts` |
| 20 | 2 | 439 | 1486f1df6ca2… | `packages/webphone/node_modules/zustand/esm/middleware/combine.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/combine.d.ts` |
| 21 | 2 | 1960 | c8d390c13e75… | `packages/webphone/node_modules/zustand/esm/middleware/devtools.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/devtools.d.ts` |
| 22 | 2 | 1221 | 566195b03e53… | `packages/webphone/node_modules/zustand/esm/middleware/immer.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/immer.d.ts` |
| 23 | 2 | 379 | 5d8da7fd85c7… | `packages/webphone/node_modules/zustand/esm/middleware/immer.js`<br>`packages/webphone/node_modules/zustand/esm/middleware/immer.mjs` |
| 24 | 2 | 5019 | 0e91f24d32b4… | `packages/webphone/node_modules/zustand/esm/middleware/persist.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/persist.d.ts` |
| 25 | 2 | 747 | e41f8bdcbadd… | `packages/webphone/node_modules/zustand/esm/middleware/redux.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/redux.d.ts` |
| 26 | 2 | 1180 | eada922976b1… | `packages/webphone/node_modules/zustand/esm/middleware/subscribeWithSelector.d.ts`<br>`packages/webphone/node_modules/zustand/middleware/subscribeWithSelector.d.ts` |
| 27 | 2 | 2069 | 51473e38e063… | `packages/webphone/node_modules/zustand/esm/react.d.ts`<br>`packages/webphone/node_modules/zustand/react.d.ts` |
| 28 | 2 | 1283 | b1ff0ef0bd81… | `packages/webphone/node_modules/zustand/esm/react/shallow.js`<br>`packages/webphone/node_modules/zustand/esm/react/shallow.mjs` |
| 29 | 2 | 1494 | 78e16aff16e2… | `packages/webphone/node_modules/zustand/esm/traditional.d.ts`<br>`packages/webphone/node_modules/zustand/traditional.d.ts` |
| 30 | 2 | 1185 | cd25d765fe66… | `packages/webphone/node_modules/zustand/esm/traditional.js`<br>`packages/webphone/node_modules/zustand/esm/traditional.mjs` |
| 31 | 2 | 1003 | d714d964b7ae… | `packages/webphone/node_modules/zustand/esm/vanilla/shallow.js`<br>`packages/webphone/node_modules/zustand/esm/vanilla/shallow.mjs` |
| 32 | 2 | 894 | 9d3f59ec17cc… | `packages/webphone/node_modules/zustand/ts3.4/context.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/esm/context.d.ts` |
| 33 | 2 | 482 | d4051c37e533… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/combine.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/combine.d.ts` |
| 34 | 2 | 2253 | 206817e8a4a9… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/devtools.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/devtools.d.ts` |
| 35 | 2 | 1395 | a7a950e8e740… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/immer.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/immer.d.ts` |
| 36 | 2 | 5138 | 53d1ec614bf5… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/persist.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/persist.d.ts` |
| 37 | 2 | 808 | 4f058dd0dd0b… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/redux.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/redux.d.ts` |
| 38 | 2 | 1286 | 45b7fef7d68d… | `packages/webphone/node_modules/zustand/ts3.4/esm/middleware/subscribeWithSelector.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/middleware/subscribeWithSelector.d.ts` |
| 39 | 2 | 2138 | fffafafbe314… | `packages/webphone/node_modules/zustand/ts3.4/esm/react.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/react.d.ts` |
| 40 | 2 | 1563 | fa24b1feaf39… | `packages/webphone/node_modules/zustand/ts3.4/esm/traditional.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/traditional.d.ts` |
| 41 | 2 | 3576 | f5cd87209c05… | `packages/webphone/node_modules/zustand/ts3.4/esm/vanilla.d.ts`<br>`packages/webphone/node_modules/zustand/ts3.4/vanilla.d.ts` |
| 42 | 2 | 247 | 7b550dda9686… | `partner-portal/next-env.d.ts`<br>`tenant-portal/next-env.d.ts` |
<!-- FC-DUPLICATE-GROUPS-END -->

### Excluded directories and substitute checks

<!-- FC-EXCLUDED-DIRECTORIES-START -->
| Directory | Reason / substitute control |
|---|---|
| `.git` | Git internal metadata; source and Git status are reviewed instead. |
| `admin-portal/.next` | Disposable Next.js build/cache output; review source, config, caching policy, source maps, and any committed reports instead. |
| `admin-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `partner-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `tenant-portal/.next` | Disposable Next.js build/cache output; review source, config, caching policy, source maps, and any committed reports instead. |
| `tenant-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
<!-- FC-EXCLUDED-DIRECTORIES-END -->

### New, changed, removed, and unchanged files since prior audit

Before this run, `admin-portal/package.json` and `admin-portal/package-lock.json` were already modified by the user. The checker changed only this report. Because the prior whole-repository report overclaimed completion, unreviewed non-Admin coverage is deliberately pending rather than carried forward as verified.

## Tool-Assisted Checks

| Check | CWD | Command/tool | Exit | Result / limitation |
|---|---|---|---:|---|
| Inventory | repository | checker inventory | 0 | 1,426 auditable files |
| Type check | admin-portal | tsc 5.9.3 | 1 | Three TS2307 |
| Lint | admin-portal | ESLint 9.39.5 zero-warning | 1 | 21 errors, one warning |
| Tests | admin-portal | Vitest 4.1.10 | 1 | 21 files/121 tests pass; two files fail |
| Static docs | admin-portal | check-docs.mjs | 0 | 57 Markdown files, stored snapshot only |
| Source-aware docs | admin-portal | npm run docs:check | 1 | 231 current versus fixed 243 |
| Dependency audit | admin-portal | npm audit --json | 1 | Four high packages |
| Production audit | admin-portal | npm audit --omit=dev --json | 1 | Next, PostCSS, sharp high |
| Import graph | admin-portal | 36 entries/249 modules | 0 | 45 unreachable; 39 old dashboard |
| Reference/security scans | admin-portal | ripgrep | 0 | No unsafe HTML/eval/manual browser Bearer sink |
| Checker validation | repository | frontend-checker validate | 1 | 3,295 expected repository-scope errors: 1,098 out-of-scope files lack state/phase coverage plus IN PROGRESS; zero schema, finding, location, or issue-link errors |
| Git write-boundary check | repository | initial versus final git status; git diff --check | 0 | Checker added only APP_CHECK_RESULT.md; the two package manifest edits were pre-existing |

## Prioritized Remediation Queue

| Wave | IDs | Rationale | Gate |
|---:|---|---|---|
| 1 | FC-P7-0005, FC-P7-0007, FC-P7-0009, FC-P7-0011, FC-P7-0014 | Crash, destructive action, validation, finance, SMTP | Focused tests + authenticated runtime |
| 2 | FC-P5-0006, FC-P5-0007, FC-P5-0003, FC-P1-0002 | Exact intent, secrets, concurrency | Retry/cross-tab tests |
| 3 | FC-P3-0002, FC-P3-0003, FC-P3-0004, FC-P5-0001 | Restore gates | typecheck, lint, tests, audit |
| 4 | FC-P7-0001, FC-P7-0002, FC-P7-0003, FC-P7-0004 | Rebuild contract truth | Empty source-aware diff |
| 5 | Remaining Phase 2/4/7 | Correctness, dead code, a11y, i18n, pagination | Per-finding acceptance |
| 6 | FC-P8-0001 | Reproducible evidence | One verify command |


## Phase 1 — Duplicate Functions and Repeated Logic

- **Phase status:** REVIEWED — 2 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 2 / 0 / 1 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P1-0001 | P4 | Info | 3 exact | FALSE_POSITIVE |
| FC-P1-0002 | P1 | High | 5 exact | OPEN |
| FC-P1-0003 | P2 | Medium | 3 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-1-ISSUES-START -->
### FC-P1-0001 — Retain valid configuration files and close the prior false positive

- **Status:** FALSE_POSITIVE
- **Priority:** P4
- **Severity:** Info
- **Confidence:** High
- **Effort:** XS
- **Category/Rule:** Audit classification / configuration
- **Locations:** `admin-portal/.gitignore:1`, `admin-portal/eslint.config.mjs:1-18`, `admin-portal/tsconfig.json:1-28`
- **Symbols:** `Admin Portal configuration`

**Finding**

The previous report classified ordinary configuration, ignore, and generated-declaration files as an issue. Current review confirms these are legitimate project controls, not duplicate or unused product logic.

**Evidence**

The cited files are consumed by Git, ESLint, and TypeScript. No removal signal exists, and the prior finding supplied no behavioral defect.

**Why it matters**

Treating required configuration as debt creates unsafe cleanup work and obscures real duplicate logic.

**Recommended decision**

Preserve the files and retain this ID as a false-positive history record.

**Remediation plan**

1. Take no code action.
2. Keep configuration ownership and generated-file policy documented.

**Verification**

Re-run the applicable Git, ESLint, and TypeScript discovery commands after configuration changes.

**Dependencies and notes**

Revalidated on 2026-08-04; scope narrowed to Admin Portal only.

<!-- FC-FINGERPRINT: phase=1|rule=config-false-positive|path=admin-portal/eslint.config.mjs|symbol=config -->

### FC-P1-0002 — Consolidate the drifting UUIDv7 implementations and remove the weak fallback

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Duplicate logic / idempotency identity
- **Locations:** `admin-portal/src/lib/api/axiosClient.ts:223-247`, `admin-portal/src/lib/utils/uuid.ts:1-26`, `admin-portal/src/shared/utils/idempotency.ts:6-35`, `admin-portal/src/shared/hooks/useIdempotency.ts:2-31`, `admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts:4`
- **Symbols:** `generateUuidV7`, `uuidv7`, `useIdempotency`

**Finding**

UUIDv7 generation has four competing authorities: two local implementations, a test-only helper with a Math.random fallback, and two runtime imports from an undeclared uuid package.

**Evidence**

Repository-wide import analysis found the local utility unused, the shared utility test-only, the fetch client using its own implementation, and critical hooks importing a package absent from package.json. The fallback at shared/utils/idempotency.ts uses predictable Math.random when window crypto is unavailable.

**Why it matters**

Drift can produce incompatible version/variant bits, break builds, or weaken write-intent uniqueness on a critical mutation boundary.

**Recommended decision**

Export one Web Crypto-based UUIDv7 implementation and reuse it from the fetch client, hooks, guard, and tests; intentional server support should use globalThis.crypto, not Math.random.

**Remediation plan**

1. Choose src/lib/utils/uuid.ts or a new shared module as the sole authority.
2. Migrate every caller and remove the external undeclared imports and duplicate implementations.
3. Add fixed-time tests for timestamp ordering, version 7, RFC variant bits, and collision resistance assumptions.

**Verification**

Clean typecheck and full Vitest must pass; a source scan must find one implementation and no Math.random UUID fallback.

**Dependencies and notes**

Coordinate with FC-P3-0002 and FC-P5-0006 so exact-intent retry behavior remains stable.

<!-- FC-FINGERPRINT: phase=1|rule=duplicate-uuidv7|path=admin-portal/src/lib/api/axiosClient.ts|symbol=generateUuidV7 -->

### FC-P1-0003 — Unify the competing Core envelope and normalized-error authorities

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Duplicate contracts / API boundary
- **Locations:** `admin-portal/src/types/common.ts:1-37`, `admin-portal/src/shared/api/core-envelope.ts:1-24`, `admin-portal/src/shared/api/normalized-api-error.ts:1-42`
- **Symbols:** `SuccessResponse`, `CoreSuccessEnvelope`, `NormalizedApiError`

**Finding**

Callers can choose between overlapping envelope/error types whose field and category types have already diverged.

**Evidence**

types/common.ts and shared/api/core-envelope.ts both define success envelopes, while normalized-api-error introduces another API-boundary representation. Error category is a free string in one authority and a constrained union in another.

**Why it matters**

Parallel contract authorities make source migration and documentation parity unreliable and allow feature code to normalize the same response differently.

**Recommended decision**

Make shared/api the canonical browser contract and temporarily re-export compatible aliases from legacy modules during migration.

**Remediation plan**

1. Inventory all imports of the three authorities.
2. Define one Core envelope, Gateway Problem Details, and normalized browser error model.
3. Migrate feature callers and remove the redundant definitions after contract tests pass.

**Verification**

Typecheck, contract tests, and an import scan must prove one canonical definition per boundary.

**Dependencies and notes**

Exact field naming must be resolved with FC-P7-0003 before deleting compatibility aliases.

<!-- FC-FINGERPRINT: phase=1|rule=duplicate-api-contracts|path=admin-portal/src/types/common.ts|symbol=SuccessResponse -->
<!-- FC-PHASE-1-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 2 — Unused and Dead Code

- **Phase status:** REVIEWED — 3 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 3 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P2-0001 | P2 | Medium | 4 exact | OPEN |
| FC-P2-0002 | P2 | Medium | 8 exact | OPEN |
| FC-P2-0003 | P2 | Low | 2 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-2-ISSUES-START -->
### FC-P2-0001 — Remove or deliberately integrate the unreachable dashboard visualization subtree

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Dead code / unreachable feature subtree
- **Locations:** `admin-portal/src/app/dashboard/page.tsx:3-11`, `admin-portal/src/app/hooks/useDashboardHome.ts:5-61`, `admin-portal/src/app/dashboard/components/charts/BaseBarChart.tsx:1-67`, `admin-portal/src/app/dashboard/components/charts/MetricDonutChart.tsx:1-70`
- **Symbols:** `DashboardPage`, `useDashboardHome`, `BaseBarChart`, `MetricDonutChart`

**Finding**

A static runtime-entry import graph found 38 chart modules plus the old useDashboardHome hook unreachable from every Next page/layout/route entry.

**Evidence**

The current dashboard imports grouped operational panels and useDashboardData. The orphan hook still contains fabricated values such as 42 tenants, 18 staff, $1,299 invoices, and 68 percent capacity. No dynamic import or symbol reference reaches the chart tree.

**Why it matters**

Keeping a large mock-heavy subtree inflates dependency, review, and maintenance surface and risks accidental reintroduction of synthetic operational data.

**Recommended decision**

Remove the 39-module subtree if it is obsolete; if it is roadmap work, move it to an explicitly non-production prototype/story area with ownership and source-backed data requirements.

**Remediation plan**

1. Confirm product ownership of the chart roadmap.
2. Delete the unreachable roots and their now-unreachable support modules, or isolate them as prototypes.
3. Re-run the import graph, typecheck, lint, and tests.

**Verification**

No production entry may reach mock data; the runtime graph must report zero unexplained orphan feature roots.

**Dependencies and notes**

Recharts itself may remain because current grouped rendering requirements should be checked separately before dependency removal.

<!-- FC-FINGERPRINT: phase=2|rule=dead-dashboard-subtree|path=admin-portal/src/app/hooks/useDashboardHome.ts|symbol=useDashboardHome -->

### FC-P2-0002 — Retire verified orphan components, legacy models, and unused derived code

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Dead code / stale contracts
- **Locations:** `admin-portal/src/components/layout/BrowserPermissionsModal.tsx:1-145`, `admin-portal/src/components/layout/WebPhoneTrigger.tsx:1-32`, `admin-portal/src/lib/utils/formatters.ts:1-11`, `admin-portal/src/types/module.ts:1-57`, `admin-portal/src/types/dashboard.ts:96-334`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:50-54`, `admin-portal/src/app/users/components/UserMetadataCard.tsx:4-5`, `admin-portal/src/app/users/components/UserProfileCard.tsx:9-10`
- **Symbols:** `BrowserPermissionsModal`, `WebPhoneTrigger`, `formatBytes`, `Module`, `DashboardResponse`, `maxCapacity`

**Finding**

Multiple source files or large legacy sections have no runtime inbound references, and several suppressed bindings/derived values are computed but never consumed.

**Evidence**

Import-graph and symbol searches confirmed the two layout components, formatters utility, and module model are unreachable. The chart-era dashboard model is unused beyond the current group types. Database aggregate calculations and suppressed user-card bindings have no callers.

**Why it matters**

Dead contracts are especially risky where their pricing/dashboard shapes conflict with current feature-owned models; suppressions also hide useful lint signals.

**Recommended decision**

Delete confirmed orphans, split current dashboard group types from the legacy chart model, and remove unused bindings/derivations.

**Remediation plan**

1. Remove whole-file orphans after one final dynamic-reference check.
2. Extract the current dashboard group contract and delete legacy required fields.
3. Remove unused imports, props, and computed aggregates; update tests/import barrels.

**Verification**

The import graph, targeted lint, typecheck, and tests must remain green with no new orphan roots.

**Dependencies and notes**

src/lib/utils/uuid.ts is excluded from deletion because FC-P1-0002 recommends promoting it to the canonical helper.

<!-- FC-FINGERPRINT: phase=2|rule=dead-legacy-sources|path=admin-portal/src/types/module.ts|symbol=Module -->

### FC-P2-0003 — Remove or sanitize tracked diagnostic capture artifacts

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Low
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Dead artifact / metadata exposure
- **Locations:** `admin-portal/lint.json:1`, `admin-portal/null:1`
- **Symbols:** `ESLint capture`, `HTTP error capture`

**Finding**

Two tracked root artifacts have no application or tooling consumer.

**Evidence**

lint.json is a large one-line local ESLint snapshot with absolute developer paths and stale diagnostics. null is a captured 400 login validation response with request/correlation metadata. Both are tracked and unreferenced.

**Why it matters**

They create stale audit evidence, noisy diffs, and unnecessary internal metadata exposure.

**Recommended decision**

Delete them from version control or move a deliberately sanitized sample into a named test-fixture directory.

**Remediation plan**

1. Confirm no consumer with an exact reference scan.
2. Remove or sanitize and rename the artifacts.
3. Add a narrow ignore rule if the tools can recreate them.

**Verification**

Git status must show the artifacts removed or intentionally relocated; live lint/tests must replace snapshot claims.

**Dependencies and notes**

Do not copy request identifiers or environment paths into replacement fixtures.

<!-- FC-FINGERPRINT: phase=2|rule=dead-diagnostic-artifacts|path=admin-portal/lint.json|symbol=none -->
<!-- FC-PHASE-2-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 3 — Lint, Import, Module, and Type Correctness

- **Phase status:** REVIEWED — 4 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 4 / 1 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P3-0001 | P4 | Info | 2 exact | RESOLVED |
| FC-P3-0002 | P0 | High | 5 exact | OPEN |
| FC-P3-0003 | P1 | High | 13 exact | OPEN |
| FC-P3-0004 | P1 | Medium | 4 exact | OPEN |
| FC-P3-0005 | P1 | High | 2 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-3-ISSUES-START -->
### FC-P3-0001 — Keep the historical ESLint loader incident closed

- **Status:** RESOLVED
- **Priority:** P4
- **Severity:** Info
- **Confidence:** High
- **Effort:** XS
- **Category/Rule:** Historical tooling incident
- **Locations:** `admin-portal/eslint.config.mjs:1-18`, `admin-portal/package-lock.json:1`
- **Symbols:** `ESLint configuration`

**Finding**

The prior report recorded an ESLint startup failure attributed to minimatch. Current ESLint 9.39.5 loads the configuration and analyzes source successfully.

**Evidence**

The current lint command reaches rule evaluation and reports source diagnostics rather than a loader/module crash.

**Why it matters**

Preserving the resolution separates a fixed dependency-loader incident from the current React Hooks findings.

**Recommended decision**

Keep this finding resolved; address current diagnostics under FC-P3-0003.

**Remediation plan**

1. No remediation is required for the old incident.
2. Retain lockfile integrity and avoid unreviewed transitive overrides.

**Verification**

npm run lint must continue to reach source analysis without a configuration exception.

**Dependencies and notes**

Revalidated 2026-08-04.

<!-- FC-FINGERPRINT: phase=3|rule=historical-eslint-loader|path=admin-portal/eslint.config.mjs|symbol=config -->

### FC-P3-0002 — Restore type safety and declare or remove every direct import

- **Status:** OPEN
- **Priority:** P0
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Type correctness / undeclared dependencies
- **Locations:** `admin-portal/next.config.ts:16-18`, `admin-portal/package.json:14-32`, `admin-portal/src/shared/hooks/useIdempotency.ts:2`, `admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts:4`, `admin-portal/src/shared/api/__tests__/normalized-api-error.test.ts:6`
- **Symbols:** `typescript.ignoreBuildErrors`, `uuidv7`, `AxiosError`, `AxiosHeaders`

**Finding**

A clean TypeScript check fails because uuid and axios are imported but undeclared, while next build is configured to ignore TypeScript errors.

**Evidence**

tsc 5.9.3 reported three TS2307 errors at the cited imports. package.json declares neither package. next.config.ts sets ignoreBuildErrors true with a development comment even though the option applies to production builds.

**Why it matters**

Critical write hooks cannot compile reliably, the normalized-error suite cannot collect, and a successful Next build would not prove type correctness.

**Recommended decision**

Prefer the local UUID consolidation from FC-P1-0002 and native-client-shaped error fixtures; add a dependency only when it is an intentional runtime/test boundary. Remove ignoreBuildErrors after the source is green.

**Remediation plan**

1. Replace or declare the missing imports.
2. Add a typecheck script and make it an independent release gate.
3. Remove ignoreBuildErrors and run a production build only after typecheck passes.

**Verification**

tsc --noEmit --incremental false, full Vitest, and next build must each pass independently.

**Dependencies and notes**

Current package.json/package-lock changes predated this audit and were not modified.

<!-- FC-FINGERPRINT: phase=3|rule=ts2307-build-bypass|path=admin-portal/next.config.ts|symbol=ignoreBuildErrors -->

### FC-P3-0003 — Resolve the React Hooks lint failures instead of suppressing them

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Lint / React state model
- **Locations:** `admin-portal/src/features/admin/backup/hooks/useBackupArtifacts.ts:70`, `admin-portal/src/features/admin/backup/hooks/useBackupDatabaseAccess.ts:35-74`, `admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts:45`, `admin-portal/src/features/admin/backup/hooks/useBackupOverview.ts:62-96`, `admin-portal/src/features/admin/backup/hooks/useBackupPolicies.ts:39-88`, `admin-portal/src/features/admin/backup/hooks/useBackupRestores.ts:49-158`, `admin-portal/src/features/admin/backup/hooks/useBackupRuns.ts:43-133`, `admin-portal/src/features/admin/backup/hooks/useBackupServerOptions.ts:20-61`, `admin-portal/src/features/admin/backup/screens/BackupAccessScreen.tsx:31`, `admin-portal/src/features/admin/backup/screens/BackupArtifactsScreen.tsx:26`, `admin-portal/src/features/admin/backup/screens/BackupPoliciesScreen.tsx:34`, `admin-portal/src/features/admin/backup/screens/BackupRestoresScreen.tsx:43`, `admin-portal/src/i18n/I18nContext.tsx:3`
- **Symbols:** `backup hooks`, `backup screens`, `I18nContext`

**Finding**

The zero-warning lint gate currently reports 21 errors and one warning.

**Evidence**

Sixteen set-state-in-effect violations and five render-time ref reads occur in Backup hooks/screens; I18nContext has one unused ReactNode import. These are current source findings, not an ESLint loader failure.

**Why it matters**

Effects that synchronously derive state and refs read during render can cause stale UI, extra renders, or behavior that changes under concurrent React.

**Recommended decision**

Refactor derived state into render-time computation or event/request transitions, and expose stable external-store state where synchronization is required.

**Remediation plan**

1. Classify each effect as data fetch, event response, or derivation.
2. Replace derivation effects/ref reads with memoized values, reducers, or explicit state machines.
3. Remove the unused import and run lint with zero warnings.

**Verification**

npm run lint -- --max-warnings=0 --no-cache must exit zero; targeted interaction tests must cover each changed Backup workflow.

**Dependencies and notes**

Do not blanket-disable react-hooks rules; the Backup command semantics are high risk.

<!-- FC-FINGERPRINT: phase=3|rule=react-hooks-lint|path=admin-portal/src/features/admin/backup/hooks/useBackupRuns.ts|symbol=useBackupRuns -->

### FC-P3-0004 — Reconcile the failing dashboard format assertion and restore full test collection

- **Status:** OPEN
- **Priority:** P1
- **Severity:** Medium
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Test correctness / contract expectation
- **Locations:** `admin-portal/src/app/dashboard/utils/dashboard-groups.test.ts:51-55`, `admin-portal/src/app/dashboard/utils/formatters.ts:7-19`, `admin-portal/src/shared/api/__tests__/normalized-api-error.test.ts:6`, `admin-portal/vitest.config.mts:11`
- **Symbols:** `formatDashboardMetric`, `normalized-api-error suite`, `vitest config`

**Finding**

Full Vitest is not green: one suite cannot import axios and one dashboard assertion disagrees with the current money formatter.

**Evidence**

Vitest reported 2 failed files, 21 passed; 1 failed test, 121 passed. The dashboard test expects USD 1000.2500 while source returns $1,000.2500 without losing scale. Vite also warns that __dirname will not survive the future native config loader.

**Why it matters**

Red tests remove regression confidence and leave the intended operator-facing money contract ambiguous.

**Recommended decision**

Choose the product-approved display contract, update source or assertion deliberately, remove the undeclared Axios test dependency, and migrate the config to import.meta.dirname.

**Remediation plan**

1. Confirm the exact bilingual money presentation contract.
2. Fix the dashboard assertion/source and normalized-error fixture.
3. Replace __dirname and rerun all tests.

**Verification**

Vitest must report every suite collected and green, with the scale-preservation case retained.

**Dependencies and notes**

FC-P3-0002 owns the missing-dependency root cause.

<!-- FC-FINGERPRINT: phase=3|rule=failing-tests|path=admin-portal/src/app/dashboard/utils/dashboard-groups.test.ts|symbol=formatDashboardMetric -->

### FC-P3-0005 — Make production API routing explicit and safe

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Next configuration / deployment contract
- **Locations:** `admin-portal/next.config.ts:4-27`, `admin-portal/README.md:13-16`
- **Symbols:** `isDev`, `DEV_API_TARGET`, `rewrites`

**Finding**

The README and config comments describe development-only same-origin rewrites, but the production guard is commented out and every environment returns /api rewrites.

**Evidence**

When DEV_API_TARGET is absent, the destination falls back to http://localhost:9000. isDev is otherwise unused. This contradicts the documented production use of NEXT_PUBLIC_API_URL or ingress.

**Why it matters**

A production server can proxy browser API traffic to an unintended local target, causing outage or topology/security drift.

**Recommended decision**

Choose one production topology explicitly. Based on the current README, restore the development-only guard; otherwise require and validate a production proxy target and update the documentation.

**Remediation plan**

1. Record the deployment/ingress decision.
2. Implement an environment-specific rewrite policy with fail-fast validation.
3. Test development and production-mode /api behavior and update README.

**Verification**

Inspect Next route output and exercise /api in both modes; no production fallback may silently target localhost.

**Dependencies and notes**

Authenticated deployment proof was outside this report-only audit.

<!-- FC-FINGERPRINT: phase=3|rule=production-api-rewrite|path=admin-portal/next.config.ts|symbol=rewrites -->
<!-- FC-PHASE-3-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 4 — Clean-Code Refactoring

- **Phase status:** REVIEWED — 7 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 7 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P4-0001 | P1 | High | 5 exact | OPEN |
| FC-P4-0002 | P2 | Medium | 2 exact | OPEN |
| FC-P4-0003 | P1 | High | 6 exact | OPEN |
| FC-P4-0004 | P1 | High | 5 exact | OPEN |
| FC-P4-0005 | P1 | High | 4 exact | OPEN |
| FC-P4-0006 | P2 | Medium | 6 exact | OPEN |
| FC-P4-0007 | P1 | High | 7 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-4-ISSUES-START -->
### FC-P4-0001 — Finish the safe browser-storage migration for authentication state

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** State safety / auth teardown
- **Locations:** `admin-portal/src/lib/safeStorage.ts:5-35`, `admin-portal/src/lib/api/axiosClient.ts:143-170`, `admin-portal/src/lib/api/axiosClient.ts:210-218`, `admin-portal/src/context/AuthContext.tsx:132-146`, `admin-portal/src/context/AuthContext.tsx:204-245`
- **Symbols:** `safeStorage`, `clearLocalAuthState`, `AuthProvider`

**Finding**

The earlier storage finding was marked resolved, but the migration covers localStorage only. Authentication still performs direct sessionStorage operations, including an unguarded cleanup path.

**Evidence**

Several reads/writes are locally caught, while clearLocalAuthState performs three removals without protection and is called during logout, refresh failure, and 401 handling. A blocked Storage implementation can throw before cleanup/redirect completes.

**Why it matters**

Privacy modes, disabled storage, or quota/security exceptions can mask the original auth failure and leave stale UI/session metadata.

**Recommended decision**

Reopen this finding and provide one non-throwing adapter for both local and session storage; auth teardown must fail closed even when every storage operation throws.

**Remediation plan**

1. Add safe session get/set/remove helpers without logging values.
2. Route AuthContext and axiosClient through the adapter.
3. Test throwing get, set, and remove methods across login, refresh, 401, and logout.

**Verification**

Tests must prove cookie logout/redirect and in-memory user clearing complete despite storage exceptions.

**Dependencies and notes**

No bearer token is currently attached to browser requests; this finding concerns metadata cleanup and reliability.

<!-- FC-FINGERPRINT: phase=4|rule=unsafe-session-storage|path=admin-portal/src/lib/api/axiosClient.ts|symbol=clearLocalAuthState -->

### FC-P4-0002 — Split the tenant-detail and WebRTC monoliths into testable state machines

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** XL
- **Category/Rule:** Complexity / separation of concerns
- **Locations:** `admin-portal/src/app/tenants/[id]/page.tsx:1-1270`, `admin-portal/src/components/layout/hooks/useWebRTCPhone.ts:1-1160`
- **Symbols:** `TenantDetailPage`, `useWebRTCPhone`

**Finding**

Two modules combine many independent workflows, rendering branches, side effects, permissions, media resources, and mutations in single 1,000-plus-line units.

**Evidence**

The tenant page spans profile, provisioning, subscriptions, wallet, FQDN, users, operations, and destructive modals. The WebRTC hook manages configuration, SIP UA/session, media streams, tones/meters, preferences, call logging, and UI state.

**Why it matters**

Large mixed-responsibility units make stale-state, cleanup, accessibility, and contract bugs hard to isolate; several confirmed findings in this report cluster in these files.

**Recommended decision**

Extract domain panels/hooks and explicit reducers/state machines around authoritative async states and resource lifecycles.

**Remediation plan**

1. Define bounded responsibilities and public interfaces.
2. Extract tenant tabs and phone media/SIP/preferences/logging subsystems incrementally.
3. Add component/hook tests before removing compatibility wiring.

**Verification**

Each extracted unit must have focused tests; typecheck/lint/full tests and authenticated smoke tests must remain green.

**Dependencies and notes**

This is a staged refactor and should follow critical correctness fixes, not block them.

<!-- FC-FINGERPRINT: phase=4|rule=oversized-mixed-responsibility|path=admin-portal/src/app/tenants/[id]/page.tsx|symbol=TenantDetailPage -->

### FC-P4-0003 — Bind database verification and rotation validation to the exact submitted intent

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** State consistency / database administration
- **Locations:** `admin-portal/src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx:35-99`, `admin-portal/src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx:208-235`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:120-128`, `admin-portal/src/features/admin/database-servers/components/SystemPrincipalRotationPolicy.tsx:26-28`, `admin-portal/src/features/admin/database-servers/hooks/useSystemPrincipalRotationEditor.ts:28-50`, `admin-portal/docs/api/database-servers.md:215-219`
- **Symbols:** `handleConnectivityCheck`, `checkConnectivity`, `useSystemPrincipalRotationEditor`

**Finding**

Connectivity success is not fingerprinted to the credentials/TLS payload later submitted, completed probe keys are reused, and rotation maintenance-window fields bypass the documented range validation.

**Evidence**

Editable fields can change during/after a successful probe before draft creation. checkConnectivity does not reset its key after success/definitive failure. Blank rotation values become zero and window start/hours are submitted without enforcing 0..23 and 1..24.

**Why it matters**

Operators can see verified state for untested credentials, receive a cached probe instead of a fresh test, or submit invalid rotation policy.

**Recommended decision**

Model verification as evidence for an exact canonical intent digest, invalidate it on change, and validate every documented rotation field before mutation.

**Remediation plan**

1. Disable or version all checked inputs during requests.
2. Persist only a non-secret digest of the successful payload and require equality before creation.
3. Reset connectivity intent keys on definitive outcomes and validate finite integer window ranges.

**Verification**

Deferred-request tests must prove edits invalidate verification; repeated probes must issue fresh intent; boundary tests must cover all rotation ranges.

**Dependencies and notes**

Never persist or log the secret-bearing payload while computing the digest.

<!-- FC-FINGERPRINT: phase=4|rule=database-verification-intent|path=admin-portal/src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx|symbol=handleConnectivityCheck -->

### FC-P4-0004 — Prevent stale asynchronous results from overwriting newer operator state

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Concurrency / lost updates
- **Locations:** `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:70-100`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServerDetail.ts:46-89`, `admin-portal/src/app/settings/hooks/useSettings.ts:105-146`, `admin-portal/src/app/settings/components/SettingField.tsx:44-55`, `admin-portal/src/app/settings/components/SettingField.tsx:95-153`
- **Symbols:** `fetchServers`, `fetchServerDetail`, `saveAllSettings`, `handleChange`

**Finding**

List/detail fetches do not cancel or generation-guard superseded requests, and settings save unconditionally clears a key even when the user edited a newer value while the older request was in flight.

**Evidence**

Rapid filters/route changes can commit an older database response. Settings inputs remain editable; the response for value A deletes the pending key containing newer value B.

**Why it matters**

Operational screens can silently show stale data or lose a newer configuration edit.

**Recommended decision**

Use AbortController/request generations for reads and per-key submitted revisions for writes; only the current request/version may commit or clear state.

**Remediation plan**

1. Add request identity/cancellation to list and detail hooks.
2. Snapshot {key,value,revision} for settings writes and compare before clearing.
3. Keep newer local edits visible and pending when an older response resolves.

**Verification**

Controlled-interleaving tests must prove stale reads and older writes cannot replace newer state.

**Dependencies and notes**

Backend optimistic concurrency can complement but does not replace the client-side guard.

<!-- FC-FINGERPRINT: phase=4|rule=async-state-race|path=admin-portal/src/app/settings/hooks/useSettings.ts|symbol=saveAllSettings -->

### FC-P4-0005 — Use accessible dialog and form primitives in critical admin workflows

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Accessibility / WCAG dialog and form semantics
- **Locations:** `admin-portal/src/app/users/components/InviteUserModal.tsx:104-225`, `admin-portal/src/features/admin/database-servers/components/EditDatabaseServerModal.tsx:117-201`, `admin-portal/src/app/users/page.tsx:180-271`, `admin-portal/src/components/shared/DestructiveActionModal.tsx:42-87`
- **Symbols:** `InviteUserModal`, `EditDatabaseServerModal`, `UsersDirectory`, `DestructiveActionModal`

**Finding**

Invite and database-edit modals lack core dialog semantics/focus behavior, and several labels/search/filter/page-size controls are not programmatically associated.

**Evidence**

The modal shells have no role=dialog, aria-modal, labelled title, focus entry/return/trap, or Escape handling; icon close controls lack accessible names. The existing DestructiveActionModal demonstrates a stronger local pattern.

**Why it matters**

Keyboard and screen-reader users can lose context, interact with background content, or be unable to identify critical controls.

**Recommended decision**

Extract or reuse one accessible modal/form primitive and migrate both workflows and directory controls.

**Remediation plan**

1. Provide role, aria-modal, labelled title/description, focus trap/restore, Escape, and inert background behavior.
2. Associate every label with its control and name icon buttons.
3. Add keyboard and automated accessibility tests in both LTR and RTL.

**Verification**

Keyboard-only acceptance and an automated accessibility scan must report no critical violations for these flows.

**Dependencies and notes**

Visual styling can remain unchanged while semantics are corrected.

<!-- FC-FINGERPRINT: phase=4|rule=inaccessible-admin-dialogs|path=admin-portal/src/app/users/components/InviteUserModal.tsx|symbol=InviteUserModal -->

### FC-P4-0006 — Route critical workflow copy through the bilingual dictionary

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Internationalization / RTL consistency
- **Locations:** `admin-portal/src/app/users/page.tsx:268-378`, `admin-portal/src/app/users/components/WebphoneSummaryCard.tsx:61-85`, `admin-portal/src/features/admin/database-servers/components/EditDatabaseServerModal.tsx:75-241`, `admin-portal/src/features/admin/database-servers/components/SystemPrincipalRotationPolicy.tsx:20-36`, `admin-portal/src/shared/hooks/useActionMutation.ts:25-35`, `admin-portal/src/i18n/dictionaries/ar.ts:9`
- **Symbols:** `UsersDirectory`, `WebphoneSummaryCard`, `EditDatabaseServerModal`, `useActionMutation`

**Finding**

Arabic mode still exposes English-only labels, validation/errors, and shared Success/Error toast titles; some components duplicate manual language branches instead of dictionary keys.

**Evidence**

Confirmed examples include YOU, Super Admin, No Role, Ext, WebPhone labels, most database edit/rotation copy, and generic mutation titles. The Arabic dictionary also contains the visible typo ككمقروء.

**Why it matters**

Mixed-language critical administration reduces comprehension and makes RTL behavior inconsistent and hard to maintain.

**Recommended decision**

Add domain dictionary keys with interpolation and make shared hooks accept localized copy or consume i18n.

**Remediation plan**

1. Inventory user-facing literals in the cited workflows.
2. Add paired Arabic/English keys and replace manual branches/hard-coded titles.
3. Correct the typo and test RTL/LTR rendering.

**Verification**

Locale tests must assert no unintended English UI in Arabic mode and no missing key-shape drift.

**Dependencies and notes**

Technical acronyms such as SIP/WSS may remain, but their surrounding labels require localization.

<!-- FC-FINGERPRINT: phase=4|rule=incomplete-admin-i18n|path=admin-portal/src/app/users/page.tsx|symbol=UsersDirectory -->

### FC-P4-0007 — Preserve actionable field and availability errors instead of collapsing them

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Error-state modeling / operator feedback
- **Locations:** `admin-portal/src/app/users/utils/errorMapping.ts:72-82`, `admin-portal/src/app/users/components/InviteUserModal.tsx:89-95`, `admin-portal/src/app/users/components/InviteUserModal.tsx:190-226`, `admin-portal/src/app/users/components/WebphoneSummaryCard.tsx:13-93`, `admin-portal/src/app/users/hooks/useUserDetail.ts:85-88`, `admin-portal/src/app/users/hooks/useUserDetail.ts:209-241`, `admin-portal/src/app/users/[id]/page.tsx:595-601`
- **Symbols:** `getErrorMessageAndDetails`, `InviteUserModal`, `WebphoneSummaryCard`, `handleSaveWebphone`

**Finding**

Role-not-found invitation errors are suppressed but never rendered, while WebPhone fetch failures become an apparently real Disabled configuration and the editor closes after handlers swallow failures.

**Evidence**

errorMapping emits fieldErrors.roleId; the modal suppresses the toast for any field error but displays only email. useUserDetail converts every WebPhone read failure to undefined, and the card synthesizes Disabled/WSS/no-password state. The save caller closes after awaiting a handler that catches errors.

**Why it matters**

Admins can receive silent failures or mistake unavailable data for authoritative configuration.

**Recommended decision**

Represent field, forbidden, failed, absent, and saved states explicitly; close editors only on confirmed success.

**Remediation plan**

1. Render and clear roleId errors with accessible semantics and retain a general fallback toast.
2. Return a discriminated WebPhone load state instead of undefined.
3. Make save handlers return success/failure and keep the editor open with correlation-safe error details.

**Verification**

Component tests must cover ROLE_NOT_FOUND, WebPhone 403/500/absent, and save failure without modal closure.

**Dependencies and notes**

Backend authorization remains authoritative; this fixes frontend truthfulness and recovery.

<!-- FC-FINGERPRINT: phase=4|rule=collapsed-error-states|path=admin-portal/src/app/users/components/WebphoneSummaryCard.tsx|symbol=WebphoneSummaryCard -->
<!-- FC-PHASE-4-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 5 — Security Issues and Vulnerabilities

- **Phase status:** REVIEWED — 8 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 8 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P5-0001 | P1 | High | 5 exact | OPEN |
| FC-P5-0002 | P1 | High | 1 exact | OPEN |
| FC-P5-0003 | P1 | High | 3 exact | OPEN |
| FC-P5-0004 | P1 | High | 3 exact | OPEN |
| FC-P5-0005 | P1 | High | 7 exact | OPEN |
| FC-P5-0006 | P0 | High | 8 exact | OPEN |
| FC-P5-0007 | P1 | High | 5 exact | OPEN |
| FC-P5-0008 | P2 | Medium | 2 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-5-ISSUES-START -->
### FC-P5-0001 — Patch the current high-severity dependency advisories with reachability-aware upgrades

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Supply-chain vulnerability / installed versions
- **Locations:** `admin-portal/package.json:14-32`, `admin-portal/package-lock.json:2023-2025`, `admin-portal/package-lock.json:2840-2842`, `admin-portal/package-lock.json:5397-5399`, `admin-portal/package-lock.json:6121-6123`
- **Symbols:** `next@16.2.11`, `postcss@8.4.31`, `sharp@0.34.5`, `brace-expansion`

**Finding**

The prior dependency finding is reopened: current npm audit reports four high-severity vulnerable packages, including three in the production tree.

**Evidence**

npm audit reports brace-expansion GHSA-mh99-v99m-4gvg and GHSA-rgw5-rvv9-x895, PostCSS advisories including GHSA-r28c-9q8g-f849 and GHSA-fxqj-rqcc-2cmp, and sharp GHSA-f88m-g3jw-g9cj. npm audit --omit=dev reports Next, PostCSS, and sharp. No current next/image import, attacker-controlled PostCSS transform, or application glob expansion was found, so exploit reachability is not proven for every advisory.

**Why it matters**

Installed vulnerable versions remain a build/runtime supply-chain risk even when a specific Admin Portal exploit path is not demonstrated.

**Recommended decision**

Select a supported stable Next release or narrowly patched dependency resolution after compatibility review; do not blindly adopt a preview solely because npm suggests 16.3.0.

**Remediation plan**

1. Track the official advisories and supported Next release line.
2. Test an approved upgrade/override in a clean install.
3. Run audit, typecheck, lint, tests, build, and image/CSS regression checks.

**Verification**

npm audit and npm audit --omit=dev must be clean or have a documented, time-bounded accepted risk with reachability evidence.

**Dependencies and notes**

Official references: https://github.com/advisories/GHSA-rgw5-rvv9-x895, https://github.com/advisories/GHSA-fxqj-rqcc-2cmp, https://github.com/advisories/GHSA-f88m-g3jw-g9cj.

<!-- FC-FINGERPRINT: phase=5|rule=dependency-advisories|path=admin-portal/package-lock.json|symbol=next -->

### FC-P5-0002 — Prevent protected children from mounting before unauthenticated redirect

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Authentication / route guard
- **Locations:** `admin-portal/src/components/auth/AuthGuard.tsx:8-34`
- **Symbols:** `AuthGuard`

**Finding**

After loading, an unauthenticated protected route triggers redirect only in an effect and still renders children for at least one commit.

**Evidence**

The component unconditionally returns children at line 34; router.push is called from the effect for unauthenticated protected paths.

**Why it matters**

Protected components can mount effects and issue avoidable unauthorized requests, and push retains the rejected route in history.

**Recommended decision**

Return a neutral state for the unauthenticated branch and use router.replace; apply the inverse guard for the login page.

**Remediation plan**

1. Move guard branches before child rendering.
2. Use replace for rejected navigation.
3. Add component tests that assert protected children never mount.

**Verification**

Unauthenticated tests must observe zero child renders/API effects and no protected history entry.

**Dependencies and notes**

Backend authorization is still the security boundary; this removes frontend leakage.

<!-- FC-FINGERPRINT: phase=5|rule=authguard-pre-redirect-render|path=admin-portal/src/components/auth/AuthGuard.tsx|symbol=AuthGuard -->

### FC-P5-0003 — Make the durable non-idempotent Backup guard atomic across tabs

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Concurrency / destructive commands
- **Locations:** `admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts:71-110`, `admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.ts:85-121`, `admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.test.ts:20-62`
- **Symbols:** `begin`, `writeBackupNonIdempotentCommandAttempt`, `MemoryStorage`

**Finding**

The browser guard uses a non-atomic localStorage read-empty, write, read-confirm sequence.

**Evidence**

Two tabs can both read empty, interleave writes, and each confirm itself before sending. Tests cover sequential operations against one MemoryStorage, not two controlled contexts.

**Why it matters**

Backup start, restore start, and promote are explicitly non-replayable; a race can submit the same destructive or expensive intent twice.

**Recommended decision**

Serialize acquisition with Web Locks or an equivalent cross-context primitive, while retaining durable evidence; require server-side command identity/exclusion as the authoritative control.

**Remediation plan**

1. Define the cross-tab lock/fallback policy.
2. Acquire the lock before reading/writing the durable record.
3. Add a two-context controlled-interleaving test and server duplicate-command acceptance criteria.

**Verification**

Exactly one concurrent context may acquire a given command intent; ambiguous failures must retain evidence safely.

**Dependencies and notes**

Browser locking cannot replace Worker-side durable exclusion.

<!-- FC-FINGERPRINT: phase=5|rule=backup-guard-race|path=admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.ts|symbol=writeBackupNonIdempotentCommandAttempt -->

### FC-P5-0004 — Clear secret-bearing WebPhone state when the session deactivates

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Secrets / in-memory lifecycle
- **Locations:** `admin-portal/src/components/layout/hooks/useWebRTCPhone.ts:67-180`, `admin-portal/src/components/layout/hooks/useWebRTCPhone.ts:265-286`, `admin-portal/src/app/layout.tsx:25-28`
- **Symbols:** `webphone`, `sipPassword`, `shouldActivate`

**Finding**

Logout/deactivation stops SIP and media resources but retains the loaded WebPhone configuration, including sipPassword, in mounted React state.

**Evidence**

The hook stores AdminWebphoneConfig, passes sipPassword to the UA, and cleanup stops resources without setWebphone(undefined), setSettings(undefined), or resetting user-specific call state. The widget is globally mounted.

**Why it matters**

Retaining a sensitive SIP credential after logout unnecessarily extends secret lifetime and risks reuse/inspection in a subsequent session.

**Recommended decision**

Clear all secret-bearing and user-specific phone state on deactivation in addition to stopping UA/media resources.

**Remediation plan**

1. Create one teardown routine for UA, streams, tones, refs, config, settings, and call state.
2. Invoke it on logout/path deactivation and unmount.
3. Test sequential users in one mounted app shell.

**Verification**

A logout test must prove resources stop, secret state clears, and user B cannot observe user A configuration.

**Dependencies and notes**

UI preference storage may remain because it contains no SIP credential.

<!-- FC-FINGERPRINT: phase=5|rule=webphone-secret-lifetime|path=admin-portal/src/components/layout/hooks/useWebRTCPhone.ts|symbol=webphone -->

### FC-P5-0005 — Remove browser Bearer-token instructions from feature documentation

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Security documentation / cookie boundary
- **Locations:** `admin-portal/docs/api/dashboard.md:15-24`, `admin-portal/docs/components/floating-webphone.md:18-19`, `admin-portal/docs/models/interfaces.md:24-34`, `admin-portal/docs/api/auth.md:25-28`, `admin-portal/docs/api/auth.md:71-80`, `admin-portal/docs/rbac/permissions.md:13`, `admin-portal/src/lib/api/axiosClient.test.ts:101-107`
- **Symbols:** `AdminAuthCookieResponse`, `axiosClient`

**Finding**

Dashboard/WebPhone docs instruct browser Bearer authentication and expose accessToken in a cookie response interface, contradicting the authoritative HttpOnly cookie contract and current client tests.

**Evidence**

The auth and RBAC docs forbid browser token access/attachment; axiosClient tests assert no Authorization header.

**Why it matters**

Following the contradictory feature docs would weaken the cookie boundary or produce broken browser code.

**Recommended decision**

Make cookie mode the sole browser contract and describe any Bearer promotion as Gateway-internal.

**Remediation plan**

1. Remove browser Authorization examples and accessToken from cookie-mode interfaces.
2. Link every feature doc to the canonical auth contract.
3. Add a docs check/source scan for manual browser Authorization headers.

**Verification**

Docs checks and axios client tests must confirm no browser-facing Bearer contract.

**Dependencies and notes**

Service-to-service authentication is outside this browser contract.

<!-- FC-FINGERPRINT: phase=5|rule=browser-bearer-docs|path=admin-portal/docs/api/dashboard.md|symbol=AdminAuthCookieResponse -->

### FC-P5-0006 — Preserve one exact idempotency intent across retries and actions

- **Status:** OPEN
- **Priority:** P0
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Idempotency / replay safety
- **Locations:** `admin-portal/src/lib/api/axiosClient.ts:272-280`, `admin-portal/src/lib/api/axiosClient.ts:309-338`, `admin-portal/src/lib/api/axiosClient.test.ts:197-225`, `admin-portal/src/shared/hooks/useIdempotency.ts:11-27`, `admin-portal/src/shared/hooks/useActionMutation.ts:16-36`, `admin-portal/src/features/admin/applications/hooks/useApplication.ts:74-95`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:120-128`, `admin-portal/docs/architecture/permissions-idempotency-and-state.md:32-35`
- **Symbols:** `customFetch`, `useIdempotency`, `useActionMutation`, `checkConnectivity`

**Finding**

Automatic keys change across a 401 refresh retry, shared hook identity hashes only payload rather than method/path/query/body, and some completed probes reuse a prior key.

**Evidence**

customFetch generates headers locally then recursively retries with original options, producing a new UUID. One application hook uses the same mutation helper for different endpoints with equal DTO shapes. The connectivity hook does not reset after definitive outcomes.

**Why it matters**

If the first write commits before a 401 response, a new retry key can duplicate it; conversely, reusing a key across a different action can return/reject the wrong intent.

**Recommended decision**

Create an exact canonical intent descriptor and finalize its UUID/headers once per logical write; preserve it only for the allowed ambiguous retry and reset on definitive completion.

**Remediation plan**

1. Model intent as actor, method, path, canonical query, and body digest.
2. Carry finalized headers/key through the single 401 retry.
3. Make hooks distinguish definitive from ambiguous failures and test cross-action/retry behavior.

**Verification**

Tests must assert identical keys across refresh retry, different keys for different paths, and documented retention/reset for each outcome.

**Dependencies and notes**

Coordinate UUID consolidation in FC-P1-0002 and never automatically replay explicitly non-replayable Backup commands.

<!-- FC-FINGERPRINT: phase=5|rule=idempotency-intent-drift|path=admin-portal/src/lib/api/axiosClient.ts|symbol=customFetch -->

### FC-P5-0007 — Do not serialize secret-bearing DTOs into an idempotency pseudo-hash

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Secrets / in-memory retention
- **Locations:** `admin-portal/src/shared/hooks/useIdempotency.ts:11-27`, `admin-portal/src/features/admin/database-servers/components/EditDatabaseServerModal.tsx:82-103`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:102-123`, `admin-portal/src/features/admin/database-servers/types/index.ts:31-40`, `admin-portal/src/features/admin/database-servers/types/index.ts:168-198`
- **Symbols:** `hashRef`, `formData`, `DatabaseServerConnectivityDto`

**Finding**

useIdempotency names a JSON.stringify result a hash and retains the full payload in a ref; database connectivity/update payloads can contain passwords, private keys, and passphrases.

**Evidence**

Secret-bearing DTOs flow through the hook and remain as plaintext serialized strings for the component lifetime. Connectivity success does not clear the ref.

**Why it matters**

This unnecessarily expands sensitive data lifetime and inspection surface in the browser heap.

**Recommended decision**

Retain only the UUID and a non-reversible, non-secret canonical intent digest; secret payloads must remain ephemeral request data.

**Remediation plan**

1. Separate secret fields from the intent comparison model.
2. Use Web Crypto digest over a canonical bounded representation without retaining plaintext.
3. Clear transient buffers/refs after definitive completion.

**Verification**

Tests must prove refs/state contain no password, private key, passphrase, or raw serialized DTO after success/failure.

**Dependencies and notes**

The digest must still satisfy the exact-intent behavior in FC-P5-0006.

<!-- FC-FINGERPRINT: phase=5|rule=secret-payload-pseudohash|path=admin-portal/src/shared/hooks/useIdempotency.ts|symbol=hashRef -->

### FC-P5-0008 — Define fail-closed RBAC helper semantics for empty and any-of checks

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Authorization helper / latent gating risk
- **Locations:** `admin-portal/src/lib/auth/rbac.ts:46-66`, `admin-portal/docs/architecture/permissions-idempotency-and-state.md:20-26`
- **Symbols:** `adminCan`, `adminCanAll`, `adminCanAny`

**Finding**

The canonical document requires adminCanAny, but the helper exposes only single/all checks; adminCanAll(null, []) returns true through vacuous every semantics.

**Evidence**

No current caller was found passing an empty list, so this is a latent frontend gating defect rather than evidence of a backend authorization bypass.

**Why it matters**

A future dynamic permission list can accidentally display a protected action to an unauthenticated/unauthorized user.

**Recommended decision**

Add adminCanAny and explicitly make null/empty inputs fail closed unless a named call site deliberately models no required permission.

**Remediation plan**

1. Define and document single/all/any semantics.
2. Reject empty permission collections by default.
3. Add tests for null user, empty lists, super-admin, and critical tuples.

**Verification**

RBAC unit tests must cover every null/empty/combinator case and current consumers must typecheck.

**Dependencies and notes**

Backend guards remain authoritative.

<!-- FC-FINGERPRINT: phase=5|rule=rbac-empty-list|path=admin-portal/src/lib/auth/rbac.ts|symbol=adminCanAll -->
<!-- FC-PHASE-5-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 6 — AI Documentation Health and Rebuild Plan

- **Phase status:** REVIEWED — 1 OPEN FINDING
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 1 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P6-0001 | P2 | Medium | 5 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-6-ISSUES-START -->
### FC-P6-0001 — Consolidate contradictory AI guidance and duplicate documentation sections

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** AI documentation health / contradictory authority
- **Locations:** `admin-portal/docs/models/dtos.md:399-450`, `admin-portal/docs/guides/sidebar-navigation.md:106-120`, `admin-portal/CLAUDE.md:1`, `admin-portal/.agents/AGENTS.md:13-14`, `admin-portal/AGENTS.md:34-47`
- **Symbols:** `Storage DTO guidance`, `sidebar storage guidance`, `AI instructions`

**Finding**

Duplicate storage DTO/sidebar sections and competing AI instruction files present incompatible live/planned and cookie/Bearer assumptions; CLAUDE.md is a one-character stub.

**Evidence**

Storage DTO sections repeat, sidebar storage guidance appears in both live-bounded and planned forms, and nested AI guidance conflicts with the current root Admin Portal rules.

**Why it matters**

AI-assisted changes can select stale security, routing, or implementation assumptions even when source code is correct.

**Recommended decision**

Keep one scoped Admin Portal instruction authority, remove stubs/duplicates, and make historical plans explicitly historical.

**Remediation plan**

1. Reconcile nested instructions against root AGENTS.md.
2. Deduplicate DTO/sidebar content and add canonical links.
3. Add docs checks for contradictory auth/readiness phrases and empty/stub AI files.

**Verification**

Manual AI-context review and docs checks must find one unambiguous authority per subject.

**Dependencies and notes**

Generated contract drift is tracked separately in FC-P7-0001.

<!-- FC-FINGERPRINT: phase=6|rule=contradictory-ai-docs|path=admin-portal/.agents/AGENTS.md|symbol=none -->
<!-- FC-PHASE-6-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 7 — Documentation-to-Frontend Implementation Gaps

- **Phase status:** REVIEWED — 16 OPEN FINDINGS
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 16 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P7-0001 | P0 | High | 11 exact | OPEN |
| FC-P7-0002 | P2 | Medium | 6 exact | OPEN |
| FC-P7-0003 | P1 | High | 3 exact | OPEN |
| FC-P7-0004 | P2 | Medium | 7 exact | OPEN |
| FC-P7-0005 | P0 | Critical | 4 exact | OPEN |
| FC-P7-0006 | P1 | High | 3 exact | OPEN |
| FC-P7-0007 | P0 | Critical | 4 exact | OPEN |
| FC-P7-0008 | P1 | High | 3 exact | OPEN |
| FC-P7-0009 | P0 | Critical | 4 exact | OPEN |
| FC-P7-0010 | P1 | High | 6 exact | OPEN |
| FC-P7-0011 | P0 | Critical | 3 exact | OPEN |
| FC-P7-0012 | P1 | High | 4 exact | OPEN |
| FC-P7-0013 | P1 | High | 12 exact | OPEN |
| FC-P7-0014 | P1 | Critical | 2 exact | OPEN |
| FC-P7-0015 | P1 | High | 4 exact | OPEN |
| FC-P7-0016 | P1 | High | 6 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-7-ISSUES-START -->
### FC-P7-0001 — Regenerate the Gateway route inventory and remove the fixed 243-route invariant

- **Status:** OPEN
- **Priority:** P0
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Documentation-to-source drift / API inventory
- **Locations:** `admin-portal/docs/generated/admin-core-api-routes.md:6-17`, `admin-portal/docs/generated/admin-core-api-routes.md:102-112`, `admin-portal/docs/README.md:19`, `admin-portal/docs/README.md:65`, `admin-portal/docs/DOCUMENTATION_CONTRACT.md:95-108`, `admin-portal/docs/audit/documentation-coverage.md:12-36`, `admin-portal/docs/frontend-integration-guide.md:11-13`, `admin-portal/docs/api/README.md:40-42`, `admin-portal/scripts/docs/generate-admin-route-inventory.mjs:205-208`, `admin-portal/scripts/docs/generate-admin-route-inventory.mjs:249-255`, `admin-portal/scripts/docs/check-docs.mjs:93-97`
- **Symbols:** `CORE_ROUTE_CONTRACTS`, `counts.total`

**Finding**

Central docs present 243 routes as current/exhaustive while the checked Gateway source now yields 231 and the generator/checker hard-code the obsolete count.

**Evidence**

Read-only source extraction found 40 stored routes removed, 28 added, and 5 metadata changes; stale docs still include removed /modules paths and omit current /applications and expanded database-server routes. The direct static Markdown checker passes its stored snapshot, while npm run docs:check fails at the source-aware generator.

**Why it matters**

Frontend work can implement removed addresses, omit current permissions, or apply stale retry/idempotency metadata.

**Recommended decision**

Make live Gateway source comparison authoritative; review the 231-route set, regenerate JSON/Markdown, and replace count assertions with route-set/source-hash parity.

**Remediation plan**

1. Approve the current Gateway route authority.
2. Regenerate route artifacts and update all 243/current prose atomically.
3. Make docs:check compare every method/path/permission/idempotency tuple to source.

**Verification**

npm run docs:routes and npm run docs:check must pass; an independent tuple diff must be empty.

**Dependencies and notes**

Backend files were read only for verification and were not modified.

<!-- FC-FINGERPRINT: phase=7|rule=route-inventory-drift|path=admin-portal/docs/generated/admin-core-api-routes.md|symbol=CORE_ROUTE_CONTRACTS -->

### FC-P7-0002 — Align shared DTO documentation with feature-owned request contracts

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** DTO documentation drift
- **Locations:** `admin-portal/docs/models/dtos.md:75-84`, `admin-portal/docs/models/dtos.md:532-575`, `admin-portal/docs/api/users.md:36-41`, `admin-portal/src/app/users/types/adminUser.ts:78-99`, `admin-portal/docs/api/catalog.md:362-363`, `admin-portal/src/features/admin/applications/types/index.ts:170-178`
- **Symbols:** `CreateAdminUserDto`, `CreateApplicationDto`

**Finding**

Shared DTO docs describe optional roleIds for Admin User creation and a 64-character application key, while current feature contracts require singular roleId/support isSuperAdmin and cap application keys at 32.

**Evidence**

Current feature docs and TypeScript types agree with each other and disagree with docs/models/dtos.md.

**Why it matters**

Generated forms or clients based on the shared model can send rejected or semantically wrong payloads.

**Recommended decision**

Generate or centralize DTO documentation from the accepted feature/Core contracts.

**Remediation plan**

1. Confirm Core validation for both DTOs.
2. Update shared DTO examples and constraints.
3. Add contract tests that execute documented request examples against current types/validation.

**Verification**

Documented examples must typecheck and match exact current request DTOs.

**Dependencies and notes**

Coordinate with route inventory regeneration before claiming Gateway completeness.

<!-- FC-FINGERPRINT: phase=7|rule=dto-doc-drift|path=admin-portal/docs/models/dtos.md|symbol=CreateAdminUserDto -->

### FC-P7-0003 — Resolve the normalized-error source and documentation contract mismatch

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** HTTP/error contract drift
- **Locations:** `admin-portal/docs/architecture/http-and-error-contract.md:74-89`, `admin-portal/src/shared/api/normalized-api-error.ts:33-42`, `admin-portal/src/shared/api/__tests__/normalized-api-error.test.ts:38-42`
- **Symbols:** `NormalizedApiError`

**Finding**

Canonical docs require status, code, fieldErrors, and source CORE/GATEWAY/TRANSPORT, while source exposes httpStatus, errorCode, details, and no source; tests reinforce the source shape.

**Evidence**

Both sides are explicit and mutually incompatible.

**Why it matters**

Without source classification and stable fields, UI recovery, telemetry, and feature error mapping cannot reliably distinguish Core envelopes, Gateway Problem Details, and transport failure.

**Recommended decision**

Choose the canonical normalized browser model and migrate implementation, tests, and feature consumers atomically.

**Remediation plan**

1. Decide field names and source classification.
2. Provide a compatibility adapter while migrating callers.
3. Expand tests for Core, Gateway, transport, malformed details, correlation headers, and field errors.

**Verification**

Docs, TypeScript, and all normalized-error tests must expose one identical shape.

**Dependencies and notes**

The currently failing Axios-import test must first collect under FC-P3-0002.

<!-- FC-FINGERPRINT: phase=7|rule=normalized-error-contract-drift|path=admin-portal/src/shared/api/normalized-api-error.ts|symbol=NormalizedApiError -->

### FC-P7-0004 — Use one evidence-based readiness taxonomy across feature docs

- **Status:** OPEN
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Documentation status overclaim
- **Locations:** `admin-portal/docs/api/users.md:3`, `admin-portal/docs/api/users.md:81-82`, `admin-portal/docs/guides/sidebar-navigation.md:19`, `admin-portal/docs/frontend-integration-guide.md:64-72`, `admin-portal/docs/audit/frontend-capability-matrix.md:8-20`, `admin-portal/docs/audit/frontend-capability-matrix.md:120`, `admin-portal/docs/api/storage-servers.md:3-34`
- **Symbols:** `readiness labels`

**Finding**

Feature docs use COMPLETE/live labels that contradict their own detailed gaps, current source capabilities, or caller-owned idempotency guidance.

**Evidence**

Users is called complete while self-profile gaps are listed; applications descriptions disagree; storage docs imply interceptor-managed idempotency despite the exact-intent caller-owned contract.

**Why it matters**

Readers cannot distinguish source-integrated, partial, runtime-verified, deployment-verified, and unavailable capability.

**Recommended decision**

Adopt the capability-matrix taxonomy everywhere and eliminate unqualified COMPLETE/live language.

**Remediation plan**

1. Define allowed readiness states and required evidence.
2. Reconcile every feature status against source and current route inventory.
3. Keep authenticated runtime/deployment proof separate from source integration.

**Verification**

A docs scan and manual review must find no contradictory readiness label.

**Dependencies and notes**

Depends on FC-P7-0001.

<!-- FC-FINGERPRINT: phase=7|rule=readiness-status-drift|path=admin-portal/docs/audit/frontend-capability-matrix.md|symbol=none -->

### FC-P7-0005 — Render tenant loading and partial states before dereferencing projections

- **Status:** OPEN
- **Priority:** P0
- **Severity:** Critical
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Runtime correctness / tenant detail
- **Locations:** `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:84-93`, `admin-portal/src/app/tenants/[id]/page.tsx:119-145`, `admin-portal/src/app/tenants/[id]/page.tsx:207-255`, `admin-portal/src/app/tenants/[id]/page.tsx:330-365`
- **Symbols:** `useTenantDetail`, `TenantDetailPage`

**Finding**

The hook initializes tenant, subscription, and wallet to null, but the page dereferences them in its header/cards before reaching the loading branch.

**Evidence**

tenant.companyName, subscription.planName, and wallet.balanceUsd are read on the normal first render.

**Why it matters**

The route can throw before asynchronous requests complete, making tenant detail unusable.

**Recommended decision**

Return a loading/error/not-found/partial boundary before any required projection dereference.

**Remediation plan**

1. Move early state returns ahead of the header/cards.
2. Type projections explicitly and decide which subrequests are optional.
3. Render authorized unavailable states without synthetic fallbacks.

**Verification**

A deferred-request component test must render loading without throwing and then cover full, partial, forbidden, and failed projections.

**Dependencies and notes**

Confirm whether subscription/wallet are independently optional in the exact Core envelope.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-detail-null-deref|path=admin-portal/src/app/tenants/[id]/page.tsx|symbol=TenantDetailPage -->

### FC-P7-0006 — Save tenant profile edits from the same state the form displays

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Data integrity / stale form state
- **Locations:** `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:91-124`, `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:206-217`, `admin-portal/src/app/tenants/[id]/page.tsx:425-535`
- **Symbols:** `editProfileData`, `handleUpdateTenantProfile`

**Finding**

Inputs mutate tenant, but submit builds the PATCH DTO from unchanged editProfileData.

**Evidence**

The hook seeds editProfileData and submits it; the page never consumes its setter and calls setTenant for every editable field.

**Why it matters**

Operators see changed values while the request sends the original profile, producing a false successful save and discarded work.

**Recommended decision**

Use one controlled form state and keep tenant as the last server-confirmed projection.

**Remediation plan**

1. Bind every input to editProfileData.
2. Submit that exact validated state and refresh the confirmed baseline only after success.
3. Preserve edit mode and field/correlation errors on conflict/failure.

**Verification**

Change every editable field in a component test and assert the exact PATCH body and returned baseline.

**Dependencies and notes**

Use the exact buildUpdateTenantProfileDto contract.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-profile-stale-submit|path=admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts|symbol=handleUpdateTenantProfile -->

### FC-P7-0007 — Remove or implement the UI-only tenant lifecycle and destruction actions

- **Status:** OPEN
- **Priority:** P0
- **Severity:** Critical
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Broken administrative workflow
- **Locations:** `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:244-257`, `admin-portal/src/app/tenants/[id]/page.tsx:104-117`, `admin-portal/src/app/tenants/[id]/page.tsx:150-195`, `admin-portal/src/app/tenants/[id]/page.tsx:1154-1185`
- **Symbols:** `handleActivate`, `handleSuspend`, `handleDelete`, `handleDestroyConfirm`

**Finding**

Activate, suspend, delete, cancel-provisioning, and reprovision only mutate React state; permanent destroy only redirects and ignores the subscription toggle.

**Evidence**

No handler issues the documented authoritative write.

**Why it matters**

A critical admin action appears successful although Core state never changed; refresh reverses it and destruction confirmation is deceptive.

**Recommended decision**

Hide these controls until exact Gateway routes/permissions/idempotency/DTOs are implemented, or implement them completely.

**Remediation plan**

1. Map each action to the verified route and permission.
2. Use stable UUIDv7 exact intent and keep the modal open on failure.
3. Refetch authoritative tenant state and surface receipt/correlation evidence.

**Verification**

Request-contract tests plus authenticated permitted/forbidden runtime proof are required for every transition.

**Dependencies and notes**

Route inventory must be refreshed first under FC-P7-0001.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-lifecycle-simulation|path=admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts|symbol=handleDestroyConfirm -->

### FC-P7-0008 — Remove the mock tenant-user organization editor until it performs a real save

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Mocked production workflow
- **Locations:** `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:182-202`, `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:439-443`, `admin-portal/src/app/tenants/[id]/page.tsx:1188-1263`
- **Symbols:** `mockBranches`, `mockDepartments`, `mockTeams`

**Finding**

The tenant-user editor renders hard-coded organization catalogues and reports success without form state, permission check, DTO, or HTTP request.

**Evidence**

Save only sets a local banner, closes, and starts a timer.

**Why it matters**

Admins can believe identity/placement changes were applied and mistake demo entities for tenant data.

**Recommended decision**

Disable/remove the editor until real tenant-scoped catalogues and mutation contracts are wired.

**Remediation plan**

1. Load authoritative catalogues with permission-aware states.
2. Use controlled validated inputs and the exact user placement/profile route.
3. Refetch after confirmed success and preserve error state.

**Verification**

Contract tests must cover owner protection, RBAC denial, successful update, and validation failure.

**Dependencies and notes**

Requires tenant-user and organization ownership contracts.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-user-mock-editor|path=admin-portal/src/app/tenants/[id]/page.tsx|symbol=mockBranches -->

### FC-P7-0009 — Validate the complete tenant registration payload before any quote or create write

- **Status:** OPEN
- **Priority:** P0
- **Severity:** Critical
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Validation / provisioning integrity
- **Locations:** `admin-portal/src/app/tenants/new/page.tsx:149-152`, `admin-portal/src/app/tenants/new/page.tsx:269-270`, `admin-portal/src/app/tenants/new/page.tsx:674-743`, `admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts:194-215`
- **Symbols:** `RegisterTenantWizardPage`, `handleSubmit`, `goToStep`

**Finding**

Required identity/owner controls are unmounted on the final wizard step, navigation does not validate them, and submit checks only storage placement before requesting a quote.

**Evidence**

Blank name, company, owner email, and owner names can reach the two-write flow because native required controls are absent from the final DOM.

**Why it matters**

The portal relies on late backend rejection and can create quote side effects for an invalid registration.

**Recommended decision**

Add one typed schema used per step and for final full-payload validation before the first write.

**Remediation plan**

1. Define the exact CreateTenant and quote schemas.
2. Block forward navigation and final submission on schema errors.
3. Map server field errors back to the owning step.

**Verification**

Wizard tests must prove every required field blocks navigation and both POSTs.

**Dependencies and notes**

Confirm exact quote/create DTO constraints and idempotency semantics.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-wizard-validation-bypass|path=admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts|symbol=handleSubmit -->

### FC-P7-0010 — Replace simulated tenant availability, DAG, and database placement evidence

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** False operational evidence / provisioning
- **Locations:** `admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts:46-85`, `admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts:155-190`, `admin-portal/src/app/tenants/new/page.tsx:174-185`, `admin-portal/src/app/tenants/new/page.tsx:379-405`, `admin-portal/src/app/tenants/new/page.tsx:648-669`, `admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts:222-241`
- **Symbols:** `handleValidateIdentity`, `handlePreviewPlan`, `databaseServerId`

**Finding**

Availability accepts any three-character name after a timer, DAG preview returns constant validated evidence, realistic legal/contact defaults are prefilled, and manual database options use invented srv-* identifiers sent in the create DTO.

**Evidence**

Neither evidence handler calls a source-backed API or derives its result from selections; the database side is literal while storage placement uses authoritative options.

**Why it matters**

Operators can act on fabricated readiness and submit stale/invented infrastructure targets or sample business data.

**Recommended decision**

Remove simulations and neutralize defaults until authoritative validation/preview/placement APIs are available.

**Remediation plan**

1. Wire verified availability/DAG/options routes when present.
2. Fail closed with explicit unavailable states otherwise.
3. Revalidate selected UUID/capacity on submit and begin new forms with neutral values.

**Verification**

Network tests must prove displayed evidence derives from the current request and manual targets are current authoritative records.

**Dependencies and notes**

Depends on refreshed Gateway capabilities.

<!-- FC-FINGERPRINT: phase=7|rule=tenant-provisioning-fake-evidence|path=admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts|symbol=handlePreviewPlan -->

### FC-P7-0011 — Remove fabricated FX conversion from wallet adjustments

- **Status:** OPEN
- **Priority:** P0
- **Severity:** Critical
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Financial correctness
- **Locations:** `admin-portal/src/app/tenants/[id]/page.tsx:1016-1027`, `admin-portal/src/app/tenants/[id]/page.tsx:1099-1118`, `admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts:342-363`
- **Symbols:** `submitCreditAdjustment`, `submitDebitAdjustment`

**Finding**

The wallet preview hard-codes EGP=50 and SAR=3.75 and treats every other selectable currency, including AED and EUR, as 1 USD.

**Evidence**

The actual write sends amount/currency/note and the displayed approved rate is unrelated to any quote response.

**Why it matters**

A financial administrator can confirm a credit/debit using a materially false USD preview.

**Recommended decision**

Do not display a converted amount without a server-issued quote, expiry, and evidence; otherwise show source currency only.

**Remediation plan**

1. Integrate an authoritative FX/adjustment quote if available.
2. Bind confirmation to the quote ID/expiry and exact amount.
3. Reconcile the confirmed ledger response after write.

**Verification**

Currency, expiry, rounding, stale-quote, and ledger reconciliation tests must pass.

**Dependencies and notes**

Requires the wallet FX/adjustment contract.

<!-- FC-FINGERPRINT: phase=7|rule=fabricated-wallet-fx|path=admin-portal/src/app/tenants/[id]/page.tsx|symbol=submitCreditAdjustment -->

### FC-P7-0012 — Make role editing reflect and mutate only authoritative visible permissions

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** RBAC representation / bulk mutation
- **Locations:** `admin-portal/src/app/roles/[id]/page.tsx:229-260`, `admin-portal/src/app/roles/hooks/useRoleDetail.ts:50-70`, `admin-portal/src/app/roles/hooks/useRoleDetail.ts:89-109`, `admin-portal/src/app/roles/hooks/useRoleDetail.ts:192-205`
- **Symbols:** `isSuperAdmin`, `groupedPermissions`, `toggleGroup`

**Finding**

Filtered Select All displays counts for visible permissions but changes every permission in the group, and super-admin status is inferred from mutable role display text in addition to the server flag.

**Evidence**

A search can hide capabilities that are granted/revoked; a custom name containing Super Admin is rendered omnipotent/read-only.

**Why it matters**

Security administrators can unknowingly change hidden capabilities or see a false authority projection.

**Recommended decision**

Bulk actions must operate on the exact visible set, and only a typed authoritative field/identity may drive super-admin state.

**Remediation plan**

1. Pass visible permission IDs to bulk mutations and confirm critical bulk changes.
2. Remove name substring heuristics.
3. Test filtered groups and a custom Super Admin Support role with isSuperAdmin false.

**Verification**

Only visible IDs may change under search; role rendering must match exact returned assignments.

**Dependencies and notes**

Backend authorization remains authoritative.

<!-- FC-FINGERPRINT: phase=7|rule=role-editor-hidden-authority|path=admin-portal/src/app/roles/hooks/useRoleDetail.ts|symbol=toggleGroup -->

### FC-P7-0013 — Fix bounded list truncation and page-local metrics presented as global

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Pagination / operational metrics
- **Locations:** `admin-portal/src/app/storage-servers/hooks/useStorageServers.ts:12-81`, `admin-portal/src/app/storage-servers/page.tsx:15-52`, `admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts:25-55`, `admin-portal/src/app/database-servers/page.tsx:108-186`, `admin-portal/src/app/tenants/hooks/useTenants.ts:37-83`, `admin-portal/src/app/tenants/page.tsx:25-51`, `admin-portal/src/app/tenants/page.tsx:141-275`, `admin-portal/src/app/users/hooks/useUsers.ts:80-137`, `admin-portal/src/app/users/page.tsx:125-171`, `admin-portal/src/features/admin/database-servers/components/AddDatabaseApplicationDialog.tsx:26-40`, `admin-portal/src/app/users/components/InviteUserModal.tsx:39-49`, `admin-portal/src/app/users/hooks/useUserDetail.ts:85-88`
- **Symbols:** `useStorageServers`, `useDatabaseServers`, `useTenants`, `useUsers`, `AddDatabaseApplicationDialog`

**Finding**

Several directories/selectors load one bounded page and omit pagination, while summary groups mix authoritative total metadata with status/capacity counts reduced from the current page.

**Evidence**

Storage loads 10 and exposes unused page setters; database loads 20; tenant/user cards use current-page arrays for subcounts; application/role selectors stop at 100 and ignore hasNext/meta.

**Why it matters**

Records after page one can be inaccessible and fleet/staff/tenant metrics can be materially understated while labeled as global.

**Recommended decision**

Render accessible server-backed pagination/search and use authoritative aggregate summaries; otherwise label every derived value current page.

**Remediation plan**

1. Add bounded pagination/search adapters that consume metadata.
2. Request or consume aggregate summary endpoints instead of client page reductions.
3. Differentiate empty/all-bound from more-results-not-loaded.

**Verification**

Seed more than each page limit and prove later records are selectable and global summaries remain stable.

**Dependencies and notes**

Do not replace unavailable aggregates with synthetic zero values.

<!-- FC-FINGERPRINT: phase=7|rule=paginated-data-as-global|path=admin-portal/src/app/storage-servers/hooks/useStorageServers.ts|symbol=useStorageServers -->

### FC-P7-0014 — Fail closed when SMTP configuration or audit data is unavailable

- **Status:** OPEN
- **Priority:** P1
- **Severity:** Critical
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Configuration safety / partial failure
- **Locations:** `admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts:67-102`, `admin-portal/src/app/settings/smtp/page.tsx:89-107`
- **Symbols:** `fetchConfig`, `SmtpSettingsPage`

**Finding**

Configuration and audit are coupled in one Promise.all; an audit failure discards a successful configuration read and renders editable blank/default state.

**Evidence**

The catch only logs and clears audit without setting a blocking configuration error.

**Why it matters**

A transient observability failure can invite an administrator to overwrite valid SMTP configuration with blanks/defaults.

**Recommended decision**

Fetch independently and require a confirmed configuration projection before enabling save/test; audit is supplemental.

**Remediation plan**

1. Use allSettled or separate request state machines.
2. Render retry/correlation details and block mutation when config is unavailable.
3. Keep valid config visible when audit alone fails.

**Verification**

Tests must cover config 200/audit 500 and config 500; only the latter blocks mutation and neither shows fabricated defaults.

**Dependencies and notes**

Exact SMTP permissions/contracts remain required.

<!-- FC-FINGERPRINT: phase=7|rule=smtp-partial-failure-defaults|path=admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts|symbol=fetchConfig -->

### FC-P7-0015 — Call the public forgot-password endpoint before reporting success

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Authentication implementation gap
- **Locations:** `admin-portal/src/app/login/hooks/useLogin.ts:53-62`, `admin-portal/src/app/login/page.tsx:143-184`, `admin-portal/docs/api/auth.md:96-112`, `admin-portal/docs/generated/admin-core-api-routes.md:65`
- **Symbols:** `handleForgotPassword`

**Finding**

The modal displays the anti-enumeration success message and closes without making any request.

**Evidence**

The documented public POST /api/admin/core/v1/auth/forgot-password exists, and local docs already label the UI simulated/broken.

**Why it matters**

Locked-out administrators are told reset instructions will arrive when no recovery request occurred.

**Recommended decision**

Implement the same-origin public request while retaining uniform anti-enumeration messaging and add the reset-token completion UI.

**Remediation plan**

1. Normalize and POST the email to the exact route.
2. Handle network/correlation-safe failure without disclosing account existence.
3. Implement and test the documented reset completion flow.

**Verification**

Request tests must assert exact path/body and identical public copy for known/unknown emails.

**Dependencies and notes**

Depends on the public auth recovery contract.

<!-- FC-FINGERPRINT: phase=7|rule=forgot-password-simulation|path=admin-portal/src/app/login/hooks/useLogin.ts|symbol=handleForgotPassword -->

### FC-P7-0016 — Remove synthetic identities and notifications from live operational chrome

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Mock data presented as live
- **Locations:** `admin-portal/src/components/layout/hooks/useNotificationDropdown.ts:15-49`, `admin-portal/src/components/layout/NotificationDropdown.tsx:52-108`, `admin-portal/src/i18n/dictionaries/en.ts:48`, `admin-portal/src/i18n/dictionaries/ar.ts:46`, `admin-portal/src/app/dashboard/components/DashboardHeader.tsx:43`, `admin-portal/docs/DOCUMENTATION_CONTRACT.md:107`
- **Symbols:** `notifications`, `unreadCount`, `DashboardHeader`

**Finding**

The navbar always shows three realistic fictional incidents and the live dashboard greets Mona Ali from hard-coded dictionaries.

**Evidence**

Mark all read changes only the counter, View all only closes the dropdown, and notification read fields remain false. The documentation contract forbids mocks presented as live data.

**Why it matters**

Operators can mistake demo incidents/identity for current control-plane truth.

**Recommended decision**

Integrate authoritative notification/user data or render an explicit unavailable/coming-soon state with no realistic synthetic events.

**Remediation plan**

1. Remove the fictional identity and use the authenticated user or neutral Admin fallback.
2. Wire notification list/read routes and permissions, or disable the feature honestly.
3. Add bilingual loading/empty/forbidden/failed tests.

**Verification**

No synthetic operational row or named person may render in live chrome; source-backed states must be explicit.

**Dependencies and notes**

Notification route availability must be confirmed after FC-P7-0001.

<!-- FC-FINGERPRINT: phase=7|rule=synthetic-live-chrome|path=admin-portal/src/components/layout/hooks/useNotificationDropdown.ts|symbol=notifications -->
<!-- FC-PHASE-7-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Phase 8 — Evidence-Based Improvement Suggestions

- **Phase status:** REVIEWED — 1 OPEN FINDING
- **Admin Portal scope reviewed:** 328 / 328 files
- **Open / resolved / false-positive / accepted-risk:** 1 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Status |
|---|---|---|---|---|
| FC-P8-0001 | P1 | High | 5 exact | OPEN |

### Detailed findings

<!-- FC-PHASE-8-ISSUES-START -->
### FC-P8-0001 — Create one reproducible Admin Portal verification gate with risk-focused interaction tests

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** L
- **Category/Rule:** Quality engineering / release evidence
- **Locations:** `admin-portal/package.json:5-12`, `admin-portal/vitest.config.mts:1-14`, `admin-portal/src/app/users/utils/__tests__/errorMapping.test.ts:4-39`, `admin-portal/src/lib/api/axiosClient.test.ts:197-225`, `admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.test.ts:20-62`
- **Symbols:** `verify script`, `Vitest`, `contract tests`

**Finding**

Current scripts do not provide one release verification command, and existing tests miss the controlled races/error states that produced the highest-risk findings.

**Evidence**

The independent gates currently fail for different reasons. Error mapping covers only three English cases; idempotency tests assert merely that a key exists; Backup guard tests are single-context.

**Why it matters**

Without one reproducible gate and adversarial interaction tests, a source/build success can hide contract, concurrency, accessibility, or documentation drift.

**Recommended decision**

Add a verify script that runs clean typecheck, zero-warning lint, full tests, source-aware docs checks, dependency audit policy, and build in a controlled CI environment; prioritize deterministic interleaving tests.

**Remediation plan**

1. Repair existing red gates without suppression.
2. Add deferred-request, 401-retry, cross-tab, storage-throw, partial-failure, pagination, RTL, and accessibility tests tied to open findings.
3. Publish CI artifacts that distinguish source, authenticated runtime, deployment, and release evidence.

**Verification**

One documented command must reproduce the source gate; each critical/P0 finding needs a regression test before closure.

**Dependencies and notes**

Build output may be generated in CI; this report-only run did not create or claim a release artifact.

<!-- FC-FINGERPRINT: phase=8|rule=unified-verification-gate|path=admin-portal/package.json|symbol=verify -->
<!-- FC-PHASE-8-ISSUES-END -->

### Verified clean observations and false-positive controls

The phase used manual semantic review plus applicable source/tool checks. Intentional fixtures, bilingual structures, backend-authoritative guards, and unavailable metrics were not reported without a concrete defect.

### Phase remediation sequence and limitations

Apply each finding's ordered remediation and verification. Source/build evidence remains separate from authenticated runtime, deployment, and release proof.


## Limitations and Unverified Areas

- Whole-repository inventory is canonical, but semantic review was Admin Portal only; 1,098 sibling/root files remain pending.
- No authenticated browser, live Gateway/Core/Worker call, Compose runtime, deployment, registry, or release artifact was verified.
- No production build was run because typecheck is red and Next suppresses type errors.
- Installed affected dependency versions are confirmed; every advisory is not claimed reachable.
- Environment values were not copied; pre-existing package edits were preserved.

## Exact File Coverage Ledger

<!-- FC-COVERAGE-START -->
<!-- FCFILE {"path":".agents/AGENTS.md","sha256":"68e3365e9bf98b264d5c4104145343c5f327533d8b420c8d9d54ac9decfdab4f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/agents/openai.yaml","sha256":"2b9b26105c40002fc05380b381a8a680fe98d943bd4486dd874954fc83e70892","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/assets/APP_CHECK_RESULT.template.md","sha256":"889fc887f9d2ce593331af041c7b4613f21d2ab9a5cde5db43b8bc77278344e3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/audit-methodology.md","sha256":"111a22417f4a633947086af01d48cf21ffac762863a7bbc3716cd3f39fca0a61","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/phase-checklists.md","sha256":"71fe9213c6e6bf2cad4d302f696c655cd9a2e10651d7df88655a0caae0e090d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/report-contract.md","sha256":"3b5a8c9478d21b007b61728c4bccf671d59848834d11a851a348b0aeda81fdc1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/tooling-guide.md","sha256":"51c6b70780e3cb8a686026b53337d3ad3031ef86eeb5c625f3e3ca188e190417","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/scripts/frontend-checker.mjs","sha256":"732691787e2981d9d064b04452aa0e90a578f0756505709447a03f953e579ad6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/SKILL.md","sha256":"5c4cc21c557dcf1b37e20a40b66ae11ce2acd3670808163b8cfadcccb935f18d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frontend-design/SKILL.md","sha256":"905a9484d42c6b9adb256bb26dd579e12525eac2a113dd11f2c29aec3cb3debb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".dockerignore","sha256":"181bfe28a53fecee510f7451a1fbde752db908cc436652b7337f23c75b22e382","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":".gitignore","sha256":"13829bbedd438e5457934f66356031d2d1d5719f7d5bc6356c9e51178cf86d42","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/.agents/AGENTS.md","sha256":"9cf40b7fbf84c523dc508140181c67234c856ee4aa9571eb0065e0d4a4311540","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P6-0001"]} -->
<!-- FCFILE {"path":"admin-portal/.env.local","sha256":"4d4cc6ac1d559ebad57ec722a56418403d54357af3a9b442ab69cc92cbd21bc6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/.env.production","sha256":"40ca9b967f16817ac6af50da8526c6900f59ac6aaa7c32e38f875e9f23d8b09e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/AGENTS.md","sha256":"48e33dbac49730d7d2b152f45312fa8bef176e6bdfaee6bcdc120d01f7566ee9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P6-0001"]} -->
<!-- FCFILE {"path":"admin-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P6-0001"]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/FEATURE_TEMPLATE.md","sha256":"784b92dda2ccf7bdef3f89ca1f4f76cf8c3eef6c8431a008f0ca8078719dfc0e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/GLOSSARY.md","sha256":"8a3430ce12fe0ca2799cf4e5f55e1820d859fbb1a2705ead277a0e4a370ce5ea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/IMPLEMENTATION_PLAYBOOK.md","sha256":"0ad7a748b7fca785fcad77362cf7bb3b26187756ea1c444f81c32053e56e7e54","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/KNOWN_GAPS.md","sha256":"c56bc646be9f10df4f19d2c1ba8a1914ae6024f83b29e9b02e881aaf0156a2f9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/PROJECT_INDEX.md","sha256":"c70bf8fa52caf746ba8e23382bb9c65863314343a7686f89311e576412c39f3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/README.md","sha256":"955b8f76f4711140e802c767f1533d22dc8b09822642da90e47f3a679669c93e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/SOURCE_OF_TRUTH.md","sha256":"e94180539711d6aa0960ed0c790f07e3d4db18f9c7fb7f05c83325f5f076645e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/START_HERE.md","sha256":"49e8bb7536b74133e8f0a0b2e88adc06af002b1948089088312fd7b817266089","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/SYSTEM_CONTEXT.md","sha256":"4c90c337bcecf8345905b8027b373be7c9764a9606df217bb02c5a6b0a08757d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/TEST_MATRIX.md","sha256":"e055ae94f9db1a4d2710fa212cdad183e5c156a4dca24d929a58e873f41f8edb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/auth.md","sha256":"0033a3810ca9a1705313c5700a1b21bbd03233663fd5aeaef74a16b6a1079ec0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005","FC-P7-0015"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/backups-restores.md","sha256":"93dd7e0625ac88d324e20276ac77ea06deb65810a0bab3fb1a5ffaf100d578b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/catalog.md","sha256":"6da11c4cc68a2305b519e779d97950363e59e59545e8ab4a5553854aa2a0ffca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0002"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/control-plane-audit.md","sha256":"f2b98bf0ae5b8a69e9ecb2a4510bd92a3b60aca7970fb57aa683abf9590dc69f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/dashboard.md","sha256":"52b0473017c5e180a4d3542d17f6bf4c6d9a1e00c55e8751a6e7bc84e7b290e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/database-and-application-catalogue-plan.md","sha256":"e9f74eff4e21fe8d66e01a66d37ba4bfdc9ed32920996dae372b976b7533793d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/database-servers.md","sha256":"dff7322d47027066ce04d66f38228e479049cf67367056096fbafddf5b91c34c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0003"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/invoices.md","sha256":"f11697583066f1cda60c7afa7a407e526e742271bbc73e59ad19ef7609d03061","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/logging.md","sha256":"8484db97843b16884b3e9a762725c5a8ef251e9bbb11be0b69e1d9c02ddbadf3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/notifications.md","sha256":"35f1bcbd0667a3af849b18e60e4feed01580a41c3d16099afeb3de63cf8dd4a5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/payments-reconciliation.md","sha256":"f7483540948ca77e9046fcb119b78436e1e61a2ada5baac4a2842f07c35b8499","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/provisioning-governance.md","sha256":"fb6863c1947ff226ec15886e2b784201e65aaf4177008d42da79cc30148dd104","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/README.md","sha256":"d065d0675a3dc89c3b267462240e1736cea1816b8788b0f2f87e05e1ec7f96dd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/reports.md","sha256":"8c2078e172fcde53eb4b961bb79796560e2f911f075a1349ce3c4bdff64f4cbe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/roles-permissions.md","sha256":"b6a012d2b84f398f6ee1083ab16fbb473ecf6845997e6b17b5857f3041d12a8b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/storage-servers.md","sha256":"650f2388590cc39d35a2a25d0f5958480cd474b4d347d4b5d6825b5cf88731c5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0004"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/subscriptions.md","sha256":"c60eddf8e2a8af2749af38f11b7bc19d81a44fdfb0dc277cc6de4066d98465f8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/system-settings.md","sha256":"61094d6180c1d541fbbc2d050bb52f79e1ab3c79bd35550b7df9a154a4788115","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-operations.md","sha256":"082197dfb1b39476c2d4e907ec930335d9b3f86371d60fdedee6e6434a32a9a8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-storage-migrations.md","sha256":"dd32332c87a555b94bc574f63306384d7cab8093822aac288178bda980851d05","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-users.md","sha256":"5a66ad5b4a3d794ac7eebe51c88ae655df39aaf7a516fda3254fe759b14adb83","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenants.md","sha256":"d935175c67b02af45ed5d9c1f0307066a51f69753636cfa967fd3798a4a2be93","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/users.md","sha256":"47147106a5c5186aa252da98cb8ac753e9f9c0555197ff75a71c0ac97c6ebca3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0002","FC-P7-0004"]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/wallet.md","sha256":"ed78f2310e8981e92af3a4874341f4619846ba6f0b1a89c5f60e326728b9b042","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/architecture/http-and-error-contract.md","sha256":"56342d2b0e518e2dfb0bd8532daf8c8e624019430ce919857ff6f775dc50ea1e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0003"]} -->
<!-- FCFILE {"path":"admin-portal/docs/architecture/permissions-idempotency-and-state.md","sha256":"8a2b0fde2f2879f1333d01ef2e013d5d8d4aa5049eaab4ac6c00e925ef5bb7f4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0006","FC-P5-0008"]} -->
<!-- FCFILE {"path":"admin-portal/docs/audit/documentation-coverage.md","sha256":"24a141369b0541d955bb130a22b70da020b3377ff2954df9d557468b41df144f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001"]} -->
<!-- FCFILE {"path":"admin-portal/docs/audit/frontend-capability-matrix.md","sha256":"6a66ae9f51440cd375516adc102ab4c108b57b0b4b6d81f4194dd3eb460b25b6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0004"]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/audit-log-viewer.md","sha256":"e8625f37af95c992363d99ec53aff63c9d22d47d6a30a4e1f615f3d8b05a23b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/confirm-action-modal.md","sha256":"da19ad2900377be04127204af6ed58d2d0e4c73177b2bf8617cb57efe97d8097","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/data-table.md","sha256":"79203d2c6fb8aa870f58872de4a5badb08ba967ac8173f692722e06793519d4d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/filter-bar.md","sha256":"7a5cd87087700fe5b034c72556ba0eb468bc1ae83d15e3f873f9be1964439a97","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/floating-webphone.md","sha256":"494a5c9effd3564a85152785646099d7971f6e9ca9c92491870e003178a4c164","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005"]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/form-drawer.md","sha256":"c3d5d788d1dfa9464509244b7cc8a91c6d5f0e70a36d736d3255c83ecf2872a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/operation-timeline.md","sha256":"4b5318a00e33afffd27638e6ae8ad457f91413a6b0b66ad8dc68fca810d06847","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/README.md","sha256":"a2aaaf5fb8d97be35d24a57915e9a96504e1a2655e38735c8766ea158fd5c495","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/status-badge.md","sha256":"10a9a98f8c432c7bd2840b44b1b5c54028c31f83fc6bfb42aaa4dd0aebf487a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/storage-server-modal.md","sha256":"69d084ef1e6dd2aa63df48f87217c037d61bee9753f9e1fcd11e240992473a3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/DOCUMENTATION_CONTRACT.md","sha256":"6b35f8736a197015db91f50696e571becb9ae78b028bcf272e4fd391ebc033af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001","FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/docs/frontend-integration-guide.md","sha256":"1b6010bb3051c5fb7cc6798320d2d1714871911551f48f2953ca028ba7e373b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001","FC-P7-0004"]} -->
<!-- FCFILE {"path":"admin-portal/docs/generated/admin-core-api-routes.json","sha256":"36cc363f1298699150ec948ef398f153c6d4ecb39ccbcaac1e4f1e843f709544","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/generated/admin-core-api-routes.md","sha256":"c9af7f2a28ca2ed6f695abfaa438f9134294d74369746cf562eb9c4ce276083f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001","FC-P7-0015"]} -->
<!-- FCFILE {"path":"admin-portal/docs/guides/sidebar-navigation.md","sha256":"a4ed26b8cbf741cc5f0949a48abe29623332dccd7db456ccf34e5e51f456ef87","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P6-0001","FC-P7-0004"]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/dtos.md","sha256":"fda804c3bc5a2c98e7fc2d18bd5aa6f72777f2a44db7c6a97a95c0211d8ed914","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P6-0001","FC-P7-0002"]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/enums.md","sha256":"06b938bc4d2b15d768345ead232543d9cadbefebf1afd468958845e14b8d2f55","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/interfaces.md","sha256":"a48679ff5ef59437e3693dfdf9fbc58285c6164d40ad5c7bbd70075d0ca3b873","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005"]} -->
<!-- FCFILE {"path":"admin-portal/docs/rbac/permissions.md","sha256":"cb2a8a1b66fccf79e7dd9b5d1b84e472f01ea5bb882ffab738402e2779f80ffb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005"]} -->
<!-- FCFILE {"path":"admin-portal/docs/README.md","sha256":"4ce08434d0dca77dca82e00419c156ad41f0c86315ed7f52249eecb9b047bcf1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001"]} -->
<!-- FCFILE {"path":"admin-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001","FC-P3-0001"]} -->
<!-- FCFILE {"path":"admin-portal/lint.json","sha256":"f0ed985892917e92e8d0a919f6768054def2dbd3f9cdf077bbde9ee943193133","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0003"]} -->
<!-- FCFILE {"path":"admin-portal/next-env.d.ts","sha256":"7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/next.config.ts","sha256":"66bdd7211a16268234554eecb5169a3c6a591f4456193741907e91540e1ea61e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0002","FC-P3-0005"]} -->
<!-- FCFILE {"path":"admin-portal/null","sha256":"47c0271057a5529504e8ed423f3569ba912fe77750023e92608ceae89d72a6a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0003"]} -->
<!-- FCFILE {"path":"admin-portal/package-lock.json","sha256":"0a537115443d90c945ff7ff2ab8fff3935d6dcdc22b3274605383509de224c12","mode":"structured","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"admin-portal/package.json","sha256":"c9ba3742372702e06d63820a9de7b56e157ec3f7763bb43ee19d96149d326ab3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0002","FC-P5-0001","FC-P8-0001"]} -->
<!-- FCFILE {"path":"admin-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/README.md","sha256":"cc5aacf8ef16b1274e6a05e80c7a4938c444d5b7dec81c90aadcca0f338bed19","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0005"]} -->
<!-- FCFILE {"path":"admin-portal/scripts/docs/check-docs.mjs","sha256":"468c181b3a3b5e19fb4fa388b2829c6d693464db48d2d83a4b9882586c05a18d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001"]} -->
<!-- FCFILE {"path":"admin-portal/scripts/docs/generate-admin-route-inventory.mjs","sha256":"a206aabd812625dc1d1fb7e48a1ff62bd37d2e5da379950d37e822bf01a16f34","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/__tests__/catalog-contract.test.ts","sha256":"221332c8c3933ded1f550c0cc4e7400ad64d62c53ebd2e10655167eec09b2103","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/__tests__/database-servers-contract.test.ts","sha256":"1842fcc86b921152804246850c8285f9b10263d322ce912923e20895dd155dff","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/[applicationKey]/page.tsx","sha256":"a0d5a2e982c961ddb8255ad17df7a62cbd306e3a7c1eb5acedd0107fd6b7ba09","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/audit/page.tsx","sha256":"ae8d52bfd2f12f84a3320a6cc29e772ef6edcbc1c2e218375adf21a91024f860","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/page.tsx","sha256":"a1532f2605a36fe6a8c333e8aba4f3621f6b9d2e7b780a2902b41b193a756a48","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/access/page.tsx","sha256":"bf3b419e4896d76f9da76be95d90b29634b82f5256458227541ce2781cbd619f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/artifacts/page.tsx","sha256":"4169c00b31a07cd50909566851ef09ac6f4f75e86e080f317172644782f6b4bb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/layout.tsx","sha256":"2efb7f567709ede3a4ea919769db4cda2a0648cc56ee1b11d319612dc690e975","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/page.tsx","sha256":"e721174d50748ab453e1ea7ac616af0a0411bd281723500c448ab2ba1fe744a9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/policies/page.tsx","sha256":"6e8f1c9234cad4c0837475fc55a1658e2288aa750f8875b5cfbd6b2ec47fdf9b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/restores/page.tsx","sha256":"eedb26b5db187ec5e13cc7389fa45b7847f4dd369b524d9d97c6fe272b64d770","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/runs/page.tsx","sha256":"83b463c2045395936d426f3701b7f66edb33d4298d545d50e68f7aeb1d271917","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BaseBarChart.tsx","sha256":"0c4bf6362ddab6e7af3f2711a8ac73985868e780abb9ae9346576af8bcccf528","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingAgingReportBarChart.tsx","sha256":"91c0aec7287e0d189b630853ed295db31ef8b4789cf1a83311d6521b71ac7cd2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingCashFlowComposedChart.tsx","sha256":"31987245dc655a7d9b2cdab6492fb35c47faf2ed40ad01057b19e9aa56c7e62b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingChargebackTrendLine.tsx","sha256":"b5b4f25f75fb472fe76e7dcfa9df269f4d28c787d7fe041dc9e4425c89577e26","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingCostBreakdownTreemap.tsx","sha256":"55e46c4c4d2c9a231b2166da42964a894dba331410755aaff57a718f7908a984","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingDiscountImpactWaterfall.tsx","sha256":"f3e92143d5a7fe9f8f34b0b3c491077ad087f185a86a18b3d3e395620060a647","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingDSOAreaChart.tsx","sha256":"4747f5632cf3542788c91c4144aa895551aa6845103b71bce6e22c16aaaffcef","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingFailureReasonsBarChart.tsx","sha256":"6ec3b74f92cd58c56f83d0f46f4e0b03ce33e2ae5a8eea005d91625be0484996","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingForecastSplineChart.tsx","sha256":"e8bd058454534a0bc68de7cf50c8cbbae41e84a9cec0c167d06c192fbcffedc6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingGatewaySplitDonut.tsx","sha256":"feeb66e54dc94f87d6e7189e82b4d27159ee298733f90e068504b30064fdbea4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingInvoiceStatusPieChart.tsx","sha256":"e20663fcdcba648c85b38b78563739b08481cfe78b52faa52eddf8de450e9a2f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingRevenueByProductRadar.tsx","sha256":"d3ac2e2a5e170bf4e98cd060e96cf39a6a29c3d23d82f425b3329dd04b662ed3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingTaxDistributionPie.tsx","sha256":"60624bc1cbe0dc49e800087904a4ee870daba590da966947c1d4f515ac3a6ba3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingUsageOverageScatter.tsx","sha256":"05202243c5fc1340cfa85d562b1cf4eacb06dd204f8a741646d121544051254b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ChartTooltip.tsx","sha256":"285a69e9acbc9f98a9e955072080be550ba7d313a59f2de16dfe4af0c973e941","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/CollectionGaugeChart.tsx","sha256":"45b2797bc2da3e89c5066c1fae8d300b65d6720ce644bf05f68262304d6c10b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/DomainHealthGaugeChart.tsx","sha256":"a84af290a93eaa9819a85bd2b8cf1051aeb1dd3df21a9160da16f8354fefaec0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/MetricDonutChart.tsx","sha256":"062a8f583fba0c7ffe4f54a1f8839480a83ce6fabb320bb68f39a9662359ba11","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/RegionalDistributionBarChart.tsx","sha256":"45c17f4b82fd7692dd61ebfee8fff826102a284f4431cc65beea9365442fa234","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SaaSHealthIndexGauge.tsx","sha256":"dc009c36c9d871b888fe2e3b95237f4a1dc04b598b0fe9b253996440b22c0e57","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ServerCapacityChart.tsx","sha256":"614acb864952f0496f62d996f4550120dfc1db8b73dc22fe09b09a0f22cca636","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ServerLatencyScatterChart.tsx","sha256":"00a32d6b3ce33850c99525e743da6b407d1a0734aaf37988437718644100eb71","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SparklineChart.tsx","sha256":"1e95e18dbc3510a4c45e9090258644a1c0a6d50a14741126e9773ee4dd4a622a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionARPUSplineChart.tsx","sha256":"1af784fdda9a4796dbcf62c5b7c78ba2d0a9b78b5731acf8434e8ae9270913f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionChurnComposedChart.tsx","sha256":"846053950b4007ef4ec16996126e3a58fbac411644c76b0d1f1f7162f7123cb2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionCLTVRadarChart.tsx","sha256":"f07a9210f6844be2de5e4d187bd1562a8d749b22d37b64cd8c2edd35d82df7d2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionMigrationWaterfallChart.tsx","sha256":"ade7401dd357ceddbbc4522b8eb31186aa0beb506a224dd82a0b1161d7d11f43","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionMRRStackChart.tsx","sha256":"ba79429e5a3d2fea4e567cfd33d5fea8906cc4c9b0a9f0e6fc1ba675ddff5e74","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionPaymentPieChart.tsx","sha256":"135d54f9f47f5dd70f4a523ea1abe496de3d4203cd48ac46b0706c2f508265e9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionPromoImpactScatter.tsx","sha256":"88ed28789476963e56939a0f3a9f90350c920e7413fe69dce086d7f33d47f432","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRenewalsBarChart.tsx","sha256":"f2fab8766166e8352ed70ed74b1c6fcd8609c1cc01c9a4904de08f74e77f7685","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRetentionGrid.tsx","sha256":"badd502cc649490134695b77e4b8641cbea56937a3df79863c2e3d39558f9e08","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRevenueStackChart.tsx","sha256":"5d4f9031ce490fc1971e26c226f1205a13da6dc84a2f82efee2f45c642135d83","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionTargetGauge.tsx","sha256":"7b08c204d57548bc8ee1480b66e2afd1a342de57d0ae1cd21b562421e9df6712","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TargetVsActualBulletChart.tsx","sha256":"a3ef4de236591209bc9d09c8be5eceb37d4124dac3250b0f70811b9d1a76b0e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantGrowthRevenueChart.tsx","sha256":"a2ee25b90910f3e2a2465cbb55f900da17d19f86550bac5ffdaef7695a6af228","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantStatusDonutChart.tsx","sha256":"48a803e8b3b980c44c41d12b20ca1f104deae2dba74c56095bede92d0de4ca11","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantTreemapChart.tsx","sha256":"f714836991943e79416311dc0808fb6731ed49d581ca5ab211a788f891d3a0d4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardDataState.tsx","sha256":"d27a2fc457dd15c56dced56f35e8dfa92877d418239eb69af8678eaddc3ddc03","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardGroupPanel.tsx","sha256":"c2ef22e0ce726b7fbcba7c864a3355989de811a61972db0e4cf136b6c3e4c2fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardGroupsOverview.tsx","sha256":"8e51967197a1d2aed6f2f08230096b663f706fdb380fc1883a11b64e0cd21319","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardHeader.tsx","sha256":"afc29d09eed6ccf71736901a8b8dea7e8fd642b60c6ee59d7af169cf71d3ea18","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardTabsNav.tsx","sha256":"e56697849ba985ec57a6a555d3aed1102961949fb34d0896ce0d55d327ab9a08","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/KpiCard.tsx","sha256":"fce59bcce28030ed4d72c320b83687fed0e0e83451119ff41eecf6c580bd33f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/hooks/useDashboardData.ts","sha256":"96852df8cd25c9de813b25e0f6e45e18b500f2c294e9851686a10e807711b26f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/page.tsx","sha256":"a188f7bab6cadd7b9ab993bbb796450f19c97712439da4756b1e0a4d4338f42c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/dashboard-groups.test.ts","sha256":"0e8ef9e649667b4847fd04b624ba588b1c51935f5ac5712791dca5ff77f7f635","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/dashboard-groups.ts","sha256":"a2c0be23f0c7cc010e786ea049f42b5dd2f5c85187cdf2283e209cce5191eae5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/formatters.ts","sha256":"7d02e6cc575081f78907daaab66929830b08af2e6d5dcfdae096f02683171173","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/[id]/page.tsx","sha256":"da35ab58ff0e4de10dc6b6927e2a91cddda487f634c2b29b9eaae5439c91a938","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/new/page.tsx","sha256":"3f6688faa67dab20acb09c96f8ce85537b0f6a387fa877a04438e5e8ec6f1271","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/page.tsx","sha256":"3aa05ccd7b60104ecdd74d43c258bb0b8cc2c1b2bd888297a0fd429d4e56c6b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/globals.css","sha256":"0f352371f98323b84357d36bf3e0a5bfbdb08308e54f726afb6c619f8feb9152","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/hooks/useDashboardHome.ts","sha256":"9e4883665ccb4f9f6cc1351bc3da9a8259067a231f17c5e67f5a40857a5ee8e2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/layout.tsx","sha256":"2b9b16d90244cff6cd28082c0f68377f00948b40917b187fa03312c954a5d2fc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/login/hooks/useLogin.ts","sha256":"d780133e510cea12d2998a39e88b91a8218a16681d575f0a5715b416a94d4d81","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0015"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/login/page.tsx","sha256":"6d71a0aac82438439cf686b24fbee35eb3dc56432d36b5eaedd459afa731e214","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0015"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/page.tsx","sha256":"832b647cd752da7f0ad0313ca426a04bfd851d972467bb003294a99b4caefde7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/profile/hooks/useMyProfile.ts","sha256":"8029b29881a2da6bcc47a3869cd239267aee729e9b60fc463c3f6b4b16dc6a2f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/profile/page.tsx","sha256":"a50a3eb8c6aa6b2122c6de83f75939165fccae266e3eaee6af578dba7baf2fc7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/[id]/page.tsx","sha256":"2dc738f179c43b21bd8aef2a97f0685fb6ae8f6a835d71cd334b6c979c935024","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0012"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/components/CreateRoleModal.tsx","sha256":"41a5f110ad59ca245428d6d58b6913c805fd088c09aaaf94a79141aee471dd41","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/hooks/useRoleDetail.ts","sha256":"75d769dc2507ab38e2756c75b7fd9f75c23e4cbc191965183f94be64db43068c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0012"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/hooks/useRoles.ts","sha256":"dd0d9ed610fca741b826be2e0782c34299a7e030c78636dc8acd23c5a9200b3c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/page.tsx","sha256":"462b5172df319d019b9d3b5b4ec1ccac59a3ce607950583a9f12168d499629ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/asterisk/page.tsx","sha256":"685a3678afad207ebbb2a9a3c4b6a32b00bad1b012618792375b06a1002e4263","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/auth/page.tsx","sha256":"bb475bcf0fa8d8ae94e7e277e8e9b3d16adc556bd029a7d2f503e9b6021eb01c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/components/CurrencyRatesSection.tsx","sha256":"414463060d0cb9896f5a8d08dd619821ba2291113f7f10746fce7ec38a53941d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/hooks/useCurrencyRates.ts","sha256":"cd8403f05b1fede1f1001dbc752c399a5b60600171cabed7c668b315e2731abb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/page.tsx","sha256":"cd60f29100dab85387005f5b6b67ec7ec65421638a5c531a8e04fe8d13e0f79f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SaveSettingsBanner.tsx","sha256":"d6a082443a12cbcc46b7bc07cd7425c6b1baa4b07be5038c0cb255fd6307a3a9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingField.tsx","sha256":"f2e9ef095c039a55549f602b8afb08bf8fedd74caba20ed7b613666095561019","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingSearch.tsx","sha256":"f199ad4539998ac788725cd69f2cb6c52716e272e7150e28228fa486cbe54ad4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingsSidebar.tsx","sha256":"ed6ec5e2e5facca9be3ff0cddf1ff9d9f53ac3c25106c194dc021394ca59ed59","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/hooks/useSettings.ts","sha256":"519b95ede98476868fe666606a1192d2457c367689da6c472c2ddd26eb2bfeb6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/hooks/useSettingsRegistry.ts","sha256":"33e6e626ab29742305fdd488ba69a7c63400e453fb36395d010318add536d8ca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/layout.tsx","sha256":"8cbf5bccb5a03e3532154fca359767b2c7864b6317f5089d47e30a2348c4a271","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/notifications/page.tsx","sha256":"8868904550334083990bfd0109a8be501b11134ea72eed036d42aaadb2c43b8e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/page.tsx","sha256":"bbfb622d355fa352f993efced409c3a7a39493ed9933f23f2308e99f8da4cce9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/platform/page.tsx","sha256":"59bf1df050ec7cbc1874f8d908cc9a65960ef6734e996347494fd3fa07817fa5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts","sha256":"1f3c801a74b9a3e8799649f262e053f39b98bbe25af460fe6a70926967e07a47","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0014"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/smtp/page.tsx","sha256":"2764f4cecbb8e866ba1863be8933e82446774bd27826892b32c6bf3ba9171b99","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0014"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/[id]/page.tsx","sha256":"544f8d7531c5f7a60a4fdec307470d4b3c87d942c325d29c77cae715f2b1518b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/api/storageServersApi.ts","sha256":"abef1f8bde6cb40dfa1bb0fef707900014a340d21b249068415d21dc06c584c2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/components/StorageServersTableSkeleton.tsx","sha256":"25be38d355c67283f568d4302226d0713cea033d5116f076f1020d0f628bc028","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/hooks/useStorageServerDetail.ts","sha256":"410d686b03ff12974ad685085d63576541107bcb80bff203df0155183637b653","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/hooks/useStorageServers.ts","sha256":"ac8667233d39d3e1132f84eccc7aebce2a85312e53d5b97ed22a38c732705fb6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/new/page.tsx","sha256":"0abba95364fdd0c9a966e605edf1cdc98b26ee70997cc19fe50d89aa5624bd37","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/page.tsx","sha256":"d2164bba65689daea0901dd7c33b2ea1c3095ca9b93d38095c8287b130658feb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts","sha256":"1d265f5cf0c2f3e727bba7558835672f11cd26c68a08e7e54e1afcb88dbe9d45","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0005","FC-P7-0006","FC-P7-0007","FC-P7-0008","FC-P7-0011"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/[id]/page.tsx","sha256":"707b98b4275a640debf3933af8b3ea3010d175b7ec335ab8e025d58659c17d8e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0002","FC-P7-0005","FC-P7-0006","FC-P7-0007","FC-P7-0008","FC-P7-0011"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/components/TenantSummary.tsx","sha256":"3c0f861b3c0376fd4b2bc6ce0185dd5bec6c9429cba5cf6f74ba0795830a8a35","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/hooks/useTenants.ts","sha256":"b6394c2acd6dca4c32bb3fcac442602221ed01b71b1754ec7c0837ae9d5f6c04","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/storage-placement.test.ts","sha256":"45eceafd4407c5aa989563c47fa0f6109839f04e9040c0c285721add16d7fd33","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/storage-placement.ts","sha256":"d1ff6a5e714f01bcf2f41d167189a8f7d3e47499a436d7b3bbf5c84d4be082a5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/tenant-profile-update.test.ts","sha256":"32f8bec5bd2678e983d3dad101c5ebec9203649ab1261e8dc178731838791638","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/tenant-profile-update.ts","sha256":"15617233e6f8d7c805af1d54be7fa50b78cecf8d8c4a47fd030e162b6fef4117","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts","sha256":"28233baa74a0ca3f1b95fcf8ddf67b467973ba91577163993f2e9dfa9e6d2023","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0009","FC-P7-0010"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/new/page.tsx","sha256":"8832dfc06d682ca7f726235c2609b458f0ce12f2133a23a30339bdde36cf488a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0009","FC-P7-0010"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/page.tsx","sha256":"eec8d7dc9244fb57fef4e56ca43fc5477a7baf9ab3d9d4ab65b3d60729f6fdc0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/[id]/page.tsx","sha256":"d5f0ba0a20e3d2a1c0ee9a63ad1e978e03c5f8a441bc60ce21a7f189880e1122","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/api/adminUsersApi.ts","sha256":"8d1c9ac544fbd1bc95c7355f35afdd296d102919b11fe2b89ecea90e5544455e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/InviteUserModal.tsx","sha256":"b61c6a6248aea37db64b47fbe2ad3517ca2c65d3d05c4775050de3787fc4a6fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0005","FC-P4-0007","FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserMetadataCard.tsx","sha256":"93ddc09274e6d33b825bf624dd0615949b5ba97bf2f47bf43bfde3451d83537d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserNotFoundState.tsx","sha256":"7eef6796ddeb1106b72b957bae56bf4ff2ad531ed503534dfda8a15db85d2dad","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserPermissionDenied.tsx","sha256":"171289873f93142b985d593724ba47b06e0e2f9fe82596a14f0ce4e9c01d9078","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserProfileCard.tsx","sha256":"cb9df8d66de2450a28c78438d2ecc2db7a67808a89ea9b57e4ac3e13d377aaa2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersEmptyState.tsx","sha256":"c8ff3144aed3c65ce9c6d413a63f4baa98eb51ed84b5a0739516229209e298af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersErrorState.tsx","sha256":"e17c10502897a73a26a0a9d401f0f91c4775e9296f40ac67edcc763bff83fc64","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersPermissionDenied.tsx","sha256":"b373a6e3487f5504aa24189832a49d61d24bea7414beaf7efba54128aa63cac6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersTableSkeleton.tsx","sha256":"ac297733438df923aa4301e0a28161d25d78d328c845de911a7307de2a8d9fa4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/WebphoneSummaryCard.tsx","sha256":"c3aca9bba26d5e13f8a2beaf6e611824863b3c20a461b38a7f38aba3b9cc1458","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0006","FC-P4-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUserDetail.ts","sha256":"7248b54d59048ff8013dffe20428f773a8325f154939686a90cb3d1372a77f56","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0007","FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUserPermissions.ts","sha256":"a7f57b8e59c76a933d50e7108009fde29545fdafaa1d4648634e9a66fac641f8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUsers.ts","sha256":"25944a035d10a2ae277d8c77cdb636857e29f5b45f8c7e725da503bc1f654394","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/page.tsx","sha256":"6096b6bc113b0346d2007663fe27d4bf3f40495d1d9adca175fb9a5125f2c235","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0005","FC-P4-0006","FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/types/adminUser.ts","sha256":"b63e070ec13bb93888488fb52c526ab7545892335dbc67d8e77aa11c573230a1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/types/index.ts","sha256":"6ddfe9146c162e87c1fbaaccdb3fcdaa3698b0f6283550527e8932fa6c9a467b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/utils/__tests__/errorMapping.test.ts","sha256":"6474b5e835cb5fee012d5e0646ed0d48b9b3ddff1238faa8b2d88aba4ef4e92d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P8-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/utils/errorMapping.ts","sha256":"1de9c8ce1bdee12072f84bf5cb2b33739d45b2716b89532ebab0b59a8ffb11a6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/auth/AuthGuard.tsx","sha256":"dd954c339a86440946ad989ae22b0b83a2873da9a356b0d8f1ebcf7de2ad38b4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/auth/RequirePermission.tsx","sha256":"bfc6cd936bcf724ab833a13b1a7c4f8e595db7a7d1b7ceafb6c434ddb5a749c1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/BrowserPermissionsModal.tsx","sha256":"54148deef717475d1a37b959bbc7aec367cd75fc2ea643932fb115063ae4728b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useLanguageToggle.ts","sha256":"19142bd60ea75e6c15f65985d08682d2d5ec3548e3fe42ca3305986633d20ddb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useNavbar.ts","sha256":"753751c674f13e23f0d8811bbbcd2ba87cb542a776566c28ebbfb7ceb953ae94","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useNotificationDropdown.ts","sha256":"7c5978b134a62cb3b562a311e2632b70d4226e2520b19224980bb7450fb2a408","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useThemeToggle.ts","sha256":"d84937dd5d5c92636bc54cff6a273296b02cb09a42de5c78d9eff5843288bd9b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useUserDropdown.ts","sha256":"269353c9c9f5220469c2aa8ebdc27cdfe684697c27277a37ab7536a28f805e2f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useWebRTCPhone.ts","sha256":"ed01558d028b84e5d5b0a806af8778f1a0d91c983b1f92638070c6c608a1c114","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0002","FC-P5-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/IncomingCallPopup.tsx","sha256":"17b467b417f4067ce79e2f1a420bf4354da7635af32275e3767b6b37af35cc07","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/LanguageToggle.tsx","sha256":"0e4cc46496f5a11d4d1c99c2c5e55ea5c0764d87dbd9c7d0b77f2b038fcd255a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/Navbar.tsx","sha256":"f4213a8a22f882c1f98713f547be11c926dcc2a36e8637039fc0abfb44fe58c2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/NotificationDropdown.tsx","sha256":"d6370d64e6db2a727c2bbad96f4d1ea10fab14c569e26fb1a6d6e29c5d8a5a8b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/ThemeToggle.tsx","sha256":"9c4b44cc07b217299d612c6e04f321aaed67921cca1c9c6072fea093d0bb5e76","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/UserDropdown.tsx","sha256":"49cca1d9a069fb5a22477ac88b643e7ebb745bbdc342b194c325ddfa52830a57","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/webphone/api.ts","sha256":"bb3a6291be638ea8fee0bb259b6025f74e6c3fbcb1a03ad1db52d2c8aa099721","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/WebPhoneTrigger.tsx","sha256":"2caa5d42dee55a1556e2e810ecc30491d0147a84c5fa9cbda80ee22e565c4c7c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/WebRTCPhoneWidget.tsx","sha256":"3a231f5a0141655f7decf391f0ee03d4ed2c669ff6167d5d4bfc79e7f611594c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/CountrySelect.tsx","sha256":"0032012d9bc8ed16b6763ed907bab3dcbef7345780fd7101e6b69eaabf03e6b7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/DestructiveActionModal.tsx","sha256":"2acf7861ac83808753829e18f4f90b73e24b4b92978631cdc363553797c0deb1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0005"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/StatusBadge.tsx","sha256":"043a6af4b7132f216430a7ab4b3e69a54c307b0fcd033bae1c0798c89dc03456","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/TablePagination.tsx","sha256":"c3c7a2113671ce1521ce164c8b64aada404321a6cea54686b5a7da483a5e6f8e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/ui/ToastContext.tsx","sha256":"cbe5a4fdcabb889235fb3885de452ba5f4c06bafa448df2e1537eeb1b401443f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/context/AuthContext.tsx","sha256":"9c831aa6f9882707fd37c7da1536e2ce449ae0f6917814cde1b106d2d2d5f10d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/api/applications.api.test.ts","sha256":"1deccf3072fa8403680c959a95edef40bf6971fb442e4b682f297153f55de14a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/api/applications.api.ts","sha256":"0b35a424550cca04fa21e57597470709ef0f72891c3904b8461c4ba10d808b3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationCatalogueWorkspace.tsx","sha256":"ba8730f65af947fa4fe40c6472c669411aaaeac610c24beeb7de4171604c77a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationConfigurationDialog.tsx","sha256":"1f97d7d6af96529c044c05fb29d5899cfc7b60ff9732a9c63a158a03020a5235","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationLifecycleDialog.tsx","sha256":"618a031c21efd5640506b3b732d7aa1a96c6de61965b7c7041437cf2d721bbe3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationPrimaryComponentDialog.tsx","sha256":"2215f0be004afbef2c7ba9d6a73448a51f1b2359e9641f6b605141bec47b7268","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationTechnicalProvisioningPanel.tsx","sha256":"d01d302169d7f32c3e277fa64349da46830cb1e810937b41e5e2ddf9e9a6f5cf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/CatalogueResourceDialog.tsx","sha256":"c437f694f573bc52d4da9135bc2d4aeccfa2a4a6af57334e93aa3469815827f9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/CreateApplicationModal.tsx","sha256":"bad7c13598f76cea599113457a8e95313d5abe6a7fc0e5ba2ac53ddfb2579858","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplication.ts","sha256":"2fa218f71d736f948d96a396b9d25bb2085390529f052e07d389154c308f8698","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0006"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationCatalogue.ts","sha256":"3c26b2c343a74d826634718dd5c66fc6a326b407ab67aac8f8a1d4543b89af28","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationPrimaryComponentDialog.ts","sha256":"02f2bf51bd3a37d9ff90983681dd449f4796183e4f1c5362cbc73a9515849b64","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplications.ts","sha256":"16feaa290ec9b9b3bcb32ff06f3f532a8cdd99654fdc1b979661befafac040cc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationTechnicalProvisioning.ts","sha256":"20a1893d09d599ba37907327308b77ae8bc9aa9dd0c3acd5897802b032ceb2bb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/lib/technical-provisioning-state.test.ts","sha256":"d1554e0965152d8090892ca7b6f844ac03b8fddec9b620365f00068968754bda","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/lib/technical-provisioning-state.ts","sha256":"1b32b028b3dc0858397118c7d5d44da9c64263a43c10f8c555f1970e03c659be","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/types/index.ts","sha256":"b3d95e72aff6d084424ea55042b9609daa763eade135dfb3b394a25387403e40","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup-database-access.api.test.ts","sha256":"5daf5c8d4ca1e78c8263d0c6ef8d45525d145230f3c60016f7f6a9bb5e3099d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup-database-access.api.ts","sha256":"4074798dafe9fbafff3ef426a3d91908d4e3dd4264fe06ff043c8a05e6fcb013","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup.api.test.ts","sha256":"a09bccd0fedc44b75d4edef0109b8c5d61fb8d173df9d33f6c74411b61842708","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup.api.ts","sha256":"e6c5cd04839f34add626dfa73a4a67f8b97db2043add4fc2c63576de5e93d233","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/index.ts","sha256":"fcd93919e1504a261cec7b3fff55a63f23030f44bc5410c9b5bcb7c7d18e1ac7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupDialog.tsx","sha256":"63b6c45d5096762431602de33c61ce154da91c59da520ff38239ad7399e58b23","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupErrorBanner.tsx","sha256":"7830f48a3f51c8078aaf9a93896b7e2b6709a60b3e0927ab84be4afaaa5b08c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupModuleNav.tsx","sha256":"cf040056e4b8131d79da95e4d9bb7bb6c50a3b28e5c97a5bf6a018841fdf5116","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupPageHeader.tsx","sha256":"6076dcd9ae993d1705423c0a79cd6dbe7af48ffea9064b5cc9ad45655311f998","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupServerSelect.tsx","sha256":"f06385cd0f6fe1855473f42b9629a3bdf6b3747122d95048e6e8e4dcf12c7bc3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupStatePanel.tsx","sha256":"2f5978e4e43aac1ccea1c23b79da582e085ad343ee0057059c5931765daab9b1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupStatusBadge.tsx","sha256":"24328c2567551fa5be75d4ec7e132cb7a3457343b0e2cfca93f40252194fe2ea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/ProtectionChain.tsx","sha256":"693d6fd8cbe5f6d46cf6f5e0e282dcc5d2f1054a9379d4fa4b567d5167cb33de","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/backup-server-request-guard.test.ts","sha256":"d7464cd3a469ac342a1fd008e225adfe1b9707d1e4f91dfcfc01c38e0ac24eee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/backup-server-request-guard.ts","sha256":"b0a974707146c4c5507e22e0c42bd6630f60910cf7e1fe40f741649c0b19143c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.test.ts","sha256":"94dc17e82578d6ce51856dba3192f5ed1af1771a974d29cbbb47b3df998a14e5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0003","FC-P8-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.ts","sha256":"2ac3cb06a6a9b31521574afcbd40c439b029301ca94e9f283e0add1ba4c96a3f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupArtifacts.ts","sha256":"ad75c1d3a41d1a7c0abdcebf288b831bb13bb70e9fcd30d3ba6d79e8996958d4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupDatabaseAccess.ts","sha256":"b3eb31e2a040b0250b1a5149db35471474812daae43247f2aebd45874b1b2476","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts","sha256":"c53af13580c8415d4723dba171fe944dd37189fed39190c1e951a3d1be7aed78","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0002","FC-P3-0002","FC-P3-0003","FC-P5-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupOverview.ts","sha256":"0064cffb6fda2260726cfeb83fb73565da0409aab6933f740563f5181c6693af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupPolicies.ts","sha256":"63e3dacd7aec1ef28ea239e876ad380d7a6c7ba499cd88499dbb53153ed71fde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupRestores.ts","sha256":"0c98628c2143b594511de3e5e34c467b5b99878001c85e0c71cf16b628bab596","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupRuns.ts","sha256":"337202c2893f21942cbfc1b7b504e20603c1bf6c216008a1cdc73865adf2146c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupServerOptions.ts","sha256":"6843511ee2789b4155120d6f5d0f968e9adae8e25e168b019abe6b75704d76ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/lib/backup-format.test.ts","sha256":"a802cad50052486233fd8ffb748579ccdcf800e97dd2a5fae31cd05a101f8225","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/lib/backup-format.ts","sha256":"587030c2a37dba77b33ca940f98033c47397c0af75e79a479eef3646069c324f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupAccessScreen.tsx","sha256":"07395365b56bb09cfa027bbed86ad609af8f4f22f8fbd70486669fc5443d0587","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupArtifactsScreen.tsx","sha256":"a8845d70b0a2a59cdbc7490599f06e9e48f30c0be499574518729e76b490fd2b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupOverviewScreen.tsx","sha256":"7bddfc687586dc7435586a657e03db6add9e15442c1a91f5310bc9eaf1db8a49","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupPoliciesScreen.tsx","sha256":"bd2f2ade937de450d58e509891b1544248ab73ea91a3040622b6d78d0383bfa7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupRestoresScreen.tsx","sha256":"18c4865db5a1225e2e6e4fc5ffcd7f2a7d9996929db4cf8bb3c022b6a73a018d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupRunsScreen.tsx","sha256":"cef20afed547ab16b5d6205fea010e79dcd6335046afb5668ab2055fe08cf919","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/types/index.ts","sha256":"dbecd6722c86ffac7fac3f05a33aec3944da0325009203565f0a3b8b3a88a9f1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/api/database-servers.api.test.ts","sha256":"facea4a2a864fb2785336c7bd1d6ec0ffe09f042da77aceb2299ef8ded5a3ebd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/api/database-servers.api.ts","sha256":"edc65b62d20764f0ec63c559eda2c7b74318776c33fa3c74b081ce9fa018dad7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/AddDatabaseApplicationDialog.tsx","sha256":"c7805c5839b13af1585c4eaa2cbbcd8c4f827c85ee9c397182abb6493033cc59","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx","sha256":"a6d35094826198748655fa08fd5909d7074fcde6e5858aa2a7890751188522e1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/DatabaseCredentialActionDialog.tsx","sha256":"ecb492025fb966d197aa546a466507f4a0024d0ab472bc29208ee7b92561a43d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/DatabaseSslConfigurationFields.tsx","sha256":"64e91dbe7c5a0d9bf95c9b82bf257583b7e7b3b9a665541afc9d2cef79753311","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/EditDatabaseServerModal.tsx","sha256":"6fd50c75eacbbea00465ad4b8972546c00e236926c2016ec765d3727b829492a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0005","FC-P4-0006","FC-P5-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/SystemPrincipalRotationPolicy.tsx","sha256":"e5c94e399bad3acc2c1496a884d768e7f122ca4fc9769f362438d76d8f1f3059","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0003","FC-P4-0006"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useDatabaseServerDetail.ts","sha256":"e73aa151a5adcd66a09413dc8bd93269036b128c549b660096d5d572f52241d1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0004"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts","sha256":"f3ebc9a226d145bbef8e8e366e4e59ecc3f8afa2849d764b21ae4fba7bac36c9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002","FC-P4-0003","FC-P4-0004","FC-P5-0006","FC-P5-0007","FC-P7-0013"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useSystemPrincipalRotationEditor.ts","sha256":"16b6931b7e4376c801ce7d22d7798dbcb0c321c3fddf5e80707f2b8b348d7fc6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-deletion.test.ts","sha256":"b42454c27c94e6988a83dfde5ebf5e5e9b47a6a61478eae97a1fd9d3d22197a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-deletion.ts","sha256":"b9bd3f0849a0424ecdac92a000803bd2e6c71a5f4eef438c119e64545dc67a0e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-idempotency.test.ts","sha256":"3a3b0be0f8c03db3d46ef8d96c8b933d445b4af025389d30775cd5750b92463e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-idempotency.ts","sha256":"79eb0c187b7e9be4ad947a6f1be1e4942a36cd2deab623426fb4af93e794f50b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-ssl-config.test.ts","sha256":"5a2ed3af3952221f9ff242f38faa8713d983d0965bde065904d693e19147c128","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-ssl-config.ts","sha256":"4a84a33b7ac03bdd2ea671dadd509fae75775c737d8d1844e67c3284ad1a1734","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/registration-state.test.ts","sha256":"8b0cbe321a5f627a263379214b8fb94a64c1b3cbb2878a0e9405fb7ed4354069","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/registration-state.ts","sha256":"9de97c139e6b7bdad69575f5bc9698891b7b3856e7c92309a2177145f6ad8912","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/types/index.ts","sha256":"931fb619610885af440b4569bc33ac4d866e790f8548ff7426ceba849ee67628","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/dictionaries/ar.ts","sha256":"e520098bb7e29987df70e6e3432718024d063778c054d99790200aaad3ec8802","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0006","FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/dictionaries/en.ts","sha256":"a1aec8a79c399cfdc0029787b5d7b9069bdf62b843e54c4b2b17524fffaed164","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P7-0016"]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/I18nContext.tsx","sha256":"15b8c54a216ba1da9a81c136d249a66a281ce0cdb86ef2eea23ce448fc3b53b3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/api/axiosClient.test.ts","sha256":"6132c3cd1aaccb61e5a20cde550ea0f9b596fd45f558307a52ca86d29751ffca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0005","FC-P5-0006","FC-P8-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/api/axiosClient.ts","sha256":"0993ffc1ae894f3ca9b7ed2dca0cfb73ab1157a87494fdffa6dcbb6cc02d5875","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0002","FC-P4-0001","FC-P5-0006"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/rbac.test.ts","sha256":"bb6420dcf5ea7ceb2a22ec999c004d6876e39464fb20818d443a9ff33ea279e2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/rbac.ts","sha256":"5179eafcc77f75a8e7d0ca83551da14b81c3ba896a37b27829cb7314a1f27c25","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P5-0008"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/sessionRefresh.test.ts","sha256":"4c40ded4e05b814445b7d01401c1fd3b5d55d523e254543c25c370e8e26b118b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/sessionRefresh.ts","sha256":"f2520b7add7be36395160ef2b180916d5f64f9550f317815f3004ce4212b9b5c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/safeStorage.ts","sha256":"93c348de2232ec17ff73ffde8cd3fd8ad75756365597fb02806137cbb69df069","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/utils/formatters.ts","sha256":"68895737722ce2bb9c5500afdd4b3bfccd67ae39ee004561d41542ef023fd90d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/utils/uuid.ts","sha256":"d984c8b379b1f6b00e7f1240ccfa6be31f92e55ee8cdeb18c6abebadf2dbb889","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/__tests__/core-envelope.test.ts","sha256":"366eb29049e622b13bf52e8eb4212f610b3ae91ffe7609213bf72bc9b19d4747","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/__tests__/normalized-api-error.test.ts","sha256":"5c3813fe9565ae19338140273ac2d5c85e9ca5cb998650fe8b70e0d5c4f53f51","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0002","FC-P3-0004","FC-P7-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/core-envelope.ts","sha256":"c4d4fba6dc17d2fce1ca351a24854cb8f5c2ad77f7c734111b8b2d6391a48ea2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/normalized-api-error.ts","sha256":"d2ac2ead7d57fc6c231efaeb6bb077b3cde984d52f623454e1ce6f078d818109","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0003","FC-P7-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/hooks/useActionMutation.ts","sha256":"46319e6e57953daebfe026995d17330b81c3e2735ba9d2b29c79722714443769","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0006","FC-P5-0006"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/hooks/useIdempotency.ts","sha256":"fd57d946ac8ed9e4a84ce5f42a792d46017d10f11cdce112844d1b4bdda9b777","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0002","FC-P3-0002","FC-P5-0006","FC-P5-0007"]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/utils/idempotency.ts","sha256":"997d19fa67e654f9315137e6d6058500d3e6f86a6e35e99a87e1fba5d80104a5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/types/common.ts","sha256":"e66ca5dfef9b46867a8c660440d6970906ec50970cafc854feccc0877a8449a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0003"]} -->
<!-- FCFILE {"path":"admin-portal/src/types/dashboard.ts","sha256":"b416e6861dd27a6485d3de0be46b2a4ba4bbd43294fa60c9e9f4dcc07f5b9d91","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/types/module.ts","sha256":"6f8ee7c6fbfefc41f03fac59451cc4bb6b4899adef2afcd34e85408383dcba3d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P2-0002"]} -->
<!-- FCFILE {"path":"admin-portal/src/types/storage-server.ts","sha256":"6ae5d8898b1b5b0008a5256f0ba912d68278eb6a17338eaeca494212c23094ed","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/tsconfig.json","sha256":"48ae8d033f441a99e3d6c41b08cd3e482b2f0c1b7a0a69bbb7af9be6a3021445","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/tsconfig.tsbuildinfo","sha256":"d7aeaf3004aebbfb6f7e1d35b8d0ba9eeeea37f81ec79a243ec274dd3e06f719","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/vitest.config.mts","sha256":"2529eaec8364a0d5e9c63a8ab733d65ac99c50e171142358bc4ad724d9077d5a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0004","FC-P8-0001"]} -->
<!-- FCFILE {"path":"api-gateway-app.lnk","sha256":"8b7f7f4ea8f68e18a6ee2ebddb7b8f2e21d0a1d2334c763160e05802ed462405","mode":"metadata","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"core-app.lnk","sha256":"9b94f72fe65e85c0fc12bd5df0fc1a39bf2ecaa8f6b37e839ecf5f8056fc25e7","mode":"metadata","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"crm-app.lnk","sha256":"458b70eb14649f1d7193061217a3642c788a955e050f9868205ee0e56a5c1dab","mode":"metadata","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"package.json","sha256":"a02504ad6fb166130c9c7499cd967dd920e971e00e495ccf5dabdfcb23eaf35f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsc","sha256":"062f5027f90a69bdb540cf5c170e228042498faba0cecc92915d31a197300b74","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsc.CMD","sha256":"56bab63f64a4999e84adda563649be5d4ee1a7aa3257c0a7082c22a7f567067c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsc.ps1","sha256":"70bb15139bde00fab950ad0fe693ba59c7f7fc043bcf779e8eb5bc79b9fd0523","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsserver","sha256":"2299dd53ed52126c1d21e8b7fe969671cd0a15649f6b70d1b69c7ff7b87a7b76","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsserver.CMD","sha256":"0ab5a8c9fce3705139969017905bca999d9ede23a68f9258e8dc639257506ca2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/.bin/tsserver.ps1","sha256":"db71bd585d29a78b4b302c4e7dad241b8478b48c3beaf8ef9db99e4c015573e6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/canary.d.ts","sha256":"c5e807dc7f94e7e9f00f6d4d5cf60127a5ad0d61697d46abe4c41fac43a6f38b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/experimental.d.ts","sha256":"2664f671402092e090c961aec36c66133a8b28bffd5b560ce2490525cc418988","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/global.d.ts","sha256":"4d0fb04bb044e8b2eab08113614146d84f5c6b0583f2f64270d9e8ea46575a70","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/index.d.ts","sha256":"5caf8379732e0cee8ceab78f180798e217b97fe53516f972e6d6a1b0842fcebd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/jsx-dev-runtime.d.ts","sha256":"cd91972a243cf16c91c36d6209273dabe507372674f2bbc2a0842f99eb67bd71","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/jsx-runtime.d.ts","sha256":"9f78824ede0993ba310953286f1ab43fc57d78a445c1492ca1fe5a260e648c32","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/LICENSE","sha256":"9906940f61b1f0b533fa7d99baf55178b2808fbe113ea51dfbfad8572ccd5f2b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/package.json","sha256":"1937078abbbe9494d1ec0c923b4f36455975eeba8a99822ae017323f66c25642","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/README.md","sha256":"67be5f9eacb5d2c464ce9a6a4601e8cd878cd165d160f57b754e7567be4fe48d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/canary.d.ts","sha256":"c5e807dc7f94e7e9f00f6d4d5cf60127a5ad0d61697d46abe4c41fac43a6f38b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/experimental.d.ts","sha256":"2664f671402092e090c961aec36c66133a8b28bffd5b560ce2490525cc418988","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/global.d.ts","sha256":"4d0fb04bb044e8b2eab08113614146d84f5c6b0583f2f64270d9e8ea46575a70","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/index.d.ts","sha256":"1d43f602a5c776be3fd61127c0351a062eb6ffd8f728c0ddd5251dd24400d7c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/jsx-dev-runtime.d.ts","sha256":"cd91972a243cf16c91c36d6209273dabe507372674f2bbc2a0842f99eb67bd71","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/@types/react/ts5.0/jsx-runtime.d.ts","sha256":"9f78824ede0993ba310953286f1ab43fc57d78a445c1492ca1fe5a260e648c32","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Config.js","sha256":"65f124bb19e77014271b90de5f6e46359b45283375c88c87aecb72a85aeabd9f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Constants.d.ts","sha256":"2db74bdf9b8acdd4c19edd16998cfa9ba4d088dc7e9eeda4eee8a7ed31b8abb3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Constants.js","sha256":"cfddee9a962226140dc3f5d0271c5ccc60877a73177f8d9951f3d892a515433f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Dialog.js","sha256":"36e46c73f9c8ea6b1e8452d8514ec0d4fde39adf2390a2e4ccd607ead3a018d4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Dialog/RequestSender.js","sha256":"8f1b346db8b7e53fd4e91fdb8e78839598582b934692d55b3c6e36d577a96c5e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/DigestAuthentication.js","sha256":"0bcf3c3a4748b5a44f912fc1e2b6b2a43b3b93c8c190e99fb6b2e7c50e71b0bc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Exceptions.d.ts","sha256":"7b7ad1de4647eb9b5bd2a8930126843ea9bd4333c29ddbfc3307374358b36aab","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Exceptions.js","sha256":"831420bf7bcdc77f1c9134788763299fc2b07a2b15f2cb0573aa5b35c66bd297","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Grammar.d.ts","sha256":"2365d9f3227661f5f8b30e9384b882597a95096fbb3cf4ad9d5f5cda52bdf27a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Grammar.js","sha256":"38b565434ab4846ca49d3a9298ae5dc4dbc394f02b029907a3455a3dd222419c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/JsSIP.d.ts","sha256":"38afada72652f7ba03f546c0bc6782dd615987fce50ad7c2b56522530cd86bd0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/JsSIP.js","sha256":"eb3b80f477c583cdf622592f064c7e3f1ec6870e617d94bebc1c8b3dcae871f8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Logger.js","sha256":"709a192f4b42a2d512cd0573d700652e6a1bad2d36d8fc339b763de4fcd4789f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Message.d.ts","sha256":"fe3b98ef8166a53e250ed9d03586aae57ccafb65f65196cee42c7e0c9961f9d0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Message.js","sha256":"a353e30e8d91ea67de95cb25811de217002b3f9127f1a5b92c4fba8e8e616d22","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/NameAddrHeader.d.ts","sha256":"14b0c41c008a156567faae581055375452ec378aee04def4a90b8a9091805c1c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/NameAddrHeader.js","sha256":"b67d4651d85913548c51ea1d04b37b0028b1a906533e20dc27825066617bdda0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Notifier.d.ts","sha256":"031d98b99747a17e096415b9a72e3c9bca59c341c5af8ef5e941611927a174ff","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Notifier.js","sha256":"a20f37659afd68dea35116a06902f5f980836637009dc851d566b93e6e8ff4aa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Options.js","sha256":"4f4f6706342d56d90c98645fbf4b92b872248a58ca0afa53b4b9169e9d635868","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Parser.js","sha256":"92ead62cacd8c450654335002eab46b07744c0868e4bc7d700ddd5ed163c4c0d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Registrator.d.ts","sha256":"ae6ad4e3733f350b8694495321d2c9108b27f785a124e5dca5797f66e48efe7d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Registrator.js","sha256":"2aa1ed2fadc01139810fabcc3306cd0c88343826fa96ffe3509ba61a2412d8ea","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RequestSender.js","sha256":"0987621a4becb3684bf15c5812401ba91451b76694a7ada57996b5ef3051d074","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession.d.ts","sha256":"81d14dfad17d79b8066e53bca66844929345b6d6b9d82c3f05c3854a264ca6aa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession.js","sha256":"fe2ab87ba84eccf07f9df618b79373f828c44f0262c7f6d58dee8d5862e0473c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession/DTMF.js","sha256":"447f25349e6a5f8f462e058cd9af385b82cb14136a751fa3b169b1c88560bb38","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession/Info.js","sha256":"d0e4d665b3c866918f3017fcde0fb0368d8eccd2710e257425aeba343c3cbfa2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession/ReferNotifier.js","sha256":"29ed1f94a6eda7ff784c3848877b9a5a11bd780066d6e166c00732cc63bcd4bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/RTCSession/ReferSubscriber.js","sha256":"6bc649951f0d01baaa7e3458803def49427dad3150de82a323adb9f45ca2776e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/sanityCheck.js","sha256":"a026d6900985ecc7faa019dcca1fd4e68cfe4e80e1f61656bdacd9676730c8b3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/SIPMessage.d.ts","sha256":"d690aa126ce806085afd198b1ddda573244152d55954d097e088074db496a80e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/SIPMessage.js","sha256":"44f7081bae2593ce65f6d6fc3468a7e4153872e72fa7b09ec22ea150b100132f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Socket.d.ts","sha256":"c798bb7ec881dcc6ac62554152b3d56070318f966ad2a2c24bc8a84979a98251","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Socket.js","sha256":"be6c3bebba3cf943057155e84aaf279dbeb298e7d46f7fca2352542ff848dcc7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Subscriber.d.ts","sha256":"ada740265ad1321b54134d36e361ee681b96f43755001565a0cde7ee6dd3de1f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Subscriber.js","sha256":"3fb5169e6b792de7038358dadc772bbea2d7c9aaec0bd7e1bda652253532c7ba","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Timers.js","sha256":"995c6d076f9bba8d9f5509307830e6bfcd5c428f3211e235ad19fd3cc9a82652","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Transactions.js","sha256":"1a485a9b30f70d31d09913381f8efbe545e558a540a3856a29f7c154faa11c80","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Transport.d.ts","sha256":"9ac4f71dcbb6beb1cfa6c915cd8328ff85dcc8fe30af44e7d5c354ea46f0ecd2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Transport.js","sha256":"8108665aa570ee199d46d31f1738e7252acd8ec7f466154eb8e949abf90634c6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/UA.d.ts","sha256":"63c323973b3a3f212971502616ce1ef2865c3cc58af580dd4771c306a438eb7e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/UA.js","sha256":"849b0825c24da5a4eeb60a7a34d297acd94a09a29ee72e6423fee4f1f4bcff14","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/URI.d.ts","sha256":"b37cec9d4c9c97a88ef8ade8f329d69c24b23337d97bc3badbae9bef256cf41e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/URI.js","sha256":"23c623e7f897788dbd20c6263261ae1e893879790c93f6b20bef6761b80f8c7a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Utils.d.ts","sha256":"c84aceb9cea5a4498ac46eb794823b45f9b5d324ff1b84af7523ebf5329af44a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/Utils.js","sha256":"2d519c2bee00aa982d79724f6c1341de22c96f90ae2ef68f85c51ea253729db9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/WebSocketInterface.d.ts","sha256":"9dfd7ed6ce9db538d238d739e161bbce85157c1087143560709a63c017b6c1a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/lib/WebSocketInterface.js","sha256":"55adaa17f746330039f657d87944c4567febc05671c67b8ae9e5ee04e9f270ac","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/LICENSE.md","sha256":"60c1a9391cb7f6c46c963d32a96feab611a11567a4fe8d4278cc70f62cb2b94d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/node_modules/.bin/sdp-verify","sha256":"87f922994941d23694b153b04ef2d47894206e9e4171953582403404609b2466","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/node_modules/.bin/sdp-verify.CMD","sha256":"4c64c211aceda36ea6d2def4cae2ac8c39e3dfa538be7bc09ffee0135ea114c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/node_modules/.bin/sdp-verify.ps1","sha256":"a018bd7bf4bb86f53236fcd1f41917afe8ec488e14c278d3a37a7f16ac9affb6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/npm-scripts.mjs","sha256":"1bf2797ecdaf3b75d98f16c363382015e8c2e47b84004826b77a71c7e7f680e7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/package.json","sha256":"710fd6e56bea92c98f53714d463e46cdbe632504afe853a9212f17c919ed5a96","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/jssip/README.md","sha256":"584e15dfe143ec6f800bbdbfeb97188e1b53fa1810f88180a0d523a97a4d6faa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-dev-runtime.development.js","sha256":"a3242e65c0f5deae49ba8ae6939c0accf01d25d3aa18f371d18a183ddcd99e35","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-dev-runtime.production.min.js","sha256":"af579b260ca13495bb11f14197f6e4f879079291258e954b4be1d2c3b284a7ae","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-dev-runtime.profiling.min.js","sha256":"3bd0b6ff5d8a941c53f8d5f13504796dce8f32c0fad1e076044cf0d8daf70ce9","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-runtime.development.js","sha256":"7adf0236a238f3c4feb400befb640b485189ff37a7fff303ebef718b50c3d89e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-runtime.production.min.js","sha256":"8aed270e810bf84724c758019ffc3a6fdbe78260541741b205eb56e2b0ee0848","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react-jsx-runtime.profiling.min.js","sha256":"dcf261184c430420b0f7f818ad0a69285208582a82df5d18aa6e0ccde8691bac","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react.development.js","sha256":"f36d716c0f3089bf59775257e84c8f836fbef0be0234bfe6733e3a3965b807a9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react.production.min.js","sha256":"3abd86ff74bcc6be78bfbbfb80d02e11a1f929652b71e2914922efc7e98f450f","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react.shared-subset.development.js","sha256":"5a653ad556a2fa2e696fdd2870d3cf24c1024de3ff7a64881f43b1e896c9056c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/cjs/react.shared-subset.production.min.js","sha256":"595f57118387abe8ac25163607eb38dd25dd75088d13b58762e653eb8ede0391","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/index.js","sha256":"0f32784ea912a70b3088c917c62a91ffe845ea8a74d4fc6b485ba2f4cfcd1399","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/jsx-dev-runtime.js","sha256":"1bb147f251ff86ada6c95d9ab3c32264357807176dd8445204384dabe0c74681","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/jsx-runtime.js","sha256":"a1393971704638c87ca55ed1b6185d97fde24a25d53e2367e17b2d1c2a231b43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/LICENSE","sha256":"f08a94bfb0bdc1d7f1cb59badaf0f8c551b10db871185622dbf1fd036affa9cb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/node_modules/.bin/loose-envify","sha256":"905632cb313588f1a817a2f2b88b32e01449abfbc7da32e50f7d4baba5b6604b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/node_modules/.bin/loose-envify.CMD","sha256":"23d212bd50ffdfa4dc01e313eb987cd03deedc03b573be2cdf00cfcde023dfde","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/node_modules/.bin/loose-envify.ps1","sha256":"f5ee6818d3af2fa19e5ab46a106ac0c463581b9cf30aec706b4d50cebfd9c0f1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/package.json","sha256":"4295f43c029dc1eebbdea43052a7efb3cadd87d6fd3cea52c8f3a26b5cba1f5c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/react.shared-subset.js","sha256":"e4d3c8c67577a54db70f4db1cd3fe6374fc957035410fd6b54be2ce70345c41b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/README.md","sha256":"96c7036ef3cd2eb7aa6188b4f8336412e3814b7c5ea0b5f16d4b8e776f64b060","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/umd/react.development.js","sha256":"e39fc2c020e3cec538be15db6c18abdf72418ec58cedf3b49e42e9c28836212f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/umd/react.production.min.js","sha256":"d72610e728466bf70f27ecc9a1a14580fd8f1e75b977aa0612146cab0e80a3fe","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/react/umd/react.profiling.min.js","sha256":"70119a67f317cf6db0ec6189c1301d2dd37ea6976545c5273e6faa0dcdf3868a","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/bin/tsc","sha256":"58947eafff5cc794b2412559443546742bbb0672e9e3b62ac4fd3a279bc5be5f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/bin/tsserver","sha256":"2135bc1d3c385786bdf526f3e361fbf2fe36ad9c6aafced4cbe9d350d1cbb049","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/_tsc.js","sha256":"05af074f71ce1812b33853a973931a2a6b1808e58028b30b95edd7e684ff0cb1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/_tsserver.js","sha256":"4f24bb10076064ebc002ffeab0a098ed2eada9d7d02aa0c5eb9ae721a5d6b7c8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/_typingsInstaller.js","sha256":"23e8c3116c16844b3a1dd13c30d73e746f00659a06678e8dfc241d04646dbeec","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/cs/diagnosticMessages.generated.json","sha256":"2548958574d6ff87cc1da2f4d5dfbca01707c6ab02ba87e79c80fc17c923579e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/de/diagnosticMessages.generated.json","sha256":"cb11c78c8dd7c3c3fd2ea4a6ccc7f10d0dac239e33a21d73946245417845ee07","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/es/diagnosticMessages.generated.json","sha256":"e391dc9712db80c442c7a72585e322c161fc61520274762424bd78f93129aa37","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/fr/diagnosticMessages.generated.json","sha256":"a3b62c702ce4c3982c1120a1b3bded42e55c01fe954af8e154ed64ed1288c4c1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/it/diagnosticMessages.generated.json","sha256":"0fc687cd1d8bdbdca2707787c82247014bd2831debc276d805c4bb1180e1cea5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/ja/diagnosticMessages.generated.json","sha256":"0fac302aaf4d61c79d5ecb13527cf9cb153f92b71e42e494e5aba2f39f4e2be6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/ko/diagnosticMessages.generated.json","sha256":"37f540d5c3db149c8beb514ae9aea984341023241598a9e290b0533ebb0dbc6d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.d.ts","sha256":"a20a2940aed7ac268fd7a5a75ddac0e7de4d12647a4b3e23468f154891bbfce9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.decorators.d.ts","sha256":"4033c51052514a6c3e4564f22671fb7a1cc6aa7746943c2dbf7fb5aa60bb37e5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.decorators.legacy.d.ts","sha256":"b333b85aa74c3b92988940ab51d50c533c93e2bb0d78be2b5e9e948e76fece0a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.dom.asynciterable.d.ts","sha256":"c72fe06c11f813667237b6349eed2e242d3636a36e5693c1ad1c2aa33f1ca325","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.dom.d.ts","sha256":"943cd359b1e074ea340c364e7c14a1878ac9aef3f1fc1b2a8080d3938042d4f9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.dom.iterable.d.ts","sha256":"eea76ce47dd717e742356873e38f89ce9007cdbe69c9ac1a5e0c8ba1123e2102","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.collection.d.ts","sha256":"345afca9429c9143e0016cdeee715a9bf39c55a2ff46954fe0c9d5764feaf895","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.core.d.ts","sha256":"6666becd625655c6662a29a744786dffbf6d66c28f068f5137760ff419ac8adc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.d.ts","sha256":"97fda9a66baf7f1644a76c27160698be6bc5da3cddb7109d0f12d4c7def0f353","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.generator.d.ts","sha256":"408ca1d716d3df0961a473392d55ef872a3e1ce6de4fb8dc7fd6001fba6a1c4f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.iterable.d.ts","sha256":"cc3ed3562e3c791f2e74ecd3819d15ef58fd3b47939de9853db5dd808253b00f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.promise.d.ts","sha256":"ac6a91d78291f82d060a24001518a9f5f2a94324722df8c159691c08d39c6bf5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.proxy.d.ts","sha256":"4ce0fcc6c7dc07b2a97cf3bdd4f3df2fdd7056e93acc52de8d15ced40c603602","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.reflect.d.ts","sha256":"999e86d04e508d25e374dc1cf37aa4f7f733ad93a8076b20203b3028c7398fc3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.symbol.d.ts","sha256":"c1f9879f76b5409ceaad951b084533d8abc39451a72d6ec55dcc5b9e5f098309","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts","sha256":"ebfe68159fcc055c880a17b5d5a219dfafc662b48c1cd32a7d3eecc74a1efc70","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2016.array.include.d.ts","sha256":"ee7bdffdbb8462f9973063563f8822e6e2b3b7ce05d4651e4879d00f1479899f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2016.d.ts","sha256":"6ae308f5abdd675b08bd2b3d6b78018b08a148a1d84f8dea19a6794e5653eca9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2016.full.d.ts","sha256":"d265c5dc9bb8f6bc939418184d26f93478e9ca4efc7879717ccfa1ee48d7f067","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2016.intl.d.ts","sha256":"9b0111e0b9c98b0bc610bdeb1486f14c60e8c08852552f692d57becf2fe42ea7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.arraybuffer.d.ts","sha256":"6338d9121d2f1b5cf1c757c65949fc41e1e9e5300dc4105d55f8c27ebfcd5fe2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.d.ts","sha256":"5a174a590b47d8dab224a6e8b798d2033deb15423bd519258e9beb9401c1d08a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.date.d.ts","sha256":"e6a8f68eed8ff0386d27d17e4a162c21923e3b8c41f3353a9ad6ecfdd7cf2ddb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.full.d.ts","sha256":"649f82b488849448b02c445bb98c7497d8a742b989d18e3b169d1d7337035c2e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.intl.d.ts","sha256":"9fe84185f18c70ba5e1a4bcc634b7144c525a7e045c204b60d358e4314d452e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.object.d.ts","sha256":"4e9dccd4588b6a893b02963b1f00ade1b2cc244164cdb3ebb857e3c913d2f921","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.sharedmemory.d.ts","sha256":"7c4ffd61b251abb1c37ea129e861a12f462727c7fb8ef0989e582d9ea1c1d375","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.string.d.ts","sha256":"c4ce7db6ecc881e6f3e0f446d17f18d29acdf703e66ff0df6cf0c6471a83a481","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2017.typedarrays.d.ts","sha256":"84d43d8bf818f0a82dd57ac3cfb33ab8706a7d5b6978684342c0e3d17a4a7bc2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.asyncgenerator.d.ts","sha256":"45678430c8312f11ed1e429b1cd7d139a7adec4310598bc4c8ed6c2ff975ee4c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.asynciterable.d.ts","sha256":"d5b7aaa53a6c14f4239fb8c2625513d8573946a110bb88a355c0ba10d781d7d9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.d.ts","sha256":"070a92b6c7b3061a032d072e87b845b9cdbc8692ba83c54ad73c5ac72a06e7f3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.full.d.ts","sha256":"d1bb4874f9d19fbd0faf9f9ea182dd175be5a465219e8a5b9790d959f2504bc1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.intl.d.ts","sha256":"af3c08438c9c085e92b48a464b34c0ec0da55ff6459411cf6f02619043b5f474","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.promise.d.ts","sha256":"5b460121cb8201504e9becddb2e3dda74fa2561d14de92f452fed81ad794f2bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2018.regexp.d.ts","sha256":"03f5b59a2d05a77266490ec195365773e2947c6022962fd8104e0d23941b0648","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.array.d.ts","sha256":"8283b753d7dd802450c38f8cd841dd0b1a0b246f9ab429e9b7fa5d8157fc2897","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.d.ts","sha256":"a914c8e64e5f910f90cd2e64d1b822a5ef0578862ead57520bcb67f895417b51","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.full.d.ts","sha256":"585d68412b50dc07960bf614ac92743a0a64fd1c545f7462064486a44c5bd1f8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.intl.d.ts","sha256":"7b312bc67316c027e88130f2fc3192eddcb714ce22b20e048c7cd3c878ffbf02","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.object.d.ts","sha256":"7455bf53aacdd935681c5b701af026368e9eefd34f043605c514d1cce9d5bc7a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.string.d.ts","sha256":"9b7b68b72b0727055f8f823a766b888c1dc21aa7f0038e0190168967916eec28","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2019.symbol.d.ts","sha256":"5503f40f563cb65c20d01ba44486450a837786393944ddd2e85e3a4fbaf8c205","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.bigint.d.ts","sha256":"692900ca89d92745df9fb1c425c73c4646fbb32d0806ac52eb6bd7bd234434fa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.d.ts","sha256":"34fe0fa41bd124512ead7c3d91f2a74293d01ed81056932711c4a09c38f3be66","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.date.d.ts","sha256":"0069bee860a9c2ffbd29738234c7e72d849358355833913160ef46df10214e0f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.full.d.ts","sha256":"be27a6f4c2516f96060396ff0afb45e9c8e96d604e233872e1a60e99dfc21bf3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.intl.d.ts","sha256":"1b0048315f80cd412b02bd819ce0dfc0b5d682acc02da1d78037a8fc60b95260","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.number.d.ts","sha256":"535c56a8849d541e0d1ed96ab68ea1742fb46a96d11dfd2b23843d3426ced988","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.promise.d.ts","sha256":"2a3f88bcd76a6b4b017a3d90e3e9500ef608ab110c6b0a692307a4fe71ba9e5b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.sharedmemory.d.ts","sha256":"0089f4c24a96d79ea2f6d96cb475df1d63a8a129a0bf41a86f3ba00a4d566752","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.string.d.ts","sha256":"820bd08ba14d07b36701dd25cbc54e0a21b3ea531c5d8f269d2db9046736a47b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2020.symbol.wellknown.d.ts","sha256":"bb4ab2aceef0699b248072fd6459072c398049dc45d5e55ff0c2e51abc537820","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.d.ts","sha256":"b37ee4d946ad2f6e52cb0ff9571966c6302be51032ba3ea97870bee115b9eacd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.full.d.ts","sha256":"90893dab23861c07257bdd1ac4a6418950d2ffbd9f2b5df97676059ac3bf522a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.intl.d.ts","sha256":"6ed037605cb3740c89ec8c3eaf21eafb20c56c64784f3d4eb9df506ce6417a6a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.promise.d.ts","sha256":"d1e388e9b1bcd2d29af3a6a6fe1627a25944bd3210f05c45f42e77acb7992a68","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.string.d.ts","sha256":"562732440ea01ab3e998713ca4acf1041d07ba6857ee35bf874dcfa02033bffc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2021.weakref.d.ts","sha256":"0172bf6476c793a7ade0388f4e5d4fac45acf0d9f7958c40c893dfe7ca84b45f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.array.d.ts","sha256":"4da1991bdb0fbcf81fb73e8af5d41e52decf2555a0b878d3493f5957bf47f079","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.d.ts","sha256":"2f6e6fee948d386ccd3614b7dd1c53ad53424898f7f62bae60c0de87df9d9417","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.error.d.ts","sha256":"d4c05910fafb3e62d1d7b03b2d6b5247ec7e50cc3c7e036716748fe3ed3f3531","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.full.d.ts","sha256":"4efaf900b38773fe2bd43b8af5a8b1114e9f857f0392682a68eaa2f4cf304217","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.intl.d.ts","sha256":"fd69d5107f90cd266ee098661a45946d7005832ef13381cedb04a8fc51093dcb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.object.d.ts","sha256":"a425d6c16c4d990f501c7bd399bdc7437cc73e1344b26594ce5e34dca1f88e10","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.regexp.d.ts","sha256":"9e5b3b6af88552d9589d69a52f41d0ceaaf0ecd8c159119fb9491a1b580a85f4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2022.string.d.ts","sha256":"a37d801def41ad25cf62fc6808979546e71cb7a8212e3deda6bb2a373107bae3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2023.array.d.ts","sha256":"57b870ce78635eae4215fc37e8f4d712a807ace45ac3904383a89ece88441fcf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2023.collection.d.ts","sha256":"6e646cc96daf2232d277d2e691b05214f909ed6526c72369a349a35db916697f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2023.d.ts","sha256":"616187018d2c41196c2e2d885bbd93fcbb6fc53d73c0301e4f71bd80751280e0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2023.full.d.ts","sha256":"30f576adcb15fa5e3b4ed797f8539338c9b93e4289ee0768aca8212dba955fb2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2023.intl.d.ts","sha256":"dca7e716a21bb6e47f6525f5eeee5c1469335ad1ee76e8d4cd14263c77394f77","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.arraybuffer.d.ts","sha256":"0d4ae8b6e84d082f218db19cc532ea12f2fefda33d4ee745c694525ff623fcbb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.collection.d.ts","sha256":"205edb0e529330769a7ef3da762d60bce1859af14e119ce1eadea7e4620c739b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.d.ts","sha256":"efb87b27ec77ca3d808197d58446dcb5bf2695935946d7eda77b2e35d277327f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.full.d.ts","sha256":"9bc9e2b0f91a4e8b76c8ed08f71f58f5ef08d0106f9935e7e4193c119b8fa824","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.object.d.ts","sha256":"08d953475ab08cbee4f21bc05fd853491cef50ffb94d0b72fb3ae80d8d72e852","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.promise.d.ts","sha256":"35b56ea0e387d3b639585b6bf439574b87ffd9a00a328eea9392556b3a00d6a9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.regexp.d.ts","sha256":"414f31db71490fac2a008289757885fb26513c85fcfaf12cf08146363a86a96e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.sharedmemory.d.ts","sha256":"ecacdb07529d1f1d47e7501b710f307020bf931d8ead308bce50b983dd5a0b4c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es2024.string.d.ts","sha256":"abd4538a335c9c2d6e43e03c8e2ba436e4e8d7e1c875122fad59106e0dd20df6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es5.d.ts","sha256":"94716a6063cac9426b59da38cd5a8299ed337972715c3b933f46288ad7d1de37","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.es6.d.ts","sha256":"ec12e410cafb5c72528940a5e119c180862698c60f2e59236dd3e8842bd0a621","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.array.d.ts","sha256":"14556baded455493470e3989e18a3e5f9f3b7645711a33a92086e7abafb5449b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.collection.d.ts","sha256":"ecf9b690e26254ff0d57afab8aa22839ee1e90a21929a014ff4f665b290b7301","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.d.ts","sha256":"1062de9843421052c8e121614c7e23619768e1e3de01ccdf8741bf72b6b3d9e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.decorators.d.ts","sha256":"fcfa09a952b074bde9c93537cd9658b751a460c928ac73a1d8e3a9ed823a40f6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.disposable.d.ts","sha256":"ff3289c2b77eba5a734001c2a57c4d12d702f4b0b755bf594bddbb2d26318917","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.error.d.ts","sha256":"6075833977c8dbefb2098c977b0307f9d8ce55b8a847a3d35fc7f751b4902386","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.float16.d.ts","sha256":"f8bcdcf77f8a6cc6059831421ed61628307df2b5420a765fbdd797b2a0960eb3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.full.d.ts","sha256":"a27184bf8b7334917c7ed33fdf6539e27342a91283cf0e31d7215dfbad6667e6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.intl.d.ts","sha256":"7f91a8eb864fc88307bf286cc42f4564aefa0a8993f6617338e77ed26d4e68c9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.iterator.d.ts","sha256":"dbd7972ff9835062a8f5543eaaa1040bf7a89fdea5e88ff0dcc1f09481547425","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.promise.d.ts","sha256":"b76df8df29f77322995482c5ca32b804d8154f311fd46fb52338975f5273c30f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.esnext.sharedmemory.d.ts","sha256":"1cf24d47d3a6b4ad2733afa0a118ee44d6bdd6d7033c45c2f08c79721961a204","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.scripthost.d.ts","sha256":"1c11a33d4e5e3948f92c83b1a01cec02a102429466186da3576d49d1e4d2babb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.webworker.asynciterable.d.ts","sha256":"57f2c3807fd0b000ea2f21f58625606bda740f8a13dee0da3d3e4c80dd0dd65a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.webworker.d.ts","sha256":"9703cf668403c44c5b1b3c5f1ac864e5e48e5a948f17daaa67fac0f8f27c2ce6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.webworker.importscripts.d.ts","sha256":"8d65581abfea69586274544cc81e7ae4103f1345650f8a206a66c9da336d73b0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/lib.webworker.iterable.d.ts","sha256":"086bf2667455a3a4b445f726ca72f320efdc26697918ab01526d4c64a4efdcc4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/pl/diagnosticMessages.generated.json","sha256":"a791a995c8dbf97a2d88ac522c97b008edf0b6a467fecb0dcd34d74c8ff85bd1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/pt-br/diagnosticMessages.generated.json","sha256":"7a7c72dfa882043ceb1da0619274925e1633265383e9976621ae0cca56c69e5e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/ru/diagnosticMessages.generated.json","sha256":"cbba72d1cfdca7d10bffc12d93603fa11e24d14e068b23332ed2808afe19ada3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/tr/diagnosticMessages.generated.json","sha256":"0a49b86ab4c1301702da0f5625a534fd470e5c98fbd29540f7351cb32c8a396c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/tsc.js","sha256":"7fb0b913be2ef4b3b1eb88a8eb2bd45c6ee7357b10dd87897f03ef3678914f22","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/tsserver.js","sha256":"d152094a67d29cba86276b4da403bbebbe5ad2464866f9bc99aeb3ffc9bc5889","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/tsserverlibrary.d.ts","sha256":"f8983da84fc227914a83b26e0ddf45afae305fb8b4ee30bc0dae7bb28ce57f27","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/tsserverlibrary.js","sha256":"1111196fce3d2269380c1f448792c92697d107b9e011792e66eef2f14b982bb8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/typescript.d.ts","sha256":"6d9aac66b0e0150601f6196de5e3845504654aa99f32f007c2d52cbeadffa039","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/typescript.js","sha256":"f722647f0903c50a673288f2fb17ebb81ad8be458a8e32c139da7278ad9c044f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/typesMap.json","sha256":"6f735c9c8d8e2b4d4f8510273b2f969ad95a1080ff2061f0cf264225fe8dd09c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/typingsInstaller.js","sha256":"7e5c66ad217068da5d0d4eaf4b810eeee911093231bc84718bc393105204f9ea","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/watchGuard.js","sha256":"8fcbcdc26d38098d791cf466061801c6ece00b0524651acdd0d0f4efabbf6e66","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/zh-cn/diagnosticMessages.generated.json","sha256":"b0b487e78f8a347f55bcf64b0d80a1babdbc344cfe03765105f6229d59bd3888","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/lib/zh-tw/diagnosticMessages.generated.json","sha256":"7e23fadb9f76b428704fb2564f309a15793002b0d67db98231395ee595c02e85","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/LICENSE.txt","sha256":"a7d00bfd54525bc694b6e32f64c7ebcf5e6b7ae3657be5cc12767bce74654a47","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsc","sha256":"fa8120a9a700760a9a31252c08b0a4ab8d86e8e94588fed7dd606622324c79f5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsc.CMD","sha256":"47670089063ee355faffa784dc78b184336089e14f2dd4fa652e4fa323cb93ba","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsc.ps1","sha256":"7bbb955973836176088c029f1bd36068a0ec744a21049bdc61a66a30df4dfd29","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsserver","sha256":"4d2222489ddae6f8c096bfec43056d219e3398bd4a0fcd0867c0b24ac36b0637","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsserver.CMD","sha256":"dcb867bb0980d07d45f86537fb32687f180beee6a2684b07a310e7a0cec8ebce","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/node_modules/.bin/tsserver.ps1","sha256":"f3274ac0425393611d544c4b202a3831b3c314147f0cb09497784322d17d1098","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/package.json","sha256":"8f513251c99995ce2bd4cd19c97aab0bc4980b7ce9d739a9713ae2111967c2e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/README.md","sha256":"73147458477d90cd6236627cdd9b0871df12e6e8a21d2d0fda6d1ad2826bdc0e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/SECURITY.md","sha256":"891c6326bdd8ea026af23af20fd7dd7167b666f4bd4f63cf22dfdef09d5e78b2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/typescript/ThirdPartyNoticeText.txt","sha256":"1af3c68039c57e539422da82a4faada506ce6d0ea6f90e0b699d02dbcdb7a90c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/context.d.ts","sha256":"a69cb4aaad884c0a5ad58f0f0b35e907c303bc717cf19f83a1e77e55cb7bab1d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/context.js","sha256":"d70cd412c72a7159d2d1d2bfc9436ae6a51a16ebbe1e74ca3cac96d2ce062c43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/context.d.mts","sha256":"a69cb4aaad884c0a5ad58f0f0b35e907c303bc717cf19f83a1e77e55cb7bab1d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/context.d.ts","sha256":"a69cb4aaad884c0a5ad58f0f0b35e907c303bc717cf19f83a1e77e55cb7bab1d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/context.js","sha256":"f01daa8151cb93afe0bb1a16f783cca1e5a545da3562236e62ac411ccad65d43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/context.mjs","sha256":"fba40b6264b9007aed4c5b03cda4e5fca04bbd4398203d88e77986fd4925235f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/index.d.mts","sha256":"69166ed774700681e9b3a086d387d6ef2b448a2642e292bd79a3bbb34e034231","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/index.d.ts","sha256":"751bd502523aad8cf27e23e3a86571c10a36cc460c2735d8903d744230dbfc67","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/index.js","sha256":"2d3f051c5cdce529ff296dfbd471a908ab77c603d860b0c6ad5f879c943986d9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/index.mjs","sha256":"1bbcaa4f34002478ced13fd5e6ae73165b6f75433d6f4327a1f4de23c87ee575","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware.d.mts","sha256":"1914bdcc0c79b5a513fc311683662b2ad20df484067e6dd2d60eb83fed762c8c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware.d.ts","sha256":"2c9f51d489cec99d883c7fa26f1fb9812330aa5ed3a508c9e31c5780dd061774","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware.js","sha256":"d324a2032da22a1e5184b818934f6eab04a714bf8ee3b313799a071b194194d9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware.mjs","sha256":"26966d1a6290aa6dc0178d909e139a9ad19199aa8f6b13c25037f35bf0d607c1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/combine.d.mts","sha256":"455c22b721d7f35b71456de66f7ef128a8a670d05615be7c7898b6f92bc7cdd4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/combine.d.ts","sha256":"1486f1df6ca22705792e7d1aa542090ba61cab662e229fe8a25418350d18c9a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/devtools.d.mts","sha256":"3880f4bfc2d347523122a440a77fd494d96f7af59a6939cbdf0d07349e6b082e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/devtools.d.ts","sha256":"c8d390c13e75600360f1b3d58df5ceac97eec96d40aa178d7aa54a9d5a5b23c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/immer.d.mts","sha256":"00a0dc2d06991919758489a7df3e85736c847b70ee53fbce5c5badc5c1d1ed99","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/immer.d.ts","sha256":"566195b03e53e3e0dc765b068a744332575b67e15baf5841114b844a31155031","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/immer.js","sha256":"5d8da7fd85c7d6cbcd683e7b33e648adbb69aa3e39ff98c1dbed72b1ec4c0660","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/immer.mjs","sha256":"5d8da7fd85c7d6cbcd683e7b33e648adbb69aa3e39ff98c1dbed72b1ec4c0660","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/persist.d.mts","sha256":"cc8677f3977846c495d18b816a88d95eade20f4d3c38f9f42d365b48423e37fb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/persist.d.ts","sha256":"0e91f24d32b47be3593b8ae84b5100206aa346ae8f7086f03794a1313c19c29f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/redux.d.mts","sha256":"c1ce16444d525f26dc092577b8ab60eed5bced82d3231c5203f478cbabd0ff7a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/redux.d.ts","sha256":"e41f8bdcbadd8ee94d7d21bc14636bcf06397a70b0631c6142fc597f3312511e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/subscribeWithSelector.d.mts","sha256":"52360280d497b42a28bb231110f35a68bc81c64a151ab823cb152599c498f866","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/middleware/subscribeWithSelector.d.ts","sha256":"eada922976b17299ecaa5b31b2cdd58ba41d87245dbc883746cd7dd6bff8f00f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react.d.mts","sha256":"c86a4eaa5d01a3f2b800296ee7af17127990e0523f20191128e0be4d3a677db6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react.d.ts","sha256":"51473e38e063a0a63867ab1d5a8fa101bfa897598aa13fdaf402c82fc390d27c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react/shallow.d.mts","sha256":"e8db26198e5e8b537bc456f74f06fbb17fbab2426340c133f3b243fc0bd06139","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react/shallow.d.ts","sha256":"e8db26198e5e8b537bc456f74f06fbb17fbab2426340c133f3b243fc0bd06139","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react/shallow.js","sha256":"b1ff0ef0bd81940af064e543f0756b3cceb450ab3935c3b36f495af48b9bae06","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/react/shallow.mjs","sha256":"b1ff0ef0bd81940af064e543f0756b3cceb450ab3935c3b36f495af48b9bae06","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/shallow.d.mts","sha256":"c4f2ab1fa3f0288edf391a54e59270a9192213ad65cfbc304b70798ee56c0ba8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/shallow.d.ts","sha256":"685e133328ba461d80142e9b227d13bbaf8b8528783bc7ac9511685280637a2d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/shallow.js","sha256":"a2095eff80220cc2c5f53f85de63269e9bb386fb40f0b38676e0d4a5ee9876f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/shallow.mjs","sha256":"2b192be1004af6ac7c92e0d4d3bada31a5a10e221bf5465443c234baff024b1a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/traditional.d.mts","sha256":"e111cf90ed5526697e81758e25356b572c50cf5857c12ae3c9e82317e9522c42","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/traditional.d.ts","sha256":"78e16aff16e2a84aae62eae9cb0ea3533a717e729df539a6ecc6cc855539b836","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/traditional.js","sha256":"cd25d765fe66d5e1a7b5e4ab72c1d65a70fa2177be0b83c02b956a6a13ec9196","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/traditional.mjs","sha256":"cd25d765fe66d5e1a7b5e4ab72c1d65a70fa2177be0b83c02b956a6a13ec9196","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla.d.mts","sha256":"634d7cb046d631ba20f44a6d4815d1f22392ea2890241244b7da279a3f6c588d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla.d.ts","sha256":"634d7cb046d631ba20f44a6d4815d1f22392ea2890241244b7da279a3f6c588d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla.js","sha256":"f631c38b00fb596fa352abcca8cc3d653be43f443edbbf29da7e751598083fc9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla.mjs","sha256":"8ffab250292ec8ebb85d660d8dcc18e6610cbe46de486bc3cb4de47e5ee1fc8e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla/shallow.d.mts","sha256":"9950c31763b3fd6b374362c2d6fbcc5992399e7315a8d3d0bb766dd4797664c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla/shallow.d.ts","sha256":"9950c31763b3fd6b374362c2d6fbcc5992399e7315a8d3d0bb766dd4797664c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla/shallow.js","sha256":"d714d964b7ae1f0a01f312ffcc0ae743d9a33d540cb8527eb6a9258acc40727d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/esm/vanilla/shallow.mjs","sha256":"d714d964b7ae1f0a01f312ffcc0ae743d9a33d540cb8527eb6a9258acc40727d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/index.d.ts","sha256":"751bd502523aad8cf27e23e3a86571c10a36cc460c2735d8903d744230dbfc67","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/index.js","sha256":"fa1fedf1ecea07322c94f21997fac1d8b3abc8e570b3e593fcaaba0bf3e0a8c6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/LICENSE","sha256":"f0dcbb086850a46d51446679126b274b0752801d85ca1f6ddb067ed046ccc2e2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware.d.ts","sha256":"2c9f51d489cec99d883c7fa26f1fb9812330aa5ed3a508c9e31c5780dd061774","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware.js","sha256":"efacf8fa1a2e3eedc1dc7a34b7b2cc9ebfbf6856fc20a7f1d93d0420bfa81f19","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/combine.d.ts","sha256":"1486f1df6ca22705792e7d1aa542090ba61cab662e229fe8a25418350d18c9a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/devtools.d.ts","sha256":"c8d390c13e75600360f1b3d58df5ceac97eec96d40aa178d7aa54a9d5a5b23c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/immer.d.ts","sha256":"566195b03e53e3e0dc765b068a744332575b67e15baf5841114b844a31155031","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/immer.js","sha256":"d6ef4e5faea00c782689c905eb5f5ce54c19062024f4a7d2391969bae680d7c3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/persist.d.ts","sha256":"0e91f24d32b47be3593b8ae84b5100206aa346ae8f7086f03794a1313c19c29f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/redux.d.ts","sha256":"e41f8bdcbadd8ee94d7d21bc14636bcf06397a70b0631c6142fc597f3312511e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/middleware/subscribeWithSelector.d.ts","sha256":"eada922976b17299ecaa5b31b2cdd58ba41d87245dbc883746cd7dd6bff8f00f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/package.json","sha256":"59973bcff20dd7dcb9a2a87bb318d07fa9c944ea0fecb405f753124451d74d7b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/react.d.ts","sha256":"51473e38e063a0a63867ab1d5a8fa101bfa897598aa13fdaf402c82fc390d27c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/react/shallow.d.ts","sha256":"e8db26198e5e8b537bc456f74f06fbb17fbab2426340c133f3b243fc0bd06139","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/react/shallow.js","sha256":"f619c8455e52398fed927359bda7b90f404986a6ba6f00e6abcbf29a7fc3fbd3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/readme.md","sha256":"32a5dac162c7c2a0cdfbf8eb7aedaf7ad28b7e88a8ffd233001d913c991b72a3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/shallow.d.ts","sha256":"685e133328ba461d80142e9b227d13bbaf8b8528783bc7ac9511685280637a2d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/shallow.js","sha256":"a1773f6022bc3c023cbbd483db490045628d01517d0ada4f99bc2152c68fb0d5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/context.development.js","sha256":"32ec2a09def1c2820f0cc1fbbfae28ed124e8831ddb2bde834beed8f42599521","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/context.production.js","sha256":"31e71a071ec9d0839e60ec28955676c014a6d737745ea18a65ccc08b343551ee","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/index.development.js","sha256":"277e7b9be18ae84a1acf498dfdb0cfe5fb6233f448d88bd858fe329ab25cb058","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/index.production.js","sha256":"8ef577ec27da9d81d53e8573570f24fece7434e90bb82eda8e12ce464dc547d5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/middleware.development.js","sha256":"a1830cbf72d0fb23963a0d868ff39f55056d79e79708b91b4335b61e9a0e65f6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/middleware.production.js","sha256":"36d9ca86b9b27f8b34a13504216ec2207044d6f1d438d58579d4f4ab658da300","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/middleware/immer.development.js","sha256":"9e8a3fb9a007e3ede8b305819100f3e06b8d0e89070a9885e86fa902b3c69511","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/middleware/immer.production.js","sha256":"16346983c204b05b3599fc90f106b087ad574f64c0d32c9d493ed63bc3dc055f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/react/shallow.development.js","sha256":"002540d6df1b35ef0df4a6ef59a275589590aeefda3a5a2ed590964585893b41","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/react/shallow.production.js","sha256":"7671dbe7d073823a5089fb1289c70ea1c4e1d1e29572b49a6dfa31fd9b4e8a69","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/shallow.development.js","sha256":"196878064ee8c2c5be0f92c841dd242aea063159233fea8a4681328f031e4668","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/shallow.production.js","sha256":"aab3c300c72f1c1d06bd02f296e4d11b2f74abec282c45da582142282e9af0fb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/traditional.development.js","sha256":"c27df8af460921e803862a30c41d06f62191611b11789ee0734b85f406c5a046","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/traditional.production.js","sha256":"5a8401f113e54cd60b0ade5cbe2dc4b88b8361edc6ad0b9fe0b40c903f88aba5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/vanilla.development.js","sha256":"aae2257be1e5a56ccbca0e266bdc445396b3ca1577f01f42d8c3d5a4ba41f5c7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/vanilla.production.js","sha256":"7a2a67f995741705501994fb2e8fceb31f49f3a89ebd93e357b6bd6998ed4f9f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/vanilla/shallow.development.js","sha256":"48c8a94eb4425b94543c8e46e253a39bd28a0675fa2ab355fe180b2a0edebc11","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/system/vanilla/shallow.production.js","sha256":"9b36946fdcb6673b9bcede907c01c1e8e10dde0de71cd18c4eaddcb6ba1181f2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/traditional.d.ts","sha256":"78e16aff16e2a84aae62eae9cb0ea3533a717e729df539a6ecc6cc855539b836","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/traditional.js","sha256":"68684184bb34618f2f343f8cd60c2541976a2d55960945d29ec36a6e35d6b5ba","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/context.d.ts","sha256":"9d3f59ec17cc2b15b9a2dca9e96fa32552065a62375470473bfdc538c293a03d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/context.d.ts","sha256":"9d3f59ec17cc2b15b9a2dca9e96fa32552065a62375470473bfdc538c293a03d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/index.d.ts","sha256":"751bd502523aad8cf27e23e3a86571c10a36cc460c2735d8903d744230dbfc67","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware.d.ts","sha256":"2c9f51d489cec99d883c7fa26f1fb9812330aa5ed3a508c9e31c5780dd061774","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/combine.d.ts","sha256":"d4051c37e53326212235baccc526205a8668aa882f40d0dbd9e575908d81d756","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/devtools.d.ts","sha256":"206817e8a4a96757a4776e1d67eab4a6bcbcfb04d6b54303ca14d0eba536f824","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/immer.d.ts","sha256":"a7a950e8e74073ed3c9f375c78f0247f1ca77ae3e1230963f6e2a1cba8681dad","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/persist.d.ts","sha256":"53d1ec614bf588baeff1013eb8ae36bdd096ef40bf9bb51ed7c1ec2b5fe0cd2a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/redux.d.ts","sha256":"4f058dd0dd0bfa04d6a9c03922c8290b6f3ecd6f631fa77c0f3e8b048571656b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/middleware/subscribeWithSelector.d.ts","sha256":"45b7fef7d68d950a9cf8926e164e576b7673605b5b5301c542d4c43238e36061","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/react.d.ts","sha256":"fffafafbe314cba2256ef378cf38edaba850155319779992d074f8f389158a55","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/react/shallow.d.ts","sha256":"e8db26198e5e8b537bc456f74f06fbb17fbab2426340c133f3b243fc0bd06139","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/shallow.d.ts","sha256":"685e133328ba461d80142e9b227d13bbaf8b8528783bc7ac9511685280637a2d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/traditional.d.ts","sha256":"fa24b1feaf3961761185330993e2ce980d96ce27184909e6c81ce968712f6443","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/vanilla.d.ts","sha256":"f5cd87209c050e8ec5daf6af71612c16032e747f65eb25165d5f277063e3115a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/esm/vanilla/shallow.d.ts","sha256":"9950c31763b3fd6b374362c2d6fbcc5992399e7315a8d3d0bb766dd4797664c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/index.d.ts","sha256":"751bd502523aad8cf27e23e3a86571c10a36cc460c2735d8903d744230dbfc67","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware.d.ts","sha256":"2c9f51d489cec99d883c7fa26f1fb9812330aa5ed3a508c9e31c5780dd061774","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/combine.d.ts","sha256":"d4051c37e53326212235baccc526205a8668aa882f40d0dbd9e575908d81d756","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/devtools.d.ts","sha256":"206817e8a4a96757a4776e1d67eab4a6bcbcfb04d6b54303ca14d0eba536f824","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/immer.d.ts","sha256":"a7a950e8e74073ed3c9f375c78f0247f1ca77ae3e1230963f6e2a1cba8681dad","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/persist.d.ts","sha256":"53d1ec614bf588baeff1013eb8ae36bdd096ef40bf9bb51ed7c1ec2b5fe0cd2a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/redux.d.ts","sha256":"4f058dd0dd0bfa04d6a9c03922c8290b6f3ecd6f631fa77c0f3e8b048571656b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/middleware/subscribeWithSelector.d.ts","sha256":"45b7fef7d68d950a9cf8926e164e576b7673605b5b5301c542d4c43238e36061","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/react.d.ts","sha256":"fffafafbe314cba2256ef378cf38edaba850155319779992d074f8f389158a55","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/react/shallow.d.ts","sha256":"e8db26198e5e8b537bc456f74f06fbb17fbab2426340c133f3b243fc0bd06139","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/shallow.d.ts","sha256":"685e133328ba461d80142e9b227d13bbaf8b8528783bc7ac9511685280637a2d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/traditional.d.ts","sha256":"fa24b1feaf3961761185330993e2ce980d96ce27184909e6c81ce968712f6443","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/vanilla.d.ts","sha256":"f5cd87209c050e8ec5daf6af71612c16032e747f65eb25165d5f277063e3115a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/ts3.4/vanilla/shallow.d.ts","sha256":"9950c31763b3fd6b374362c2d6fbcc5992399e7315a8d3d0bb766dd4797664c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/context.development.js","sha256":"96b01c5d0e5294d3fbb8c1f6f59dd3fd8acba130211afce40e8ab6f51511561c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/context.production.js","sha256":"ed9051bdf039691725654216442e98d93bf9f9fe5b19a1bd5ef2bb8408b0fdd7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/index.development.js","sha256":"d1e0909b653b7a0c52e6026606c9dac8105e4bfe5df2d2f1cbb2e907a98d3d25","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/index.production.js","sha256":"4b1bc81f831a15dabf4402085c6359527ed7e8f218877a4c216f143c7cc0e5d7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/middleware.development.js","sha256":"5b9dd40fd594dc0601ebca19fadc61dfbe8d9f8f3e4e610dee443c9057586154","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/middleware.production.js","sha256":"1486947f8c959d439049af6e9e79858094414d8b8521bb9467522f311745dc5f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/middleware/immer.development.js","sha256":"aa06280d94d2b1659305d0a085600f13dc3fca8b357dcbeecde5a19a5629415b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/middleware/immer.production.js","sha256":"94a92333d3c3de5a19a3534b1a021ad95bafa7ebfd524c90a9d451ab99ba8da9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/react/shallow.development.js","sha256":"101706392fdaa666a17b1a5b3e5e6f11448d85c6259aba8d970a7681d3b1ab4b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/react/shallow.production.js","sha256":"7361ba510b75856fbbc58cc5bf65ddd61297a6e9c80eacced694de6d1a07209c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/shallow.development.js","sha256":"c199fb9ab5101fa5de6c91c0e91fdd4c6f45c65b1918cc5d2987d09d42dd67a9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/shallow.production.js","sha256":"6b237be8a5c8cc76b5627c9dc3a0bebafcdab7a31d77a9ddb622bb7a4e6f48b3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/traditional.development.js","sha256":"2009f4e290ecf65d01a32597194dd6c6d5bfcd29a4a2b0088034dcb0a63a8b81","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/traditional.production.js","sha256":"69a4a91d30ac216aac14d3689b6fdfa819386f38dd60fa3491f9f8f74b56e547","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/vanilla.development.js","sha256":"b4ba09bd7f91b499094dd37f284b0cf62968a7c8158036a961507666923b9f89","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/vanilla.production.js","sha256":"a0da3dabcdc44577d40909106be46a8eae1fce8e06999486e873bc0d201cd45d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/vanilla/shallow.development.js","sha256":"a310262b6d8ecd1e205e5d23b7ed3531a8d5d6e25facecdeabc9cf2bf34a8da5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/umd/vanilla/shallow.production.js","sha256":"48b8bc7a99f38e93483b698bd8b4c4c3c4369c578536490bf38cce3afd7e087f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/vanilla.d.ts","sha256":"634d7cb046d631ba20f44a6d4815d1f22392ea2890241244b7da279a3f6c588d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/vanilla.js","sha256":"af63cf37e335a3da4771a19613e749b1d160077b55a6448ed9a60fa98f1d0ac0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/vanilla/shallow.d.ts","sha256":"9950c31763b3fd6b374362c2d6fbcc5992399e7315a8d3d0bb766dd4797664c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/node_modules/zustand/vanilla/shallow.js","sha256":"9b566c5f790a94062d331a6d538d08469f7ff07999c867f46b5beb960d775419","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/package.json","sha256":"8264395ef93cd2d5897011dda12a37f4453457693605a7ff75db572652573f86","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/config.ts","sha256":"d7f1f9b704a66f790aafb01a0204d91c16704b808bd0474f51da0cde383328b8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/hooks/useWebPhoneTrigger.ts","sha256":"4a05cdf94c08201b22e464d0654eb722203d2b71b03ae33f8272ca924e23227c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/index.ts","sha256":"ef8cbcebf8921e4126f0adad9049414a0e21e25a1ef7d10752a6f441e1b450e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/types.ts","sha256":"2cedbe2240694872d4561ddb2c597561f0385f3f0498bb10375918ace847aa5f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/utils/dtmfAudio.ts","sha256":"fc5a1f14172da99599b7930b9c3ddf6a98041ee34753147f948b5706fc95ffc4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/tsconfig.json","sha256":"67d9c1901ef4a57dc5a1d58d3d2d402381eb5d3370581e3bd0efc4bbc4d931f3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/tsconfig.tsbuildinfo","sha256":"ddf6f6e420a028628a50f58cccc3c9556b801dc4866f9d3394e7e4c6e43b1ed8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/.agents/AGENTS.md","sha256":"b27bfb8a94834a0acedd098aafb02cc08647d53e8e863a7aa28415fb342f7629","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/AGENTS.md","sha256":"f912f3c00fe85dd9e091dc55f91ca7af6e831c71d07c33b00aeb39d9c50891fe","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/next-env.d.ts","sha256":"7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/next.config.ts","sha256":"5156e3e9972495248291f82c9838d123051c365e25cbaf466fd2010c20d313c6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/package-lock.json","sha256":"936861d2ab3bece8b4d8e17a824b599b361a11845c8853bded3b42c1e49b1d92","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/package.json","sha256":"1af361663d839997fc1cf21157f35c5040067d1653271a13e21d5a122c4c9453","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/README.md","sha256":"0707def6190fedda7418aaef95fc6e086876f775dfafffd5380999380480d9e4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/globals.css","sha256":"42070e0b45bb201b2b838a52aaaa6e965f964e0b542d97f1fe517fe59c4b75a8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/layout.tsx","sha256":"5a128d3393b91cdb4ee3bc10b3d074908068cfccaefbbb8b452cec2d3cf0f655","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/page.tsx","sha256":"0b879e41c93071015a2a66998442473c31ee23752ff4955ac13842988eb67d51","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/tsconfig.json","sha256":"5c51df4c59f4510d8c7dadf07a5c32132228826a3b331da5e286207b4df7ef9c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/tsconfig.tsbuildinfo","sha256":"95860cf1049be2a2ed477409ca96f68fcfb93718078bb7a601b050258758b2d9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"pnpm-lock.yaml","sha256":"ef19ef17da5ad5bd12a516442ccb776414fb8b81d42281f7925ce9e4ce7db1c8","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"pnpm-workspace.yaml","sha256":"9b776e1455cb57ab6425561cf7fcbefd8ff562f78f2da8d3e66adba3eacf423f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"shared-libs.lnk","sha256":"1a4e1b909b1e805b1cc74aa748c84443040f68dd34b56a544f8eb64f7483a61c","mode":"metadata","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/.agents/AGENTS.md","sha256":"96daea99f77a5b1fcf35189df7d8a1557cc90ff26f3ac493a69433a14c4dbd06","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/.env.production","sha256":"40ca9b967f16817ac6af50da8526c6900f59ac6aaa7c32e38f875e9f23d8b09e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/AGENTS.md","sha256":"3edf44fcc2bef334b5b25e7d52afc72cb8caf817aa968e6d22fc2e8c94683fa4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/CONTRACT_VERIFICATION.md","sha256":"b7fe2e0d430f695e4773a2172d459976c65a11c91aa2e3fb71e1f1a8c8c48dc9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/DECISIONS.md","sha256":"0256ed08bfb710fccfee24af548b8c3d57d21f6cd05d46a3fc8e122fe48ad500","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/FEATURE_TEMPLATE.md","sha256":"5836459a0c1ba9899e4cb5ecbd14a5bcaa48aa1a0ad379840b3671e9ce988e31","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/GLOSSARY.md","sha256":"e44a6bb146b20d0aaf3c3d44f5f25938ccef1a7d287b7b95623f89d4f6452bb0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/IMPLEMENTATION_PLAYBOOK.md","sha256":"ddb210947f912e5c45867915403fdb71b075b5ef27646cbf4a3fdbb1682ded4f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/KNOWN_GAPS.md","sha256":"332f98397f1e240cbedddcd4f29e6134414e2690c3cd958e9d7829bdc3fbc2fa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/PROJECT_INDEX.md","sha256":"2e9bd6293fc31ae894e6a8f1c4d7864e471f503b137ff77a20fae1bed33ea768","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/README.md","sha256":"a5c696d702af815c2a745429dca6f62ec05f98abeeee1190668588c20e5d9b26","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/SOURCE_OF_TRUTH.md","sha256":"5f949c4ad305825f68d0c61b8e86538492b5049eff530e9f80f45b8c65152f65","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/START_HERE.md","sha256":"fc3a5ff6b8c14ecb6a1d2947ce214e4cc34e9e78c5280fcdf75a35bbebe52ac5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/SYSTEM_CONTEXT.md","sha256":"f4dbb8382a5822620fe6aeb115a4b4b804b8ef5e972e1412837d8ef6e1703bad","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/TEST_MATRIX.md","sha256":"8b9eea0a8a212e329fc94e50848b8ed361ae90939d7f58cd51adaa575451eab0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/activities.md","sha256":"4e6410f6aa8827099b504703c7d569ff3e1171e3e614b1c168a4027689460fc6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/audit.md","sha256":"35d43768f87256b0b48a386e04b7fefb958af026e063eb689b485313052c2f76","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/auth.md","sha256":"ba903ee118c4d618bc83e163720a3e7ea914a7927d78cf86ceed2b4ff3eed598","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/billing.md","sha256":"a12208754b0e7a2956947798d091cf03d9b0e024f17a8204c0ca4fe078821e83","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/business-letters.md","sha256":"dd24839e625f14cf7c38699ceddbb6075eff088b14df6a196e9f841eba966384","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/acquisition-sources.md","sha256":"0c86166347fa9a480eedcd7d3cc645e02a5b5e22373288e6e080f759b615923e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/activities-tasks-calendar-reminders.md","sha256":"f53784295234a122c3066290f64cf0539e56b2aac56d1397498b99a974c3540f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/common-contract.md","sha256":"0efc422e860dc1e5f46cf837c35dd9765d48341199e0b88257805777ac481a60","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/custom-fields.md","sha256":"cb042e88d47bfca0c650f4ef57e7cd8e77359f2578915ad09d9d7f31d0c397af","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/customer-profiles.md","sha256":"14bdd86c39bb598b806da14862781a6ae2c917096556a90006ce41206a4e8a3e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/dashboard-builder-widgets.md","sha256":"8f3f37b688459e5eb9e4c81b03e21f5b580cb3187decb100ef2868db05e2cf03","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/dashboards.md","sha256":"5b29ff0e8f560aa34d992b87fe7a75639dcfd36ce2a4d6cf5c28c9fe047aa02c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/examples.md","sha256":"fcc60aa67b2072df254f2b6b8c1f7c793029a928bae3d44c1f9e82395d311d7b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/lead-stages.md","sha256":"f45ba85f086c868e60f122c8c866dd80950043615b1789f305944b109cdeea1f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/leads.md","sha256":"7a0d67f39a0b00ef5683bb83a34f9406a3e4d9bd007316dc2346b1669ba546c2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/notes-attachments.md","sha256":"826f97d1772813165ff260223a5a76a10344004d50d32a69c9f3c010da3cc0f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/opportunities.md","sha256":"5a61f5901d55c3382fb56ef24f0fb08ae97a1fee755f144c4f22bc3fac9d1799","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/outbound-emails.md","sha256":"4e405a2aa0311e55224a719a5733621307f6cbf4020383ec9d57978abe0a2872","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/pipelines-opportunity-stages.md","sha256":"0b80e8103aa0eb3b8c2c9ab5ccac987bd76059726dfcb7353deb04a4daab88d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/README.md","sha256":"8a1bc77d4243b968ae1dddcf832b68d0241b9d83edd044a29a333f15ae1046a3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/settings.md","sha256":"d36107e1d3756675b42dfc25ff949a3128eddf2ee76725c7033fd15cc41b3afe","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/static-data.md","sha256":"47ce5df414e89ff84f983ed6ea6f64b8dd8cf8e29275eec844df8afcd34aac4b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/directory.md","sha256":"24bf9adc3ea56a0f9e15cf58a75ffbfd68faf4652ec6cea8d76d6aefca3acf03","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/files.md","sha256":"a496bfb7f42d10146df13b641abf2196b755d558c9e501fcecddf29f8bbdf987","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/finance-configuration.md","sha256":"519eb399927461206a9c56e9932e0914ebbf1b59e14c415bfc6de52e9e42c5eb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/notifications.md","sha256":"c0b5ccb39183765db04d3d6d1ab97121272523145f566724e09a703eb31aa7c6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/organization.md","sha256":"0a543498706b00a820cd1b60b407f97ef156c8ff68eb15f946d896f23f7d30a7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/payments-wallet.md","sha256":"e9d86000bd5eddcfce8970d758160fd4604b445ddf633e9ea347e4309a6a8619","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/provisioning-updates.md","sha256":"54569684c9a11edbea5fe3bd4dba4a45acea250fb288eb3f8574324c64b10624","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/README.md","sha256":"48145d2fb86a29d287e64ded4c62b7c8dd2e05378ea624323536caa4da64bed5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/roles.md","sha256":"da1bf44199c9c01500d17b0e0577cf77d32433285134d86ec639fb6b9204a2d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/settings.md","sha256":"417cfdf0815913162303a89540c623ac5783c7012d563d6b2d7d697ede65e408","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/templates.md","sha256":"2dcdc63b3f2f372d02a967734003d7f5ce1394279d618780612d3e7ea6f3e55c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/tenant-host.md","sha256":"145cf27d69916b88dc53bfc28b774a8ee65ab2b4810ba17a3b3a74fa6b55570e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/ai-implementation-guide.md","sha256":"84a1258081a5d698833fc1e320e36cb2567df325251765e5e95c1a0c056b6957","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/catalog.md","sha256":"9e16be2953e9b3999ea5e8e66a0c1cfce9229ff0ccf043bd70c9c5a42bf2f521","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/commercial-accounts.md","sha256":"beb1145d0819e95e0457b315ab8b38a99e40dd98942c077f99a07eb008c084d1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/configuration-scope.md","sha256":"d9885a96b2189a3d95efc19d72067017a62b841e00741987ddd38bf2c5dd2506","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/control-tower.md","sha256":"8b8c136b449722bfe81b5446160bbe272cd166a2adccfe8fed83c303b8b379d6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/dashboard-widgets.md","sha256":"079f11bea5c824bd40297a4615af95dcb4c31e2c6419da492fe25eba4184fb90","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/dashboards.md","sha256":"9f5e1474f57083af7f391c1cea5cad1613664ca4d991887c6ee7957bada4059c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/document-platform.md","sha256":"ab82272ef224aefd555e827e214468fce0f6b4e1ef797f7c745564c6fed2f7dd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/documents.md","sha256":"f88a6c02033647dd59a4c3c597e9c17d6c42804a17df6329affb031065db55f9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/examples.md","sha256":"80f3ebb88691bda087e7bcd9ace98a8cf2c8ee52f90910d268ffd85e2149a167","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/extension-profiles.md","sha256":"3a8ac227d8b6e4470d3819d8670b333a73b74ccac8820f321411e3ee3f7cd387","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/extensions-automation.md","sha256":"a82ecbf0633a97f3bce1333032bca437b248e888c588492db5c46710a96c93b5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/financial-documents.md","sha256":"c8665abd996ee030b953388728445d3b1955af750180871123b20b8cc3b53a9f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/inventory-pricing.md","sha256":"d50cc8b246f89d37ba5cf6136c079b87d17a1f5fcd8c1d54f7dde6a9ddd8b380","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/inventory.md","sha256":"82292e1f3cff3d8933199958791bff21af41f7c11027eb75e0e76bef9e0f1c06","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/pdf-render-jobs.md","sha256":"378178e46e47a1c9ec93d6abcecce6c55239e2cd7248128550e156accfe7c863","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/policy-studio.md","sha256":"c2afec64413f3e84f9bca9085b9e649e8eb11f3b3c587e813206110e1e827978","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/pricing-price-books.md","sha256":"24ecd4cc471fc23b5a1285b5beec89e58dc0fc64ccda0d8027076fe13d565e86","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/purchase-quotations.md","sha256":"753a7c1d8319490c50583041af481e95608cc3a952583dc3c7ff5b946296337f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/purchasing.md","sha256":"be8323ff7ef6802d3cbc86f4c350f67593efa24b9563fd498dc40297e0c2904c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/README.md","sha256":"866650cc80ffe6a88915671f0d8f4ad3205457bf71cfc5eab70820462ec95c6d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/route-coverage.md","sha256":"2d7b5fe06033adf78a4403275eb40aa7b737d089237167f4b16d7e61fbab261a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/security.md","sha256":"f5b57d8551d5034381e157fbd2946af3b0560bb41528549182e40bb2c5275b7e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/static-data.md","sha256":"777daca77b556e0968644d636602beea9268517f6c0d177edee4af729c274792","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/validation-reference.md","sha256":"60b75b19a431b0618cb7ef3d51aa4ca108b7341afa068d4e36e94d59c7d5f972","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/workflow-versions.md","sha256":"644cfea4dfbb011755898f681e09a1455ca72c345fd5610badd139de4f31e385","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/user-modules.md","sha256":"0b083c59b97bc2d8c22532d01444e746284a1f0371503443532678c9b3ebb54a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/users.md","sha256":"ab5d1f857ee2f29ce6a7d98463594e1149a29665e1ab862430f7c440b8672490","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/application-architecture.md","sha256":"6ce736117a42d869d18470a3cfc7febb53c49f5e446931956f244de98a2fa469","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/capability-map.md","sha256":"41f3bd0ef27419f30104273c183fafcda41a67eaa08a26e5af30d05e06fde5d6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/migration-checklist.md","sha256":"e8ad725ac40d1ab00d85ab8a41b9976929b6d7c2acda6c4903ec21de6249aecb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/replacement-scope.md","sha256":"69a7ff6142c94b79fe49bb9d6edeb701a3d4a3dd2edb9b546658d18f77ee8138","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/route-map.md","sha256":"82a7e15dc88d5fa7571af0f5ca856fa0c57bf36c82ec26652acad7340fdb029a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/asynchronous-workflows.md","sha256":"05168ee973f081873d579db859573ec12ce4ca7511783fec4d8953931ecca555","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/authentication-and-session.md","sha256":"fa156fb4dedfffa4f71b425278dafea32cda783705b094839617bcefdbf37853","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/authorization-and-entitlements.md","sha256":"32b91d9e7eb6265f8cd5ac70e524fd31aab16b16f06ec6661296912ff92f1e9f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/request-lifecycle.md","sha256":"8f517d78742b54ba2aabe9627dcf33a15b9e3d47b22f57ac53244780c13c0b2c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/system-context.md","sha256":"674b5065e0c71608885c28bb41e385cb544188c2fe0152ca0940f6aa8dac574f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/tenant-host-resolution.md","sha256":"2315585ab6b01e61407ef97186095cc68fd4deedc0b58820f764283e285ccd72","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/coverage-matrix.md","sha256":"42e3f6d4caad96115575523a3cac15e3da1ff7945b51b95d4382b8b2b27edf0a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/README.md","sha256":"3dfc3bf935ce0594b238d13c76e96ad80a4bfeab017e813524e3f88042cb7b60","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/replacement-inventory.md","sha256":"dade54f024c9c32c35e324f0a630ce5f865707a47114771852c72510a15a43bf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/DOCUMENTATION_CONTRACT.md","sha256":"735d6ffc287988eb9db422920b66d8ff304935e23e62a286a17f505fad47c58e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/dtos.md","sha256":"0cbf61dc69a75c956eb9bef384cc3c6d083e46ffc3d3f806db62e6d1bfe55b06","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/api-requests.md","sha256":"ac9279030d3163b9cbf2eac085ef12cabb773e6a473747a90bb3dff49c222d04","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/async-operation.md","sha256":"4c60a78e9d913006fa011ff5cb5b80c5a2466bbc0451e041fee641809b6acd82","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/auth-session.md","sha256":"cffb3810dd286884f806159a0aa3497407b9dabcbeb4b4ee9948153c0a9c52d2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/feature-api-module.md","sha256":"da96363a8d444165b76d00733abd210a4268213bc2a966fbe9d1f2bfa8050272","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/README.md","sha256":"be144f258f54fe33b949cfcbb823338d29afc415415a023c65201bdc3d3570dc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/validation-and-errors.md","sha256":"ef32ee0cad1e4c92687cc3aab5db9d8ba50438d7770de3c110ac15ad97e8d28c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/generated/tenant-api-routes.json","sha256":"322830011646208ea457c4e28fbafb4540675814f7d241f824e1419fa00af8ae","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/generated/tenant-api-routes.md","sha256":"8fc02e0c4deb904dcf6e9a2ae3733bb12c3f0260a5366a34f2bcafc326eb96d6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/rbac-matrix.md","sha256":"288fc749058343ebfa0075e0ca8ba3c065ceae2a390df3b791ba37afa8c0d1b1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/README.md","sha256":"c73cc3faf6a83f66b7197855da5c4d87df6658e13051ec23603c8a8fdbf2264d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/browser-and-session-security.md","sha256":"316af3025c4a4edd093a4b292d76aa6eaf39cb25fc48a1a4be3293895ed8756b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/content-files-and-redirects.md","sha256":"b27f0242341d8e0163e5a2d1967d2318bff2c5fbae9104db0ca5859650bfcb6e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/README.md","sha256":"739abc962dcbb3fd235f9475a80069bcd353acc0304558a545724fc776feeb17","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/security-verification.md","sha256":"a3c3f46fe241dfcd0ff058acc86d20b3833acf1d28b245dcc2ac58e2f7e77156","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/tenant-isolation.md","sha256":"f23a856adbc642257ec7b3c767978a6f61625c671d2d4209a21796ebe1d7f4bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/threat-model.md","sha256":"577e11e28f4391bac972fdc378d3be24a49aca1e8dc19d9271eee811453092c2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/static-data.md","sha256":"80f74f2150a4778da291a7f41a18f0c5db8e44514676b696b87f40b51f685722","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/error-handling.md","sha256":"9bebf7a0c5aa09738d47b9db2eccc97a4a300c4441cd4442bb48d1dcec2114fc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/README.md","sha256":"78fdb6ac385149f86aa56ef7ced097147649fe2697075d5f7acba8435dfbb99b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/request-validation.md","sha256":"a653497aeba322143dbf68954390f36dbb95fb8989bb4bc11a53f9b573b21eff","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/response-validation.md","sha256":"78a27212b847ff502dbba47c0b358a6bf185fc64623e96b7f0e8f12668fdc7df","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/state-and-concurrency.md","sha256":"e53e9836682dc4051e6c1f944c8ff8b81acdcdc29f253511b8b930d035a3a207","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/llms.txt","sha256":"a9898df98468813d28d1701305d9aa06a7d4208e552ecfea98268c4fa42a1d1d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/next-env.d.ts","sha256":"7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/next.config.ts","sha256":"45f6336da4f1c0ad5b2b432993f672f528d0737a526509b2166bd5dad865f952","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/package-lock.json","sha256":"a7846003fc09374a3414ea64b9b1c3f6bba0c127e365254525cf2fcaa42b1a97","mode":"structured","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/package.json","sha256":"ae348fe50bfbb21f3c754c247ad5c383a8fd9d012c3e944054d2ff1aac236da4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/README.md","sha256":"d8a1176244fb17d0f1ee0ec2373662760530926447232cc0dee9bf198925560b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/docs/check-docs.mjs","sha256":"ed4191da532f4b7f07f26d7882018e669c72b858755491ed870543ecc60526d4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/docs/generate-route-inventory.mjs","sha256":"bb420469ea5239a104649c044808a461daf11386a5564ab6606f4f0e0eee3258","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-scope-errors.ts","sha256":"fb0630aa85af56c2146972d7a91d0e50d7ae80e2344848c8eea02fe96ce902cb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-tsc-errors.ts","sha256":"a31f2385e8eaacee2d50d7d4d9cb3677d36e086b5dd7afab8aeaa79fb7a2a00e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-tsc.js","sha256":"2fb23f014d5cb6a74a691feffea5a9affcc086f0a1db5e85dc5f809c640259f0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/i18n-crm-codemod.ts","sha256":"3ef9862be596d0b059167774ff7404a668d5030298f492be930f53b853cee805","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/general/page.tsx","sha256":"9ca5f6e5cd73605f07515249fccd37fd9d46edbc13c0dd745a2862ef6e872029","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/history/page.tsx","sha256":"73e96cec6b577e2e8839284402e4c1721ccd2952819c6e9e98d08d56884a63f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/layout.tsx","sha256":"c65b4373d7865d4fd0c68d998f912d68f23f8811fe8fa54af034c6b980227ac6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/settings/page.tsx","sha256":"b17ad78805c329117e4df8c15f6e69476934e82d88ec6ba01f8ffb0968d4a720","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/components/CreateActivitiesModal.tsx","sha256":"59becdb98ce34dd2bf670777ddca481fd891364b88107c6653f4ab641455a6db","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/components/DeleteActivitiesConfirmModal.tsx","sha256":"108a300e452e47bb16264bec33ecb63273ef3840894f71bf4b0998e5a57a1894","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/hooks/useActivities.ts","sha256":"d7570194f7f65cbad3feb85e0ab1699c3c629c6acfef107265e2f3138afead11","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/page.tsx","sha256":"67b040101a8f4efd2de5d831394b01832b6830c943cd29e80192c2f33e5b45e8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/general/page.tsx","sha256":"7850cc2ea2a172898145d322d7d613f9a6e8bd9fe09f67c8be17212d3501475a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/history/page.tsx","sha256":"9086eb21e141723c481d9b5ec9eaa1c25f0709392428eb1de43b18bf5daf00cc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/layout.tsx","sha256":"8e6c2e948282f9aa2a5abe9a1f3570cdab4a86e6412e401093f1301005cf81c7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/settings/page.tsx","sha256":"4686e9288b1732dea2ab40c38c2cb8b3b1853fc5f4e08cf8f08702aa0fdd25d0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/components/CreateAuthenticationModal.tsx","sha256":"fdae06e35e3f2b8c0f9bf3df22a211381d33a118e6b3bec6a5688c7da0f686d4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/components/DeleteAuthenticationConfirmModal.tsx","sha256":"d2b25dd46730b9e2412d77d5f39cdf738b14e7f91d52cbc1ce4b25715d33f2a4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/hooks/useAuthenticationManagement.ts","sha256":"ccb27456de50ac4fc173d78655921656a719ad7feede03ba156c4626c0d29535","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/page.tsx","sha256":"1ebd8caabc0c4e097401b756f411ba47c59a0f3f80f996d4057279a6acf628df","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/general/page.tsx","sha256":"df428fec479f57fbb6dc8d1175755f9668d5fdb4131f2654055b87c85589dc70","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/history/page.tsx","sha256":"76ba60ce2c26d231cdccc1075c46232dab472c97d0a819ebaef1859a2e7e318d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/layout.tsx","sha256":"7185b505a791187ad3e65f4620b4f26ce33b83113d9c7bfeb5a8cdd8890d08d4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/settings/page.tsx","sha256":"9f7d15843c37233043f33099bb5e2ebd06d62ffa61360c93c9b05930e8ee550c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/components/CreateBillingInvoicesSubscriptionModal.tsx","sha256":"821a9469acdafb28dc9adc128b1cab86549b7ed277b8d3907ac568e0cd28482f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/components/DeleteBillingInvoicesSubscriptionConfirmModal.tsx","sha256":"2205014f06a9ad44dcf1475a551a64874d42eb99ca3882521994e19c82f6f36f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/hooks/useBillingInvoicesSubscription.ts","sha256":"a2e22c689dc9786cabec851db1c782e6af1ae4ef0e0eca39ca72af2818a4707d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/page.tsx","sha256":"3cb139028e9daec4c5248c66b3209cf64987ef2356e1861bf4cc62b8ec7f3563","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/general/page.tsx","sha256":"9982c765099586c13af4ec249b7bfcd995f3786a79bcce81415d218627960810","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/history/page.tsx","sha256":"5dc7932a1eebb9dfc49fbb3bb120786e679f186988091d4f6d6ff8a8b650e209","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/layout.tsx","sha256":"8f3cf52924bb737ed8edca07ca2a60204e05516acbc8e5b2406973aa992a1410","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/settings/page.tsx","sha256":"b12713958e71119e430c7c5bc15fce4248bb419f61369a354398729d2c1a5109","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/components/CreateBusinessLettersModal.tsx","sha256":"cb4c957e228d814c8d07419e2f2bf71660d26b23328aeda160ee391f7da9660b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/components/DeleteBusinessLettersConfirmModal.tsx","sha256":"f288072470e2124b82926478681450ca93b3a596cb5899231178d274b49709e7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/hooks/useBusinessLetters.ts","sha256":"d8a7a5a5f80802ea96353c2fe44cbfedb0ec155ff5a89927b5e52c529ad739f9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/page.tsx","sha256":"344419cbd86955dd021374778ffe68b427716d79cbe4a8c8945a840a0c01a3fe","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/general/page.tsx","sha256":"8797e61990bd7748dcee576cbba51401d4ca55aa852c29b50acb2bf01112438b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/history/page.tsx","sha256":"161c2358ec2a65c8fcc6e7accbca18f3802e8aef204995e6790f5dca12a740ae","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/layout.tsx","sha256":"e5bab138563e514c409c1f068a0d454b382c4d57be9b3227ec031dcb3d9f7fdc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/settings/page.tsx","sha256":"bda84187fc507da48ca58d1992e928c389cbe1dbdb5b89026cc2c52d261b8810","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/components/CreateCoreSignedFileDownloadsModal.tsx","sha256":"5e04637335ab5bca5301f683dcd0c6614f929503518fba2043e96d3b5de09bc1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/components/DeleteCoreSignedFileDownloadsConfirmModal.tsx","sha256":"09026d035eb18fc8a1cdd013279884d07674b3fb97fb9726a561dffdd8f91150","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/hooks/useCoreSignedFileDownloads.ts","sha256":"2b49a72fca1f3766ae8143148ee16fde3bd8119495483a9f3554359547e0ba7d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/page.tsx","sha256":"9a1c3ea5b8aa5c845cacd6f5bdd6e1f39b975bb8f1773378588903bc720764e1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/general/page.tsx","sha256":"593ba6ee4cc6d8e0d5c976c23519ef2c4cbd3b59ae048830c2f3b91460fb8fe8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/history/page.tsx","sha256":"b2ed270a72719140f1546ce35ad30f47a28a302dca060e47545e116413677e9d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/layout.tsx","sha256":"2321e02b1711b91a28c7cc599dc6607008efd585835ff7cb3b77ed21be6d40b2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/settings/page.tsx","sha256":"19af5838fcd1d8aebb735e572f4709e16b89db05347c12e75951eda2968b2c79","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/components/CreateCurrenciesTaxesNumberingModal.tsx","sha256":"a5405b7715be07dee0f1f432f00f096f39db2320488b9edf6f5ba6374b988795","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/components/DeleteCurrenciesTaxesNumberingConfirmModal.tsx","sha256":"2f9c7e0e13d2396d31e8345dd7a611c22f41db791819553063211ac7c20d70db","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/hooks/useCurrenciesTaxesNumbering.ts","sha256":"a952e3ee7c84631fb50bef13a601aa1f78822ce93e5e14e6d89706c42f31ea91","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/page.tsx","sha256":"7d019a3ea96b8b19f6067e22efe9c28dbdc04be24d1d5673a9245c8b94789073","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/general/page.tsx","sha256":"c310e2b68c2d06aa1473989bc31578b3dc3aee3c7e9bf080bc02485894184e82","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/history/page.tsx","sha256":"8b4402b622402d0af50e31a295ccd9fe3ff4f11ccd5e60345e25d6676bcc3593","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/layout.tsx","sha256":"e730e5c948c5bf053ef648433ff91a973a6038d4380cccf3d6732efb40914c07","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/settings/page.tsx","sha256":"e003de987f942f4111a45047845bef1d46e2d13d9a0e141ade1f7fff69a8f5d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/components/CreateHostStatusModal.tsx","sha256":"bebf80810487c2285da417e74d7ec618dac8b43fa09cdab190557f87e48284f8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/components/DeleteHostStatusConfirmModal.tsx","sha256":"8fb54eb3d805dffc1f880df05946536e1f4fdda33c9ad7678129c87eecd61888","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/hooks/useHostStatus.ts","sha256":"ca4731d9bbaa9e5425efef91e3a771ef20c780b8876d7e645a4f2ee766d5bbca","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/page.tsx","sha256":"4fa51a9d5f586e4b219cd8894787649569d616760447b9e19d2d53be249777b4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/layout.tsx","sha256":"f66f2953df3816bb73da60a1285574f42043ffc7e8281adcadc7aee77ddad891","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/general/page.tsx","sha256":"8784e51e5ef2505b3d8da0b8cad752531f99720d738d1c518a1664869345f288","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/history/page.tsx","sha256":"f6ff634ef11229635cd379cb9d32b3e08308b6cb114e99f45f763bde2961b34f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/layout.tsx","sha256":"4a7ba4f93e43581f3b772f79a061f2b81123f16bb70ae02b11da87c82a9e1192","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/settings/page.tsx","sha256":"ddeb5b482d335ed244f86ff966a35f7e473ed0ca9705a0ae4331ad3a5d745abf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/components/CreateNotificationsEmailConfigModal.tsx","sha256":"2b9df156c8685d9d6c6fc63597eebcdd470d6eeeed254ba2ae44138fc3e84f81","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/components/DeleteNotificationsEmailConfigConfirmModal.tsx","sha256":"638ee610cee988150dd0eef1e1746bbbf2ddcc3c110159f1e5a950cce64dfc5e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/hooks/useNotificationsEmailConfig.ts","sha256":"cc99ebeac4158622a1b2e474e823fbc7def7680fd915d44c0c236d02e974de50","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/page.tsx","sha256":"e9d2e081ae130ee7b19edb265988d89aa75cd6411eab3b944a541ad83da1f43c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/general/page.tsx","sha256":"032735f1ab414d7c18336580d93b778692f330d28cd630a9e4771ba4990e5adc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/history/page.tsx","sha256":"b01cb843a08bf40452f0b36b99c7888bb4b0d5f63f7c55cbe1fd709dd846df8b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/layout.tsx","sha256":"0ba7207cf83f8bf6838fae1438e4fc4015206ffb8f00d80c46cb203a3c4a50f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/settings/page.tsx","sha256":"5afa21f5d0a1d05f5338dbf2c61dd2e7f69b2ba1966465bcdf44df3491238466","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/components/CreateBranchModal.tsx","sha256":"c097bbad87665b3a7a564630f97a05903b6642486e2542078698133c226d892e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/hooks/useBranches.ts","sha256":"f7e3d939a37b0ac6bb39f7ae44529b68e2608bf2d50bd478cb81b05a28b5dc05","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/page.tsx","sha256":"c16062343e05c60b567417f6381c52d6061db73343891305734ce3299b4e9ccb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/components/CreateCompanyModal.tsx","sha256":"38789f2ce3d59279d2d225f9687a4f2ae6ba658256d7124f02429ff65bca2824","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/hooks/useCompanies.ts","sha256":"0fcd4127f660f490b9908f9d2818744789e021549543b418a1eb96e59eb35e45","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/page.tsx","sha256":"57992261779b7c6784f8f25197d8842f12f37484ca1f034b189584da8717c991","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/components/CreateOrganizationModal.tsx","sha256":"45ff55d9de68ac6052119165d3a4c371a67a021cdfbc7bcda8309bf7b69fd3e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/components/DeleteOrganizationConfirmModal.tsx","sha256":"1e24cd85a89a14395a0eba9dbd9dccc65887f0e2a7a39ccd845c68dfdaffbf3a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/components/CreateDepartmentModal.tsx","sha256":"252878d0a10dce02b683aa56d96909e21bcf1d66ae24bdcf7451749cc54904c3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/hooks/useDepartments.ts","sha256":"77dd93b4fe09aad20ceb980195f8dde2dd0e2d58169e0277c2adcf5c5cd386ce","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/page.tsx","sha256":"e81b19441092922d154457367f858f46d269f6aad0da5f947e52717babe249b2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/hooks/useOrganization.ts","sha256":"185c6f6a8a6688636e57414aa191a3762b2fc4c86ffb14acd64366a99a3e0435","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/page.tsx","sha256":"ba779ee14a06bbdb5919f6b26ab248633933c55240b95968dfc690694416f857","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/components/CreateTeamModal.tsx","sha256":"670d15a663ca7d959da5ea93ad6c3821da461a64b43f0cb6892ec4eda0ee54f9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/hooks/useTeams.ts","sha256":"b8b83442d58674f9b99f453eefb026c1f0a575ac3b73568d9a55a68e08fccfa0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/page.tsx","sha256":"aaeb3c16952ea75ff446f8339b2ca3eb35ef004bc97102761f8bd24c5c7ee2e1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/page.tsx","sha256":"e5a8017a4c0ed40b287fc9ed025d37d60f91a0dda89c0ca2c66931a7865ac659","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/general/page.tsx","sha256":"a7644d24c34a16ef01f62fd7e330b42923f7c2332435d8d5d6756ada54210d32","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/history/page.tsx","sha256":"88afebb07fdeb36160189b38222ef87f3331771dbec464a35cac91e0fa7dd0e0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/layout.tsx","sha256":"8de5105413116dc34d68dcd12ad6c4b75ed27857e40cf7712fd160183035c50d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/settings/page.tsx","sha256":"195e758e2dbd23602d18cab1e3b6a868f025aae86de3051daca2ac456971b8ba","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/components/CreatePartyDirectoryModal.tsx","sha256":"a0f9dedc2670f2a2838757ec9f4830cdb602c0b6f6071378f1bceae8f4eb92fd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/components/DeletePartyDirectoryConfirmModal.tsx","sha256":"beb57f19785c1217d4242546100ea2df18d82ec751aed203ff1f640da4257e16","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/hooks/usePartyDirectory.ts","sha256":"7dfd6c693f0e7a7b205cb193df60d8e94d6b8fad861403e8c4c2d82d1d682312","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/page.tsx","sha256":"21e3e72744469baf1762cc4789b2648c18b974e35cc9c54e521117a3b3baeacd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/general/page.tsx","sha256":"fd4e43956dd6d71dc8753d98091371049ccda783b718d1ae71d8aaf1d6790d2a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/history/page.tsx","sha256":"2e18e2fc26840053f0337e11e5cf8c5ac6dae8fdd90994b028152fb97ac3ea30","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/layout.tsx","sha256":"c1f50ae69294538abe8e7146365375094a8b49f202452205da7a333a61a94e22","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/settings/page.tsx","sha256":"3b72abd70530131585359cf6426f9211afa86edc9202bbcf752dbcb9d9078e4c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/components/CreateProvisioningUpdatesModal.tsx","sha256":"cc25ba46d5c443560b09bf75b52e2d32055cfa081586684bbe86aec14edc4f27","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/components/DeleteProvisioningUpdatesConfirmModal.tsx","sha256":"5ac7e4a0804dc924ba81de91a3212eab475be9d3f83b9195ffda225be1b9dee6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/hooks/useProvisioningUpdates.ts","sha256":"3bbefb3eec384471194059dff12f0389362d96abb12b2b753957ad841e764ac8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/page.tsx","sha256":"fe327670753561da982b59f14da464c1716c83344cc7e264c56ee5ed75957265","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/general/page.tsx","sha256":"f9f433bcb487fd1332fb6be705f34b0895878f082a33f4c30aaca457c14962ee","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/history/page.tsx","sha256":"ffb376bca83836ddd8db8e51f12dc4b33fbd4af0c440e1389e02d65a4fd6de88","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/layout.tsx","sha256":"11b9a60ddf71821b370283546a7ba41a5815f4cbacfd072b0c2a02050a0a6dc1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/settings/page.tsx","sha256":"711f53c8d87ea072389ab0fa3914e9290146db71fcc6b52451eb86f6fb7970a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/components/CreateRolesRoleAssignmentsModal.tsx","sha256":"21aad204420823d0bc5afe328827ddccc24812f197e1b88ba1dd2d5631a37a3c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/components/DeleteRolesRoleAssignmentsConfirmModal.tsx","sha256":"c4f397e6e1e8c05dbea7e994c2c3d737625484bef750265ff6539e6ed2d1e4e0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/hooks/useRolesRoleAssignments.ts","sha256":"9e2828e29f4c36b1ec2972ca8d975de5d94120184dd683f7977a9aa3ea91b668","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/page.tsx","sha256":"87df4d22288924599df42946513a9bc48b1315d4ede1437c38d6add6f51a84c3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/general/page.tsx","sha256":"8e2faf48b84ac36c9f1ed1b0bcf669d474a69041c7242d2b023df339270dbc6b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/history/page.tsx","sha256":"d2b29873ba0e85fa5a50d8eb47fdd6dec74b2b83b5beedafbd92cb14684eb6b7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/layout.tsx","sha256":"e8a0c277a5ea3f6debef1c1f81afa4ec94347071416534fde9d3fd66745b5457","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/settings/page.tsx","sha256":"107551b98dcc94bb83525091473d1edcc33277e53d4fa532e7a614277220e746","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/components/CreateTemplatePlatformModal.tsx","sha256":"2ad332709ee970a5466871984a0e734ff2eea5f749192454726f02f5a3e66f73","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/components/DeleteTemplatePlatformConfirmModal.tsx","sha256":"265995120dadf2fbea84ea8f390dfa9b03877e450b9581f6e7475770567bf6bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/hooks/useTemplatePlatform.ts","sha256":"66e5d67db87bd99151ad4724b78348b1c2f7a4bc4e75b46db30d364616441055","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/page.tsx","sha256":"9257f8c77203ec37ec240cc0fc6fcc83f5fd68c7cc2d0e228118cacee94d458b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/general/page.tsx","sha256":"e6dfb58253ac565a0279eb310fa0780d4b5d5a33d69cfa9a5a5ec6e89de086ae","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/history/page.tsx","sha256":"58467afbd9b8174adf954a5c48880e6d3d966926f65aefe4a0409452425d6a51","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/layout.tsx","sha256":"3353f3e0e527f85eda7efc2db837ecd2d4efba3efbf04bd14f671bec24101388","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/settings/page.tsx","sha256":"5972990da18fbab8af13a7ddf4a62708d4abf3d6313f9c8ac47fb4a696b2d431","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/components/CreateUserModuleAssignmentsModal.tsx","sha256":"1f37e144eaec00bf70eabb9e573ef39f211fbc5d803d04566256a80f1fd76dc4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/components/DeleteUserModuleAssignmentsConfirmModal.tsx","sha256":"f71ca4a29538f82d48ea6f73b5d7e0622c4c665c272600b9c5f83390bdf542cb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/hooks/useUserModuleAssignments.ts","sha256":"3f8f32907374f0a0e26026ae897c402f97f54c5e02a03cf3df64909890e8e6bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/page.tsx","sha256":"1464baeb648f31ce63f435c2f95c2ed52d5a5dc525a30dfdfb6889087ef0e91a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/general/page.tsx","sha256":"7b637ee145b3dfa624416db9972bec5d8a0e9faecaf40f4207cab212553adfde","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/history/page.tsx","sha256":"5861bd6994eca76a3cd734e28e3ad8151d20a1c392df76d362dba32b2658d33b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/layout.tsx","sha256":"3fd29ccf6e7132ef5ff7f84cfb31c62b1430537cb04c58237d03632f6b00dd8e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/settings/page.tsx","sha256":"6bd792935006f064e0a1591cabadeddb5921085e9e9b06d98d988b6ac9e0862f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/components/CreateUsersModal.tsx","sha256":"685c96e2280f484d95436ff8c70a6d8f9c60dfae6af938f2bba0589132127a7f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/components/DeleteUsersConfirmModal.tsx","sha256":"8cd380b9f356571d83d3be061fb04580fb3b690e9e81e6f6db4b4420b304c592","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/hooks/useUsers.ts","sha256":"b7d06e183cf13101de994f502aba6d0a712c8d71aa3942639368fe79d04509f6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/page.tsx","sha256":"9c8fecbf5419adfac4771afd995249eba4df1d4209ebed3530c856b05f89bd78","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/general/page.tsx","sha256":"94c574d5884009e2abe2159a9ed2fe722bd060a6709bbc73f777dc1bec9e5ca0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/history/page.tsx","sha256":"bd7d4c8b2c3195fa86bbab42c3b9d40cca4954778061108ef7f7768bca1ed7d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/layout.tsx","sha256":"8c8ffcc95ee867b90c0f5dfc401adfa70d507e6172b3b4b5470c9beca66250b1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/settings/page.tsx","sha256":"587591333b76e3ffdcc17ac2ac1f1f45819de8cdbf33128f71a89c776836f35c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/components/CreateWalletPaymentsModal.tsx","sha256":"dfded3c7c1f71db5008314a80bd5c0ab43577af566ad0524efa38776b9efbbd6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/components/DeleteWalletPaymentsConfirmModal.tsx","sha256":"b4ab4435bb3320eb1afc7048db2b1ece9efdedefdd34fa2b0446ea8fd42d4b63","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/hooks/useWalletPayments.ts","sha256":"ae4434453b6de72f767c730c48764c26f84a7685b9350446b021133ceacdd0f4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/page.tsx","sha256":"2208b41dd82bcd7d2cfea6f513928d01cab1f1ef91b84cadfeac3586b8641657","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/general/page.tsx","sha256":"12a395a2168026a29f5cbfc5ab068739bc6c1c8946093b0bb9c99a1350349591","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/history/page.tsx","sha256":"f1e59bf2216b277379a0feedad9076949c4e4b2ae712c6dc905bf8f500a41472","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/layout.tsx","sha256":"f1f14b502a681373467bf1daac1541edeca9fd6e35b6b11c8f9e97e857f89520","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/settings/page.tsx","sha256":"71afe47ebc3333d99c09b0e60a7b07f38de99899d61c4cf9452f3532a6540193","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/components/CreateWorkspaceSettingsBrandingModal.tsx","sha256":"a37e2793571c62a2ec900bc4aba8c4dfba1341abdcd50bbadac214197c6a8d69","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/components/DeleteWorkspaceSettingsBrandingConfirmModal.tsx","sha256":"8469892c5de0bc2404052fc7bd260daf2d3a4290c9935ac9e7e274aba3173f5b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/hooks/useWorkspaceSettingsBranding.ts","sha256":"7ac9750d5c34a061bcf1df3d88b8b5c29e9d84b3003ff0d7d8f0e120bb2f379f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/page.tsx","sha256":"4f0acd9a489e56dee24f5dc94b6b043522efdb39bf55289171713976941f2124","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/general/page.tsx","sha256":"12b260b215431474b1410d9b4070b60ba02171bbe3a7293e3948f29b3ec8f02a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/history/page.tsx","sha256":"1248fad785ac380e70834a1a7c3762e16c6a67ad0b413f27ef42dcdb779ee9c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/layout.tsx","sha256":"2a0800bab67e8fe3bec6fdc784a2e1bfe271db3740e2a62ea88fddca60344f59","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/settings/page.tsx","sha256":"986476bb79946853e5feb0102dddf84e714e641acea5f42509916ac23a6574dc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/components/CreateAcquisitionSourcesModal.tsx","sha256":"0527ea7823a33a7cdc37c52f9b018ac9e41b7beedec0d177a31ac0b64189c8ed","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/components/DeleteAcquisitionSourcesConfirmModal.tsx","sha256":"5916db1f87cb258fca97fe0ca432db13b51dca142b35eb02425e08b3fe47fa01","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/hooks/useAcquisitionSources.ts","sha256":"f7be696bd2a20da831037b24c81acc36b55a6a22a0e5ee8fcd844e6639e65ebd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/page.tsx","sha256":"60164412ef481ec15134c0c1d41e631ab2b2580d7b3bef5e1ed1f38279157581","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/general/page.tsx","sha256":"a3ce3e4da065577a82296971fd763e66595f6a069087f52af7ac107b2f82a98d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/history/page.tsx","sha256":"ee54f43bf7eea697d749cdc735893945c814ccc34cd430ae6c3da1a5c39f0b59","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/layout.tsx","sha256":"2db5a4d3c511fa8ee31dce7226f6f43c0c74c38ce29ec708745e39ddcfb4fb10","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/settings/page.tsx","sha256":"431b70d30f3b5e83960992e1ebd234ac2d94777fcdb066415caf42342c43daef","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/components/CreateCrmActivitiesTasksModal.tsx","sha256":"ec6035539836adcd7798e5fcab328cf76e7e73b26c3d2b670dde166263f7cba4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/components/DeleteCrmActivitiesTasksConfirmModal.tsx","sha256":"089245bd9a4533c66fdc459ea4fc6ab3faf832a25bcedbf3dcc9b8c87703a6f9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/hooks/useCrmActivitiesTasks.ts","sha256":"a351c4691bc7176be3a1077812f157c9626989dfe0f8b948188fda08d17511b2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/page.tsx","sha256":"7654f3ca6c15628d0fc80558bb637b8b1b30e3984674f413964066290689488f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/general/page.tsx","sha256":"dd66211c2f800015a580c2ad548984200f415c878edd9265c17ca2965dac133c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/history/page.tsx","sha256":"d7ccc5c6127fa7a9056bc9ca7448b1f36f1ca92ff94c7d462a9eeda5a93c9767","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/layout.tsx","sha256":"08b6a67684045ad9c275779718dc06c3b3feeac5acff160d4736e8e7697ffce6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/settings/page.tsx","sha256":"fbf601e5eefa9b871f398ec4b81eb60de71f3207d5c79d27514498fdcb25ae8d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/components/CreateCrmApiDocsModal.tsx","sha256":"54e6518cb3faca1573bd79fc22755b4d658aca053056865cd4b68cd90d811f3a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/components/DeleteCrmApiDocsConfirmModal.tsx","sha256":"c1cca1312cecfb5d5d54ef5bf4b827ad1fe4c87afd785b7eaa90d1b3a5d28b66","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/hooks/useCrmApiDocs.ts","sha256":"50d13409128ffa98ff8429e9343502220071674e52ac3a6c4e3b2d618f457906","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/page.tsx","sha256":"cb29c9759520d14652ef343fc94c4911b80b5c3c63cf2540f16e6526b2b4952b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/general/page.tsx","sha256":"f07b9289a42b4a9a6b92802dbf38727b3b8fa38f443067d0f0f2c1d485654d5b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/history/page.tsx","sha256":"4098af698d0dcedb326cd2069e48b9783684dab02ee3da1cf73ae9c85254e40c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/layout.tsx","sha256":"c10a7a296afe152c444e2b9dea3b94c09c146ad5da87602eec1534858bac3952","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/settings/page.tsx","sha256":"21146f787c5c428178f785b402e46ae78bf942087928dc937ea6e545d99480b0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/components/CreateCrmBrowserExamplesModal.tsx","sha256":"a4f93c33cc12e327a692979eee954fe13b9d5ce502acc3e1a63820bb0f0009dd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/components/DeleteCrmBrowserExamplesConfirmModal.tsx","sha256":"82608504af50adc3acf038003761f87599f4a500d5111f9220b6f84c65a61fe3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/hooks/useCrmBrowserExamples.ts","sha256":"a7562ca7c9c98f16b99218dc89b8a1cd3615e19325d7ac631da4344657a9300d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/page.tsx","sha256":"3bdc79d1d4ef11da4a212f8d1d88811446fa934c991b75452791770eccfebd4c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/general/page.tsx","sha256":"8ff011f9f65c52d29c504b9908763e831ff5d3e04919247981e628e2db852c71","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/history/page.tsx","sha256":"fd620cd6d8c3bc182dfce1669b122af8006aa71c160d907814c540c5dd3084cc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/layout.tsx","sha256":"61d315b042c49a5ff1451a13734cdf78643364d2a304a1f251a745a2fd3ab477","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/settings/page.tsx","sha256":"ea2f8b8bdefa8725578e3126d392cda7a169dc6905279f6c0125870e21e53ac9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/components/CreateCommonBrowserContractModal.tsx","sha256":"74ccc6d4bdab7ddb817d1498468ca85cb982d5c06c065f400ad3cf41f10d66b1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/components/DeleteCommonBrowserContractConfirmModal.tsx","sha256":"932177a6e1947d14355f13478d4fc7b2c9e366f86644c4d2da7d0a096216206b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/hooks/useCommonBrowserContract.ts","sha256":"9998fe33fca81d7b8dbc4d9abc9cbb4bd3e15d88e6e30b3a2e62dd68a9315838","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/page.tsx","sha256":"44ce6d40e611e08ad11d24b399a4d72f53dd1c3dcbd925369ad1e86060d50462","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/general/page.tsx","sha256":"e76240eb5deae6e629b06ad521bb44cf95b7cd992efd5b27b89ef9eb301ea80d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/history/page.tsx","sha256":"ff08052689dd5c253dac549ee6598f6816f2454f8e259967e2e58f6562a1189d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/layout.tsx","sha256":"0577fe3d2fedf2213ad76aea98de1b9b9616008792c0d12d99538b7cf10c29dd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/settings/page.tsx","sha256":"f73d3a905dbd6adb6222a8e075d13bc50a6924956df7c73530729eedbc8f92bf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/components/CreateCrmCustomFieldsModal.tsx","sha256":"e4bb72ddcb20472292e01981facb07d5293d43eb379ed50956270efcea37d9e2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/components/DeleteCrmCustomFieldsConfirmModal.tsx","sha256":"a34ce86e8c5bbdbf05a918b974013e286c4f99360e585ef8ad3ad74acbb8b5b0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/hooks/useCrmCustomFields.ts","sha256":"47c6fe56fab546200b8ab7d8d6c9d5a9bbce1257f7b915b5945d4166a3bba096","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/page.tsx","sha256":"2588a521365ca110592515e43182485d62242599575937fb5f9eadad0f75f143","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/general/page.tsx","sha256":"75af33102121b69530b32fbaaea4a12b2b1cb434a59c6071b174a944a030b13b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/history/page.tsx","sha256":"0ceb031f58542dbfe98e6fddf3d649810b3a10f7b3458620e4ccb7c7c5733ff4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/layout.tsx","sha256":"444499af72938db865c4b18aea317cac477cd4a51247dd387014b16d05440931","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/settings/page.tsx","sha256":"46abf7ed7fa43d48546d5b64d70bf874d765422a1a716ee3d596373400701e5f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/components/CreateCustomerProfilesModal.tsx","sha256":"f109991bdc295141b0a761916d0ffe86cad0ebf588e8700aa5e3e2dd8a8763b6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/components/DeleteCustomerProfilesConfirmModal.tsx","sha256":"b08589e9e8c478034027b6218a71d045cd4e35a8253d71c133920274ebce6a4b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/hooks/useCustomerProfiles.ts","sha256":"d1b628a3509747b448400c58958bf9e6342c40f19879953c836db0c0125a63cf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/page.tsx","sha256":"dd0bc5f6bd0f7200651a9442df32ef85a610d33ef5532bb2906fca43dc39b38c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/general/page.tsx","sha256":"c593605a2888ef06f5860ae6c26ad0d494524163bf63639400768f68f5743691","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/history/page.tsx","sha256":"658e0ecb2ea100cce8165c683bd575ad398b5587a7432d1472856fd3b2a288cf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/layout.tsx","sha256":"fcdcb3606139c1eead757aeb4ea154d55dee5b1f422cd72a67e150e8dc059998","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/settings/page.tsx","sha256":"50f24d3e09714c7e590dc778b5e764d35a9da1b5bd0333e1223bd05b6c34c79a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/components/CreateCrmDashboardBuilderModal.tsx","sha256":"c82447d3b0263494d184ed668e2b199e66fa5c4b89fdf216677ed1410f65e0e2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/components/DeleteCrmDashboardBuilderConfirmModal.tsx","sha256":"5bc5c2be177b41eb74c55d04a57cfd352ddbac5d07fcaedb5985cd4d2df8b4e8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/hooks/useCrmDashboardBuilder.ts","sha256":"fafec16506e234b018c2c10d908f137fd3c86a4ebaec2a625c8fb5a8d8cd9a5d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/page.tsx","sha256":"40402ae18514ccf599c90ad53ee46805ddd0ffb83a212183d7b7a4163128fa90","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard/page.tsx","sha256":"b799288a060ad6b08f9e94b54b148b3fa3ed1fccb71bd676d853e4f0c7afc255","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboards/[id]/page.tsx","sha256":"17acc9f2082b0ece8de7f618642b909b485fc25e9a61261ed23850b4154a2e7c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboards/page.tsx","sha256":"6e14c01635716db8d59e6d65d40bc9e13eaa2024a664e6105bdae907eb03cf98","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/layout.tsx","sha256":"ac490258ce872770e861b1cf6de46d2e4bfa568c5c3e78d9b20c5e7981cc2b4d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/general/page.tsx","sha256":"4771eedc9c1277244a515be565bb2b19c4243016418726824dbc0410f4575a1e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/history/page.tsx","sha256":"e6f9b539848d1041b7a1bd26dfd44755c6400af8ca900ce5fb6d2e6f95b0b33f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/layout.tsx","sha256":"5b5fa03cdb6753b8f5e6e79fc933fecd50f9c13b90d78d16a2b1603386aa8121","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/settings/page.tsx","sha256":"53715a66f506d39e911e025ce1a5602052e2c4b34974307cdb83ef7444d57c54","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/components/CreateLeadStagesModal.tsx","sha256":"61c3f33b60815fcfcb501b9a5c686add2ba2e848b64199c07bdda91ad05597d7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/components/DeleteLeadStagesConfirmModal.tsx","sha256":"5e05ca6b1cf13dd54efc3b34379be7111663d7e7680e6d254428bbed11911729","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/hooks/useLeadStages.ts","sha256":"9e3bc67bfca193499401f9a6f67bde62dcbe6b75864201896f33910312fda0c7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/page.tsx","sha256":"4cde5cc84100c11804c502df885f3105ce63f10e260c59d84f0bca482c48a805","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/general/page.tsx","sha256":"8ce4a6dcaaa6f26f83650f4b6bce3e8b0a71163bf56a725f083f2c870eb56757","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/history/page.tsx","sha256":"bf8a2265741d21072a18451db62febd95413e026b792abd79ca96fc8b6f2b4ef","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/layout.tsx","sha256":"79b886d1513afb123a5a3c1437f20286cddac1dc556b3fb34a471de4cfcb433a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/settings/page.tsx","sha256":"da2ed1aaf71b8e0c5f8bf1f6af6e7ea1f2881432a88d401006e4422d9f488757","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/CreateLeadsModal.tsx","sha256":"372f4ecc916b851db82e7d97a890693a8e85c4b79669515e64bc1300ca3e83d5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/DeleteLeadsConfirmModal.tsx","sha256":"a61a2a32c763d62b769fa5d7ee9c90378b3d71d4827e493e8dc13810b2718435","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/leads-workspace.tsx","sha256":"88b3790d454c1e13e5eebef23150a51e5154e06ee0b4cabdd6a4fe9587e1655b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/shared/lead-card.tsx","sha256":"a07fd15431c0a731ae20836b96afab11623e766e1b890376d76582b5b524f67d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-board-view.tsx","sha256":"0b95ba2c7076b6319c8d8351a07e577ef9f73270b0cda8da59acb696896dffe5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-cards-view.tsx","sha256":"7c51c91d8e642c65e53a6299d1f3b819dd133b8a68b3c64f3f9a0c3c1695bdca","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-list-view.tsx","sha256":"744b4299c4bda3f9bfea3d4a79004021b66d2639492564e08df6738b24187b80","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/hooks/useLeads.ts","sha256":"39e88066eb672978306ceb39c29c6ab151041909fe8068a66bf3855e90b49071","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/page.tsx","sha256":"59d713888599c7a971bd0431f4c9dfe5ffe68a2b61a310478960488ea7efdd47","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/general/page.tsx","sha256":"c12ce6e273d9e56c71e702741492c1ca781d9c7278bf0f8f28637f1a092b4c74","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/history/page.tsx","sha256":"9dc6c42d5b6fb03e8841ed18217e52c8c42c19a420893a980201e73fc4338ac8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/layout.tsx","sha256":"ac7de14469366dfbef8b4bc9f8ebf4a600bc91d223fc5a2ccd8784d0011781a8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/settings/page.tsx","sha256":"031e2e49168bafb4345e3ef048111a776c2291ebbe9881c36054ab5be18a6e4e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/components/CreateCrmNotesAttachmentsModal.tsx","sha256":"2254da4cc6e146216788cf27b10c7063ae9b20af8aba556eb28705c848394621","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/components/DeleteCrmNotesAttachmentsConfirmModal.tsx","sha256":"80120c7c681f2e7b29af29c04bf20e2cf7cfe7c0771e24f17da226a826aeafec","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/hooks/useCrmNotesAttachments.ts","sha256":"83d7e92f356e58ff87ef0ec35ab4b211a367c53943809a582a1840a35caf1c34","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/page.tsx","sha256":"04ff60bd3a2102e6dd20ef50020fb6695415babb07953cb5deda487aeb972973","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/general/page.tsx","sha256":"6121e81653d7b3ab1de19ad68ecdb116e899bcdc5a4ac9ad7db990f6ce0a7b64","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/history/page.tsx","sha256":"c8e05268955dc26de108349a2b230a316e5543e9b47598d308f562effad850c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/layout.tsx","sha256":"4a4540fc3d015a9458b4e70fe82b89388292a8dbdcaa5bb96bbac817ed35f020","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/settings/page.tsx","sha256":"4f874442458d3766d1a64905b2e860d53aa3505a52a92b1776c0523849663ed6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/components/CreateOpportunitiesStageHistoryModal.tsx","sha256":"bb24bc6e0ae0effe0606f1c7e9378144f476173fe3be9537cbd287f819aa5971","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/components/DeleteOpportunitiesStageHistoryConfirmModal.tsx","sha256":"44067fd4b7e6d9499e0ce18953c4804c7c97bb2a535054fabfbcee9168f9e022","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/hooks/useOpportunitiesStageHistory.ts","sha256":"4cd85e868ca6b811ef2b5077b9fa734ecee5318becf0a5bc9396d8b2b32d9331","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/page.tsx","sha256":"988bdbc6cb42eb2267827c68ef2a925b70fc114ec151674c3748db4e4ccf83bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/general/page.tsx","sha256":"fabd0b45e774802e32f3383860dda7f98153f7d21829fbbd9c7ed29497c5f9ea","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/history/page.tsx","sha256":"d7c5ee942adea1127d8db2f9cc14e500223f10a8342106a48634a40cde1cb347","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/layout.tsx","sha256":"f382de313f317fcadf22d9e7e80c4582f0543baf1bf7d5d13e738b673750ff1a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/settings/page.tsx","sha256":"bf900ea4bc7b0ded997b02e6711ed583ca723bddcf57efb67cfd561b9cbb1178","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/components/CreateOutboundEmailsModal.tsx","sha256":"caf8d19c8ba76ed121210db357c177cf25b7400827fbc90158f011f1b5cc0770","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/components/DeleteOutboundEmailsConfirmModal.tsx","sha256":"e2560a71296af82e9016e0ddec57baf1dfa4a94b222b44b47ed91b04831c71cd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/hooks/useOutboundEmails.ts","sha256":"b7963369cabf99e4cb67496d50eed43044bbc310502afb24f4e39aa975a60891","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/page.tsx","sha256":"e7fb6568a485fe210146c130e7517336369f9f8ec6944bf9d4f6baf6a65a51ad","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/page.tsx","sha256":"1f4d49d882dd047123981e0024d3dc7be66e17df4f31e6720f1503b94d571926","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipeline/page.tsx","sha256":"2c45ca1f55dd36f32f4cea7c7e8032a93321a9efd57f32a5911c47ea77e42e38","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/general/page.tsx","sha256":"94cb198d3b56de9e31f085756f0e9f69e45452e1eeb1006eac663918a5695b96","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/history/page.tsx","sha256":"2904031c1847e1f194aff178c708e3e686883ed310b079cca647d5bfd16b4dd8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/layout.tsx","sha256":"c00117d4f1c8a5869ae556995a60eecc0d5c9184a2609847b3ddaecc99cd2b85","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/settings/page.tsx","sha256":"6f69565dddcd3efff4a67b83fdd2d1bca09da96a3b7a9280a4fb3be5f674900d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/components/CreatePipelinesBoardsModal.tsx","sha256":"e2142fe38e61d5d22d6219fd7d54935d375039dd7fc1bbb0da8d1edbd14bfb0b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/components/DeletePipelinesBoardsConfirmModal.tsx","sha256":"d066215d705d9be8d4434dd0ae3c2523e06a6da097c9462b66ab89cc942fe188","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/hooks/usePipelinesBoards.ts","sha256":"0152b45687e4d27dd31060bde104b2bdbdc39d27b566bdd72d3f4404a0b183e6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/page.tsx","sha256":"1bb9831305aac6f9a6b152bf409118e039924ded682ccc8ab1356aec7daba228","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/general/page.tsx","sha256":"3cf344ed8759c3d83824ceaeacecb3547738c962e76023931b599db72627b599","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/history/page.tsx","sha256":"aaf4dc97e0429bbae44c8f083c34bd934b59e8988b20c7c9fabaf981490d59bf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/layout.tsx","sha256":"f0271ebbd0eaa783adb28c199af7dbb1a0fdd49b3fb8dd47062199075ff5188e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/settings/page.tsx","sha256":"60a8bb024eb9794166a079e8d8bc653b122c8d789a56b4e15c1c81e9af78bbdd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/components/CreatePresetDashboardsModal.tsx","sha256":"e22d367e5a16a9d96fb37e80d4c1b4b3887be45107aa32abdf8e1e22e1e06771","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/components/DeletePresetDashboardsConfirmModal.tsx","sha256":"73ef447c554e059822bc0b1ea377ca0ce644e912dc8254591dd0475de99ca4c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/hooks/usePresetDashboards.ts","sha256":"fa368737f6c92fe1018c3d9083faf0bd499cd937166cb090c6cba8016c41c384","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/page.tsx","sha256":"5c06ea183dece80c08505303f8383a0adb8b6039242b92599aac4f2c96c202c5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/general/page.tsx","sha256":"4b430da9a52fe0d55168bd70b2145db8f5ae41340820ccb75d30671b4ea0b246","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/history/page.tsx","sha256":"0d1a1021811ccc30638848a86d99154b8a081bccca145f078f9297235963b637","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/layout.tsx","sha256":"0d604f97a9ed4f4e6f6a1b9b472a2f63d4db3f0972e04b3cbdd8143b277ade8f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/settings/page.tsx","sha256":"aecea31384a05bb11eff1a5603719690ab311fd7d27eaae67bf5ae8db72bb6ca","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/components/CreateCrmModuleSettingsModal.tsx","sha256":"fc0559977db8bd1f049b29e0fef94b4b5a347ffb8a433918b85a885857cfdc27","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/components/DeleteCrmModuleSettingsConfirmModal.tsx","sha256":"2057dc6e44dbc92ed905a8537f4d33a63854c467a1a5563e88cc4c17b10f0f8a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/hooks/useCrmModuleSettings.ts","sha256":"ba071d8bd35e86e06fc021a9fbf1adbb034681729e96195a29e61c2bda8b1c02","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/page.tsx","sha256":"285721bff75ec774ec24a29ea848fba2f09cd75552bce822327afc47d56fc5b1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/general/page.tsx","sha256":"ca6eccc8a7c8eaca2a15e35471590310c75141384b060b91ff611e62318d8aa1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/history/page.tsx","sha256":"c8cc1908e11ad1ed57a9819f2161ded0d55cd84a5b4c59d07d35eed17c890343","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/layout.tsx","sha256":"6f2e4fcf886d6f87d1d57f5a4194607619617c333ba3ebd9876cddf062bc5c1b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/settings/page.tsx","sha256":"abf8e539e9cf35db3a1a0825e2be4ec76cdba2be39a01ff04ef0b74b30088a03","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/components/CreateCrmStaticCatalogueModal.tsx","sha256":"4bf611ee9118e05e0d834a4e2d879818155c216371cbeb230afaca37f4771209","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/components/DeleteCrmStaticCatalogueConfirmModal.tsx","sha256":"a15386dc50a749a73561a8ced39b62dd17d665da62bc6bc4ee0c8f69e09fdd80","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/hooks/useCrmStaticCatalogue.ts","sha256":"c43a3a9d615d7907063f79d19f5728215d38fb1ac8e863a9ebb2ef2584975d65","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/page.tsx","sha256":"45f8ba4e71ca23fe13f697ceab7c2814d7a570b4bc82e134f84e4b6230e3e2e2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/general/page.tsx","sha256":"461d625bf2593b322801fbe8cd88ab72c38c447424048041bd9a8a020399b095","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/history/page.tsx","sha256":"fab091c44a825f324805533d7c37a29d02290d6580eed253fb58cf950a7bc554","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/layout.tsx","sha256":"e827653fdf24dd972d68fda57e74c3cfc24dfd703c8c89c11c8dbff6c185edce","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/settings/page.tsx","sha256":"2e144dd51c7fd27024e0a9d63a87a28b091c555b521e789baaf75b85f0065520","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/components/CreateTradeAiGuideModal.tsx","sha256":"da0a712da5ee292c3d934d208b38bcdbd38aa51eb07655f0b6ac0896c951d3ea","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/components/DeleteTradeAiGuideConfirmModal.tsx","sha256":"40db2ac32301ac4497a00cd20884e42aff0e3bdaa054a87132f50859c404bb3b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/hooks/useTradeAiGuide.ts","sha256":"59ead6596fd471ff92a560af13bab6b344fa4bcb3d365562560e3367dae8c7a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/page.tsx","sha256":"039127ab81e9d74493de6c93171fd88c8b08480260e453101f624a09d2bb4f72","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/general/page.tsx","sha256":"34bb7289314593a8a7b6c78b18c4cbefc5adc8cef02c5c9bdc7830bbeedfde73","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/history/page.tsx","sha256":"b0cd35a50c171a6455f0c936bda35b91c328e39d31b9dc4ea8b89bee82ee0ac7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/layout.tsx","sha256":"28f02e7c85cf5584fe2c68ad907fd2d947e70d6abc779d0d29496a780f686488","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/settings/page.tsx","sha256":"5c78b9f08ded3c9e4666cf61e0a1fe6bbaf57af6ec05193ce36826e2863148f8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/components/CreateTradePdfRenderJobsModal.tsx","sha256":"9b7d6b12087de118501c939c9197372b7b27e40d3e1bc9aab7416fff0ded8c69","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/components/DeleteTradePdfRenderJobsConfirmModal.tsx","sha256":"4b254663851c6e94c8ee751121bd5ae7f919212d63fef48f9f5a5690de6c5005","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/hooks/useTradePdfRenderJobs.ts","sha256":"dcfc1afbbee6b2ab47fd120ad71965f2dcd4a88a4f953d9004aac8ba655081f6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/page.tsx","sha256":"7a40f47c6a119476483aac4bfdc226649783202736ca15af203b47d217ff7386","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/general/page.tsx","sha256":"99e816b49307a26f8bda868afb279a591a8ddd8e471d82470a6128808dd4f958","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/history/page.tsx","sha256":"895912e36ce6e502bb505b2dbd5c201f2817017fe4190aacb7a479247672e8dc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/layout.tsx","sha256":"8b2b9ae6c231948b5a4ecf8870a089c9015639c8fc1ce3c4c9ce42d7d5f6c549","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/settings/page.tsx","sha256":"268f89ec620d93bc05d530d47ca3c193446051ca561e8f2414db6bb1ba4d3cb1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/components/CreateTradeCatalogUomChannelsModal.tsx","sha256":"315561295dd3c4f5bd748e7b2643427d3bb91f8eb37b5c073d3e40fbfe2ae33b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/components/DeleteTradeCatalogUomChannelsConfirmModal.tsx","sha256":"bc0ea7929c0b84192a9eb8554c8a7eab5bae7d02d9b3fee5f984e189a53038fb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/hooks/useTradeCatalogUomChannels.ts","sha256":"73fd071ad48651b1e17f28c2e1ff07a8aa5c7a1f1afe5a1ffb527f31cb7f9dac","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/page.tsx","sha256":"524dee94914680f7691ee3339487a21b866fec6a1c4d7f5a35c4569baaf39450","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/general/page.tsx","sha256":"bddca4d5f9c53b71180b00fb2dde7a647f6de4eb5211695b463b17a53ea1d9d7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/history/page.tsx","sha256":"9339bd7b5cd75ccecbf2321cab074226907fdbdb1d11faab863fc173bb141df8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/layout.tsx","sha256":"8bf3af7e7ffec99fa1bddc3942cdae730e424a4c0187227a714fcf2db97a5b82","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/settings/page.tsx","sha256":"d61954e05554d537067157f24b222de4c347ece6cdaee11b50645280c1fcade9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/components/CreateCommercialAccountsCreditModal.tsx","sha256":"8dbd8f43b8b28c240e1e31a39ec5be0a93725d5e17a69ec9687d0c8c52d2146b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/components/DeleteCommercialAccountsCreditConfirmModal.tsx","sha256":"4e5f52bf84ac56a49cba922ddfda600b3c274ef8e72ea9ba89708429ef7ff49b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/hooks/useCommercialAccountsCredit.ts","sha256":"26e235bbf02fc5b5b6fda3b3c4de313ceabba838e4f95b2d69ef34907bbc7daa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/page.tsx","sha256":"664c2e230514835b03225cb2c94e3014bd4ccfb529bfd8d05402a5e0c081d383","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/general/page.tsx","sha256":"7a28bfbe7cf6409341b4ba61bdccb7eeb38d7ce9baa5c7c96df116c1e5374435","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/history/page.tsx","sha256":"e419e34d8363d321e1865014bc45db96e1ebb0fe0bcc75453af2277ad6d691f3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/layout.tsx","sha256":"4974c584f3bbdac50ffaf8735cd8d2eccc8ddda604fe517d77476167668e10aa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/settings/page.tsx","sha256":"526dc401bf720f462b19111be622d62c1c23873dd9474b868212ecba9c64c1e7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/components/CreateTradeConfigurationScopeModal.tsx","sha256":"c722320969dbe381e6ce73fe650579660ea1b32cb71aed2e1bfef73750e25f3a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/components/DeleteTradeConfigurationScopeConfirmModal.tsx","sha256":"09778e3efab742498b832f9471dad919953b15c7b13f259ac31629a44b54702f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/hooks/useTradeConfigurationScope.ts","sha256":"95fabc8c297cd0d9ef67c9758026227506e2161ef8e7febc8a515e3dc5c8a6ac","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/page.tsx","sha256":"4361619b75a564591828d4ef04e5be0cf9bde7aed26592a1879bcdfe2207e909","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/general/page.tsx","sha256":"3f839c54d9f2f6ecb5c6eb6a45a05558e16f56b6fe4e4d7f182fc77f4173dc62","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/history/page.tsx","sha256":"ce95a2031975a659cce0ca4a0bf5a9118aafbda0ca5da47bd960616b05acf4a8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/layout.tsx","sha256":"da2293012509ee935d4282ad8ce32e2d5e84ed305d668b848141ebe823d9b43f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/settings/page.tsx","sha256":"3db376b4f2e89d33978e856e65592346830c05b602b5a8dc448203e8dad76e43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/components/CreateTradeControlTowerModal.tsx","sha256":"e1e1b109f1b99e8027b1434f2d233b0b6238dc80bfaae422cfa23bad4e2c06bd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/components/DeleteTradeControlTowerConfirmModal.tsx","sha256":"51281f41ec5e0c7a251aa90918603495fcb890dd2c130c82a472a62276626e77","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/hooks/useTradeControlTower.ts","sha256":"336d2dcc0b2758f27e1b1930db83f5ef2d3e85445eab880d490bccc433aca2ff","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/page.tsx","sha256":"06c137e17e63594a1ce70e7745859e1fe5ca064d235aa9734b12742f3f1e4c2f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/general/page.tsx","sha256":"e7e9fa1a271364ba521d62f42e0b7b3e391984fd28f222de1df5b04eebcbdd45","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/history/page.tsx","sha256":"569d1a5138e195d3df268c0158a5b1cd8a84d1ff373c53b64bbc8dad4d48eae8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/layout.tsx","sha256":"59699dfe433ef9d60cd96ca69ebadfc3ed3840e6ea28f2a1508276cf82cc1863","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/settings/page.tsx","sha256":"f74659b6a19f22fdca53fe65a4f1a14426cac29a3e4b5424146343bc5257535a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/components/CreateTradeDashboardBuilderModal.tsx","sha256":"16c558cd4937fa4343e03afa6301b459ea9064c9fbf2a9703a3c246ba164140d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/components/DeleteTradeDashboardBuilderConfirmModal.tsx","sha256":"55a60ac43c6faf700e35a75b7ead5f709a0c227007fd6fea520a9ea09673c46b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/hooks/useTradeDashboardBuilder.ts","sha256":"d6b375544f0348561d58e2bfa8ef4e49611f56ec203504ec7b93e4c49761a896","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/page.tsx","sha256":"a2a09a4998183e5eab751a0ce1fafa7c1ffd8e152e5fc29a5c33c7c054c3bf1a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/general/page.tsx","sha256":"708e08917cbb63f7c068fc0f9fa6e8082c51a1d39838276101fd89f91890fb2b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/history/page.tsx","sha256":"029929cd36df5c9b6e9dafb8e17c1000e6ed14674c307eee76fd81f19602f915","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/layout.tsx","sha256":"3d7ec7d11a0f5a7c64eab3913ecf2e47d0f4d009faab17a6d76e971c37fe7512","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/settings/page.tsx","sha256":"36a3cbb1e76eeb9839fe85725aee79d3d278a2c3aa2a1b45a17539842eb66816","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/components/CreateTradeDashboardWidgetsModal.tsx","sha256":"d09717bc683bcf06830cedbd4885081498314f7fc62c33b5f05b4f4dc7c6c5d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/components/DeleteTradeDashboardWidgetsConfirmModal.tsx","sha256":"3761b8cac3e851d5c51b5c98b9ffe7d38356711ca65a3dbb6438200e008487a8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/hooks/useTradeDashboardWidgets.ts","sha256":"4fd3766ee191138e63f6ce075b3d408978b1624e43ba698249fd70d783afa9f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/page.tsx","sha256":"50fc009e01b98357e05366e25654e5f0c670440bdf181bcfdd6cfbb2dd3e18e1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/general/page.tsx","sha256":"3683c51660ee420f90e3fe57eef741de5c1d692b19912a8a97a39d5b286357c1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/history/page.tsx","sha256":"093d0b309777d180b4da39dda1a301f73f6840caf838d2e0ac3a417232895608","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/layout.tsx","sha256":"cdc23addd3d6a805d604dd9a558dfa9f58c94976fe5f91073cfd708efb444a51","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/settings/page.tsx","sha256":"a45474d94c9f853c7536f7f0040814b65e5615d7e70379f2ec1d9383f6013e67","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/components/CreateTradeDocumentProfileModal.tsx","sha256":"c714f74043fab6964b792a4cd661ddfd50e88d1e330f94ec02eb0ffb31d5014f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/components/DeleteTradeDocumentProfileConfirmModal.tsx","sha256":"cbf7ea4a9748a6766187e0d7d2cc7b563d1b681812b013d5b594213fee8c8e89","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/hooks/useTradeDocumentProfile.ts","sha256":"1f32f5b062ad1a40f55632badd122f01c97ae0d465f76dd9ea50d846492022f1","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/page.tsx","sha256":"d4c2e2956a0289478569c10e9e3bebddb99f54fd026982eae9c50b90f088be3f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/general/page.tsx","sha256":"964463c398926d0dcd470edba3e4dc33d41f71a9920d23e37189c2eb93af925d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/history/page.tsx","sha256":"5bbafa4fc9a1f4b2c4fefd58ba0a88e0b657f4ed0196507ddc5ce4779917828d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/layout.tsx","sha256":"46e8a1a41ec23374694a129ffa6011130b121453bb85b82cf94734de4749d93b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/settings/page.tsx","sha256":"a83b7f6f7a6a4fc87e98b37799f8b755b2e5f48897223402c48ca9705342705e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/components/CreateTradeExtensionProfilesModal.tsx","sha256":"33b2578b0b3a72205719d983ac10ab58f346f22abb078f601386418e1a3b2f85","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/components/DeleteTradeExtensionProfilesConfirmModal.tsx","sha256":"e8efa4a0174ace403200fc7f34a6312d996186beda619afa6cba5fcd86235800","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/hooks/useTradeExtensionProfiles.ts","sha256":"b8d9659ae543c9886f113b11685430f8f5061101cf34804f3ac876b43759e98a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/page.tsx","sha256":"538392dd4ff962a484f1a1014e01c0db856dfbb8d8c4b18f6ac77823e9640041","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/general/page.tsx","sha256":"dc5aaa2f3a127ce099a29005c09933b9a56aee39042b539b6c192d0bfebf3a10","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/history/page.tsx","sha256":"ac71f8786c186b8ccc4bcf680b935e091d842d36048e2deed56c82efd85a770d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/layout.tsx","sha256":"7d5929807266c060b4db54e9772993c1c469c8193fe114caff6fdf6d96c5eb0a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/settings/page.tsx","sha256":"b2f0f8fee222091ca9107ebd7ddba6cbf244747c2e89b362ff24f714493ae72d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/components/CreateTradeImportsWebhooksModal.tsx","sha256":"0fbd104ffc3b3f0daf719b9b0a10b48efed5ba5fecb913563c1bfa06e0b2e58f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/components/DeleteTradeImportsWebhooksConfirmModal.tsx","sha256":"8d77f8741fce64ac47a011f554708ca8cd083081848c9466c15d1f254573eda2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/hooks/useTradeImportsWebhooks.ts","sha256":"0e13b90bbaa634f083719728825c7ef9906ae94bd81d3e8d5939588a896afa7e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/page.tsx","sha256":"b54d332af2a330a1ce6debfe852baf55b10d2a7a087e8825bf74b9dce7a776a8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/general/page.tsx","sha256":"3d0d1366d8d86f4963de27c8506c00ec36adb56843b621eade0070d75edf8cdc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/history/page.tsx","sha256":"c8321a8c8fa33b4a0974f9b8cb12492df0f51823155d848d2d7aa13f3715bf08","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/layout.tsx","sha256":"57b93ac56265d7b94b5c2b1392813a4bf5678645be3175a38de7c8ee4a824b08","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/settings/page.tsx","sha256":"fb2b45b3ecf5f5f9e6eb8e544dd10707e9627fcfeb9de2aa6a6d6905eeff19bc","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/components/CreateTradeInventoryModal.tsx","sha256":"a2eaac3bfe8122ad63d9a4ee9ecd1acf68821d28cd03d99b5ac62ab9a129f354","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/components/DeleteTradeInventoryConfirmModal.tsx","sha256":"e8a499aeaec13a757801a5b39608712cece3a2e87aba1a2297a0a9e7ae6a4701","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/hooks/useTradeInventory.ts","sha256":"baf75a8ba7b61b84e8735c42412780986858115ac20664ed4909e3f4dd4656a2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/page.tsx","sha256":"93e0c1f6e43805feb1017b128b664cc36783808e773d7e683fa9bbe2f770381d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/general/page.tsx","sha256":"12785b9b5e5ea9e12576755a183aadf50868410806848d9bbe01611a6ba25b11","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/history/page.tsx","sha256":"8d159c8072be724d6ccb01e2f8d978cb672d86c527442f68f3601f0af4df8fef","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/layout.tsx","sha256":"fb3b2e0e8abcb91ce282f2d7aa4fa0173955723a562c74525befa993ec744adb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/settings/page.tsx","sha256":"20bf62d24e5284cce642a2a153bb46ecbaf7ac6f514c8810330975f30968ad73","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/components/CreateTradeInvoicesContractsModal.tsx","sha256":"26c8dff2c0f748a4bd434ebef02d875188220b67857ea9902502d0a659181787","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/components/DeleteTradeInvoicesContractsConfirmModal.tsx","sha256":"27ba46f5d914ede5fbb54844b139e0b2525a24a6edf3ff2fb944949196640449","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/hooks/useTradeInvoicesContracts.ts","sha256":"fa8e4d3aed291d50351d700d07a2a7d67c621c2959eb42221d4b681363247765","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/page.tsx","sha256":"1c0ae7622f13a32ad26db20d58b2e8ebf9e4b644d3a70f4e22cac2ee0673cd8c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/layout.tsx","sha256":"d289212e5fdb5870c61dc1d1fb3da058d6f8640c3b9e3f64398306091281b2bf","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/page.tsx","sha256":"13500320bccc2223e679d17ae89d1883594ef6a39f26a5611b901fca832e3734","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/general/page.tsx","sha256":"24f1456d2937976baa22bf55b0d5d0aff852aaa6e24224b7fed1f8df5200b921","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/history/page.tsx","sha256":"0d397a8cfb9a2c8ae40ccf7ae0a43b1ee355e9b47e59d9ad03366176b4382f2f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/layout.tsx","sha256":"1caec32702490702a094722b6dd03072e4427887db2a15529609d74e96b15113","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/settings/page.tsx","sha256":"89081d6798c22f4caaf7c9319f0224356de1977ec090c113488a4e76db7be50f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/components/CreateTradePolicyStudioModal.tsx","sha256":"066fc8e9a855f3a75903611c4eca231e854a4874ae7e97e934cf6aee61fa1808","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/components/DeleteTradePolicyStudioConfirmModal.tsx","sha256":"6fec7654608a327e3106a0fc9dab38b40ea0a5a4b122596031826974aa81d700","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/hooks/useTradePolicyStudio.ts","sha256":"5e88d0aec23c064fb9b29be09a3ad3249aaded2408fa89015bce4f2d7cd40cf7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/page.tsx","sha256":"b7bb6399fe80230154ed7302e51340d305656946e82aadf28829c2ef94b9e17b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/general/page.tsx","sha256":"f3e66cb5aee1506f074b7171856d62bab4734d9facf34dcc72c33e3e64a4be5d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/history/page.tsx","sha256":"495e765e4068e455d4fe2419db0421ec40c89695b3e2013bbf62a57c8276c570","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/layout.tsx","sha256":"a5394d59bd909dc8bc9b24eb36841a993fa06cd82c5e3752644cd9e0080978f2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/settings/page.tsx","sha256":"939fa65bf878fa96dad2837cae6bf18bb70628711ed353d8274226210c64b11c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/components/CreateTradePricingPriceBooksModal.tsx","sha256":"0e0751998006a5b28694e5fb14f175dd674f6ee101dd3a04e796a6fa08272897","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/components/DeleteTradePricingPriceBooksConfirmModal.tsx","sha256":"8ed3babe7935114ec9ed4687daa55a4faf9dfbac09d1fdfad01577161d6cad6a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/hooks/useTradePricingPriceBooks.ts","sha256":"f9a4be8699059de1557ea48dfcf873126eca85be444120c7d78a5262abbeb350","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/page.tsx","sha256":"db30bf190ba68741f3f4478b8118dca1368e8b5ff06028969a5b30f6d886e691","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/general/page.tsx","sha256":"3b32b50233b5a0aff56dfe86a019563b5d25e0bfc857990c48eb4bfba599f1e7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/history/page.tsx","sha256":"8a75824779494119843cc39e4475a0b6f9074fe705a07e3813d4f073ef1f83a0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/layout.tsx","sha256":"9db364709defc8b7efce6fbbdf94f00b78c201dbb1fdc62dbe93f6c23577b92b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/settings/page.tsx","sha256":"241a2be65784199de93181cd0abe7b3decad9bfa1e60043dd535f4634efaac19","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/components/CreateTradePurchaseOrdersModal.tsx","sha256":"ee539fc56b2e23383768f32aec412ad8bee79246a101b5be99d2e21eb85fc933","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/components/DeleteTradePurchaseOrdersConfirmModal.tsx","sha256":"6c28d889264da348ec2c174846fdffe66b1ef529f7aeb11aae7b7c5e4f8dec4d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/hooks/useTradePurchaseOrders.ts","sha256":"c5e713812aca7152de6f6f4fb9d2ac6006579ce2948eeed681db0a09964a9be9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/page.tsx","sha256":"086fba54ca99262c6cbfdff1ff06459ccb54ff7cbd1009e219db5688e95eb1f7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/general/page.tsx","sha256":"c83c29d2c19c8f18af9f6860c7261259ed36663cb42eb85a41b0d61614c1b252","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/history/page.tsx","sha256":"0c6d05520dfad55ba8d3a6909a3b1a35305a2f7a0144d5c2015389c90df95ff8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/layout.tsx","sha256":"aedf7c01ef9e0649600bed5e78e09b84caa7fe36f9395fc4046d67eb73e2e90a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/settings/page.tsx","sha256":"ba1c1e3c57ceba90c616f7bf22092022fa78c5cd93f9b195a78929f8125350f3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/components/CreateTradePurchaseQuotationsModal.tsx","sha256":"433804dc59adb62f95aa5a7c65653b8affd24a354cee03d1a61f160a8bb61ef0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/components/DeleteTradePurchaseQuotationsConfirmModal.tsx","sha256":"3adc7904775f8ddd64284049c5891eb42320ae43a00d325284b9428ec8e6512d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/hooks/useTradePurchaseQuotations.ts","sha256":"973e59c653fa7551bf7ada0eabbbdcbf5a7fa08b067745b892c6f879f7e6836e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/page.tsx","sha256":"7a3663cda44f16f067a33691b4ad1ff8f9e3c02c052bf153db0b4706e443fd31","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/general/page.tsx","sha256":"95814606d6b859b2caabafd1eb3e784dc6e918ebea4c916946c10b5e24297bb0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/history/page.tsx","sha256":"d51a13b58a08dc2c2d14ddaf60d5db0ce2ac44bad34e002fd2b8bc863fa7143c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/layout.tsx","sha256":"37bdb7057a6c8e8f8acf6a8054bee3c0b704661a4c95a04fbc78b39d7f5a0b96","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/settings/page.tsx","sha256":"fad6338aee38f36f74402e1be06a7d1d6bba780e0b79fd08fcee4fdcf8df3534","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/components/CreateTradeQuotationsSalesOrdersModal.tsx","sha256":"d870f4e3c1040cebdc8a47f28094936b91112e723c4f5f121544af8605ea5119","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/components/DeleteTradeQuotationsSalesOrdersConfirmModal.tsx","sha256":"2124128ac2f69325c57757fb83cc7e5c3c097da9807cbb0c1ccd83031e517111","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/hooks/useTradeQuotationsSalesOrders.ts","sha256":"a738499df473f6b1f2e1cf6cd7c5bfb0d76c190019cb68c0f58bb457b83c2996","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/page.tsx","sha256":"d14a9b5ad40ca46b866325ec1b2654ae7e59f50164af3fc59f19191b4015c4b8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/general/page.tsx","sha256":"64a7763485e1fdd602b2b0ae142ad7dd79df832f263e85e99e6327586f93bbb6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/history/page.tsx","sha256":"a98817e2d59732741e856d05f208fc80a156324b4ede5ede9126be298f8cecb5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/layout.tsx","sha256":"8db3dcbf7af612be4c1a91130ea7b4a8a691b296189b7a6d9928b693b3697279","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/settings/page.tsx","sha256":"7dff3f28f28869f135463f6ff67552ed3aeed1eaa1b67a162b840e09a3d12ca6","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/components/CreateTradeWorkflowVersionsModal.tsx","sha256":"0e6a680809d2d2a2bd59e0d1935f39e77e0e522901ed504613ddd78e8d8ac01b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/components/DeleteTradeWorkflowVersionsConfirmModal.tsx","sha256":"cbece6a18d8c0ef54f8748c21c86a5938e5c18dc01ef1262d1fc48d3c5840824","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/hooks/useTradeWorkflowVersions.ts","sha256":"ce14bff437e4b918c3da5caa7c3e30769e3700a85e5ce51f9c14705930a04e9e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/page.tsx","sha256":"2644289ef82d24c1a48cd7c36b3f5a3fa72d3d69e22663e658ea6cacbdb1c45e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/globals.css","sha256":"90904dadf9f71c313d14b0c920c0e6cc3f32b18118e769dca7b04eb5bc55001b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/layout.tsx","sha256":"2b0fe4efee8da69915a6b8084f7f51a0da822a6f02c960595c876e70340fe784","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/login/hooks/useLogin.ts","sha256":"5ef4b92493085c011307f56badb479be3e186c41f20a9cd6cef22581a24fe8a7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/login/page.tsx","sha256":"1bcabd8773b56b9ea166883151ac4aea28d3a93df86fcf1ec5e551c234978587","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/page.tsx","sha256":"31b88fb7f7a6a325d9d21c6e69fc0dff3a19dc6c992a68d7ef9f765a6e6b5505","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/BranchSelectDropdown.tsx","sha256":"506e3e68b5c266a7d163d0d2ee52acbbe909c97b172202067fed93a07a22069c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/CoreNavbarLinks.tsx","sha256":"70567f878b89ac75b4b863b52165d33baa881ae5855baa268b8930bce7ce7d2b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/CrmNavbarLinks.tsx","sha256":"999000c2df1f0d474fb703f1f65c926d9dbb6fcb43fc1223317f8b4cea330620","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useNavbar.ts","sha256":"86922130f9ee59420c0d0544f0d2be71acda6a89ddf5ac1245c5c5d7fd89bcab","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useUserDropdown.ts","sha256":"51a1fc6484cbe9646424bec724c74aa29342a0ba42a9132439c1d022539f4933","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useWebRTCPhone.ts","sha256":"81d513920028226d9a0e40df81a62837a2a449e2f4bb5f38f4a093733d12818f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/IncomingCallPopup.tsx","sha256":"1b62a7bf37a4273b49fd93afe3dd1636419b50b6df0b5f0309af32b6d9cc9ba4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/LanguageToggle.tsx","sha256":"c3bde10cbd835c3d71453fd4cfde6c47fe063577c9cad82d33df832493058a95","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/Navbar.tsx","sha256":"930b159e3fed339e1c48e8068c3d42c376fd765f890a03a13add1d9806acb8d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/NotificationsDropdown.tsx","sha256":"a1afc5f107da59669a7e0e3d3b8af040ee506df85779afd0b890c1934ac631d5","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/PipelineSelectDropdown.tsx","sha256":"6a234450021477c08fa8ab0a2446d67cfb5f0bb5ae1e7df4756de020b1a65c34","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/ThemeToggle.tsx","sha256":"513e412560dbce8db5a4d94f04cef9284a86476dea1303132e47ef074ddf63e2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/TradeNavbarLinks.tsx","sha256":"6fc0779ac1925ac8b29d4ac65c90e543546ea992897024fc581a4c15c21dc6a2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/UserDropdown.tsx","sha256":"a51f4f0fab9818c0d320ff0cc8d800c9ad2ca39ba1225d37fee424d0ce617720","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/webphone/api.ts","sha256":"01e2342a4fa0c28826773f1badbd3c4539f0314ed7d33c307e258179b81e92c4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/WebPhoneTrigger.tsx","sha256":"fd0e6053029c88bbf7468d254a13158cb3996cf20a6029da21faaa5e38a9bb2e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/WebRTCPhoneWidget.tsx","sha256":"5a66bde0337b7b4233c70aaa490a3658d6ea2f04de765d09fd3cf9d6aa29951d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/shared/CountrySelect.tsx","sha256":"be064d4b5edfc4833f9eae91a56a10736abea032dd48a3b65b5f838eda3c1fb0","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Badge.tsx","sha256":"1671658ca80064ec6535a60e26c2430a05a907fb49dc43eae429da1ea27e845e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Button.tsx","sha256":"99ee93f092c491187dfebada78b9f27cbfe0d5195590bde00be53bc35bea022e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/ConfirmModal.tsx","sha256":"f872415fbe0ae0846221e83a499003466cb7a93958a1ecc08331438918e5634b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/DetailTabsLayout.tsx","sha256":"442af3c562dc11eae52293aa7ff72d1a49768c4952681fe0a95a6ca9accbf471","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Input.tsx","sha256":"aa1be10c0edda4534be03c77c39be5d635e0c7c764aea17a6bf876aebaacb288","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Modal.tsx","sha256":"8cb69f4a1f64467bb72ad9d486c8448a33ecc3c7b7b8b8e3846e14e8411dc967","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/PageHeader.tsx","sha256":"864b7615fb30a58ec9be82260a2261c5439dd0010f5e220092717d79ef4eb4e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Select.tsx","sha256":"7a0a58ec4a51e36e8e3f87333fe6312276685f1f494f251c9ec68a1e2f4a1e3b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Table.tsx","sha256":"c9f37883df0d8c0f5b41f6f9fbf14015389df68fb1f6a3e46a020e16b8b59d68","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/TableToolbar.tsx","sha256":"bd249a62918936527885cc826e45c06547042e0395b5a983102ea5c4aecca1fa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/ToastContext.tsx","sha256":"95e5d05dce866058e2709d66a89d97d2db5cc56a87c08e07f9dc14fbab664318","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/api/dashboard-api.ts","sha256":"5fea1ef3b393886933ae624f6610c83af2270554f0b8df967bd720ecd691a520","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-navbar.tsx","sha256":"8a375727ac59459673c9172fe9cca404e02ed1831bcccdb52d34f98df45ba67b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-toolbar.tsx","sha256":"6c98511e3f2d4af0fc22af8ed6b13520786fe35f8cbc31e43985895b2f673d77","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-workspace.tsx","sha256":"c0aef894ef9b25c56f0179578d068c1fb01960e35e84b2b349652d7d6db9b761","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-drilldown-panel.tsx","sha256":"3d136516cc529184a00c1a9b5aafc4230bad692b3788e2752ac71cfd9f23b119","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-filters.tsx","sha256":"fd8901c12ccaee8cce451c6846ce59a652f887a2328a4d90b29c998a48603014","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-form-dialog.tsx","sha256":"e45a345670ef521d2bed38b4673a31de8ee74461c2d39d220ca1d2349efa2433","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-grid.tsx","sha256":"67a987f43c782437ecb5b9bd59a89a333a681ef54bd67251bc7ffdb7a3db6282","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-header.tsx","sha256":"f743201517eb35b89779cb45787a12c85ecb362dc6551e3fba0d553780c6b239","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-share-dialog.tsx","sha256":"54ca2eb7f0cf4af4fd617a9f0b05af7a06b3779944270be696b685ceaac4a943","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-sidebar.tsx","sha256":"30da9fdc78d19186ab0778238cce8b5bf4d62f94bcd418a2a459a92789ce1de2","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-view.tsx","sha256":"13df380c9b47346aa7f6cd4ff50f0b0c09310a1ca2eb956731c37bbf50c28f71","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-widget-renderer.tsx","sha256":"5e2a51e024a2a49283793593fddc58705b6099725a8238eb9c5b459c45448fbd","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts-adapter.tsx","sha256":"a60f1c1d82fc6b9428ab953ded9c9cf2898853bf53a6674891f2c8b47dba6619","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts-options.ts","sha256":"9192787edea22e942943d59bb248da20a7325acdd527aabac113790438f625d3","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts.module.css","sha256":"b08013851138e8b097a79d2d448cf8680d6783552f012fcace070523cf318bdb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/LeaderboardRenderer.tsx","sha256":"ec155059986849d1ce44d5b678bcc37ed9fdc3d6c2ead510ec1a92c1b3545bcb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/MetricCardRenderer.tsx","sha256":"c290028441c85e950999b1c06517e71cc6a5f4abd92ba811d4003c5d70b1ebfb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/ProgressCardRenderer.tsx","sha256":"90a80978e9996f62e3c8165b2c2c3117028f3c076c91cd3956410eae87dbff43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/TableRenderer.tsx","sha256":"43ba726973bd361aabd24cfaeedc15cef309921fe3e383158a9da7c5046b818a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-builder-dialog.tsx","sha256":"8124a2bc3bfd242f3c0b828efb290b510ad5c5f1202e519bd3b545fd58bba5f8","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-delete-dialog.tsx","sha256":"ca5e8269e8ff767fc2c26e4d9700343b6e85f327509407e6b8d2f3e3a17cbc68","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-duplicate-dialog.tsx","sha256":"2ad5fbe64bde450e469be4e5da8392a2c6a8813aed53becbac302a657eb87932","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/WidgetEmpty.tsx","sha256":"8adec33d563762b168e373d68e20f442e7008f9cd9c329dda4fd8ea2e9b61c77","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/WidgetSkeleton.tsx","sha256":"35725149f73551eefa9c2bc0cbcfe6580981be2e1a3ad2675366fb2abaef1b28","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/data/mega-demo-dashboard.ts","sha256":"c985fab0ed197f0911ec076ccfe704ce67208d6ee4b6ed32d27624e4b5e1b150","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/hooks/useCrmDashboardWorkspace.ts","sha256":"7016d1f514b76954fdcc3c1077ede3ccd92eef6543ff441a005a60446b5cfcaa","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-model.ts","sha256":"f13a02a9289557487033e5a34b209fb2742bc4cd7a96d6487f77ded7344f2e46","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-safe-href.ts","sha256":"f3fd7fd13f89073dd928ae6210449fb9ca37663160b514907d22c288778a8161","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-types.ts","sha256":"1e3b50c79bfbff08fc5aaf944ff561be0d0913e196fa383585e5e8314b97e22d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-utils.ts","sha256":"a6f70b39de8df514386fa9dc958beee9cb0a7444eef4a1246dbcbdd385809bdb","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/useDashboardStore.ts","sha256":"a4368424bb177514704414b8bb6f6c5005e46f322394aa7d638349a08dc4e226","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/utils/cross-filtering.ts","sha256":"7218370a35b6f44043d449df10244869fa7ed68a917b66fc937a92e4597dee19","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/utils/export-utils.ts","sha256":"0e2c96e1ea63623835f04ea6f9158000dd781b66e04754638e8f6484e6d2604d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/board/board-column.tsx","sha256":"e9ac365a29737c94903a80522939db5e210108ac5ad177887efebf5eae795156","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/board/opportunity-card.tsx","sha256":"889550c5190bcc4acca078b6dd982f28e1be042aa4516ca0bac76b643cde387d","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/cards/opportunity-detail-card.tsx","sha256":"d7613e1c2d70d2bee8a549d62f6d440312b6be14e21c7d00bed88749346ddf53","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/pipeline-workspace.tsx","sha256":"1581684cc316775b20156e123cbc915eeb831d1c5dca6a614120d48f5ffacb3f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/communication-confirm-modal.tsx","sha256":"b9f30a0347377c70582b5cf01f4d78fc2bd6c3ae34c5dd6fe82c915a578df0e9","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/opportunity-activities-modal.tsx","sha256":"d0bd38a538140546eb7f7eb7f7e0abf391318257a9391f87ddf33060ba77bd02","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/opportunity-importance-stars.tsx","sha256":"8cf6ff5dd2c77b71197bd4d501261838aa057055fa8050cb44d736863c44b67b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/pipeline-multi-search.tsx","sha256":"af8b99506494e40218990bcfb0ccb856c764630de9c70600fcb6f2359b5604b4","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/terminal-move-modal.tsx","sha256":"f9ba735841bc1448740b183c16d2d32f22a01a34080fa5321f3ba1bdc0dbf8ce","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-board-view.tsx","sha256":"160c3e69621ce8920739372cc1ea1d25400c26c692f2b637c53bb643eacc4d8b","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-cards-view.tsx","sha256":"89694e597f882ed0765eb118d9fcc97c2f549827037574b46035f28081e1d5ef","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-list-view.tsx","sha256":"c70bbb14b36a572bf51eb965f295942b3a1136c744b81cb160d50accbc8d8c43","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/data/mock-pipeline-data.ts","sha256":"58330ee754b7e9cf918fdca98677bb1c704523ef503cd8d63ec5ee431a1a506f","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/hooks/usePipelineWorkspace.ts","sha256":"d3dc5fad572637bb925f44e6faecd9fd523e8e034e6b3c5b919314708c306645","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/models/pipeline-types.ts","sha256":"28edbc95a9520116926723307dd0d5ed8ed469d68f1e936ba1cd806d1ecb4ad7","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/dictionaries/ar.ts","sha256":"6a79857c0c4296aac26365c7d04cb8c8cf00292f835cf7eb3bf59bcacdf0af0a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/dictionaries/en.ts","sha256":"5ab40fd7fb89b74d87cbee1452dddd8725090754a1973666c4da9130706e1b69","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/I18nContext.tsx","sha256":"5b84626416c18d2452687f34f265fc7ec43de5f946e155f5c80e6b550475b591","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/lib/api/axiosClient.ts","sha256":"160bbebc0c53ee8f07af390206c5a5226bbf57a886094c7023e51aa127a5188a","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/lib/safeStorage.ts","sha256":"93c348de2232ec17ff73ffde8cd3fd8ad75756365597fb02806137cbb69df069","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/lib/utils.ts","sha256":"06c890ee64a0f56144df4adad1ca2622b4fb11696f27fc42ce4f8cf15cf6e468","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/shared/api/tenant-api-client.ts","sha256":"2ef5264a4ea8531e7e5c1ce3e9883be597c52c7f4d3a76598cde149af605577c","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/tsconfig.json","sha256":"48ae8d033f441a99e3d6c41b08cd3e482b2f0c1b7a0a69bbb7af9be6a3021445","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/tsconfig.tsbuildinfo","sha256":"2e5c001baa00f81907aa9f92ee576d74ddc1e87a6e0f9d709dba1fd2dffc7605","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/typecheck_errors.txt","sha256":"a04d472c6e83454849252be61fb8fec5a65b2f0d02c8a101038c84c50ceb352e","mode":"semantic","state":"PENDING","phases":[],"issues":[]} -->
<!-- FCFILE {"path":"trade-app.lnk","sha256":"ec1bd94fff8f222f38cdbb2579f24efd70c5c42bb2353ed84084956de9baae10","mode":"metadata","state":"PENDING","phases":[],"issues":[]} -->
<!-- FC-COVERAGE-END -->
