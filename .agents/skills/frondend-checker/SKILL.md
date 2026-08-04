---
name: frontend-checker
description: Performs an exhaustive, report-only audit of an entire frontend repository, including monorepo apps and packages, and creates or updates APP_CHECK_RESULT.md with file-and-line evidence for duplicate code, unused code, lint/import/type issues, clean-code refactors, security vulnerabilities, AI documentation health, documentation-to-implementation gaps, and prioritized improvement suggestions. Use for “Frontend Checker”, full frontend health checks, deep Next.js or React audits, or APP_CHECK_RESULT.md reviews. Never modifies application code.
---

# Frontend Checker

## Mission

Audit the complete frontend repository and maintain one resumable report at:

`<repository-root>/APP_CHECK_RESULT.md`

The audit has eight mandatory phases. It finds, verifies, prioritizes, and documents work for later. It does **not** implement fixes.

Default scope includes every project-owned app, package, source file, test, story, style, configuration, script, documentation file, translation, schema, public asset, and committed generated artifact in the repository. It is framework-aware and version-aware; inspect installed versions before applying Next.js, React, TypeScript, ESLint, Vite, Remix, Vue, Svelte, or package-manager rules.

## Non-negotiable operating contract

1. **Report-only:** the only persistent repository write allowed is creating or updating `APP_CHECK_RESULT.md`.
2. Never edit, format, rename, move, delete, generate, or auto-fix application code, tests, configs, documentation, lockfiles, assets, or Git metadata.
3. Never run destructive commands or write-capable fix commands. Prohibited examples include `eslint --fix`, `prettier --write`, codemods, `npm install`, `git clean`, `git reset`, `git checkout --`, and deletion commands.
4. Preserve all pre-existing user changes. Snapshot Git status before the audit and compare it at the end.
5. Never expose secret values. Redact tokens, passwords, private keys, cookies, connection strings, personal data, and `.env` values in the report. Environment-variable names may be reported when necessary.
6. Never silently skip project-owned files. Every inventoried file must receive a final coverage state and all eight phases must be evaluated for it, even when a phase is not applicable.
7. Third-party dependency trees and disposable build output are not project-owned source. Do not semantically review every file in `node_modules`, build caches, or generated output directories. Record every excluded directory, the reason, and the safer substitute check, such as lockfile analysis, dependency audit, or generator review.
8. Do not report a guess as a confirmed issue. Use confidence levels, verify dynamic/framework usage, and label limitations explicitly.
9. All confirmed issues require exact repository-relative file paths and 1-based line numbers or ranges. For a genuinely missing file, use `MISSING: <path>` and cite the implemented source or documentation that proves the expectation.
10. A phase with no confirmed findings must still state what was checked, which tools ran, and why it is considered clean.
11. Do not claim the audit is complete until the supplied validator passes and the Git-diff safety check confirms that only `APP_CHECK_RESULT.md` was added or changed by this skill.

## Resolve paths

- `<REPO_ROOT>`: the top-level Git repository from `git rev-parse --show-toplevel`; otherwise the current workspace root.
- `<SKILL_DIR>`: the directory containing this `SKILL.md`.
- `<REPORT>`: `<REPO_ROOT>/APP_CHECK_RESULT.md`.
- `<TMP_DIR>`: an operating-system temporary directory outside the repository. Delete temporary artifacts at the end when safe.

## Read the supporting guidance

Before auditing, read these files from `<SKILL_DIR>`:

1. `references/report-contract.md`
2. `references/audit-methodology.md`
3. `references/phase-checklists.md`
4. `references/tooling-guide.md`

Use `assets/APP_CHECK_RESULT.template.md` if the helper script is unavailable.

## Mandatory workflow

### 0. Establish repository rules and a no-write baseline

1. Locate `<REPO_ROOT>` and identify all nested workspaces/apps/packages.
2. Read all applicable `AGENTS.md` files from the repository root down to each audited directory, plus other repository instructions that govern review behavior.
3. Read package/workspace manifests, lockfiles, TypeScript configs, lint configs, framework configs, test configs, path aliases, environment examples, and primary README/architecture documents.
4. Detect the package manager from lockfiles and `packageManager` metadata. Do not assume npm.
5. Detect installed framework and tool versions from manifests and lockfiles. Do not assume the latest version.
6. Save the initial `git status --porcelain=v1 -z` output in `<TMP_DIR>` so later checks can distinguish user changes from skill-created changes.
7. Resolve `<SKILL_DIR>` and run:

   `node "<SKILL_DIR>/scripts/frontend-checker.mjs" help`

   If Node is unavailable, follow the manual fallback in `references/tooling-guide.md` and maintain the same report contract.

### 1. Build a deterministic full-repository inventory

Run the inventory helper from any directory:

`node "<SKILL_DIR>/scripts/frontend-checker.mjs" inventory --root "<REPO_ROOT>" --out "<TMP_DIR>/frontend-checker-inventory.json"`

Then initialize or synchronize the report without overwriting existing findings or remediation statuses:

`node "<SKILL_DIR>/scripts/frontend-checker.mjs" sync-report --inventory "<TMP_DIR>/frontend-checker-inventory.json" --report "<REPORT>"`

Review the generated inventory summary, exact-content duplicate groups, file classifications, sensitive-file flags, symlinks, and excluded directories. Add any repository-specific exclusions to the report with reasons; never add an exclusion merely to reduce workload.

### 2. Read every project-owned file and construct cross-file indexes

Process files in deterministic repository-relative path order, normally in batches grouped by workspace and feature. For every project-owned text file:

- Read the **entire file**, in chunks when necessary. Search snippets alone do not count as a deep review.
- Record its purpose, public symbols, imports, exports, callers/consumers, framework role, runtime boundary, documentation links, tests, styles/assets, and relevant environment/config dependencies.
- Use 1-based line-numbered reads for all evidence.
- Build and continuously reconcile these indexes:
  - symbol/export/import/call index;
  - component/hook/context/store index;
  - route/layout/page/middleware/API-handler index;
  - API client, schema, validation, and contract index;
  - feature flag, permission, environment-variable, translation, and asset index;
  - test/story/documentation traceability index;
  - exact and near-duplicate implementation index.

For structured or binary files, apply the audit mode defined in `references/audit-methodology.md`. A binary file is not silently skipped: review its metadata, references, duplicate hash, size, exposure, and security relevance; inspect it visually when an available tool supports that file type and visual meaning matters.

### 3. Run all eight phases in order

Each phase is a repository-wide pass. Every file must be considered for every phase. Use the detailed checklist and false-positive controls in `references/phase-checklists.md`.

1. **Duplicate functions and repeated logic** — choose between reusing/exporting one implementation, extracting a helper/hook/component, or intentionally keeping separate implementations.
2. **Unused and dead code** — identify unused imports, variables, methods, classes, exports, files, routes, assets, styles, dependencies, scripts, flags, translations, and unreachable logic; provide a safe removal/deprecation plan.
3. **Lint, import, module, and type correctness** — capture lint/type diagnostics, unresolved or incorrect imports, missing imports, alias/case problems, server/client boundary violations, stale suppressions, and configuration mistakes.
4. **Clean-code refactoring** — find unclear, coupled, oversized, fragile, duplicated-state, effect-heavy, or difficult-to-test code and propose behavior-preserving refactors.
5. **Security** — identify frontend, Next.js server-surface, dependency, secret-handling, authorization, XSS, injection, redirect, browser-storage, cookie, CSP, upload, WebSocket, logging, caching, and supply-chain risks with severity and remediation.
6. **AI documentation health** — determine whether AI/developer guidance is missing, stale, contradictory, or incomplete. Because this skill is report-only, create a detailed rebuild/update plan and proposed document outline inside the report; do not create those documents.
7. **Documentation-to-frontend implementation gap** — trace local product/API/frontend docs to routes, components, contracts, tests, permissions, validations, and states; document missing, partial, stale, undocumented, or behaviorally mismatched features and a delivery/refactor plan.
8. **Evidence-based improvement suggestions** — propose prioritized architecture, accessibility, performance, testing, observability, design-system, UX-state, internationalization, resiliency, and developer-experience improvements grounded in actual file-and-line evidence.

### 4. Use tools as evidence, never as a substitute for review

Run only already-available, non-fixing tools and existing scripts. Typical evidence sources include local ESLint, TypeScript with `--noEmit`, configured dead-code tools, test discovery, package-manager dependency audits, `git`, and `rg`. Inspect each command before running it and avoid scripts that build, deploy, mutate fixtures, update snapshots, rewrite files, or enter watch mode.

Record in `APP_CHECK_RESULT.md`:

- exact command and working directory;
- tool/version where available;
- exit code;
- concise result summary;
- whether output was complete, truncated, unavailable, or affected by environment/network limits.

Reconcile automated findings manually. Framework entrypoints, dynamic imports, registries, reflection, CSS/translation strings, generated files, and server/client conventions commonly produce false positives.

### 5. Write findings incrementally and preserve history

- Keep the report usable after interruption. Update it after each deterministic batch or completed phase.
- Preserve human-added notes and remediation statuses from existing reports.
- Deduplicate findings using phase, path, symbol, rule/category, and normalized description.
- Revalidate old findings against current file hashes. Mark resolved, stale, false-positive, accepted-risk, or still-open findings rather than silently deleting history.
- Assign stable IDs in the form `FC-P<phase>-<four digits>`, such as `FC-P5-0007`.
- Follow the issue schema, location rules, priorities, confidence, effort, and verification requirements in `references/report-contract.md`.
- Suggestions without concrete evidence belong under limitations or open questions, not as confirmed findings.

### 6. Update exact file coverage

After a file has been fully evaluated against all phases, update its `FCFILE` coverage marker in `APP_CHECK_RESULT.md` to include:

- the current inventory hash;
- state `AUDITED` for semantic/structured text review or `METADATA_AUDITED` for non-text assets;
- phases `[1,2,3,4,5,6,7,8]`;
- all related finding IDs.

For efficient batch updates, create a temporary JSON array and run:

`node "<SKILL_DIR>/scripts/frontend-checker.mjs" mark-batch --report "<REPORT>" --updates "<TMP_DIR>/frontend-checker-coverage-updates.json"`

The update-file format is documented by the command’s `--help` output and in `references/report-contract.md`.

### 7. Validate completion and enforce the write boundary

Run:

`node "<SKILL_DIR>/scripts/frontend-checker.mjs" validate --inventory "<TMP_DIR>/frontend-checker-inventory.json" --report "<REPORT>"`

Then compare final Git status with the saved initial status.

Completion requires all of the following:

- all eight phase headings and required report sections exist;
- every current project-owned file has a current-hash coverage marker;
- every file is fully evaluated for phases 1–8;
- all finding IDs are unique and use the required format;
- all confirmed findings have exact path-and-line evidence or a valid missing-file location;
- all findings contain status, priority, severity, confidence, rationale, remediation steps, and verification;
- excluded directories and limitations are explicit;
- no application file was changed by this skill;
- validator exits successfully.

If any gate fails, keep `Audit state: IN PROGRESS`, document the exact remaining coverage/blocker, and do not use words such as “complete”, “exhaustive”, or “all clear”.

## Optional parallelization for very large repositories

Use parallel/subagents only when the host supports them and only with non-overlapping, inventory-defined file batches. Give every worker the same report schema and phase checklist. Workers return structured findings and coverage updates; the primary agent owns the report, cross-file duplicate analysis, issue deduplication, security severity, documentation traceability, and final validation. Never let independent workers write the report concurrently.

## Default invocation behavior

When invoked as `$frontend-checker` or by the name **Frontend Checker**, run all eight phases across the complete repository and update `APP_CHECK_RESULT.md`. A user may explicitly request a limited phase or directory, but mark the overall report as partial and do not satisfy the full-audit completion gate.
