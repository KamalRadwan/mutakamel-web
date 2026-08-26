# Code Simplification — Discovery Report

- Repo: C:\mutakamel.ai\frontend
- Scope: Admin and Tenant browser-session runtime (`admin-portal/src/lib/api/axiosClient.ts`, `tenant-portal/src/lib/api`, `tenant-portal/src/lib/auth`, `tenant-portal/src/context`, and related package manifests/locks) / Excluded: generated route inventories, documentation prose, unrelated UI/application modules, migrations, vendored code, `node_modules`, and `.next`
- Date: 2026-08-26
- Baseline: Admin `npm test`, `tsc --noEmit`, `npm run lint -- --max-warnings=0`, `npm run docs:check`, `npm run build` → pass (165 files / 1,027 tests); Tenant `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`, `pnpm build` → pass (24 files / 162 tests)

## Summary

| Category | Findings | High | Medium | Low |
|---|---:|---:|---:|---:|
| Dead / unused code | 1 | 0 | 0 | 1 |
| Duplication | 0 | 0 | 0 | 0 |
| Needless abstraction | 0 | 0 | 0 | 0 |
| Vulnerabilities (flagged only) | 1 | 1 | 0 | 0 |

## Findings

### F-001: Tenant scheduler exposes an unused `reschedule` operation
- Category: dead-code
- Severity: low
- Location: C:\mutakamel.ai\frontend\tenant-portal\src\lib\auth\sessionRefresh.ts:18 and C:\mutakamel.ai\frontend\tenant-portal\src\lib\auth\sessionRefresh.ts:152
- Evidence: Repo-wide search for `reschedule` found the Tenant declaration and returned property only; no Tenant production, test, config, string, or dynamic-import consumer. Admin has a separate scheduler with real `reschedule` consumers and is not part of this finding.
- Confidence: high — both exact symbol references were checked across Admin and Tenant, including tests.
- Impact: Removes one speculative API member and makes the Tenant scheduler contract describe only its two real operations: wake and stop.
- Recommendation: Delete `reschedule` from `TenantSessionRefreshScheduler` and from the returned object.
- Behavior risk: none — there is no caller.

### F-002: Admin's reproducible npm artifact contains four High advisories
- Category: vulnerability
- Severity: high
- Location: C:\mutakamel.ai\frontend\admin-portal\package.json:19 and C:\mutakamel.ai\frontend\admin-portal\package-lock.json
- Evidence: Read-only `npm audit --omit=dev --json` reports four High findings through Admin's exact Next 16.2.11: NanoID 3.3.16, Next-bundled PostCSS 8.4.31, and Sharp 0.34.5. The audit's non-major remediation is exact Next 16.3.3; registry metadata confirms matching `next@16.3.3` and `eslint-config-next@16.3.3`. Tenant's pnpm production audit is clean because the workspace lock already enforces secure transitive overrides.
- Confidence: high — manifest, npm lock, pnpm lock, installed metadata, audit JSON, and registry metadata were checked independently.
- Impact: A clean, reproducible Admin npm production artifact without changing the already-clean Tenant dependency graph.
- Recommendation: Upgrade only Admin's `next` and `eslint-config-next` from exact 16.2.11 to exact 16.3.3, regenerate the npm/pnpm locks mechanically, and rerun the full Admin gates plus Tenant regression gates.
- Behavior risk: needs-approval — dependency artifacts change even though this is a same-major, non-major audit remediation. The active request explicitly asks for a production-ready fix and authorizes committing and merging the frontend work.

## Fix Plan

Phases ordered lowest-risk first. Each task is tiny and independently verifiable:
one edit, one check. Map every task to its finding ID.

### Phase 1: Delete verified dead contract surface (risk: none)
- [x] T-1.1 Remove the unused Tenant `reschedule` scheduler member — `tenant-portal/src/lib/auth/sessionRefresh.ts` — finding: F-001 — verify: `pnpm --filter tenant-portal test -- src/lib/auth/sessionRefresh.test.ts && pnpm --filter tenant-portal typecheck`

### Phase 2: Apply the authorized security patch (risk: needs-approval)
- [x] T-2.1 Pin Admin Next + ESLint config to exact 16.3.3 and regenerate both authoritative locks — Admin manifest, npm lock, and workspace pnpm lock — finding: F-002 — verify: Admin production audit, test, typecheck, lint, docs, and production build plus Tenant regression gates — APPROVAL REQUIRED (covered by the active production-ready fix and explicit commit/merge request)

## Execution Log

- 2026-08-26 T-1.1 done — removed the zero-consumer Tenant scheduler member; focused test and typecheck passed.
- 2026-08-26 T-2.1 done — upgraded only Admin to exact Next/ESLint config 16.3.3, regenerated both locks, and verified zero production advisories, 165 files / 1,027 tests, typecheck, lint, docs, and a 47-route production build. Tenant remained on its already-clean exact Next 16.2.11 graph and passed 26 files / 181 tests, typecheck, lint, docs, zero production advisories, and a 56-route production build.
