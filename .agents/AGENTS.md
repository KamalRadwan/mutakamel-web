# Global Workspace Rules

- **Code Base Modification Permission**: Only read from codebase files when requested; do not modify or edit files unless explicitly instructed by the user.
- **Strict Backend Code Prohibition**: NEVER edit, modify, or update backend code files under `../backend/` or any backend application under any circumstances. Only read backend files for API contract verification.
- **Styling Standards**: ALWAYS use Tailwind CSS utility classes exclusively for styling components and layouts. NEVER write plain/vanilla CSS files or inline CSS styles (except CSS variable tokens in `globals.css`).
- **Strict i18n & Bilingual Care**: ALWAYS care about i18n (Internationalization). Every page, component, header, label, button, and text element built MUST seamlessly support Arabic (RTL) and English (LTR) with full i18n dictionary integration (`useI18n`), direction mirroring, and proper font pairing.
- **Frontend Design Skill**: Utilize the [`frontend-design`](file:///c:/mutakamel.ai/frontend/.agents/skills/frontend-design/SKILL.md) skill guidelines for UI components, layouts, typography, and visual density.
- **Separation of Logic and HTML View (Custom Hooks Pattern)**: Always separate component logic (state, effects, event handlers, API data fetching) from the TSX/HTML view. Create a custom hook `hooks/use<ComponentName>.ts` for the logic and keep the `.tsx` view component focused strictly on rendering markup and Tailwind CSS classes.
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
