# Testing

Status: **verified against current tests**

Last verification: **2026-08-28**

Resolves [OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) Q6.

Current state: **26 files, 181 tests, all passing.** The patterns below are
extracted from those files — follow them rather than inventing a new approach.

## Setup

```ts
// vitest.config.mts
test: { environment: "node", globals: true, setupFiles: ["./tests/setup.ts"] }
```

```ts
// tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

**The default environment is `node`, not `jsdom`.** That is deliberate — most
tests are pure contract tests that do not need a DOM, and `node` is
dramatically faster.

A test that renders components opts in per file:

```ts
/**
 * @vitest-environment jsdom
 */
```

Five files do this today (`AuthContext.test.tsx`, the two accessibility files,
`NavbarLinks.test.tsx`, `page.test.tsx`). If your test does not render, do not
opt in.

## The four kinds of test

### 1. Contract tests — the default, and the most valuable

The dominant pattern. **Export the pure parse/build functions from the hook**
and test them directly. No renderer, no mocks, no transport.

```ts
// useLeads.ts
export function parseLeadsResponse(payload: unknown): LeadListPage { … }
export function buildCreateLeadRequest(form: LeadForm): CreateLeadDto { … }

// useLeads.test.ts
import { parseLeadsResponse, buildCreateLeadRequest } from "./useLeads";

it("reads the canonical raw list payload", () => {
  expect(parseLeadsResponse({ items: [lead], total: 1, page: 1, … }))
    .toEqual({ items: [expected], pageInfo: { … } });
});
```

This is what makes the CRM hooks trustworthy without an integration harness.
When you add a hook, export its parse and build functions and test them the
same way.

**Every parser needs three cases:**

1. A valid payload, shaped exactly as the API page documents.
2. A malformed payload — asserts it throws rather than returning partial data.
3. **An unknown enum value — asserts it does NOT throw.** One new backend
   value must never take a screen down
   ([enums.md](../reference/enums.md#rules)).

Use realistic UUIDv7 fixtures (`01900100-0000-7000-8000-…`), not `"id-1"`.
A `@IsUUID('7')` field rejects anything else, and a fake fixture hides that.

### 2. Pure logic tests

Permission matching, route allowlists, formatters, ordering. No environment.

`lib/navigation/tenant-routes.test.ts` is the reference — note that it asserts
the **negative** cases too (`crm.leads.readonly` and `crm.leads.read.evil` must
*not* satisfy `crm.leads.read`). Keep those; a prefix-match regression is
silent otherwise.

### 3. Component and accessibility tests

`jsdom`, `@testing-library/react`. Test behavior a user can observe, never
implementation.

`Dropdowns.accessibility.test.tsx` is the reference:

```ts
it("labels the user disclosure and restores focus on Escape", () => { … });
```

Required per interactive component:

- Accessible name present
- Keyboard operation works (`Escape`, arrows, `Enter`)
- Focus returns to the trigger on close
- `aria-expanded` / `aria-checked` reflect state

**Query by role and accessible name**, not by test id — that is what asserts
the accessibility contract at the same time.

### 4. Transport and session tests

`lib/api/axiosClient.auth.test.ts` and `lib/auth/*.test.ts`. These cover the
generation fencing, refresh coordination and cross-tab behavior.

**Do not modify these during the design-system rebuild.** If one breaks, you
changed something in the spine that you should not have.

## What to test per phase

| Phase | Required |
| --- | --- |
| 1 — Delete | Existing tests still pass. Update those asserting on deleted routes; **say so in the commit** |
| 2 — Foundation | Theme/language resolution from storage; the `system` theme path; storage throwing |
| 3 — Components | Per primitive and pattern — see below |
| 4 — Screens | Each converted screen's parse/build functions; the defect fixes |

### Phase 3 minimum

- `Button` — `loading` sets `aria-busy`; `asChild` renders one child
- `Field` — `htmlFor`, `aria-describedby`, `aria-invalid` wiring
- `Dialog` — focus trap, `Escape`, focus restoration
- `DataTable` — pagination and sort callbacks fire with the right arguments; empty and error states render
- `ViewSwitcher` — arrow-key navigation, `aria-checked`
- `StatusBadge` — **an unmapped value renders a fallback rather than throwing**

### Phase 4 defect regressions

Each fix needs a test that fails before it:

- **D1** — type a distinct address into the reset dialog; assert *that* address reaches the request body
- **D5** — assert the login page renders no hardcoded Arabic when `lang === "en"`
- **D11** — assert an action is hidden when its capability is `null`
- **D12** — assert no user-facing string contains "Kanban"

## What not to test

- **Design tokens.** `census.mjs` and `contrast.mjs` cover those; a test
  asserting a hex value just duplicates the token.
- **Third-party behavior.** Radix's focus trap is Radix's to test. Test that
  you wired it, not that it works.
- **Snapshots of markup.** They fail on every legitimate restyle and teach
  people to run `-u` without reading. There are none in this repo; keep it that
  way.
- **The backend.** A contract test asserts *the client handles this shape*, not
  that the server sends it. Server truth comes from reading source.

## Running

```bash
pnpm test                    # all
pnpm test -- useLeads        # one file
pnpm test -- --watch         # while working
```

A phase is not done with a failing or a **removed** test. If a test genuinely
no longer applies, delete it in a commit that says why — silently dropping
tests to make a gate green makes every later gate meaningless.
