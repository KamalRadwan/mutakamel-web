# Detail Screens & Lead Conversion

Status: **Specification**

Written: **2026-08-28**

**One Lead implementation update — 2026-09-07:** the current lead layout and
interaction contract are maintained in [Views → Leads](views.md#leads).
Company contains only organization data; people appear once in the separate
Contacts collection: two equal-width person cards per row, each with its own
edit modal. Company also edits in a modal, without contacts.
The end rail now has History (default), Activities and Attachments icon tabs.
Activities shares its card template with the lead activity modal; Attachments
has Add attachment at the top and per-file download. Both lists read all pages.
There is no duplicate main-column attachments card or standalone notes card.
Details remains immediately editable for authorized, non-converted leads.
One Lead uses Small density: 8px card padding/gaps, 28px controls, 24px identity
avatars, and two-row textareas. Shared patterns opt into compact spacing; other
screens keep their defaults. The call/WhatsApp/Telegram phone actions use local
colored glyphs matching their real destinations. See the linked Views contract
for exact sizing and the contact-icon source/licence reference.
Corporate identity
editing additionally uses permission-gated Directory routes; CRM alone updates
job title/primary selection. That scoped
specification supersedes the original Lead layout below; Customer Profile is
unchanged. The conversion section below documents the replacement modal.

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
| **Convert** | `primary` | `leads.convert` | Opens the centered Small conversion modal |
| Move stage | `outline` | `leads.update` | `Select` of lead stages, ordered by `sortOrder` |
| Card edit | `ghost` | `leads.update` | Company/Contact modal on the relevant card; no top Edit button |
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

Updated 2026-09-07 at the product owner's request. The old conversion drawer,
step UI, page-wide edit drawer and unused edit hook have been removed.
Company/Contact edit modals and always-editable Details remain unchanged.

## API contract

`POST /api/tenant/crm/v1/leads/:id/convert` · scoped `crm.leads.convert` ·
201. The complete DTO fields, server semantics, lookup permissions and actual
response are maintained in [CRM Leads API](../api/crm-leads.md#post-leadsidconvert).
All conversion DTOs and the service transaction were read before implementation.

## Centered Small modal

Use `LeadConvertModal` composed from `FormModal size="card"
density="compact"`: centered 672px maximum width, viewport-bounded scrollable
body and persistent footer. It is not a Sheet or a side drawer.
Standard modal focus trap, focus return, dirty-close confirmation, translated
labels and RTL behavior are inherited from the design system.

The top action bar has **Convert**, not a page-wide Edit button. Editing belongs
to the existing Company/Contacts modals and Details card. Conversion requires
the record's branch/owner capability and writable access; converted leads do
not offer a new conversion. A retained result has a **Conversion result**
action so closing the modal does not lose the receipt during this mounted visit.

### Profile and contacts

- Profile type is read-only and matches the lead. Display/company names start
  from the record; blank optional names are omitted to retain server fallback.
- Company fields are hidden for an individual.
- Show the existing primary contact name when present; do not copy it into a
  new-person payload. An individual uses its existing person automatically.
- **Create a new primary contact** defaults off, only for corporate leads.
  Enabling it reveals full name, first name, last name, job title, email and
  at most 20 typed contact methods with value/label. Row keys are stable and
  UI-only; neither row IDs nor existing contact IDs go into this DTO.
- A full name OR a composed first/last name is required for a new person.
  Apply DTO lengths, email validation and duplicate-method normalization.

### Optional opportunity

**Create an opportunity** defaults off and requires its own creation capability.
When enabled, display pipeline, its non-terminal stage membership, title,
importance (0–3), amount, currency, salesperson, expected close date,
probability (0–100), description and applicable CREATE custom fields.

Pipeline changes clear stage selection. Only active, accessible pipelines and
active memberships are options; Won/Lost are excluded. Owners are verified
Core users intersected with the capability boundary, with an explicit inherit
option; never ask users to paste UUIDs. Amount stays a decimal string in form
state and is converted only by the checked money helper at the DTO boundary.
Blank optional values are omitted; valid zero/false custom values are retained.

Reference failures are visible, not empty successful lists. Pipeline failure
blocks opportunity submission and has Retry. Unavailable custom-field
definitions display the shared degraded notice; the server remains authoritative
for requirements. The user may turn the opportunity off and convert just the
customer profile.

### Review, submit and success

The first footer action validates and switches to a read-only review of the
same sections without sending an API request. **Back to editing** unlocks the
fields; **Confirm conversion** sends the validated DTO. In-flight requests
disable fields, close and submit; a synchronous guard prevents double posting.
Authorization and reference membership are checked again before the write.

The actual 201 response is `{ lead, customerProfileId, opportunityId? }`.
Validate the full lead and matching converted references. Show a persistent
receipt with View customer profile, optional View opportunity, and Back to leads
links using the returned IDs. Hide and block Submit in a receipt-only state.
Closing and reopening retains the receipt. Navigating to another lead remounts
the record workspace so forms and attempt state cannot cross record IDs.

### Failure and safe retry

A definite refusal preserves the draft and shows a translated API error.
409 also refetches the lead. The server's qualification setting, owner checks
and custom-field requirements remain authoritative.

Generate one UUIDv7 idempotency key **at first confirmed submission**, not on
open. Retain that exact key and request body for retries of this attempt.
Timeout/transport/5xx uncertainty freezes the form and retains evidence across
close/reopen; show the request key, available support reference, explicit
same-request Retry and Refresh lead. Never automatically retry or offer an
edited request while the outcome is uncertain. A definite refusal permits
editing; changed fields create a new intent/key. Applied-but-unreadable 2xx
offers refresh only, not another conversion.

## Verification

Contract tests cover all DTO fields, limits, optional omission, money/zero
values, duplicate contacts and flat service receipts. Hook tests cover review,
double submission, permission changes, membership IDs, custom-field loading,
owner inheritance and immutable retries. Modal tests cover both languages,
Small centered layout, opt-in contacts, dirty cancel and persistent success.
No live lead is converted as a test; runtime visual verification still requires
working tenant admission and an authorized session.
