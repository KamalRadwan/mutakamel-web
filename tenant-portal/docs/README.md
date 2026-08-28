# Tenant Portal Documentation

Last full rebuild: **2026-08-27**

This set is written to one standard: **an agent implementing a feature should
never have to stop and ask a question.** Every value that a screen needs — a
color, a font size, a control height, an enum wire value, a permission string,
a route, a folder name, a dictionary key — is written down somewhere in here as
an exact value, not as a principle to interpret.

If you find yourself about to ask "which X should I use?", that is a bug in
this documentation. Record it in [build/OPEN-QUESTIONS.md](build/OPEN-QUESTIONS.md)
and pick the option most consistent with the surrounding rules.

## Reading order

Do not skim. These are ordered so that each one assumes the previous.

| # | Read | Why |
| --- | --- | --- |
| 1 | [CONTRACT.md](CONTRACT.md) | How to tell truth from prose; source precedence |
| 2 | [architecture/file-architecture.md](architecture/file-architecture.md) | Where every file goes and what may import what |
| 3 | [architecture/routing.md](architecture/routing.md) | Route groups, layouts, guards, the release allowlist |
| 4 | [architecture/data-layer.md](architecture/data-layer.md) | Transport, hooks, response validation, errors |
| 5 | [design/DESIGN-SYSTEM.md](design/DESIGN-SYSTEM.md) | **The complete design spec** — read in full |
| 6 | [design/anti-patterns.md](design/anti-patterns.md) | The banned list. Read before writing any markup |
| 7 | [api/README.md](api/README.md) | Gateway rules, envelopes, idempotency |
| 8 | The specific `api/*.md` for your feature | Routes, DTOs, permissions, errors |
| 9 | [build/HANDOFF.md](build/HANDOFF.md) | If you are executing the rebuild |

## Map

```text
docs/
  CONTRACT.md            documentation rules and source precedence
  architecture/          how the application is put together
  design/                the design system — tokens through components
  api/                   backend contracts, by domain
  reference/             permissions, enum wire values, error codes
  build/                 the rebuild plan and its handoff
  generated/             regenerated from backend source; never hand-edit
```

### architecture/

| File | Contents |
| --- | --- |
| [file-architecture.md](architecture/file-architecture.md) | Folder tree, naming rules, dependency direction, barrel policy |
| [routing.md](architecture/routing.md) | Route groups, layouts, host admission, the proxy allowlist |
| [data-layer.md](architecture/data-layer.md) | `axiosClient`, hook shape, runtime response validation, error normalization |
| [security-headers.md](architecture/security-headers.md) | Nginx Proxy Manager vs app-owned CSP, and the nonce |
| [testing.md](architecture/testing.md) | Test kinds, patterns, what to test per phase |
| [state.md](architecture/state.md) | What state lives where, and what is never client-owned |

### design/

| File | Contents |
| --- | --- |
| **[DESIGN-SYSTEM.md](design/DESIGN-SYSTEM.md)** | **The complete spec — palette, type, sizing, libraries, per-page UI/UX** |
| [README.md](design/README.md) | The five laws, and the index |
| [tokens.md](design/tokens.md) | Four color roles, OKLCH ramps, semantic tokens, both themes |
| [typography.md](design/typography.md) | Font pairing, 7-step scale, 3-weight policy, Arabic lift |
| [geometry.md](design/geometry.md) | Radius, spacing, control heights, row density, elevation |
| [motion.md](design/motion.md) | The animation budget and every permitted keyframe |
| [primitives.md](design/primitives.md) | Every primitive's exact props and variants |
| [patterns.md](design/patterns.md) | Every composite pattern's exact props |
| [views.md](design/views.md) | **The three-view contract** — board, card, table |
| [detail-screens.md](design/detail-screens.md) | Lead & customer detail, and the conversion flow |
| [accessibility.md](design/accessibility.md) | The single per-screen a11y checklist |
| [shell.md](design/shell.md) | Sidebar, topbar, navigation map |
| [theming.md](design/theming.md) | Light/dark, RTL, and the no-flash requirement |
| [i18n.md](design/i18n.md) | Dictionary structure and the zero-ternary rule |
| [anti-patterns.md](design/anti-patterns.md) | What must never appear in this codebase |
| [enforcement.md](design/enforcement.md) | Census, RTL guard, ESLint rules, CI gates |

### api/

| File | Contents |
| --- | --- |
| [README.md](api/README.md) | Canonical paths, envelopes, idempotency, pagination |
| [core-auth.md](api/core-auth.md) | Login, refresh, logout, `/me`, sessions, invite, reset |
| [core-notifications.md](api/core-notifications.md) | Notification list, read, read-all, realtime |
| [crm-leads.md](api/crm-leads.md) | Leads, stages, conversion, capabilities |
| [crm-customer-profiles.md](api/crm-customer-profiles.md) | Profiles, contacts, capabilities |
| [crm-opportunities.md](api/crm-opportunities.md) | Opportunities, pipelines, stages, board |
| [crm-catalogues.md](api/crm-catalogues.md) | Lead stages, acquisition sources, custom fields, settings, static data |
| [core-reference.md](api/core-reference.md) | **Generated** — all 199 Core routes |
| [crm-reference.md](api/crm-reference.md) | **Generated** — all 143 CRM routes |
| [trade-reference.md](api/trade-reference.md) | **Generated** — all 231 Trade routes; not yet built |

### reference/

| File | Contents |
| --- | --- |
| [permissions.md](reference/permissions.md) | Every permission string and its scope semantics |
| [enums.md](reference/enums.md) | Every enum's exact case-sensitive wire values |
| [errors.md](reference/errors.md) | Error handling policy — status, codes, ambiguous outcomes |
| [dto-fields.md](reference/dto-fields.md) | **Generated** — every request-body field, 46 classes |
| [error-codes.md](reference/error-codes.md) | **Generated** — 95 error codes with HTTP status |

## Canonical browser paths

```text
/api/tenant/core/v1/*   ->  API Gateway  ->  core-app
/api/tenant/crm/v1/*    ->  API Gateway  ->  crm-app
/api/tenant/trade/v1/*  ->  API Gateway  ->  trade-app
```

API Gateway is the **only** browser-facing backend edge. Controller-relative
paths (`/crm/leads`, `/tenant/auth`) are backend implementation detail and must
never appear in browser code. `worker-app` has no tenant browser API at all —
its results are read through Core, CRM, or Trade projections.

## Hard rules

These are repeated in [AGENTS.md](../AGENTS.md) because they are the ones that
cause real damage when broken.

1. **Never edit anything under `../backend/`.** Read it to verify contracts.
2. **Port `5002`.** Never run this app on another port.
3. **Never invent** a DTO field, enum value, permission string, route, or error
   code. If source does not prove it, it does not exist.
4. **Never compute** financial, permission, entitlement, or lifecycle truth in
   the browser. The backend is authoritative; the UI reflects it.
5. **Preserve exactly**: decimal strings, UUIDs, cursors, ETags, version pins,
   idempotency keys. Never parse a decimal into a JavaScript number.
6. **No feature is done** until it is server-backed, bilingual, themed in both
   light and dark, keyboard-operable, and tested.

## Verification

From `tenant-portal/`:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm docs:routes:check
pnpm design:census -- --check
pnpm design:rtl
pnpm build
```

A green run of all seven is the definition of done for a phase. See
[design/enforcement.md](design/enforcement.md) for what each gate actually
measures and how to move a baseline honestly.
