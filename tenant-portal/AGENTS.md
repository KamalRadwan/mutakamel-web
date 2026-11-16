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
- **The running portal is a production build — rebuild after every change.**
  Docker serves `next build` output behind `portal-edge` on
  `http://<tenant host>:5002` (e.g. `http://mersany.mutakamel.ai:5002`;
  `localhost:5002` 404s by design). Source edits are NOT live until you run
  `node scripts/rebuild-portal.mjs tenant` from `frontend/` (or
  `pnpm run portal:rebuild` here). Every task that changes this app ends with
  that rebuild after the unit checks pass and before you report done; quote its
  final `ready … (HTTP <status>)` line. A failed rebuild is a failed task (the
  old container keeps serving). No Docker in your sandbox (Codex): write
  `PENDING: node scripts/rebuild-portal.mjs tenant` in your result. Do not start
  `pnpm dev` on 5002 yourself; live reload is the opt-in `--dev` variant.
  Runbook: `../docs/operations/portal-runtime.md`.
- **HTTP is the selected deployment mode.** Port `5002` over HTTP
  with `AUTH_COOKIE_SECURE=false` in Gateway and Core. This profile uses
  distinct `mutakamel-http-tenant-*` cookies; the secure default retains
  `__Host-mutakamel-tenant-*` cookies. Keep HttpOnly credentials out of browser
  code and preserve the auth queue fallback when Web Locks are unavailable.
  HTTPS is optional, not a prerequisite. See `docs/architecture/security-headers.md` SD-03.

- **Never call `crypto.randomUUID()`.** This workspace issues **UUIDv7 only**.
  `randomUUID()` emits a v4, and it is undefined outside a secure context — so
  it throws on `http://<tenant-host>:5002`, which is how this app is developed.
  Use `generateUUIDv7` / `uuidCrypto` from `src/lib/uuid.ts`. A CSP nonce is the
  deliberate exception and is not a UUID at all: see `createNonce` in `src/proxy.ts`.

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

- **Always follow the Tenant Portal design system**: Adhere strictly to the design system in `src/design-system/` and documentation under `docs/design/`. Feature code imports **only** from the `@/design-system` barrel, never a deep path or ad-hoc custom styles.
- **UI/UX Intelligence (`ui-ux-pro-max`)**: Always consult and use the `ui-ux-pro-max` skill for UI and UX guidelines, accessibility standards, color palettes, and interaction patterns BEFORE starting any UI or UX design.
- Four outcome color roles (`brand`, `positive`, `caution`, `negative`) plus the
  `ink` neutral ramp, and the eleven theme-adaptive `--swatch-*` tokens
  (`src/design-system/lib/swatch-palette.ts` and `views/card-color.ts`) for card
  marks and structured category/activity-type/entity surfaces. **A pipeline
  stage is never a color** — see `docs/design/tokens.md` and
  `docs/design/DESIGN-SYSTEM.md`.
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

## Shared browser MCP

Claude Code, Codex and Antigravity share `playwright` and `postgres` through
separate singleton containers. Playwright uses `http://127.0.0.1:8931/mcp`;
[read the shared browser runbook](../../backend/docs/operations/playwright-mcp.md).

- `playwright`: open the running portal on `5002`, then screenshot every
  changed screen in Arabic RTL and English LTR, light and dark. Before
  designing, capture the actual screen and inspect computed type, density,
  badges, toolbar and modal styles, including Settings context overrides.
- Claude-only `chrome-devtools`: console errors, network calls and performance.
- Claude-only `context7`: current Next.js 16, Tailwind v4 and Radix docs before using an
  API you are unsure of.
- Claude-only `eslint`: lint one file against this app's config.

Look only at an app that is already running; never start one to get a
screenshot. The read-only `postgres` MCP server is one shared container used by
Claude, Codex and Antigravity; never start another postgres-mcp container.
Runbook: `../../backend/docs/operations/claude-mcp-servers.md`.

For explicitly authorized Mersany tenant development browser sign-in, read the
[local development access memo](C:/mutakamel.ai/.local/mersany-dev-access.md).
The user authorized saving and reusing that development login in this one
local memo outside all Git repositories. Do not duplicate its values in
tracked Markdown, application/config files, scripts, logs or shared artifacts;
keep browser cookies and authenticated storage state out of the memo too.

<!-- mutakamel-agent-tooling -->
Use the [repo tool and skill inventory](../docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
