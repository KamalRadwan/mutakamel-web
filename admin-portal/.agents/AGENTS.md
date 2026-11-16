# Admin Portal Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Strict Port Assignment**: This application MUST strictly run on port `5001`. Never switch to any alternate port even for testing.
- **Styling**: Always use Tailwind CSS first for all Admin Portal pages and components.
- **Navigation**: Always use `Link` from `next/link` for internal routes.
- **Design & Layout**: Ensure admin dashboard views, data tables, and metrics utilize screen space efficiently without awkward empty spaces.
- **Strict Design System Adherence**: Always strictly follow the Admin Portal design system (`docs/design-system/README.md` and `src/design-system/`). Import exclusively from `@/design-system` and conform strictly to design tokens, typography, and component patterns without inventing ad-hoc styles.
- **UI/UX Intelligence (`ui-ux-pro-max`)**: Always use and consult the `ui-ux-pro-max` skill for UI and UX guidelines, accessibility standards, color palettes, and interaction patterns BEFORE starting any UI or UX design.
- **File Modifications**: Only modify files when explicitly requested by the user.
- **Continuous Documentation**: Update this `AGENTS.md` file whenever architectural decisions, ports, or portal-specific rules change.
- **API Documentation**: Start with `docs/README.md` and `docs/frontend-integration-guide.md`. For dashboard work, read `docs/api/dashboard.md`; for database-server work, read `docs/api/database-servers.md`; for module, feature, tier, pricing, or managed-currency work, read `docs/api/catalog.md`; for tenant work, read `docs/api/tenants.md` and the relevant nested `docs/api/tenant-users.md` and `docs/api/tenant-operations.md` contracts; for platform, auth, billing, notification, Asterisk, or SMTP settings work, read `docs/api/system-settings.md`. Update the relevant documentation whenever a route, DTO, enum, permission, adapter, or live/mock boundary changes.
- **Backend Ownership**: `core-app` is the primary backend, `worker-app` owns backup/restore APIs, and `api-gateway-app` owns browser-visible routes. CRM and Trade remain tenant-product APIs unless an admin-master gateway route exists.
- **Canonical Gateway Paths**: Browser code must use `/api/admin/core/v1/<route>` for Core and `/api/admin/worker/v1/<route>` for Worker. `/admin/*` and `/api/v1/admin/*` are backend-relative paths and must not appear in frontend requests.
- **Contract Evidence**: Verify the gateway route contract first, then the owning controller, DTO, enum, permission decorator, and response/service type. Never treat frontend mocks or endpoint comments as proof of a backend contract.
- **Integration Honesty**: Authentication is server-backed; most domain screens are still mocked and settings have preview fallbacks. Preserve this distinction in documentation and implementation reports.
- **HTTP Client**: Use the shared authenticated client rather than raw `fetch` so credentials, Bearer tokens, and the coordinated refresh retry remain consistent. Core success payloads are under `data`; paginated responses also use `meta`. Normalize Core failures from `errorCode` and Gateway Problem Details from `code`, preserving `correlationId`.
- **Idempotent Writes**: Gateway routes marked `WRITE_SENSITIVE` and `idempotent: true` require an `x-idempotency-key` UUIDv7 header. Use one key per user intent and reuse it only for an exact retry of that request.
- **Strict DTOs & RBAC**: Core rejects unknown DTO fields. Preserve case-sensitive enum values, avoid placeholder IDs, and permission-gate navigation/actions from `/auth/me`.
- **Bilingual & Theme Standards (ar/en & dark/light)**: All UI pages, components, and layouts must seamlessly support Arabic (RTL) & English (LTR) language switching as well as Dark & Light mode switching using Tailwind logical properties (`start-*`, `end-*`, `ms-*`, `me-*`) and `@custom-variant dark`.
- **Separation of Logic and HTML View**: Separate component logic into custom hooks (`hooks/use<ComponentName>.ts`) and keep `.tsx` view components purely focused on TSX markup and Tailwind CSS.
- **WebPhone Security**: Use browser-only `jssip` with canonical Core Gateway WebPhone, Asterisk settings, and call-log routes. Never persist SIP passwords in browser storage, logs, analytics, or mock fixtures.

## Shared Playwright MCP

Before UI design, all agents must inspect and screenshot the actual running
portal through shared Playwright MCP at `http://127.0.0.1:8931/mcp`. Follow
[the browser runbook](../../../backend/docs/operations/playwright-mcp.md). Measure current design-system
components and computed typography, density, badge and modal geometry before
proposing changes; verify Arabic RTL and English LTR in light and dark.

Use an isolated MCP session with the existing `mutakamel-playwright-mcp`
container. Never create a per-agent container, share browser context, or start
an app for a screenshot. If native tools have not loaded, use an MCP SDK HTTP
client to the same endpoint. Never put login credentials, cookies or
authenticated storage state into tracked documents, code or shared evidence.
Only the user-authorized local development access memo below may hold the
supplied development credentials; never browser cookies or storage state.

For explicitly authorized Mersany tenant development browser sign-in, read the
[local development access memo](C:/mutakamel.ai/.local/mersany-dev-access.md).
The user authorized saving and reusing that development login in this one
local memo outside all Git repositories. Do not duplicate its values in
tracked Markdown, application/config files, scripts, logs or shared artifacts;
keep browser cookies and authenticated storage state out of the memo too.

<!-- mutakamel-agent-tooling -->
Use the [repo tool and skill inventory](../../docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
