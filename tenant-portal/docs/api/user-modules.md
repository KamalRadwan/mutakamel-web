# Tenant User Modules API

Base path: `/tenant/users/:userId/modules`

The User Modules API allows tenant administrators to assign or unassign specific licensed business modules (such as CRM, Trade B2B, Point of Sale, etc.) to individual users. This system governs the consumption of per-user seat licenses.

## Endpoints

### `GET /tenant/users/:userId/modules`
Lists all the active module subscriptions/assignments for a specific user.
- **Permissions**: `users.user.read`
- **Response**: `200 OK`

### `POST /tenant/users/:userId/modules`
Assigns a new business module license to the user, consuming one seat from the tenant's global subscription pool.
- **Permissions**: `users.user.update`
- **Body**: `AssignModuleDto`
- **Response**: `201 Created`

### `DELETE /tenant/users/:userId/modules/:moduleKey`
Unassigns a business module from the user, freeing up the seat in the tenant's subscription pool.
- **Permissions**: `users.user.update`
- **Response**: `204 No Content`
