# CRM — Customer Profiles

Status: **verified**

Last source verification: **2026-08-27**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/customer-profiles`

Portal status: **partial** — read-only list and detail. All three views are
phase 4 work.

Source inspected:
`crm-app/src/crm/customer-profiles/customer-profiles.controller.ts`,
`dto/customer-profile.dto.ts`,
`crm-app/src/crm/common/dto/crm-list-query.dto.ts`.

## Routes

| Method | Canonical path | Permission | Branch guard |
| --- | --- | --- | --- |
| POST | `/api/tenant/crm/v1/customer-profiles` | `crm.customer_profiles.create` (scoped) | body |
| GET | `/api/tenant/crm/v1/customer-profiles` | `crm.customer_profiles.read` (scoped) | query |
| GET | `/api/tenant/crm/v1/customer-profiles/capabilities` | **none** — branch membership | query |
| GET | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.read` (scoped) | record |
| PATCH | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.update` (scoped) | record |
| POST | `/api/tenant/crm/v1/customer-profiles/:id/contacts` | `crm.customer_profiles.update` (scoped) | record |
| DELETE | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer_profiles.delete` (scoped) | record |

## GET /customer-profiles — list

`CustomerProfilesQueryDto extends BranchListQueryDto`:

| Parameter | Type | Required |
| --- | --- | --- |
| `branchId` | UUIDv7 | **yes** |
| `page`, `limit`, `sortBy`, `sortOrder` | pagination | no |
| `profileType` | `CrmProfileTypeEnum` | no — `INDIVIDUAL` \| `CORPORATE` |
| `status` | `CustomerStatusEnum` | no — 4 values |
| `acquisitionSourceId` | UUIDv7 | no |
| `ownerUserId` | UUIDv7 | no — **narrows only** |

Response `200`, paginated `{ items, meta }` — raw CRM shape.

## POST /customer-profiles/:id/contacts

Adds a contact person to a **corporate** profile. Requires
`crm.customer_profiles.update`, not a separate contacts permission.

Previously documented as not Gateway-exposed. That was wrong — verified
exposed on 2026-08-27 as `crm.customer.profiles.contacts.post`.

## PATCH /customer-profiles/:id

Also the board view's drag target. Moving a card between columns sends
`{ status }` — there is no dedicated stage endpoint here, because customer
status is a fixed enum rather than a tenant catalogue.

`BLACKLISTED` is terminal in practice and should confirm before sending.

## DELETE /customer-profiles/:id

Returns **`204`** with no body.

## Frontend notes

- **The board axis is `CustomerStatusEnum`** — a fixed 4-value enum, in this
  order: `PROSPECT`, `ACTIVE_CUSTOMER`, `INACTIVE`, `BLACKLISTED`.
  Unlike leads and opportunities this needs **no catalogue fetch**, and the
  column set never varies by tenant.
- Default view is `table` — a customer list is a directory, not a funnel.
  Leads and opportunities default to `board`.
- Core owns the underlying party directory; CRM owns the profile. Do not try
  to join them client-side.

## Portal status

| Capability | Status |
| --- | --- |
| List, branch-scoped, paginated | live (read-only) |
| Detail route | live (read-only) |
| **Board view** | **not built** |
| **Card view** | **not built** |
| **Table view** | **not built** — currently a flat list, no switcher |
| Capabilities-driven actions | not wired |
| Create / update / delete | not started |
| Add contact | not started |
