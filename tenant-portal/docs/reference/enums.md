# Enum Wire Values

Status: **verified**

Last source verification: **2026-08-27**

Source: `../backend/mutakamel-apps/crm-app/node_modules/@mutakamel/crm-app-common/dist/enums/crm.enums.d.ts`
(package version `0.0.1` — the **installed artifact**, which is what the
running service actually compiled against).

## Rules

1. **Values are case-sensitive protocol.** `"ACTIVE_CUSTOMER"`, never
   `"active_customer"`. Backend validation is `@IsEnum` with
   `forbidNonWhitelisted: true` — a wrong case is a 422, not a coercion.
2. **Never display a wire value.** Every value below needs a `t.status.*` label
   in both dictionaries. See [../design/i18n.md](../design/i18n.md#enum-labels-are-dictionary-entries).
3. **Never translate a wire value** being sent to the backend.
4. **Keep unknown values recoverable.** If the backend adds a value this table
   does not list, render it via a fallback label rather than crashing or
   silently dropping the record. Then update this file from source.
5. Colors come from [../design/tokens.md](../design/tokens.md#status-mapping),
   which is exhaustive over this file. The two must stay in sync.

## Type and category enums

These are **categories, not states**. They take `ink` and never a hue.

### `CrmProfileTypeEnum`

| Value | Used by |
| --- | --- |
| `INDIVIDUAL` | Leads (`leadProfileType`), Customer profiles (`profileType`) |
| `CORPORATE` | same |

### `CrmActivityTypeEnum`

`CALL` · `MEETING` · `EMAIL` · `VISIT` · `NOTE` · `FOLLOW_UP` · `OTHER`

### `CrmActivityDirectionEnum`

`INBOUND` · `OUTBOUND` · `INTERNAL`

### `CrmCustomFieldOwnerTypeEnum`

`PARTY` · `LEAD` · `LEAD_AND_PARTY` · `CUSTOMER_PROFILE` · `OPPORTUNITY`

### `CrmCustomFieldTypeEnum`

`TEXT` · `TEXTAREA` · `NUMBER` · `DATE` · `DATETIME` · `BOOLEAN` · `SELECT` ·
`MULTI_SELECT` · `URL` · `EMAIL` · `PHONE`

Drives which input primitive renders a custom field:

| Field type | Primitive |
| --- | --- |
| `TEXT`, `URL`, `EMAIL`, `PHONE` | `Input` (with matching `type`) |
| `TEXTAREA` | `Textarea` |
| `NUMBER` | `Input type="number"`, `tabular-nums` |
| `DATE`, `DATETIME` | `Input type="date"` / `datetime-local"` |
| `BOOLEAN` | `Switch` |
| `SELECT` | `Select` |
| `MULTI_SELECT` | `Select` multiple |

### `CrmFieldRequirementOperationEnum`

`CREATE` · `UPDATE` · `CONVERT`

Which operation a custom field is required for.

### `CrmReminderChannelEnum`

`IN_APP` · `EMAIL` · `SMS`

### `PipelineAccessModeEnum`

| Value | Meaning |
| --- | --- |
| `ALL` | Every tenant user with pipeline read access sees this pipeline |
| `RESTRICTED` | Access limited to explicitly granted users/teams |

## Status enums

These carry outcome and **do** take a role color.

### `LeadStatusEnum`

| Value | Role |
| --- | --- |
| `OPEN` | ink + motion |
| `CONVERTED` | positive |
| `DISQUALIFIED` | negative |
| `ON_HOLD` | caution |

### `LeadStageFlagEnum`

The **semantic** flag on a tenant-defined lead stage. The tenant names its own
stages; this flag is how the backend derives lifecycle meaning from them.

| Value | Role | Terminal? |
| --- | --- | --- |
| `NEW` | ink + motion | no |
| `CONTACTED` | ink + motion | no |
| `QUALIFYING` | ink + motion | no |
| `QUALIFIED` | positive | no |
| `NURTURING` | caution | no |
| `ON_HOLD` | caution | no |
| `CONVERTED` | positive | **yes** |
| `DISQUALIFIED` | negative | **yes** |

Terminal moves require confirmation — see
[../design/views.md](../design/views.md#board-view).

### `OpportunityStatusEnum`

| Value | Role |
| --- | --- |
| `IN_PROGRESS` | ink + motion |
| `ON_HOLD` | caution |
| `WON` | positive |
| `LOST` | negative |

### `OpportunityStageFlagEnum`

| Value | Role | Terminal? |
| --- | --- | --- |
| `NEW` | ink + motion | no |
| `DISCOVERY` | ink + motion | no |
| `QUALIFICATION` | ink + motion | no |
| `PROPOSAL` | ink + motion | no |
| `NEGOTIATION` | ink + motion | no |
| `CONTRACTING` | ink + motion | no |
| `ON_HOLD` | caution | no |
| `WON` | positive | **yes** |
| `LOST` | negative | **yes** |

Nine values. This is the concrete reason stage is never encoded by hue — see
[../design/README.md](../design/README.md#1-four-hues--and-a-stage-is-never-one-of-them).

### `CustomerStatusEnum`

| Value | Role |
| --- | --- |
| `PROSPECT` | ink + motion |
| `ACTIVE_CUSTOMER` | positive |
| `INACTIVE` | caution |
| `BLACKLISTED` | negative |

**Also the board column axis for Customer Profiles**, in exactly this order.

### `StageCategoryEnum`

Coarse grouping applied to a stage definition.

| Value | Role |
| --- | --- |
| `OPEN` | ink + motion |
| `IN_PROGRESS` | ink + motion |
| `POSITIVE` | positive |
| `NEGATIVE` | negative |

### `CrmActivityStatusEnum`

`OPEN` (ink + motion) · `DONE` (positive)

### `CrmTaskStatusEnum`

| Value | Role |
| --- | --- |
| `OPEN` | ink + motion |
| `IN_PROGRESS` | ink + motion |
| `DONE` | positive |
| `CANCELLED` | negative |

### `CrmReminderStatusEnum`

| Value | Role |
| --- | --- |
| `PENDING` | caution |
| `SENT` | positive |
| `CANCELLED` | negative |

### `CrmReminderTargetTypeEnum`

`TASK` · `CALENDAR_EVENT`

### `CrmPriorityEnum`

The one deliberate exception to "categories take no hue" — priority genuinely
is an attention signal.

| Value | Role |
| --- | --- |
| `URGENT` | caution |
| `HIGH` | caution |
| `MEDIUM` | ink |
| `LOW` | ink |

## Non-enum constrained values

Validated with `@IsIn`, not `@IsEnum`, so they have no exported enum. Same
rules apply.

### Activity `sourceType`

`LEAD` · `CUSTOMER_PROFILE` · `PARTY` · `OPPORTUNITY`

Source: `crm-app/src/crm/common/dto/crm-list-query.dto.ts` → `ActivitiesQueryDto`.

### Auth session `clientType`

`WEB` · `IOS` · `ANDROID` · `DESKTOP`

Source: Core tenant-auth session contract. The browser is always `WEB`.

## Sort and pagination values

From `PaginationQueryDto` (`@mutakamel/database`), inherited by every CRM list
query via `BranchListQueryDto`.

| Parameter | Values |
| --- | --- |
| `sortDir` | `ASC` · `DESC` — **defaults to `ASC`**, not to the endpoint's natural order |
| `sortBy` | Per-endpoint; the API page lists the allowed set |
| `page` | Integer ≥ 1 |
| `limit` | Integer, endpoint-bounded |

**The parameter is `sortDir`.** This table called it `sortOrder` until
2026-08-31 — the fifth page on the project to carry that error.
`sortOrder` is a real name but a different thing: a **server-owned entity
column** on ordered catalogues (pipeline stages, acquisition sources), written
through a reorder route that takes a full ordered id list. It is not a query
parameter anywhere, and sending it is silently ignored.

Two more traps that the shared DTO cannot express, so they are per endpoint:
`sortBy` must be validated against each endpoint's own whitelist, and several
CRM lists (tasks, calendar events, reminders) **accept `sortBy`/`sortDir` and
then ignore them**, ordering by a fixed column. Do not offer a sort control on
a list whose server will not honour it.

## Core and Trade enums

Not yet extracted. Core's tenant enums live in
`core-app/node_modules/@mutakamel/core-app-contracts/dist/`; Trade's in the
equivalent `trade-app` package.

**Extract them from the installed `.d.ts` the same way before building any
Core or Trade screen** — do not read them from a controller's Swagger example,
which can drift from the compiled enum. Record the package version here when
you do.

## Regenerating this file

```bash
cat ../backend/mutakamel-apps/crm-app/node_modules/@mutakamel/crm-app-common/dist/enums/crm.enums.d.ts
node -e "console.log(require('../backend/mutakamel-apps/crm-app/node_modules/@mutakamel/crm-app-common/package.json').version)"
```

If a value appears there that is not in this file, this file is stale. Update
it **and** [../design/tokens.md](../design/tokens.md#status-mapping) in the
same change — an unmapped status has no color.
