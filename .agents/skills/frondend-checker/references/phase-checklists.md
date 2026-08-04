# Frontend Checker Phase Checklists

Apply every phase to the whole inventory. These are investigation prompts, not a license to report unverified style preferences as defects.

## Phase 1 — Duplicate Functions and Repeated Logic

### Detect

Check exact and semantic duplication across all apps/packages, not only functions with the same name:

- function declarations, arrow functions, class/static methods, callbacks, and factory functions;
- React components, custom hooks, contexts/providers, reducers, selectors, stores, actions, and effects;
- API request wrappers, query/mutation keys, serializers, mappers, adapters, normalizers, pagination, retry, and error mapping;
- form schemas, validation rules, permission checks, route guards, feature-flag logic, and data transformations;
- type/interface/enum definitions that represent the same contract;
- constants, lookup maps, date/number/currency formatting, storage helpers, URL/query builders, and analytics payloads;
- repeated JSX/templating blocks, table/column definitions, modal/form scaffolding, loading/empty/error states, and accessibility behavior;
- repeated CSS declarations, design tokens, responsive rules, keyframes, and copied SVG assets;
- identical files or assets from inventory hashes;
- duplicated test setup, mocks, fixtures, and test helpers;
- copies across monorepo apps that should come from a shared package.

Use exact hashes/token-normalized comparison as leads, then compare semantics manually. Similar names alone are not evidence.

### Choose the correct decision

For each confirmed duplicate, explicitly choose one:

1. **Reuse/export the existing implementation** when one implementation is already correctly placed, has a stable public contract, and introducing the dependency does not violate layering or bundle boundaries.
2. **Move to a pure helper** when logic is stateless, domain-neutral or intentionally shared, independently testable, and consumed by multiple locations.
3. **Move to a domain service/adapter** when behavior is shared but domain-specific and should not become a generic utility.
4. **Extract a custom hook** when shared behavior owns React state, effects, lifecycle, subscriptions, or memoized derived state.
5. **Extract a component or design-system primitive** when behavior, semantics, accessibility, and visual contract are shared—not merely markup shape.
6. **Extract shared config/schema/type** when the duplication represents one source of truth.
7. **Keep separate intentionally** when domain rules, permission context, server/client runtime, package ownership, bundle cost, release cadence, test isolation, or expected divergence make sharing harmful.

### Required plan details

Document:

- canonical target path and proposed symbol/API;
- all duplicate locations and meaningful differences;
- why the selected abstraction level is correct;
- migration order and compatibility strategy;
- tests/fixtures to establish behavior before consolidation;
- imports/callers to update later;
- deletion/deprecation sequence;
- circular-dependency or bundle-size risk;
- verification that behavior remains equivalent.

Do not recommend a “utils” dumping ground or abstraction based only on line-count reduction.

## Phase 2 — Unused and Dead Code

### Detect

Check for unused or unreachable:

- imports, re-exports, variables, constants, parameters, destructured values, methods, classes, private fields, labels, and namespaces;
- functions, components, hooks, contexts/providers, stores, reducers/actions/selectors, schemas, types, interfaces, enums, and files;
- props, state fields, refs, memoized values, callbacks, effects, event handlers, and returned values;
- route entries, layouts, pages, API handlers, middleware branches, navigation items, permissions, feature flags, experiments, and legacy redirects;
- CSS selectors/classes/modules, tokens, themes, animations, fonts, images, icons, public assets, and SVG definitions;
- translation keys/locales, analytics events, error codes, and configuration keys;
- environment variables, package scripts, CI jobs, aliases, compiler options, lint overrides, and test setup;
- dependencies, devDependencies, optional/peer dependencies, duplicate packages, and packages imported only through transitive accident;
- tests, stories, mocks, fixtures, snapshots, and utilities that no longer exercise supported behavior;
- commented-out code, permanently false branches, obsolete compatibility paths, unreachable code after returns/throws, and stale TODOs;
- exports with no in-repository consumer and no documented public-package contract.

### Verify before removal

Check dynamic import paths, framework file discovery, registries, decorators, reflection, string-key access, CSS/translation generation, tests/stories, package consumers outside the monorepo, generated code, ambient declarations, and deployment scripts.

Classify each item:

- `confirmed unused`;
- `likely unused — runtime/product confirmation required`;
- `public API with no in-repo consumer`;
- `generated — fix generator/source instead`;
- `intentionally retained — document reason`.

### Required removal plan

Include:

- exact declaration and all searches performed;
- dependency/caller evidence;
- whether deprecation is required;
- removal order, including exports/tests/assets/dependencies/config cleanup;
- rollback risk and affected bundles;
- lint/type/test/build verification to run during implementation;
- any analytics/runtime observation needed before deletion.

Never treat an automated unused warning as sufficient evidence by itself.

## Phase 3 — Lint, Import, Module, and Type Correctness

### Diagnostics

Use existing non-fixing scripts/configuration to check:

- ESLint diagnostics, parser/plugin resolution, config inheritance, ignored paths, contradictory rules, invalid overrides, and stale inline disables;
- TypeScript project references, includes/excludes, aliases, strictness, declaration boundaries, composite settings, and `--noEmit` diagnostics;
- unresolved imports, wrong path aliases, filename case mismatches, extension/module-resolution problems, default-versus-named mismatches, duplicate imports, accidental deep imports, and broken barrel exports;
- circular dependencies and dependency-direction violations;
- missing imports, undefined identifiers, shadowing, accidental globals, invalid JSX namespace/types, and mismatched runtime/type-only imports;
- browser-only APIs in server execution, server-only modules in client bundles, incorrect `use client` boundaries, and environment-variable exposure;
- CommonJS/ESM interop mistakes and package `exports`/`type` inconsistencies;
- async/promise misuse, floating promises, incorrect error typing, unsafe assertions, `any` spread, stale closures, effect dependencies, and invalid hook usage;
- generated types/schema drift and API contract mismatches surfaced by types;
- lint suppression comments without current diagnostics or explanations;
- formatter/linter conflicts and scripts that do not cover all workspaces/file types;
- case-sensitive failures hidden on Windows/macOS but likely to fail on Linux CI.

### Missing or “wrong” import review

For every unresolved or suspected import issue, verify:

- symbol is actually exported by the installed version;
- import path is valid under package exports and the project resolver;
- type-only versus runtime import is correct;
- alias config is aligned across TypeScript, bundler, tests, lint, and IDE;
- path casing matches disk exactly;
- server/client boundary permits the import;
- a missing dependency is direct rather than transitive;
- an auto-import suggestion would not create a circular dependency.

### Report tool failures correctly

Separate source diagnostics from:

- missing local dependencies because install was not performed;
- unavailable network;
- unsupported Node/package-manager version;
- tool configuration defect;
- command side effects that made it unsafe to run;
- pre-existing generated output or cache behavior.

Record raw diagnostic locations concisely, group same-root-cause errors, and propose root-cause fixes rather than one finding per cascading error.

## Phase 4 — Clean-Code Refactoring

### Review dimensions

Look for evidence-backed opportunities involving:

- ambiguous naming, inconsistent terminology, magic values, hidden contracts, and unclear ownership;
- oversized components/functions/hooks/classes, high cyclomatic/cognitive complexity, deep nesting, long parameter lists, flag arguments, and mixed abstraction levels;
- violation of single responsibility, feature leakage, UI/domain/infrastructure coupling, or reversed dependency direction;
- duplicated source of truth, derived state stored as state, prop-to-state synchronization, mutation, and implicit global state;
- effect misuse, unstable dependencies, stale closures, race conditions, missing cancellation, subscription leaks, and lifecycle coupling;
- prop drilling, context overuse, store overreach, incoherent cache/state ownership, and non-local side effects;
- inconsistent API/error/loading/empty/retry handling;
- weak typing at boundaries, repeated assertions, overly broad types, optional-property ambiguity, and missing runtime validation;
- inconsistent component APIs, boolean-prop explosions, leaky styling APIs, and inaccessible custom primitives;
- ad hoc form state/validation, duplicated schemas, uncontrolled/controlled transitions, and unclear submission state;
- repeated try/catch or toast logic better handled by a boundary/service—not blanket abstraction;
- hard-to-test modules, hidden time/network/storage dependencies, and excessive mocking requirements;
- feature folders that scatter related code or shared folders that mix unrelated domains;
- comments that explain confusing code instead of clarifying intent/constraints;
- premature memoization, unnecessary abstractions, or generic utilities that obscure behavior.

### Framework-aware quality checks

Depending on installed framework/version, evaluate:

- server/client component placement and provider scope;
- route/layout/error/loading/not-found boundaries;
- data fetching, cache ownership, invalidation, retries, and request cancellation;
- hydration safety and deterministic rendering;
- component key stability and list rendering;
- expensive render work and unnecessary client JavaScript;
- route-level code splitting and package boundary leakage;
- error boundaries and recoverable failure UX.

### Required refactor plan

A clean-code finding must include:

- observed maintenance/correctness/testability cost;
- proposed target responsibility and module boundary;
- behavior characterization tests to write first;
- incremental steps small enough to review;
- compatibility/deprecation needs;
- risks such as circular dependencies, bundle changes, render behavior, or state reset;
- verification and measurable outcome.

Avoid generic advice such as “split this file” without a concrete responsibility map.

## Phase 5 — Security Issues and Vulnerabilities

Use installed versions, actual runtime boundaries, lockfile resolution, and official advisories where available. Do not exploit systems or reveal secrets.

### Secrets and environment exposure

Check:

- hard-coded API keys, tokens, credentials, private endpoints, signing material, or sensitive IDs;
- committed `.env` or credential files and sensitive history indicators available locally;
- server-only values exposed through public environment prefixes, client bundles, source maps, serialized props, logs, or error messages;
- secret-like values embedded in tests, examples, fixtures, Storybook, analytics, or public assets;
- missing `.env.example` guidance and validation of required variables.

Report key names and locations only; redact values.

### Injection and unsafe browser sinks

Trace user/external data into:

- `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, DOM parser/template sinks;
- `eval`, `new Function`, string timers, dynamic script/style creation, or unsafe template execution;
- unvalidated URL construction, `javascript:`/`data:` schemes, open redirects, `window.location`, navigation/router destinations, and download links;
- CSS injection, SVG/HTML upload/rendering, Markdown/MDX rendering, and rich-text editors;
- dynamic imports, worker paths, iframe sources, and asset paths;
- shell/SQL/filesystem calls in Next.js route handlers/server actions or frontend-adjacent scripts.

Verify sanitization library configuration, allowlists, encoding context, and whether sanitized data is later mutated.

### Authentication, authorization, tenant isolation, and sessions

Check:

- permissions enforced only by hiding UI elements;
- route middleware/layout checks that do not cover API/server actions;
- client-controlled tenant/user/role identifiers trusted by server surfaces;
- insecure direct API object access assumptions;
- token storage in `localStorage`/`sessionStorage`, URL/query/hash, logs, or analytics;
- cookie `HttpOnly`, `Secure`, `SameSite`, scope, rotation, logout, and CSRF implications where configuration is present;
- OAuth/OIDC state, PKCE, redirect URI, post-login redirect, and callback handling;
- WebSocket/SSE authentication, reconnect token refresh, channel/tenant authorization, and message validation;
- stale authenticated caches or user-specific static/cached content leakage.

A frontend cannot prove backend authorization. Word findings as missing visible enforcement/evidence and cite server-surface code when present.

### Server-rendering and Next.js-adjacent surfaces

Where applicable inspect:

- route handlers, server actions, middleware, edge functions, image/proxy endpoints, rewrites, and redirects;
- input validation and authorization at the server execution point;
- request forgery, arbitrary fetch/proxy behavior, host-header trust, path traversal, file upload/download, and cache poisoning;
- accidental serialization of private fields to client components;
- dynamic rendering/cache/revalidation decisions for per-user/per-tenant data;
- error responses, stack traces, debug endpoints, and source maps;
- server-only dependency leakage into client bundles.

### Browser platform and content security

Check:

- Content Security Policy, nonce/hash use, unsafe-inline/eval allowances, report-only versus enforced mode;
- clickjacking/frame-ancestors, iframe sandboxing, referrer policy, permissions policy, MIME sniffing, and HTTPS/mixed content;
- `postMessage` origin/source validation and message schema validation;
- service worker scope, cache of authenticated/sensitive content, update strategy, and offline data persistence;
- clipboard, camera, microphone, geolocation, notifications, and other powerful APIs;
- third-party scripts/widgets, integrity/provenance, consent, data collection, and failure isolation;
- sensitive data in DOM, client cache, IndexedDB, logs, Redux/devtools, error reporting, or analytics.

### Dependencies and supply chain

Check:

- resolved versions in lockfiles, not only manifest ranges;
- known advisories from existing audit tools and official sources;
- direct versus transitive reachability and whether vulnerable functionality is used;
- abandoned/unmaintained or suspiciously named packages, install scripts, Git dependencies, unpinned remote sources, and unexpected registries;
- duplicate major versions that prevent patching or increase bundle/risk;
- dependency confusion/private package naming and registry configuration;
- unsafe build plugins, loaders, postinstall scripts, and browser extensions.

Do not recommend “upgrade everything”. Name the minimum safe target or mitigation direction, compatibility risk, and verification.

### Security finding fields

In addition to the standard schema, include when applicable:

- weakness/advisory identifier (CWE, OWASP category, GHSA/CVE/OSV ID);
- source-to-sink or trust-boundary path;
- prerequisite attacker capability;
- affected environment/data;
- exploitability versus theoretical exposure;
- immediate containment and long-term fix;
- security tests and regression checks.

## Phase 6 — AI Documentation Health and Rebuild Plan

This phase audits instructions that help humans and AI agents understand and safely modify the frontend. The skill remains report-only: do not create/update these docs now.

### Locate

Check root and nested variants of:

- `AGENTS.md` and `.agents/skills/`;
- `CLAUDE.md`, `GEMINI.md`, or equivalent assistant guidance;
- `.github/copilot-instructions.md` and scoped instruction files;
- Cursor/IDE rules and reusable workflow instructions;
- README, CONTRIBUTING, architecture docs, ADRs, coding standards, testing guides, environment/setup docs, release/deployment docs, and troubleshooting guides;
- route/feature maps, API contracts, design-system docs, state/data-flow docs, security conventions, and ownership maps.

### Verify freshness against code

Compare documentation claims to:

- package names, scripts, versions, lockfile/package manager, workspace structure, and required runtime;
- source paths, route names, aliases, import boundaries, naming conventions, and generated files;
- architecture, state management, data fetching, forms, validation, styling, testing, accessibility, i18n, auth, and deployment implementation;
- environment variables and examples;
- CI checks and actual commands;
- feature status, flags, TODOs, and deprecated modules.

Classify problems as:

- missing;
- stale;
- contradictory;
- incomplete/high-risk omission;
- too broad or context-heavy;
- duplicated and likely to drift;
- not discoverable from expected location;
- lacks owners/update triggers/source of truth.

### Required rebuild/update plan

For every missing or stale doc set, provide:

- proposed path and audience;
- exact source files/lines from which it should be rebuilt;
- proposed outline and critical content;
- which content should be generated versus curated;
- links/relationships among root and nested instructions;
- ownership and update trigger (dependency upgrade, route change, architecture change, release process);
- validation method, such as command examples tested in CI;
- migration/deletion plan for contradictory legacy docs.

Recommended minimal AI/developer documentation map, adapted to repository needs:

- root `AGENTS.md`: commands, safety, architecture map, conventions, definition of done;
- nested `AGENTS.md`: only directory-specific differences;
- `docs/frontend/architecture.md`: runtime/data/state/module boundaries;
- `docs/frontend/conventions.md`: components, hooks, forms, styling, errors, accessibility, tests;
- `docs/frontend/routes-and-features.md`: route/permission/flag/feature traceability;
- `docs/frontend/security.md`: secrets, auth, tenant, server action/handler, CSP, logging rules;
- `docs/frontend/testing.md`: test pyramid, commands, fixtures, coverage expectations;
- `docs/frontend/environment.md`: non-secret variable catalogue and deployment behavior.

Do not recommend all files when a smaller single source of truth would be clearer.

## Phase 7 — Documentation-to-Frontend Implementation Gaps

### Build a traceability matrix

For each locally documented feature/requirement/contract, map:

- source document and exact lines;
- expected route/screen/state/action/validation/permission/API behavior;
- implementing files and exact lines;
- feature flags/environment conditions;
- tests/stories and coverage;
- status: `implemented`, `partial`, `missing`, `behavior mismatch`, `stale doc`, `undocumented implementation`, or `cannot verify`.

Review the inverse direction: implementation without documentation can be a gap, especially for permissions, destructive actions, environment behavior, APIs, and operational constraints.

### Detect

- documented routes/pages/modals/actions/fields/states not implemented;
- placeholder UI, fake/static data, TODO/FIXME, disabled controls, stubs, and unfinished feature flags;
- missing loading, empty, error, permission-denied, offline, retry, and responsive states promised by docs;
- validation, defaults, limits, status values, labels, permissions, or workflows that differ from docs;
- API endpoint/method/payload/response/error differences;
- docs that reference renamed/removed components, scripts, paths, dependencies, screenshots, or navigation;
- code that implements sensitive or business-critical behavior with no discoverable documentation/tests;
- refactors claimed by docs but only partially migrated;
- duplicated frontend docs that disagree with product/API/architecture docs.

### Required delivery/refactor plan

For each gap include:

- authoritative source or product decision still needed;
- acceptance criteria in user-observable terms;
- affected routes/components/contracts/tests/docs;
- dependency and migration order;
- whether code, docs, or both should change;
- data migration/backward compatibility/feature-flag implications;
- verification tests and documentation update gate.

Do not invent requirements absent from local evidence. Put product questions under `cannot verify` with exact sources of ambiguity.

## Phase 8 — Evidence-Based Improvement Suggestions

Suggestions must be grounded in repository evidence and should make the app measurably better. Do not fill the phase with generic best-practice lists.

### Candidate areas

#### Architecture and boundaries

- feature/package boundaries, shared dependency direction, public APIs, server/client split, state/data ownership, module federation or monorepo consistency;
- canonical API/schema generation and contract testing;
- design-system consolidation and component governance.

#### User experience and accessibility

- semantic HTML, keyboard/focus behavior, accessible names, announcements, dialogs, tables, charts, color/contrast evidence, reduced motion, forms/errors;
- loading, optimistic, empty, partial, offline, degraded, permission-denied, and recovery states;
- responsive density, touch targets, RTL/i18n, locale formatting, timezone, and content overflow.

#### Performance

- client JavaScript volume, route/package splitting, hydration, render churn, context updates, list virtualization, memoization justified by profiling, asset/font/image delivery;
- network waterfalls, duplicate requests, cache/invalidation, request cancellation, prefetching, streaming/suspense where supported, and Core Web Vitals risks;
- bundle analysis or performance budgets when already supported.

#### Reliability and observability

- error boundaries, structured client errors, correlation IDs, safe telemetry, source-map policy, alerting, retry/backoff, idempotency, offline/reconnect behavior, and user-visible recovery;
- feature-flag lifecycle and safe rollout/rollback.

#### Testing and quality gates

- unit/integration/contract/E2E/visual/accessibility/security coverage matched to risk;
- deterministic fixtures, test isolation, flaky patterns, CI workspace coverage, changed-file versus full checks, and regression tests for current findings.

#### Developer experience

- consistent scripts/configs, local setup, generated code workflow, lint/type/test speed, dependency hygiene, Storybook/design-system docs, ownership, ADRs, and automated docs validation.

### Required suggestion format

Use the normal finding schema with `Severity: Info` unless an actual defect/risk justifies more. Include:

- representative file-and-line evidence and measured/observable baseline if available;
- expected user/developer/business impact;
- effort and rollout risk;
- prerequisites and alternatives;
- measurable success criterion (for example bundle KB, interaction latency, error rate, accessibility checks, test coverage of a critical flow, or reduced duplicate implementations).

Prioritize a small number of high-leverage suggestions over an unranked catalogue.
