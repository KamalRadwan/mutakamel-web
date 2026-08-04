# Exhaustive Frontend Audit Methodology

This methodology defines what “deep check” means for Frontend Checker. It prioritizes complete project-owned-file coverage, cross-file reasoning, false-positive control, and a report that can be executed later without rediscovering the repository.

## 1. Define repository ownership before reviewing

Classify every encountered path. Never use a broad exclusion without recording it.

### Project-owned and fully auditable

These normally require semantic or structured review:

- application and library source;
- pages, routes, layouts, middleware, handlers, server actions, workers, service workers;
- components, hooks, contexts, stores, reducers, selectors, schemas, API clients, utilities, and generated client wrappers committed to Git;
- tests, fixtures, stories, mocks, visual-test definitions, and test utilities;
- stylesheets, CSS modules, design tokens, Tailwind/PostCSS configs, templates, SVG, HTML, MDX, and emails;
- package/workspace manifests, lockfiles, framework configs, TypeScript configs, lint/format configs, bundler configs, CI definitions, scripts, Docker/dev-container files, and environment examples;
- README, architecture, ADR, feature, API, product, developer, and AI-agent documentation;
- translations, feature flags, permission maps, public manifests, robots/sitemap files, and browser-extension manifests;
- public assets and committed generated artifacts.

### Non-project-owned or disposable output

Do not semantically inspect every child file in these categories unless the repository intentionally vendors and maintains them:

- `.git`, `.hg`, `.svn` internals;
- `node_modules` and package-manager stores/caches;
- `.next`, `dist`, `build`, `out`, coverage output, Storybook output, framework caches, and temporary test artifacts;
- editor caches and OS metadata.

Record each excluded root, why it is excluded, and the substitute control. Examples:

- `node_modules`: inspect manifests, resolved lockfile graph, licenses when relevant, package audit output, and imported dependency usage instead.
- `.next`: inspect Next.js config, source maps policy, output settings, bundle reports if already present, and source code instead.
- generated API client: if committed and modified by the team, review it as structured generated code; trace issues to its generator/spec where possible.

A directory is not excluded merely because it is large.

## 2. Choose the correct audit mode for every file

The inventory assigns an initial mode. The agent may refine it in the report.

### `semantic`

Read the full text and reason about syntax, behavior, data flow, imports/exports, callers, runtime boundary, framework conventions, security, and documentation traceability. Applies to source, tests, scripts, docs, configs, styles, SVG, JSON, YAML, TOML, XML, GraphQL, SQL-like frontend schemas, and most text assets.

### `structured`

Parse or inspect using the file’s native structure plus targeted line review. Applies to large lockfiles, generated schemas, localization catalogs, source maps committed intentionally, and machine-generated manifests. The review must still cover integrity, references, duplicates, stale entries, security implications, and generator/source-of-truth consistency.

### `metadata`

For raster images, audio/video, fonts, archives, and other non-text assets, inspect:

- repository path and intended use;
- size, type, dimensions/duration when tools allow, and hash;
- exact duplicate assets and near-duplicate naming;
- import/reference sites and whether the asset is unused;
- public exposure and sensitive embedded metadata where relevant;
- optimization/accessibility implications;
- license/provenance documentation when relevant;
- unsafe archive or executable characteristics.

Use visual inspection when meaning, text, layout, or accessibility cannot be inferred from metadata and a supported viewer exists.

### `symlink`

Inspect the link path, target, whether the target stays inside the repository, portability, broken-link risk, and whether it bypasses intended boundaries. Do not follow links that escape the repository without explicit authorization.

## 3. Inventory first; do not audit from memory or a partial file list

A valid inventory must:

- be rooted at the actual repository root;
- cover nested monorepo workspaces and apps, including hidden project configuration;
- use deterministic repository-relative ordering;
- capture file SHA-256, byte size, text/binary classification, line count when meaningful, tracked/untracked state when Git is available, and sensitive-file flags;
- list exact-content duplicate groups;
- list symlinks;
- list excluded directory roots with reasons;
- exclude the skill’s own installed folder and `APP_CHECK_RESULT.md` from application findings while still recording them as tool-owned exclusions.

Rebuild the inventory at the beginning of every run. A previous coverage entry is current only when its path and hash match.

## 4. Build a repository map before diagnosing

Start with high-leverage sources of truth:

1. workspace and package manifests;
2. framework and build configuration;
3. TypeScript and lint configuration inheritance;
4. route/file-system conventions;
5. environment examples and runtime deployment config;
6. package scripts and CI checks;
7. primary architecture/product/API documentation;
8. source entrypoints and shared packages.

Record a concise repository profile:

- frameworks and exact versions;
- package manager and workspace orchestrator;
- rendering modes and server/client boundaries;
- state/data-fetching/form/validation/testing/style stacks;
- authentication and authorization integration points;
- API transport and generated-client sources;
- deployment targets and environment tiers;
- internationalization and accessibility approach;
- design-system/shared-component boundaries.

Do not infer a standard architecture merely from folder names.

## 5. Read files completely and in deterministic batches

### Batch strategy

- Group by workspace, then feature/layer, while maintaining a stable path list.
- A typical batch is 20–50 moderate files; reduce for very large or security-sensitive files.
- Read every file from start to end. For large files, use contiguous chunks with overlapping boundaries so no lines are missed.
- Update the report after each batch so the task is resumable.
- Mark coverage only after all eight phase questions have been applied to the file and cross-file references needed for a conclusion have been checked.

### Required per-file notes in working context

Track at least:

- purpose and runtime context;
- public and internal symbols;
- inbound and outbound dependencies;
- state/data ownership;
- user-controlled inputs and sensitive outputs;
- docs/tests/stories/assets tied to the file;
- candidate duplicate or dead-code relationships;
- issue IDs or “clean after checks”.

Temporary notes must stay outside the repository unless merged into `APP_CHECK_RESULT.md`.

## 6. Construct cross-file indexes

A file-by-file review alone cannot find many requested issues. Maintain these indexes through the whole audit.

### Symbols and dependency index

For each declared symbol, record definition, export form, imports, dynamic references, and runtime boundary. Include functions, classes, components, hooks, contexts, stores, actions, reducers, selectors, schemas, constants, types, interfaces, enums, namespaces, and CSS/translation keys when practical.

Use it to find:

- duplicate and near-duplicate implementations;
- unused exports and orphan files;
- circular or inverted dependencies;
- default/named import mismatches;
- accidental server-to-client leakage;
- public APIs that bypass intended layers.

### Route and feature index

Map routes, layouts, pages, loaders/actions, middleware, API handlers, navigation entries, permissions, feature flags, analytics events, docs, and tests. File-system routing conventions are version/framework dependent; verify against installed versions and actual config.

### API and data-contract index

Map every API client call to:

- endpoint/query/mutation/event name;
- request and response types/schemas;
- validation/transformation;
- auth/tenant/permission context;
- error/loading/retry/cancellation behavior;
- consuming components/hooks;
- related docs and tests.

### UI and design-system index

Map repeated UI patterns, tokens, components, variants, accessibility primitives, forms, dialogs, tables, charts, toasts, loading/empty/error states, and responsive behavior. Distinguish visual similarity from genuinely shareable responsibility.

### Documentation traceability index

For each requirement or documented behavior, map the relevant code, route, contract, test, flag, and state. Record the inverse mapping for implemented-but-undocumented behavior.

## 7. Apply false-positive controls before recording findings

### Duplicate-code controls

Do not merge merely because syntax looks similar. Verify:

- same domain meaning and invariants;
- compatible input/output and error semantics;
- safe dependency direction;
- compatible server/client and bundle boundaries;
- same authorization/tenant context;
- shared lifecycle and release ownership;
- expected future divergence;
- whether abstraction would reduce or increase coupling.

### Unused-code controls

Check:

- dynamic imports and lazy routes;
- framework-discovered files and reserved exports;
- reflection, registries, dependency injection, decorators, plugins, and string references;
- CSS/translation selectors built dynamically;
- test/story-only usage;
- generated code and public package APIs;
- ambient types and declaration merging;
- environment/deployment usage outside the immediate package.

Classify as `confirmed unused`, `likely unused`, `public API with no in-repo consumer`, or `requires runtime/product confirmation`.

### Lint/type controls

Separate:

- source defect;
- stale/incorrect configuration;
- environment/dependency absence;
- generated-file diagnostic;
- intentional suppression with documented reason;
- version mismatch between config and installed tool.

### Security controls

Distinguish:

- vulnerable pattern from reachable exploit path;
- client-side visibility from secret exposure;
- UI hiding from actual server authorization;
- vulnerable dependency from imported/reachable vulnerable functionality;
- development-only behavior from production configuration;
- hypothetical concern from direct data flow.

Do not perform exploitation, destructive testing, credential use, or external data submission.

### Documentation-gap controls

A document can be aspirational, historical, or scoped to another app. Verify status, date, ownership, feature flags, environment, and repository area before calling a mismatch.

## 8. Use evidence hierarchy

Prefer evidence in this order:

1. directly read source/config/doc lines and deterministic control/data flow;
2. reproducible local lint/type/test/static-analysis diagnostics;
3. lockfile-resolved dependency information and official advisories;
4. runtime evidence already present in repository artifacts/logs;
5. documented product/API contracts;
6. reasoned inference clearly labeled as inference.

Search results, tool summaries, and generated suggestions do not replace source review.

## 9. Framework-aware review without hard-coded assumptions

### Next.js/React examples

Inspect, as applicable to the installed version:

- App Router versus Pages Router and mixed-router boundaries;
- server/client components and `use client` placement;
- route handlers, server actions, middleware, edge/runtime selection, and auth enforcement;
- caching, revalidation, fetch semantics, static/dynamic rendering, and user-specific data leakage;
- metadata, image/font/script handling, navigation, error/loading/not-found boundaries;
- hydration, effect usage, event handling, stale closures, race/cancellation, and Strict Mode behavior;
- React compiler/lint conventions only if enabled and version-supported.

Do not report a rule from a newer framework version against an older project without verifying applicability.

### Other frameworks

Derive equivalent checks from their actual configuration and installed conventions: route discovery, server/client execution, hydration, data loaders/actions, stores, plugins, build output, environment exposure, and security boundaries.

## 10. Monorepo and shared-package rules

- Inventory every workspace, including examples, internal tools, Storybook, docs apps, and shared configs unless explicitly out of scope.
- Apply the nearest applicable repository instructions.
- Run diagnostics from the correct workspace and root context.
- Detect duplicate dependency versions, incompatible peer ranges, divergent tsconfig/eslint rules, copied shared code, and accidental private-package deep imports.
- Prefer a canonical shared abstraction only when dependency direction and release ownership are safe.
- Report cross-app issues with all locations and an ordered migration plan.

## 11. Incremental and resumed audits

When `APP_CHECK_RESULT.md` exists:

1. synchronize inventory;
2. preserve findings and human workflow fields;
3. identify new, removed, changed, and unchanged files by hash;
4. trust unchanged coverage only if the prior report passed validation or clearly records completed review;
5. re-audit changed/new files and all cross-file relationships they affect;
6. revalidate open findings and mark changed status;
7. rerun repository-wide duplicate, dependency, docs-gap, and security correlation before completion.

A changed shared symbol can invalidate unchanged consumers; hash equality does not eliminate dependency-impact review.

## 12. Completion quality gates

Before completion, independently reconcile:

- inventory count versus coverage marker count;
- tool diagnostics versus recorded findings;
- exact duplicate groups versus Phase 1/2 decisions;
- public symbols versus consumers;
- routes/features versus navigation, permissions, docs, and tests;
- environment variables versus examples/docs/deployment use;
- security-sensitive sinks versus all input sources and sanitizers;
- open TODO/FIXME/placeholder/mock data versus Phase 7;
- report issue IDs versus coverage issue references;
- initial versus final Git status.

When uncertainty remains, record it with the files already checked, the missing evidence, and the exact next verification step. Do not convert uncertainty into a clean bill of health.
