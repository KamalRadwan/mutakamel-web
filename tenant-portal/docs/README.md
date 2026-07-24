# Tenant Portal Documentation

Welcome to the documentation for the `tenant-portal` application. This guide serves as a comprehensive reference for the Tenant APIs, static data structures, and Role-Based Access Control (RBAC) implementations. 

The Tenant Portal allows tenant administrators and users to manage their organization, settings, billing, templates, documents, and day-to-day activities within the Mutakamel workspace.

## API Documentation

Detailed endpoint specifications, required permissions, and frontend implementation notes are grouped by domain:

- [Auth API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/auth.md): Authentication, sessions, and multi-factor authentication (MFA).
- [Organization API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/organization.md): Companies, branches, departments, teams, and the organizational tree.
- [Users API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/users.md): User lifecycle, directory, invitations, and WebPhone configurations.
- [Roles API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/roles.md): Custom roles, permission catalogs, and branch-scoped role assignments.
- [Billing API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/billing.md): Invoices, payments, subscriptions, taxes, and currencies.
- [Settings API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/settings.md): Workspace configuration, branding, and document numbering sequences.
- [Tenant Host API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/tenant-host.md): Unauthenticated tenant resolution based on Host headers.
- [User Modules API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/user-modules.md): Seat licensing and business module assignment for users.
- [Notifications API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/notifications.md): In-app/push notifications, delivery preferences, and custom SMTP settings.
- [Templates API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/templates.md): The Template Designer platform, business letter generation, and asset management.
- [Activities API](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/activities.md): Task and log management, completions, cancellations, and assignments.

### CRM Module

- [CRM Leads](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/leads.md): Lead capture, branch-scoped visibility, and conversion flows.
- [CRM Opportunities](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/opportunities.md): Pipeline opportunity tracking and stages.
- [CRM Profiles](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/customer-profiles.md): Unified prospective and active customer tracking.
- [CRM Custom Fields](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/custom-fields.md): Tenant-defined custom fields and requirement definitions.
- [CRM Notes & Attachments](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/notes-attachments.md): Appended text notes and file uploads for CRM records.
- [CRM Outbound Emails](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/outbound-emails.md): Targeted email dispatches and delivery tracking.
- [CRM Dashboards](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/dashboards.md): Pre-aggregated widgets for pipeline and activity performance.
- [CRM Settings](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/crm/settings.md): Pipelines, Lead Stages, and global CRM Limits.

### Trade Module

- [Trade Catalog](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/catalog.md): Items, UOMs, company/branch overrides, and distribution channels.
- [Trade Commercial Accounts](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/commercial-accounts.md): B2B trade accounts, customer and vendor status.
- [Trade Documents](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/documents.md): Financial and operational documents (Quotations, Sales Orders).
- [Trade Financial Documents](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/financial-documents.md): Billing invoices and business contracts.
- [Trade Purchasing](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/purchasing.md): Procurement tracking and Purchase Orders.
- [Trade Purchase Quotations](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/purchase-quotations.md): Vendor quote management and RFQs.
- [Trade Inventory & Pricing](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/inventory-pricing.md): Stock availability, pricing rules, and reservations.
- [Trade Policy Studio](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/policy-studio.md): Evaluated pricing rules, discounts, and workflow logic.
- [Trade Control Tower](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/control-tower.md): Global error catching, retries, and manual overrides.
- [Trade Extensions & Automation](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/extensions-automation.md): Webhooks, bulk import schemas, and custom integrations.
- [Trade Dashboards](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/dashboards.md): Custom analytics engine for SQL widgets and shared grid layouts.
- [Trade Configuration Scope](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/configuration-scope.md): Evaluates hierarchal global settings based on branch contexts.
- [Trade Document Platform](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/api/trade/document-platform.md): Low-level profile configurations and numbering rules for B2B documents.

## Architecture and Security

- [RBAC Matrix](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/rbac-matrix.md): A comprehensive list of all required permissions and how they map to the various APIs.
- [Static Data & Enums](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/static-data.md): Key entity states, status codes, and global enumerations used across the platform.
- [Data Models (DTOs)](file:///c:/mutakamel.ai/frontend/tenant-portal/docs/dtos.md): Core Data Transfer Objects detailing request and response payloads.

## Development Guidelines

When developing features for the `tenant-portal`, adhere to the following principles:
- **Permissions**: Every non-public route must be guarded by `@UseGuards(TenantGuard)` and have appropriate `@RequirePermissions(...)` decorators mapped.
- **Tenant Scope**: Always use the authenticated `tenantId` extracted from the actor context (`@CurrentTenant` or `@CurrentActor`) to ensure queries strictly return tenant-owned data.
- **Internationalization**: Follow the established guidelines for bilingual (Arabic/English) support for UI strings.

For detailed guidelines, refer to the [AGENTS.md](file:///c:/mutakamel.ai/frontend/tenant-portal/.agents/AGENTS.md) file.
