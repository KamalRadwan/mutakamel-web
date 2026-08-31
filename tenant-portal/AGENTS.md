<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenant Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

## Absolute prohibitions

- **Never edit any file under `../backend/`.** Read it to verify contracts.
  A missing or wrong backend contract is recorded in
  `docs/build/OPEN-QUESTIONS.md`, never worked around.
- **Never run this app on a port other than `5002`.**
- **Never invent** a DTO field, enum value, permission string, route, response
  shape, or error code. If source does not prove it, it does not exist.
- **Never ship mock data or simulated success.** If a capability is not
  server-backed, it renders the unavailable boundary.

## Read before implementing

1. `docs/README.md` — the index and reading order
2. `docs/architecture/file-architecture.md` — where files go, what may import what
3. `docs/design/README.md` — the five laws
4. `docs/design/anti-patterns.md` — the banned list, before writing any markup
5. The `docs/api/*.md` page for your feature
6. `docs/build/HANDOFF.md` if you are executing the rebuild

If you are about to ask a question, the answer is very likely in `docs/`. If it
genuinely is not, record it in `docs/build/OPEN-QUESTIONS.md` — a question you
had to ask a human is a bug in the documentation.

## API

- Browser calls use canonical Gateway paths only: `/api/tenant/core/v1/*`,
  `/api/tenant/crm/v1/*`, `/api/tenant/trade/v1/*`. Never controller-relative
  paths, never a service origin, never Worker.
- Verify in this order: Gateway route contract, owning controller and guards,
  DTOs and enums, service/response/tests. Mocks and comments are not contracts.
- `fetch` is called in exactly one file: `src/lib/api/axiosClient.ts`.
- Every response passes a runtime validator before reaching the UI.
- Core wraps responses in `data`; **CRM does not**. Do not unwrap a CRM
  response through the Core helper.
- Every CRM list requires a `branchId` — it is not optional.
- Backend rejects unknown fields (`forbidNonWhitelisted`). Send only documented
  DTO keys, with exact case-sensitive enum values.
- Preserve exactly: decimal strings, UUIDs, cursors, ETags, idempotency keys.
  **Never `Number()` a decimal string.**

## Authorization

- Route admission uses `/auth/me` permissions; **action** admission uses the
  CRM `capabilities` endpoints, which account for branch and owner scope.
- Permission pairs use ALL semantics unless the route declares ANY.
- Client checks are advisory. The backend is authoritative.
- **`403` is not an empty state** — render `PermissionGate`.

## Design

- The design system lives in `src/design-system/`. Feature code imports **only**
  from the `@/design-system` barrel, never a deep path.
- Four color roles: `brand`, `positive`, `caution`, `negative`, plus the `ink`
  neutral ramp. **A pipeline stage is never a color** — see
  `docs/design/tokens.md`.
- Three font weights: 400 / 500 / 600. Table body cells are 400.
- At most one filled `primary` button per screen, in `PageHeader`.
- **Logical properties only.** `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/
  `text-start`/`text-end`. `pnpm design:rtl` fails the build at count > 0.
- No arbitrary `text-[Npx]`, no `font-bold`, no `rounded-xl` or above.

## Bilingual and theming

- Every screen works in Arabic RTL **and** English LTR, in dark **and** light.
  Not a follow-up pass.
- **Zero language ternaries.** A component never branches on language to pick a
  string — add the key to both dictionaries instead.
- Every enum value rendered needs a `t.status.*` label. Never display a raw
  wire value.
- Numbers and dates go through `Intl` with an explicit locale. Arabic uses
  Western digits (`ar-EG-u-nu-latn`) — settled, see `docs/design/typography.md`.

## Code quality

- State, effects, handlers and API calls live in `hooks/use<Name>.ts`.
  `.tsx` files hold markup and classNames.
- Named exports only, except Next's required `page`/`layout`/`error`.
- No `any` — `unknown` plus a validator at the boundary.
- **No garbage**: no unused imports, variables, types, props, exports or files;
  no commented-out code; no dead branches; no duplicated logic.
- Files holding **logic or markup** stay under ~300 lines. Past that, split by
  responsibility. Three categories are exempt, and nothing else is — the full
  list and the scheduled splits are in
  `docs/architecture/file-architecture.md#the-300-line-rule-and-its-three-exemptions`.
- Comment **why**, never **what**. Non-obvious constants cite their backend
  source path.

## Documentation maintenance

- When a route, DTO, enum, permission, or live/mock boundary changes, update
  the relevant `docs/` page and its verification date **in the same task**.
- `docs/generated/` and `docs/api/*-reference.md` are generated. Never hand-edit
  them; run `pnpm docs:routes` and `pnpm docs:api-reference`.

## Verification

```bash
pnpm verify   # typecheck, lint, rtl, census --check, contrast, test, docs:check, build, knip — in that order
```

Order matters: cheap and specific gates run first, so a failure names itself
immediately rather than surfacing after a multi-minute build — see
`docs/design/enforcement.md#ci-ordering`.

A green run proves *type-validated, lint-validated, unit-tested*. It does not
prove the app works against a real authenticated session — report that
honestly rather than implying it.
