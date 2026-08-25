# Code Simplification — Discovery Report

- Repo: C:\mutakamel.ai\frontend\partner-portal
- Scope: `src/**`, `package.json`, `next.config.ts`, and `tsconfig.json` / Excluded: `node_modules/**`, `.next/**`, generated/build/cache artifacts, `admin-portal`, `tenant-portal`, `packages/**`, backend code, mobile code, and all lockfile edits during discovery
- Date: 2026-08-24; fix evidence updated 2026-08-25
- Baseline: `pnpm exec tsc --noEmit` → pass; `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → pass; `pnpm run lint` → pass; `pnpm audit --prod --audit-level high` → pass; no test script is defined. Pre-fix `pnpm run build` → fail because Next.js 16 Turbopack rejects the copied custom webpack configuration when no Turbopack configuration exists (`Call retries were exceeded`).

## Summary

| Category | Findings | High | Medium | Low |
|---|---|---|---|---|
| Dead / unused code | 1 | 0 | 1 | 0 |
| Duplication | 1 | 0 | 1 | 0 |
| Needless abstraction | 1 | 0 | 1 | 0 |
| Vulnerabilities (flagged only) | 0 | 0 | 0 | 0 |

## Findings

### F-001: Production builds bypass a currently green TypeScript gate
- Status: Fixed — the bypass is removed and the manifest now exposes the explicit green `typecheck` gate.
- Category: needless-abstraction
- Severity: medium
- Location: `next.config.ts:7-9`
- Evidence: `typescript.ignoreBuildErrors` is enabled with a development-memory comment. The installed Next.js 16.2.11 guide states that this option completely skips production-build type checking and defaults to `false`. Both normal and no-unused strict compiler baselines pass, so the bypass does not currently unblock any code.
- Confidence: high — framework semantics were checked in the installed documentation and the portal compiles cleanly.
- Impact: Restore a production correctness gate with no runtime code change.
- Recommendation: Remove the override (or set it to `false`) and keep explicit typecheck in CI/build validation.
- Behavior risk: none — only invalid future builds will stop succeeding.

### F-002: Copied Next configuration targets packages the placeholder does not use and blocks production build
- Status: Fixed — the copied configuration is gone and the truthful static placeholder builds under the default Next.js 16 toolchain.
- Category: dead-code
- Severity: medium
- Location: `next.config.ts:4-17`; supporting inventory `src/app/layout.tsx:1-19`, `src/app/page.tsx:1-7`, `src/app/globals.css:1`
- Evidence: The complete source tree is three files and 25 nonblank lines with no feature, API, provider, or third-party imports. `optimizePackageImports` lists `lucide-react`, `date-fns`, and `recharts`, but none is declared in `package.json` or referenced anywhere else in the portal. The custom webpack watch options add no portal-specific behavior and duplicate default dev-tool concerns. On Next.js 16.2.11, the override is also a release blocker: the default Turbopack build refuses the custom webpack-only configuration and exits with `Call retries were exceeded`. This is a copied create-next-app placeholder, not an implemented Partner application; simplification can remove configuration noise but cannot supply the missing product contract.
- Confidence: high — every source/config import and manifest dependency was inventoried; there is no dynamic import or registry.
- Impact: Restore the production build, reduce `next.config.ts` to the actual application needs, and make the placeholder status unmistakable.
- Recommendation: Remove the unused experimental package list and watch override, leaving an empty typed config until a verified Partner requirement needs configuration.
- Behavior risk: low — verify dev reload and production build once; no listed package can be optimized because it is absent.

### F-003: npm and pnpm lockfiles defined Partner dependencies twice
- Status: Fixed — the clean app-local npm lock was removed; the existing root pnpm lock remains the only dependency snapshot and was not rewritten.
- Category: duplication
- Severity: medium
- Location: `package-lock.json:1`; `../pnpm-lock.yaml:1`; `../pnpm-workspace.yaml:1`
- Evidence: Before fix mode both lockfiles were tracked. `package-lock.json` was npm lockfile v3 for `partner-portal`, while the root pnpm lock already contained a `partner-portal` workspace importer. The root workspace is pnpm-based. The generic scaffold README advertised npm, yarn, pnpm, and bun before fix mode; the README now names pnpm as the workspace owner and the duplicate local npm snapshot is removed.
- Confidence: high — Git tracking, lockfile metadata, workspace importers, and documentation were checked directly.
- Impact: Prevent resolution drift and remove a 233 KB duplicate dependency snapshot.
- Recommendation: Completed; keep the root pnpm lock as the sole dependency truth.
- Behavior risk: low — review the regenerated root lock in case the two graphs have diverged.

## Product boundary / blocker

- The authoritative Core LLD classifies Partner Portal as **Future Scope**, explicitly “not committed” and without a delivery timeline. Its endpoint table is a design target, not a live contract.
- Read-only contract verification found no `core-app/src/partner` module and no implemented Partner controller/auth routes. API Gateway contains generic Partner path ownership/legacy lookup support, but no endpoint-specific upstream implementation exists for this portal to consume.
- The frontend contains no auth/session client, API client, route model, data flow, state, or feature component. Its bilingual static `/` page truthfully states that Partner sign-in, services, and APIs are unavailable; it exposes no fake action and performs no network, cookie, storage, secret, or authorization work. Metadata is branded and `noindex`/`nofollow` prevents the future-scope placeholder from being presented as a released product.
- Therefore this repository can be a buildable, low-surface static placeholder, but it cannot honestly become a functional production Partner product until an approved release slice supplies canonical Gateway paths, browser session/cookie rules, DTO/error envelopes, RBAC/scoping rules, bilingual UX acceptance criteria, and release acceptance tests. Tenant Portal behavior must not be copied as a substitute.

## Fix Plan

Phases ordered lowest-risk first. Each task is tiny and independently verifiable:
one edit, one check. Map every task to its finding ID.

### Phase 1: Delete verified dead configuration (risk: none/low)
- [x] T-1.1 Remove the unused `optimizePackageImports` list — `next.config.ts` — finding: F-002 — verify: `pnpm exec tsc --noEmit && pnpm run lint`
- [x] T-1.2 Remove the generic webpack watch override — `next.config.ts` — finding: F-002 — verify: `pnpm run dev` smoke check and `pnpm run build`

### Phase 2: Remove duplicate dependency truth (risk: low)
- [x] T-2.1a Replace generic multi-package-manager instructions with the pnpm workspace owner, fixed port, and explicit placeholder boundary — `README.md` — finding: F-003 — verify: full Partner gates
- [x] T-2.1b Remove only the clean Partner npm lock without rewriting the already-current root pnpm lock — `package-lock.json` — finding: F-003 — verify: frozen offline pnpm install

### Phase 3: Collapse needless production configuration (risk: low)
- [x] T-3.1 Remove `typescript.ignoreBuildErrors` and require the green typecheck in build/CI — `next.config.ts` — finding: F-001 — verify: `pnpm exec tsc --noEmit && pnpm run build`

### Phase 4: Make the remaining boundary truthful (risk: low)
- [x] T-4.1 Replace the create-next-app `Hello world` surface with a branded bilingual, accessible, static future-scope page; add truthful metadata, `noindex`, and an explicit `typecheck` script — `src/app/layout.tsx`, `src/app/page.tsx`, `package.json` — verify: strict typecheck, lint, build, and production audit

## Execution Log

- 2026-08-25 T-1.1 done — removed three undeclared, unreferenced package hints; `pnpm exec tsc --noEmit` and `pnpm run lint` passed.
- 2026-08-25 T-1.2 done — removed the webpack watch override; `pnpm run build` passed under Turbopack and a fixed-port `pnpm run dev` smoke returned HTTP 200 on port 5003.
- 2026-08-25 T-2.1a done — README now documents pnpm ownership, port 5003, and the non-functional product boundary without inventing UI/API behavior.
- 2026-08-25 T-2.1b done — removed only the clean duplicate npm lock; the already-dirty shared `pnpm-lock.yaml` was not modified, and the existing pnpm workspace importer was validated with a frozen offline install.
- 2026-08-25 T-3.1 done — removed the type bypass; the final build log reports `Running TypeScript` and completes successfully.
- 2026-08-25 T-4.1 done — replaced `Hello world` with a responsive Arabic/English Server Component that states the current product boundary and exposes no auth/API/action façade; branded metadata and `noindex` are set. Strict TypeScript, the manifest typecheck, lint, static production build, audit, and diff check pass.

## Final verification (2026-08-25)

- `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → pass
- `pnpm run lint` → pass
- `pnpm run build` → pass; `/` and `/_not-found` prerender statically
- `pnpm run dev` on the required port 5003 + `GET /` → HTTP 200; process stopped and port released
- `pnpm audit --prod --audit-level high` → pass, `No known vulnerabilities found`
- Tests → not run because `package.json` defines no test script and the placeholder has no test framework
- `package.json` → only the explicit `typecheck` script was added in the final placeholder pass; `../pnpm-lock.yaml` remains untouched and the duplicate app-local `package-lock.json` is removed
