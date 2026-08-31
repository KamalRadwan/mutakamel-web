# Detail Screens & Lead Conversion

Status: **Specification**

Written: **2026-08-28**

Resolves [OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) Q2 and Q3.

Two record detail screens — Lead and Customer Profile — plus the lead
conversion flow that connects them.

## Routes

| Screen | Route | Data |
| --- | --- | --- |
| Lead detail | `/crm/leads/[id]` | `GET /api/tenant/crm/v1/leads/:id` |
| Customer detail | `/crm/customer-profiles/[id]` | `GET /api/tenant/crm/v1/customer-profiles/:id` |

Customer detail already exists as a read-only page; it is rebuilt on this
spec. Lead detail is new. Both are reachable from the first column of their
workspace's table and card views, and from a board card on `Enter`.

## Layout — one pattern, both screens

No tabs. A sales rep opening a lead is scanning for a phone number, a stage and
a next step; tabs hide two of those behind a click. One scroll, two columns.

```
┌─ PageHeader ───────────────────────────────────────────────┐
│ ‹ back    Display name          [StatusBadge]              │
│           subtitle: type · source            [actions ▾]   │
├──────────────────────────────────┬─────────────────────────┤
│ MAIN  (min-w-0, flex-1)          │ RAIL  (320px, shrink-0) │
│                                  │                         │
│  Card: Identity                  │  Card: Ownership        │
│  Card: Contact methods           │  Card: Stage / status   │
│  Card: Address                   │  Card: Custom fields    │
│  Card: Corporate contacts *      │  Card: Record metadata  │
│                                  │                         │
└──────────────────────────────────┴─────────────────────────┘
```

`*` corporate only — hidden when `profileType === "INDIVIDUAL"`.

Below `lg` the rail stacks **above** the main column: ownership and stage are
what a phone user checks first.

Every card is `surface.base` — border, no shadow, `rounded-md`, `p-4`, and a
`text-lg` weight-500 title.

## The action cluster

`PageHeader`'s `secondaryActions`, gated by the screen's `capabilities`
response — never by permission strings ([D11](../build/DEFECTS.md#d11--actions-gated-by-permission-strings-not-capabilities)).

### Lead

| Action | Variant | Gate | Behavior |
| --- | --- | --- | --- |
| **Convert** | `primary` | `leads.convert` | Opens the conversion drawer. **The one primary on the screen** |
| Move stage | `outline` | `leads.update` | `Select` of lead stages, ordered by `sortOrder` |
| Edit | `outline` | `leads.update` | `FormDrawer` on `UpdateLeadDto` |
| Delete | `ghost`, `text-destructive` | `leads.delete` | `AlertDialog` |

Convert is hidden once `status === "CONVERTED"` — the backend returns
`LEAD_ALREADY_CONVERTED` (409), and offering an action that always fails is
worse than not offering it.

### Customer profile

| Action | Variant | Gate | Behavior |
| --- | --- | --- | --- |
| **Add contact** | `primary` | `customer_profiles.update` + `CORPORATE` | `POST /:id/contacts` |
| Edit | `outline` | `customer_profiles.update` | `FormDrawer` on `UpdateCustomerProfileDto` |
| Change status | `outline` | `customer_profiles.update` | `PATCH` with `{ status }` |
| Delete | `ghost`, `text-destructive` | `customer_profiles.delete` | `AlertDialog` |

On an `INDIVIDUAL` profile there is no primary action — the header simply has
none. Do not promote Edit to fill the slot; the one-primary rule is a ceiling,
not a quota.

## Custom fields

Both screens render tenant-defined custom fields in the rail.

1. `GET /custom-fields` — definitions for the owner type (`LEAD`,
   `CUSTOMER_PROFILE`, or `LEAD_AND_PARTY`)
2. `GET /custom-fields/values` — this record's values
3. Render by `CrmCustomFieldTypeEnum` using the mapping in
   [../reference/enums.md](../reference/enums.md#crmcustomfieldtypeenum)

Read-only in the rail; editing happens in the record's `FormDrawer`, where
per-operation requirement flags apply. A field required for `UPDATE` blocks
submission there; it never blocks the detail view from rendering.

Empty state: hide the card entirely. An empty "Custom fields" card is noise on
a tenant that defines none.

## Not on these screens

Activities, notes, attachments and outbound email all have working endpoints
and appear in the `capabilities` response — and are **deliberately absent**.

Each needs its own composition work (timeline, upload, compose), and shipping a
half-timeline is worse than shipping none. The detail screen is designed so an
`Activity` card drops into the main column later without relayout.

Do not add a disabled tab or an empty placeholder for them. An affordance that
does nothing is the fabricated-behavior failure in
[anti-patterns.md](anti-patterns.md#13-fake-data-and-fake-success).

---

# Lead conversion

`POST /api/tenant/crm/v1/leads/:id/convert` · `crm.leads.convert` (scoped) ·
returns **201**.

The highest-consequence write in the CRM: it creates a customer profile, its
contacts, and optionally an opportunity, in one call. Success is not reversible
from the UI.

## Request — `ConvertLeadDto`

| Field | Type | Required |
| --- | --- | --- |
| `profileType` | `CrmProfileTypeEnum` | **yes** |
| `displayName` | string, max 180 | no |
| `companyName` | string, max 180 | no |
| `primaryContact` | `LeadConversionContactPersonDto` | no |
| `createOpportunity` | boolean | no |
| `opportunity` | `ConvertLeadOpportunityDto` | no |

Full nested shapes in [../reference/dto-fields.md](../reference/dto-fields.md).

## The flow — a three-step drawer, not a dialog

`FormDrawer`, `side="end"`. A dialog is wrong here: the form is long, and the
user needs to re-read the lead behind it.

### Step 1 — Profile

`profileType` prefilled from the lead's `leadProfileType`, and **changeable** —
a lead captured as individual often converts as a company.

- `CORPORATE` → `companyName` required, `displayName` optional
- `INDIVIDUAL` → `displayName` required, `companyName` hidden

Prefill from the lead. Do not make the user retype what was captured.

### Step 2 — Primary contact

`LeadConversionContactPersonDto`: `fullName` (required, max 180), plus
optional `firstName`, `lastName`, `jobTitle`, `email`, and up to 20
`contactMethods`.

Each contact method is `methodType` — `PHONE` · `MOBILE` · `EMAIL` ·
`WHATSAPP` · `WEBSITE` · `OTHER` — plus a `value` (max 255) and optional
`label` (max 80).

Prefill from the lead's own contact data. `ArrayMaxSize(20)` is enforced
server-side; enforce it in the UI too so the 422 never happens.

### Step 3 — Opportunity (optional)

A `Switch` bound to `createOpportunity`, default **on** — converting a lead
without creating an opportunity is the unusual case.

When on, `ConvertLeadOpportunityDto` fields appear, including a pipeline and
stage selector. **A terminal stage is rejected** — the backend returns
`LEAD_CONVERSION_OPPORTUNITY_STAGE_TERMINAL` (422). Filter `WON`/`LOST` stages
out of the selector rather than letting the user pick one and fail.

### Review before submit

The last step is a read-only summary: what will be created, and under which
branch and owner. This write is not reversible from the UI, so the user sees it
in full before committing.

## Success

`201` returns `{ lead, customerProfile, opportunity }`.

Do **not** just close and toast. Render an in-body success panel with three
links:

```
Lead converted.
  → View customer profile   /crm/customer-profiles/{customerProfile.id}
  → View opportunity        /crm/opportunities?pipelineId=…&highlight={opportunity.id}
  → Back to leads
```

A toast disappears in four seconds and takes the only reference to two
newly-created records with it. The panel persists until the user navigates.

## Failures

| Code | HTTP | Handling |
| --- | --- | --- |
| `LEAD_ALREADY_CONVERTED` | 409 | Close the drawer, refetch — the lead's state changed underneath |
| `LEAD_CONVERSION_INVALID` | 422 | In-body, at the top of the drawer |
| `LEAD_CONVERSION_OPPORTUNITY_REQUIRED` | 422 | Step 3 — the switch is on but fields are incomplete |
| `LEAD_CONVERSION_OPPORTUNITY_STAGE_TERMINAL` | 422 | Step 3 — should be unreachable if the selector filters correctly |
| `LEAD_CONTACT_NAME_REQUIRED` | 422 | Step 2 — inline on `fullName` |
| `LEAD_COMPANY_NAME_REQUIRED` | 422 | Step 1 — inline on `companyName` |

Full list: [../reference/error-codes.md](../reference/error-codes.md).

## Idempotency — the part that matters

Conversion is `WRITE_SENSITIVE`. `axiosClient` attaches a UUIDv7
`x-idempotency-key` automatically.

**Generate the key once when the drawer opens, and reuse that exact key for
every retry of that attempt.** A new key on retry converts the lead twice.

If the request times out or the connection drops, the outcome is **ambiguous** —
it may have created a customer and an opportunity. Do not show failure, and do
not silently retry. Render the persistent ambiguous-outcome panel with the
idempotency key and a retry-exact affordance, per
[patterns.md](patterns.md#ambiguous-outcomes).

This is the single most important error path in the application: getting it
wrong creates duplicate customers that a human has to merge by hand.

## Definition of done

- [ ] Both detail screens render real data with capabilities-gated actions
- [ ] Custom fields render by type; the card hides when there are none
- [ ] Conversion drawer prefills from the lead
- [ ] Terminal stages filtered out of the opportunity selector
- [ ] Review step before submit
- [ ] Success panel with all three links — not a toast
- [ ] One idempotency key per attempt, reused on retry
- [ ] Ambiguous outcome renders the persistent panel
- [ ] Convert hidden when already converted
- [ ] Both languages, both themes, keyboard-operable
