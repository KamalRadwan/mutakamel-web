# Tenant Host API

Base path: `/tenant/host-status`

The Tenant Host Status module is a public, unauthenticated utility endpoint used by the frontend to resolve the current active tenant based on the HTTP Host headers or custom domain names.

## Endpoints

### `GET /tenant/host-status`
Resolves the active tenant and their basic public configurations (like logo or branding colors) using the `x-forwarded-host` or `host` headers.
- **Permissions**: Public (Unauthenticated)
- **Response**: `200 OK`
