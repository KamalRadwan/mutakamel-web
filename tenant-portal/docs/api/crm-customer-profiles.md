# CRM — Customer Profiles

Status: **verified**

Last source verification: **2026-08-31**

Owning app: **crm-app**

Canonical prefix: `/api/tenant/crm/v1/customer-profiles`

Portal status: **built** — list in three views, detail, create, update, status
change, delete and add-contact. Not exercised against a live session: CRM is
blocked twice over, by P4 and by Q17.

`GET /:id` returns `CustomerProfileReadModel`, which joins the acquisition
source and a Party summary and **no contact relationships** — a profile can
gain a contact and cannot list the ones it has (Q41). The registration
identifiers (`taxNumber`, `commercialRegistrationNumber`) live on the joined
Party, not on the profile row.

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
| `page`, `limit`, `sortBy`, `sortDir` | pagination | no — `sortDir` is `ASC`/`DESC`, see [README.md#sort-parameters-differ-per-endpoint](README.md#sort-parameters-differ-per-endpoint) |
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

### `BLACKLISTED` is sticky, and today the server does not honour that

**Decided 2026-08-31**, from the CRM audit review's open question 2: *is
`BLACKLISTED` sticky, or may a WON opportunity clear it?*

**The decision is sticky** — it clears only on an explicit re-activation with an
audit trail. A blacklist is a compliance and consent state, recorded by a human
on purpose. A sales outcome must not silently overrule it, because the system
then forgets a decision somebody deliberately made.

**Verified against source, and crm-app does not implement that today.** Two call
sites promote the customer unconditionally when an opportunity enters `WON`:

| Site | What it does |
| --- | --- |
| `opportunities.service.ts:223` | `updateById(customerProfileId, { status: ACTIVE_CUSTOMER })` on a status-set WIN |
| `opportunities.service.ts:708` | The same, on a stage move that enters a `WON`-flagged stage |

Neither reads the current status first. The blacklist is overwritten with no
audit event distinguishing it from an ordinary promotion.

The path is reachable, though it needs an ordering: `opportunities.service.ts:137`
refuses to **create** an opportunity for a blacklisted customer
(`409 CUSTOMER_PROFILE_BLACKLISTED`). So the sequence is *open the opportunity
while the customer is active → blacklist the customer → win the opportunity*,
and the blacklist is gone. Blacklisting rarely happens before a deal exists; it
happens because of one.

**What this means for the portal.** Do not present `BLACKLISTED` as a state the
UI can rely on persisting, and do not build a "customer is blacklisted" gate
that assumes the flag survives. Treat a customer that changed from
`BLACKLISTED` to `ACTIVE_CUSTOMER` without a user action as a possible instance
of this, not as data. This is an ask on crm-app — guard both promotions with
`WHERE status <> 'BLACKLISTED'`, and add an explicit audited re-activation —
not something the portal can fix.

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
| List, branch-scoped, paginated | live |
| Detail route | live — full action cluster and custom-fields rail |
| Board view | live — `CustomerStatusEnum` axis, no catalogue fetch |
| Card view | live |
| Table view | live |
| Capabilities-driven actions | live — edit, status, delete and add-contact |
| Create / update / delete | live — `POST`, `PATCH /:id`, `DELETE /:id` |
| Add contact | live — `POST /:id/contacts`; **this route declares `organizationScopeMode: NONE`, so it must send NO scope headers** |
| Contacts list | **no route exists** — the read model joins no relationships, see OPEN-QUESTIONS.md Q41 |
