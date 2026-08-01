<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenant Portal Rules

- **Strict Backend Code Prohibition**: NEVER edit, modify, or update any backend file under `../backend/` or any backend application under any circumstances. Only read backend files for contract verification.

## Documentation-First Implementation

- Read `docs/ai/START_HERE.md` and `docs/DOCUMENTATION_CONTRACT.md` before
  implementing a feature.
- Browser requests use only canonical Gateway paths:
  `/api/tenant/core/v1/*`, `/api/tenant/crm/v1/*`, and
  `/api/tenant/trade/v1/*`. Never call owning apps or Worker directly.
- Verify a feature in this order: Gateway route contract, owning controller and
  guards, DTO/enums, service/response/tests, then old-web replacement evidence.
  Mocks and comments are not API contracts.
- Do not invent missing endpoints, fields, permissions, state transitions, or
  response projections. Record a backend gap in `docs/ai/KNOWN_GAPS.md`.
- Preserve tenant, company, branch, channel, team, own/all, seat, feature, and
  subscription boundaries. Client-side visibility is not authorization.
- Update the corresponding API, validation, security, example, and AI index
  pages when implementation changes a documented contract or replacement
  status.
- Run `npm run docs:routes` after Gateway route contracts change and
  `npm run docs:check` before completing documentation work.
- Files under `docs/generated/` are generated evidence and must not be edited
  by hand.
- Visual design documentation is intentionally outside this documentation set.
