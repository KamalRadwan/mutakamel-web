# Trade — Route Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:api-reference`.
> Generator: `scripts/docs/generate-api-reference.mjs`
> Source: `docs/generated/tenant-api-routes.json`

Status: **verified** (Gateway exposure and transport policy only)

Last source verification: **2026-09-09**

Generated at: **2026-09-09T17:42:21.852Z**

Backend revision: `22e119066314`

Owning app: **trade-app**

Routes: **231**

## What this page is

The exhaustive method-and-path index for every Gateway route owned by
trade-app on the tenant master. It proves Gateway exposure and
transport policy. It does **not** prove DTO fields, permissions, response
shapes or error codes — those live in the hand-written pages:

- [trade-foundation.md](trade-foundation.md)
- [trade-documents.md](trade-documents.md)
- [trade-advanced.md](trade-advanced.md)

Read [README.md](README.md) first for envelopes, pagination, idempotency and
the capabilities contract.

Routes marked `DO_NOT_CALL` are tenant-master reachable platform or
integration endpoints, not application feature APIs. Never call them from
browser code.

## Routes

| Method | Canonical path | Route key | Class | Idempotent | Portal usage |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/tenant/trade/v1/catalog/uoms` | `trading.catalog.uoms.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/channels` | `trading.channels.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/channels` | `trading.channels.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/channels/:id` | `trading.channels.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/channels/:id` | `trading.channels.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/channels/:id/branches` | `trading.channels.by-id.branches.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/channels/:id/branches/:branchId` | `trading.channels.by-id.branches.by-branch-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/commercial-accounts` | `trading.commercial.accounts.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/commercial-accounts` | `trading.commercial.accounts.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/commercial-accounts/:id` | `trading.commercial.accounts.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id` | `trading.commercial.accounts.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/block` | `trading.commercial.accounts.by-id.block.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules` | `trading.commercial.accounts.by-id.branch.rules.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId` | `trading.commercial.accounts.by-id.branch.rules.by-branch-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit` | `trading.commercial.accounts.by-id.evaluate.credit.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/unblock` | `trading.commercial.accounts.by-id.unblock.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/commercial-accounts/lookups` | `trading.commercial.accounts.lookups.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `trading.configuration.company-default-price-books.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `trading.configuration.company-default-price-books.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `trading.configuration.company-default-price-books.upsert.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/configuration/definitions` | `trading.configuration.definitions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/definitions` | `trading.configuration.definitions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/definitions/:id/versions` | `trading.configuration.definitions.by-id.versions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/resolve` | `trading.configuration.resolve.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/publish` | `trading.configuration.versions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/test` | `trading.configuration.versions.by-id.test.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/contracts` | `trading.contracts.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/contracts` | `trading.contracts.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/contracts/:documentId/render-jobs/:renderJobId` | `trading.contracts.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/contracts/:documentId/render-pdf` | `trading.contracts.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/contracts/:id` | `trading.contracts.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/contracts/:id` | `trading.contracts.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/contracts/:id/activate` | `trading.contracts.by-id.activate.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/control-tower/exceptions` | `trading.control.tower.exceptions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/control-tower/exceptions/:id` | `trading.control.tower.exceptions.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/resolve` | `trading.control.tower.exceptions.by-id.resolve.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/retry` | `trading.control.tower.exceptions.by-id.retry.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards` | `trade.dashboard.list.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards` | `trade.dashboard.create.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboard.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboard.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/dashboards/:id` | `trade.dashboard.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/duplicate` | `trade.dashboard.duplicate.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/dashboards/:id/layout` | `trade.dashboard.layout.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/placements` | `trade.dashboard.placements.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/placements/:placementId` | `trade.dashboard.placements.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/run` | `trade.dashboard.run.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-default` | `trade.dashboard.set.default.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-favorite` | `trade.dashboard.set.favorite.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/:id/shares` | `trade.dashboard.shares.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/shares/:shareId` | `trade.dashboard.shares.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert` | `trade.dashboard.shares.bulk.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/catalog` | `trade.dashboard.catalog.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/default` | `trade.dashboard.default.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/dashboards/from-template/:templateKey` | `trade.dashboard.from.template.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/navigation` | `trade.dashboard.navigation.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/dashboards/share-targets` | `trade.dashboard.share.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/decisions/:id` | `trading.decisions.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/publish` | `trading.document.profile.versions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/validate` | `trading.document.profile.versions.by-id.validate.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/document-profiles` | `trading.document.profiles.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/document-profiles` | `trading.document.profiles.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/document-profiles/:id/versions` | `trading.document.profiles.by-id.versions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/extensions/profiles` | `trading.extensions.profiles.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/extensions/profiles` | `trading.extensions.profiles.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id` | `trading.extensions.profiles.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/extensions/profiles/:id` | `trading.extensions.profiles.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/publish` | `trading.extensions.profiles.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/validate` | `trading.extensions.profiles.by-id.validate.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions` | `trading.extensions.profiles.by-id.versions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId` | `trading.extensions.profiles.by-id.versions.by-version-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/extensions/targets` | `trading.extensions.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/import-mappings` | `trading.import.mappings.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/import-mappings` | `trading.import.mappings.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/import-mappings/:id` | `trading.import.mappings.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/import-mappings/:id` | `trading.import.mappings.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/imports` | `trading.imports.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/imports/:runId` | `trading.imports.by-run-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/imports/:runId/execute` | `trading.imports.by-run-id.execute.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/imports/:runId/results` | `trading.imports.by-run-id.results.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/imports/preview` | `trading.imports.preview.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/imports/sources` | `trading.imports.sources.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/imports/sources/:id/release` | `trading.imports.sources.by-id.release.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/availability` | `trading.inventory.availability.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/decisions` | `trading.inventory.decisions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/decisions/:id` | `trading.inventory.decisions.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/deliveries` | `trading.inventory.deliveries.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/post` | `trading.inventory.deliveries.by-id.post.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/reverse` | `trading.inventory.deliveries.by-id.reverse.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/nodes` | `trading.inventory.nodes.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/nodes` | `trading.inventory.nodes.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/nodes/:id` | `trading.inventory.nodes.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/inventory/nodes/:id` | `trading.inventory.nodes.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/opening-balances` | `trading.inventory.opening.balances.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/periods` | `trading.inventory.periods.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/periods` | `trading.inventory.periods.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/close` | `trading.inventory.periods.by-id.close.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/reopen` | `trading.inventory.periods.by-id.reopen.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/receipts` | `trading.inventory.receipts.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/post` | `trading.inventory.receipts.by-id.post.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/reverse` | `trading.inventory.receipts.by-id.reverse.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/reservations` | `trading.inventory.reservations.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/reservations/:id/release` | `trading.inventory.reservations.by-id.release.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/serials` | `trading.inventory.serials.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/serials/:id` | `trading.inventory.serials.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/inventory/uom-conversions` | `trading.inventory.uom.conversions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions` | `trading.inventory.uom.conversions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/publish` | `trading.inventory.uom.conversions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/retire` | `trading.inventory.uom.conversions.by-id.retire.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/invoices` | `trading.invoices.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/invoices` | `trading.invoices.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/invoices/:documentId/render-jobs/:renderJobId` | `trading.invoices.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/invoices/:documentId/render-pdf` | `trading.invoices.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/invoices/:id` | `trading.invoices.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/invoices/:id` | `trading.invoices.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/invoices/:id/issue` | `trading.invoices.by-id.issue.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/items` | `trading.items.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/items` | `trading.items.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/items/:id` | `trading.items.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/items/:id` | `trading.items.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/items/:id/branch-profile` | `trading.items.by-id.branch.profile.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/items/:id/branch-profile` | `trading.items.by-id.branch.profile.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/items/:id/channel-listings` | `trading.items.by-id.channel.listings.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/items/:id/channel-listings` | `trading.items.by-id.channel.listings.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/items/:id/channel-listings/:channelId` | `trading.items.by-id.channel.listings.by-channel-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/items/:id/company-profile` | `trading.items.by-id.company.profile.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/items/:id/company-profile` | `trading.items.by-id.company.profile.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/items/search` | `trading.items.search.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/policies` | `trading.policies.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policies` | `trading.policies.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policies/:id/versions` | `trading.policies.by-id.versions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/policy-versions/:id` | `trading.policy.versions.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/approve` | `trading.policy.versions.by-id.approve.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/publish` | `trading.policy.versions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/reject` | `trading.policy.versions.by-id.reject.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/retire` | `trading.policy.versions.by-id.retire.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/rollback` | `trading.policy.versions.by-id.rollback.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/submit` | `trading.policy.versions.by-id.submit.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/test` | `trading.policy.versions.by-id.test.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/policy-versions/:id/validate` | `trading.policy.versions.by-id.validate.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/price-book-versions/:id` | `trading.price.book.versions.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/publish` | `trading.price.book.versions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/test` | `trading.price.book.versions.by-id.test.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/price-books` | `trading.price.books.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/price-books` | `trading.price.books.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/price-books/:id/versions` | `trading.price.books.by-id.versions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/pricing/evaluate` | `trading.pricing.evaluate.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-orders` | `trading.purchase.orders.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders` | `trading.purchase.orders.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-orders/:documentId/render-jobs/:renderJobId` | `trading.purchase-orders.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:documentId/render-pdf` | `trading.purchase-orders.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-orders/:id` | `trading.purchase.orders.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/purchase-orders/:id` | `trading.purchase.orders.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/approve` | `trading.purchase.orders.by-id.approve.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/cancel` | `trading.purchase.orders.by-id.cancel.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/confirm` | `trading.purchase.orders.by-id.confirm.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/reject` | `trading.purchase.orders.by-id.reject.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/submit` | `trading.purchase.orders.by-id.submit.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/withdraw` | `trading.purchase.orders.by-id.withdraw.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-quotations` | `trading.purchase-quotations.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-quotations` | `trading.purchase-quotations.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-jobs/:renderJobId` | `trading.purchase-quotations.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-pdf` | `trading.purchase-quotations.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/purchase-quotations/:id` | `trading.purchase-quotations.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/purchase-quotations/:id` | `trading.purchase-quotations.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-quotations/:id/issue` | `trading.purchase-quotations.by-id.issue.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/purchase-quotations/search` | `trading.purchase-quotations.search.post` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/quotations` | `trading.quotations.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations` | `trading.quotations.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/quotations/:id` | `trading.quotations.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/quotations/:id` | `trading.quotations.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/accept` | `trading.quotations.by-id.accept.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/cancel` | `trading.quotations.by-id.cancel.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/convert-to-sales-order` | `trading.quotations.by-id.convert.to.sales.order.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/reject` | `trading.quotations.by-id.reject.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/revisions` | `trading.quotations.by-id.revisions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:id/send` | `trading.quotations.by-id.send.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/quotations/:quotationId/render-jobs/:renderJobId` | `trading.quotations.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/:quotationId/render-pdf` | `trading.quotations.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/quotations/customer-options` | `trading.quotations.customer-options.get` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/quotations/search` | `trading.quotations.search.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/sales-orders` | `trading.sales.orders.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders` | `trading.sales.orders.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/sales-orders/:documentId/render-jobs/:renderJobId` | `trading.sales-orders.render-pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:documentId/render-pdf` | `trading.sales-orders.render-pdf` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/sales-orders/:id` | `trading.sales.orders.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/sales-orders/:id` | `trading.sales.orders.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:id/cancel` | `trading.sales.orders.by-id.cancel.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirm` | `trading.sales.orders.by-id.confirm.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId` | `trading.sales.orders.by-id.confirmation.attempts.by-attempt-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId/cancel` | `trading.sales.orders.by-id.confirmation.attempts.by-attempt-id.cancel.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:id/hold` | `trading.sales.orders.by-id.hold.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/sales-orders/:id/release-hold` | `trading.sales.orders.by-id.release.hold.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/uoms` | `trading.uoms.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/uoms` | `trading.uoms.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/uoms/:id` | `trading.uoms.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/uoms/:id` | `trading.uoms.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/webhooks/deliveries` | `trading.webhooks.deliveries.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/webhooks/deliveries/:id` | `trading.webhooks.deliveries.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/webhooks/deliveries/:id/retry` | `trading.webhooks.deliveries.by-id.retry.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/webhooks/events` | `trading.webhooks.events.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions` | `trading.webhooks.subscriptions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions` | `trading.webhooks.subscriptions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `trading.webhooks.subscriptions.by-id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `trading.webhooks.subscriptions.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/revoke-secret` | `trading.webhooks.subscriptions.by-id.revoke.secret.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/rotate-secret` | `trading.webhooks.subscriptions.by-id.rotate.secret.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/test` | `trading.webhooks.subscriptions.by-id.test.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/widgets` | `trade.widget.list.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/widgets` | `trade.widget.create.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/widgets/:id` | `trade.widget.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/widgets/:id` | `trade.widget.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/widgets/:id` | `trade.widget.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/widgets/:id/clone` | `trade.widget.clone.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/widgets/:id/shares` | `trade.widget.shares.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/trade/v1/widgets/:id/shares/:shareId` | `trade.widget.shares.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/widgets/:id/shares/bulk-upsert` | `trade.widget.shares.bulk.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/widgets/preview` | `trade.widget.preview.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/widgets/share-targets` | `trade.widget.share.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/trade/v1/workflow-versions/:id` | `trading.workflow.versions.by-id.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/approve` | `trading.workflow.versions.by-id.approve.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/publish` | `trading.workflow.versions.by-id.publish.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/reject` | `trading.workflow.versions.by-id.reject.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/retire` | `trading.workflow.versions.by-id.retire.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/rollback` | `trading.workflow.versions.by-id.rollback.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/submit` | `trading.workflow.versions.by-id.submit.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/test` | `trading.workflow.versions.by-id.test.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/validate` | `trading.workflow.versions.by-id.validate.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/trade/v1/workflows` | `trading.workflows.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflows` | `trading.workflows.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/trade/v1/workflows/:id/versions` | `trading.workflows.by-id.versions.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
