import { parseTemplateSourceMetadata, type TemplateSourceMetadata } from "./template-source-metadata";
import type { CorePath } from "@/lib/api/envelope";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { readTemplateDraftReceipt } from "./template-draft-receipt";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { coreGet, coreGetResponse, corePatchResponse } from "../core-api";
import { invalidCoreResponse, record, requiredText, requiredUuidV7 } from "../contracts/core-page";
import { templatePath, type TemplateScope } from "./templates-contract";
import { parseEditorDocument, type EditorDocument } from "./template-editor-model";
import { TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES } from "./template-wire";

export interface TemplateDraftDocument { draftId: string; templateId: string; editorDocument: EditorDocument; revision: number; etag: string }
export interface TemplateDataSchema extends TemplateSourceMetadata { draftSavePrecondition?: "draft-schema"; fields: { path: string; dataType: string; allowedFormats: string[] }[]; syntheticFixtures: { fixtureKey: string; locale: string; fixtureChecksum?: string }[] }

export function parseTemplateDraftDocument(payload: unknown): TemplateDraftDocument {
  const draft = record(payload);
  if (!draft || !Number.isSafeInteger(draft.revision) || (draft.revision as number) < 1) invalidCoreResponse();
  return { draftId: requiredUuidV7(draft, "draftId"), templateId: requiredUuidV7(draft, "templateId"), editorDocument: parseEditorDocument(draft.editorDocument), revision: draft.revision as number, etag: requiredText(draft, "etag", 200) };
}

export async function fetchTemplateDraft(templateId: string, signal?: AbortSignal, dataSourceKey?: unknown): Promise<TemplateDraftDocument> {
  const path = `${templatePath(templateId)}/draft` as CorePath;
  const options = { signal, maxResponseBytes: TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES };
  let data: unknown;
  if (dataSourceKey === "TRADE_QUOTATION_PRINT_V1") {
    const response = await coreGetResponse(path, { ...options, requireExactResponseTarget: true });
    const receipt = readTemplateDraftReceipt({ ...response, body: response.data }, templateId, { method: "GET" });
    if (receipt.kind !== "loaded") invalidCoreResponse();
    data = receipt.draft;
  } else {
    data = (await coreGet(path, options)).data;
  }
  const draft = parseTemplateDraftDocument(data);
  if (draft.templateId !== templateId) invalidCoreResponse();
  return draft;
}

export async function saveTemplateDraft(
  templateId: string,
  editorDocument: EditorDocument,
  etag: string,
  mutationId = generateUUIDv7(),
  authority?: { assertCurrent(): void; requireReplay?: boolean },
): Promise<TemplateDraftDocument> {
  const response = await corePatchResponse(`${templatePath(templateId)}/draft` as CorePath, { editorDocument, clientMutationId: mutationId }, {
    headers: { "If-Match": etag, "x-idempotency-key": mutationId }, maxResponseBytes: TEMPLATE_DRAFT_RESPONSE_LIMIT_BYTES,
    requireExactResponseTarget: true,
    ...(authority && { assertCurrent: authority.assertCurrent }),
    ...(authority?.requireReplay && { redirect: "error" }),
  });
  const receipt = readTemplateDraftReceipt({ ...response, body: response.data }, templateId, {
    method: "PATCH", ifMatch: editorDocument.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" ? etag : undefined,
  });
  if (receipt.kind !== "saved" || (authority?.requireReplay && !isIdempotentReplay(response.headers))) invalidCoreResponse();
  const draft = parseTemplateDraftDocument(receipt.draft);
  if (draft.templateId !== templateId) invalidCoreResponse();
  return draft;
}

export function readDraftSavePrecondition(schema: Record<string, unknown>, adapterKey: string, scope: TemplateScope, status: number) {
  if (!Object.hasOwn(schema, "capabilities")) return undefined;
  const capabilities = record(schema.capabilities);
  if (!capabilities) invalidCoreResponse();
  if (!Object.hasOwn(capabilities, "draftSavePrecondition")) return undefined;
  const capability = record(capabilities.draftSavePrecondition);
  const target = record(capability?.scope);
  if (status !== 200 || adapterKey !== "TRADE_QUOTATION_PRINT_V1" || !capability ||
    Object.keys(capability).length !== 2 || capability.kind !== "draft-schema" || !target ||
    target.type !== scope.type || scope.branchId !== undefined) invalidCoreResponse();
  const sameScope = scope.type === "TENANT"
    ? scope.companyId === undefined && Object.keys(target).length === 1
    : scope.type === "COMPANY" && isUUIDv7(scope.companyId) && target.companyId === scope.companyId && Object.keys(target).length === 2;
  if (!sameScope) invalidCoreResponse();
  return capability.kind;
}

export async function fetchTemplateDataSchema(adapterKey: string, scope: TemplateScope, signal?: AbortSignal): Promise<TemplateDataSchema> {
  const query = new URLSearchParams({ scopeType: scope.type, schemaVersion: "1" });
  if (scope.companyId) query.set("companyId", scope.companyId);
  if (scope.branchId) query.set("branchId", scope.branchId);
  const response = await coreGet(`/api/tenant/core/v1/templates/data-sources/${encodeURIComponent(adapterKey)}/schema?${query}` as CorePath, {
    signal, maxResponseBytes: 900_000,
    ...(adapterKey === "TRADE_QUOTATION_PRINT_V1" && { requireExactResponseTarget: true }),
  });
  const metadata = parseTemplateSourceMetadata(response.data);
  if (metadata.adapterKey !== adapterKey) invalidCoreResponse();
  const schema = record(response.data);
  if (!schema || !Array.isArray(schema.fields) || !Array.isArray(schema.syntheticFixtures)) invalidCoreResponse();
  const draftSavePrecondition = readDraftSavePrecondition(schema, adapterKey, scope, response.status);
  return {
    ...metadata,
    ...(draftSavePrecondition && { draftSavePrecondition }),
    fields: schema.fields.map((value: unknown) => { const field = record(value); if (!field || !Array.isArray(field.allowedFormats) || !field.allowedFormats.every((format: unknown) => typeof format === "string")) invalidCoreResponse(); return { path: requiredText(field, "path", 300), dataType: requiredText(field, "dataType", 40), allowedFormats: field.allowedFormats as string[] }; }),
    syntheticFixtures: schema.syntheticFixtures.map((value: unknown) => {
      const fixture = record(value);
      if (!fixture) invalidCoreResponse();
      const fixtureChecksum = fixture.fixtureChecksum === undefined ? undefined : requiredText(fixture, "fixtureChecksum", 64);
      if (fixtureChecksum !== undefined && !/^[0-9a-f]{64}$/.test(fixtureChecksum)) invalidCoreResponse();
      return {
        fixtureKey: requiredText(fixture, "fixtureKey", 100),
        locale: requiredText(fixture, "locale", 35),
        ...(fixtureChecksum ? { fixtureChecksum } : {}),
      };
    }),
  };
}
