# Frontend Checker Report Contract

`APP_CHECK_RESULT.md` is both a human remediation backlog and a resumable audit state file. Keep it readable, deterministic, diff-friendly, and safe to share with the engineering team.

## Required top-level sections

The report must contain these sections in this order:

1. `# Frontend Application Check Result`
2. `## Executive Summary`
3. `## Repository Profile`
4. `## Scope, Inventory, and Exclusions`
5. `## Tool-Assisted Checks`
6. `## Prioritized Remediation Queue`
7. `## Phase 1 — Duplicate Functions and Repeated Logic`
8. `## Phase 2 — Unused and Dead Code`
9. `## Phase 3 — Lint, Import, Module, and Type Correctness`
10. `## Phase 4 — Clean-Code Refactoring`
11. `## Phase 5 — Security Issues and Vulnerabilities`
12. `## Phase 6 — AI Documentation Health and Rebuild Plan`
13. `## Phase 7 — Documentation-to-Frontend Implementation Gaps`
14. `## Phase 8 — Evidence-Based Improvement Suggestions`
15. `## Limitations and Unverified Areas`
16. `## Exact File Coverage Ledger`

Do not rename the eight phase headings; the validator uses them.

## Audit states

- `NOT STARTED`: inventory exists but review has not begun.
- `IN PROGRESS`: at least one file or phase is pending, stale, blocked, or unverified.
- `COMPLETE WITH FINDINGS`: validator passed and at least one open/accepted-risk finding exists.
- `COMPLETE — NO CONFIRMED FINDINGS`: validator passed and no confirmed findings exist. Use this only after full manual and tool-assisted review.

## Finding statuses

- `OPEN`: confirmed and not yet scheduled or fixed.
- `PLANNED`: accepted into a future remediation plan.
- `IN_PROGRESS`: implementation is underway outside this skill.
- `BLOCKED`: confirmed but cannot proceed until a named dependency is resolved.
- `RESOLVED`: rechecked against current code and no longer present.
- `ACCEPTED_RISK`: intentionally retained with owner/reason when known.
- `FALSE_POSITIVE`: disproved after verification; keep the evidence explaining why.
- `STALE`: source changed and the finding needs revalidation.

Never silently delete a prior confirmed finding. Mark its new status and add revalidation notes.

## Priority, severity, confidence, and effort

### Priority

- `P0`: immediate action; release blocker, active exposure, or severe correctness risk.
- `P1`: next remediation cycle; high user/business/security impact.
- `P2`: planned improvement; meaningful maintainability, quality, or medium-risk issue.
- `P3`: low-risk cleanup, consistency, or optimization.
- `P4`: informational or optional idea.

### Severity

Use severity for impact, not urgency:

- `Critical`: likely catastrophic compromise/data exposure or application-wide failure.
- `High`: serious security/correctness impact with realistic trigger conditions.
- `Medium`: bounded but meaningful impact or maintainability risk.
- `Low`: limited impact, cleanup, or defensive hardening.
- `Info`: observation, suggestion, or documentation opportunity.

### Confidence

- `High`: direct evidence, reproducible diagnostic, or unambiguous control/data flow.
- `Medium`: strong evidence but runtime/dynamic behavior needs confirmation.
- `Low`: plausible concern requiring product, runtime, or external-contract confirmation.

Low-confidence items must not be worded as confirmed vulnerabilities or defects.

### Effort

- `XS`: less than a small isolated change.
- `S`: one focused change with local tests.
- `M`: multiple files or one feature boundary.
- `L`: cross-feature/package refactor or migration.
- `XL`: architectural initiative requiring staged delivery.

## Required finding format

Each confirmed item must use this shape. Keep one blank line between fields for readability.

```markdown
### FC-P5-0001 — Descriptive action-oriented title

- **Status:** OPEN
- **Priority:** P1
- **Severity:** High
- **Confidence:** High
- **Effort:** M
- **Category/Rule:** XSS / unsafe HTML sink
- **Locations:** `src/features/article/ArticleBody.tsx:42-48`, `src/lib/html.ts:10-27`
- **Symbols:** `ArticleBody`, `sanitizeArticleHtml`

**Finding**

Explain exactly what is wrong. Separate observed fact from inference.

**Evidence**

Summarize the smallest sufficient code/data-flow evidence. Do not paste secrets or large copyrighted blocks.

**Why it matters**

Describe user, business, security, correctness, or maintenance impact and realistic trigger conditions.

**Recommended decision**

State the preferred direction and alternatives considered. For duplicate code, explicitly choose reuse/export, helper/hook/component extraction, or intentional separation.

**Remediation plan**

1. Ordered implementation step.
2. Migration or compatibility step.
3. Cleanup step.

**Verification**

List exact tests, lint/type checks, security checks, acceptance criteria, or observable outcomes that prove the issue is fixed.

**Dependencies and notes**

List blockers, related findings, ownership questions, rollout risk, and any product/API decision needed.

<!-- FC-FINGERPRINT: phase=5|rule=xss-unsafe-html|path=src/features/article/ArticleBody.tsx|symbol=ArticleBody -->
```

The validator checks the bold core fields and issue ID format. The explanatory subsections are mandatory even if concise.

## Location policy

1. Use repository-relative paths, forward slashes, and 1-based lines.
2. Prefer precise ranges such as `src/a.ts:12-24`; use a single line when that is the correct scope.
3. For multiple implementations or a doc/code mismatch, cite all relevant locations.
4. For a missing file, use `MISSING: AGENTS.md` or `MISSING: docs/frontend/architecture.md`, then cite the source files proving what the missing document must describe.
5. For repository-wide configuration issues, cite the exact manifest/config lines and representative affected files.
6. For binary assets, use `public/banner.webp (file-level; line N/A)` only when no textual line exists, and include hash/size/reference locations.
7. Never use only a folder, glob, filename without a line, or vague text such as “throughout the app” for a confirmed text-file issue.
8. Line numbers can drift after fixes. File hashes in the coverage ledger determine when findings require revalidation.

## Phase content requirements

Each phase must include:

- phase status and reviewed scope;
- counts by open/resolved/false-positive/accepted-risk;
- a compact finding index table;
- detailed findings using the required schema;
- clean observations that were specifically verified;
- false-positive controls applied;
- phase-specific limitations or blocked evidence;
- ordered remediation sequence and dependencies.

A zero-finding phase must state “No confirmed findings” and list the actual checks performed. Never leave only a placeholder.

## Prioritized remediation queue

The queue is not a duplicate list of every item. It is an execution order grouped into waves:

1. security/correctness release blockers;
2. prerequisite architecture or shared abstractions;
3. safe dead-code removal and lint/type fixes;
4. feature/documentation gaps;
5. quality, performance, accessibility, and developer-experience improvements.

For each queue row include finding IDs, rationale, dependency, suggested owner/area, effort, and verification gate. Do not schedule work that contradicts a higher-priority dependency.

## Coverage marker contract

The exact coverage ledger is stored as one machine-readable HTML comment per file between:

```markdown
<!-- FC-COVERAGE-START -->
<!-- FCFILE {"path":"src/app/page.tsx","sha256":"...","mode":"semantic","state":"AUDITED","phases":[1,2,3,4,5,6,7,8],"issues":["FC-P4-0002"]} -->
<!-- FC-COVERAGE-END -->
```

Valid states:

- `PENDING`: not yet fully reviewed.
- `STALE`: prior review exists but the file hash changed.
- `AUDITED`: full semantic or structured review completed.
- `METADATA_AUDITED`: non-text asset reviewed by metadata, references, hash, exposure, and any available visual/static inspection.

A completed marker must:

- match the current inventory SHA-256;
- use `AUDITED` or `METADATA_AUDITED`;
- contain all phases exactly once: `[1,2,3,4,5,6,7,8]`;
- list every finding ID associated with that file, without duplicates.

Do not remove, wrap, reformat, or manually summarize away these markers. They are the proof that no project-owned file was silently skipped.

### Batch update JSON

`mark-batch` accepts a JSON array like:

```json
[
  {
    "path": "src/app/page.tsx",
    "state": "AUDITED",
    "phases": [1, 2, 3, 4, 5, 6, 7, 8],
    "issues": ["FC-P4-0002"]
  },
  {
    "path": "public/logo.png",
    "state": "METADATA_AUDITED",
    "phases": [1, 2, 3, 4, 5, 6, 7, 8],
    "issues": []
  }
]
```

The helper preserves the inventory hash already stored in the marker. Paths must match inventory paths exactly.

## Existing report merge rules

1. Keep human notes, owners, target dates, and finding statuses.
2. Preserve current findings unless revalidated; do not regenerate IDs merely because ordering changed.
3. When a file hash changes, its coverage becomes `STALE` or `PENDING`; recheck related findings.
4. New findings receive the next available numeric ID within their phase.
5. If the same issue is rediscovered, update the existing finding and fingerprint rather than adding a duplicate.
6. If a path moves, record old and new paths, update the fingerprint deliberately, and retain history.
7. Removed files should be reflected in relevant findings as resolved or changed scope. The synchronized coverage ledger drops files no longer in the current inventory, but the finding history remains.

## Security and privacy rules for the report

- Replace secret values with `[REDACTED]` and report only the variable/key name and location.
- Do not include full JWTs, cookies, API keys, private keys, credentials, personal records, or proprietary datasets.
- Avoid dumping complete command output. Include the actionable diagnostic lines and store no temporary raw logs in the repository.
- For dependency vulnerabilities, report package, installed/resolved version, advisory identifier, affected path, exploit relevance, and upgrade/mitigation direction. Do not copy entire advisory text.
- Distinguish a vulnerable version from an exploitable application path.

## Definition of done

The report is done only when the helper validator succeeds, every phase is substantively completed, all limitations are explicit, and the only persistent change caused by the audit is `APP_CHECK_RESULT.md`.
