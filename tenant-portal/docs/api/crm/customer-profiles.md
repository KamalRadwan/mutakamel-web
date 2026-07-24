# CRM Customer Profiles API

Base path: `/crm/customer-profiles`

The CRM Customer Profiles module acts as the centralized repository for individuals and corporate entities that are active prospects or customers.

## Endpoints

### `POST /crm/customer-profiles`
Creates an individual or corporate customer/prospect profile inside a branch.
- **Permissions**: `crm.customer_profiles.create.*`
- **Body**: `CreateCustomerProfileDto`
- **Response**: `201 Created`

### `GET /crm/customer-profiles`
Returns paginated customer profiles filtered by branch and narrowed by CRM scoped read access.
- **Permissions**: `crm.customer_profiles.read.*`
- **Queries**: `branchId`, `profileType`, `status`, `acquisitionSourceId`, `ownerUserId`, pagination parameters
- **Response**: `200 OK` (Paginated Profiles)

### `GET /crm/customer-profiles/capabilities`
Returns customer-profile action capabilities for a branch the tenant user belongs to, without requiring customer-profile read access.
- **Permissions**: Derived from branch context
- **Queries**: `branchId`
- **Response**: `200 OK`

### `POST /crm/customer-profiles/:id/contacts`
Creates a person party and links it to the corporate customer in one transaction.
- **Permissions**: `crm.customer_profiles.update.*`
- **Body**: `CustomerProfileContactPersonDto`
- **Response**: `201 Created`

### `GET /crm/customer-profiles/:id`
Loads one customer profile if it is inside the actor scoped branch/owner visibility.
- **Permissions**: `crm.customer_profiles.read.*`
- **Response**: `200 OK`

### `PATCH /crm/customer-profiles/:id`
Updates mutable customer profile fields after scoped write access is validated.
- **Permissions**: `crm.customer_profiles.update.*`
- **Body**: `UpdateCustomerProfileDto`
- **Response**: `200 OK`

### `DELETE /crm/customer-profiles/:id`
Soft deletes a customer profile when no active lifecycle rule blocks removal.
- **Permissions**: `crm.customer_profiles.delete.*`
- **Response**: `204 No Content`
