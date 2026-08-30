# Admin Portal UI Quality Matrix

Status: **[Baseline tracker; no route is certified by this file]**

Baseline review: **2026-08-29**

Owner: **Admin Portal**

## Purpose

This matrix tracks evidence for the approved cold-blue and operational UX
contracts. It is independent from API/source route parity and deployment
readiness.

A blank or `NOT_RUN` cell means no evidence was recorded; it does not mean the
route failed. Source inspection, a screenshot, and an authenticated workflow are
separate evidence levels.

## Evidence codes

| Code | Meaning |
| --- | --- |
| `SRC` | Source reviewed against the target contract |
| `PUB` | Public route exercised at runtime |
| `AUTH` | Protected workflow exercised with a real authorized session |
| `KB` | Keyboard-only workflow completed |
| `SR` | Screen-reader smoke test recorded |
| `RESP` | Required viewport/zoom/coarse-pointer matrix recorded |
| `I18N` | English/LTR and Arabic/RTL behavior recorded |
| `THEME` | Light and dark behavior recorded |
| `STATE` | Applicable loading/refresh/empty/stale/partial/error/forbidden/ambiguous states recorded |
| `OBS` | Preliminary runtime observation; one or more metadata fields required for a formal evidence code were not recorded |
| `NOT_RECORDED` | Preliminary review occurred, but required metadata/artifact was not committed to this matrix |

Evidence codes must include a date, environment, route/build identity, and a
link or reference to the result. Do not mark a code from expectation alone.

## Current baseline

| Route family | Current evidence | Highest-priority target gap | New-contract status |
| --- | --- | --- | --- |
| Login, forgot password | `SRC`; limited public `OBS` | Complete keyboard, SR, zoom/reflow, coarse-pointer, and browser-metadata record | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Invite/reset password | `SRC`; limited public `OBS` | Complete token/error/focus matrix with valid and invalid tokens | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Dashboard | `SRC`; unauthenticated redirect `OBS` | Authenticated charts, alternatives, refresh guard, and state matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Tenant directory | `SRC` | Authenticated responsive table, sorting, filters, and row-action verification | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Tenant creation | `SRC` | Authenticated bilingual step, error-summary, focus, and narrow-width verification | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Tenant workspace | `SRC` | Authenticated responsive hierarchy, operational states, and action-safety matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Database/Storage Servers | `SRC` | Authenticated freshness, table, and high-impact confirmation matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Backup/Restore | `SRC` | Authenticated exact-retry and ambiguous-outcome reload/failure states | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Provisioning | `SRC` | Authenticated operation timelines and domain-authorized bulk/risk behavior | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Settings | `SRC` | Authenticated narrow SubNav, field/error, and ambiguous-save recovery | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Users/Roles | `SRC` | Authenticated permission-aware actions, menus, bulk behavior, and confirmation | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Applications | `SRC` | Authenticated lifecycle, permission, menu, and responsive-state matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Audit/Logging | `SRC` | Authenticated evidence-table, live-update, privacy-stop, and state matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Reports | `SRC` | Authenticated data-table, filtering, export, and responsive-state matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Subscriptions | `SRC` | Authenticated billing state, action safety, and responsive verification | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Invoices | `SRC` | Authenticated financial table, formatting, download, and responsive verification | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Notifications/Profile | `SRC` | Authenticated menu/disclosure, async announcement, and narrow-topbar matrix | `SOURCE_UPDATED / RUNTIME_PENDING` |
| Floating WebPhone | `SRC` | Resolve the Admin Core route-inventory drift, then verify authenticated SIP/call behavior, safe-area/collision, and target sizes | `SOURCE_UPDATED / CONTRACT_AND_RUNTIME_PENDING` |

All `SRC` entries above refer to the 2026-08-29 implementation run recorded by
task `01a04b12-1fd8-7033-b33e-77d07f5c46ee`. They indicate reviewed source and
automated coverage, not route conformance. Protected routes were not exercised
with an authenticated session.

## Implementation gates

These gates describe source integrity and are intentionally separate from route
conformance evidence.

| Date | Gate | Result | Reference |
| --- | --- | --- | --- |
| 2026-08-29 | TypeScript | Pass (`tsc --noEmit`) | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | ESLint | Pass, zero warnings | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | Unit/component tests | Pass: 1,168 tests across 199 files | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | RTL source guard | Pass: zero violations | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | Design census | Pass: 686 source files; no prohibited categories; baseline check pass | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | Documentation | Pass: 75 Markdown files and 246 generated route records checked | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |
| 2026-08-29 | Production build | Pass (`next build`, Next.js 16.3.3; 47 static-generation entries completed) | `01a04b12-1fd8-7033-b33e-77d07f5c46ee` |

## Preliminary public runtime observations

These observations used the local Next.js development server on port 5001 in
the Codex in-app Browser on Windows. The exact browser engine/version was not
recorded, so they remain `OBS` rather than formal `PUB`, `RESP`, `I18N`,
`THEME`, or `STATE` evidence. Artifact reference:
`01a04b12-1fd8-7033-b33e-77d07f5c46ee`.

| Date | Route and state | Language/theme/viewport | Observation | Evidence |
| --- | --- | --- | --- | --- |
| 2026-08-29 | `/login`, default and invalid submit | EN/LTR and AR/RTL; light and dark; 1280×720 and 320×800 | Cold-blue light and preserved dark themes rendered; no horizontal overflow at 320px; empty submit focused a linked alert summary and kept inline errors; malformed email was blocked locally, focused, and kept a persistent error; console errors were empty | `OBS` (limited public, i18n, theme, and validation-state scope) |
| 2026-08-29 | `/admin/reset-password`, missing token | Public; 320×800 | Missing-token state rendered with heading, explanatory copy, and back link; no horizontal overflow | `OBS` (limited public/error-state scope) |
| 2026-08-29 | `/admin/accept-invite`, missing token | Public; 320×800 | Missing-token state rendered with heading, explanatory copy, and back link; no horizontal overflow | `OBS` (limited public/error-state scope) |
| 2026-08-29 | `/dashboard`, unauthenticated | Default public session | Redirected to `/login` | `OBS` (access-guard scope only) |

Keyboard Tab progression was not completed by the browser automation API. No
keyboard, screen-reader, authenticated, required-width/zoom/coarse-pointer,
CVD, or LCP/INP/CLS claim is made from these observations.

## Required route record

Use one row per tested route/state:

| Date | Build/environment | Client environment | Route and state | Permission role | Language/direction | Theme | Viewport/input | Evidence codes | Result/issues | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | commit + deployment/local identity | OS/device, browser + version, AT + version or N/A | route + state | role/permissions | EN/LTR or AR/RTL | light/dark | width, zoom/reflow, pointer | codes | pass or issue IDs | screenshot/test/report |

## Completion rule

A route family is `TARGET_VERIFIED` only when applicable keyboard, responsive,
bilingual, theme, operational-state, and authenticated-runtime evidence exists.
Lint, typecheck, build, a static RTL guard, or route parity alone cannot set
this status.

Use the complete requirements in
[Accessibility, responsive behavior, and localization](../design-system/accessibility-responsive-and-localization.md#verification-matrix)
and the implementation phases in
[Cold-Blue Design Update Roadmap](../design-system/design-update-roadmap.md).
