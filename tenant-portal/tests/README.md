# Tenant Portal tests

```text
tests/
├── README.md
├── unit/
│   └── index.mjs
└── stryker/
    └── run.mjs
```

Keep each `*.spec.ts` next to its module or feature code under `src`.
[The unit index](unit/index.mjs) discovers Angular's spec patterns on each run
and groups them by module. Code can use the exported `discoverUnitSpecs()`
and `selectUnitSpecs()` functions to get the same paths as the CLI.

Run these commands from the Tenant Portal root.

```sh
pnpm test:index                                        # Modules and file counts
pnpm test:index core/auth                              # Exact paths in a module
pnpm test:unit features/workspace/home                 # Run a module
pnpm test:unit src/app/core/auth/session-errors.spec.ts  # Run one indexed spec
pnpm test --watch=false                                # Run the full Angular suite
```

Add a test by placing a spec beside the code it tests, then check it with
`pnpm test:index <module>` and run it with `pnpm test:unit <module>`.

## Mutation testing

[Stryker](stryker/run.mjs) uses the index to run the same unit specs in a sandbox
and mutates TypeScript sources in the selected module. Start with one source file
or line range for quick feedback. Omit `--spec` to use all the module's specs
and `--mutate` to use all its TypeScript sources.

```sh
pnpm test:mutation core/auth --spec src/app/core/auth/session-errors.spec.ts --mutate src/app/core/auth/session-errors.ts:24-24
```

The [command runner](https://stryker-mutator.io/docs/stryker-js/configuration/#testrunner-string)
uses Angular's test builder and TestBed setup. The mutation build omits the
global stylesheet so Tailwind does not rescan the sandbox on each run.
Angular still builds component styles and includes assets. Stryker runs the
selected specs for every mutant. Incremental mode is off because the command
runner cannot track edits to individual test files. Results go to the console.
Use `--trace` for verbose Stryker diagnostics.
