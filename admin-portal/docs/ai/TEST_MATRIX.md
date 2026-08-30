# Test and Validation Matrix

Last source verification: **2026-08-05**

## Domain API minimum

For each domain module, cover applicable cases:

- success and canonical success envelope;
- invalid request and field mapping;
- unauthenticated and coordinated refresh boundary;
- forbidden rendered distinctly from empty;
- not found, duplicate, and conflict;
- idempotency in-flight and mismatch;
- stale optimistic update;
- `204` with no body;
- pagination through `meta.total`;
- decimal-string and byte-string preservation;
- unknown additive enum fallback;
- unavailable capability;
- asynchronous accepted and terminal-failure states;
- exact ALL and ANY permission behavior.

## Required regressions

1. No `GET /tenants/:id/fqdns`.
2. Tenant-user suspend, activate, and restore use `POST`.
3. FQDN create sends `{ fqdn }`.
4. Primary FQDN uses `POST`.
5. Subscription cancellation uses `/subscriptions/:tenantId/cancel`.
6. Wallet adjustment previews before confirmation.
7. Tenant create uses `ANNUAL`, never `YEARLY`.
8. Tenant create never submits hardcoded database IDs.
9. Database placement receives the exact selected `applicationKeys` and a
   changed Application set clears the prior database selection.
10. Tenant create loads Applications, technical selection evidence, and active
    tiers through one `GET /tenants/create-options` request under only
    `admin.tenants.create`; `403`, malformed, and unavailable responses never
    render as an empty catalogue or trigger broad-API fallback.
11. Tenant-create quote authorization accepts logical ANY of
    `admin.tenants.create` and `admin.catalog.read`; the wizard does not require
    the latter permission.
12. Quote sends UUIDv7 `items`; create sends the matching keys only inside the
    nested `subscription.items` shape.
13. Core/Worker foundation components are server-derived preview evidence,
    never user-selectable Applications.
14. Tenant profile PATCH never sends `storageServerId`.
15. `403` never renders as empty.
16. Pagination uses `meta.total`.
17. Financial strings remain strings.
18. Exact retry preserves its original UUIDv7 idempotency key.
19. Backup start, restore start, and restore promotion send caller-owned UUIDv7
    keys and retain them for ambiguous/authentication retries of the exact body.
20. A changed backup/restore intent receives a new key; a definitive completion
    resets the prior key.
21. Backup policy and per-tenant override upserts use `PATCH`; no `PUT` alias
    exists in Worker, Gateway, or frontend source.
22. Public artifact reads stay bounded while internal run purge is exhaustive
    beyond 500 artifacts.

## UI quality baseline

For representative authentication, dashboard, tenant, infrastructure, backup,
settings, audit/logging, and WebPhone workflows, record applicable checks for:

- English/LTR and Arabic/RTL;
- light and dark themes;
- 320, 360, 375, 414, 768, 1024, and 1440px widths;
- keyboard-only completion and visible, unobscured focus;
- persistent labels, inline errors, error summaries, and focus recovery;
- screen-reader smoke testing of landmarks, dialogs, menus, tables, live status,
  and charts;
- 200% zoom, 400% reflow where applicable, text resizing, and coarse-pointer
  target areas;
- reduced motion;
- initial loading, refreshing, empty, filtered-empty, stale, partial, forbidden,
  failed, conflict, in-flight, and ambiguous states;
- responsive tables, fixed overlays, safe areas, and WebPhone collisions;
- chart legends, exact-value access, and localized text/table alternatives.

Use the full matrix in
[Accessibility, responsive behavior, and localization](../design-system/accessibility-responsive-and-localization.md#verification-matrix).
Passing source commands below does not satisfy this runtime matrix.

## Validation commands

Run from `C:\mutakamel.ai\frontend\admin-portal`:

```powershell
npm run docs:check
npx tsc --noEmit
npx vitest run
npm run lint -- --max-warnings=0
npm run build
git diff --check
```

Record exact command output and counts. Do not call these live runtime evidence.
If the default Next.js build fails at the webpack/Turbopack configuration
boundary, `npm run build -- --webpack` may be run as additional diagnostic
evidence. A passing explicit webpack build does not replace the required
default-build result.

## Runtime evidence

Authenticated end-to-end status requires:

- a running Admin Portal, Gateway, and Core environment;
- an authorized real session;
- the relevant permissions;
- successful and negative browser/API behavior;
- correlation IDs for unexpected failures;
- explicit environment/release identity.
