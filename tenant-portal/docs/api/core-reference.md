# Core — Route Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:api-reference`.
> Generator: `scripts/docs/generate-api-reference.mjs`
> Source: `docs/generated/tenant-api-routes.json`

Status: **verified** (Gateway exposure and transport policy only)

Last source verification: **2026-09-09**

Generated at: **2026-09-09T17:42:21.852Z**

Backend revision: `22e119066314`

Owning app: **core-app**

Routes: **224**

## What this page is

The exhaustive method-and-path index for every Gateway route owned by
core-app on the tenant master. It proves Gateway exposure and
transport policy. It does **not** prove DTO fields, permissions, response
shapes or error codes — those live in the hand-written pages:

- [core-auth.md](core-auth.md)
- [core-notifications.md](core-notifications.md)
- [core-identity.md](core-identity.md)
- [core-settings.md](core-settings.md)
- [core-billing.md](core-billing.md)
- [core-directory.md](core-directory.md)
- [core-templates.md](core-templates.md)

Read [README.md](README.md) first for envelopes, pagination, idempotency and
the capabilities contract.

Routes marked `DO_NOT_CALL` are tenant-master reachable platform or
integration endpoints, not application feature APIs. Never call them from
browser code.

## Routes

| Method | Canonical path | Route key | Class | Idempotent | Portal usage |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/activities` | `core.tenant.activities.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/activities` | `core.tenant.activities.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/activities/:id` | `core.tenant.activities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/activities/:id` | `core.tenant.activities.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/activities/:id/cancel` | `core.tenant.activities.cancel` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/activities/:id/complete` | `core.tenant.activities.complete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/activities/assignees` | `core.tenant.activities.assignees` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/activity-types` | `core.tenant.activities.types` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/audit` | `core.tenant.audit.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/audit/entities/:entityType/:entityId` | `core.tenant.audit.entity-history` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/accept-invite` | `core.tenant.auth.accept-invite` | PUBLIC | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/activity` | `core.tenant.auth.activity` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/forgot-password` | `core.tenant.auth.forgot-password` | PUBLIC | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/login` | `core.tenant.auth.login` | PUBLIC | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/logout` | `core.tenant.auth.logout` | PUBLIC | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/logout-all` | `core.tenant.auth.logout-all` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/auth/me` | `core.tenant.auth.me` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/refresh` | `core.tenant.auth.refresh` | PUBLIC | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/auth/reset-password` | `core.tenant.auth.reset-password` | PUBLIC | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/auth/sessions` | `core.tenant.auth.sessions.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/auth/sessions/:sessionId` | `core.tenant.auth.sessions.revoke` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/invoices` | `core.tenant.billing.invoices.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/invoices/:invoiceId` | `core.tenant.billing.invoices.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents` | `core.tenant.billing.invoices.payment-intents.create.v1` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-intents/active` | `core.tenant.billing.invoices.payment-intents.active` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/billing/invoices/:invoiceId/payment-quote` | `core.tenant.billing.invoices.payment-quote` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/payment-input-currencies` | `core.tenant.billing.payment-input-currencies.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/payments/:paymentId` | `core.tenant.billing.payments.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/billing/summary` | `core.tenant.billing.summary` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations` | `core.tenant.application-access.branch-applications.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey` | `core.tenant.application-access.branch-addon.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey` | `core.tenant.application-access.branch.override.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey/configuration` | `core.tenant.application-access.branch-configuration.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey/configuration` | `core.tenant.application-access.branch.configuration.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branches/:branchId/application-activations/:applicationKey/addons/:addonKey/configuration/input-schema` | `core.tenant.application-access.branch-configuration-input.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branding` | `core.tenant.branding.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/branding` | `core.tenant.branding.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/branding/icon` | `core.tenant.branding.icon.upload` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/branding/logo` | `core.tenant.branding.logo.upload` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branding/public` | `core.tenant.branding.public` | PUBLIC | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branding/public/icon` | `core.tenant.branding.public-icon` | PUBLIC | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/branding/public/logo` | `core.tenant.branding.public-logo` | PUBLIC | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations` | `core.tenant.application-access.company-applications.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey` | `core.tenant.application-access.company-application.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey` | `core.tenant.application-access.application.activation.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey` | `core.tenant.application-access.company-addon.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey` | `core.tenant.application-access.addon.activation.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/activation-commands/:commandId` | `core.tenant.application-access.company-addon-activation-command.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration` | `core.tenant.application-access.company-configuration.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration` | `core.tenant.application-access.company.configuration.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration-commands/:commandId` | `core.tenant.application-access.company-addon-configuration-command.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/companies/:companyId/application-activations/:applicationKey/addons/:addonKey/configuration/input-schema` | `core.tenant.application-access.company-configuration-input.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/currencies` | `core.tenant.currencies.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/currencies` | `core.tenant.currencies.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/currencies/:id` | `core.tenant.currencies.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/currencies/:id` | `core.tenant.currencies.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/currencies/:id/set-default` | `core.tenant.currencies.set-default` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/addresses/:addressId` | `core.tenant.directory.addresses.by.addressid.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/directory/addresses/:addressId` | `core.tenant.directory.addresses.by.addressid.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/contact-methods/:methodId` | `core.tenant.directory.contact.methods.by.methodid.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/directory/contact-methods/:methodId` | `core.tenant.directory.contact.methods.by.methodid.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/directory/parties` | `core.tenant.directory.parties.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/parties` | `core.tenant.directory.parties.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/parties/:id` | `core.tenant.directory.parties.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/directory/parties/:id` | `core.tenant.directory.parties.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/directory/parties/:id` | `core.tenant.directory.parties.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/parties/:id/addresses` | `core.tenant.directory.parties.by.id.addresses.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/parties/:id/contact-methods` | `core.tenant.directory.parties.by.id.contact.methods.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/directory/parties/:id/contacts` | `core.tenant.directory.parties.by.id.contacts.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/parties/:id/image` | `core.tenant.directory.parties.by.id.image.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/directory/parties/:id/image` | `core.tenant.directory.parties.by.id.image.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/parties/:id/image` | `core.tenant.directory.parties.by.id.image.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/parties/:id/roles` | `core.tenant.directory.parties.by.id.roles.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/party-roles/:roleId` | `core.tenant.directory.party.roles.by.roleid.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/directory/relationships` | `core.tenant.directory.relationships.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/directory/relationships/:relationshipId` | `core.tenant.directory.relationships.by.relationshipid.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/directory/settings` | `core.tenant.directory.settings.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/directory/settings` | `core.tenant.directory.settings.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/email-config` | `core.tenant-email-config.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/email-config` | `core.tenant-email-config.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/email-config/verify` | `core.tenant-email-config.verify` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/email-config/verify-connection` | `core.tenant-email-config.verify-connection` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/notifications` | `core.tenant.notifications.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/notifications/:id` | `core.tenant.notifications.by.id.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/:id/ack` | `core.tenant.notifications.by.id.ack.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/:id/acknowledge` | `core.tenant.notifications.by.id.acknowledge.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/:id/dismiss` | `core.tenant.notifications.by.id.dismiss.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/:id/read` | `core.tenant.notifications.by.id.read.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/notifications/config` | `core.tenant.notifications.config.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/device-tokens` | `core.tenant.notifications.device-tokens.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/notifications/device-tokens/:id` | `core.tenant.notifications.device-tokens.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/mark-all-read` | `core.tenant.notifications.mark-all-read.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/notifications/preferences` | `core.tenant.notifications.preferences.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/notifications/preferences` | `core.tenant.notifications.preferences.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/notifications/read-all` | `core.tenant.notifications.read-all.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/notifications/unread-count` | `core.tenant.notifications.unread-count.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/numbering` | `core.tenant.numbering.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/numbering` | `core.tenant.numbering.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/numbering/:code/peek` | `core.tenant.numbering.peek` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/numbering/:id` | `core.tenant.numbering.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/branches` | `core.tenant.organization.branches.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/organization/branches` | `core.tenant.organization.branches.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/organization/branches/:id` | `core.tenant.organization.branches.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/branches/:id` | `core.tenant.organization.branches.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/organization/branches/:id` | `core.tenant.organization.branches.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/companies` | `core.tenant.organization.companies.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/organization/companies` | `core.tenant.organization.companies.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/organization/companies/:id` | `core.tenant.organization.companies.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/companies/:id` | `core.tenant.organization.companies.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/organization/companies/:id` | `core.tenant.organization.companies.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/departments` | `core.tenant.organization.departments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/organization/departments` | `core.tenant.organization.departments.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/organization/departments/:id` | `core.tenant.organization.departments.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/departments/:id` | `core.tenant.organization.departments.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/organization/departments/:id` | `core.tenant.organization.departments.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/teams` | `core.tenant.organization.teams.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/organization/teams` | `core.tenant.organization.teams.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/organization/teams/:id` | `core.tenant.organization.teams.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/teams/:id` | `core.tenant.organization.teams.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/organization/teams/:id` | `core.tenant.organization.teams.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/organization/tree` | `core.tenant.organization.tree` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/payments` | `core.tenant.payments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/payments/topup` | `core.tenant.payments.topup` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/permissions` | `core.tenant.permissions.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/provisioning/operations/:operationId` | `core.tenant.provisioning.operations.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/provisioning/updates` | `core.tenant.provisioning.updates.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/provisioning/updates/apply` | `core.tenant.provisioning.updates.apply` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/public/fqdn-validation/:token` | `core.public.fqdn-validation.validate` | PUBLIC | yes | PLATFORM_VALIDATION_DO_NOT_CALL_AS_FEATURE_API |
| GET | `/api/tenant/core/v1/public/geography/countries/:countryCode/states` | `core.public.geography.states.list` | PUBLIC | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/public/geography/countries/:countryCode/states/:stateCode/cities` | `core.public.geography.cities.list` | PUBLIC | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/public/payments/webhook` | `core.payments.webhook` | PUBLIC | yes | EXTERNAL_CALLBACK_DO_NOT_CALL |
| GET | `/api/tenant/core/v1/public/tenant-host/status` | `core.public.tenant-host.status` | PUBLIC | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/roles` | `core.tenant.roles.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/roles` | `core.tenant.roles.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/roles/:id` | `core.tenant.roles.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/roles/:id` | `core.tenant.roles.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/roles/:id` | `core.tenant.roles.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/roles/:id/permissions` | `core.tenant.roles.permissions.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription` | `core.tenant.subscriptions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/catalogue` | `core.tenant.subscriptions.catalogue.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections` | `core.tenant.subscriptions.definition-adoption-selections.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/definition-adoption-selections/:addonSelectionId/targets` | `core.tenant.subscriptions.definition-adoption-selections.targets.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/items` | `core.tenant.subscriptions.items.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/operations/:operationId` | `core.tenant.subscriptions.operations.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/subscription/operations/:operationId/recovery` | `core.tenant.subscriptions.operations.recover` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews` | `core.tenant.subscriptions.plan-change-previews.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/apply` | `core.tenant.subscriptions.plan-change-previews.apply` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/subscription/plan-change-previews/:previewId/receipt` | `core.tenant.subscriptions.plan-change-previews.receipt.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/subscription/preparations` | `core.tenant.subscriptions.preparations.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/taxes` | `core.tenant.taxes.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/taxes` | `core.tenant.taxes.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/taxes/:id` | `core.tenant.taxes.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/taxes/:id` | `core.tenant.taxes.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates` | `core.templates.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates` | `core.templates.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/templates/:templateId` | `core.templates.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId` | `core.templates.definition.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/templates/:templateId` | `core.templates.definition.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/archive` | `core.templates.archive` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId/draft` | `core.templates.draft.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/templates/:templateId/draft` | `core.templates.draft.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots` | `core.templates.draft.recovery.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/draft/recovery-snapshots/:snapshotId/restore` | `core.templates.draft.recovery.restore` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/duplicate` | `core.templates.duplicate` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/email` | `core.templates.preview.email` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/html` | `core.templates.preview.html` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/preview/pdf` | `core.templates.preview.pdf.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/publish` | `core.templates.publish` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/restore` | `core.templates.restore` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/validate` | `core.templates.validate` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId/validation-runs/:validationRunId` | `core.templates.validation.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId/versions` | `core.templates.versions.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/:templateId/versions/:versionId` | `core.templates.version.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/restore` | `core.templates.version.restore` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/:templateId/versions/:versionId/retire` | `core.templates.version.retire` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/assets` | `core.templates.assets.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/assets` | `core.templates.asset.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/templates/assets/:assetId` | `core.templates.asset.retire` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/assets/:assetId` | `core.templates.asset.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/assets/:assetId/content` | `core.templates.asset.content` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/assignments` | `core.templates.assignments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/assignments` | `core.templates.assignment.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `core.templates.assignment.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `core.templates.assignment.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/templates/assignments/:assignmentId` | `core.templates.assignment.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/assignments/resolve` | `core.templates.assignments.resolve` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/creation-scopes` | `core.templates.creation-scopes.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/data-sources` | `core.templates.data-sources.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/data-sources/:adapterKey/schema` | `core.templates.data-source.schema.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId` | `core.templates.preview.pdf.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/preview-jobs/:jobId/artifact` | `core.templates.preview.pdf.artifact` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/public-assets/:assetId` | `core.templates.asset.public-content` | PUBLIC | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/templates/search` | `core.templates.search` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/templates/starters` | `core.templates.starters.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users` | `core.tenant.users.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users` | `core.tenant.users.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/users/:id` | `core.tenant.users.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:id` | `core.tenant.users.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/core/v1/users/:id` | `core.tenant.users.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:id/activate` | `core.tenant.users.activate` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:id/suspend` | `core.tenant.users.suspend` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:id/team-memberships` | `core.tenant.users.team-memberships.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:id/team-memberships` | `core.tenant.users.team-memberships.add` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/users/:id/team-memberships` | `core.tenant.users.team-memberships.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/users/:id/team-memberships/:membershipId` | `core.tenant.users.team-memberships.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:userId/addon-assignment-options` | `core.tenant.application-access.addon-assignment-options.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:userId/addon-assignments` | `core.tenant.application-access.addon-assignments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:userId/addon-assignments` | `core.tenant.application-access.addon.assign` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/users/:userId/addon-assignments/:assignmentId` | `core.tenant.application-access.addon.unassign` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:userId/assignments` | `core.tenant.users.assignments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:userId/assignments` | `core.tenant.users.assignments.add` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/users/:userId/assignments` | `core.tenant.users.assignments.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/users/:userId/assignments/:assignmentId` | `core.tenant.users.assignments.delete` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:userId/modules` | `core.tenant.users.modules.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/core/v1/users/:userId/modules` | `core.tenant.users.modules.assign` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/core/v1/users/:userId/modules/:moduleKey` | `core.tenant.users.modules.unassign` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `core.tenant.users.scope-role-assignments.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/users/:userId/scope-role-assignments` | `core.tenant.users.scope-role-assignments.set` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/users/me/profile` | `core.tenant.users.profile.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/users/me/profile` | `core.tenant.users.profile.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/wallet` | `core.tenant.wallets.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/wallet/ledger` | `core.tenant.wallets.ledger` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/core/v1/workspace-settings` | `core.tenant.workspace-settings.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/core/v1/workspace-settings` | `core.tenant.workspace-settings.update` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
