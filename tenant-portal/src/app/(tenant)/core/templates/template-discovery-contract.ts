import {
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  record,
  requiredText,
} from "../contracts/core-page";
import { TEMPLATE_SCOPE_TYPES, type TemplateScopeType } from "./templates-contract";

// The two discovery catalogues the create flow needs: which starters match an
// exact doc/output/adapter/locale/schema tuple, and which scopes the caller may
// create in.
//
// Source: core-app/src/tenant/template-platform/template-platform.service.ts
// (`listStarters`, `listCreationScopes`).

export interface TemplateCreationScope {
  type: TemplateScopeType;
  companyId: string | null;
  label: string | null;
}

export interface TemplateStarter {
  starterKey: string;
  displayName: string;
  documentType: string;
  outputChannel: string;
  layoutMode: string;
  dataSourceKey: string;
  locale: string;
  resolvedDirection: string;
}

export function parseTemplateStarters(payload: unknown): TemplateStarter[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidCoreResponse();
  return body.items.map((entry) => {
    const row = record(entry);
    if (!row) invalidCoreResponse();
    return {
      starterKey: requiredText(row, "starterKey", 120),
      displayName: requiredText(row, "displayName", 200),
      documentType: requiredText(row, "documentType", 40),
      outputChannel: requiredText(row, "outputChannel", 16),
      layoutMode: requiredText(row, "layoutMode", 24),
      dataSourceKey: requiredText(row, "dataSourceKey", 64),
      locale: requiredText(row, "locale", 35),
      resolvedDirection: requiredText(row, "resolvedDirection", 8),
    };
  });
}

export function parseCreationScopes(payload: unknown): TemplateCreationScope[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.scopes)) invalidCoreResponse();
  return body.scopes.map((entry) => {
    const row = record(entry);
    if (!row || !isMember(TEMPLATE_SCOPE_TYPES, row.type)) invalidCoreResponse();
    return {
      type: row.type,
      companyId: nullableUuidV7(row, "companyId"),
      label: nullableText(row, "label", 240),
    };
  });
}
