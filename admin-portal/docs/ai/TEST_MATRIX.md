# Test and Validation Matrix

Last source verification: **2026-07-30**

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
9. Tenant profile PATCH never sends `storageServerId`.
10. `403` never renders as empty.
11. Pagination uses `meta.total`.
12. Financial strings remain strings.
13. Exact retry preserves its original UUIDv7 idempotency key.

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
