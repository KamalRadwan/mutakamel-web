# CRM — Route Reference

> **GENERATED FILE — do not edit by hand.**
> Regenerate with `pnpm docs:api-reference`.
> Generator: `scripts/docs/generate-api-reference.mjs`
> Source: `docs/generated/tenant-api-routes.json`

Status: **verified** (Gateway exposure and transport policy only)

Last source verification: **2026-11-11**

Generated at: **2026-11-11T05:04:59.211Z**

Backend revision: `d98f27966914+dirty`

Owning app: **crm-app**

Routes: **198**

## What this page is

The exhaustive method-and-path index for every Gateway route owned by
crm-app on the tenant master. It proves Gateway exposure and
transport policy. It does **not** prove DTO fields, permissions, response
shapes or error codes — those live in the hand-written pages:

- [crm-leads.md](crm-leads.md)
- [crm-customer-profiles.md](crm-customer-profiles.md)
- [crm-opportunities.md](crm-opportunities.md)
- [crm-catalogues.md](crm-catalogues.md)
- [crm-dashboards.md](crm-dashboards.md)

Read [README.md](README.md) first for envelopes, pagination, idempotency and
the capabilities contract.

Routes marked `DO_NOT_CALL` are tenant-master reachable platform or
integration endpoints, not application feature APIs. Never call them from
browser code.

## Routes

| Method | Canonical path | Route key | Class | Idempotent | Portal usage |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/tenant/crm/v1/acquisition-sources` | `crm.acquisition.sources.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/acquisition-sources` | `crm.acquisition.sources.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition.sources.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition.sources.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/acquisition-sources/:id` | `crm.acquisition.sources.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `crm.acquisition.sources.by.id.icon.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `crm.acquisition.sources.by.id.icon.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/acquisition-sources/reorder` | `crm.acquisition.sources.reorder.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/activities` | `crm.activities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/activities` | `crm.activities.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/activities/:id` | `crm.activities.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/assignable-owners` | `crm.assignable.owners.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/attachments` | `crm.attachments.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/attachments/:id` | `crm.attachments.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/attachments/:id/download` | `crm.attachments.by.id.download.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/attachments/upload` | `crm.attachments.upload.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/custom-fields` | `crm.custom.fields.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/custom-fields` | `crm.custom.fields.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/custom-fields/:id` | `crm.custom.fields.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/custom-fields/:id/requirements` | `crm.custom.fields.by.id.requirements.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/custom-fields/values` | `crm.custom.fields.values.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/custom-fields/values` | `crm.custom.fields.values.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/customer-profiles` | `crm.customer.profiles.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles` | `crm.customer.profiles.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer.profiles.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer.profiles.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/customer-profiles/:id` | `crm.customer.profiles.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles/:id/contacts` | `crm.customer.profiles.contacts.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/customer-profiles/:id/tags` | `crm.customer.profiles.by.id.tags.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles/:id/tags` | `crm.customer.profiles.by.id.tags.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/customer-profiles/:id/tags/:tagId` | `crm.customer.profiles.by.id.tags.by.tag.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles/board` | `crm.customer.profiles.board.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles/board/statuses/:status` | `crm.customer.profiles.board.statuses.by.status.post` | AUTHENTICATED | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/customer-profiles/capabilities` | `crm.customer.profiles.capabilities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/customer-profiles/search` | `crm.customer.profiles.search.post` | AUTHENTICATED | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards` | `crm.dashboard.builder.list.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards` | `crm.dashboard.builder.create.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboard.builder.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboard.builder.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/dashboards/:id` | `crm.dashboard.builder.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/dashboards/:id/default` | `crm.dashboard.builder.default.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/duplicate` | `crm.dashboard.builder.duplicate.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/dashboards/:id/favorite` | `crm.dashboard.builder.favorite.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/dashboards/:id/layout` | `crm.dashboard.builder.layout.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/placements` | `crm.dashboard.builder.placements.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId` | `crm.dashboard.builder.placements.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy` | `crm.dashboard.builder.placements.version-policy.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy` | `crm.dashboard.builder.placements.version-policy.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/placements/:placementId/version-policy/impact` | `crm.dashboard.builder.placements.version-policy.impact.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/run` | `crm.dashboard.builder.run.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/:id/shares` | `crm.dashboard.builder.shares.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/shares` | `crm.dashboard.builder.shares.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/dashboards/:id/shares/:shareId` | `crm.dashboard.builder.shares.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/:id/widgets/:widgetId/drilldown` | `crm.dashboard.builder.widget.drilldown.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/action-center` | `crm.dashboards.action.center.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/activities-productivity` | `crm.dashboards.activities.productivity.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/blueprints` | `crm.dashboard.builder.blueprints.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/dashboards/blueprints/:blueprintKey/adoption` | `crm.dashboard.builder.blueprints.adoption.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/catalog` | `crm.dashboard.builder.catalog.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/customer-intelligence` | `crm.dashboards.customer.intelligence.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/data-quality` | `crm.dashboards.data.quality.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/default` | `crm.dashboard.builder.default.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `crm.dashboard.builder.from.template.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/dashboards/from-template/:templateKey` | `crm.dashboard.builder.from.template.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/inquiry-identities/:leadId` | `crm.dashboard.inquiry.identities.context.get` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/inquiry-identities/:leadId` | `crm.dashboard.inquiry.identities.review.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/lead-acquisition-quality-report` | `crm.dashboards.lead.acquisition.quality.report.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/lead-acquisition-report` | `crm.dashboards.lead.acquisition.report.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/lead-cohort-branches` | `crm.dashboards.lead.cohort.branches.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/lead-conversion-journey` | `crm.dashboards.lead.conversion.journey.get` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/lead-intake-allocation-report` | `crm.dashboards.lead.intake.allocation.report.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/lead-lifecycle-inventory-report` | `crm.dashboards.lead.lifecycle.inventory.report.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/dashboards/lead-source-mix-report` | `crm.dashboards.lead.source.mix.report.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/lead-team-cohort` | `crm.dashboards.lead.team.cohort.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/leads` | `crm.dashboards.leads.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/navigation` | `crm.dashboard.builder.navigation.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/overview` | `crm.dashboards.overview.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/sales-pipeline` | `crm.dashboards.sales.pipeline.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/share-targets` | `crm.dashboard.builder.share.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/won-sales-cycle` | `crm.dashboards.won.sales.cycle.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/dashboards/won-target-attainment` | `crm.dashboards.won.target.attainment.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/lead-stages` | `crm.lead.stages.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/lead-stages` | `crm.lead.stages.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/lead-stages/:id` | `crm.lead.stages.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/lead-stages/:id` | `crm.lead.stages.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/lead-stages/:id/default` | `crm.lead.stages.by.id.default.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/lead-stages/reorder` | `crm.lead.stages.reorder.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads` | `crm.leads.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads` | `crm.leads.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/leads/:id` | `crm.leads.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads/:id` | `crm.leads.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/leads/:id` | `crm.leads.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/:id/convert` | `crm.leads.by.id.convert.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/:id/stage` | `crm.leads.by.id.stage.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads/:id/tags` | `crm.leads.by.id.tags.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/:id/tags` | `crm.leads.by.id.tags.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/leads/:id/tags/:tagId` | `crm.leads.by.id.tags.by.tag.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/board` | `crm.leads.board.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/board/stages/:stageId` | `crm.leads.board.stages.by.stage.id.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/bulk-delete` | `crm.leads.bulk.delete.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/bulk-stage` | `crm.leads.bulk.stage.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/bulk-update` | `crm.leads.bulk.update.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads/capabilities` | `crm.leads.capabilities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads/company-options` | `crm.leads.company.options.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/leads/company-options/:companyPartyId/contacts` | `crm.leads.company.options.contacts.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/document-counts` | `crm.leads.document.counts.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/duplicate-check` | `crm.leads.duplicate.check.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/kpis` | `crm.leads.kpis.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/leads/search` | `crm.leads.search.post` | AUTHENTICATED | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/notes` | `crm.notes.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/notes` | `crm.notes.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/notes/:id` | `crm.notes.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/notes/:id` | `crm.notes.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunities` | `crm.opportunities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunities` | `crm.opportunities.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/opportunities/:id` | `crm.opportunities.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/opportunities/:id/pipeline` | `crm.opportunities.by.id.pipeline.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunities/:id/stage` | `crm.opportunities.by.id.stage.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunities/:id/stage-history` | `crm.opportunities.by.id.stage.history.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunities/:id/tags` | `crm.opportunities.by.id.tags.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunities/:id/tags` | `crm.opportunities.by.id.tags.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/opportunities/:id/tags/:tagId` | `crm.opportunities.by.id.tags.by.tag.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunities/capabilities` | `crm.opportunities.capabilities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunities/counts-by-party` | `crm.opportunities.counts.by.party.post` | AUTHENTICATED | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunities/search` | `crm.opportunities.search.post` | AUTHENTICATED | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunity-stages` | `crm.opportunity.stages.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/opportunity-stages` | `crm.opportunity.stages.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.opportunity.stages.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.opportunity.stages.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/opportunity-stages/:id` | `crm.opportunity.stages.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/outbound-emails` | `crm.outbound-emails.list` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/outbound-emails` | `crm.outbound-emails.create` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/outbound-emails/:outboundEmailId` | `crm.outbound-emails.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/outbound-emails/:outboundEmailId/retry` | `crm.outbound-emails.retry` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/outbound-emails/options` | `crm.outbound-emails.options` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/outbound-emails/preview` | `crm.outbound-emails.preview` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines` | `crm.pipelines.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/pipelines` | `crm.pipelines.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/pipelines/:id` | `crm.pipelines.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id` | `crm.pipelines.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/pipelines/:id` | `crm.pipelines.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id/assignments` | `crm.pipelines.by.id.assignments.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/pipelines/:id/assignments` | `crm.pipelines.by.id.assignments.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id/board` | `crm.pipelines.by.id.board.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id/cards` | `crm.pipelines.by.id.cards.get` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id/configuration` | `crm.pipelines.by.id.configuration.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/pipelines/:id/default` | `crm.pipelines.by.id.default.put` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/pipelines/:id/reset` | `crm.pipelines.by.id.reset.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/pipelines/:id/stages` | `crm.pipelines.by.id.stages.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/pipelines/:id/stages/:pipelineStageId` | `crm.pipelines.by.id.stages.by.pipelinestageid.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/:id/stages/:stageId/opportunities` | `crm.pipelines.by.id.stages.by.stageid.opportunities.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/pipelines/:id/stages/reorder` | `crm.pipelines.by.id.stages.reorder.patch` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/assignment-options` | `crm.pipelines.assignment.options.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/pipelines/configuration` | `crm.pipelines.configuration.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/settings` | `crm.settings.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PUT | `/api/tenant/crm/v1/settings` | `crm.settings.put` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/static-data` | `crm.static.data.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/tags` | `crm.tags.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/tags` | `crm.tags.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/tags/:id` | `crm.tags.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/tags/:id` | `crm.tags.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/tags/:id` | `crm.tags.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/targets` | `crm.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/targets` | `crm.targets.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/targets/:id` | `crm.targets.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/targets/:id` | `crm.targets.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/targets/:id` | `crm.targets.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/targets/working-calendars/:branchId/:year` | `crm.targets.working.calendars.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/targets/working-calendars/:branchId/:year` | `crm.targets.working.calendars.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets` | `crm.dashboard.widgets.list.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets` | `crm.dashboard.widgets.create.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/widgets/:id` | `crm.dashboard.widgets.by.id.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id` | `crm.dashboard.widgets.by.id.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/widgets/:id` | `crm.dashboard.widgets.by.id.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/clone` | `crm.dashboard.widgets.clone.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id/draft` | `crm.dashboard.widgets.draft.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/draft/discard` | `crm.dashboard.widgets.draft.discard.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/lifecycle` | `crm.dashboard.widgets.lifecycle.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/lifecycle-impact` | `crm.dashboard.widgets.lifecycle-impact.post` | READ_HEAVY | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id/ownership-transfer` | `crm.dashboard.widgets.ownership-transfer.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| PATCH | `/api/tenant/crm/v1/widgets/:id/ownership-transfer` | `crm.dashboard.widgets.ownership-transfer.patch` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/ownership-transfer/impact` | `crm.dashboard.widgets.ownership-transfer.impact.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id/ownership-transfer/targets` | `crm.dashboard.widgets.ownership-transfer.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/publish` | `crm.dashboard.widgets.publish.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/publish-impact` | `crm.dashboard.widgets.publish-impact.post` | READ_HEAVY | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.dashboard.widgets.shares.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/shares` | `crm.dashboard.widgets.shares.post` | WRITE_SENSITIVE | yes | TENANT_PORTAL |
| DELETE | `/api/tenant/crm/v1/widgets/:id/shares/:shareId` | `crm.dashboard.widgets.shares.delete` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/:id/versions` | `crm.dashboard.widgets.versions.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/versions/compare` | `crm.dashboard.widgets.versions.compare.post` | READ_HEAVY | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/:id/versions/restore-draft` | `crm.dashboard.widgets.versions.restore-draft.post` | WRITE_SENSITIVE | no | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/catalog` | `crm.widgets.catalog.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/owner-options` | `crm.dashboard.widgets.owner-options.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/ownership-transfers` | `crm.dashboard.widgets.ownership-transfers.get` | AUTHENTICATED | yes | TENANT_PORTAL |
| POST | `/api/tenant/crm/v1/widgets/preview` | `crm.dashboard.widgets.preview.post` | READ_HEAVY | yes | TENANT_PORTAL |
| GET | `/api/tenant/crm/v1/widgets/share-targets` | `crm.dashboard.widgets.share.targets.get` | AUTHENTICATED | yes | TENANT_PORTAL |
