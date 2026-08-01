# Trade Gateway Route Coverage

> Contract status: source-verified complete Gateway inventory
> Verification date: 2026-07-25
> Backend owner: Trade
> Documentation: source-generated from verified Gateway routes, Trade controllers/DTOs/services/tests, and legacy frontend evidence
> Canonical browser prefix: `/api/tenant/trade/v1`
> Controller-relative prefix: `/trade` under upstream `/api/v1`
> Tenant Portal status: `tenant-portal` replaces the legacy Trade UI; no Trade implementation exists in the replacement frontend yet.

## Coverage result

The typed Gateway contract declares **226 routes**. Every route is assigned exactly once below and was matched to a Trade controller by method and upstream path. No Gateway-only route was found.

| Capability page | Gateway routes |
|---|---:|
| [catalog.md](catalog.md) | 19 |
| [commercial-accounts.md](commercial-accounts.md) | 10 |
| [configuration-scope.md](configuration-scope.md) | 6 |
| [control-tower.md](control-tower.md) | 4 |
| [dashboard-widgets.md](dashboard-widgets.md) | 11 |
| [dashboards.md](dashboards.md) | 20 |
| [document-platform.md](document-platform.md) | 5 |
| [documents.md](documents.md) | 22 |
| [extension-profiles.md](extension-profiles.md) | 9 |
| [extensions-automation.md](extensions-automation.md) | 21 |
| [financial-documents.md](financial-documents.md) | 10 |
| [inventory.md](inventory.md) | 26 |
| [pdf-render-jobs.md](pdf-render-jobs.md) | 12 |
| [policy-studio.md](policy-studio.md) | 13 |
| [pricing-price-books.md](pricing-price-books.md) | 10 |
| [purchase-quotations.md](purchase-quotations.md) | 6 |
| [purchasing.md](purchasing.md) | 10 |
| [workflow-versions.md](workflow-versions.md) | 12 |
| **Total** | **226** |

Authoritative sources:

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`
- `../backend/mutakamel-apps/trade-app/src/modules/**/*.controller.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts`

## Complete assignment

| Method | Canonical browser path | Controller-relative path | Gateway route key | Documentation owner | Route class | Gateway-idempotent | Transport retry |
|---|---|---|---|---|---|---|---|
| GET | `/api/tenant/trade/v1/dashboards/catalog` | `/trade/dashboards/catalog` | `trade.dashboard.catalog.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards/navigation` | `/trade/dashboards/navigation` | `trade.dashboard.navigation.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards/default` | `/trade/dashboards/default` | `trade.dashboard.default.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards/share-targets` | `/trade/dashboards/share-targets` | `trade.dashboard.share.targets.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards` | `/trade/dashboards` | `trade.dashboard.list.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards` | `/trade/dashboards` | `trade.dashboard.create.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/from-template/:templateKey` | `/trade/dashboards/from-template/:templateKey` | `trade.dashboard.from.template.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboard.by.id.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboard.by.id.patch` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/dashboards/:id` | `/trade/dashboards/:id` | `trade.dashboard.by.id.delete` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/duplicate` | `/trade/dashboards/:id/duplicate` | `trade.dashboard.duplicate.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-default` | `/trade/dashboards/:id/set-default` | `trade.dashboard.set.default.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/set-favorite` | `/trade/dashboards/:id/set-favorite` | `trade.dashboard.set.favorite.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/dashboards/:id/layout` | `/trade/dashboards/:id/layout` | `trade.dashboard.layout.patch` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/run` | `/trade/dashboards/:id/run` | `trade.dashboard.run.post` | [dashboards.md](dashboards.md) | `READ_HEAVY` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/placements` | `/trade/dashboards/:id/placements` | `trade.dashboard.placements.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/placements/:placementId` | `/trade/dashboards/:id/placements/:placementId` | `trade.dashboard.placements.delete` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| GET | `/api/tenant/trade/v1/dashboards/:id/shares` | `/trade/dashboards/:id/shares` | `trade.dashboard.shares.get` | [dashboards.md](dashboards.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert` | `/trade/dashboards/:id/shares/bulk-upsert` | `trade.dashboard.shares.bulk.post` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/dashboards/:id/shares/:shareId` | `/trade/dashboards/:id/shares/:shareId` | `trade.dashboard.shares.delete` | [dashboards.md](dashboards.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/widgets/preview` | `/trade/widgets/preview` | `trade.widget.preview.post` | [dashboard-widgets.md](dashboard-widgets.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/widgets/share-targets` | `/trade/widgets/share-targets` | `trade.widget.share.targets.get` | [dashboard-widgets.md](dashboard-widgets.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/widgets` | `/trade/widgets` | `trade.widget.list.get` | [dashboard-widgets.md](dashboard-widgets.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/widgets` | `/trade/widgets` | `trade.widget.create.post` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| GET | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widget.by.id.get` | [dashboard-widgets.md](dashboard-widgets.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widget.by.id.patch` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/widgets/:id` | `/trade/widgets/:id` | `trade.widget.by.id.delete` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| POST | `/api/tenant/trade/v1/widgets/:id/clone` | `/trade/widgets/:id/clone` | `trade.widget.clone.post` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| GET | `/api/tenant/trade/v1/widgets/:id/shares` | `/trade/widgets/:id/shares` | `trade.widget.shares.get` | [dashboard-widgets.md](dashboard-widgets.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/widgets/:id/shares/bulk-upsert` | `/trade/widgets/:id/shares/bulk-upsert` | `trade.widget.shares.bulk.post` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/widgets/:id/shares/:shareId` | `/trade/widgets/:id/shares/:shareId` | `trade.widget.shares.delete` | [dashboard-widgets.md](dashboard-widgets.md) | `WRITE_SENSITIVE` | false | `DEFAULT` |
| GET | `/api/tenant/trade/v1/items` | `/trade/items` | `trading.items.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/items/search` | `/trade/items/search` | `trading.items.search.post` | [catalog.md](catalog.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/items/:id` | `/trade/items/:id` | `trading.items.by-id.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/items` | `/trade/items` | `trading.items.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/items/:id` | `/trade/items/:id` | `trading.items.by-id.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/items/:id/company-profile` | `/trade/items/:id/company-profile` | `trading.items.by-id.company.profile.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/items/:id/company-profile` | `/trade/items/:id/company-profile` | `trading.items.by-id.company.profile.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/items/:id/branch-profile` | `/trade/items/:id/branch-profile` | `trading.items.by-id.branch.profile.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/items/:id/branch-profile` | `/trade/items/:id/branch-profile` | `trading.items.by-id.branch.profile.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/items/:id/channel-listings` | `/trade/items/:id/channel-listings` | `trading.items.by-id.channel.listings.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/items/:id/channel-listings` | `/trade/items/:id/channel-listings` | `trading.items.by-id.channel.listings.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/items/:id/channel-listings/:channelId` | `/trade/items/:id/channel-listings/:channelId` | `trading.items.by-id.channel.listings.by-channel-id.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/catalog/uoms` | `/trade/catalog/uoms` | `trading.catalog.uoms.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/channels` | `/trade/channels` | `trading.channels.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/channels` | `/trade/channels` | `trading.channels.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/channels/:id` | `/trade/channels/:id` | `trading.channels.by-id.get` | [catalog.md](catalog.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/channels/:id` | `/trade/channels/:id` | `trading.channels.by-id.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/channels/:id/branches` | `/trade/channels/:id/branches` | `trading.channels.by-id.branches.post` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/channels/:id/branches/:branchId` | `/trade/channels/:id/branches/:branchId` | `trading.channels.by-id.branches.by-branch-id.patch` | [catalog.md](catalog.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/commercial-accounts` | `/trade/commercial-accounts` | `trading.commercial.accounts.get` | [commercial-accounts.md](commercial-accounts.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/commercial-accounts` | `/trade/commercial-accounts` | `trading.commercial.accounts.post` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/commercial-accounts/lookups` | `/trade/commercial-accounts/lookups` | `trading.commercial.accounts.lookups.get` | [commercial-accounts.md](commercial-accounts.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/commercial-accounts/:id` | `/trade/commercial-accounts/:id` | `trading.commercial.accounts.by-id.get` | [commercial-accounts.md](commercial-accounts.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id` | `/trade/commercial-accounts/:id` | `trading.commercial.accounts.by-id.patch` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules` | `/trade/commercial-accounts/:id/branch-rules` | `trading.commercial.accounts.by-id.branch.rules.post` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/commercial-accounts/:id/branch-rules/:branchId` | `/trade/commercial-accounts/:id/branch-rules/:branchId` | `trading.commercial.accounts.by-id.branch.rules.by-branch-id.patch` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/evaluate-credit` | `/trade/commercial-accounts/:id/evaluate-credit` | `trading.commercial.accounts.by-id.evaluate.credit.post` | [commercial-accounts.md](commercial-accounts.md) | `READ_HEAVY` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/block` | `/trade/commercial-accounts/:id/block` | `trading.commercial.accounts.by-id.block.post` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/commercial-accounts/:id/unblock` | `/trade/commercial-accounts/:id/unblock` | `trading.commercial.accounts.by-id.unblock.post` | [commercial-accounts.md](commercial-accounts.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/configuration/definitions` | `/trade/configuration/definitions` | `trading.configuration.definitions.get` | [configuration-scope.md](configuration-scope.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/definitions` | `/trade/configuration/definitions` | `trading.configuration.definitions.post` | [configuration-scope.md](configuration-scope.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/definitions/:id/versions` | `/trade/configuration/definitions/:id/versions` | `trading.configuration.definitions.by-id.versions.post` | [configuration-scope.md](configuration-scope.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/test` | `/trade/configuration/versions/:id/test` | `trading.configuration.versions.by-id.test.post` | [configuration-scope.md](configuration-scope.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/versions/:id/publish` | `/trade/configuration/versions/:id/publish` | `trading.configuration.versions.by-id.publish.post` | [configuration-scope.md](configuration-scope.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/resolve` | `/trade/configuration/resolve` | `trading.configuration.resolve.post` | [configuration-scope.md](configuration-scope.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode` | `trading.configuration.company-default-price-books.get` | [pricing-price-books.md](pricing-price-books.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode/upsert` | `trading.configuration.company-default-price-books.upsert.post` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| DELETE | `/api/tenant/trade/v1/configuration/company-default-price-books/:purpose/:currencyCode` | `/trade/configuration/company-default-price-books/:purpose/:currencyCode` | `trading.configuration.company-default-price-books.delete` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/control-tower/exceptions` | `/trade/control-tower/exceptions` | `trading.control.tower.exceptions.get` | [control-tower.md](control-tower.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/control-tower/exceptions/:id` | `/trade/control-tower/exceptions/:id` | `trading.control.tower.exceptions.by-id.get` | [control-tower.md](control-tower.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/retry` | `/trade/control-tower/exceptions/:id/retry` | `trading.control.tower.exceptions.by-id.retry.post` | [control-tower.md](control-tower.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/control-tower/exceptions/:id/resolve` | `/trade/control-tower/exceptions/:id/resolve` | `trading.control.tower.exceptions.by-id.resolve.post` | [control-tower.md](control-tower.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/document-profiles` | `/trade/document-profiles` | `trading.document.profiles.get` | [document-platform.md](document-platform.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/document-profiles` | `/trade/document-profiles` | `trading.document.profiles.post` | [document-platform.md](document-platform.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/document-profiles/:id/versions` | `/trade/document-profiles/:id/versions` | `trading.document.profiles.by-id.versions.post` | [document-platform.md](document-platform.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/validate` | `/trade/document-profile-versions/:id/validate` | `trading.document.profile.versions.by-id.validate.post` | [document-platform.md](document-platform.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/document-profile-versions/:id/publish` | `/trade/document-profile-versions/:id/publish` | `trading.document.profile.versions.by-id.publish.post` | [document-platform.md](document-platform.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/quotations` | `/trade/quotations` | `trading.quotations.get` | [documents.md](documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/search` | `/trade/quotations/search` | `trading.quotations.search.post` | [documents.md](documents.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/quotations/customer-options` | `/trade/quotations/customer-options` | `trading.quotations.customer-options.get` | [documents.md](documents.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/quotations/:id` | `/trade/quotations/:id` | `trading.quotations.by-id.get` | [documents.md](documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations` | `/trade/quotations` | `trading.quotations.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/quotations/:id` | `/trade/quotations/:id` | `trading.quotations.by-id.patch` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/revisions` | `/trade/quotations/:id/revisions` | `trading.quotations.by-id.revisions.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/send` | `/trade/quotations/:id/send` | `trading.quotations.by-id.send.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/accept` | `/trade/quotations/:id/accept` | `trading.quotations.by-id.accept.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/reject` | `/trade/quotations/:id/reject` | `trading.quotations.by-id.reject.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/cancel` | `/trade/quotations/:id/cancel` | `trading.quotations.by-id.cancel.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:id/convert-to-sales-order` | `/trade/quotations/:id/convert-to-sales-order` | `trading.quotations.by-id.convert.to.sales.order.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/sales-orders` | `/trade/sales-orders` | `trading.sales.orders.get` | [documents.md](documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders` | `/trade/sales-orders` | `trading.sales.orders.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/sales-orders/:id` | `/trade/sales-orders/:id` | `trading.sales.orders.by-id.get` | [documents.md](documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/sales-orders/:id` | `/trade/sales-orders/:id` | `trading.sales.orders.by-id.patch` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirm` | `/trade/sales-orders/:id/confirm` | `trading.sales.orders.by-id.confirm.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId` | `/trade/sales-orders/:id/confirmation-attempts/:attemptId` | `trading.sales.orders.by-id.confirmation.attempts.by-attempt-id.get` | [documents.md](documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/confirmation-attempts/:attemptId/cancel` | `/trade/sales-orders/:id/confirmation-attempts/:attemptId/cancel` | `trading.sales.orders.by-id.confirmation.attempts.by-attempt-id.cancel.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/hold` | `/trade/sales-orders/:id/hold` | `trading.sales.orders.by-id.hold.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/release-hold` | `/trade/sales-orders/:id/release-hold` | `trading.sales.orders.by-id.release.hold.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:id/cancel` | `/trade/sales-orders/:id/cancel` | `trading.sales.orders.by-id.cancel.post` | [documents.md](documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/extensions/targets` | `/trade/extensions/targets` | `trading.extensions.targets.get` | [extension-profiles.md](extension-profiles.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/extensions/profiles` | `/trade/extensions/profiles` | `trading.extensions.profiles.get` | [extension-profiles.md](extension-profiles.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions/:versionId` | `/trade/extensions/profiles/:id/versions/:versionId` | `trading.extensions.profiles.by-id.versions.by-version-id.get` | [extension-profiles.md](extension-profiles.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id/versions` | `/trade/extensions/profiles/:id/versions` | `trading.extensions.profiles.by-id.versions.get` | [extension-profiles.md](extension-profiles.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/extensions/profiles/:id` | `/trade/extensions/profiles/:id` | `trading.extensions.profiles.by-id.get` | [extension-profiles.md](extension-profiles.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/extensions/profiles` | `/trade/extensions/profiles` | `trading.extensions.profiles.post` | [extension-profiles.md](extension-profiles.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/extensions/profiles/:id` | `/trade/extensions/profiles/:id` | `trading.extensions.profiles.by-id.patch` | [extension-profiles.md](extension-profiles.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/validate` | `/trade/extensions/profiles/:id/validate` | `trading.extensions.profiles.by-id.validate.post` | [extension-profiles.md](extension-profiles.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/extensions/profiles/:id/publish` | `/trade/extensions/profiles/:id/publish` | `trading.extensions.profiles.by-id.publish.post` | [extension-profiles.md](extension-profiles.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/import-mappings` | `/trade/import-mappings` | `trading.import.mappings.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/import-mappings/:id` | `/trade/import-mappings/:id` | `trading.import.mappings.by-id.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/import-mappings` | `/trade/import-mappings` | `trading.import.mappings.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/import-mappings/:id` | `/trade/import-mappings/:id` | `trading.import.mappings.by-id.patch` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/imports/sources` | `/trade/imports/sources` | `trading.imports.sources.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/imports` | `/trade/imports` | `trading.imports.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/imports/preview` | `/trade/imports/preview` | `trading.imports.preview.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/imports/:runId/execute` | `/trade/imports/:runId/execute` | `trading.imports.by-run-id.execute.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/imports/:runId` | `/trade/imports/:runId` | `trading.imports.by-run-id.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/imports/:runId/results` | `/trade/imports/:runId/results` | `trading.imports.by-run-id.results.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/webhooks/events` | `/trade/webhooks/events` | `trading.webhooks.events.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions` | `/trade/webhooks/subscriptions` | `trading.webhooks.subscriptions.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `/trade/webhooks/subscriptions/:id` | `trading.webhooks.subscriptions.by-id.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions` | `/trade/webhooks/subscriptions` | `trading.webhooks.subscriptions.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/webhooks/subscriptions/:id` | `/trade/webhooks/subscriptions/:id` | `trading.webhooks.subscriptions.by-id.patch` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/rotate-secret` | `/trade/webhooks/subscriptions/:id/rotate-secret` | `trading.webhooks.subscriptions.by-id.rotate.secret.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/revoke-secret` | `/trade/webhooks/subscriptions/:id/revoke-secret` | `trading.webhooks.subscriptions.by-id.revoke.secret.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/webhooks/subscriptions/:id/test` | `/trade/webhooks/subscriptions/:id/test` | `trading.webhooks.subscriptions.by-id.test.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/webhooks/deliveries` | `/trade/webhooks/deliveries` | `trading.webhooks.deliveries.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/webhooks/deliveries/:id` | `/trade/webhooks/deliveries/:id` | `trading.webhooks.deliveries.by-id.get` | [extensions-automation.md](extensions-automation.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/webhooks/deliveries/:id/retry` | `/trade/webhooks/deliveries/:id/retry` | `trading.webhooks.deliveries.by-id.retry.post` | [extensions-automation.md](extensions-automation.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/availability` | `/trade/inventory/availability` | `trading.inventory.availability.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/nodes` | `/trade/inventory/nodes` | `trading.inventory.nodes.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/nodes/:id` | `/trade/inventory/nodes/:id` | `trading.inventory.nodes.by-id.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/nodes` | `/trade/inventory/nodes` | `trading.inventory.nodes.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/inventory/nodes/:id` | `/trade/inventory/nodes/:id` | `trading.inventory.nodes.by-id.patch` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/opening-balances` | `/trade/inventory/opening-balances` | `trading.inventory.opening.balances.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/reservations` | `/trade/inventory/reservations` | `trading.inventory.reservations.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/reservations/:id/release` | `/trade/inventory/reservations/:id/release` | `trading.inventory.reservations.by-id.release.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/receipts` | `/trade/inventory/receipts` | `trading.inventory.receipts.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/post` | `/trade/inventory/receipts/:id/post` | `trading.inventory.receipts.by-id.post.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/receipts/:id/reverse` | `/trade/inventory/receipts/:id/reverse` | `trading.inventory.receipts.by-id.reverse.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/deliveries` | `/trade/inventory/deliveries` | `trading.inventory.deliveries.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/post` | `/trade/inventory/deliveries/:id/post` | `trading.inventory.deliveries.by-id.post.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/deliveries/:id/reverse` | `/trade/inventory/deliveries/:id/reverse` | `trading.inventory.deliveries.by-id.reverse.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/periods` | `/trade/inventory/periods` | `trading.inventory.periods.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/periods` | `/trade/inventory/periods` | `trading.inventory.periods.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/close` | `/trade/inventory/periods/:id/close` | `trading.inventory.periods.by-id.close.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/periods/:id/reopen` | `/trade/inventory/periods/:id/reopen` | `trading.inventory.periods.by-id.reopen.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/uom-conversions` | `/trade/inventory/uom-conversions` | `trading.inventory.uom.conversions.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions` | `/trade/inventory/uom-conversions` | `trading.inventory.uom.conversions.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/publish` | `/trade/inventory/uom-conversions/:id/publish` | `trading.inventory.uom.conversions.by-id.publish.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/inventory/uom-conversions/:id/retire` | `/trade/inventory/uom-conversions/:id/retire` | `trading.inventory.uom.conversions.by-id.retire.post` | [inventory.md](inventory.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/serials` | `/trade/inventory/serials` | `trading.inventory.serials.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/serials/:id` | `/trade/inventory/serials/:id` | `trading.inventory.serials.by-id.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/decisions` | `/trade/inventory/decisions` | `trading.inventory.decisions.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/inventory/decisions/:id` | `/trade/inventory/decisions/:id` | `trading.inventory.decisions.by-id.get` | [inventory.md](inventory.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/policies` | `/trade/policies` | `trading.policies.get` | [policy-studio.md](policy-studio.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policies` | `/trade/policies` | `trading.policies.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policies/:id/versions` | `/trade/policies/:id/versions` | `trading.policies.by-id.versions.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/policy-versions/:id` | `/trade/policy-versions/:id` | `trading.policy.versions.by-id.patch` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/validate` | `/trade/policy-versions/:id/validate` | `trading.policy.versions.by-id.validate.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/test` | `/trade/policy-versions/:id/test` | `trading.policy.versions.by-id.test.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/submit` | `/trade/policy-versions/:id/submit` | `trading.policy.versions.by-id.submit.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/approve` | `/trade/policy-versions/:id/approve` | `trading.policy.versions.by-id.approve.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/reject` | `/trade/policy-versions/:id/reject` | `trading.policy.versions.by-id.reject.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/publish` | `/trade/policy-versions/:id/publish` | `trading.policy.versions.by-id.publish.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/retire` | `/trade/policy-versions/:id/retire` | `trading.policy.versions.by-id.retire.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/policy-versions/:id/rollback` | `/trade/policy-versions/:id/rollback` | `trading.policy.versions.by-id.rollback.post` | [policy-studio.md](policy-studio.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/workflows` | `/trade/workflows` | `trading.workflows.get` | [workflow-versions.md](workflow-versions.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflows` | `/trade/workflows` | `trading.workflows.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflows/:id/versions` | `/trade/workflows/:id/versions` | `trading.workflows.by-id.versions.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/workflow-versions/:id` | `/trade/workflow-versions/:id` | `trading.workflow.versions.by-id.patch` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/validate` | `/trade/workflow-versions/:id/validate` | `trading.workflow.versions.by-id.validate.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/test` | `/trade/workflow-versions/:id/test` | `trading.workflow.versions.by-id.test.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/submit` | `/trade/workflow-versions/:id/submit` | `trading.workflow.versions.by-id.submit.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/approve` | `/trade/workflow-versions/:id/approve` | `trading.workflow.versions.by-id.approve.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/reject` | `/trade/workflow-versions/:id/reject` | `trading.workflow.versions.by-id.reject.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/publish` | `/trade/workflow-versions/:id/publish` | `trading.workflow.versions.by-id.publish.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/retire` | `/trade/workflow-versions/:id/retire` | `trading.workflow.versions.by-id.retire.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/workflow-versions/:id/rollback` | `/trade/workflow-versions/:id/rollback` | `trading.workflow.versions.by-id.rollback.post` | [workflow-versions.md](workflow-versions.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/decisions/:id` | `/trade/decisions/:id` | `trading.decisions.by-id.get` | [policy-studio.md](policy-studio.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/price-books` | `/trade/price-books` | `trading.price.books.get` | [pricing-price-books.md](pricing-price-books.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/price-books` | `/trade/price-books` | `trading.price.books.post` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/price-books/:id/versions` | `/trade/price-books/:id/versions` | `trading.price.books.by-id.versions.post` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/price-book-versions/:id` | `/trade/price-book-versions/:id` | `trading.price.book.versions.by-id.get` | [pricing-price-books.md](pricing-price-books.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/test` | `/trade/price-book-versions/:id/test` | `trading.price.book.versions.by-id.test.post` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/price-book-versions/:id/publish` | `/trade/price-book-versions/:id/publish` | `trading.price.book.versions.by-id.publish.post` | [pricing-price-books.md](pricing-price-books.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/pricing/evaluate` | `/trade/pricing/evaluate` | `trading.pricing.evaluate.post` | [pricing-price-books.md](pricing-price-books.md) | `READ_HEAVY` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-orders` | `/trade/purchase-orders` | `trading.purchase.orders.get` | [purchasing.md](purchasing.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders` | `/trade/purchase-orders` | `trading.purchase.orders.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-orders/:id` | `/trade/purchase-orders/:id` | `trading.purchase.orders.by-id.get` | [purchasing.md](purchasing.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/purchase-orders/:id` | `/trade/purchase-orders/:id` | `trading.purchase.orders.by-id.patch` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/submit` | `/trade/purchase-orders/:id/submit` | `trading.purchase.orders.by-id.submit.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/withdraw` | `/trade/purchase-orders/:id/withdraw` | `trading.purchase.orders.by-id.withdraw.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/approve` | `/trade/purchase-orders/:id/approve` | `trading.purchase.orders.by-id.approve.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/reject` | `/trade/purchase-orders/:id/reject` | `trading.purchase.orders.by-id.reject.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/confirm` | `/trade/purchase-orders/:id/confirm` | `trading.purchase.orders.by-id.confirm.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:id/cancel` | `/trade/purchase-orders/:id/cancel` | `trading.purchase.orders.by-id.cancel.post` | [purchasing.md](purchasing.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/quotations/:quotationId/render-pdf` | `/trade/quotations/:quotationId/render-pdf` | `trading.quotations.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/quotations/:quotationId/render-jobs/:renderJobId` | `/trade/quotations/:quotationId/render-jobs/:renderJobId` | `trading.quotations.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/sales-orders/:documentId/render-pdf` | `/trade/sales-orders/:documentId/render-pdf` | `trading.sales-orders.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/sales-orders/:documentId/render-jobs/:renderJobId` | `/trade/sales-orders/:documentId/render-jobs/:renderJobId` | `trading.sales-orders.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-orders/:documentId/render-pdf` | `/trade/purchase-orders/:documentId/render-pdf` | `trading.purchase-orders.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-orders/:documentId/render-jobs/:renderJobId` | `/trade/purchase-orders/:documentId/render-jobs/:renderJobId` | `trading.purchase-orders.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-quotations` | `/trade/purchase-quotations` | `trading.purchase-quotations.get` | [purchase-quotations.md](purchase-quotations.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-quotations/search` | `/trade/purchase-quotations/search` | `trading.purchase-quotations.search.post` | [purchase-quotations.md](purchase-quotations.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-quotations` | `/trade/purchase-quotations` | `trading.purchase-quotations.post` | [purchase-quotations.md](purchase-quotations.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-quotations/:id` | `/trade/purchase-quotations/:id` | `trading.purchase-quotations.by-id.get` | [purchase-quotations.md](purchase-quotations.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/purchase-quotations/:id` | `/trade/purchase-quotations/:id` | `trading.purchase-quotations.by-id.patch` | [purchase-quotations.md](purchase-quotations.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-quotations/:id/issue` | `/trade/purchase-quotations/:id/issue` | `trading.purchase-quotations.by-id.issue.post` | [purchase-quotations.md](purchase-quotations.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-pdf` | `/trade/purchase-quotations/:documentId/render-pdf` | `trading.purchase-quotations.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/purchase-quotations/:documentId/render-jobs/:renderJobId` | `/trade/purchase-quotations/:documentId/render-jobs/:renderJobId` | `trading.purchase-quotations.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/invoices/:documentId/render-pdf` | `/trade/invoices/:documentId/render-pdf` | `trading.invoices.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/invoices/:documentId/render-jobs/:renderJobId` | `/trade/invoices/:documentId/render-jobs/:renderJobId` | `trading.invoices.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/contracts/:documentId/render-pdf` | `/trade/contracts/:documentId/render-pdf` | `trading.contracts.render-pdf` | [pdf-render-jobs.md](pdf-render-jobs.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/contracts/:documentId/render-jobs/:renderJobId` | `/trade/contracts/:documentId/render-jobs/:renderJobId` | `trading.contracts.render-pdf.get` | [pdf-render-jobs.md](pdf-render-jobs.md) | `AUTHENTICATED` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/invoices` | `/trade/invoices` | `trading.invoices.get` | [financial-documents.md](financial-documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/invoices` | `/trade/invoices` | `trading.invoices.post` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/invoices/:id` | `/trade/invoices/:id` | `trading.invoices.by-id.get` | [financial-documents.md](financial-documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/invoices/:id` | `/trade/invoices/:id` | `trading.invoices.by-id.patch` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/invoices/:id/issue` | `/trade/invoices/:id/issue` | `trading.invoices.by-id.issue.post` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/contracts` | `/trade/contracts` | `trading.contracts.get` | [financial-documents.md](financial-documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/contracts` | `/trade/contracts` | `trading.contracts.post` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| GET | `/api/tenant/trade/v1/contracts/:id` | `/trade/contracts/:id` | `trading.contracts.by-id.get` | [financial-documents.md](financial-documents.md) | `AUTHENTICATED` | true | `DEFAULT` |
| PATCH | `/api/tenant/trade/v1/contracts/:id` | `/trade/contracts/:id` | `trading.contracts.by-id.patch` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |
| POST | `/api/tenant/trade/v1/contracts/:id/activate` | `/trade/contracts/:id/activate` | `trading.contracts.by-id.activate.post` | [financial-documents.md](financial-documents.md) | `WRITE_SENSITIVE` | true | `DEFAULT` |

## Controller-only routes

These four Trade controller routes are **not** declared in the Gateway route contract and therefore are not browser APIs:

| Method | Upstream/controller path | Classification |
|---|---|---|
| GET | `/api/v1/trade/uoms` | internal/unrouted |
| GET | `/api/v1/trade/uoms/:id` | internal/unrouted |
| POST | `/api/v1/trade/uoms` | internal/unrouted |
| PATCH | `/api/v1/trade/uoms/:id` | internal/unrouted |

The supported browser UOM read route is `GET /api/tenant/trade/v1/catalog/uoms`. AI-generated frontend code must not synthesize `/api/tenant/trade/v1/uoms`.

## Interpretation rules

- Route class, Gateway idempotence, and transport retry are edge policies; they do not replace Trade permissions, feature gates, scope guards, `X-Idempotency-Key`, or `If-Match`.
- Browser code always uses the canonical path. Controller-relative paths exist for source tracing and server-to-server diagnostics.
- Re-run this inventory whenever the typed Gateway route-contract file or a Trade controller changes.
