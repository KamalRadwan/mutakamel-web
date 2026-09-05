# Generated Admin Core API Route Inventory

> GENERATED FILE. Do not edit by hand. Run `npm run docs:routes` from
> `admin-portal`.

Generated at: **2026-09-05T03:38:04.415Z**

Frontend revision: `5afe27a852af+dirty`

Backend revision: `244b9a7f64c4+dirty`

## Coverage

This inventory contains **253** browser-visible Core Admin routes.
It proves Gateway method/path, route class, idempotency, and permission
metadata. It does not prove DTO fields, response projections, runtime
feature flags, deployment, or current frontend implementation.

| Route class | Routes |
| --- | ---: |
| AUTHENTICATED | 89 |
| PUBLIC | 6 |
| READ_HEAVY | 21 |
| WRITE_SENSITIVE | 137 |
| **Total** | **253** |

Machine-readable source:
[admin-core-api-routes.json](admin-core-api-routes.json).

## Domain counts

| Gateway route-key domain | Routes |
| --- | ---: |
| applications | 17 |
| audit | 3 |
| auth | 12 |
| auth-invalidation-outbox | 1 |
| catalog | 17 |
| dashboard | 1 |
| database-servers | 20 |
| invoices | 7 |
| logging | 6 |
| notifications | 14 |
| payments | 5 |
| permissions | 1 |
| provisioning | 31 |
| reports | 5 |
| roles | 6 |
| storage-migrations | 3 |
| storage-servers | 11 |
| subscriptions | 8 |
| system-settings | 11 |
| tenant-fqdns | 1 |
| tenants | 57 |
| users | 10 |
| wallets | 6 |

## Routes

| Method | Canonical Gateway path | Class | Idempotent | Permission mode | Permissions | Route key |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/core/v1/applications` | AUTHENTICATED | yes | ALL | admin.applications.read | `core.admin.applications.list` |
| POST | `/api/admin/core/v1/applications` | WRITE_SENSITIVE | yes | ALL | admin.applications.create | `core.admin.applications.create` |
| GET | `/api/admin/core/v1/applications/:applicationId/audit` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.applications.audit` |
| GET | `/api/admin/core/v1/applications/:applicationId/features` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.features.list` |
| POST | `/api/admin/core/v1/applications/:applicationId/features` | WRITE_SENSITIVE | no | ALL | admin.catalog.manage | `core.admin.catalog.features.create` |
| GET | `/api/admin/core/v1/applications/:applicationId/tiers` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.tiers.list` |
| POST | `/api/admin/core/v1/applications/:applicationId/tiers` | WRITE_SENSITIVE | no | ALL | admin.catalog.manage | `core.admin.catalog.tiers.create` |
| DELETE | `/api/admin/core/v1/applications/:applicationKey` | WRITE_SENSITIVE | yes | ALL | admin.applications.delete + admin.applications.critical | `core.admin.applications.delete` |
| GET | `/api/admin/core/v1/applications/:applicationKey` | AUTHENTICATED | yes | ALL | admin.applications.read | `core.admin.applications.get` |
| PATCH | `/api/admin/core/v1/applications/:applicationKey` | WRITE_SENSITIVE | yes | ALL | admin.applications.update | `core.admin.applications.update` |
| POST | `/api/admin/core/v1/applications/:applicationKey/activate` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.activate` |
| GET | `/api/admin/core/v1/applications/:applicationKey/database-manifests` | AUTHENTICATED | yes | ALL | admin.applications.read | `core.admin.applications.database-manifests.list` |
| PATCH | `/api/admin/core/v1/applications/:applicationKey/database-policy` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.database-policy.update` |
| GET | `/api/admin/core/v1/applications/:applicationKey/database-servers` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.applications.database-servers.list` |
| POST | `/api/admin/core/v1/applications/:applicationKey/database-servers/bind` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.applications.database-servers.bind` |
| POST | `/api/admin/core/v1/applications/:applicationKey/deprecate` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.deprecate` |
| POST | `/api/admin/core/v1/applications/:applicationKey/disable` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.disable` |
| POST | `/api/admin/core/v1/applications/:applicationKey/publish` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.publish` |
| GET | `/api/admin/core/v1/applications/:applicationKey/technical-provisioning` | AUTHENTICATED | yes | ALL | admin.applications.read | `core.admin.applications.technical-provisioning.get` |
| POST | `/api/admin/core/v1/applications/:applicationKey/technical-provisioning/adopt` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.technical-provisioning.adopt` |
| POST | `/api/admin/core/v1/applications/:applicationKey/technical-provisioning/primary-component` | WRITE_SENSITIVE | yes | ALL | admin.applications.update + admin.applications.critical | `core.admin.applications.technical-provisioning.primary-component.create` |
| POST | `/api/admin/core/v1/applications/onboarding` | WRITE_SENSITIVE | yes | ALL | admin.applications.create + admin.applications.update + admin.applications.critical | `core.admin.applications.onboard` |
| GET | `/api/admin/core/v1/audit` | AUTHENTICATED | yes | ALL | admin.audit.read | `core.admin.audit.list` |
| GET | `/api/admin/core/v1/audit/:id` | AUTHENTICATED | yes | ALL | admin.audit.read | `core.admin.audit.detail` |
| GET | `/api/admin/core/v1/audit/entities/:entityType/:entityId` | AUTHENTICATED | yes | ALL | admin.audit.read | `core.admin.audit.entity-history` |
| POST | `/api/admin/core/v1/auth-invalidation-outbox/replay` | WRITE_SENSITIVE | yes | ALL | admin.auth_invalidation_outbox.replay | `core.admin.auth-invalidation-outbox.replay` |
| POST | `/api/admin/core/v1/auth/accept-invite` | PUBLIC | no | ALL | — | `core.admin.auth.accept-invite` |
| POST | `/api/admin/core/v1/auth/activity` | AUTHENTICATED | no | ALL | — | `core.admin.auth.activity` |
| POST | `/api/admin/core/v1/auth/forgot-password` | PUBLIC | no | ALL | — | `core.admin.auth.forgot-password` |
| POST | `/api/admin/core/v1/auth/login` | PUBLIC | no | ALL | — | `core.admin.auth.login` |
| POST | `/api/admin/core/v1/auth/logout` | PUBLIC | yes | ALL | — | `core.admin.auth.logout` |
| POST | `/api/admin/core/v1/auth/logout-all` | AUTHENTICATED | yes | ALL | — | `core.admin.auth.logout-all` |
| GET | `/api/admin/core/v1/auth/me` | AUTHENTICATED | yes | ALL | — | `core.admin.auth.me` |
| POST | `/api/admin/core/v1/auth/presence` | AUTHENTICATED | no | ALL | — | `core.admin.auth.presence` |
| POST | `/api/admin/core/v1/auth/refresh` | PUBLIC | no | ALL | — | `core.admin.auth.refresh` |
| POST | `/api/admin/core/v1/auth/reset-password` | PUBLIC | no | ALL | — | `core.admin.auth.reset-password` |
| GET | `/api/admin/core/v1/auth/sessions` | AUTHENTICATED | yes | ALL | — | `core.admin.auth.sessions.list` |
| DELETE | `/api/admin/core/v1/auth/sessions/:sessionId` | AUTHENTICATED | yes | ALL | — | `core.admin.auth.sessions.revoke` |
| GET | `/api/admin/core/v1/billing/currency-rates` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.currency-rates.list` |
| PATCH | `/api/admin/core/v1/billing/currency-rates` | WRITE_SENSITIVE | yes | ALL | admin.billing.currency.manage + admin.catalog.critical | `core.admin.catalog.currency-rates.set` |
| PATCH | `/api/admin/core/v1/billing/currency-rates/:currencyCode` | WRITE_SENSITIVE | yes | ALL | admin.billing.currency.manage + admin.catalog.critical | `core.admin.catalog.currency-rates.upsert` |
| GET | `/api/admin/core/v1/catalog/audit` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.audit.list` |
| GET | `/api/admin/core/v1/dashboard` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.dashboard.summary` |
| GET | `/api/admin/core/v1/database-servers` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.database-servers.list` |
| POST | `/api/admin/core/v1/database-servers` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.create | `core.admin.database-servers.create` |
| DELETE | `/api/admin/core/v1/database-servers/:id` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.delete + admin.database_servers.critical | `core.admin.database-servers.delete` |
| GET | `/api/admin/core/v1/database-servers/:id` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.database-servers.get` |
| PATCH | `/api/admin/core/v1/database-servers/:id` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.update` |
| POST | `/api/admin/core/v1/database-servers/:id/activate` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.activate` |
| GET | `/api/admin/core/v1/database-servers/:id/applications` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.database-servers.applications.list` |
| POST | `/api/admin/core/v1/database-servers/:id/applications/:applicationKey/bootstrap` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.application.bootstrap` |
| POST | `/api/admin/core/v1/database-servers/:id/applications/:applicationKey/credential/reconcile` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.credentials.rotate + admin.database_servers.critical | `core.admin.database-servers.application-credential.reconcile` |
| POST | `/api/admin/core/v1/database-servers/:id/applications/:applicationKey/credential/regenerate` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.credentials.rotate + admin.database_servers.critical | `core.admin.database-servers.application-credential.regenerate` |
| POST | `/api/admin/core/v1/database-servers/:id/credential-bootstrap/retry` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.create + admin.database_servers.critical | `core.admin.database-servers.credential-bootstrap.retry` |
| DELETE | `/api/admin/core/v1/database-servers/:id/destroy` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.delete.hard + admin.database_servers.critical | `core.admin.database-servers.destroy` |
| POST | `/api/admin/core/v1/database-servers/:id/drain` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.drain` |
| GET | `/api/admin/core/v1/database-servers/:id/history` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.database-servers.history` |
| POST | `/api/admin/core/v1/database-servers/:id/offline` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.offline` |
| GET | `/api/admin/core/v1/database-servers/:id/system-principals` | AUTHENTICATED | yes | ALL | admin.database_servers.read | `core.admin.database-servers.system-principals.list` |
| POST | `/api/admin/core/v1/database-servers/:id/system-principals/:purpose/credential/reconcile` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.credentials.rotate + admin.database_servers.critical | `core.admin.database-servers.system-principal.credential.reconcile` |
| POST | `/api/admin/core/v1/database-servers/:id/system-principals/:purpose/credential/regenerate` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.credentials.rotate + admin.database_servers.critical | `core.admin.database-servers.system-principal.credential.regenerate` |
| PATCH | `/api/admin/core/v1/database-servers/:id/system-principals/:purpose/rotation-policy` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.update + admin.database_servers.critical | `core.admin.database-servers.system-principal.rotation-policy.update` |
| POST | `/api/admin/core/v1/database-servers/check-connectivity` | WRITE_SENSITIVE | yes | ALL | admin.database_servers.create | `core.admin.database-servers.check-connectivity` |
| DELETE | `/api/admin/core/v1/features/:id` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.features.delete` |
| PATCH | `/api/admin/core/v1/features/:id` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.features.update` |
| GET | `/api/admin/core/v1/invoices` | AUTHENTICATED | yes | ALL | admin.invoices.read | `core.admin.invoices.list` |
| GET | `/api/admin/core/v1/invoices/:id` | AUTHENTICATED | yes | ALL | admin.invoices.read | `core.admin.invoices.get` |
| PATCH | `/api/admin/core/v1/invoices/:id` | WRITE_SENSITIVE | yes | ALL | admin.invoices.update | `core.admin.invoices.update` |
| POST | `/api/admin/core/v1/invoices/:id/issue` | WRITE_SENSITIVE | yes | ALL | admin.invoices.update + admin.invoices.critical | `core.admin.invoices.issue` |
| POST | `/api/admin/core/v1/invoices/:id/void` | WRITE_SENSITIVE | yes | ALL | admin.invoices.void + admin.invoices.critical | `core.admin.invoices.void` |
| POST | `/api/admin/core/v1/invoices/:invoiceId/offline-payments` | WRITE_SENSITIVE | yes | ALL | admin.wallet.manage + admin.billing.critical | `core.admin.invoices.offline-payments.create` |
| POST | `/api/admin/core/v1/invoices/generate` | WRITE_SENSITIVE | yes | ALL | admin.invoices.create | `core.admin.invoices.generate` |
| GET | `/api/admin/core/v1/logging/level-overrides` | AUTHENTICATED | yes | ALL | admin.logging.read | `core.admin.logging.level-overrides.list` |
| PUT | `/api/admin/core/v1/logging/level-overrides` | WRITE_SENSITIVE | yes | ALL | admin.logging.update + admin.logging.critical | `core.admin.logging.level-overrides.upsert` |
| DELETE | `/api/admin/core/v1/logging/level-overrides/:id` | WRITE_SENSITIVE | yes | ALL | admin.logging.update + admin.logging.critical | `core.admin.logging.level-overrides.delete` |
| GET | `/api/admin/core/v1/logging/level-overrides/effective` | AUTHENTICATED | yes | ALL | admin.logging.read | `core.admin.logging.level-overrides.effective` |
| GET | `/api/admin/core/v1/logging/level-overrides/history` | AUTHENTICATED | yes | ALL | admin.logging.read | `core.admin.logging.level-overrides.history` |
| GET | `/api/admin/core/v1/logging/level-overrides/live` | AUTHENTICATED | no | ALL | admin.logging.read + admin.logging.critical | `core.admin.logging.live` |
| GET | `/api/admin/core/v1/notifications` | AUTHENTICATED | yes | ALL | admin.notifications.read | `core.admin.notifications.get` |
| DELETE | `/api/admin/core/v1/notifications/:id` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.by.id.delete` |
| POST | `/api/admin/core/v1/notifications/:id/ack` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.by.id.ack.post` |
| POST | `/api/admin/core/v1/notifications/:id/acknowledge` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.by.id.acknowledge.post` |
| POST | `/api/admin/core/v1/notifications/:id/dismiss` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.by.id.dismiss.post` |
| POST | `/api/admin/core/v1/notifications/:id/read` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.by.id.read.post` |
| GET | `/api/admin/core/v1/notifications/config` | AUTHENTICATED | yes | ALL | admin.notifications.read | `core.admin.notifications.config.get` |
| POST | `/api/admin/core/v1/notifications/device-tokens` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.device-tokens.post` |
| DELETE | `/api/admin/core/v1/notifications/device-tokens/:id` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.device-tokens.delete` |
| POST | `/api/admin/core/v1/notifications/mark-all-read` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.mark-all-read.post` |
| GET | `/api/admin/core/v1/notifications/preferences` | AUTHENTICATED | yes | ALL | admin.notifications.read | `core.admin.notifications.preferences.get` |
| PUT | `/api/admin/core/v1/notifications/preferences` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.preferences.put` |
| POST | `/api/admin/core/v1/notifications/read-all` | WRITE_SENSITIVE | yes | ALL | admin.notifications.manage | `core.admin.notifications.read-all.post` |
| GET | `/api/admin/core/v1/notifications/unread-count` | AUTHENTICATED | yes | ALL | admin.notifications.read | `core.admin.notifications.unread-count.get` |
| GET | `/api/admin/core/v1/payments/:paymentId/reconciliations` | AUTHENTICATED | yes | ALL | admin.billing.reconcile | `core.admin.payments.reconciliations.list` |
| POST | `/api/admin/core/v1/payments/:paymentId/reconciliations` | WRITE_SENSITIVE | yes | ALL | admin.billing.reconcile | `core.admin.payments.reconciliations.propose` |
| POST | `/api/admin/core/v1/payments/:paymentId/reconciliations/:reconciliationId/decision` | WRITE_SENSITIVE | yes | ALL | admin.billing.reconcile + admin.billing.critical | `core.admin.payments.reconciliations.decide` |
| POST | `/api/admin/core/v1/payments/:paymentId/refunds` | WRITE_SENSITIVE | yes | ALL | admin.wallet.manage + admin.billing.critical | `core.admin.payments.refunds.create` |
| GET | `/api/admin/core/v1/permissions` | AUTHENTICATED | yes | ALL | admin.permissions.read | `core.admin.permissions.list` |
| GET | `/api/admin/core/v1/provisioning/components` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.provisioning.components.list` |
| GET | `/api/admin/core/v1/provisioning/components/:componentId/releases` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.provisioning.components.releases.list` |
| GET | `/api/admin/core/v1/provisioning/discovery-runs` | READ_HEAVY | yes | ALL | admin.provisioning.discovery.read | `core.admin.provisioning.discovery-runs.list` |
| POST | `/api/admin/core/v1/provisioning/discovery-runs` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.discovery.run + admin.provisioning.critical | `core.admin.provisioning.discovery-runs.create` |
| GET | `/api/admin/core/v1/provisioning/discovery-runs/:runId` | READ_HEAVY | yes | ALL | admin.provisioning.discovery.read | `core.admin.provisioning.discovery-runs.get` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollout-previews` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.create | `core.admin.provisioning.fleet-rollout-previews.create` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollout-previews/:previewId` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.read | `core.admin.provisioning.fleet-rollout-previews.get` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollout-previews/:previewId/tenants` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.read | `core.admin.provisioning.fleet-rollout-previews.tenants.list` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollouts` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.read | `core.admin.provisioning.fleet-rollouts.list` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollouts` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.create + admin.provisioning.critical | `core.admin.provisioning.fleet-rollouts.create` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.read | `core.admin.provisioning.fleet-rollouts.get` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/cancel` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.manage + admin.provisioning.critical | `core.admin.provisioning.fleet-rollouts.cancel` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/pause` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.manage + admin.provisioning.critical | `core.admin.provisioning.fleet-rollouts.pause` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/report` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.report | `core.admin.provisioning.fleet-rollouts.report` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/report/attest` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.report + admin.provisioning.critical | `core.admin.provisioning.fleet-rollouts.report.attest` |
| POST | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/resume` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.rollouts.manage + admin.provisioning.critical | `core.admin.provisioning.fleet-rollouts.resume` |
| GET | `/api/admin/core/v1/provisioning/fleet-rollouts/:rolloutId/tenants` | READ_HEAVY | yes | ALL | admin.provisioning.rollouts.read | `core.admin.provisioning.fleet-rollouts.tenants.list` |
| GET | `/api/admin/core/v1/provisioning/publisher-keys` | READ_HEAVY | yes | ALL | admin.provisioning.publisher-keys.read | `core.admin.provisioning.publisher-keys.list` |
| POST | `/api/admin/core/v1/provisioning/publisher-keys` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.publisher-keys.manage + admin.provisioning.critical | `core.admin.provisioning.publisher-keys.create` |
| GET | `/api/admin/core/v1/provisioning/publisher-keys/:publisherKeyId` | READ_HEAVY | yes | ALL | admin.provisioning.publisher-keys.read | `core.admin.provisioning.publisher-keys.get` |
| POST | `/api/admin/core/v1/provisioning/publisher-keys/:publisherKeyId/revoke` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.publisher-keys.manage + admin.provisioning.critical | `core.admin.provisioning.publisher-keys.revoke` |
| POST | `/api/admin/core/v1/provisioning/publisher-keys/challenges` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.publisher-keys.manage | `core.admin.provisioning.publisher-keys.challenges.create` |
| GET | `/api/admin/core/v1/provisioning/release-drafts` | READ_HEAVY | yes | ALL | admin.provisioning.releases.read | `core.admin.provisioning.release-drafts.list` |
| POST | `/api/admin/core/v1/provisioning/release-drafts` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.releases.publish | `core.admin.provisioning.release-drafts.create` |
| GET | `/api/admin/core/v1/provisioning/release-drafts/:draftId` | READ_HEAVY | yes | ALL | admin.provisioning.releases.read | `core.admin.provisioning.release-drafts.get` |
| PATCH | `/api/admin/core/v1/provisioning/release-drafts/:draftId` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.releases.publish | `core.admin.provisioning.release-drafts.update` |
| POST | `/api/admin/core/v1/provisioning/release-drafts/:draftId/publish` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.releases.publish + admin.provisioning.critical | `core.admin.provisioning.release-drafts.publish` |
| POST | `/api/admin/core/v1/provisioning/release-drafts/:draftId/validate` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.releases.publish | `core.admin.provisioning.release-drafts.validate` |
| GET | `/api/admin/core/v1/provisioning/releases` | READ_HEAVY | yes | ALL | admin.provisioning.releases.read | `core.admin.provisioning.releases.list` |
| GET | `/api/admin/core/v1/provisioning/releases/:releaseId` | READ_HEAVY | yes | ALL | admin.provisioning.releases.read | `core.admin.provisioning.releases.get` |
| POST | `/api/admin/core/v1/provisioning/releases/:releaseId/retire` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.releases.retire + admin.provisioning.critical | `core.admin.provisioning.releases.retire` |
| GET | `/api/admin/core/v1/reports/billing` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.reports.billing` |
| GET | `/api/admin/core/v1/reports/overview` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.reports.overview` |
| GET | `/api/admin/core/v1/reports/provisioning` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.reports.provisioning` |
| GET | `/api/admin/core/v1/reports/servers` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.reports.servers` |
| GET | `/api/admin/core/v1/reports/tenants` | READ_HEAVY | yes | ALL | admin.reports.read | `core.admin.reports.tenants` |
| GET | `/api/admin/core/v1/roles` | AUTHENTICATED | yes | ALL | admin.roles.read | `core.admin.roles.list` |
| POST | `/api/admin/core/v1/roles` | WRITE_SENSITIVE | yes | ALL | admin.roles.create + admin.roles.critical | `core.admin.roles.create` |
| DELETE | `/api/admin/core/v1/roles/:id` | WRITE_SENSITIVE | yes | ALL | admin.roles.delete + admin.roles.critical | `core.admin.roles.delete` |
| GET | `/api/admin/core/v1/roles/:id` | AUTHENTICATED | yes | ALL | admin.roles.read | `core.admin.roles.get` |
| PATCH | `/api/admin/core/v1/roles/:id` | WRITE_SENSITIVE | yes | ALL | admin.roles.update | `core.admin.roles.update` |
| PATCH | `/api/admin/core/v1/roles/:id/permissions` | WRITE_SENSITIVE | yes | ALL | admin.roles.update + admin.roles.critical | `core.admin.roles.permissions.set` |
| GET | `/api/admin/core/v1/storage-migrations/:id` | AUTHENTICATED | yes | ALL | admin.storage_migrations.read | `core.admin.storage-migrations.get` |
| POST | `/api/admin/core/v1/storage-migrations/:id/release-source` | WRITE_SENSITIVE | yes | ALL | admin.storage_migrations.execute + admin.storage_migrations.critical | `core.admin.storage-migrations.release-source` |
| GET | `/api/admin/core/v1/storage-servers` | AUTHENTICATED | yes | ALL | admin.storage_servers.read | `core.admin.storage-servers.list` |
| POST | `/api/admin/core/v1/storage-servers` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.create + admin.storage_servers.critical | `core.admin.storage-servers.create` |
| DELETE | `/api/admin/core/v1/storage-servers/:id` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.delete + admin.storage_servers.critical | `core.admin.storage-servers.delete` |
| GET | `/api/admin/core/v1/storage-servers/:id` | AUTHENTICATED | yes | ALL | admin.storage_servers.read | `core.admin.storage-servers.get` |
| PATCH | `/api/admin/core/v1/storage-servers/:id` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.update` |
| POST | `/api/admin/core/v1/storage-servers/:id/activate` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.activate` |
| POST | `/api/admin/core/v1/storage-servers/:id/credential-rotations` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.credentials.rotate` |
| POST | `/api/admin/core/v1/storage-servers/:id/credential-rotations/:rotationId/revoke` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.credentials.revoke` |
| POST | `/api/admin/core/v1/storage-servers/:id/drain` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.drain` |
| POST | `/api/admin/core/v1/storage-servers/:id/offline` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.offline` |
| POST | `/api/admin/core/v1/storage-servers/:id/probe` | WRITE_SENSITIVE | yes | ALL | admin.storage_servers.update + admin.storage_servers.critical | `core.admin.storage-servers.probe` |
| GET | `/api/admin/core/v1/subscriptions` | AUTHENTICATED | yes | ALL | admin.subscriptions.read | `core.admin.subscriptions.list` |
| POST | `/api/admin/core/v1/subscriptions/:id/plan-change-previews` | WRITE_SENSITIVE | yes | ALL | admin.subscriptions.update | `core.admin.subscriptions.v1.plan-change-previews.create` |
| POST | `/api/admin/core/v1/subscriptions/:id/plan-change-previews/:previewId/apply` | WRITE_SENSITIVE | yes | ALL | admin.subscriptions.update + admin.subscriptions.critical | `core.admin.subscriptions.v1.plan-change-previews.apply` |
| POST | `/api/admin/core/v1/subscriptions/:tenantId/cancel` | WRITE_SENSITIVE | yes | ALL | admin.subscriptions.cancel + admin.subscriptions.critical | `core.admin.subscriptions.cancel` |
| POST | `/api/admin/core/v1/subscriptions/quote` | AUTHENTICATED | yes | ANY | admin.catalog.read OR admin.tenants.create | `core.admin.subscriptions.v1.quote` |
| GET | `/api/admin/core/v1/system-settings` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.list` |
| GET | `/api/admin/core/v1/system-settings/:key` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.get` |
| PUT | `/api/admin/core/v1/system-settings/:key` | WRITE_SENSITIVE | yes | ALL | admin.settings.update + admin.settings.critical | `core.admin.system-settings.upsert` |
| GET | `/api/admin/core/v1/system-settings/email` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.email.get` |
| PATCH | `/api/admin/core/v1/system-settings/email` | WRITE_SENSITIVE | yes | ALL | admin.settings.update + admin.settings.critical | `core.admin.system-settings.email.update` |
| GET | `/api/admin/core/v1/system-settings/email/audit` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.email.audit` |
| POST | `/api/admin/core/v1/system-settings/email/verify-connection` | WRITE_SENSITIVE | yes | ALL | admin.settings.update | `core.admin.system-settings.email.verify-connection` |
| GET | `/api/admin/core/v1/system-settings/fatal-alerts` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.fatal-alerts.get` |
| PATCH | `/api/admin/core/v1/system-settings/fatal-alerts` | WRITE_SENSITIVE | yes | ALL | admin.settings.update + admin.settings.critical | `core.admin.system-settings.fatal-alerts.update` |
| GET | `/api/admin/core/v1/system-settings/storage-runtime` | AUTHENTICATED | yes | ALL | admin.settings.read | `core.admin.system-settings.storage-runtime.get` |
| PATCH | `/api/admin/core/v1/system-settings/storage-runtime` | WRITE_SENSITIVE | yes | ALL | admin.settings.update + admin.settings.critical | `core.admin.system-settings.storage-runtime.update` |
| POST | `/api/admin/core/v1/tenant-fqdns/validate` | AUTHENTICATED | yes | ANY | admin.tenants.create OR admin.tenants.manage_fqdns | `core.admin.tenant-fqdns.validate` |
| GET | `/api/admin/core/v1/tenants` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.list` |
| POST | `/api/admin/core/v1/tenants` | WRITE_SENSITIVE | yes | ALL | admin.tenants.create | `core.admin.tenants.create` |
| DELETE | `/api/admin/core/v1/tenants/:id` | WRITE_SENSITIVE | yes | ALL | admin.tenants.delete + admin.tenants.critical | `core.admin.tenants.delete` |
| GET | `/api/admin/core/v1/tenants/:id` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.get` |
| PATCH | `/api/admin/core/v1/tenants/:id` | WRITE_SENSITIVE | yes | ALL | admin.tenants.update | `core.admin.tenants.update` |
| GET | `/api/admin/core/v1/tenants/:id/access/branches` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.access.branches.list` |
| GET | `/api/admin/core/v1/tenants/:id/access/departments` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.access.departments.list` |
| GET | `/api/admin/core/v1/tenants/:id/access/roles` | AUTHENTICATED | yes | ALL | admin.tenant_users.assign_roles | `core.admin.tenants.access.roles.list` |
| GET | `/api/admin/core/v1/tenants/:id/access/teams` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.access.teams.list` |
| POST | `/api/admin/core/v1/tenants/:id/activate` | WRITE_SENSITIVE | yes | ALL | admin.tenants.suspend + admin.tenants.critical | `core.admin.tenants.activate` |
| DELETE | `/api/admin/core/v1/tenants/:id/destroy` | WRITE_SENSITIVE | yes | ALL | admin.tenants.destroy + admin.tenants.critical | `core.admin.tenants.destroy` |
| GET | `/api/admin/core/v1/tenants/:id/fqdns` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.fqdns.list` |
| POST | `/api/admin/core/v1/tenants/:id/fqdns` | WRITE_SENSITIVE | yes | ALL | admin.tenants.manage_fqdns + admin.tenants.critical | `core.admin.tenants.fqdns.add` |
| DELETE | `/api/admin/core/v1/tenants/:id/fqdns/:fqdnId` | WRITE_SENSITIVE | yes | ALL | admin.tenants.manage_fqdns + admin.tenants.critical | `core.admin.tenants.fqdns.delete` |
| POST | `/api/admin/core/v1/tenants/:id/fqdns/:fqdnId/primary` | WRITE_SENSITIVE | yes | ALL | admin.tenants.manage_fqdns + admin.tenants.critical | `core.admin.tenants.fqdns.primary` |
| POST | `/api/admin/core/v1/tenants/:id/provisioning/cancel` | WRITE_SENSITIVE | yes | ALL | admin.tenants.reprovision + admin.tenants.critical | `core.admin.tenants.provisioning.cancel` |
| POST | `/api/admin/core/v1/tenants/:id/reprovision` | WRITE_SENSITIVE | yes | ALL | admin.tenants.reprovision + admin.tenants.critical | `core.admin.tenants.reprovision` |
| POST | `/api/admin/core/v1/tenants/:id/restore` | WRITE_SENSITIVE | yes | ALL | admin.tenants.restore + admin.tenants.critical | `core.admin.tenants.restore` |
| POST | `/api/admin/core/v1/tenants/:id/suspend` | WRITE_SENSITIVE | yes | ALL | admin.tenants.suspend + admin.tenants.critical | `core.admin.tenants.suspend` |
| GET | `/api/admin/core/v1/tenants/:id/users` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.users.list` |
| POST | `/api/admin/core/v1/tenants/:id/users` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.invite + admin.tenant_users.critical | `core.admin.tenants.users.invite` |
| DELETE | `/api/admin/core/v1/tenants/:id/users/:userId` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.delete + admin.tenant_users.critical | `core.admin.tenants.users.delete` |
| GET | `/api/admin/core/v1/tenants/:id/users/:userId` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.users.get` |
| PATCH | `/api/admin/core/v1/tenants/:id/users/:userId` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.update | `core.admin.tenants.users.update` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/activate` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.suspend + admin.tenant_users.critical | `core.admin.tenants.users.activate` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/change-password` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.reset_password + admin.tenant_users.critical | `core.admin.tenants.users.change-password` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/resend-invite` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.invite + admin.tenant_users.critical | `core.admin.tenants.users.resend-invite` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/reset-password` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.reset_password + admin.tenant_users.critical | `core.admin.tenants.users.reset-password` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/restore` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.restore + admin.tenant_users.critical | `core.admin.tenants.users.restore` |
| PATCH | `/api/admin/core/v1/tenants/:id/users/:userId/roles` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.assign_roles + admin.tenant_users.critical | `core.admin.tenants.users.roles.update` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/suspend` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.suspend + admin.tenant_users.critical | `core.admin.tenants.users.suspend` |
| POST | `/api/admin/core/v1/tenants/:id/users/:userId/transfer-ownership` | WRITE_SENSITIVE | yes | ALL | admin.tenant_users.transfer_ownership + admin.tenant_users.critical | `core.admin.tenants.users.transfer-ownership` |
| GET | `/api/admin/core/v1/tenants/:id/users/summary` | AUTHENTICATED | yes | ALL | admin.tenant_users.read | `core.admin.tenants.users.summary` |
| GET | `/api/admin/core/v1/tenants/:tenantId/billing-summary` | AUTHENTICATED | yes | ALL | admin.invoices.read | `core.admin.tenants.billing-summary.get` |
| GET | `/api/admin/core/v1/tenants/:tenantId/database-relocation-preflight` | AUTHENTICATED | yes | ALL | admin.tenant_relocations.read | `core.admin.tenants.database-relocation-preflight` |
| GET | `/api/admin/core/v1/tenants/:tenantId/operations` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.operations.list` |
| GET | `/api/admin/core/v1/tenants/:tenantId/operations/:operationId` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.operations.get` |
| POST | `/api/admin/core/v1/tenants/:tenantId/operations/:operationId/cancel` | WRITE_SENSITIVE | yes | ALL | admin.tenants.read + admin.tenants.reprovision + admin.tenants.critical | `core.admin.tenants.operations.cancel` |
| POST | `/api/admin/core/v1/tenants/:tenantId/operations/:operationId/retry` | WRITE_SENSITIVE | yes | ALL | admin.tenants.read + admin.tenants.reprovision + admin.tenants.critical | `core.admin.tenants.operations.retry` |
| GET | `/api/admin/core/v1/tenants/:tenantId/operations/:operationId/timeline` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.operations.timeline` |
| GET | `/api/admin/core/v1/tenants/:tenantId/payments` | AUTHENTICATED | yes | ALL | admin.wallet.read | `core.admin.payments.by-tenant.list` |
| GET | `/api/admin/core/v1/tenants/:tenantId/provisioning-state/components` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.provisioning-state.components.list` |
| GET | `/api/admin/core/v1/tenants/:tenantId/provisioning-state/seeds` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.provisioning-state.seeds.list` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/operations/add-application` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.add-application + admin.provisioning.critical | `core.admin.tenants.provisioning.operations.add-application` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/operations/decommission` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.decommission + admin.provisioning.critical | `core.admin.tenants.provisioning.operations.decommission` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/operations/repair` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.repair + admin.provisioning.critical | `core.admin.tenants.provisioning.operations.repair` |
| GET | `/api/admin/core/v1/tenants/:tenantId/provisioning/prerequisite-evidence` | READ_HEAVY | yes | ALL | admin.provisioning.prerequisites.read | `core.admin.tenants.provisioning.prerequisite-evidence.list` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/prerequisite-requests` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.prerequisites.request + admin.provisioning.critical | `core.admin.tenants.provisioning.prerequisite-requests.create` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/seed-conflicts/:seedStateId/resolve` | WRITE_SENSITIVE | yes | ALL | admin.provisioning.conflicts.resolve + admin.provisioning.critical | `core.admin.tenants.provisioning.seed-conflicts.resolve` |
| GET | `/api/admin/core/v1/tenants/:tenantId/provisioning/updates` | AUTHENTICATED | yes | ALL | admin.tenants.read | `core.admin.tenants.provisioning.updates.list` |
| POST | `/api/admin/core/v1/tenants/:tenantId/provisioning/updates/apply` | WRITE_SENSITIVE | yes | ALL | admin.tenants.reprovision + admin.tenants.critical + admin.provisioning.critical | `core.admin.tenants.provisioning.updates.apply` |
| GET | `/api/admin/core/v1/tenants/:tenantId/storage-migration-preflight` | AUTHENTICATED | yes | ALL | admin.storage_migrations.read | `core.admin.tenants.storage-migration-preflight` |
| POST | `/api/admin/core/v1/tenants/:tenantId/storage-migrations` | WRITE_SENSITIVE | yes | ALL | admin.storage_migrations.execute + admin.storage_migrations.critical | `core.admin.storage-migrations.execute` |
| GET | `/api/admin/core/v1/tenants/:tenantId/subscription` | AUTHENTICATED | yes | ALL | admin.subscriptions.read | `core.admin.subscriptions.v1.get` |
| POST | `/api/admin/core/v1/tenants/:tenantId/subscription` | WRITE_SENSITIVE | yes | ALL | admin.subscriptions.create + admin.subscriptions.critical | `core.admin.subscriptions.v1.seed` |
| GET | `/api/admin/core/v1/tenants/:tenantId/subscription/items` | AUTHENTICATED | yes | ALL | admin.subscriptions.read | `core.admin.subscriptions.v1.items.list` |
| GET | `/api/admin/core/v1/tenants/:tenantId/wallet` | AUTHENTICATED | yes | ALL | admin.wallet.read | `core.admin.wallets.by-tenant.list` |
| POST | `/api/admin/core/v1/tenants/:tenantId/wallet/adjustments` | WRITE_SENSITIVE | yes | ALL | admin.wallet.manage + admin.wallet.critical | `core.admin.wallets.adjustments.create` |
| POST | `/api/admin/core/v1/tenants/:tenantId/wallet/adjustments/preview` | WRITE_SENSITIVE | yes | ALL | admin.wallet.manage | `core.admin.wallets.adjustments.preview` |
| GET | `/api/admin/core/v1/tenants/:tenantId/wallet/ledger` | AUTHENTICATED | yes | ALL | admin.wallet.read | `core.admin.wallets.by-tenant.ledger` |
| GET | `/api/admin/core/v1/tenants/create-options` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.create-options.list` |
| GET | `/api/admin/core/v1/tenants/database-placement-options` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.database-placement-options.list` |
| POST | `/api/admin/core/v1/tenants/provisioning-plans` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.provisioning-plans.preview` |
| POST | `/api/admin/core/v1/tenants/reverse-geocode` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.reverse-geocode` |
| GET | `/api/admin/core/v1/tenants/storage-placement-options` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.storage-placement-options.list` |
| POST | `/api/admin/core/v1/tenants/validate-identity` | AUTHENTICATED | yes | ALL | admin.tenants.create | `core.admin.tenants.validate-identity` |
| DELETE | `/api/admin/core/v1/tiers/:id` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.tiers.delete` |
| PATCH | `/api/admin/core/v1/tiers/:id` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.tiers.update` |
| GET | `/api/admin/core/v1/tiers/:tierId/features` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.tier-features.list` |
| PATCH | `/api/admin/core/v1/tiers/:tierId/features` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.tier-features.set` |
| GET | `/api/admin/core/v1/tiers/:tierId/price-tiers` | AUTHENTICATED | yes | ALL | admin.catalog.read | `core.admin.catalog.price-tiers.list` |
| PATCH | `/api/admin/core/v1/tiers/:tierId/price-tiers` | WRITE_SENSITIVE | yes | ALL | admin.catalog.manage + admin.catalog.critical | `core.admin.catalog.price-tiers.set` |
| GET | `/api/admin/core/v1/users` | AUTHENTICATED | yes | ALL | admin.users.read | `core.admin.users.list` |
| POST | `/api/admin/core/v1/users` | WRITE_SENSITIVE | yes | ALL | admin.users.invite + admin.users.critical | `core.admin.users.create` |
| DELETE | `/api/admin/core/v1/users/:id` | WRITE_SENSITIVE | yes | ALL | admin.users.delete + admin.users.critical | `core.admin.users.delete` |
| GET | `/api/admin/core/v1/users/:id` | AUTHENTICATED | yes | ALL | admin.users.read | `core.admin.users.get` |
| PATCH | `/api/admin/core/v1/users/:id` | WRITE_SENSITIVE | yes | ALL | admin.users.update + admin.users.critical | `core.admin.users.update` |
| POST | `/api/admin/core/v1/users/:id/activate` | WRITE_SENSITIVE | yes | ALL | admin.users.suspend + admin.users.critical | `core.admin.users.activate` |
| PATCH | `/api/admin/core/v1/users/:id/roles` | WRITE_SENSITIVE | yes | ALL | admin.users.assign_roles + admin.users.critical | `core.admin.users.roles.set` |
| POST | `/api/admin/core/v1/users/:id/suspend` | WRITE_SENSITIVE | yes | ALL | admin.users.suspend + admin.users.critical | `core.admin.users.suspend` |
| GET | `/api/admin/core/v1/users/me/profile` | AUTHENTICATED | yes | ALL | — | `core.admin.users.profile.get` |
| PATCH | `/api/admin/core/v1/users/me/profile` | WRITE_SENSITIVE | yes | ALL | — | `core.admin.users.profile.update` |
| GET | `/api/admin/core/v1/wallet/input-currencies` | AUTHENTICATED | yes | ALL | admin.wallet.read | `core.admin.wallets.input-currencies.list` |
| GET | `/api/admin/core/v1/wallets/:walletId/ledger` | AUTHENTICATED | yes | ALL | admin.wallet.read | `core.admin.wallets.ledger` |
