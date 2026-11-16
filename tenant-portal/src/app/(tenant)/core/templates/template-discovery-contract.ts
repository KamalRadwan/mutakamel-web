import { parseTemplateSourceTuple } from "./template-source-metadata";
import {
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  record,
  requiredText,
} from "../contracts/core-page";
import { TEMPLATE_SCOPE_TYPES, type TemplateScopeType } from "./templates-contract";
import { TEMPLATE_PAGE_ORIENTATIONS, templateCreatePage, templateStarterPageValues, type TemplateStarterPage } from "./template-create-page";

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
  dataSourceSchemaVersion: 1;
  dataSourceSchemaChecksum: string;
  editorSchemaVersion: 1;
  nodeRegistryVersion: "mvp-v1";
  templateContentChecksum: string;
  descriptorChecksum: string;
  defaultPage?: TemplateStarterPage;
}

// Optional presentation evidence belongs to this exact parsed response array.
const starterRegistryFingerprints = new WeakMap<readonly TemplateStarter[], string>();

export function getTemplateStarterRegistryFingerprint(items: readonly TemplateStarter[]): string | undefined {
  return starterRegistryFingerprints.get(items);
}

export function parseTemplateStarters(payload: unknown): TemplateStarter[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidCoreResponse();
  const items = body.items.map<TemplateStarter>((entry) => {
    const row = record(entry);
    if (!row) invalidCoreResponse();
    const identity = parseTemplateSourceTuple(row);
    if (row.dataSourceSchemaVersion !== 1 || row.editorSchemaVersion !== 1 || row.nodeRegistryVersion !== "mvp-v1") invalidCoreResponse();
    let defaultPage: TemplateStarterPage | undefined;
    if (Object.hasOwn(row, "defaultPage")) {
      if (identity.outputChannel !== "PRINT") invalidCoreResponse();
      defaultPage = parseStarterPage(row.defaultPage);
    }
    return {
      dataSourceSchemaVersion: 1,
      dataSourceSchemaChecksum: starterChecksum(row, "dataSourceSchemaChecksum"),
      editorSchemaVersion: 1,
      nodeRegistryVersion: "mvp-v1",
      templateContentChecksum: starterChecksum(row, "templateContentChecksum"),
      descriptorChecksum: starterChecksum(row, "descriptorChecksum"),
      starterKey: requiredText(row, "starterKey", 120),
      displayName: requiredText(row, "displayName", 200),
      documentType: identity.documentType,
      outputChannel: identity.outputChannel,
      layoutMode: identity.layoutMode,
      dataSourceKey: identity.dataSourceKey,
      locale: requiredText(row, "locale", 35),
      resolvedDirection: requiredText(row, "resolvedDirection", 8),
      ...(defaultPage ? { defaultPage } : {}),
    };
  });
  if (body.count === items.length && body.registryVersion === "template-platform.mvp.v1" &&
      typeof body.registryFingerprint === "string" && /^[a-f0-9]{64}$/u.test(body.registryFingerprint)) {
    starterRegistryFingerprints.set(items, body.registryFingerprint);
  }
  return items;
}

function parseStarterPage(value: unknown): TemplateStarterPage {
  const page = record(value);
  const margin = record(page?.marginMm);
  if (!page || !margin || Object.keys(page).length !== 3 || Object.keys(margin).length !== 4 ||
      !isMember(["A4", "A5", "LETTER"] as const, page.preset) || !isMember(TEMPLATE_PAGE_ORIENTATIONS, page.orientation)) invalidCoreResponse();
  const { top, end, bottom, start } = margin;
  if (typeof top !== "number" || typeof end !== "number" || typeof bottom !== "number" || typeof start !== "number") invalidCoreResponse();
  const result: TemplateStarterPage = { preset: page.preset, orientation: page.orientation, marginMm: { top, end, bottom, start } };
  if (!templateCreatePage(templateStarterPageValues(result))) invalidCoreResponse();
  return result;
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

/** Existing owner descriptor pins are retained exactly, never synthesized. */
function starterChecksum(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key, 64);
  if (!/^[a-f0-9]{64}$/u.test(value)) invalidCoreResponse();
  return value;
}
