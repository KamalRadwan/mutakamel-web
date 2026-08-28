# Mutakamel Tenant Portal

The standalone Next.js application for the Tenant browser experience. Caddy
routes the configured Tenant hosts to its fixed port `5002`.

Arabic-first and RTL by default, with full English LTR support. Bilingual and
dual-theme are requirements on every screen, not follow-up work.

## Runtime

- Next.js 16.2.11, React 19.2.4, Tailwind CSS 4, TypeScript strict.
- Fixed development and production port: **`5002`**.
- Browser API traffic goes through API Gateway only.
- In development, Next proxies same-origin `/api/*` to `DEV_API_TARGET`
  (default `http://localhost:9000`). Production keeps this rewrite disabled
  because deployment ingress owns the `/api/*` namespace.
- `TENANT_GATEWAY_INTERNAL_ORIGIN` is required by `next start`. It is a
  server-only Gateway origin used to verify the original Tenant `Host` before
  any authenticated provider or page renders. Origin only — no credentials,
  path, query or fragment. See `.env.example`.

Canonical tenant API prefixes:

```text
/api/tenant/core/v1/*     Core   — identity, session, notifications, workspace
/api/tenant/crm/v1/*      CRM    — leads, customers, opportunities, catalogues
/api/tenant/trade/v1/*    Trade  — no portal screen yet
```

Worker has no tenant browser API. Its asynchronous results are read through
Core, CRM or Trade projections.

## Documentation

Start with **[docs/README.md](docs/README.md)**.

The set is written so that an agent implementing a feature never has to stop
and ask a question. It covers the design system end to end (tokens, type,
geometry, motion, primitives, patterns, the three-view contract, shell,
theming, i18n, anti-patterns, enforcement), the file architecture and
dependency rules, the data layer, backend API contracts by domain, and the
exact permission and enum wire values.

If you are executing the rebuild, read
**[docs/build/HANDOFF.md](docs/build/HANDOFF.md)**.

## Current status

| Area | Status |
| --- | --- |
| Transport and session layer | Production-grade and tested. Not to be rewritten |
| Host admission | Implemented, fails closed, tested |
| Notifications + realtime | Implemented, Zod-validated, tested |
| CRM — leads, customers, opportunities, catalogues | Server-backed; presentation layer pending rebuild |
| Core — sign-in sessions | Server-backed |
| Trade | Backend real (231 routes); no portal screen |
| Design system | **Specified, not yet implemented** — see `docs/design/` |
| Sealed route scaffolds | 45 routes behind the unavailable boundary, scheduled for deletion |

Documentation is not runtime evidence. Verify each capability against current
source, tests, and an authenticated deployment before treating it as complete.

## Commands

From `C:\mutakamel.ai\frontend`:

```powershell
pnpm --filter tenant-portal dev
pnpm --filter tenant-portal verify
pnpm --filter tenant-portal build
```

From `tenant-portal/`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server on 5002 |
| `pnpm verify` | typecheck + lint + test + docs:check + design:rtl |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the design-system rules |
| `pnpm test` | Vitest |
| `pnpm docs:routes` | Regenerate the Gateway route inventory from backend source |
| `pnpm docs:api-reference` | Regenerate the per-app route reference pages |
| `pnpm docs:check` | Fail on stale generated docs, broken links, or missing metadata |
| `pnpm design:census -- --check` | Fail on design-system regressions |
| `pnpm design:rtl` | Fail on physical direction utilities |
| `pnpm build` | Production build |

Do not run this application on an alternate port.

> `pnpm typecheck` can fail on stale `.next` generated types after files move.
> Run `rm -rf .next` first. Tracked as D7 in
> [docs/build/DEFECTS.md](docs/build/DEFECTS.md).
