import { array, boolean, contractFailure, date, decimal, integer, nullable, object, oneOf, optional, page, positiveRevision,
  record, redactedRecord, revision, text, uuid, uuid7, type Reader } from "@/shared/api/commercial-contract";

export const applicationKey = text(32, /^[a-z][a-z0-9_]{0,31}$/u);
export const addonKey = text(65, /^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u);
const hash = text(64, /^[0-9a-f]{64}$/u);
const name = text(128, /\S/u);
const reason = text(256, /\S/u);
export const billingCycle = oneOf(["MONTHLY", "ANNUAL"]);
export const lifecycle = oneOf(["DRAFT", "ACTIVE", "DEPRECATED", "DISABLED"]);
const mode = oneOf(["ALL_ACTIVE", "ALLOWLIST"]);
export const schemaRef = object({ ownerApplicationId: uuid, key: text(129, /^[a-z][a-z0-9_.]{0,128}$/u), version: integer(1, 2147483647), checksum: hash });
const grantShape = object({ featureId: uuid, configSchemaRef: optional(schemaRef), config: optional(redactedRecord) });
export const grant: Reader<ReturnType<typeof grantShape>> = value => {
  const result = grantShape(value);
  if ((result.configSchemaRef === undefined) !== (result.config === undefined)) contractFailure();
  return result;
};
export const bindingInput = object({ componentId: uuid, releaseId: uuid, capabilityKey: text(129, /^[a-z][a-z0-9_.-]{0,128}$/u) });
const binding = object({ componentId: uuid, releaseId: uuid, capabilityKey: text(129, /^[a-z][a-z0-9_.-]{0,128}$/u), executionBindingVersionId: uuid7, bindingRevision: positiveRevision });
export const dependency = object({ applicationId: uuid, addonId: optional(uuid7), minimumDefinitionVersionId: optional(uuid7) });
const rootFields = { id: uuid7, applicationId: uuid, applicationKey, key: addonKey, name, description: nullable(text(512)), lifecycleStatus: lifecycle,
  catalogueRevision: positiveRevision, operationalRevision: positiveRevision, draftVersionId: nullable(uuid7), publishedVersionId: nullable(uuid7), deleted: boolean };
export const readAddonRoot = object(rootFields);
const definitionFields = { id: uuid7, addonId: uuid7, applicationId: uuid, version: positiveRevision, definitionRevision: positiveRevision, name,
  description: nullable(text(512)), mode, schemaRef: nullable(schemaRef), definitionHash: nullable(hash), publishedAt: nullable(date), revokedAt: nullable(date),
  tierIds: array(uuid), grants: array(grant), bindings: array(binding), dependencies: array(dependency) };
const definition = object(definitionFields);
export const readDefinition: Reader<ReturnType<typeof definition>> = value => {
  const result = definition(value);
  if ((result.mode === "ALL_ACTIVE" && result.tierIds.length !== 0) || (result.mode === "ALLOWLIST" && result.tierIds.length === 0)
    || (result.schemaRef && result.schemaRef.ownerApplicationId !== result.applicationId)
    || result.grants.some(item => item.configSchemaRef && item.configSchemaRef.ownerApplicationId !== result.applicationId)
    || (result.publishedAt !== null && result.definitionHash === null) || (result.revokedAt !== null && result.publishedAt === null)) contractFailure();
  for (const ids of [result.tierIds, result.grants.map(item => item.featureId), result.bindings.map(item => `${item.componentId}:${item.capabilityKey}`),
    result.dependencies.map(item => `${item.applicationId}:${item.addonId ?? ""}`)]) if (new Set(ids).size !== ids.length) contractFailure();
  return result;
};
const detail = object({ ...rootFields, ownerRegistrationAvailable: boolean, draft: nullable(readDefinition), published: nullable(readDefinition) });
export const readAddonDetail: Reader<ReturnType<typeof detail>> = value => {
  const result = detail(value);
  for (const [id, definition, published] of [[result.draftVersionId, result.draft, false], [result.publishedVersionId, result.published, true]] as const) {
    if ((id === null) !== (definition === null) || (definition && (definition.id !== id || definition.addonId !== result.id
      || definition.applicationId !== result.applicationId || Boolean(definition.publishedAt) !== published))) contractFailure();
  }
  return result;
};
export const readVersion = readDefinition;
export const readVersionSummary = object({ id: uuid7, version: positiveRevision, definitionRevision: positiveRevision, name,
  description: nullable(text(512)), definitionHash: hash, publishedAt: date, revokedAt: nullable(date) });
export const operations = ["CREATE", "DRAFT_CREATE", "UPDATE", "PUBLISH", "DEPRECATE", "DISABLE", "DELETE", "VERSION_REVOKE",
  "COMPATIBILITY_REPLACE", "FEATURE_GRANTS_REPLACE", "COMPONENT_BINDINGS_REPLACE", "CONFIGURATION_SCHEMA_REPLACE"] as const;
export const readAddonReceipt = object({ commandId: uuid7, operation: oneOf(operations), applicationId: uuid, applicationKey,
  addonId: uuid7, addonKey, catalogueRevision: positiveRevision, operationalRevision: positiveRevision, definitionVersionId: nullable(uuid7),
  definitionRevision: nullable(positiveRevision), lifecycleStatus: lifecycle, deleted: boolean, noChange: boolean, affectedOperationId: nullable(uuid7) });
export const readBracket = object({ minUsers: integer(1, 2147483647), maxUsers: nullable(integer(1, 2147483647)), unitPrice: decimal });
export type AddonBracket = ReturnType<typeof readBracket>;
export const readBrackets: Reader<AddonBracket[]> = value => {
  const brackets = array(readBracket)(value);
  if (brackets.length === 0) contractFailure();
  for (let index = 0; index < brackets.length; index++) {
    const row = brackets[index];
    if (row.minUsers !== (index === 0 ? 1 : (brackets[index - 1].maxUsers ?? 0) + 1)
      || (index === brackets.length - 1 ? row.maxUsers !== null : row.maxUsers === null || row.maxUsers < row.minUsers)) contractFailure();
  }
  return brackets;
};
const ladder = object({ billingCycle, revision, revisionId: nullable(uuid7), configured: boolean, brackets: array(readBracket) });
export const readLadder: Reader<ReturnType<typeof ladder>> = value => {
  const result = ladder(value);
  if (result.configured) { positiveRevision(result.revision); uuid7(result.revisionId); readBrackets(result.brackets); }
  else if (result.revision !== "0" || result.revisionId !== null || result.brackets.length !== 0) contractFailure();
  return result;
};
const prices = object({ applicationId: uuid, applicationKey, addonId: uuid7, addonKey, ladders: array(readLadder, 2) });
export const readPrices: Reader<ReturnType<typeof prices>> = value => {
  const result = prices(value);
  if (result.ladders.length === 0 || new Set(result.ladders.map(item => item.billingCycle)).size !== result.ladders.length) contractFailure();
  return result;
};
export const readPriceReceipt = object({ ladderId: uuid7, addonId: uuid7, billingCycle, revision: positiveRevision,
  revisionId: uuid7, noChange: boolean, brackets: readBrackets });
const diff = object({ field: text(1024), before: optional((value: unknown) => value), after: optional((value: unknown) => value) });
export const readAudit = object({ id: uuid7, schemaVersion: oneOf([1]), entityType: oneOf(["ADDON", "ADDON_DEFINITION", "ADDON_PRICE_LADDER"]), action: text(64),
  entityId: nullable(uuid7), moduleId: uuid, tierId: nullable(uuid), actorAdminId: nullable(uuid), actorLabel: nullable(text(256)), operationId: uuid7,
  idempotencyKey: nullable(uuid7), sourceType: text(32), sourceId: nullable(text(128)), before: nullable(redactedRecord), after: nullable(redactedRecord),
  diff: array(diff, 10000), correlationId: nullable(uuid7), metadata: nullable(redactedRecord), occurredAt: date });
export const readAddonPage = page(readAddonRoot);
export const readVersionPage = page(readVersionSummary);
export const readAuditPage = page(readAudit);
export const revisionFields = { expectedCatalogueRevision: positiveRevision };
export const draftFields = { ...revisionFields, draftVersionId: uuid7, expectedDefinitionRevision: positiveRevision };
export const createBody = object({ key: addonKey, name, description: optional(text(512)) });
export const updateBody = object({ ...draftFields, name, description: nullable(text(512)) });
export const draftBody = object({ ...revisionFields, sourceDefinitionVersionId: uuid7, reason });
export const lifecycleBody = object({ ...revisionFields, reason });
export const publishBody = object({ ...draftFields, reason });
export const compatibilityBody = object({ ...draftFields, reason, mode, tierIds: array(uuid) });
export const grantsBody = object({ ...draftFields, reason, grants: array(grant) });
export const bindingsBody = object({ ...draftFields, reason, bindings: array(bindingInput), dependencies: array(dependency) });
export const schemaBody = object({ ...draftFields, reason, schemaRef });
export const priceBody = object({ billingCycle, expectedLadderRevision: revision, brackets: readBrackets, reason });
export const deleteQuery = object({ expectedCatalogueRevision: positiveRevision, reason });
export type AddonRoot = ReturnType<typeof readAddonRoot>;
export type AddonDetail = ReturnType<typeof readAddonDetail>;
export type AddonDefinition = ReturnType<typeof readDefinition>;
export type AddonPrices = ReturnType<typeof readPrices>;
export type AddonReceipt = ReturnType<typeof readAddonReceipt>;
export type AddonVersion = ReturnType<typeof readVersionSummary>;
export type AddonAudit = ReturnType<typeof readAudit>;
export type AddonCommand =
  | { kind: "CREATE"; body: ReturnType<typeof createBody> }
  | { kind: "UPDATE"; body: ReturnType<typeof updateBody> }
  | { kind: "DRAFT_CREATE"; body: ReturnType<typeof draftBody> }
  | { kind: "PUBLISH"; body: ReturnType<typeof publishBody> }
  | { kind: "DEPRECATE" | "DISABLE"; body: ReturnType<typeof lifecycleBody> }
  | { kind: "VERSION_REVOKE"; versionId: string; body: ReturnType<typeof lifecycleBody> }
  | { kind: "DELETE"; body: ReturnType<typeof deleteQuery> }
  | { kind: "COMPATIBILITY_REPLACE"; body: ReturnType<typeof compatibilityBody> }
  | { kind: "FEATURE_GRANTS_REPLACE"; body: ReturnType<typeof grantsBody> }
  | { kind: "COMPONENT_BINDINGS_REPLACE"; body: ReturnType<typeof bindingsBody> }
  | { kind: "CONFIGURATION_SCHEMA_REPLACE"; body: ReturnType<typeof schemaBody> };

export function assertOwner(value: unknown, owner: { applicationKey: string; applicationId?: string; addonKey?: string; addonId?: string }) {
  const data = record(value);
  for (const key of ["applicationKey", "applicationId", "addonId"] as const) if (owner[key] !== undefined && data[key] !== owner[key]) contractFailure();
  if (owner.addonKey !== undefined && (data.addonKey ?? data.key) !== owner.addonKey) contractFailure();
  if (typeof (data.addonKey ?? data.key) === "string" && !(String(data.addonKey ?? data.key).startsWith(`${owner.applicationKey}.`))) contractFailure();
}
