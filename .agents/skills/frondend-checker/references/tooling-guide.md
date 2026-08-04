# Safe Tooling Guide

Frontend Checker uses tools to strengthen evidence while keeping the repository read-only except for `APP_CHECK_RESULT.md`. Always inspect scripts/configuration before execution.

## 1. Safety rules

- Use existing local dependencies and repository scripts. Do not install or upgrade packages.
- Never use `--fix`, `--write`, update-snapshot flags, codemods, generators, migration commands, or package-manager install commands.
- Avoid build/deploy/export commands inside the working repository because they commonly create `.next`, `dist`, generated clients, caches, or deployment artifacts.
- Do not run watch/dev servers, interactive commands, or commands that wait indefinitely.
- Set CI/non-interactive mode when supported, but do not append unknown flags to arbitrary scripts.
- Before running a script, read its definition and any called script/config to determine side effects.
- Run commands from the correct monorepo root or workspace.
- Record exact command, cwd, relevant tool version, exit code, and concise result in the report.
- A failed/unavailable tool is a limitation, not permission to skip manual review.

## 2. Repository discovery

Useful read-only commands when available:

```sh
git rev-parse --show-toplevel
git status --porcelain=v1
git ls-files -co --exclude-standard
find .. -name AGENTS.md -print
rg --files -g 'package.json' -g '!node_modules' -g '!.next' -g '!dist' -g '!build'
```

Use the supplied inventory script as the canonical coverage list. `rg --files` and `git ls-files` are supporting checks, not substitutes.

## 3. Package manager and workspace detection

Check, in order:

- `package.json` `packageManager` and `engines`;
- `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `npm-shrinkwrap.json`, `bun.lock`, or `bun.lockb`;
- `pnpm-workspace.yaml`, npm/yarn workspaces, `turbo.json`, `nx.json`, Lage/Rush configs, or framework workspace configs.

Do not run a command from the wrong package manager. In mixed/legacy repositories, document the ambiguity before executing scripts.

## 4. Inspect available scripts before running them

Read every relevant `package.json` and follow shell/Node script references. Classify scripts:

- **normally safe:** lint without fixing, typecheck with no emit, static analysis, test list/discovery, tests configured not to update files;
- **conditionally safe:** tests that may update snapshots/fixtures, coverage runs, codegen checks, dependency audits requiring network, Storybook tests, browser tests;
- **unsafe in the working tree:** build/export/codegen, format/fix, migrations, deploy, release, clean, install, snapshot update, translation extraction that writes files.

If uncertain, do not run the script; document the manual substitute and uncertainty.

## 5. TypeScript checks

Prefer the repository’s existing `typecheck` script. Otherwise, only invoke an already-installed local TypeScript binary with no emit, using the project config actually used by the workspace. Examples, adapted rather than copied blindly:

```sh
./node_modules/.bin/tsc --noEmit --pretty false -p tsconfig.json
pnpm exec tsc --noEmit --pretty false -p tsconfig.json
yarn exec tsc --noEmit --pretty false -p tsconfig.json
bunx --no-install tsc --noEmit --pretty false -p tsconfig.json
```

Confirm that the selected command does not invoke a downloader. In a project-reference monorepo, inspect whether `tsc -b --noEmit` is supported by the installed TypeScript/config; do not assume.

Capture root-cause diagnostics rather than creating one finding for every cascade.

## 6. ESLint and lint checks

Prefer the repository’s configured `lint` script after confirming it does not include fixing or generation. Otherwise use an installed local ESLint without `--fix`:

```sh
./node_modules/.bin/eslint .
pnpm exec eslint .
yarn exec eslint .
```

Respect flat config versus legacy config and installed version. Do not assume a framework-specific lint command exists. Check whether all workspaces/file extensions are covered and whether ignores hide project-owned source.

Audit inline suppressions with line-numbered searches:

```sh
rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  'eslint-disable|eslint-disable-next-line|@ts-ignore|@ts-expect-error|@ts-nocheck'
```

An `@ts-expect-error` is not automatically wrong; verify whether it still suppresses the intended diagnostic and has a reason/test.

## 7. Existing dead-code and dependency tools

Use only when already installed/configured. Potential tools include Knip, ts-prune, dependency-cruiser, madge, depcheck, ESLint import rules, or framework-specific analyzers.

Before running:

1. read config and ignored entrypoints;
2. confirm command is read-only;
3. understand dynamic/framework entrypoint support;
4. treat results as candidates;
5. manually verify every reported item.

Do not add a new dead-code tool or configuration during this skill.

## 8. Tests and test discovery

Tests can prove reachability and expected behavior, but many scripts write snapshots, coverage, screenshots, traces, or caches.

- Inspect test config and script flags first.
- Prefer list/discovery modes when available and read-only.
- Run focused or normal test commands only when they are demonstrably non-writing in this repository.
- Never pass snapshot-update flags.
- Do not delete generated test output.
- Record tests not run and the reason.

Static review of tests, stories, fixtures, and mocks is mandatory even when execution is unsafe or dependencies are absent.

## 9. Dependency vulnerability checks

When the matching package manager, lockfile, dependencies, and network are available, use its read-only audit facility. Inspect help/version first because syntax differs. Examples of possible commands include:

```sh
npm audit --json
pnpm audit --json
yarn npm audit --json
```

Do not use force/fix/update options. Do not switch package managers. Record unavailable network/registry/auth errors as limitations. Manually assess:

- resolved affected version;
- direct/transitive path;
- imported/reachable functionality;
- production versus development exposure;
- official advisory and patched range;
- compatibility and mitigation options.

If online advisory lookup is available, prefer official framework/package advisories, GitHub Advisory Database/OSV/NVD records, and OWASP/CWE references. Verify publication/update dates and installed versions. Do not rely on unverified blog summaries.

## 10. Searches that preserve line evidence

Use `rg -n` or line-numbered file reads for leads such as:

```sh
rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  'TODO|FIXME|HACK|XXX|temporary|placeholder|mock data'

rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  'dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|postMessage\(|localStorage|sessionStorage'

rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  'NEXT_PUBLIC_|VITE_|PUBLIC_|process\.env|import\.meta\.env'

rg -n --hidden -g '!node_modules' -g '!.next' -g '!dist' -g '!build' \
  'fetch\(|axios\.|WebSocket\(|EventSource\(|window\.location|router\.(push|replace)'
```

These searches are starting points. Read every full matching file and trace sources, guards, sanitizers, callers, and configuration before reporting.

## 11. Duplicate detection support

The inventory JSON contains exact-content duplicate groups by SHA-256. For semantic duplication:

- inspect symbol indexes and repeated names/signatures;
- compare normalized bodies only as a lead;
- search repeated literals, validation schemas, endpoint builders, table columns, query keys, and JSX patterns;
- account for generated code and intentional test fixtures;
- verify abstraction suitability using the Phase 1 decision rules.

Do not install clone-detection software. Use an existing configured tool if present and safe.

## 12. Import/dependency graph support

Use local config and tools first. Read-only commands/searches can help identify:

- imports of private package paths;
- circular barrel exports;
- cross-feature relative imports;
- inconsistent aliases;
- imports from dependencies absent from the owning package manifest;
- multiple direct versions in workspace manifests/lockfiles.

Dependency graph output is evidence to interpret, not an automatic architecture verdict.

## 13. Assets, SVG, and public files

- Read SVG/XML fully and inspect script/event attributes, external references, duplicate IDs, accessibility, viewBox, and sanitization assumptions.
- For raster/font/media assets, use inventory hash/size and available metadata tools; map every reference.
- Inspect public manifests, robots, sitemap, service workers, and static JSON as semantic text.
- Never execute binaries or unpack untrusted archives in the repository. If archive inspection is necessary and safe tooling exists, use a temporary directory and metadata/listing-only mode.

## 14. Git write-boundary verification

At start, save NUL-delimited status outside the repository. At end:

1. collect final status in the same format;
2. identify changes that appeared during the audit;
3. verify the only skill-created persistent change is `APP_CHECK_RESULT.md`;
4. do not revert, stash, stage, or alter user changes;
5. record any unexpected side effects and keep the audit incomplete until explained.

A clean `git diff` is not sufficient when the user had pre-existing untracked/modified files; compare against the baseline.

## 15. Manual fallback when helper scripts cannot run

If Node is unavailable:

1. create a deterministic project-owned file list using Git plus filesystem reconciliation;
2. calculate hashes with an available read-only tool where possible;
3. copy `assets/APP_CHECK_RESULT.template.md` to repository root;
4. create one `FCFILE` JSON comment per project-owned file using the report contract;
5. maintain `PENDING`/`AUDITED` states manually;
6. validate section names, coverage counts, hashes, issue IDs, locations, and Git write boundary manually;
7. state that automated validation was unavailable.

Do not reduce scope because the helper is unavailable.
