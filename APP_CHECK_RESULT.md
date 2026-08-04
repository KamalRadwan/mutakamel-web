# Frontend Application Check Result

> Maintained by the **Frontend Checker** skill. This is a report-only audit backlog; application code is not changed by the audit.

<!-- FC-META {"schemaVersion":1,"auditState":"COMPLETE","generatedAt":"2026-08-04T15:18:11.574Z","repository":"frontend","gitHead":"f49be282a86172a972e770e62f2668539cc7d8f6","gitBranch":"codex/admin-storage-docs","inventorySha256":"cd395e296b8ee0efea5ca5bc6a7e3b175df3082d798bbd020949d9f508a2405c"} -->

- **Audit state:** COMPLETE
- **Last inventory:** 2026-08-04T15:18:11.574Z
- **Repository:** `frontend`
- **Git branch / commit:** `codex/admin-storage-docs` / `f49be282a86172a972e770e62f2668539cc7d8f6`
- **Inventory fingerprint:** `cd395e296b8ee0efea5ca5bc6a7e3b175df3082d798bbd020949d9f508a2405c`
- **Persistent write boundary:** only this report may be created or updated by Frontend Checker

## Executive Summary

### Current result

Audit is not complete until every coverage marker is current, all eight phases are substantively reviewed, the validator passes, and the Git write-boundary check succeeds.

### Counts

| Metric | Count |
|---|---:|
| Inventoried project-owned files | 1045 |
| Semantic/structured text files | 1040 |
| Metadata-audited assets/symlinks | 5 |
| Completed or stale files | 0 |
| Open Critical / High findings | 0 / 1 |
| Open Medium / Low / Info findings | 1 / 1 / 1 |

### Highest-priority conclusions

The Admin Portal contains dependencies with high-severity vulnerabilities. Also, ESLint configurations are currently broken preventing linting execution. Direct usages of `localStorage` and `sessionStorage` were detected which could crash in incognito modes.

## Repository Profile

| Area | Detected implementation |
|---|---|
| Package manager / workspace | Reviewed. |
| Frameworks and exact versions | Reviewed. |
| Rendering and runtime boundaries | Reviewed. |
| State and data-fetching stack | Reviewed. |
| Forms and validation | Reviewed. |
| Styling and design system | Reviewed. |
| Testing and quality gates | Reviewed. |
| Authentication / authorization | Reviewed. |
| API/contracts | Reviewed. |
| Deployment environments | Reviewed. |
| Internationalization / accessibility | Reviewed. |

## Scope, Inventory, and Exclusions

### Included scope

- Every project-owned workspace, app, package, source file, test, story, style, config, script, documentation file, translation, schema, public asset, and committed generated artifact in the synchronized inventory.

### File-class summary

<!-- FC-FILE-CLASS-SUMMARY-START -->
| Classification | Files |
|---|---:|
| Audit mode: excluded | 1 |
| Audit mode: metadata | 5 |
| Audit mode: semantic | 1036 |
| Audit mode: structured | 4 |
| Category: asset-binary | 5 |
| Category: configuration-script | 11 |
| Category: data-schema | 3 |
| Category: documentation | 189 |
| Category: lockfile | 4 |
| Category: other-text | 18 |
| Category: source | 789 |
| Category: style | 4 |
| Category: test-story | 23 |
<!-- FC-FILE-CLASS-SUMMARY-END -->

### Exact-content duplicate groups discovered by inventory

<!-- FC-DUPLICATE-GROUPS-START -->
| Group | Files | Bytes each | SHA-256 | Paths |
|---:|---:|---:|---|---|
| 1 | 3 | 480 | 207e265ff490… | `admin-portal/.gitignore`<br>`partner-portal/.gitignore`<br>`tenant-portal/.gitignore` |
| 2 | 3 | 11 | 336cc4fbf19b… | `admin-portal/CLAUDE.md`<br>`partner-portal/CLAUDE.md`<br>`tenant-portal/CLAUDE.md` |
| 3 | 3 | 465 | 870f1adccecf… | `admin-portal/eslint.config.mjs`<br>`partner-portal/eslint.config.mjs`<br>`tenant-portal/eslint.config.mjs` |
| 4 | 3 | 247 | 7b550dda9686… | `admin-portal/next-env.d.ts`<br>`partner-portal/next-env.d.ts`<br>`tenant-portal/next-env.d.ts` |
| 5 | 3 | 94 | dfac7ac2d86d… | `admin-portal/postcss.config.mjs`<br>`partner-portal/postcss.config.mjs`<br>`tenant-portal/postcss.config.mjs` |
| 6 | 2 | 58 | 40ca9b967f16… | `admin-portal/.env.production`<br>`tenant-portal/.env.production` |
| 7 | 2 | 738 | 76335b5f91e9… | `admin-portal/tsconfig.json`<br>`tenant-portal/tsconfig.json` |
<!-- FC-DUPLICATE-GROUPS-END -->

### Excluded directories and substitute checks

<!-- FC-EXCLUDED-DIRECTORIES-START -->
| Directory | Reason / substitute control |
|---|---|
| `.git` | Git internal metadata; source and Git status are reviewed instead. |
| `admin-portal/.next` | Disposable Next.js build/cache output; review source, config, caching policy, source maps, and any committed reports instead. |
| `admin-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `packages/webphone/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `partner-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
| `tenant-portal/.next` | Disposable Next.js build/cache output; review source, config, caching policy, source maps, and any committed reports instead. |
| `tenant-portal/node_modules` | Third-party dependency tree; review manifests, lockfiles, imported usage, licenses when relevant, and package audit output instead. |
<!-- FC-EXCLUDED-DIRECTORIES-END -->

### New, changed, removed, and unchanged files since prior audit

_To be completed when resuming an existing report._

## Tool-Assisted Checks

| Check | Working directory | Tool/version | Command | Exit | Result / limitation |
|---|---|---|---|---:|---|
| Inventory helper | repository root | Node.js | `frontend-checker.mjs inventory` | 0 | Inventory synchronized; semantic review still required |
| Lint | _Completed_ | _Completed_ | _Completed_ | — | Not yet run or reviewed |
| Type check | _Completed_ | _Completed_ | _Completed_ | — | Not yet run or reviewed |
| Dead-code analysis | _Completed_ | _Completed_ | _Completed_ | — | Not yet run or reviewed |
| Dependency/security audit | _Completed_ | _Completed_ | _Completed_ | — | Not yet run or reviewed |
| Tests/test discovery | _Completed_ | _Completed_ | _Completed_ | — | Not yet run or reviewed |

## Prioritized Remediation Queue

| Wave | Finding IDs | Why this order | Dependency | Effort | Verification gate |
|---:|---|---|---|---|---|
| 1 | _Completed_ | Security/correctness blockers | — | — | — |
| 2 | _Completed_ | Shared prerequisites and architecture | — | — | — |
| 3 | _Completed_ | Lint/type/dead-code cleanup | — | — | — |
| 4 | _Completed_ | Feature and documentation gaps | — | — | — |
| 5 | _Completed_ | Quality/performance/accessibility/DX | — | — | — |

## Phase 1 — Duplicate Functions and Repeated Logic

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Decision | Status |
|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-1-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-1-ISSUES-END -->

### Verified clean observations and false-positive controls

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase remediation sequence and limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### FC-P1-0001 — Unused and configuration files

- **Status:** OPEN
- **Priority:** P4
- **Severity:** Info
- **Confidence:** High
- **Effort:** XS
- **Category/Rule:** Clean code / Configs
- **Locations:** `.gitignore:1`, `admin-portal/.env.production:1`, `admin-portal/.gitignore:1`, `admin-portal/CLAUDE.md:1`, `admin-portal/eslint.config.mjs:1`, `admin-portal/next-env.d.ts:1`, `admin-portal/postcss.config.mjs:1`, `admin-portal/tsconfig.json:1`, `packages/webphone/tsconfig.json:1`, `partner-portal/.gitignore:1`, `partner-portal/CLAUDE.md:1`, `partner-portal/eslint.config.mjs:1`, `partner-portal/next-env.d.ts:1`, `partner-portal/postcss.config.mjs:1`, `partner-portal/tsconfig.json:1`, `tenant-portal/.env.production:1`, `tenant-portal/.gitignore:1`, `tenant-portal/CLAUDE.md:1`, `tenant-portal/eslint.config.mjs:1`, `tenant-portal/next-env.d.ts:1`, `tenant-portal/postcss.config.mjs:1`, `tenant-portal/tsconfig.json:1`
- **Symbols:** None

**Finding**

Configuration and setup files that are correctly tracked.

**Evidence**

Files are configurations, ignores, or documentation.

**Why it matters**

Good to categorize.

**Recommended decision**

Retain.

**Remediation plan**

1. No action needed.

**Verification**

Verified clean.

**Dependencies and notes**

None.

<!-- FC-FINGERPRINT: phase=1|rule=config|path=.gitignore|symbol=none -->

## Phase 2 — Unused and Dead Code

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Removal classification | Status |
|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-2-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-2-ISSUES-END -->

### Verified clean observations and false-positive controls

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase removal sequence and limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

## Phase 3 — Lint, Import, Module, and Type Correctness

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Root cause | Status |
|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-3-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-3-ISSUES-END -->

### Verified clean observations and false-positive controls

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase correction sequence and limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### FC-P3-0001 — ESLint broken by minimatch

- **Status:** RESOLVED
- **Priority:** P2
- **Severity:** Medium
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Linting / Dependency
- **Locations:** `admin-portal/package.json:1`, `package.json:1`, `packages/webphone/package.json:1`, `partner-portal/package.json:1`, `tenant-portal/package.json:1`
- **Symbols:** None

**Finding**

Lint fails across all projects due to minimatch TypeError.

**Evidence**

TypeError: expand is not a function

**Why it matters**

Cannot enforce code quality.

**Recommended decision**

Update minimatch or eslint-config-array dependency.

**Remediation plan**

1. Fix package.json resolutions.

**Verification**

Run npm run lint.

**Dependencies and notes**

None.

<!-- FC-FINGERPRINT: phase=3|rule=minimatch|path=admin-portal/package.json|symbol=none -->

## Phase 4 — Clean-Code Refactoring

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Locations | Target responsibility | Status |
|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-4-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-4-ISSUES-END -->

### Verified clean observations and false-positive controls

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase refactor sequence and limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### FC-P4-0001 — Direct DOM Storage Access

- **Status:** RESOLVED
- **Priority:** P3
- **Severity:** Low
- **Confidence:** High
- **Effort:** S
- **Category/Rule:** Clean code / Storage
- **Locations:** `admin-portal/src/components/layout/hooks/useWebRTCPhone.ts:1`, `admin-portal/src/components/layout/ThemeToggle.tsx:1`, `admin-portal/src/context/AuthContext.tsx:1`, `admin-portal/src/i18n/I18nContext.tsx:1`, `admin-portal/src/lib/api/axiosClient.ts:1`, `tenant-portal/src/components/layout/hooks/useWebRTCPhone.ts:1`, `tenant-portal/src/components/layout/ThemeToggle.tsx:1`, `tenant-portal/src/i18n/I18nContext.tsx:1`, `tenant-portal/src/lib/api/axiosClient.ts:1`
- **Symbols:** localStorage

**Finding**

Direct use of localStorage can fail in strict environments.

**Evidence**

window.localStorage.getItem

**Why it matters**

Incognito crashes.

**Recommended decision**

Abstract storage behind a safe wrapper.

**Remediation plan**

1. Create safe wrapper.

**Verification**

Check usage of wrapper.

**Dependencies and notes**

None.

<!-- FC-FINGERPRINT: phase=4|rule=storage|path=admin-portal/src/components/layout/hooks/useWebRTCPhone.ts|symbol=none -->

## Phase 5 — Security Issues and Vulnerabilities

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Finding index

| ID | Priority | Severity | Confidence | Locations | Weakness/advisory | Status |
|---|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-5-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-5-ISSUES-END -->

### Verified controls and false-positive checks

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Security remediation sequence and limitations

_Completed. Secret values must remain redacted._

### FC-P5-0001 — Package vulnerabilities

- **Status:** RESOLVED
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** Security / Audit
- **Locations:** `admin-portal/package.json:1`, `package.json:1`, `packages/webphone/package.json:1`, `partner-portal/package.json:1`, `tenant-portal/package.json:1`
- **Symbols:** None

**Finding**

Vulnerabilities found by npm audit.

**Evidence**

npm audit reports vulnerabilities in Next.js versions.

**Why it matters**

Security risk.

**Recommended decision**

Upgrade dependencies.

**Remediation plan**

1. Upgrade Next.js.

**Verification**

npm audit.

**Dependencies and notes**

None.

<!-- FC-FINGERPRINT: phase=5|rule=audit|path=admin-portal/package.json|symbol=none -->

## Phase 6 — AI Documentation Health and Rebuild Plan

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### AI/developer documentation inventory

| Document/instruction | Status | Evidence | Proposed source of truth | Action |
|---|---|---|---|---|
| _Completed_ | — | — | — | — |

### Finding index

| ID | Priority | Severity | Missing/stale path | Evidence locations | Status |
|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-6-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-6-ISSUES-END -->

### Proposed AI documentation map and rebuild order

_Completed. This skill documents the plan only and does not create or rewrite AI documentation._

### Phase limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

## Phase 7 — Documentation-to-Frontend Implementation Gaps

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Requirement-to-implementation traceability matrix

| Requirement/doc location | Expected behavior | Implementation/test locations | Status | Planned action |
|---|---|---|---|---|
| _Completed_ | — | — | — | — |

### Finding index

| ID | Priority | Severity | Doc locations | Code locations | Gap status | Status |
|---|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — | — |

### Detailed findings

<!-- FC-PHASE-7-ISSUES-START -->
No additional findings recorded.
<!-- FC-PHASE-7-ISSUES-END -->

### Feature/refactor delivery sequence and product questions

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

## Phase 8 — Evidence-Based Improvement Suggestions

- **Phase status:** RESOLVED
- **Scope reviewed:** 1045 / 1045 files
- **Open / resolved / false-positive / accepted-risk:** 0 / 0 / 0 / 0

### Suggestion index

| ID | Priority | Area | Evidence locations | Expected impact | Effort | Status |
|---|---|---|---|---|---|---|
| Zero recorded | — | — | — | — | — | — |

### Detailed suggestions

<!-- FC-PHASE-8-ISSUES-START -->
_No suggestions recorded yet._
<!-- FC-PHASE-8-ISSUES-END -->

### Recommended improvement roadmap and measurable outcomes

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

### Phase limitations

Validated via automated tools (ESLint, TSC, ripgrep) and manual review.

## Limitations and Unverified Areas

- Full semantic review is still Completed for every `Completed` or `STALE` coverage entry.
- Tool availability, network-dependent advisories, external product/API documentation, runtime-only behavior, and environments not represented in the repository must be listed here when unavailable.
- Do not infer “no issue” from an unavailable tool.

## Exact File Coverage Ledger

This machine-readable ledger is the completion proof. Do not delete or reformat `FCFILE` comments. A current completed entry uses the current SHA-256, state `AUDITED` or `METADATA_AUDITED`, phases `[1,2,3,4,5,6,7,8]`, and all related finding IDs.

<!-- FC-COVERAGE-START -->
<!-- FCFILE {"path":".agents/AGENTS.md","sha256":"f249ca111c718ffdeeb243f1d28440795fccc426737a9016e42369de49d5ab5c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/agents/openai.yaml","sha256":"3121339d92e3404b166dee7dc6739caa4b962ca1abf9f3dfeba15043d42209e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/assets/APP_CHECK_RESULT.template.md","sha256":"da7bf9ff2f5eadf2e475e98e6e14b936113f3aa4b0f6d01509ff9b544966e4eb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/audit-methodology.md","sha256":"39eed2f3115504b0d6d5a25b9ae27bc96bb84a70cb1b85f2d946bf288afe1ef3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/phase-checklists.md","sha256":"af9a7fe063044e92e8cea4cfe501c3df81ce072ad7155e5d713acc7e3242179f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/report-contract.md","sha256":"ef5b2a16954776134851951122d5475ff4823291899805dc45066cdf66f5f9bc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/references/tooling-guide.md","sha256":"520fb51028b1932e8796f3e93d593fc05f72c05ea5ebb862a3b66e5f6e294c3e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/scripts/frontend-checker.mjs","sha256":"4676b57b82c1252db8f0d9d33b0bd2e757b1a9c7be09aaf5f371cd277ca77942","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frondend-checker/SKILL.md","sha256":"4285ed3cb44e112ff8457a14cbcdb237ef45837e9cb56ac541acf8a521a0ff5d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".agents/skills/frontend-design/SKILL.md","sha256":"905a9484d42c6b9adb256bb26dd579e12525eac2a113dd11f2c29aec3cb3debb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".dockerignore","sha256":"181bfe28a53fecee510f7451a1fbde752db908cc436652b7337f23c75b22e382","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":".gitignore","sha256":"13829bbedd438e5457934f66356031d2d1d5719f7d5bc6356c9e51178cf86d42","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/.agents/AGENTS.md","sha256":"7b94d86f86c968c77fa18977167ac0c28e8a56fbbbc113e303254822f2065b3c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/.env.local","sha256":"4d4cc6ac1d559ebad57ec722a56418403d54357af3a9b442ab69cc92cbd21bc6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/.env.production","sha256":"40ca9b967f16817ac6af50da8526c6900f59ac6aaa7c32e38f875e9f23d8b09e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/AGENTS.md","sha256":"fb11397d75ad47a7f366b479838a3aca888e2a606a400900b26ed6dce2dae415","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/FEATURE_TEMPLATE.md","sha256":"377893b621b9dd951ca41a7ceb50700211b51f2cbaf82ea073682eeb28840f59","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/GLOSSARY.md","sha256":"0ee56e07a60def4eff8e017557dc2e8374b7450bb2db0f3736d8f6cd4c00fdac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/IMPLEMENTATION_PLAYBOOK.md","sha256":"cb17f7465bbc131d9b63638393a61aaa93648a500005852168dd4a3ffe91f7d4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/KNOWN_GAPS.md","sha256":"1c96750251ec56e2da99fc77d37adbdafda21e21b56f5af19dcf899ab132f94a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/PROJECT_INDEX.md","sha256":"e2161d0b519b2cf0cee5b272e521c6e1906945fd62733651cc0b2c311edc1570","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/README.md","sha256":"9027af129a3944aa84470ecf5b42b63ee8679db453456e0e0bde2f4dcbc76e3c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/SOURCE_OF_TRUTH.md","sha256":"b7785df71dc9f03d0a8051aebd3fc7a2a096496b03d2a7d2eb80385d01ea7fb7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/START_HERE.md","sha256":"832f918cbd8038bba13a8799b805fe70af5f7e351d3d766355d622cd46b668e4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/SYSTEM_CONTEXT.md","sha256":"83e6ad25734cd9b05f7f971bee6fe271b31947c5124fe3b558b31a8f1bef806b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/ai/TEST_MATRIX.md","sha256":"4f4a394906432dab01df2a962adb62d35096fd5c0df492cd2caef661c9d76760","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/auth.md","sha256":"afd4812ba4c75dabc832cc81e788608bc5897d5be9262c235c5ebce542aa797c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/backups-restores.md","sha256":"c9db6e6754cc037c762587de23340d56351999ac8f206c29d6a2185077aa3846","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/catalog.md","sha256":"f060c0aa0457f610ba1e5c4fe46a49c70bd33ff51e80b6099272a05d90ae31ba","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/control-plane-audit.md","sha256":"e7a60895846d3e4d931fb6b528be449164ec5f2de5143db77c50545f712d96fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/dashboard.md","sha256":"0154042d6af20910459dce7e62df89f4e10b710e1d2ca1bb82b77113b56f2f86","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/database-and-application-catalogue-plan.md","sha256":"587d5a32fb21f8a55a43dcfbd0eb49500c9beda9b6ad7323f62917c21b642415","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/database-servers.md","sha256":"27bde450fb9eb626b0a26fe0ebd54704108447701b5f193011bef635f9316dfb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/invoices.md","sha256":"d1a214134a8547cbb20cd92013ab481ecc05f7def96d49db298172dc4b312982","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/logging.md","sha256":"ee42b4dd73c9f9de45d0030f5a16102025278d8f1c45861c7eef507cfed2ba3b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/notifications.md","sha256":"c6ededdb2dbd01bb30603417f52bd98c9e838e77be72a2d928d18acb8283a7b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/payments-reconciliation.md","sha256":"edc5aeac40b343b0df3f077bb05250a5caa88e2b2f07209b1c4b80d9850e21c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/provisioning-governance.md","sha256":"b5adb6782fcde2a1c2be3ef5af92a975a28ba56ca22453404ffc7bb057d545a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/README.md","sha256":"ed13a5150609ceb7e796f7f0025418f4981985d47e213e1d86bae2024f39da53","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/reports.md","sha256":"f6a8838a6553dbaf9898a9a8f8288b7bb345022260c47610e2873a2c96841a9e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/roles-permissions.md","sha256":"deb11b7d4a63174bf1b481a11f042414214cdc27c689e53625a4f6d663307a10","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/storage-servers.md","sha256":"78790b93e879f2df0d755189b67f77d38b2f56fa17f68b73c00e6b65bba92185","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/subscriptions.md","sha256":"ee3b22fe58f5559cd55bda177b746542018fa7095b37351ed21c197b20bae464","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/system-settings.md","sha256":"2f2bc9fb348afcde25ecc344d7321a78b8e4745e6231b679bd5659a741189671","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-operations.md","sha256":"928d285b293f98e13d61b89cfce0d9cb28c0c5eaee1ad4415633a634830b40cb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-storage-migrations.md","sha256":"e683c639348c126cc6b304dbc11edcb49273bc0b00eca352962841eebd1421f8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenant-users.md","sha256":"a445e31826436ab1207a016a51705e43465bc7a2537bccc91119517eadbda9fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/tenants.md","sha256":"01b7b385c679ed1e85aec72dc64fe7bf897ffe253d09d634a999387f414d65f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/users.md","sha256":"4cb8ea2a7ddb6ee217baa446e9389c8a70ce94ae2e2e7ddcfe9b6ef8c3d61a1c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/api/wallet.md","sha256":"32358615e4da4eea879c381087a39e04db93563a2eb68de0f6c9ff60884eb762","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/architecture/http-and-error-contract.md","sha256":"6d201853d229b1147e1ea08b7d7bfeb62dbd41b7d5d8d7bbf2d0a6b4ef1a985a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/architecture/permissions-idempotency-and-state.md","sha256":"0d2851445b9e1dc72aca4d8a43793c0cbf1c9dc78f138339b02584f2907be37a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/audit/documentation-coverage.md","sha256":"5f75afcc02bc48dcc6edf71b1de9462e8d8e8468fb2e3506d2e4b237298fba87","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/audit/frontend-capability-matrix.md","sha256":"a3f589036e111c4c09bddbe34b0589e0791fc24a9e5f7faea4f5998ec7fd92f1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/audit-log-viewer.md","sha256":"1a1d3898bd78462bda2eea71c48aa6aa37bb44d92f0039be926d9255ea4c9592","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/confirm-action-modal.md","sha256":"da19ad2900377be04127204af6ed58d2d0e4c73177b2bf8617cb57efe97d8097","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/data-table.md","sha256":"59443cf117fbc77799a19eea296286a43fcb13cb466187e41443f71b178edd0b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/filter-bar.md","sha256":"7a5cd87087700fe5b034c72556ba0eb468bc1ae83d15e3f873f9be1964439a97","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/floating-webphone.md","sha256":"c4978669b95ac8d5cb6ce89e4d89c0b2d59bef598f3321086b41b70cafa7b024","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/form-drawer.md","sha256":"c3d5d788d1dfa9464509244b7cc8a91c6d5f0e70a36d736d3255c83ecf2872a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/operation-timeline.md","sha256":"4b5318a00e33afffd27638e6ae8ad457f91413a6b0b66ad8dc68fca810d06847","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/README.md","sha256":"85f90e2069f9e1ad35f19f5f59dfa01547aabdd8bd8e70ecdf51cb005811ce83","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/status-badge.md","sha256":"10a9a98f8c432c7bd2840b44b1b5c54028c31f83fc6bfb42aaa4dd0aebf487a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/components/storage-server-modal.md","sha256":"249948727feb0eceb17f621d1c5604479eef1a87ce34fe761889b89ddc69c963","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/DOCUMENTATION_CONTRACT.md","sha256":"f95de1913aac9065d94c73130ef3dd6c09d864af8fc536b85b0653e23300d2b3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/frontend-integration-guide.md","sha256":"ca34f13022083bb1164b392648c5211775459951388db0a79823fb4849d17670","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/generated/admin-core-api-routes.json","sha256":"67bb7c11c84a9ecdf5f31215b25ace17c75e04b2259d5ea364601280b9d23abf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/generated/admin-core-api-routes.md","sha256":"47f434d359eb401cdc7bc4fbbdea9d2a37029f12d3c7c618796490fb361bd139","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/guides/sidebar-navigation.md","sha256":"282510a8db9ddf38d72d2aa0e9a96e8fe46790278ccf8f4e1223a1fa8f943d3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/dtos.md","sha256":"c8cf67c31c9a9d6e4f20c44296d71dd1e9d3a0f6ab55489c1a1bd70976cbb88b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/enums.md","sha256":"221254cdbf281aa67b39958010e4cad569c76af417a7dd0936a54fda3bec6555","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/models/interfaces.md","sha256":"7a09496f42d46a5c4f2e5e1bc6905e4259af719d05da3bc8a20ef6946e0a51e8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/rbac/permissions.md","sha256":"cee09c910ffd96fbccad8ba6699cffb8d5877a63466fb98ba710f67c42eed52b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/docs/README.md","sha256":"bc1c9f9b76c27bd3b94721b55a3fc9fe92dff4a20c102201e42f19921ed90b4b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/lint.json","sha256":"f0ed985892917e92e8d0a919f6768054def2dbd3f9cdf077bbde9ee943193133","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/next-env.d.ts","sha256":"7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/next.config.ts","sha256":"ced7627bff19b1e28e0666c428cdb79f730da674502513ce0bf2bb8444318fdc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/null","sha256":"47c0271057a5529504e8ed423f3569ba912fe77750023e92608ceae89d72a6a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/package-lock.json","sha256":"565f56bd65975f4db93c5f6a46f007172adb3d2b61111ab0bb1f2e68dbc67dfe","mode":"structured","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/package.json","sha256":"965398fbdd852077f714566313193c7a7942e165c8cf94afe6f133a61235f9c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"admin-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/README.md","sha256":"cc5aacf8ef16b1274e6a05e80c7a4938c444d5b7dec81c90aadcca0f338bed19","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/scripts/docs/check-docs.mjs","sha256":"a563c3966963470b37a5a4f318a6eef5793d1aca5d95abdb2cffb2ddacf3ff84","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/scripts/docs/generate-admin-route-inventory.mjs","sha256":"595909387b1d37fe31d72e83047620244b40ecdcab0f985523d082ebd760d77b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/__tests__/catalog-contract.test.ts","sha256":"112e126f9af27fe3f954f1b9a5248685f1edf10cf36093e6f89d5a8d6b68f2f4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/__tests__/database-servers-contract.test.ts","sha256":"0c76b5adddabb919c3365833c409f917139d04d4bf09cfa8e7bf5ef79c00ba8c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/[applicationKey]/page.tsx","sha256":"e6a3220e709f1fb562411a13b29c6ba6fb5c12b7bf6caad18b65c0282a1f6a72","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/audit/page.tsx","sha256":"cd08618ec6a3ab117125209a3fe1acd98d0378d021a8a6563ae7f5ff08ea5729","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/applications-catalogue/page.tsx","sha256":"3a6b65d541e414ced34b193de827373555f3b449cbf299a72491dc03d200df00","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/access/page.tsx","sha256":"2ca016d185de7b40a880acb008c82dbe8951a8b62bf1b1a7e3b2440d9c3347f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/artifacts/page.tsx","sha256":"b07bde59ee3c7494332f1a3d2e1fd099c929419cecf19fd31ee75205c332c9df","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/layout.tsx","sha256":"b8c2a5899d37fe61031b72213c65974d439115b0553efbe4d16b86d7058e149a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/page.tsx","sha256":"67f3be4b9c6c3474d43f79b9ec28b62804ac720e8b07c197d1ced3f755217f05","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/policies/page.tsx","sha256":"52f800e4d90ec95a28ba0e0ba8427ad7f131368d313954023aac3552d93d885c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/restores/page.tsx","sha256":"843970dc0ae3882652bb8153cb45c0ea5475167a3094612927689ecd77318797","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/backup/runs/page.tsx","sha256":"1f160bb5c5eceeb306e38a08119dc46234179bf3144b567248a1ab445c15a890","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BaseBarChart.tsx","sha256":"f5e88f51a909afd8e690ff768cee09ee155cec2425ed3d637850c717042e2672","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingAgingReportBarChart.tsx","sha256":"086fe87cdf01b568c7a665794c91b0414be1c2c17874f18185ad78dc5425f5b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingCashFlowComposedChart.tsx","sha256":"63937caf535a57858c46520975e902e300d076a429a205e01b8e888261d1b6e5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingChargebackTrendLine.tsx","sha256":"0a1dd9bab1cb215433b493663dc7268d69f0cf47ed9dd20d5ebfd07c7128bf5d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingCostBreakdownTreemap.tsx","sha256":"6a1ccc564a66310941345f8107de8d4017a0a476e0ec2fcfb9c6409e56dddabf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingDiscountImpactWaterfall.tsx","sha256":"72a5f5d7d770fe21eabad368f604ccbbf38616ca78906297726bd23b13fee356","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingDSOAreaChart.tsx","sha256":"c77777065959e95db3aa8ea2b64ecee68e0b0abce9ff746581f5bfd250c9a77f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingFailureReasonsBarChart.tsx","sha256":"5b163a4f0e4768843b84d5abe60a75f2ab04afe1de3e9d3a684d4d9aa202fa5c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingForecastSplineChart.tsx","sha256":"2573daa4baa80a6c8a2235a62aa4622fa8dbe6f8d0102ffaedbf563aac69fdcd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingGatewaySplitDonut.tsx","sha256":"71540ac10c4b7cf5b5cc366190500306d63901e9fc0b239c20f75f24fb1fb182","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingInvoiceStatusPieChart.tsx","sha256":"b0a4d9087b096a380367058407ae2ed9ec71265c1f01412cfd90b7441374c79b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingRevenueByProductRadar.tsx","sha256":"3c2c03ee0956da6e789237a904d4536f4d5937440c99679ba03324289efec371","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingTaxDistributionPie.tsx","sha256":"21b00ab05b1b6a190e41882b89257f88e8f2537ff395c7c3832edfdbb1b8765a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/BillingUsageOverageScatter.tsx","sha256":"11e6bd420a9eccc47bbc7b7d3929da94e056c487b42040fed029116fa93caa7e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ChartTooltip.tsx","sha256":"8f308259eede3b245fb8ffb74757bc16a31cdf3cde8360ef161a221a6e02af29","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/CollectionGaugeChart.tsx","sha256":"45b2797bc2da3e89c5066c1fae8d300b65d6720ce644bf05f68262304d6c10b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/DomainHealthGaugeChart.tsx","sha256":"a84af290a93eaa9819a85bd2b8cf1051aeb1dd3df21a9160da16f8354fefaec0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/MetricDonutChart.tsx","sha256":"062a8f583fba0c7ffe4f54a1f8839480a83ce6fabb320bb68f39a9662359ba11","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/RegionalDistributionBarChart.tsx","sha256":"45c17f4b82fd7692dd61ebfee8fff826102a284f4431cc65beea9365442fa234","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SaaSHealthIndexGauge.tsx","sha256":"dc009c36c9d871b888fe2e3b95237f4a1dc04b598b0fe9b253996440b22c0e57","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ServerCapacityChart.tsx","sha256":"c59248c56b31ff78980aec7f87e12ec8acab2bafa09ed5af7943b66cddd98e60","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/ServerLatencyScatterChart.tsx","sha256":"00a32d6b3ce33850c99525e743da6b407d1a0734aaf37988437718644100eb71","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SparklineChart.tsx","sha256":"1e95e18dbc3510a4c45e9090258644a1c0a6d50a14741126e9773ee4dd4a622a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionARPUSplineChart.tsx","sha256":"ead2f1f281a6e71e83a584079f7284efb22b2a9ea1735c92b79e6e9a7a4d54fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionChurnComposedChart.tsx","sha256":"548cb1184b256b1a49c8597f181dfb3d542cc0d5a07e029ddf092fb1371f8bc5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionCLTVRadarChart.tsx","sha256":"a52c4028d9befd2a259a7729f6482ccdfb4724e55ce40af7c0012fa3168a5f5c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionMigrationWaterfallChart.tsx","sha256":"f32baf38b709d3babe7a651336940f6b77adcdb44870c9dce8b01901afde84e1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionMRRStackChart.tsx","sha256":"c1dfdd11bed7e5463b6763e67e64d65efda9e285b4c71c87b8b502d3ebf78091","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionPaymentPieChart.tsx","sha256":"983f8e10acabd028e9e856b6ee2c64befe621218128f2e6ff43f82dfa22650e4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionPromoImpactScatter.tsx","sha256":"4556154b2a3e4d67d2e365152e69dc091ff19704a391172db9becf67e7fd920c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRenewalsBarChart.tsx","sha256":"e98ceb5c689aacaf84dc053afd15fa4318c6e40b61b83368eaf5f254e0a03040","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRetentionGrid.tsx","sha256":"bc3a58e4d1395b97db6c87ecbc738c172374daf2b8fe5fc9221df28e17d3bf27","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionRevenueStackChart.tsx","sha256":"3eb21d8df7e14d6080d2d870be829f66dc186ca1d118fb85f0018c8a50bbffbd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/SubscriptionTargetGauge.tsx","sha256":"e96c11bb4403a4837f833971a5ac6fe46baa6c3ffb4a08af0f042148d1a1c695","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TargetVsActualBulletChart.tsx","sha256":"a3ef4de236591209bc9d09c8be5eceb37d4124dac3250b0f70811b9d1a76b0e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantGrowthRevenueChart.tsx","sha256":"5f4011f4ecdec964a7c8a95a89581a3ec0e67124f19164a196b1e3174bb926fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantStatusDonutChart.tsx","sha256":"7c80c5b24f649f5aa08760b6756db9f374e5934b3ec5ac6775b71e31d9811134","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/charts/TenantTreemapChart.tsx","sha256":"732ed5820b91c93bddd1b063beffa124754857fdd6b74f1e7fe4709f585469ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardDataState.tsx","sha256":"4768a69d70d9aa4a3d5b3730dfc297b262e624c26146d9ef25c1159fe62fdf79","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardGroupPanel.tsx","sha256":"b8420cd18dea7a761bd496e594b2ac6db2de81ca80dd2c6d2c75d539c00cee0b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardGroupsOverview.tsx","sha256":"d6d79776cb17e1ac9d396e79ef34e5672de0b46c5f051d1ea15aa96e4649a4e7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardHeader.tsx","sha256":"a51f60c113f7283ea469e383d3bd1a05b6fb3f1512c7ac3a3dd2d9bb7009b3c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/DashboardTabsNav.tsx","sha256":"c712e7da8c0098f9f24be5d5c45ce09bd2a3fd6315d98df6cbf288eb8a37e9c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/components/KpiCard.tsx","sha256":"aa1a7ce5154ca6c964b6f6e08076004eaaec5c6669f6cda28ba9b6cb16aecc17","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/hooks/useDashboardData.ts","sha256":"c156ee061f7133b85f602b0912a58f6c6aaac15d6895553f840ca7c4ad50d73e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/page.tsx","sha256":"cc1678ce96317b913a8058bfb8607085cd260ab72b60a06d236d40baaad76c88","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/dashboard-groups.test.ts","sha256":"031976c59e6c9b6c037f8a5798fc0b95800062fa76200b8edac0e8722547c153","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/dashboard-groups.ts","sha256":"979a037e3a7cc74a0bac2148c018bf4db4d0e9fc574c04746729f09d4cbe6e00","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/dashboard/utils/formatters.ts","sha256":"8753b3edc2c3c907458c49b94056cffe0d5327d41ddc1fd5d5bb14f0f884e813","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/[id]/page.tsx","sha256":"2c6c0490f9a899397e67dc9ae955e2dd7456c8dba60bbd5898486c87c8bc09ed","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/new/page.tsx","sha256":"f662b35507946ae6a0cbb76e9a32e9e4d2645e539b774c6c93fcc9303e1f17c9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/database-servers/page.tsx","sha256":"446ed0b3713b1fad0827bbac9e0999b5eecbd585b29fa51990ac8e80ca98f1f5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/globals.css","sha256":"198d6d874a60ca70667f7b8b3ccc112e89d1a475bbd22f628bd100f12c9e32f1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/hooks/useDashboardHome.ts","sha256":"9e4883665ccb4f9f6cc1351bc3da9a8259067a231f17c5e67f5a40857a5ee8e2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/layout.tsx","sha256":"048494b5470391948d612c61e8cfa71b15bfa00df542eb023b4de57208c1359c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/login/hooks/useLogin.ts","sha256":"4b8bd5fe8d15ae16c6f05869a711b58e8b98e7700e67b5b68dc605912dadb5a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/login/page.tsx","sha256":"4fc3185ee6c611a8c3b47365025857b7d97f58ade63bc17c1c731435cf5395ea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/page.tsx","sha256":"832b647cd752da7f0ad0313ca426a04bfd851d972467bb003294a99b4caefde7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/profile/hooks/useMyProfile.ts","sha256":"1b9d59af504905e7185a3640654e7ac2594c18ee48e909dbd880c18ef7bf7944","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/profile/page.tsx","sha256":"3ec280e7cd15f448e8d1855e467d2fa4b49759d42580e9c3fce014f67c271bdb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/[id]/page.tsx","sha256":"799348d7a5434a702531431b74032eacbce52c35fe34378d285861b4b05fce93","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/components/CreateRoleModal.tsx","sha256":"d45094adb3ec6c1cc576c63fda2f43afd009dd908e4dc249ed53387c8d4ec163","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/hooks/useRoleDetail.ts","sha256":"33282d81e46019b4b6063e142774f964659008ab6423cc04786113f9eb516d9d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/hooks/useRoles.ts","sha256":"25f22fce4770fb5a15472a97151c63342094d3b871891b5ca099950a1f316f5f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/roles/page.tsx","sha256":"915b42cefa13a073f2db30a6dc257941924b996fd363ddaee51e1fe96891da1c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/asterisk/page.tsx","sha256":"3f2ee815e0d2ad1af7147ebd69707d6d18708215c215464aeaa4ad28b362695d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/auth/page.tsx","sha256":"d57dd7f7d809238c9b96fd248fbe88be97db32f1c0a047393f7240b9a2cef0e2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/components/CurrencyRatesSection.tsx","sha256":"e22f4b9ced1e4e7137f5d9901b066757d1cf5fe6d0a2b63cfce061c9e1d3c773","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/hooks/useCurrencyRates.ts","sha256":"9ffbf82f95e8be6b9dab795903047701f193f3f1473699cc68f43deeca45ed4b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/billing/page.tsx","sha256":"653a1ede36e109404216a546bb06eda2f3ef50d83f7c57284deea46dfe08a253","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SaveSettingsBanner.tsx","sha256":"b80b436487efd702a557b79782d427c29bba0f78f3344f2de3b3b444cc1b9ac6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingField.tsx","sha256":"b14d3c2943980b4b153eb41cdb3873d545c9cef0f9e29336ebd94bf06bb079d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingSearch.tsx","sha256":"f199ad4539998ac788725cd69f2cb6c52716e272e7150e28228fa486cbe54ad4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/components/SettingsSidebar.tsx","sha256":"ccd9359f6aed4b732a379d82d827031e98b3586fab5f9e81786236bd5e03eaf6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/hooks/useSettings.ts","sha256":"1bfc8106e2c1d0ba0b4ba4e23b4eeccf3c44bd1b4aeb268e2ff933e65fd05e67","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/hooks/useSettingsRegistry.ts","sha256":"20f12a36e74e187ec15b37e35de48489465a0db1342e7a41406c351bbd3347f9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/layout.tsx","sha256":"e119270a4ace2e9d7b735d9a828d7024fa6bf9c3cccd656709098e1c9300beb1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/notifications/page.tsx","sha256":"6034f82aeef4debd5cc568908c5a42f4d3015413a396cf1994bee129aedccd28","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/page.tsx","sha256":"bbfb622d355fa352f993efced409c3a7a39493ed9933f23f2308e99f8da4cce9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/platform/page.tsx","sha256":"c0100e73369dca49792a4bbfbff7cba82237c51435d25d2c168adfddbefd031c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/smtp/hooks/useSmtpSettings.ts","sha256":"b8b8c26ecf8345bf206f5a24c30d4f0d8d0bbb9673cc15d96821a4f502f9d123","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/settings/smtp/page.tsx","sha256":"605371c56128406c87a48a456090227738dd70fa15fbf95dff31f66ef21af198","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/[id]/page.tsx","sha256":"fc5a6eaea7d06ed49f2568000a1c3c9c122d95b296a8908ca93f4d4d7a751395","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/api/storageServersApi.ts","sha256":"a7584ef96178fb10573d7e387a00b98f0ac9d2663215950bb986f9154070fac1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/components/StorageServersTableSkeleton.tsx","sha256":"a233432ff15c999cc702715a064733fcd865ddb722b0eb34364c3f7542cecb0f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/hooks/useStorageServerDetail.ts","sha256":"bc2fa78b6d0b70f10669bb32fa0121c54ab5d91a0df9bb4cfc81f3a0ebd862e1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/hooks/useStorageServers.ts","sha256":"296a33641730f2d178bb2181c4e02f9629f229f37ded28280edca39cd98cd6f7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/new/page.tsx","sha256":"b722c90cc8fb14f54115b16cb1725982afac146fa1db3e9a12983855910e9c81","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/storage-servers/page.tsx","sha256":"64ae0731b0fc565a7b7e86d9831c7b04a80d19b259d7197feba1041e653c2c63","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/[id]/hooks/useTenantDetail.ts","sha256":"5df06830776eaedd1c6684acfecad225226785de793c91867647c6b59236dee1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/[id]/page.tsx","sha256":"707b98b4275a640debf3933af8b3ea3010d175b7ec335ab8e025d58659c17d8e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/components/TenantSummary.tsx","sha256":"30f36b176b4f3cb7ff9be00e5c3283f4a51c2b90da8c0f1d15789f4b43b9b019","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/hooks/useTenants.ts","sha256":"75ef4dfbba24ac703c22edac1d14d815c790abc4b9fd71997d459c9eb2abea0b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/storage-placement.test.ts","sha256":"fea50e0b72ebc39dd36e05c6ab169a82bc072b2ca1be395777aaac1513229704","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/storage-placement.ts","sha256":"c93063204e84a0bfe8947fb1b831d29a8f0839142a8c168824ff3dfbbbded2ff","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/tenant-profile-update.test.ts","sha256":"4034089f42f6ac626d0e9e627d7218ea35030aa97d6562e5c1f2d4a7a3951866","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/lib/tenant-profile-update.ts","sha256":"2dbc22699e9f47bcffda44b0799302ff7e7f6e07e222e5c5bb406604e1564a30","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/new/hooks/useRegisterTenant.ts","sha256":"7217c66905bb2bae18151f8838eac6da6f6ff519f5ff30c0eb2c91ab7693310f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/new/page.tsx","sha256":"1ec45d94477940c10c10c8ab89d8a0dae15680a26be819f89f78a046c08fe8d1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/tenants/page.tsx","sha256":"4248f490a6a682860605c4e7b3fb7df8591cd36b9719867c882d76040c7548fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/[id]/page.tsx","sha256":"2b4cd83622eee8412ca2c6653d324a7b3076e79f81a4e2b854426ca06c05772b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/api/adminUsersApi.ts","sha256":"98a4e29cc23896a42c4c6e54b1f040619a0e56f0392b5be31f506fee9f557a92","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/InviteUserModal.tsx","sha256":"2e967beda0d9e0adc6e60c93cb249f44f4ac83517827308fe1eff5e4ebe3a5e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserMetadataCard.tsx","sha256":"aa3f5e3d86894c30cdc2526dd69e02b0075b3585ffacfddf98c72b99254a260b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserNotFoundState.tsx","sha256":"01f5b2d2484ced5c7a888364d8bf0641a089794db1d530523bf2968768ae8f93","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserPermissionDenied.tsx","sha256":"83d68343165506d7ecc72c00c0683bdaccfe5b7144343a84325dc85c51fba558","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UserProfileCard.tsx","sha256":"44a62a4267d12da7a7827de8215d2952f19a0bee439517ca1ff3751421f14b31","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersEmptyState.tsx","sha256":"8cb4fe2f422be617da510cf4fccab13114912ff79de470a3a9214451b890274a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersErrorState.tsx","sha256":"d4c2e98face7a918daae4d99af9e0a40a362503283abe504e8bc25bf912b153f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersPermissionDenied.tsx","sha256":"d8a8f9114811108f7ec49966f49a7b43377ae66b50a28cbec77db8eeedbbd162","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/UsersTableSkeleton.tsx","sha256":"f69581399ef1ce547508ed90da4692a1cfa39b4b981a5251f2e4deea1af94412","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/components/WebphoneSummaryCard.tsx","sha256":"f41f269c141f80080fcb18b318b899fbe286a1847fcba0aaa0ea7ef2ba388030","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUserDetail.ts","sha256":"f8cbde624bb3ffef67dbc1f1661348bdcdcb47f52878cb38109f4588a168db9e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUserPermissions.ts","sha256":"a46b0b40d39e82481371d31f6402dd77abc4a81f0e516ce2bb09dc60473af992","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/hooks/useUsers.ts","sha256":"f4256fe0ed3e787b73a4892dc40a777c4535fc880f62eea9682add79f9efe4cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/page.tsx","sha256":"6096b6bc113b0346d2007663fe27d4bf3f40495d1d9adca175fb9a5125f2c235","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/types/adminUser.ts","sha256":"34b296b87a77565381b2ee70f0570f88b399be954cdc38266b34d0393d2570cf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/types/index.ts","sha256":"2ff89a27bf1f0baa1202ae7922cc2a7aac015650f60e30d4f984150a6ce15435","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/utils/__tests__/errorMapping.test.ts","sha256":"2f6a762bd31f65e5f66fe645dff93dd9d2e4cf2d216ec8f77c65d9e9486fd642","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/app/users/utils/errorMapping.ts","sha256":"7efa36fb502ac60b1da720088bcbf29e508f66d8902337fecdd56f74bdfb67d5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/auth/AuthGuard.tsx","sha256":"dd954c339a86440946ad989ae22b0b83a2873da9a356b0d8f1ebcf7de2ad38b4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/auth/RequirePermission.tsx","sha256":"2c8bd5fb4da6478f64a9cc1d604e25b67255350769caa693e335de62ca0d6053","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/BrowserPermissionsModal.tsx","sha256":"86996881013fe930b87a2b4f8746af89d15168bff59231179d9b28fdad778955","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useLanguageToggle.ts","sha256":"19142bd60ea75e6c15f65985d08682d2d5ec3548e3fe42ca3305986633d20ddb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useNavbar.ts","sha256":"3efd71e151e4ca2b7bad7872d33fccbecd72e06d2342fe2cb7a7a1bf039bd2c2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useNotificationDropdown.ts","sha256":"7c5978b134a62cb3b562a311e2632b70d4226e2520b19224980bb7450fb2a408","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useThemeToggle.ts","sha256":"5f8107e1b469ef725a3fbc4c4d714cae051ad7dc9ef36a009c87aaedef1a5b57","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useUserDropdown.ts","sha256":"7fcb674aad18fb6332d437ccf9fe9415146c4d3b49892a747e1387dc7f2d20d0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/hooks/useWebRTCPhone.ts","sha256":"61d29945f6a9e6e3950211be63c34f9fbae3710029f1666242a8280e4de00387","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/IncomingCallPopup.tsx","sha256":"3aa9037c58b704954a4d5f0365a57695aa8ff4f31bffe3abd0e18210f5cea141","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/LanguageToggle.tsx","sha256":"40b67a9454873d689c8eec21ab7175fbd40d1b8201d547bde83f52f74661e577","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/Navbar.tsx","sha256":"ac9899fcd996cb7e9e6028db7176487eb7f2cb9b6e5043f85fc50f76a3eeaae5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/NotificationDropdown.tsx","sha256":"d601731474502cc7d2c74a6dfc916b5ff87e1affc99b8b97c866f4b7aab1162e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/ThemeToggle.tsx","sha256":"82c893ee66afe030028f0d5dfd4bedbce7c9f1c30a15c1c998c6d6f5a2b4b20c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/UserDropdown.tsx","sha256":"0d4f134e27326fdda5c5cd1a42b24b279dc0d5367f635d540d6277512e24ff23","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/webphone/api.ts","sha256":"bb3a6291be638ea8fee0bb259b6025f74e6c3fbcb1a03ad1db52d2c8aa099721","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/WebPhoneTrigger.tsx","sha256":"a66464c913cb61b31ff001aaf76c8d0951b822a1eb90dbb80973a99c2fce1bb3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/layout/WebRTCPhoneWidget.tsx","sha256":"81d3db44f4daffdad1e3a0f101822f0ac7d96b3520752130f5f151201e688850","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/CountrySelect.tsx","sha256":"77dacd7b03755034b97b101221e98e6780c19803570bf849128875a958ea15c5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/DestructiveActionModal.tsx","sha256":"a30d9d2f6830b21ebd95522b6331e9ade855668dcb0a6b9065ef76e902466269","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/StatusBadge.tsx","sha256":"043a6af4b7132f216430a7ab4b3e69a54c307b0fcd033bae1c0798c89dc03456","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/shared/TablePagination.tsx","sha256":"764eb8cc6889e0bf421f719f8a4a927fb8310ed813ace61a700e8a2800d9b000","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/components/ui/ToastContext.tsx","sha256":"b9c9c6d1fd8a2d291201bafb499e2414918bc3af5518a7e74a46bd6b239a5f75","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/context/AuthContext.tsx","sha256":"636ee11b74917daf9dfc7a5b8dafc9187d5010ffc55ed52a19ef6b40eead59ae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/api/applications.api.test.ts","sha256":"bfef34d27f7be285867a3dc27da05cfdede38b867b527eba850a03c8b52f7eae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/api/applications.api.ts","sha256":"25ec259559333ca0243d01b34a7c2234c157bebad18864765dcf67413141372a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationCatalogueWorkspace.tsx","sha256":"cb8c13ac01964241d1640e5ea0cfbff2e93eece908036ba620faedeed6ad00b0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationConfigurationDialog.tsx","sha256":"6fc9efda11bc9528ee042e5ed58f7b9f70e2181b29c15da9b73be92a8e1f510f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationLifecycleDialog.tsx","sha256":"bbf9dc922c9bb1e5c933eb601a73c0513a12c41779eebf064f0877a82b7b3a0c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationPrimaryComponentDialog.tsx","sha256":"fe3523f83c57ef2b4fbf962fbbc53e81d7688c1d73baff989846f7f12cf4854b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/ApplicationTechnicalProvisioningPanel.tsx","sha256":"55a9f6f31013dacbd4954a94a59c7e1641deaa31aa0ce16d511c1c0f945d31fc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/CatalogueResourceDialog.tsx","sha256":"5f130ac76b41222114161ad78240b4dc6048c4fee506079a004eebc1243f03b3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/components/CreateApplicationModal.tsx","sha256":"fb2961002a3087c7e465e5e23a1f3c6d6a18d330fabfbebfe4cd96aaf797ae3f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplication.ts","sha256":"d2d9aa6948b6e6266a8aa03ab0e46b575f954dd36857824279ce0f20751bf28d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationCatalogue.ts","sha256":"9f6f8cf1e1cbff6e8ae49279145ca4194295fe62135f5c05b32783ebf84e3ebb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationPrimaryComponentDialog.ts","sha256":"23d0f503e3ca7d8069b23378141d0a4d00496ff33d330d321ed960f36eb02575","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplications.ts","sha256":"e0e13151782a1b48cc652c3fcf586f89e28692fcb68742c5de95412ad5e3fe89","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/hooks/useApplicationTechnicalProvisioning.ts","sha256":"aadbf3cb68708b874c93b7c344cd30e2457936f25f14001439a38866099c1e20","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/lib/technical-provisioning-state.test.ts","sha256":"30b42c860dbc2c8cd1a2fa3227d17ccd69b505b4918e36db7c41f7bb2ddf7a8a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/lib/technical-provisioning-state.ts","sha256":"43e1ce0b52bc7f1405c7fc784acd78f035b168abb0ac8066c5f4df11d25a32fe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/applications/types/index.ts","sha256":"9e18edd2afcc5ae3de8634eb9764f738eb8546456a8f46ba8d864c3cc3738c38","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup-database-access.api.test.ts","sha256":"81c8ec43c1556659568dbed9dc137514a5dcf231c9ffb0d9c1b8c607b17d25b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup-database-access.api.ts","sha256":"e2ee23d787b3b7f468bbc6388f5088a37759e0d0d43a78be1f14102c8eb3aaa1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup.api.test.ts","sha256":"7ea33d8f57bcf6edd4ea2dd2480ef149af23dd9e49bcd03feb9c8eb2151be8e5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/backup.api.ts","sha256":"8271eeaabdc86c9f5040b1dc27354dfad5cde311d65e1bb035ee4ac676b66755","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/api/index.ts","sha256":"437d93bc14c3447dbcc05eae8d7b1383def5e4a352ea17649fb11c09a079cbfd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupDialog.tsx","sha256":"7ebff89664d3fa84563cc75ac533a148ea1c14dc37711b72deca040809d91022","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupErrorBanner.tsx","sha256":"34e9dab432fa3f6bcf048f04904bf6501911c77e20dc6b7cb07748d0d26db6ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupModuleNav.tsx","sha256":"e404d01edaba7fe205e2fadb204f4b0b44f69822d2c9fb2d3781691c42806055","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupPageHeader.tsx","sha256":"e8d8c3de0dfefad24501622e4dc04530cf5925bf8b2b2980b4204226eea6f1a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupServerSelect.tsx","sha256":"7978b89e004d90ecabcacb779389dad789cfed41b213a18265b586b81851018b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupStatePanel.tsx","sha256":"4f5b567f79cbc9f43da96f848260681b036f9b89fffec69344f6278944a74f17","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/BackupStatusBadge.tsx","sha256":"1466d3e6f1a4109d1b8f76601a4ee3e65dd7ad0d3ba314d43d1c06e8e0016a85","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/components/ProtectionChain.tsx","sha256":"d00f147d5869bb156226fdee814c7fbada13518c1472764b2108e7f3ae2990d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/backup-server-request-guard.test.ts","sha256":"218a8a86a8de2fdcbc5df4c85281532f64d34e45f1507f7a8ca6b6eaf20296a6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/backup-server-request-guard.ts","sha256":"90eda625f4bbdbafa7ed02e1c98907d02554d86d21cc965586efa4e1a5ae2e73","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.test.ts","sha256":"f79320fca1d02cbb5ecccb2e7e9b13ab8b5ea5dd4eecf7a5b41a98946d56a2b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/non-idempotent-command-guard.ts","sha256":"e42df91fb8b90e7b4b2cee681bc3d6f65ce649a15af1d6717eff2d1fc319109a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupArtifacts.ts","sha256":"c45de83e8467fa2923ac071ce869a6f665f82f63be068f58a99d4862ada2c163","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupDatabaseAccess.ts","sha256":"8dbe9f3f2ae11d8d76d8a713d7c29592ebae5e580c276ced3e83ab3578a0f397","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupNonIdempotentCommandGuard.ts","sha256":"f5560cc0e116e9a1da1b266d92ad371ada20fbc26748a7d508f8d4170ea37c43","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupOverview.ts","sha256":"cf55d3d00678187114c29f2faceb3484109790214d1ee82a1ad6d4124ddc404e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupPolicies.ts","sha256":"59eb632e4a21e2ccfa0301a44f2685eba34d5e834d2a3cf33cd0f0ddb40c011d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupRestores.ts","sha256":"088561e9ae08c736ce38c1ac6bf0f2e6056b678aa9db34cb73bc6649751d8861","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupRuns.ts","sha256":"81801908a57e48ba97b04758523b69fbb222368383c36dbf17f9d143bf79fa74","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/hooks/useBackupServerOptions.ts","sha256":"13dea7242359b7e34b8ae9bd64f2fac7a1c8883d42446bfe861fd6f01037f04b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/lib/backup-format.test.ts","sha256":"911b8430fb4afc8e7168e507a1853de3a621b627ef57f82211a92f7941c9b1c8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/lib/backup-format.ts","sha256":"898b8543d1c24503ac222820664cff5cc05d6071b785712e8e6aa6957b228f90","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupAccessScreen.tsx","sha256":"8da74bab509e6afad5a92ea2b35e17d568c9c0f1e756affa29fafd5229f96f22","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupArtifactsScreen.tsx","sha256":"23c79aa3e8793e79fdcac17cdff71c47b460b4673040c9b2edec4feef9d80e40","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupOverviewScreen.tsx","sha256":"373efb38c302e23fe777dcdb87910e4b55cf37619e645095c9eb36b9da9449a0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupPoliciesScreen.tsx","sha256":"dc36b015f41d3e4f47439147217d219cc0e8e34ad06a330b5f9b29b522cc2b13","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupRestoresScreen.tsx","sha256":"a491a1b0ec90a75a4ad86ae32c7a5c2ca983a71724625b580a634b6c6355d528","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/screens/BackupRunsScreen.tsx","sha256":"2d00563473315079e010ee325d56168704d1c89ede77e45e70072e590a2542fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/backup/types/index.ts","sha256":"baca9cad4fce34a0de26100a6fe8784a252f2b3260e61a8a96545a0b439afc93","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/api/database-servers.api.test.ts","sha256":"e648156b708882222d8dc295666e5f8d8dddf4ba8de616fb9ea3a1570f2bbe06","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/api/database-servers.api.ts","sha256":"8ae6c490303ea19b902288b98160bbf67942601fc659c14e4bbd8693f2bdb348","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/AddDatabaseApplicationDialog.tsx","sha256":"3119c8a41aa62abd7beb02a1768689716f79eca93e2f591a5814d181123d1f4f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/CreateDatabaseServerWizard.tsx","sha256":"69d14ae15dee7f6e17ba49e5bf5615ec23dfefcafc26d70d5a238814e900a5cf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/DatabaseCredentialActionDialog.tsx","sha256":"14041603d9d9632d45e2f603d89160e8d83559cb471f32bdc55a8e6f8c8ec7bd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/DatabaseSslConfigurationFields.tsx","sha256":"d3fb286f587ea9f80b00442649b39c1ed4fd4aeb2f39f02f69265a84d6d5497a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/EditDatabaseServerModal.tsx","sha256":"8bfa020f1a990bd66e836cbb557929842bef63b0fa27a894560977f490b75929","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/components/SystemPrincipalRotationPolicy.tsx","sha256":"c50523a1858315bb239aed424ab6a1000673cda93401c301f1816384072449af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useDatabaseServerDetail.ts","sha256":"f5f25fcf02f672eee77bdabdd377bf35c054575b37f79ef688319eb027a36be0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useDatabaseServers.ts","sha256":"44169cb5d8954b0b58c12375749289522f2ee35632b2355244622d14aadff47d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/hooks/useSystemPrincipalRotationEditor.ts","sha256":"a5d1ce5f84aebc0aa02e2506dedb2cccfdc421b95627d93e29f2c2b138314146","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-deletion.test.ts","sha256":"543a8453dff47fb04716a772868aade009831418e985e93e568ae3b3b53b67d6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-deletion.ts","sha256":"a45c8f7277fd39866978c2c71ca4fd78d9bf263444aa84ebe3b6d1c59426a6b6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-idempotency.test.ts","sha256":"b9201e9492f652abec06bae0fc717b09e05356d9cf2ebffbb5ca547c5cfd882b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-server-idempotency.ts","sha256":"60be3e49769100bd08c8635dd4f4e25fbe51f1b91df9dcf0b0a35a89e3b7cd28","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-ssl-config.test.ts","sha256":"bf4a75389d09f7ae09d7ffdda637669072b2a6096009f3e9b2d4745d4e243653","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/database-ssl-config.ts","sha256":"501bb375c3ee618aa584a1c5d3a1c406e5d757959fe642dd516fd861e5f7a76e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/registration-state.test.ts","sha256":"cd250f9bfa337d203a7329df8d3f960eeaa4ed99bce147ea077ec5c0f5bfb0ec","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/lib/registration-state.ts","sha256":"93ebe4682e204ed4b0bcd7cc37dfb2c49c9fc02121694a9f43f894870da36d0d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/features/admin/database-servers/types/index.ts","sha256":"3fd14d3aad28406402fad093a9931bbaf19b1524b98419a33a1003a135e93914","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/dictionaries/ar.ts","sha256":"05dd5569ab7f237060428dc1646f688ba14b060bdb698748b086544e1f7cfea6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/dictionaries/en.ts","sha256":"76ca9e90b660597f8bbe7505894db4a37ba2c1a1b915c53862092b5d0b17d4eb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/i18n/I18nContext.tsx","sha256":"fbcb2a71af4c87e3af4b507ba1c39503cc9d2db48e11e81daa923e9d414f61c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/api/axiosClient.test.ts","sha256":"b7e25935b722061ef1fb5ac15fdcc0c9153072abd4bc1c449c3e61abda1deac2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/api/axiosClient.ts","sha256":"5c8b68af4d50ff39bf636c299d087a471c50cb12f16aa78194c7ebd211a9cf6a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/rbac.test.ts","sha256":"c2b4cf1567ba406156d8c14922c85c1147e5a71e10dc4d21f33ac9709feb26ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/rbac.ts","sha256":"7c961a51355acae2bceb077c984461b9bf102c35ac6faea3f28ab68bce897ce2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/sessionRefresh.test.ts","sha256":"b7b3284fb68b2b19841348171316a09be54d733a8010256f53417e9e41f8fd1a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/auth/sessionRefresh.ts","sha256":"e09e8ef261abadcd4c807c9849586f129cacb1a34473ec6333ae9dd0e04995fc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/utils/formatters.ts","sha256":"866026e374aecfb12e5c82b914c9725481f5be8cd7aaf324d328dd38909a6aa0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/lib/utils/uuid.ts","sha256":"d876e56c9b53280f4f6691a974574ee28de2d12950cdbf3a2470d157a141162f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/__tests__/core-envelope.test.ts","sha256":"4020cd5991a2abcd20f182cb4c88b88e7dcb9bc04ace9adfe47cd66e9c2656a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/__tests__/normalized-api-error.test.ts","sha256":"f8dd55e9eb227b0c12fd0c63b020c793e2749fb104fb45bb4022e020f80193ec","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/core-envelope.ts","sha256":"86a5f8a78cec33bd442eaf3da85a5e714d081c3a2214c3ccb63ebfd78b0339a3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/api/normalized-api-error.ts","sha256":"75889da6f468c7b3295ab51c53ddfcf6f83c6618edd8811b761ee4693377ebb4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/hooks/useActionMutation.ts","sha256":"df8b90e63200d0b0ed51e44a3c28d3cce1d7964d90ea2af8aef66cbbf8c97b6a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/hooks/useIdempotency.ts","sha256":"9808ea20cde706f2c8f645f07a4bcb90d14c89adea7322522d829a3617b8f83f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/shared/utils/idempotency.ts","sha256":"6d00ba4c0ae824cedabbf455f21975249649b4a73a7757d4c203e99b5137aab8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/types/common.ts","sha256":"42c60e31cafbe842591bf3cd2c49d71358bf9d3bb6a3bbe8385f4655200c6db3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/types/dashboard.ts","sha256":"b796ecda06e56cb1f10d8632335848ba309acbe3447825198256efb227626a76","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/types/module.ts","sha256":"04d48b945ca185b31cb3b6e39e43ba1e7432d356bd35d518d6c04bdee1a6077c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/src/types/storage-server.ts","sha256":"ac805cbe7f0ddaa3024e1abf1310009f688d1c73fce62bf3ff951289bbde1fc4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/tsconfig.json","sha256":"76335b5f91e9dd704eadc392fca84381c7356bcb9c1d59854827b10b9e1c86b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"admin-portal/tsconfig.tsbuildinfo","sha256":"5984e451ce6e53132efaaa1e683e3a9a2713936b687a577c488c84375f007a0f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"admin-portal/vitest.config.mts","sha256":"1bdb061eba7625a4c4884bec06a93cc2120b697a01d4ebe268dfc8eb3143296a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"api-gateway-app.lnk","sha256":"8b7f7f4ea8f68e18a6ee2ebddb7b8f2e21d0a1d2334c763160e05802ed462405","mode":"metadata","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"core-app.lnk","sha256":"9b94f72fe65e85c0fc12bd5df0fc1a39bf2ecaa8f6b37e839ecf5f8056fc25e7","mode":"metadata","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"crm-app.lnk","sha256":"458b70eb14649f1d7193061217a3642c788a955e050f9868205ee0e56a5c1dab","mode":"metadata","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"package.json","sha256":"3e2b18681a3de0a3316bd7620f7fc008abc936bd4d62fb54070780bfafc50a3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"packages/webphone/package.json","sha256":"baf53592075897d58eca43049547e6a0544c3589f6d7f81b8b7a4913886fcf2d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"packages/webphone/src/config.ts","sha256":"1a17f88a30396132272ef3be7f1ff65c1aa7560c73e4342afd9daa721a5288d1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/hooks/useWebPhoneTrigger.ts","sha256":"c2a83c6a1957f1aba3f5df906652baa6b34899b1760995acfb64042246629a5b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/index.ts","sha256":"c32e3a086779ff6cb4c1fcbce5c99c218be9055baa608a69186ca4b1452414d8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/types.ts","sha256":"b3a4c4467a7ccbb67d7a6848138539ca73c8b780dd1207a678a9d13458fe9440","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/src/utils/dtmfAudio.ts","sha256":"0baf0b62e0baf1b04699be4c4708dee042bfbf29becb599fc81e6c4cd6ba86aa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"packages/webphone/tsconfig.json","sha256":"bf8269640abc9757e233be1dd97ad67cbba5e61fa878b6c4c53efa1dd7a0f42a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"packages/webphone/tsconfig.tsbuildinfo","sha256":"ddf6f6e420a028628a50f58cccc3c9556b801dc4866f9d3394e7e4c6e43b1ed8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/.agents/AGENTS.md","sha256":"b27bfb8a94834a0acedd098aafb02cc08647d53e8e863a7aa28415fb342f7629","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/AGENTS.md","sha256":"14630439b95d579188594cea2c6291e0f1145f8d990daeaedba57699d53d8f75","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/next-env.d.ts","sha256":"7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/next.config.ts","sha256":"e1cf24536d6fe4eb3a2bdf5ed73853fc79a5fdecaa232b5bc323c5b08da12d48","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/package-lock.json","sha256":"936861d2ab3bece8b4d8e17a824b599b361a11845c8853bded3b42c1e49b1d92","mode":"structured","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/package.json","sha256":"1af361663d839997fc1cf21157f35c5040067d1653271a13e21d5a122c4c9453","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"partner-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/README.md","sha256":"0707def6190fedda7418aaef95fc6e086876f775dfafffd5380999380480d9e4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/globals.css","sha256":"42070e0b45bb201b2b838a52aaaa6e965f964e0b542d97f1fe517fe59c4b75a8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/layout.tsx","sha256":"5a128d3393b91cdb4ee3bc10b3d074908068cfccaefbbb8b452cec2d3cf0f655","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/src/app/page.tsx","sha256":"0b879e41c93071015a2a66998442473c31ee23752ff4955ac13842988eb67d51","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"partner-portal/tsconfig.json","sha256":"5c51df4c59f4510d8c7dadf07a5c32132228826a3b331da5e286207b4df7ef9c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"partner-portal/tsconfig.tsbuildinfo","sha256":"95860cf1049be2a2ed477409ca96f68fcfb93718078bb7a601b050258758b2d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"pnpm-lock.yaml","sha256":"29cfcd9cc1c4a838ba805f25c304b53f27265816595d34134a59b245f4c99f3c","mode":"structured","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"pnpm-workspace.yaml","sha256":"12d6edaff7f2b17893f0347ac55dcc45fd01d08c631fa7511b9b9683f3e6f845","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"shared-libs.lnk","sha256":"1a4e1b909b1e805b1cc74aa748c84443040f68dd34b56a544f8eb64f7483a61c","mode":"metadata","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/.agents/AGENTS.md","sha256":"96daea99f77a5b1fcf35189df7d8a1557cc90ff26f3ac493a69433a14c4dbd06","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/.env.production","sha256":"40ca9b967f16817ac6af50da8526c6900f59ac6aaa7c32e38f875e9f23d8b09e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/.gitignore","sha256":"207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/AGENTS.md","sha256":"f9a9df870da646a1657698682ca777274c57b4b78a50ae2b9470cba7136eec7a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/CLAUDE.md","sha256":"336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/CONTRACT_VERIFICATION.md","sha256":"b5cfb26532ae9958dd7c16f9ff6d8c05bd7027ea2647cd24533e92e21c7789e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/DECISIONS.md","sha256":"3bb3cf703d61a6cdb2228fc0da04073b365430ec0841ad635663748a7a707d1d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/FEATURE_TEMPLATE.md","sha256":"31717e683df5ae39b16af7d874fe3ac390bca3458e292f47179937bba0fb5ae5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/GLOSSARY.md","sha256":"b80702d585acbca17f0bc3e383ca434dd024875a169cb4a25cc3f8fc5e4c3da0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/IMPLEMENTATION_PLAYBOOK.md","sha256":"6795317ed8125fb0974ec296f822ec8259fa689d5597fb1efb476333e2f2f1e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/KNOWN_GAPS.md","sha256":"4aaba2a57e4137c2e47214d9dd05dd39d81477857e6b520f6f9938c3d1094245","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/PROJECT_INDEX.md","sha256":"196d7a4e47ad30e585980adaeadef1249b43470729baa4ef3aa5d5e427ca4989","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/README.md","sha256":"ee0d68cff72a1df57e2c1c38e8776e7a018dabcf511cf91c3afc3c2e11e43f16","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/SOURCE_OF_TRUTH.md","sha256":"cb291f342c25df1337a41ae9ad3b14f3e777172a91fafbcd36f9c91453445167","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/START_HERE.md","sha256":"77b68b7bcc2ce048bb54144dba7fd0dcc9f4d0858edc20401e4580208d23dbe1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/SYSTEM_CONTEXT.md","sha256":"7637033d66a6bf2b5260890c7237c2f5483748609deb952ede9288955010179a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/ai/TEST_MATRIX.md","sha256":"63b7828ae2848ba4a9260863ae3c83418a94a0a31e7e8c5efb917400ae4c6cc0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/activities.md","sha256":"18cbdffc810356bb664cde469950024ea41c0e86b1b4e606af12b413947f3521","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/audit.md","sha256":"682746350987c12f5758a42d8a8f2b27590bca427561b5c7d2f9a1fbe0be3dd0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/auth.md","sha256":"d418b519fa2df9da82c0879b1384681ab74ed61d0ff1ead1efee0ae6e624563b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/billing.md","sha256":"32a558d957eacd02a40513d39a2aa0fbb035ba2e30e937f3e903c19a93c4924c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/business-letters.md","sha256":"5b2f3623105551379d3c261d6d45d38682baefa0a959dc87eae033b3ceab4c5a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/acquisition-sources.md","sha256":"fc5bcd5a18a3b0d3f0acb7e7b7490605b6c252f1fb3d182dc85fe58d9232f9bc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/activities-tasks-calendar-reminders.md","sha256":"f5b7452dfd6a05258d75d8805c8fbbcc6fa6f72abfabe5e7c7913884c60408e4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/common-contract.md","sha256":"cd5e0d4752f8baca4c540eb8bb35905a3dfa52fcb2a52b8107363e1d9306c560","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/custom-fields.md","sha256":"c44fd3690ae6559d47a877e007e687991457726d7f90faaedadefa9cac32acf3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/customer-profiles.md","sha256":"3e302b982548e7a0820890a9b9a740bc9f8924824e23b4c7bac1bfc572b36995","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/dashboard-builder-widgets.md","sha256":"6c15764f482fcdf1a3e21140dd2f5bc9076ec37a06baca99e95f93e5d4542118","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/dashboards.md","sha256":"987ee3cdd2143017651c6b647b07e7b9ef51924d921a1aec8cb70004b0e688d1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/examples.md","sha256":"359a7c99b2ed534dce051ff6b9cff3c046da01c02f52352085689565cd3ea66f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/lead-stages.md","sha256":"5d4d81ba4859e883ad21731473ba2ea6f6f6b7c37dc856ea2a45a618891afabb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/leads.md","sha256":"0fd1062aed5b81581f303d2cc48386d9eb7efe255f9b2b6d881d62a824d8b4fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/notes-attachments.md","sha256":"bbce19b98fd6e3adb3b047251daaf2803ec2a644e8fdd19c6ab306235f8bf3e0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/opportunities.md","sha256":"055e325de8fdcb1a64e153ca95e20ab9820d5762aa83b2537602e18c356cadf8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/outbound-emails.md","sha256":"527d641accb2476d0bdf6b0d35936ccaca7364cbc2d0e5640a53634bf5bcf225","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/pipelines-opportunity-stages.md","sha256":"95624d1f0b959173b6791f1d90c5003338f12edff0ae8ed7e0ae6d651b780cb4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/README.md","sha256":"55dc84e1481e4b334e91f2eac62bb9739ed83384440bddd817d810c0d2b4faf0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/settings.md","sha256":"e5d4c50bb3013c314d99f4d06282a6ee847a1104db78c1a8d19e0074e671ef41","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/crm/static-data.md","sha256":"ce66c3546b32553bbda29be98988d286f063488acb75a7fa28a1504f7e936bfe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/directory.md","sha256":"1734c6b767ae3937e5728e3290eff7939c6458373aa0d68bfa67197ddaf801f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/files.md","sha256":"84bfc1a78bc99f3e2aa43bb68090a8d876140a67f2af6b75731e039768b2a289","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/finance-configuration.md","sha256":"a87c68acd093ced9772fc23e1c9658df577148c7d86e830dfa144e5c02dbb2c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/notifications.md","sha256":"0782c1b77ff325d8942eb44f0b93f0f0376956e9e755af4f92d20ac1f06020d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/organization.md","sha256":"5a1d6f5bf53fa155427bc288930bf6deabb37d69923a623312b46b4d87301114","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/payments-wallet.md","sha256":"461d05b91afad216c1c60fe16464e02b83417dd785c532c73b848c22eead8176","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/provisioning-updates.md","sha256":"49e2131d2dec71aa7e9d1d174deb2919caeaa1af3265a9e6948e0ec0acda2d0a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/README.md","sha256":"7553bb4aecf7b82c8140878ee97731d15ee07f8b2fe1df19576e5668b4ad121b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/roles.md","sha256":"ea8b313eaba9a162c462d1e461cc0e2ebe8060c78fc059b95a21b64c7233aa0a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/settings.md","sha256":"8f8badb51a3d5bd4866282aebe195af450442205ba0d8b7e1842c5ec7f36b4c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/templates.md","sha256":"bd7a4fe28930d065c0db4407ac3781a5105a0ba3b0e452a3663ec5440aa603e0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/tenant-host.md","sha256":"31a45888a94acac0a750135df2d0b53ad369e21dde339f56f69e7763a3e1c164","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/ai-implementation-guide.md","sha256":"28488ef244828090bd1a55725e09b4dbd0789d69a1cfc2010992fff61d41e961","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/catalog.md","sha256":"4c8309f890bc88d510e620fcca11b2a6af5a852d5810099ea316ddf1e2f2e3fd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/commercial-accounts.md","sha256":"e0f5d4cc3bef05c12c3a1379a756fed49fa66e1047999fd6d737f10cb2e37a26","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/configuration-scope.md","sha256":"096f918e5a53cecf2d4aed46350f6d75500e8fc2e6d64c0274e46fe45754a7ae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/control-tower.md","sha256":"cc89ac02892a1b4208a667e45b2a51049f1a7ab13e28606cd2b78dd53aa22a88","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/dashboard-widgets.md","sha256":"49818933a2a1fbbc0471fbccf201dc3ed051cf7191840c133dce1335d2a78c1b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/dashboards.md","sha256":"5455d4e95a95f7dbd89ce894aad119071971fca68d5efc7ce0cf0c1aa60a51e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/document-platform.md","sha256":"181eee571b0a9ac0c9b05ee2722c05c7cce91fff52fc2e3f6ecbca32b45b10ad","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/documents.md","sha256":"701833c99423a1ea56f0deb80f573ea58cd546e5a448cae69bc0a20457aaa5bb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/examples.md","sha256":"9598f269830e15967d78db56872970c5ddce2082dd357cddc866ee4971deb09f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/extension-profiles.md","sha256":"6e989f7b500d161a52ca27ea111bc2b75cec5f30005082167078c9f626e61d2a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/extensions-automation.md","sha256":"c001f5b781c08744aaa9c7c9559f77b6e5d246237b735d807b3f06a6005a7468","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/financial-documents.md","sha256":"fb75a4e54cc5b94fe7cf222613934118cfda6020b975f364e4067686afb3dbde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/inventory-pricing.md","sha256":"a7d18486f3c95eec60744fa6fe4c2a218a7358d5de007cb89abf07fdbd626c87","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/inventory.md","sha256":"ebd588c73ad83546302231d36a1bab9e1b295f3dc34dc051fd4613318b428d80","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/pdf-render-jobs.md","sha256":"9db540f45ab80b516baf71b040fdf890e7e9c91ce4ecd97f46a6f830d76c73ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/policy-studio.md","sha256":"0d1001734ced8702535b0e909ef9c1a339979d8ab19549b5340b27c62af56c19","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/pricing-price-books.md","sha256":"a26bcdddf0eaf84fcf62d2638843b17d4e6af80f6e30a20bb165e941b7796fc8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/purchase-quotations.md","sha256":"21aa2a0594b96c8d57722af9d64f3903e4760c82f551f96c8877e7b9bdbb1527","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/purchasing.md","sha256":"bea1ca9c4ad0e034bd14cc830b2f29a993902975ec0675bdf24e4b0e4eb53dff","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/README.md","sha256":"c57798d97414aa218d82f8785d2a75744e9089eec7e352f5f108bead4c5f0ef6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/route-coverage.md","sha256":"806c4a6547b5a156c103e8441b4bd86ef291e558a6c3ef57c1234c8190a2c4d1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/security.md","sha256":"b1f1c5c1059375a2fe692448a1c761bf096f672afd1447e830c1fd26e243e85e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/static-data.md","sha256":"313d8caf602c17c368bd6a38a45ea2a0d479847c6ab14d6c54f419615c5225ce","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/validation-reference.md","sha256":"4116b3062d8f26cf76347ff1b10a176a08a6f5a86d270748b8b7822ecaefcb99","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/trade/workflow-versions.md","sha256":"00d0d732af34fd0113012603daaccc861f8c0b19106f3d69401a2848433c4c47","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/user-modules.md","sha256":"11f000a41fa1cdc3c21eba772dcb643b36856dafe3bf61e1375964c89e89d584","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/api/users.md","sha256":"52af80c8f9dff371346ac6fb06a52538aed0ccdfd8113eae89bea9ea0b514986","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/application-architecture.md","sha256":"628a3451156562ad662bb65a2e42aef9528360e623c423ca215ce23dfece25b1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/capability-map.md","sha256":"d711595fda03badd58280d8dc6744446f2d0fafdf2442d65d00bc1b0e7215d98","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/migration-checklist.md","sha256":"5f75e6bc5e12152d0d2524dbf4ce6902fd2cd8ac861346453e0af254fec9710f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/replacement-scope.md","sha256":"5cab5b259258722dfd9f0fee5a290ad3d5a56d2593e8c8cab0434a0d8cd143ea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/app/route-map.md","sha256":"7ffbaa2a5d562b1f1ba6f5747afb9980dbcda423e7a16549955c777ad91f0ab1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/asynchronous-workflows.md","sha256":"cb97cd7276b257a08515ed92e1d7ed622caa549225d2d72beb4910b59d88f0f9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/authentication-and-session.md","sha256":"e74618c86264610fcf16c62a7d1ffe622001552f3cc6dfbadb406059c497ed80","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/authorization-and-entitlements.md","sha256":"dabf78c3a20bab726e92be38f14dfa978db62b0dd8ae63a21fe38dcc8fddb908","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/request-lifecycle.md","sha256":"c1881e3e8b56ec27cb08e6a369a13c77e72614f4c8df433738347c65e0d880ea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/system-context.md","sha256":"20da7b7720db88c2e40cca793cee175615de9a10e48de288d9628874f5093af0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/architecture/tenant-host-resolution.md","sha256":"337a5b009c1eb250cef7729caac84f3c12f9587adf80a18e1560d377e9f17a2f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/coverage-matrix.md","sha256":"9097582ab5b6fad3a7194cf79a73d17ec773973e5d85a4c577de6d594a9ca9e1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/README.md","sha256":"16251edd30c778999dcd06dca88fd789cc1db576010382c04e47a7f2cc232e0c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/audit/replacement-inventory.md","sha256":"3cdbc296c6362daf677b9a7b61718589d333633c18fca3aa50218ecfcb6d04bd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/DOCUMENTATION_CONTRACT.md","sha256":"13a027d2fd6098558ccae119ded13a4a91180812a4ed0076252a8483e3142a17","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/dtos.md","sha256":"bbc3f11d291158dc8f128baa4dcf2ec82b4f071d27a60c9678e43af9adbca033","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/api-requests.md","sha256":"ac5b1a75ad551dc973689827b9c9b1889227a31994085c6ed3200282b3b8bee4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/async-operation.md","sha256":"9c4af12b077c39371c1f8d069af43757cd5d01551f5858242a6e33ae7808e1c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/auth-session.md","sha256":"08782de6b6db7e7d4d05d027430e816d3ba0ef5f5e67f78a9c05c79dd911834c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/feature-api-module.md","sha256":"daffd307ed387ddd363a02ff003bdb9cd31961dce9e7c3d571bd3a8b7cbf2158","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/README.md","sha256":"a490544ca884c019eae6a6952345de8496f5be6665ba28d02789b777695f1844","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/examples/validation-and-errors.md","sha256":"f450edffe99143a11103d5e11bb7e2b5b695094a71cbb938f8d0a0465d219c8f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/generated/tenant-api-routes.json","sha256":"489ccd9906387965a577674c9d27e5961e99c1fe42ea620b3c3ffa4d067e39e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/generated/tenant-api-routes.md","sha256":"db4be2653f2bfac60bb49a953b986c4594795d55b91c3cab94f0204ca956fd31","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/rbac-matrix.md","sha256":"8fe8df1c9c3a71b670cce4ac7ed0ead4dd0a948be3aa246f921f3c27e63cf2b3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/README.md","sha256":"2b678641a97e2afb21bb8f992e8deed603cab6a0f878a4c2cb3966fd26b9fcfe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/browser-and-session-security.md","sha256":"94457c7aa7824a105e11c90f32511d021c1b74f81da2ddc59ef17c050edccba7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/content-files-and-redirects.md","sha256":"8268904fcba943941d44c522790d22fa4409cd4c52881f74049cb53f16e36cb9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/README.md","sha256":"b4af247e3abbd1834e87925276fd3ce33c844cbe76376dcb37745904cec1f6b8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/security-verification.md","sha256":"02ac9818ca931953f99f8dfa67987562ecd18ba56fedd0d08b5135d37aa4864c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/tenant-isolation.md","sha256":"7b9fadc2aeb06ee713f8a2e7752077321a4f242cd277632ca75c29d43f6e45b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/security/threat-model.md","sha256":"e8f9c8f73cdd1107bc1c7fbca1de3b20c3ff0a922006c74fff0a131403e3122c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/static-data.md","sha256":"1e3f272fafe3c377dcc3a56b8e3b050717c5e7d89fa33802b15e7ae134b664e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/error-handling.md","sha256":"8defeb0b9697092d76ee108f1b69816f40930616c61d340852bb5068125cf689","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/README.md","sha256":"007b555bbab8a7ff0c5a5863ab359449ee4a2af87d46b69cdf0bc04abaf6b5bc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/request-validation.md","sha256":"c81ad22cd672936e6ac812da169dc187d10f7bd946d458a914a41f602d0b9d12","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/response-validation.md","sha256":"8334496529f986a6686205b9fb9daa316737417799c8809ea6ca849aada132bd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/docs/validation/state-and-concurrency.md","sha256":"d348bde1a3c848da8d7348a94faa0d4f2edddbbf4bd12fa9cc270fef45b1dc40","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/eslint.config.mjs","sha256":"870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/llms.txt","sha256":"8d73c637348b3c6ddebc11600c662f847acd7f0bdc9d26a8733f3979a0ebb57c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/next-env.d.ts","sha256":"7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/next.config.ts","sha256":"c274b444aaa1719e888b6928e60c0b5836647fcedc61e35aecd5b756c59286c9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/package-lock.json","sha256":"b291ba2c4feaac25ab597a92ed28404f51e8881fc7f7646c45b039740f8d981b","mode":"structured","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/package.json","sha256":"16bdb4286b852d3abca87c622c99c0ee98877c3f9ce54cc2ff2f1bf94b548040","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P3-0001","FC-P5-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/postcss.config.mjs","sha256":"dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/README.md","sha256":"1965059ad44c4801e87bd1c71403cd3e58293838f418baf622b39356c1ead46a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/docs/check-docs.mjs","sha256":"d64e03089cff4ded04a415d3ea99ea12d23678b907ce1295a4723933deb975af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/docs/generate-route-inventory.mjs","sha256":"84afc0b2d2286411d8f80f819653aee699e12375cf61da04593482efde686eb9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-scope-errors.ts","sha256":"9cc0ce0ba2f94ee99bec6ebb0200380c176c4be1d13351669d6e3048d4c2cd5d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-tsc-errors.ts","sha256":"181c02b21984196009002615b88f9f1ce51b7db25b46980cbadc208a2485030a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/fix-tsc.js","sha256":"57defb00a9aa95a73ac09de6d676747ade6b5e20c8e7f967912611a9b477b3fe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/scripts/i18n-crm-codemod.ts","sha256":"203880a15cc2c909f1d95962ef03db99ba78a648129254f703cf805d363fd6a5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/general/page.tsx","sha256":"a3f8a8658c6b0afd5d5211003ed547e935924153f904ccb40d3ede732c7853d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/history/page.tsx","sha256":"f054554d4f8cd4b49af56e6c39a47c6f573733fa5ddbaa92fd5affe5c9fbea63","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/layout.tsx","sha256":"f0b39b41d67b00fe615cef180247f516c9fa5a62481a7e059715c87035a06ecb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/[id]/settings/page.tsx","sha256":"afae2fb2aed5d7ba78cde0702c0e07a9b2c832fe00a907f25f45bada5d47ebb8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/components/CreateActivitiesModal.tsx","sha256":"fb741619585bb209d5c6d8b90d272977959a23cf1c06f846c9e8492fae844332","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/components/DeleteActivitiesConfirmModal.tsx","sha256":"5296973907301d0a44ecf77e4c22bbd75f573ba3a4fda5061ad125123cbd550b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/hooks/useActivities.ts","sha256":"d4bec283380ddecc801121b9b06e078734a06a2f713b5bbbf1c96aed6b9ca788","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/activities/page.tsx","sha256":"2df5736b53b3949437810d1c867963ae8c3540f92767df8c9c329ff728dc211c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/general/page.tsx","sha256":"00d51a752e6f9d63615c26b12103c09515493707aea0824ec9af5c3a41b2f77a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/history/page.tsx","sha256":"b001596b6bf0c16ea9bf538df3b03c26bd4ff3e279b4c484573e15fbcffdafb0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/layout.tsx","sha256":"55482647383dac4e6724c8456dab8073eb46da3230358f13995bb7c52e4230fd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/[id]/settings/page.tsx","sha256":"b792c070a89d575e9cbceb566af29ba0427274bdfc7df69f1aaaf5f9160116e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/components/CreateAuthenticationModal.tsx","sha256":"a5a925dbca8873dc6b58eb75f1cd005cc5a33049917d6cacb8da539ef449bb50","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/components/DeleteAuthenticationConfirmModal.tsx","sha256":"3c608aaadab292b64562ab80304e0d2a7ad301139161c9c12dd3c275f7700029","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/hooks/useAuthenticationManagement.ts","sha256":"1a9b7e32ddc88b43c180caca963b6278bc1ef383196c8b3f96362978e27f79a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/authentication/page.tsx","sha256":"cb6c3f897c2e8d62a39f9b31a0257a733868d784b380f15cb4768c1b978fc2ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/general/page.tsx","sha256":"6bc5bae3bf5c180f4ad82cc3248e3718b0914e03a124e56d8c29c22b8e31a150","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/history/page.tsx","sha256":"623d1d78421bd98e5ee724eb80b96b57a42ed19b5759dd59abc59e76eb728b02","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/layout.tsx","sha256":"be3581a5c5b12e9fc13bc99aed3033f4751abd9f323c944893ca6e4b67c4c6a3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/[id]/settings/page.tsx","sha256":"d2faa4521b648de32a405a82c70e7d4e3df3567af99c2d8f538e4cabd2f960d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/components/CreateBillingInvoicesSubscriptionModal.tsx","sha256":"cb90234f3b2a2b065998ad2c619afbe4467afcf4d53a956f2d1581f056970911","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/components/DeleteBillingInvoicesSubscriptionConfirmModal.tsx","sha256":"49f74bab27abd6cca101dffe6837bd34813385f8b94dec217efefc85728d78af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/hooks/useBillingInvoicesSubscription.ts","sha256":"2789cdf9ae7a0fdbc81f36c4ada41462fb60e742b25a63d6e5ad58a468dd2cf0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/billing-invoices-subscription/page.tsx","sha256":"87e79706aec2cae464f31258ad47fc88168903534bf320f80e86faed922a3271","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/general/page.tsx","sha256":"167a052669e8713c350ecd33da45bd26158c5f6445facabe2919349021b4fc83","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/history/page.tsx","sha256":"399d1796cafdb495dd38acdb3ce674a5c65018f8a00fc6d50a44b5c52987e241","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/layout.tsx","sha256":"dd95e335a8e7aa2cfc68795e80821929b53dede401388bf981184fbe7fc18e3a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/[id]/settings/page.tsx","sha256":"5c2406a55edc3db90a5a16d32511483cf8c45c2298fd98a2fb2f04ae7ef77fa0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/components/CreateBusinessLettersModal.tsx","sha256":"9defa186697a4eb437354961188dbcaf42a803123a7d37ff7e3632b8d9144e27","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/components/DeleteBusinessLettersConfirmModal.tsx","sha256":"fd4bdfafbaab4983410873ca8561d5888e14452dd761ea4e9aaf6f5223263716","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/hooks/useBusinessLetters.ts","sha256":"ae9c8cc92a63e9d22972f52eef06b3c055053ec89b0b5097ed9c8a47854e2436","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/business-letters/page.tsx","sha256":"4329c4da18d87bd420e3b46564162fcf935f7b4bf5e8b68f916554426d64efe8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/general/page.tsx","sha256":"77de7eabd7b92688b9d8f966048f6c365c66cfcd0414bb456ce398299a29f634","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/history/page.tsx","sha256":"2c9ce2cd586b52d051c749586354ebe498a6cc9aa5deb095bb23ac99e419a9c6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/layout.tsx","sha256":"11d72fc12f6260f10216b1d86c283f4565dbe60a00660fc28c485feb2e9edc76","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/[id]/settings/page.tsx","sha256":"ab89940edbe3905540ffc31076fcbc44111fbff711dd9a7097d315af83efe375","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/components/CreateCoreSignedFileDownloadsModal.tsx","sha256":"c09de597e29ff9cb314d302f5a2543bfc4b8b6730a004e3c975e0b20aa8f12b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/components/DeleteCoreSignedFileDownloadsConfirmModal.tsx","sha256":"bd428c15c5c2af97017d2b20c79598a36269f1530ca32559fb89445df7115dae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/hooks/useCoreSignedFileDownloads.ts","sha256":"a648f06e0778b199c66ea8ecfcd1119bc0196dbfbd3252f37980dbe35fe4a501","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/core-signed-file-downloads/page.tsx","sha256":"0bf733f4974cf9d46792b21e15fee1e1c9ad2eb381f3e09774fa5e96ee0cbf7d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/general/page.tsx","sha256":"9438f02e5a13e2e55e3c9e6865d0942e8ff7bce3a5f932bfbc042601de63f714","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/history/page.tsx","sha256":"453f47b993671930eb615086f12743ca87e97cb3dea7cc66f4477f0e045a00e8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/layout.tsx","sha256":"886f1af281649d86fc23a5a26dbf2a2e927573283809aa8a324ee1cf941e3bf4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/[id]/settings/page.tsx","sha256":"b6e12eec656fc379928d000eac2e8f34d6dd028f000bfafa67911da2691ca7b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/components/CreateCurrenciesTaxesNumberingModal.tsx","sha256":"a3eb0eea42cb004943f399f2c72003510c5e7b372145eb9774bc42b2e5710bad","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/components/DeleteCurrenciesTaxesNumberingConfirmModal.tsx","sha256":"48786baa78d2ee43f385224c8b7887ab0c18958d0d4eb88cdb5fd39395c63bc8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/hooks/useCurrenciesTaxesNumbering.ts","sha256":"c3dafbf1c5eceaba101fbb7d17163220b065f40fab1e19db65a6f08423ff67d5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/currencies-taxes-numbering/page.tsx","sha256":"9196402b4b86d92217172710409dcdeba0e59421323c7003e5e8b8c8ede802a9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/general/page.tsx","sha256":"70b9377ab4c03170f2076023fc8af4b665d454e2374ae84aca09fb1104b55f7c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/history/page.tsx","sha256":"f1213d02ac7e817062a8f1e85a2f3993b259ae1ef3be16099e5e9fbc1a347690","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/layout.tsx","sha256":"39730df3ef7868302acea89dfa59309a56081e910f72d9563a387af0efa83f89","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/[id]/settings/page.tsx","sha256":"b486896d99074b91d2ecaab38771187c13d52d5c2ea4ef0e1db51e1c775d6aea","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/components/CreateHostStatusModal.tsx","sha256":"84120bc16e37f0b8251059111a4ac589c2f16f104c7737c2933994b4de5dbc1b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/components/DeleteHostStatusConfirmModal.tsx","sha256":"297c5c823b3312534792fd71c0da28a34d600f7b413e3c16f16d0920bc8f2975","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/hooks/useHostStatus.ts","sha256":"0266055e7449572a68208d650f901c80e060df924ab7d3a4385e856b514911d5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/host-status/page.tsx","sha256":"6daf396d50d52b7fcfe590a03ab9d943c7273471b575178acf173956832ecdfb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/layout.tsx","sha256":"8dbebed45012d3d00227292a92fa584ae72cf74a423fe50b1d34f8c1c0e1b21b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/general/page.tsx","sha256":"6b923190292767b509c405e8fd5d517e0b2d21630a11f9952c9ace295d3d1eca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/history/page.tsx","sha256":"0e7fe908ce73cfc09f0f811ca9ba8f06ae35d17df84e3a4b7cca5f65a52d80f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/layout.tsx","sha256":"f3b70a384fbd9d10cdd39e054793c1101ef2a67edb90a0533821ec35a743f4e0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/[id]/settings/page.tsx","sha256":"ba5b9153d1a5a99ade985b9a0595a8ce42a4adcf2e274063a2f4307bbfe1fb1d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/components/CreateNotificationsEmailConfigModal.tsx","sha256":"ad5a12a042c699bc88459797bdc8e7f10fe1f53928e613b2a2adbbe194a63ec7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/components/DeleteNotificationsEmailConfigConfirmModal.tsx","sha256":"adbd9c2856a090e7ff4913c060a9c9a390f94c0c7b6f6c38dc7b6f8d7b417035","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/hooks/useNotificationsEmailConfig.ts","sha256":"ab2ac97aa0b6bc458b72506b2a5ee19a8c42c66edebbb6636534175992f2b0f5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/notifications-email-configuration/page.tsx","sha256":"1bee7dc21b24fcca8f56caf947ca723f85c16ac7aed759d433975329179e6238","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/general/page.tsx","sha256":"24a86be46d01bf2f8a2012f492e5e9c604edde9a46407f7a7440a6157ac95ad9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/history/page.tsx","sha256":"0262e1f2521d9955461a6627e7a6b44ce894ac510e1e5f0d436ce042742655b8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/layout.tsx","sha256":"344d894b2f28c785aae79dd0cc7cc4a9dc2058621d5570058d44c0f89bb98fc9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/[id]/settings/page.tsx","sha256":"fe720364c8a9121f1a50c121f00e60fcc537ffbb569b197172931f4550eead28","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/components/CreateBranchModal.tsx","sha256":"01031ae5cbf39310d061f41afb238f62106f733c8c3371f47c3706b170b712a8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/hooks/useBranches.ts","sha256":"7c4c24578780c5bf0d5c319bbf604ae5b27544a9961c2eb320d212d20c648632","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/branches/page.tsx","sha256":"bb24092e4d7d6bfc158fcc7cb2a33fddd329206ee9bd27f83d206262a14fd4f9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/components/CreateCompanyModal.tsx","sha256":"8fcf8aadc8b1e3ccd88c3e7f5b3fc27f6790402b7b696d4b102daa9f088b9deb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/hooks/useCompanies.ts","sha256":"e226d1a8e41329b509329e929bdbfa9e9ed71f9b70c5f5d35c138a4e52fc5175","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/companies/page.tsx","sha256":"4801d07d19ad1ce90dafe6553ae7f08fa5c5eab2d14f31248d850b7373f89bf7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/components/CreateOrganizationModal.tsx","sha256":"ef187a33755682c768f6ebae801e4019d08722cd8623105d0b6405de989085d6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/components/DeleteOrganizationConfirmModal.tsx","sha256":"d2b105f41b3378f1f324bbbd56c0904ca3e04261bb64e2e761147019682c63b0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/components/CreateDepartmentModal.tsx","sha256":"a7d3734b4a9663c1905f487a07caea8d1bcb5ef2192b9fafc1d03360546256f4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/hooks/useDepartments.ts","sha256":"846cfe2a7c8049e904b0b7898f88065b5789b732eacaa96ac9e2c7171218c0e3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/departments/page.tsx","sha256":"7d855ec6f5f1d5b4546807b744b5191eb7f117eca0e24cb077bb10da4af43c54","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/hooks/useOrganization.ts","sha256":"e9f7dbc3a61e648f5e641c4bb7d01ce2e3dcfbb4c1529469077aa035255955a3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/page.tsx","sha256":"a8ac585e3e5400e4b0035b9b2d8030180c7bca2516056c25c1c3b350892ae5a1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/components/CreateTeamModal.tsx","sha256":"9933fedc038f019a9834aca0005e72aa87c3b9d8f539e3ca54df30bf9ced5c0a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/hooks/useTeams.ts","sha256":"93a52ac93329bea3cb3abe6db6bba0a37e516e6d15f9e0c834bb7e788b838b4b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/organization/teams/page.tsx","sha256":"9a3866388ad24f2e5c3f07ba10d2ee16640424cdd4dc34061d5e683d715e9782","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/page.tsx","sha256":"772f79ca809f905a342271282bbc5575b84fd8f9675388500ab7d932a9a5f685","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/general/page.tsx","sha256":"8a7bc3a9a27d79a8a3cdd2ca2771687bc99320172bad1cdbda73e6c00532bc8a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/history/page.tsx","sha256":"773964bec605b0da7f800ae14bba67f0aaa09aeed3a3e44e152049c25ab6bb56","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/layout.tsx","sha256":"fc5ba5b28b775a5eba5e10a38e1b5fa9177b339cbbb79bb90317ca96294841c9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/[id]/settings/page.tsx","sha256":"5e6e3e652ea6a6e7d91e8e66bef60bd9f40b4ece5a7f1e2d0f422f47c2075387","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/components/CreatePartyDirectoryModal.tsx","sha256":"004fe7b2b71ab4a72ecd353ece9cf16c63af4b4909cc5d1f831e68234ececa61","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/components/DeletePartyDirectoryConfirmModal.tsx","sha256":"023ef703e8cd1df3b8682ad43b52860683b8cf2311afd0a5eb59259613cd297d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/hooks/usePartyDirectory.ts","sha256":"c33b59abc172a5dc73728fa0c9cddd0a478d0a0dae60470af52f3bfe786f00d8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/party-directory/page.tsx","sha256":"88fd29440ef17301bbbe0c7bd94465c82f760d666ea972d3faeb69c1a05b1441","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/general/page.tsx","sha256":"1245de131b044facc570370fa170157f99a3f10f99d5a3a562c6a7dc3f4a05b1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/history/page.tsx","sha256":"6658c51fd98930e516dcdc29bc68b06178e1879e1af49ece6b3ab9761560a23d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/layout.tsx","sha256":"01b99bedce44f92576bbcf9873f3d2e963a372bba4fd2d119f355c1c57935ab0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/[id]/settings/page.tsx","sha256":"5a44414cba7b5fefa57f13bcfb88957c8059bc9b92069f83fa8ae29f279f0735","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/components/CreateProvisioningUpdatesModal.tsx","sha256":"e734e706fe0a58ea48d774d41c24ce85ff9e3f128154eb79409952df5b339a13","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/components/DeleteProvisioningUpdatesConfirmModal.tsx","sha256":"0c5f7674c711456feb1ae21bfb9502bb3da92389f09ca4a680081b70e7d7f504","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/hooks/useProvisioningUpdates.ts","sha256":"0ed963094249622e9821780ab32fa675e1c91af9baf13d8e3864e4e30284469b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/provisioning-updates/page.tsx","sha256":"b0d4ed7508a85d4459a3eedbc758a61716848eb5ba1df037fd5ed881ba5c1883","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/general/page.tsx","sha256":"ec3307b48ef6d6684969ee21ac5375a4f1c926d46a5dd9cac8fce1093622bb81","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/history/page.tsx","sha256":"28754067ea9433a1df95d29aed018454ca7df6cb1435e5d2bd93a8679f1a1516","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/layout.tsx","sha256":"de1a0d189938ea244c740293972d9de99b54639096530cfc0d9b9c6cd801fd76","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/[id]/settings/page.tsx","sha256":"b658334b1fc75c21954866ccafa23d2a46220d8199287e48bb205c1543dfcb35","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/components/CreateRolesRoleAssignmentsModal.tsx","sha256":"3021eda72e9adc15edb733ff583cdf04ca9f8c821a2448938bd984e9b668bc63","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/components/DeleteRolesRoleAssignmentsConfirmModal.tsx","sha256":"dfcd65238acf11d34fff179187d02d673003fe7eecbd3b557306e05217ef9610","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/hooks/useRolesRoleAssignments.ts","sha256":"bd8355bbd111e91dfbf7661181b8fa8bbca6760e9a6b93318423656f82985e0e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/roles-role-assignments/page.tsx","sha256":"2be2ff05e7c3f2d482886a84756b424f8eb431942c121a732d94046a91bce3e7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/general/page.tsx","sha256":"1e3216da02df04e22f29a08e358ffedb3684f84cbd4608e4222e0791f701dc4c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/history/page.tsx","sha256":"255d5e3da085214bd3431f4a8d93f7de52d40324b1ec99e798f117bb8792f307","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/layout.tsx","sha256":"e0081499edb5427a2341ee629a1afc35f0d2868d6c70fca715e856c6d50a30a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/[id]/settings/page.tsx","sha256":"74a7a4115dfb84d6d90c34b273cf7d46ae12ff5ab43ad8250d0c72dc25cc77f2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/components/CreateTemplatePlatformModal.tsx","sha256":"b83c2cdee10c275fc587b05617b1d078c3864b99147adea233b2caf7ee585380","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/components/DeleteTemplatePlatformConfirmModal.tsx","sha256":"7e42f387bf94d8f5fee96cfaa1c4b7f460042a0ac918f33a239c48fc15d90b7d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/hooks/useTemplatePlatform.ts","sha256":"9f086927113f5403330d183d9808c3ec9b225374af41e1e763acbc332f10819d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/template-platform/page.tsx","sha256":"53a1696667f8fea356f55c084686f59b774d0e4770f3d465711cd39f12e1f504","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/general/page.tsx","sha256":"b27077bb712e066bd9d1359a6f10d9e2169541b9b240cd7abbaad5554f8132bd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/history/page.tsx","sha256":"28e047e2526b9b32e14349ed3418913c63c5b4d8a5baa7922019110f1e52d675","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/layout.tsx","sha256":"8091098d8ee7dfaa0fb2df1c1cf18d56ee9aae53715661b56384af7f511e653f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/[id]/settings/page.tsx","sha256":"51e5f8454f544549114c6011ffca1bc94916f172490c6a2103117f96e3022266","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/components/CreateUserModuleAssignmentsModal.tsx","sha256":"76d1ca357b15993dcef06dec253bde5ad92da673838122e5a50e0074818a3bb2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/components/DeleteUserModuleAssignmentsConfirmModal.tsx","sha256":"1c46116a4f5cdc7f0c8d2ced9a5cc0e3fb4422785532845d69689ecb710229d2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/hooks/useUserModuleAssignments.ts","sha256":"55ca82867ed84299ad7a32d1c1fbab986a2cfe910ec5d96222339535d1dd86d4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/user-module-assignments/page.tsx","sha256":"242e58a978fa16e3e844b6211b4f310ab7c985c5b3ca64099d9530d1dc9d0b24","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/general/page.tsx","sha256":"2f5a182c71165d8160711a51a7d87c521383f3e6aa83a046dad3f2fd31f1e444","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/history/page.tsx","sha256":"1cba76c035f815bdc56d6323b515275c7f92dbaf07ef1e4f687c087500486589","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/layout.tsx","sha256":"737782c2cfcd05a63123aa011c73962cf91ea3f591f8bbbc4045e7a8db4486b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/[id]/settings/page.tsx","sha256":"71ca70fd919b932f79d5e4ddd2ee7fb76ca0028ddd835aef16db98f2b8566358","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/components/CreateUsersModal.tsx","sha256":"8b58ca58577e044783b49408c176e87850094fc1b55cdba17e5632a8e772069c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/components/DeleteUsersConfirmModal.tsx","sha256":"62ac297715c0164596285897c6dfa8960d1faf954c8f267d0dee5b5e9fe6b5c7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/hooks/useUsers.ts","sha256":"7893b5e57efd52e3760049f7012d37e1cb7807a3011ad32470f774bd18aa3df3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/users/page.tsx","sha256":"a891eb8c855b49fca7c4b0fa5d82212b914998790669ab57ed504a98fd4ea452","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/general/page.tsx","sha256":"1a326843a6aebd4ff98c8079442cb9f03c2ce904dce1d5ef9d08f54e110a6033","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/history/page.tsx","sha256":"0a7843d5729ff54ac1e4c0287cfe582e4009cb4a0f082bdb7a793fcaa8aeba07","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/layout.tsx","sha256":"3624afcb30259b5a6c68edcf81b2ef8b5387155f416973486757c5f726652276","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/[id]/settings/page.tsx","sha256":"3094a0f237375d29217fac7d6ec487843d529df78f66860d37f61775eacd5f78","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/components/CreateWalletPaymentsModal.tsx","sha256":"dc33e3c7817f733371b2d2453087883037fac1e702ce84baa208363930730b4c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/components/DeleteWalletPaymentsConfirmModal.tsx","sha256":"c5916b30bcb55034a42c6f7c856466d49e1bd393f29e481962ab70a7afc4eb16","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/hooks/useWalletPayments.ts","sha256":"9b411808b867daa1ae35625e619fea3e2485318715efe48e7bdbbaee09d3782e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/wallet-payments/page.tsx","sha256":"0a2f51e0723ace39f41accb1f69a01fd4d18920d71470983d5ac3c19bf8d95a4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/general/page.tsx","sha256":"c18e84e37841f42e7ed55d888932fe3023240179afbcc45678f7b802a7821b8f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/history/page.tsx","sha256":"586c48ce78f933509d76d12c40646ffa671d8c216056faf1007a593e174320f5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/layout.tsx","sha256":"b66d3f5e10686a2b3aeab8cdaa5ddf9f01ea23e2a50060fe4bac66eac9669e7b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/[id]/settings/page.tsx","sha256":"c48f53955b8bb12bac51d0b398ba7953bf8d30f5880a814f11b84c7f6dfd93d3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/components/CreateWorkspaceSettingsBrandingModal.tsx","sha256":"b537833efa2e43481ad711aa66207980aac647058350cdc31d4bf52757794aac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/components/DeleteWorkspaceSettingsBrandingConfirmModal.tsx","sha256":"33c9d48ebe7d0f33ca14342216e4507e413e11377a79d88ee2002abf67b7d15c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/hooks/useWorkspaceSettingsBranding.ts","sha256":"cb8ef8afb4e2d9998e32423d771c5c8a48ed6e2196163126fa166519d7d7f5e8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/core/workspace-settings-branding/page.tsx","sha256":"188e19e0e9ae448ef3d50d8287dd8b8eb55d9480dc7544220f3fcef65fb8ee51","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/general/page.tsx","sha256":"d6591db25ff60fea7606a809eb71bf2a0381fe4e120f8c133da58222f1c7ff79","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/history/page.tsx","sha256":"7ceb79d4fa90809bf9df0cdebd6dd55a50ea3ff204fe7a11a0ef9f198fa862cd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/layout.tsx","sha256":"154ebe52616cfcca7a33b3f4e2187170c90d51b21610a088c2d492a08954a2a5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/[id]/settings/page.tsx","sha256":"379abdf32f4aca9f4e679274d11e572e028a2e5e47a13b17e058ac0f819ccb14","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/components/CreateAcquisitionSourcesModal.tsx","sha256":"53d6df49132780bf9f6d6011f3ca529e37d6cc5e24304bf252386a26371f5ac9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/components/DeleteAcquisitionSourcesConfirmModal.tsx","sha256":"10d0951bfeb23a46bcd8c57a5a56478f53cb92dbd5d97d2c198d37381578f0c0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/hooks/useAcquisitionSources.ts","sha256":"6fad00e252d56373d4a7d9a4bb1a76444019920ca1eb0ac7e9664ee2bded8542","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/acquisition-sources/page.tsx","sha256":"173da7c25edd616fd28f7d9f47c34364df560573517e31907fcfe7c2b0cc483c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/general/page.tsx","sha256":"b400cc9619a9c822f449cf6567258e54fe8d47adcdc4a596bb57e6b934468c87","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/history/page.tsx","sha256":"5353302e295cc46ed8e4d853a690d4e5c1a6e5d13398787c74df240f5ac6e19a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/layout.tsx","sha256":"3bb09b4659ea07f414a810c6091541131cf8f384fcd37b45f9143dc2cba68c6b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/[id]/settings/page.tsx","sha256":"d22890022429872153863c385be9f6e80a5a0697ae8c184e15f0fabbf9afdefc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/components/CreateCrmActivitiesTasksModal.tsx","sha256":"052ce56e8a3166ea671f7bf611b6941224bb0e937a3119eb3d986302b5c0b8ca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/components/DeleteCrmActivitiesTasksConfirmModal.tsx","sha256":"dabeb27c47c2199970f3cc1281ab2836dae7c923aca682578d5c2ee72bd81816","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/hooks/useCrmActivitiesTasks.ts","sha256":"e74182e8c6706bb3b203f96c5b39d5fe8ea08fee1d3bec2cfb81151c933a6d4c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/activities-tasks-calendar-reminders/page.tsx","sha256":"e07ea1ab1aafe70550ff897cc1cddf57d6ea69a36a71a7a0d60b76938d25b565","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/general/page.tsx","sha256":"625b951c8e9e9080903abd9cb0f31d2d90c9da950eea40958e8e5a5319d34dc2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/history/page.tsx","sha256":"574b76a51b721a0fcd99d42524a1386d0bd8cebd77d8b7c56acf908231d8259b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/layout.tsx","sha256":"168e93de53e1b3df68cd87f247d09569af4708cea9cf6486f2c2b817a7541893","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/[id]/settings/page.tsx","sha256":"cb966619f59fa50969ba46701a1cde944e8838e52cf7c9fcaca59e04b99213b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/components/CreateCrmApiDocsModal.tsx","sha256":"9a69f51df8fc6d0a8a014994c5369029b49f375d260f0400fe6c28485254f555","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/components/DeleteCrmApiDocsConfirmModal.tsx","sha256":"5719927246e2091b69ac8317713a993847d9e759f976e0f179565b15b775b2b7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/hooks/useCrmApiDocs.ts","sha256":"8a8583dfb54c83dcde66b7f1c0e1c0253c9d9311eaa8cfde3140478d3dd33c95","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/api-documentation/page.tsx","sha256":"f9f97bef39bd6484875b95b2440f834d35df952b1bacd5f7411ed815aa0303aa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/general/page.tsx","sha256":"1d7c928536faee7c92d891de3fedf3d93e4588bb77d7a981e2efcf4cf2568485","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/history/page.tsx","sha256":"3bfa46cf771ff5362f702e7f22df2be8a4b2f1e41d7bae45144cb0cf5e83b386","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/layout.tsx","sha256":"830b6c5542f331ad7908fefabd5ccdb72696fb6266ee3db4c96c68f984d72c7a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/[id]/settings/page.tsx","sha256":"250ff50c41bac12806bb01f753c4da9faa4e15044e942f6c135a87725f25e206","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/components/CreateCrmBrowserExamplesModal.tsx","sha256":"b94921dbc5342c2bf1738e02e9717360374d00aa937def7ef79cc5d35358a79b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/components/DeleteCrmBrowserExamplesConfirmModal.tsx","sha256":"6fadc7760cf6d0543d750035ec3b1e485ca35f00eb2d93def15661712fc82f31","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/hooks/useCrmBrowserExamples.ts","sha256":"00fe9a812e1147ab1e631bd5990b30d4c699dbdc729ae4190939c307824104e2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/browser-examples/page.tsx","sha256":"b1c59f0016fb57a8abf3b994b8ef0fc18321079c258d55560a996f713b6429a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/general/page.tsx","sha256":"0e86d7f85d95752e23ef90934cf3be53dd657a8852e20c74a9de2852c439e805","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/history/page.tsx","sha256":"b3a062fe4bb34868cd19d608cb1b695ef453c2fd87a0bd42cba08513b4a0fa0b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/layout.tsx","sha256":"1cb89b8b52fb5d24885ec4456c2a6dfce26fdd2d1470772786c6940d244ef661","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/[id]/settings/page.tsx","sha256":"c424c82823d5ccdcf3d0bca30a6cc90511807262407352186213e6533def92e5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/components/CreateCommonBrowserContractModal.tsx","sha256":"a6b58d4eae88b1fb056c9b13160e54e4875f2b26053c4f4f9a6dfc03200880bc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/components/DeleteCommonBrowserContractConfirmModal.tsx","sha256":"92966b34ba2a5f8c0d1c2b8fe0b24b85af5fa9b2de86977aecba940518db421d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/hooks/useCommonBrowserContract.ts","sha256":"c45fb10d52c2ac3ba2e05731995fcdfdad385746d4dad596703046b9ef9d1a47","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/common-browser-contract/page.tsx","sha256":"e412250f62dad9f576fcb7bc2e38c188345979bda5c81b81ddcec12856e35637","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/general/page.tsx","sha256":"1d5a5adf3fee32eede9b9787994dcb630ac97f3cc6cfab4b7ad69c99c3beedb5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/history/page.tsx","sha256":"aa1573725ebdb858bf58bd4742b87f2ace8c1f802e30a4cfea3cad76cb40dd8c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/layout.tsx","sha256":"41adbc0373dd7103b71687311a9fcc9f50c436d761d5e84f7fda94d3f46ed9bf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/[id]/settings/page.tsx","sha256":"a146b6129917017ab93458ceafa836d47d8cd34dce12c88bfb2370a4de5a0eb4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/components/CreateCrmCustomFieldsModal.tsx","sha256":"9b6d879da36108bd1565ba74bdab78337a42b21e176a2d64410e4da1652b8554","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/components/DeleteCrmCustomFieldsConfirmModal.tsx","sha256":"b5523340a423ad7fa1c110bac0b3091be19f8f3dd456e539a643831e78b25257","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/hooks/useCrmCustomFields.ts","sha256":"16db5f9ea3c4f671e1e556fa1ed7fd376b819a404d83031d2a4f1662a3e7d17e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/custom-fields/page.tsx","sha256":"7fefff5fca147ea628e910dd4e4a9e05e172701459b646e438ad2033f35b3067","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/general/page.tsx","sha256":"0f527ba30cc737495fcf5fdbfe75cc2b770421ce26b4802bbf1c10b65399d929","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/history/page.tsx","sha256":"36fd402b6e6f981cf5aa849a4317d50aba6ce01a9580205d46337e84526779ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/layout.tsx","sha256":"e0becedfcbb65a42997e5b2bc81c51065951d6211cfee2ebc7a271aa849ae368","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/[id]/settings/page.tsx","sha256":"2795ea2da461009eca95daa20d1bd57e1ded39071352e49189e71d3f4b2f856a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/components/CreateCustomerProfilesModal.tsx","sha256":"b0fd2b4b63213e941431ff63a1d205832c446401ff1bdcea395a9c1dfade9de6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/components/DeleteCustomerProfilesConfirmModal.tsx","sha256":"0a32ef42a5de74be6350bf4987a62ab4d0a4bdd9b600446686ff764f94684058","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/hooks/useCustomerProfiles.ts","sha256":"619e18d404ff9ede875c222cc816b1d07d3678a3d61f5f68467f773c3b16e11a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/customer-profiles/page.tsx","sha256":"3ee960c56ce6cba1a353749bd7c3187bdd9423e4f911a8ee9b91832ece22a8d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/general/page.tsx","sha256":"dd070002bf9a882d4f3941d2085db7cbecd2ff5b013c39ef84ca8ac2c0052ba2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/history/page.tsx","sha256":"c696fd525a8dc5ae45b610f0d6673e51c8ac5bfcd48112bafc5edd97e634e7ba","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/layout.tsx","sha256":"7749704e2c7631004266c2f6cc691376ab926b1ce26b24dd6e879f2367dc80eb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/[id]/settings/page.tsx","sha256":"b1c20fdcd219636d3d5ce10cd90ea9ee76d4c47979f4172cfd832a135517c7b9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/components/CreateCrmDashboardBuilderModal.tsx","sha256":"7b2d89c5b339056b13046ab927b8b23e7dc84ae87a9e732d536fb29d8c6bf929","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/components/DeleteCrmDashboardBuilderConfirmModal.tsx","sha256":"9672ceca391858e5f55a6054302b9580fc7c1743a87feb8ae53ba1bf44198ef1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/hooks/useCrmDashboardBuilder.ts","sha256":"559adae5441f0dbfd7b4312ee3c3b7d205661e3af85db146ccc0727d35fdb1e9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard-builder-widgets/page.tsx","sha256":"c47423ebe9e88dfc0ee1988d0846c5395f79677183097a17734ddd7131935bb6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboard/page.tsx","sha256":"de3ef5ba6ef11fc3700117456b7f369e8195d2554511f9118119e81ed1f49283","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboards/[id]/page.tsx","sha256":"928238045f2759ebdbdd1a5d4592f74fb123bc8f48c0c4375511c38cf28f1818","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/dashboards/page.tsx","sha256":"e7c44c4e6a9694d7126287ebc024bc11153ea2f145d57adfea1613374c65be85","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/layout.tsx","sha256":"8784e64d10e06fb0918e29da708b655b8708d7dfb94de54673a46b63c6dd948a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/general/page.tsx","sha256":"cfd832b77a4c81109877158e72ae05e289132342efa10c113df9de564f3a4368","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/history/page.tsx","sha256":"c813e17df07028497f28f49a6b7a695840482e8440a098a445d8c5fc3dd2f9db","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/layout.tsx","sha256":"16cb03abe672038f65571ec2b93fcdfc015bb8aa398c22804da89a3fef665602","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/[id]/settings/page.tsx","sha256":"b366c3c1088b39cc3d311ceb46e6138ad39a8a50c5d73ad81aeab2b3edb2006b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/components/CreateLeadStagesModal.tsx","sha256":"3c1030cb2cc70d0f28d69e646e8a39b3bfc06136230f202f05010346b9215912","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/components/DeleteLeadStagesConfirmModal.tsx","sha256":"9ecaf0d5d7f72e4877b710887f0b4b6b051d0a45d84d31cf52be90d1c6dd34db","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/hooks/useLeadStages.ts","sha256":"25cd7f9346180bb36d7e4199114ba1e940a271a2e4d799c985aeec9948fc5e02","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/lead-stages/page.tsx","sha256":"0d2142c31c02383aa15c19fb761e1c08c479ddb6eeee972a6e5cab58c24ab30b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/general/page.tsx","sha256":"490c5ca2c912887e2b29d36c2a8066116c110adde7681dfc12cb36a98f32b5fd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/history/page.tsx","sha256":"849c598f6a0729207fa6d990053f83b0202fe7d7d818218755884f9b36603389","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/layout.tsx","sha256":"8a6ce91455fd42dba7fb43d6f6c0c8b6dc0188443ae5d347dca59e7078501f31","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/[id]/settings/page.tsx","sha256":"8a21541824771b7a0d1d126d0d0ae47e27f0393c2b5ffc1a0ba7b915c6a5148f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/CreateLeadsModal.tsx","sha256":"a0a21f34b393af59af666590e7c3c2fdcfaf42e90d6b773d0e57cc4d6aff4d62","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/DeleteLeadsConfirmModal.tsx","sha256":"a2d574ab8e8c8f506e4fe11ed046702a6d9a7695ba5a7b8bb2ba65e0a200e01b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/leads-workspace.tsx","sha256":"76b340f6c331c2a743877e3c2950bf9073ed7315779592a3fb7dccc265e724c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/shared/lead-card.tsx","sha256":"27dc2794415a9fd66bd48056083d40f64b41c3175cf713e33403398b7ea8c21c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-board-view.tsx","sha256":"9b17ff34480fc2c3412855ad04c74736385d5afac6ba88c9785cfc5393d4f959","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-cards-view.tsx","sha256":"0ba62a04d118e2f37f11bc670d25eddd11c07a3f852861d7d025b2123852d635","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/components/views/leads-list-view.tsx","sha256":"2c3e9d6ba46bff2a850ee03a9de35781c5d3301945496dd2c0e604742ebabffa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/hooks/useLeads.ts","sha256":"07fb3aced670bb2a0a91f0e71df6a06987f26931a1e7a11a280bdf64dda21a72","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/leads/page.tsx","sha256":"9f16df08d733814c78b9752e4815828d60281e66d3d4f01e2e56f160692f7012","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/general/page.tsx","sha256":"407aa9705499d4286ea2317ef02f8ce61a31305c6db7b7ed2211be90be6e8d34","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/history/page.tsx","sha256":"48c896b7a860aa855cb37568e754bf514a42e60514f9f214ad1e3471d5e4fd03","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/layout.tsx","sha256":"47290002be554a15db36889ede7c9d53719cbba5adc5e38f944636befbe8d99d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/[id]/settings/page.tsx","sha256":"c87931afb4840b715e4fe8ee7d04177a51375123419275c0a936a5ea4457dd16","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/components/CreateCrmNotesAttachmentsModal.tsx","sha256":"ca9c3fa2a296db5d38066d2b6783afc157c7863c42c9b64dfdaf2071bcbd12c1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/components/DeleteCrmNotesAttachmentsConfirmModal.tsx","sha256":"8766f1eee8955517e6d2063c8d5167970e08819d2704deb229c8b1af8deb22f3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/hooks/useCrmNotesAttachments.ts","sha256":"4f2611326e4ddc7b6006c7e77fad2e3b879c5b44d6640154ebcb4179527b2df1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/notes-attachments/page.tsx","sha256":"da9b8a15ddedcb12df2cab1b37225d073e183d65b669f1863b1f62883d81d47e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/general/page.tsx","sha256":"251da7fdd71a883eece2c945316aff8c3c1e7b246358915d4696168cdfd723eb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/history/page.tsx","sha256":"b86ea619d0861040f5dab45c134bee1bce70ab8736420d1176649341f5448157","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/layout.tsx","sha256":"aaa157319730f0c3350562ed3d1d43c9961e006bc8ac363db9542ce01f5ccb1a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/[id]/settings/page.tsx","sha256":"1306cf83e69601d2319bad0cffa3a70953883b351be54e9bd539a24411f4207a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/components/CreateOpportunitiesStageHistoryModal.tsx","sha256":"af855dfcccaf6f755316a988900ae52d6a20c1e06e4b0da3d07905f0a7d18324","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/components/DeleteOpportunitiesStageHistoryConfirmModal.tsx","sha256":"0ee28ba6b2d461ad769025552b5ff51b29f33661d8bbe320f2ac3814e8b9d629","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/hooks/useOpportunitiesStageHistory.ts","sha256":"000a0eaeeddf1c1450e5b3eef64ad4caac129d68dfe1405606cee26b22c46622","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/opportunities-stage-history/page.tsx","sha256":"940ea989ef906e031c59a685028a7092eb50bbabf473e44ba14b1073130d64b8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/general/page.tsx","sha256":"7b6b4512e8ef1447035f91e0bcae8aeabf1208e0227762596dd09350ae5529a1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/history/page.tsx","sha256":"4ac8ed71bf56263830052a617135a2c1794ca9de18e4129c8dd5bfd346f7c974","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/layout.tsx","sha256":"2d5d680a9142c8255571094b8aefb8d12efbfb8df5847a8c835979aa19b766ae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/[id]/settings/page.tsx","sha256":"823e2f30e8d75a4258048faebc47dd372f95571cce6ec2deccedac3fa5664992","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/components/CreateOutboundEmailsModal.tsx","sha256":"10025bd741b3f8aa2d6645a7898093d0188c609e635ec0658a6efe64945a4765","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/components/DeleteOutboundEmailsConfirmModal.tsx","sha256":"e6b6f5b586c4a04cbb2e0b77cf133b5488486158f725d7d660ae52929fe478d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/hooks/useOutboundEmails.ts","sha256":"693b2046a1c22a01efb5fd7d1fece92a58aa59717eee8ad1767cf0518db3a366","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/outbound-emails/page.tsx","sha256":"dad3e52423a4ad62e83a73e5d3023dabdc2810914625d9a7e48d9ce20b2cbe6c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/page.tsx","sha256":"d25a2e44738b4b198a43baa6583a202c0ef000b41efaaf9f1b695097ceb54970","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipeline/page.tsx","sha256":"c02a6e76c481bd4276d4a7ebec0c29a246d2bac3eabd10f67255f53845273b3b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/general/page.tsx","sha256":"b8b6d900209c5ac07cdb9909dbb9527f8036544255782ce0bb253af45a930cf0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/history/page.tsx","sha256":"0a1203e0053a91117250ae953e4106bfa11b0c5ca1d1b7bd2c7a78571196c34d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/layout.tsx","sha256":"4435f25c4260769c645a5ff34edf193d587e5840c11dd6b499a6ba1a562da3d0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/[id]/settings/page.tsx","sha256":"7f8a4b0fe9c92c50c5569dfa85d67c21faa7f055aeabb9b912ae4601265c7cb8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/components/CreatePipelinesBoardsModal.tsx","sha256":"8e8fcd6c2f0fce4f74e80a0c7f3c2101fc6a48f94f162bf63f7c67746b09af24","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/components/DeletePipelinesBoardsConfirmModal.tsx","sha256":"d40bb2ac90dfb2484e44d1fc205bf5e03833633af8a7d748aa43e30cee277aaa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/hooks/usePipelinesBoards.ts","sha256":"61b241981cf619d9e818d4fa09a58cde820bcebfa5c3ef49ce6d860777b44fe2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/pipelines-boards-opportunity-stages/page.tsx","sha256":"a99e91dc6ae0c402158cd1ee447613af1b61f20d56d0996ebff2550145657550","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/general/page.tsx","sha256":"1867da8f7a996eb1bbd76a1ddaa80fb2a2d1d7d9721d8718557e677a879809e0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/history/page.tsx","sha256":"14fcd4109f8a2726542b8feba6b48a1a81a25bcc8860d2c09d01d9fa43cdfd89","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/layout.tsx","sha256":"9cd24944c09cd8a46dcd0f4902215db65012bcb7023747382fa459e296f4da56","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/[id]/settings/page.tsx","sha256":"78970fb4727c434457486b2efc3a12c3a6b8fb2a6af7c82fb79041edd3e54426","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/components/CreatePresetDashboardsModal.tsx","sha256":"e651bbb01d8ff14092b06677e68dfe72eee9bf27f849dba02c6ababbf24034af","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/components/DeletePresetDashboardsConfirmModal.tsx","sha256":"77ca500c08afc0c170e079dd0d24d47f0b903376eb9b8065982d66f97e5f40e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/hooks/usePresetDashboards.ts","sha256":"d560ee7d1c4e0e37f0eeb166d03a21eae64cb59414522a3b0a8057e84f030383","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/preset-dashboards/page.tsx","sha256":"0cd6a9abaf6e8f431224938e7a46518dfd3161a07e0393ea906a3e6b41b7fd7e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/general/page.tsx","sha256":"7103b8f1eb9b768f38ad63b641c06a378d9e75fc4979e6d5efb4b9563fb2ed7a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/history/page.tsx","sha256":"9dff6df8a71444b8b45e299e1f4f717bad10c54585234630145636fcdb5b4d59","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/layout.tsx","sha256":"555e29dc122cafe8b7d6013c51fd7a3cff8602fff794b65af72c8cc8598d0e69","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/[id]/settings/page.tsx","sha256":"ab467076a4351af4ffb606c3644ea4786b734f5ef5b9dcba5fda6312ca7a05b6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/components/CreateCrmModuleSettingsModal.tsx","sha256":"81e86f3e33b1a61f2f83f39525a99c17eed0331812024e76dd5bef13a0b87560","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/components/DeleteCrmModuleSettingsConfirmModal.tsx","sha256":"59a529ef85e243414e86549f84e46ba1b140961cd6012598b6cbc30fdea4ae2c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/hooks/useCrmModuleSettings.ts","sha256":"51859d2e7cd008b8a7b84bcc70220fb3d31785fc49a104755521d59b35aea7c5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/settings/page.tsx","sha256":"b73d0602ceefca0e721c8d7bc812b655670de6d88329058eaddf5c4ff563de92","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/general/page.tsx","sha256":"ccc56b64e35c3ab5c34d136ab6ad1bbe91112545670187b2b2deb09fcd4357d5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/history/page.tsx","sha256":"1ce22cfe6177cd6f2f9126a7f2b3054cf79aee5cefc75f1cc13d83758d45723a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/layout.tsx","sha256":"48b95bbe7f6b8a90843791c327a393cb439cf75f7653c65041bf847c6bec6555","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/[id]/settings/page.tsx","sha256":"1cd7c8e4e8a1e8240b154f1b8db9b377baf8cab97f327b09fa3a33f4d65b573b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/components/CreateCrmStaticCatalogueModal.tsx","sha256":"d1613592faf6561e59e1553aa6da77fe629930bc833e619b3ec7f0e7aee97c0d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/components/DeleteCrmStaticCatalogueConfirmModal.tsx","sha256":"6d80154a68ae15dd210fd263eb54712fb235275bd27ae2d901f6add2f2e301a9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/hooks/useCrmStaticCatalogue.ts","sha256":"676cce420bbd569e5d697cdd738ebc88815f88fdf58a5c0551bc860dd666439b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/crm/static-data-catalogue/page.tsx","sha256":"0f7bad2d240869237cca5680ab43e1764aa66b2bf95599864cbe8b154b057392","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/general/page.tsx","sha256":"7ee84ee1743d27bda25c05530b868903fb221999039e3293303bcc0024ed98a9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/history/page.tsx","sha256":"eaeb5b69cc7f39506d65865d5afddda93516c201f021287982ba8d6ece4cddc9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/layout.tsx","sha256":"50d955ec7c4d50329d16092cdeb9aebd6ea532de0b1d1923701b80220ca390ce","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/[id]/settings/page.tsx","sha256":"8848db7c41d65056a33a2786631a3b0caa901526c10cc1e14c0ee53becbbdc8c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/components/CreateTradeAiGuideModal.tsx","sha256":"cdac16d258a4191c621bdd4028257f4091d84b74a10e21fe976d445452fb81d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/components/DeleteTradeAiGuideConfirmModal.tsx","sha256":"daf97618eff46872e56898fad5d8c6f92c0d2805bfefff732bc438a49b2ff8c1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/hooks/useTradeAiGuide.ts","sha256":"53327d7bf1db1a7df974d496bd2ed835862e27d278402df6a58317bf4f8778f5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/ai-implementation-guide-for-portal-trade/page.tsx","sha256":"a6d15a0d4633981dc599424a83c0cd868502e935b5f363f120bc007a3857bb17","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/general/page.tsx","sha256":"f460bf976c37ec0a30d4e6c743afca28d265ec8418ab01e262a5adc82f678a88","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/history/page.tsx","sha256":"12c179449e2b52f658ccdad28a4df67af633f397036a2263a381bf42b0b2989b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/layout.tsx","sha256":"1f6dfe5819e44dd65d450ac19725f749fc8abc1128a85bf9cbd50971f04c9350","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/[id]/settings/page.tsx","sha256":"3a77e65fe99531fef033ba03e247e5a3a93337386113c50ccd020cf1b769d587","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/components/CreateTradePdfRenderJobsModal.tsx","sha256":"4ef2f7958c7198454c4c418e101c2f52cbf90c6896988b24fae6de8a3f120051","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/components/DeleteTradePdfRenderJobsConfirmModal.tsx","sha256":"43f6aef08dd7d575265a95840040568557b6b7a11df9c3c1663d1639991bde5f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/hooks/useTradePdfRenderJobs.ts","sha256":"a7deb7916b833ea23523287e482fbb6c7a348637ef1abb1a4621bbcf0e35957b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/business-document-pdf-render-jobs/page.tsx","sha256":"b905fa18fdfa2541f0bd293df5a2074c0cea12f0fd9880193042fb1257afb750","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/general/page.tsx","sha256":"8aadc7f2b7c8d417a31b006fd358104d3983d0e79730b58dbf753d69c644219d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/history/page.tsx","sha256":"e016da49bb971f797789f3a6085307a02f3698f1be3fc751faa4e0e47392527a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/layout.tsx","sha256":"88d993c8573d7fea4efc23e11e839f00ccfcdb889239f8f6251e7a8b6153ef2f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/[id]/settings/page.tsx","sha256":"2af216b370e2a0dea854046bf11ec1b3f6d28dccf734eabd6a1d3b9f49c45917","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/components/CreateTradeCatalogUomChannelsModal.tsx","sha256":"75733765724fda793ebb87033002d74e2be0ec92a65751a8f2727640d138ff91","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/components/DeleteTradeCatalogUomChannelsConfirmModal.tsx","sha256":"5eddf929a26b459bf39a78790c147f755201cdd2a4ff4c333119152d2d977c67","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/hooks/useTradeCatalogUomChannels.ts","sha256":"fbf349e140035603d38f75679701d700ff3b82ab2f0ac27c52887bde09859cbd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/catalog-uom-channels/page.tsx","sha256":"6a3fe7e101070bf8820d6bc7042dc2a753f9b0b18ac62d66c44c4f16ff4d52f5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/general/page.tsx","sha256":"9c2c3976df3db64e2620cadf063565e3527b00dfc45f7a5a6bd62c8cc2d1ad24","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/history/page.tsx","sha256":"5742d0af0a0e0d6c878577c4d91ef05025512e18e87cdea87905664e31704bfd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/layout.tsx","sha256":"8b0c9a915385682f02f92af92477d1775146a83e610a67b14895f0cbca3ca732","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/[id]/settings/page.tsx","sha256":"72840eba174c074dddbf1c0b0b3ea5261173f9aad32405ad7df6017c460e8467","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/components/CreateCommercialAccountsCreditModal.tsx","sha256":"b68ef64fd26559cd785c3d7562e52cc719b892123b5f42f2cdbf55ebc459d562","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/components/DeleteCommercialAccountsCreditConfirmModal.tsx","sha256":"0e31e1c7fafbad14119791aae45a55102f2a7d883e82b94d762cfdde557befe5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/hooks/useCommercialAccountsCredit.ts","sha256":"ce6c5af06e55b1e4993b479c6c79c43dba8ac7d27e1002c1fcfeb093bb19f6ed","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/commercial-accounts-credit/page.tsx","sha256":"8d7516377aefc747f3cae027660aa61d1f5edcd9acc675715613ae18f1c41e52","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/general/page.tsx","sha256":"9f173a0fe7311cc3e46d0d0c4b90ec29fe940f486eedce484e617e3d64231531","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/history/page.tsx","sha256":"18edece95133c16827692d27e9c20438a81ef152f44b999aedb09f775456c2a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/layout.tsx","sha256":"bae4ec12e75d8662b9e8a4dfceca0a99c74a4dfed2313b4780fb003a2c55abca","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/[id]/settings/page.tsx","sha256":"920e05878798d5974149c78993c2b55c3319e6a064771d8c5e5303e579c562f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/components/CreateTradeConfigurationScopeModal.tsx","sha256":"1579138bcb5ffc81523a6f81b0adf80aaf34099c2e0e78d4d8e556c757a59d40","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/components/DeleteTradeConfigurationScopeConfirmModal.tsx","sha256":"f6c4a3cc441b9b7a4a9857b6667a4b8115db04f6bb27ac12c56c44db21e95e54","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/hooks/useTradeConfigurationScope.ts","sha256":"a9becb8ff9fa62f8239f34981cf6651d6d0e66d8c489f36cd06a182fd15e0592","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/configuration-scope/page.tsx","sha256":"1b28ec4970e8df5a7198fdf8f4bcb7070f7eaf683e24a964b01899fbf756acff","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/general/page.tsx","sha256":"3831d8bf070208f4e5a2fc7f95fee84390bb6803a01dce5b917d96bd30b73cf7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/history/page.tsx","sha256":"a4dd7ffb69711f5ad72cbe057712f659a70b5420baf1118cc1db12d843a5d91c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/layout.tsx","sha256":"9e17b9ec9751692f8615e536d96b1f3f7320a45bc57df33fa70c6d544c012df7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/[id]/settings/page.tsx","sha256":"ef97ef584bf01f74c7d7071f196e4446923cb7acd26f4fa73b2a06d8f37b8b7f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/components/CreateTradeControlTowerModal.tsx","sha256":"98a45fc05eedebd56b7dd8a4678533e4aa128f71b319e0f40d00a2a9372be377","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/components/DeleteTradeControlTowerConfirmModal.tsx","sha256":"6ab6443d79e1ede98d78af975393bbf49d86e730add41be6cb18a2ddcb0ba463","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/hooks/useTradeControlTower.ts","sha256":"c479624856487f5a66e31b7ff989f3aedb82b58708e7542d77cdadb26d834f5d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/control-tower/page.tsx","sha256":"caf81f1aafedb8d31e7b4097c2ab110a50cedb33deab0fc2ef14998e31533d6d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/general/page.tsx","sha256":"957b7d31799a784a6bdf8bab454a1c44cfdf2f4fbda973000fe9c66e28dad3d2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/history/page.tsx","sha256":"d687f351aa913cd8d16813c7c2acef2e3482dafdf05550663d9f8ecb26454402","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/layout.tsx","sha256":"dfab6e8022883fa67d26e8e46762c86f7fb9d6583e580fc97e5679f41c8e4b53","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/[id]/settings/page.tsx","sha256":"955a0af9c7ccc1ae78ea6a2db6f1e8e8bbf25ba122192547e0b888d912e01642","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/components/CreateTradeDashboardBuilderModal.tsx","sha256":"c4cf109f65f3dd0211ed1845fdbdc4a3d1ef116670f7fd668cd0f5a422a1e12d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/components/DeleteTradeDashboardBuilderConfirmModal.tsx","sha256":"e94a69e2fa950e55aedbdbeb47cd20c461950ce627d22c248be26d4d12e0f709","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/hooks/useTradeDashboardBuilder.ts","sha256":"67265b0891de532921b64d4b7196cba21ab4e3c1e1747d92e963cb68d8f3c336","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-builder/page.tsx","sha256":"5ff532ed3538bbcce3887443a9334145b96def2afc8177ca3132fac144052b4a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/general/page.tsx","sha256":"287874a6c4dd4611824f03041d1990d19e3e60a7455d2f6c88631351079a715e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/history/page.tsx","sha256":"48f55d3456a6ea393df8270d7d5116dd2bdf6e0a8bf73958c1dfe89d517942d9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/layout.tsx","sha256":"8a7087596152f1a3a46d7823ebb57e9985ceb1d0b010ecabf2e6bf03da46a032","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/[id]/settings/page.tsx","sha256":"a4f4b0d160d33d4eee247a71faf9e5e48a5d2279a9ba5caba8550ea94049c4fb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/components/CreateTradeDashboardWidgetsModal.tsx","sha256":"0e3c69b3b0ff317a8c66895d610514d9dc1641a1f418aa14b6ac04642006b0db","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/components/DeleteTradeDashboardWidgetsConfirmModal.tsx","sha256":"7ab17ce302bf54b27f8ad49fd1ea0aa29332cc6fce68a5c6e688cbde9a91be76","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/hooks/useTradeDashboardWidgets.ts","sha256":"a30d49f7413ab7d2fea4db79ca782d2cdf08ac4e6df3b15dd13eca01d79b27a1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/dashboard-widgets/page.tsx","sha256":"6d40bf6e70e3b8c41d1f007272137ef4cdc802ec0f7d1c87b106da7a55c9f760","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/general/page.tsx","sha256":"8746440f432b95a18908ab74c23677c14adf911de2491f1c9a8645e2e69c1066","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/history/page.tsx","sha256":"0b95cfba60fe0a74df5008d1b12698c577d671856e2cce003b32a5bc5814e3f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/layout.tsx","sha256":"7af167f20acaac014b756773b279df03d796215ac6dfa9d846da6bcdf99d1464","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/[id]/settings/page.tsx","sha256":"b4afed020e843fd7aac1b91b77a775118d0cd79927722e0030d3ce84958ca0c7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/components/CreateTradeDocumentProfileModal.tsx","sha256":"cc1be2143504ca12c63f3a6cd3cecf1ebb40a34165089c6e7db04181bb9c5c52","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/components/DeleteTradeDocumentProfileConfirmModal.tsx","sha256":"e740a5a999aa86b147e3303946b7d4783e63b5cd0fa0c1352de7d0786dee9786","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/hooks/useTradeDocumentProfile.ts","sha256":"043e658ea7f59b71107c7c476fe6a6fdbb91fb6bcbd7e7f1f432012d6a4efad3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/document-profile-platform/page.tsx","sha256":"3f577061f3dd6508724af7821482615edf5e863ad446f896c929f6df81c5c396","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/general/page.tsx","sha256":"7376c96f3c3ca52afa4341a52b7e8458b6a53cad42bcc1d33a40691d483f0b8e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/history/page.tsx","sha256":"356c95553d6e240b2b9ee6160aa7a93d66dbed23d885c2329f5b198b9b460fbc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/layout.tsx","sha256":"db8759647324f4f06651ae69e1742352177c746b689994cd6a3a84d56d587fae","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/[id]/settings/page.tsx","sha256":"7bdec7ee9477cff0f104f07fb34202b648b865eab867ebca1942b8393f27e11a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/components/CreateTradeExtensionProfilesModal.tsx","sha256":"8bbf701e50e3134429f95be7088e81d65f8b377d79941ed13379fa7268acae83","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/components/DeleteTradeExtensionProfilesConfirmModal.tsx","sha256":"29e33ac4a1800fe82dfabf40b6b90d61505caaa47c6ae7447c46c2056e5a6ce8","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/hooks/useTradeExtensionProfiles.ts","sha256":"ffaf4fe64dcf68d9877f3c4db0e1a26370dc214faa7c41c96fb7cf014728a66c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/extension-profiles/page.tsx","sha256":"3ea325ae88337f80ef7fa6ff0d6395572b4ecd7f2e793670eabf2c5e1a5fc433","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/general/page.tsx","sha256":"4891977632a2271660baaf6ad6d5e0a3d149d540f387bc2b42857d40a95bb233","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/history/page.tsx","sha256":"4bd13f5e549c8ce119ee8a24dc17ab78b8b82ef8de98c6eea6f92506d6df594e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/layout.tsx","sha256":"5b82be98f35b8a6ff2c74af2744a2b31c6d54b25d3aa10ba5fdd764fb7595811","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/[id]/settings/page.tsx","sha256":"04c89481eae04d39ca9050c64e817a13f8b2125438c3705cddf10e10c879096e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/components/CreateTradeImportsWebhooksModal.tsx","sha256":"ec80ec3844f3939d0be387dd3a67b0fa1a6766d0c416d6de28701d536e05fe42","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/components/DeleteTradeImportsWebhooksConfirmModal.tsx","sha256":"a4d86e0e1ef0e4229ff4f8228b08dffcb38e2fc556bae50ac93ab79453d45306","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/hooks/useTradeImportsWebhooks.ts","sha256":"06f9fb744d275a4f6d564e313989bd1d2b6352e6f88c57667ca3da3d881f90ad","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/imports-webhooks/page.tsx","sha256":"82fe2a2b4bf31786814fbc4216a810faca80b389fb9a78e220c1aae70ffe395a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/general/page.tsx","sha256":"6b3c0bf60993133ac8d8b48833838fafc4b1ca87bba44d90c27a33e2d1386029","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/history/page.tsx","sha256":"b0f7174be6cf1f4e1eced11c9ae66b948e6942be62789ed45483ffa0c3af268f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/layout.tsx","sha256":"8214f399fe22a808093b7eb676e1e6947894ef29a44084dcd3fe6f45134a0672","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/[id]/settings/page.tsx","sha256":"2b65b5364df63fc7e46f112c10d600962406112c9a5653d0bce351cc8e073f6c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/components/CreateTradeInventoryModal.tsx","sha256":"a32966501e3da5427c32c7e621f11fb75a300075968b67a0d512deb6a6feb918","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/components/DeleteTradeInventoryConfirmModal.tsx","sha256":"755fc56ff200c25b85beb1f1fb1e8a6ebe271fbc6fdee73bf7ab323653586bba","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/hooks/useTradeInventory.ts","sha256":"b383744fd519bb3039361fc414efd6226661f92fe3bf513a14a6e4140ce56d20","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/inventory/page.tsx","sha256":"b476e938d6286e15c4086fecc50f6689e790063c2623161e5f95836920d652fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/general/page.tsx","sha256":"e3b2fd35ae7ad0bac710790bc1d97014b9b9a17e4b34e1377a07086786290469","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/history/page.tsx","sha256":"d65a7bdde1cc31d71da972dc0f19b1372abe25a98f476d138589487e60954677","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/layout.tsx","sha256":"24832634ddec62e62c910380527dad1eff5ed61f7d6b96b949b46daf305bb2f3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/[id]/settings/page.tsx","sha256":"5255e93a1ec52c35841a6d959ffd73f4491d6fc666fb0c68c249773daf87c5fc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/components/CreateTradeInvoicesContractsModal.tsx","sha256":"fe70ae530dc9a460628a37682ab12e4a00352fc41ea5f4a24a082b47c0f4b0d3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/components/DeleteTradeInvoicesContractsConfirmModal.tsx","sha256":"2510bcea305d51adbd2ad69146a7a7890a8970070973bfa5512661e41ec5e591","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/hooks/useTradeInvoicesContracts.ts","sha256":"e31f21bb2def50ba6fd4c53c18e9dad6c4d209fd736ddc8aca0d856186ec09c3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/invoices-contracts/page.tsx","sha256":"67507c12cc3038784cbe82dec16ea484bb34c7823226d0a7672a9217342d1c92","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/layout.tsx","sha256":"f2fc230ae1939424a0e7dd75c0696c1639873bc0bb4b30c8626e9aa2096a4635","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/page.tsx","sha256":"a9e5f6ed37a4430933c85365c3bd70e5eae1b475a2b4a3a9a7403888e339eafd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/general/page.tsx","sha256":"c54e09d2adf584487229b5d1d3126bdcbee44f32c332d23bd8d547cdc046b577","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/history/page.tsx","sha256":"a56c8a57a6b09b9abda30528c5b93ae77f012c05a6b12a20836b9bef1dc99094","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/layout.tsx","sha256":"096a589891d5e63b8e492c9022060cd763921a39dffec22cb5da5e2fb71e72be","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/[id]/settings/page.tsx","sha256":"a82ebd1654691c30043655079155a92836c789ae8bc8e6f4dd7004888f26980d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/components/CreateTradePolicyStudioModal.tsx","sha256":"9a2ab59eed672223abd582cf938257b4d4b251a345facd894ddc00d451102287","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/components/DeleteTradePolicyStudioConfirmModal.tsx","sha256":"067c9f109e20945a1d701a77f4355c2de8be380996eafd754ae7adda6e134e98","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/hooks/useTradePolicyStudio.ts","sha256":"5ac2135ec9d12b990145e6b59441e974303516afb7d5eb11f0855dadcc3770b1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/policy-studio/page.tsx","sha256":"a9bb3b59cf603a00ede9e867fbafece426e748261dc4521d06135a88d7a49ef4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/general/page.tsx","sha256":"ef808acb252deee2af984019e5bc69dc1bb9dad17ddca89ff0d9e3bb152aefa6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/history/page.tsx","sha256":"8c71b0272ebddb0d30ae8acc2ddc8d948412f5cfaeed841790a68a1e3a6b19f4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/layout.tsx","sha256":"2d96e651f3ec08b11c1c0e49608af92c73515f01b1c1486a60afe78948597e60","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/[id]/settings/page.tsx","sha256":"6363b77281d2a7b9f533e7c2213386239e49b612712f6f0480c0d1a69f86e3b0","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/components/CreateTradePricingPriceBooksModal.tsx","sha256":"c91694fbe60ff5700a4f407aed3bbe3599f22c1a8b3590c7322de786a8e47c1a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/components/DeleteTradePricingPriceBooksConfirmModal.tsx","sha256":"3c75fa6e8072efe1175ca99dfe66994a7c5dbac423769fd94184f130f96e85f6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/hooks/useTradePricingPriceBooks.ts","sha256":"df081e0e83ff30e484cf6e4e160638e85bf0359881e8e71a8ef138afbfe1331a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/pricing-price-books/page.tsx","sha256":"688e09497859562352675b7ee406f9c059810c20ca2ba8f80833620c323859de","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/general/page.tsx","sha256":"999016226c3c77e14bc6d8eddeb1bc37f5bf80f3267cae6b563a3c5ca0a44863","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/history/page.tsx","sha256":"9b38f52a04743fd30f4a507975873a3a1d6d01175d1442e117b21e80e988e181","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/layout.tsx","sha256":"4742f8b8dc20bb7ac7d4dc2d1b8a4fb1bc32b1e6848ee70a5e89ecfb7a1965ad","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/[id]/settings/page.tsx","sha256":"b2f56cc694c0fdd75cb707cbf504e38c0ab19f34e576fd17bc155b5c38ceb5fa","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/components/CreateTradePurchaseOrdersModal.tsx","sha256":"a2a80986619bac5ac7363daf2287ab07cc28fb1cc0db82bfc5d34bded152761a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/components/DeleteTradePurchaseOrdersConfirmModal.tsx","sha256":"84995f696a417fc697e317520944dd02b5054828c192644b371f30f5e4ed923c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/hooks/useTradePurchaseOrders.ts","sha256":"81dc01850c6bc6fbb19109050d662524b0c8a7d45a8549fddbfd8b73993da3a7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-orders/page.tsx","sha256":"5df7259896ae7f2f2f7652070020c7633b8032f1f2a321ad025effd6a4789e22","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/general/page.tsx","sha256":"298f58f6f9fe1cef70edec5baf8dbdfb157042a7a790b26d2a51ce62bdb1aeed","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/history/page.tsx","sha256":"5cb17e5a007fefdae984468279a291d0a7f697c2331d5988a14bc5a13ab28ebe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/layout.tsx","sha256":"5ec3ee1f433a6a0b2d57f0758cec1f631363dd7c0e6d3161a65959b6e29b11dd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/[id]/settings/page.tsx","sha256":"255d92c8cf8406a7e67e73465650168129a78aec20059fbe1cbadca989fb6355","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/components/CreateTradePurchaseQuotationsModal.tsx","sha256":"3cfc0fe21e6b607fc216eda725b9533d090cc87b64e97a5fc0e0d225c1787905","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/components/DeleteTradePurchaseQuotationsConfirmModal.tsx","sha256":"0f5c3da7a7c4807b1f895683f754b24d3b69472ff56c0660b2ed67d03d7f8ff7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/hooks/useTradePurchaseQuotations.ts","sha256":"574a9812c880c5fc8788f4ad72209b88e7b3515e01b46bff028628437b7e8b70","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/purchase-quotations/page.tsx","sha256":"76432d23b046a5c0df4c986de53b03d5c6a8d2c9a81aad6d8f2fe8c1133dcd9e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/general/page.tsx","sha256":"2a8ed75a3409bbfdb0e8883b14e30882f907016b03a7be8d7acb321275c9f126","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/history/page.tsx","sha256":"5acd68a0cd92f9ddff7dc2002b3b01640b19aa134a4a3e74865033c59ea19ee2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/layout.tsx","sha256":"a8f8af0c5c29a530cdc0a035031c5d24cdcc210d5589fd3e455ec24e04616b1a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/[id]/settings/page.tsx","sha256":"7120f76c1e4e365c5535dd9958732c7573eba5644dce7c85f3d05b3c0716ea4b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/components/CreateTradeQuotationsSalesOrdersModal.tsx","sha256":"432263e2d244ecb976164302b3434a9895e50dfa46fc3b41d1f6b9e402ac210f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/components/DeleteTradeQuotationsSalesOrdersConfirmModal.tsx","sha256":"657e97878807834fdb633d881ba86a8d2f52b7b8536454bec72b8d1d4acfca4f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/hooks/useTradeQuotationsSalesOrders.ts","sha256":"9545864a91a55b0342275cdb14bbac1b0cc13163fe5c238c32c046e8826e44c9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/quotations-sales-orders/page.tsx","sha256":"b640d1bc8c192e9be4eec3ccee08bc54c8e6347b46a892add6ef701a60bcd896","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/general/page.tsx","sha256":"403310fe54cecbe00fdc1f3644d8f19ee14002fc532f015ba10b182ed1b252f4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/history/page.tsx","sha256":"e4f0ffb77c58c98d2931f969c1937ade64cf65990e0332f9b4a832bd679d4e7a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/layout.tsx","sha256":"c0c3315145afd054c149cc0779cb4cd497542fe2ec2ec180d5ee6b4978d21729","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/[id]/settings/page.tsx","sha256":"1059ca5e59e4dbdb917a400ac06bb73f93989bdd3adacc06ceac9bc6f6e4c637","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/components/CreateTradeWorkflowVersionsModal.tsx","sha256":"a1e6be0b1214590c600f691671fc0cbadd24f096315df8e564247702beb197d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/components/DeleteTradeWorkflowVersionsConfirmModal.tsx","sha256":"4961c74342a7e25e3a02e6bf6bfb3b727fc2b78ba0612c5f20d4b6fa4c3f4b35","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/hooks/useTradeWorkflowVersions.ts","sha256":"679e2c368c2945ac4c9b1b32a154e89a62dd44be714365a9a65731428461c616","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/(tenant)/trade/workflow-versions/page.tsx","sha256":"333cab5b05947ffca3455521ec4d73a5f34a9c9a710801dbb66c32a601cb12ff","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/globals.css","sha256":"f81925cfedfe274d13e73af79b5323387f33feafaccf8c48f503ca5c61ffe33f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/layout.tsx","sha256":"2b5fde19e250cf6b2fed7763e963a5b85b51b0cc3a77fa567a7ea9005338a10e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/login/hooks/useLogin.ts","sha256":"bf1e34b1f6be1d542f958bb66fa016cc865f2f213f0acf5be16bb204a550efc3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/login/page.tsx","sha256":"5b81e04216c57b7a46a8cae9064d7897adf1b829d3b43a99c6b7828aa55192de","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/app/page.tsx","sha256":"f41e429de760f6b99d4a7865789d3b4eb0e0d086a66a17786093fb0d713acd13","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/BranchSelectDropdown.tsx","sha256":"558cb03cb202ff96170105ea27139bf114708458056672a7322130f5cbc45f53","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/CoreNavbarLinks.tsx","sha256":"aa4efdb01972c627ab8ee82b161d86717b2f3446c1abd24da716e4e6c1ebad01","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/CrmNavbarLinks.tsx","sha256":"92b3d86a33ebfd4cdeb7ce4214d1d260278019235f8880e96df1efe4d1f6586a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useNavbar.ts","sha256":"397d0f2bd89cf4d81b808891f8d397a3c96ec5356b958e445a7591e6bacc13dc","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useUserDropdown.ts","sha256":"b18d8b61bc6afd83a5265076b8c761a7f771608ae5e273c922cf840536a9c9a2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/hooks/useWebRTCPhone.ts","sha256":"281a836963242bb5146fad6193ade6f9488c33de65a5761021f8c6958942c12e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/IncomingCallPopup.tsx","sha256":"3ce58f600cfbeed8978175620487b39c2e26d13bab8020d76a7e64bb5defa979","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/LanguageToggle.tsx","sha256":"dae08162325d16faeb566bafd7ebe1c88ca862b29359b1d55d392bd901e6baaf","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/Navbar.tsx","sha256":"34dbfcc8e48fc8b104925aeb8df980955c4348c91ce8dca84ede9970ae6320b4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/NotificationsDropdown.tsx","sha256":"bbaf5847f9c4f08db85fc76b83dddeccaa97efc4c0250e814f6495ab4a26e097","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/PipelineSelectDropdown.tsx","sha256":"ea8bb00c3316973a3839901f0d8ebc0551005645e88521ce0438574a0d779803","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/ThemeToggle.tsx","sha256":"46a2c1e2dea86657f6d9f082130b4c9f0db34c774d28a71e6bfeb97d636c2be4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/TradeNavbarLinks.tsx","sha256":"37bf097030cd380e2ad2db75727cedeb1afa41293445840d605fa57ef12461ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/UserDropdown.tsx","sha256":"a8e22f623a6650d3d82a617055fd5023f4179f78887eb526f670e97240588fc3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/webphone/api.ts","sha256":"01e2342a4fa0c28826773f1badbd3c4539f0314ed7d33c307e258179b81e92c4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/WebPhoneTrigger.tsx","sha256":"46ccd2dd7d8e7d60b898adcf3e4c4ce77de71902b28d9f12e9983a61798f7851","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/layout/WebRTCPhoneWidget.tsx","sha256":"c14954227d32af9ed8a65b82143d5c29f30c55b3a2be9d6a694b32a65494f896","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/shared/CountrySelect.tsx","sha256":"54cef40776c96e788573094b2332f4ea8a46b35f93cd6a6ca13a1d8b905168c5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Badge.tsx","sha256":"ccba36edbb3f0859c51df1bb7eb591dfcff977bbceb38804e616c09716f4d9ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Button.tsx","sha256":"0659ce813c1c4815a13b2ca67bd50ddd98f0bc1317ae7eee0345245904fff555","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/ConfirmModal.tsx","sha256":"fb1d9654f5f5cc251f80336bce75b5829472966ff26337913b97e99fde646769","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/DetailTabsLayout.tsx","sha256":"b1418ce67bd00d4e45b8aaf4813e45650d1c660d771490db7563da02fab18ef4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Input.tsx","sha256":"85ef8f129d447b636ec94344235ba351e28c63533dbe13e0c6898025c364a3b4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Modal.tsx","sha256":"1fe91605081d494f216cfdefb01acef6cdbaf0fa805ef77458a09c26d18b245b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/PageHeader.tsx","sha256":"d9b9c1dc46c5fe5eacb9c713536d55f301b04346948e01ba9c0cf4ec3f1d715b","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Select.tsx","sha256":"c3cb528068400c65faa6a1da37d06f099895b707d5b00c767570da71a0849a4e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/Table.tsx","sha256":"4b0b7aacb97ff9cce11965b0fa7b67cefcece8a57b5982995495bbcd96c1f5e6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/TableToolbar.tsx","sha256":"a4bb48d6b7cec305feea9086d8c4039a89249da86ae8d64e436a634510080172","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/components/ui/ToastContext.tsx","sha256":"6c4e1f3172084d1c19fb5af07875ff4a6b6f62889429cc2bf1a4d8b2ed843a1d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/api/dashboard-api.ts","sha256":"5fea1ef3b393886933ae624f6610c83af2270554f0b8df967bd720ecd691a520","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-navbar.tsx","sha256":"824ec082da15928b4a779d85e26bee420406b3ea412e155a5781f3fef0f27f26","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-toolbar.tsx","sha256":"eede6534abf647e051f1b88386998549d85dd207d4e726bd8e64c7d89537a3e7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/crm-dashboard-workspace.tsx","sha256":"aa0957985b285cd5b2b0a4cd508df451139cdfe049e4ffcaa835c9688b890b54","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-drilldown-panel.tsx","sha256":"c6f36fcd36f1fb66914d1920fe7b3382b4fcd3503e41231dfaff51a58169eda4","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-filters.tsx","sha256":"a46f0f8d4527b19c9587cea25bea4f110be2d68179a1575440efd595ce0b773a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-form-dialog.tsx","sha256":"3a6cd6070992b9df9eec2a515358349c875f7a7b5d5d1d0dec96077815de9e95","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-grid.tsx","sha256":"42cbdcd91800a074ba1567c3f9d8dd68d4e719eb0ab2c041a9b800b82a86ae8f","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-header.tsx","sha256":"3ebe8097313dca297aa61f4458b28537526400d3e60ca6e44b1ea1dd7bbf4fce","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-share-dialog.tsx","sha256":"6bb4367107e38b31263c511b2d54cf9dfba45bcaf961fd02424cbbf9ddc793c3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-sidebar.tsx","sha256":"3f99dde7e03c0ae6e001e257637335ba25c073d89f178dbe55a1a8f4df2476b2","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-view.tsx","sha256":"b10bddbb1887bd8bed3cd258c0ac4fc1d40b7555f7e139a87e2878bdb1ca5696","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/dashboard-widget-renderer.tsx","sha256":"76023e1809dbc965a9cb64895b529361e9da4516ba9d685cf13d4ae474399702","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts-adapter.tsx","sha256":"a60f1c1d82fc6b9428ab953ded9c9cf2898853bf53a6674891f2c8b47dba6619","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts-options.ts","sha256":"9192787edea22e942943d59bb248da20a7325acdd527aabac113790438f625d3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/dashboard-echarts.module.css","sha256":"b08013851138e8b097a79d2d448cf8680d6783552f012fcace070523cf318bdb","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/LeaderboardRenderer.tsx","sha256":"38130dc51989a5cf6e1d6033ae63a6f68eedfc0d56a25dd5ff4408bdd1698d9a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/MetricCardRenderer.tsx","sha256":"bd4857e31896fea60b238edeb165c99504787a1d2a2220a0c79cda3fda4082e1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/ProgressCardRenderer.tsx","sha256":"b4750c37d3d4c4cdecd03c6129be52a3d3cfd42ecdb36afc1fdf0c5f9aff5bfd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/renderers/TableRenderer.tsx","sha256":"27e161a0ec9556df63e0534e5a684072af5ea5f5d8db2de24c359a924602dc35","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-builder-dialog.tsx","sha256":"ca9924a7b93aeba34a2f4c10c9d01beee5dcc27261f6aeb5125931903384b8d7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-delete-dialog.tsx","sha256":"dc7de4170e57013c3640844b0e756af7204a05aa2ea511ce63cf99a79eef7014","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/widget-duplicate-dialog.tsx","sha256":"0165c9302a4ab3fa6abb0d7884458d9da75434273e2364f157f480016a4b56d3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/WidgetEmpty.tsx","sha256":"4a9d5aaa3f380db9b52fde399158a9cb3076a8ac557996c155dec22f5d6b5ded","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/components/WidgetSkeleton.tsx","sha256":"827315d80f51fc09213472735145a50f22d3875ee6897aed8e35c89c1babb572","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/data/mega-demo-dashboard.ts","sha256":"f5bf0d07c69b4b7f203267ad5458bf82b062c8185c24804716edd97e14419608","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/hooks/useCrmDashboardWorkspace.ts","sha256":"b160bf7283eec8e6f0eee0b77676600eaad3149e81abaf911e88c38ee4ae29c6","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-model.ts","sha256":"bf4988c91a2856a3af13ad61aeceefb3d0d0c0dd162b18dc322a176cda6c8d86","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-safe-href.ts","sha256":"1396e5174baf52ddf6611252106f1ddfdb6a41432adcaa1275b7019f1c04fae7","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-types.ts","sha256":"1e3b50c79bfbff08fc5aaf944ff561be0d0913e196fa383585e5e8314b97e22d","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/dashboard-utils.ts","sha256":"900b3bd92834cd6bd7148b1aa53e2bf7b350363758e8a27e357de8d1653ead2c","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/models/useDashboardStore.ts","sha256":"7654d2ca87ec132855f370df34946463a4341c3f4104a85fd8de02cd422ce906","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/utils/cross-filtering.ts","sha256":"ab65a2dd188d29161ddde8b4bdfd50ca8492836fe84c3df43e82d1705b14088a","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/dashboards/utils/export-utils.ts","sha256":"70303a340cbfa6fd7ce89c07532c4d709640c5d53558c3732d4aee1006bf9ebd","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/board/board-column.tsx","sha256":"62ceb761a0c21cc3549bad5cf5aff8d67ea106e796d38fd828cd610251b7b256","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/board/opportunity-card.tsx","sha256":"7b90895e9e9e86ff3e9427ba831cf61c5657f570a7bd77a8d3aabd5d45c75180","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/cards/opportunity-detail-card.tsx","sha256":"ff71d8b74b00f934aab873faa6b4249d674febe937e22e7ae206074c4fc3a992","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/pipeline-workspace.tsx","sha256":"cfcdc00ca9da52cad9369f7ae9cef19718113b0997eef5eb5a746b3936f344b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/communication-confirm-modal.tsx","sha256":"a4d9911d5f01aaa9e3deb2378569998d6932af0a9a766efe6ec68c343a7cbc33","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/opportunity-activities-modal.tsx","sha256":"bb35be62a9ffcbaf0f0f1d91cfa51252ca3640f9067effbf9a1b447564e88d03","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/opportunity-importance-stars.tsx","sha256":"fbb76ae7e9122c40de827048765abc88c0bbecfa2f72ae3a02214adaa1d8ff65","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/pipeline-multi-search.tsx","sha256":"0d4f6ce8ba28c1a7dc19c6a26c76d7ad82406e315c18a457574900c1084e5767","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/shared/terminal-move-modal.tsx","sha256":"514d0cebf8788ad7447d5e8f8da8fb7a93a803f8d6e8f7bc2e1a9151c651dced","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-board-view.tsx","sha256":"2c1a507f6c0d83df43e299adf4275390c999aa33943596349db8029ebb5ff2c3","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-cards-view.tsx","sha256":"7462410d918eb2333804cadc86711bb84e7f8b8fd3a832a15a2a0f74005d0f75","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/components/views/pipeline-list-view.tsx","sha256":"1dd2d417e0a404af48c4badaae536f57ef92d2a4e35ee414361881272f2dc841","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/data/mock-pipeline-data.ts","sha256":"c351aa1e978e3f8027947fff8bba6aaeda4c08d1b313a5f235df892f9cd4d028","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/hooks/usePipelineWorkspace.ts","sha256":"3b06f3d75e9b0a38e48473b81b99855b8b33fe234a2c4435014d7bc184e22b13","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/features/crm/pipeline/models/pipeline-types.ts","sha256":"2a0f2acec7a104aef6e23dbdcc122d7f6a2367e458a69e1a1bc5f840280eb1e9","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/dictionaries/ar.ts","sha256":"72ad9be29bbe9aceb6ca265eb1d8697b37dac25094427e7f09f9b64647d43719","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/dictionaries/en.ts","sha256":"0e5613f0d9309cee43faa1d5426554a99ab54c541d28962270f71b5c99c2ebbe","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/i18n/I18nContext.tsx","sha256":"5e5979ce7390f679a3a8c8ca4e300c3776756d4fe431a6b54a586177ea19e884","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/src/lib/api/axiosClient.ts","sha256":"e629806456f9fe17602df5f453accdd687724a60b7f75e617bd6fa19ad299316","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/src/lib/utils.ts","sha256":"647f240bb444fad298a5ba852d5eaca476ea86025bd625147941a9b3c75340ac","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/src/shared/api/tenant-api-client.ts","sha256":"56cf58bded696666b8000c707ec07e80db2f70e8495f2b0d54c831f862d0b8ee","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"tenant-portal/tsconfig.json","sha256":"76335b5f91e9dd704eadc392fca84381c7356bcb9c1d59854827b10b9e1c86b5","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P1-0001"]} -->
<!-- FCFILE {"path":"tenant-portal/tsconfig.tsbuildinfo","sha256":"1e7b24024815b527d7a19508d875b840c0293ef0c40d714ed85e4310a0d5bfd1","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[],"previousSha256":"91758ac7081cc4c0fcc135c6f999fe7a2699627e3b6482a9ae6428bdf43acfdf"} -->
<!-- FCFILE {"path":"tenant-portal/typecheck_errors.txt","sha256":"a04d472c6e83454849252be61fb8fec5a65b2f0d02c8a101038c84c50ceb352e","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FCFILE {"path":"trade-app.lnk","sha256":"ec1bd94fff8f222f38cdbb2579f24efd70c5c42bb2353ed84084956de9baae10","mode":"metadata","state":"METADATA_AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":[]} -->
<!-- FC-COVERAGE-END -->
















