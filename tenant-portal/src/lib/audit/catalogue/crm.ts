// crm-app/packages/database/src/entities/tenant/{crm,dashboard,outbound-email}.entities.ts
// plus LeadsService/OpportunitiesService's explicit domain events.
export const crmAuditCatalogue = [
  ["Lead", "lead", "/crm/leads"],
  ["LeadEntity", "lead", "/crm/leads"],
  ["CustomerProfile", "customer", "/crm/customer-profiles"],
  ["CustomerProfileEntity", "customer", "/crm/customer-profiles"],
  ["Opportunity", "opportunity", "/crm/opportunities"],
  ["OpportunityEntity", "opportunity", "/crm/opportunities"],
  ["CrmPipelineEntity", "pipeline", "/crm/pipelines"],
  ["CrmOpportunityStageEntity", "stage", "/crm/opportunity-stages"],
  ["CrmDashboardEntity", "dashboard", "/crm/dashboards"],
  ["CrmWidgetEntity", "widget", "/crm/widgets"],
  ["CrmOutboundEmailEntity", "email", "/crm/outbound-emails"],
] as const;

// src/common/audit/crm-record-audit.ts registers notify:true on these subjects.
export const crmNotificationSubjects = new Set<string>([
  "Lead", "LeadEntity", "CustomerProfile", "CustomerProfileEntity", "Opportunity", "OpportunityEntity",
]);
