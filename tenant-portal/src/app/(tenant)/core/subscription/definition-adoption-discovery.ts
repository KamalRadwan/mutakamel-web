import { z } from "zod";
import { commercialEnvelope, commercialInstant, commercialRevision, commercialUuid, invalidCommercialRead } from "./commercial-command-fields";

// Core purchase/definition-adoption/definition-adoption-discovery.reader.ts.
const currentDefinition = z.object({ definitionVersionId: commercialUuid,
  version: commercialRevision, revokedAt: commercialInstant.nullable() }).strict();
const selection = z.object({ addonSelectionId: commercialUuid,
  applicationKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u),
  addonKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u), currentDefinition }).strict();
const target = z.object({ targetDefinitionVersionId: commercialUuid,
  version: commercialRevision, publishedAt: commercialInstant }).strict();
const page = { expectedSubscriptionRevision: commercialRevision, nextCursor: commercialUuid.nullable() };
const selections = z.object({ ...page, items: z.array(selection).max(50) }).strict();
const targets = z.object({ ...page, addonSelectionId: commercialUuid, currentDefinition, items: z.array(target).max(50) }).strict();
export type DefinitionAdoptionSelection = z.infer<typeof selection>;
export type DefinitionAdoptionTarget = z.infer<typeof target>;
export type DefinitionAdoptionSelections = z.infer<typeof selections>;
export type DefinitionAdoptionTargets = z.infer<typeof targets>;

export function parseDefinitionAdoptionSelections(body: unknown, after: string | null): DefinitionAdoptionSelections {
  const result = z.object({ ...commercialEnvelope, data: selections }).strict().safeParse(body);
  if (!result.success) invalidCommercialRead();
  const value = result.data.data;
  checkPage(value, value.items.map((row) => row.addonSelectionId), after);
  return value;
}

export function parseDefinitionAdoptionTargets(body: unknown, addonSelectionId: string, after: string | null): DefinitionAdoptionTargets {
  commercialUuid.parse(addonSelectionId);
  const result = z.object({ ...commercialEnvelope, data: targets }).strict().safeParse(body);
  if (!result.success) invalidCommercialRead();
  const value = result.data.data;
  if (value.addonSelectionId !== addonSelectionId
    || value.items.some((row) => row.targetDefinitionVersionId === value.currentDefinition.definitionVersionId)) invalidCommercialRead();
  checkPage(value, value.items.map((row) => row.targetDefinitionVersionId), after);
  return value;
}

function checkPage(value: { nextCursor: string | null }, ids: string[], after: string | null) {
  if (after !== null) commercialUuid.parse(after);
  // The owner limits data, excluding the Core envelope; each page is a fresh observation.
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 65_536
    || ids.some((id, index) => { const previous = index === 0 ? after : ids[index - 1]; return previous !== null && id <= previous; })
    || (value.nextCursor !== null && (ids.length !== 50 || value.nextCursor !== ids.at(-1)))) invalidCommercialRead();
}
