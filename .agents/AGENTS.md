# Global Workspace Rules

- **Main branch only**: Always work directly on `main`. Never create or switch branches, check out another ref, detach HEAD, or create a worktree.
- **Branch safety check**: Before editing a repository, verify that `git branch --show-current` returns `main`. Otherwise, stop and ask the user; do not switch branches or move existing changes yourself.

- **Code Base Modification Permission**: Only read from codebase files when requested; do not modify or edit files unless explicitly instructed by the user.
- **Strict Backend Code Prohibition**: NEVER edit, modify, or update backend code files under `../backend/` or any backend application under any circumstances. Only read backend files for API contract verification.
- **Styling Standards**: ALWAYS use Tailwind CSS utility classes exclusively for styling components and layouts. NEVER write plain/vanilla CSS files or inline CSS styles (except CSS variable tokens in `globals.css`).
- **Strict i18n & Bilingual Care**: ALWAYS care about i18n (Internationalization). Every page, component, header, label, button, and text element built MUST seamlessly support Arabic (RTL) and English (LTR) with full i18n dictionary integration (`useI18n`), direction mirroring, and proper font pairing.
- **Design System Enforcement**: ALWAYS strictly follow the dedicated design system in each app (`admin-portal`, `tenant-portal`, `partner-portal`). Feature code must exclusively consume design system primitives and patterns from the application's design system barrel (`@/design-system`), adhering strictly to documented design tokens, layout metrics, typography scales, and component guidelines without inventing ad-hoc styles.
- **UI/UX Intelligence (`ui-ux-pro-max`)**: ALWAYS utilize and consult the [`ui-ux-pro-max`](file:///c:/mutakamel.ai/frontend/.agents/skills/ui-ux-pro-max/SKILL.md) skill for UI and UX guidelines, accessibility standards, color palettes, visual density, and interaction patterns BEFORE starting any UI or UX design.
- **Frontend Design Skill**: Utilize the [`frontend-design`](file:///c:/mutakamel.ai/frontend/.agents/skills/frontend-design/SKILL.md) skill guidelines for UI components, layouts, typography, and visual density.
- **Separation of Logic and HTML View (Custom Hooks Pattern)**: Always separate component logic (state, effects, event handlers, API data fetching) from the TSX/HTML view. Create a custom hook `hooks/use<ComponentName>.ts` for the logic and keep the `.tsx` view component focused strictly on rendering markup and Tailwind CSS classes.
- **UUIDv7 only**: Every generated identifier in this workspace is a UUIDv7 — idempotency keys, device and client identifiers, correlation ids, client-side row keys. **Never call `crypto.randomUUID()`**: it emits a v4, and it is undefined outside a secure context, so it throws over plain HTTP on a real tenant hostname — which is how tenant development is served. Use the workspace helper built on `crypto.getRandomValues` (`generateUUIDv7` in `tenant-portal/src/lib/uuid.ts`). The one thing that is *not* an identifier is a CSP nonce: it needs full unpredictability rather than a sortable prefix, so it is raw random bytes and must not be "corrected" into a UUID.
- **Strict Fixed Port Binding**: NEVER run any application on an alternate port or change port assignments even for testing. `admin-portal` MUST strictly use port `5001`, `tenant-portal` MUST strictly use port `5002`, and `partner-portal` MUST strictly use port `5003`.
- **API Documentation**: Always maintain up-to-date `.md` API documentation for port-specific frontend applications (for example, `admin-portal/docs` and `tenant-portal/docs`). Record the last verification date, owning backend app, public gateway path, DTO validation, enum wire values, permissions, response shape, error behavior, and frontend live/mock status.
- **Admin API Routing**: Admin Portal browser calls use canonical API Gateway paths: `/api/admin/core/v1/<route>` for Core and `/api/admin/worker/v1/<route>` for Worker. Do not copy unversioned controller paths such as `/admin/*` into frontend request code.
- **Contract Verification Order**: Use the API Gateway route contract for the public method/path, then the owning controller and DTO/service types for guards, permissions, validation, enums, and response shapes. Frontend mocks and comments are never contract evidence.
- **Admin WebPhone Runtime**: Keep the Admin Portal WebPhone server-backed through canonical Core Gateway routes, load `jssip` only in the browser, and never persist the current user's SIP password in browser storage, logs, or diagnostics.

# Platform Admin "Database Servers" API Blueprint

This API contract is the blueprint for how APIs should be built and called in the admin platform. It manages physical PostgreSQL servers that host tenant databases.

## Scope
- This API manages physical PostgreSQL servers that host tenant databases.
- It does not directly create/list PostgreSQL databases. Tenant database creation remains a provisioning responsibility.
- Browser calls use the same-origin Gateway path: `/api/admin/core/v1/database-servers`
- In the web app, never call Core directly and do not manually manage the admin access token. Use the standard API client (`axiosClient`).
- Require the existing admin permissions:
  - read: `admin.database_servers.read`
  - create: `admin.database_servers.create`
  - update/lifecycle: `admin.database_servers.update`
  - delete: `admin.database_servers.delete`

## Canonical Response Envelope Structure (The Blueprint)

Success responses MUST follow this exact structure:
```json
{
  "success": true,
  "status": "SUCCESS",
  "statusCode": 200,
  "code": "STABLE_SUCCESS_CODE",
  "message": "Human-readable success message.",
  "data": {},
  "meta": {},
  "correlationId": "uuid-v7",
  "timestamp": "ISO-8601 timestamp"
}
```

Error responses MUST follow this exact structure:
```json
{
  "success": false,
  "status": "ERROR",
  "statusCode": 422,
  "errorCode": "DB_SERVER_CONNECTIVITY_FAILED",
  "message": "The database server could not be reached.",
  "details": {},
  "errorCategory": "VALIDATION",
  "correlationId": "uuid-v7",
  "timestamp": "ISO-8601 timestamp",
  "path": "/api/admin/core/v1/database-servers"
}
```

## Implementation Requirements
- **Frontend clients must correctly expect and parse the `success`, `data`, and `meta` fields.**
- **Preserve pagination as `data: []` plus `meta`.** (e.g. `const items = response.data?.data`)
- **Preserve existing error response fields.** Error messages are inside `err.response?.data?.message` and specific logic relies on `errorCode`.
- **Add endpoint-level stable success code/message metadata.**
- **Security Check:** Verify that no response, exception, log, audit payload, telemetry event, or browser state contains secrets (like passwords or SSL keys).

# Bilingual RBAC Design Contract
- **Admin Permissions (`AdminPermission`)**: Permissions are represented by a localized dictionary. The `key` (e.g. `admin.database_servers.update`) is immutable. `nameAr`, `nameEn`, and `group` are used for localized UI grouping.
- **Authorization Enforcement**: 
  - NEVER authorize using `nameAr`, `nameEn`, `group`, or `description`.
  - ALWAYS use the immutable `key` for checking access.
- **Guards Framework (`adminCan` / `adminCanAll`)**: 
  - `adminCan(user, key)` tests if a single key exists in `user.permissions` or if `user.isSuperAdmin` is true.
  - `adminCanAll(user, keys[])` tests if an array of keys all exist in `user.permissions`.
- **Critical Action Semantics**: Destructive actions (like `admin.tenants.destroy` or `admin.users.update`) strictly require their base action key AND the corresponding `.critical` key (e.g. `admin.users.critical`). 
- Use the predefined mapping `ADMIN_RBAC_CRITICAL` located in `@/lib/auth/rbac` to retrieve these combinations for `adminCanAll`.

## Shared Playwright MCP

Before UI design, all agents must inspect and screenshot the actual running
portal through shared Playwright MCP at `http://127.0.0.1:8931/mcp`. Follow
[the browser runbook](../../backend/docs/operations/playwright-mcp.md). Measure current design-system
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
Use the [repo tool and skill inventory](../docs/agent-tooling.md) on demand for the current task.
<!-- /mutakamel-agent-tooling -->

## Production server

The Mutakamel production server is `12.0.0.88`. Connect from Windows PowerShell with the following command.

```powershell
ssh -i "$env:USERPROFILE\.ssh\pbs_ed25519" root@12.0.0.88
```
