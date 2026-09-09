import { z } from "zod";
import { commercialUuid, commercialUuid7, invalidCommercialRead } from "./commercial-command-fields";
import { parseCommercialPreparationRequest, type CommercialChange, type CommercialPreparationRequest } from "./commercial-command-request";

export const DEFINITION_ADOPTION_PERMISSION = "applications.addon_definitions.adopt";
type AdoptionChange = Extract<CommercialChange, { operation: "ADOPT_DEFINITION" }>;
export type DefinitionAdoptionRequest = Omit<CommercialPreparationRequest, "changes"> & { changes: AdoptionChange[] };
const source = z.object({ selectionKey: commercialUuid7, addonSelectionId: commercialUuid, fromDefinitionVersionId: commercialUuid }).strict();
export const definitionAdoptionSourcesSchema = z.array(source).min(1).max(100);
export type DefinitionAdoptionSource = z.infer<typeof source>;

export function parseDefinitionAdoptionRequest(value: unknown): DefinitionAdoptionRequest {
  const request = parseCommercialPreparationRequest(value);
  const changes = request.changes.filter((row): row is AdoptionChange => row.sourceKind === "ADDON" && row.operation === "ADOPT_DEFINITION");
  if (changes.length !== request.changes.length
    || new Set(changes.map((row) => row.addonSelectionId)).size !== changes.length) invalidCommercialRead();
  for (const row of changes) { commercialUuid.parse(row.addonSelectionId); commercialUuid.parse(row.targetDefinitionVersionId); }
  return { ...request, changes };
}

/** Current definitions come from discovery captured with the original revision,
 * never from the preview being checked or a refreshed replacement command. */
export function parseDefinitionAdoptionSources(request: DefinitionAdoptionRequest, value: unknown): DefinitionAdoptionSource[] {
  const sources = definitionAdoptionSourcesSchema.parse(value);
  if (sources.length !== request.changes.length || sources.some((row, index) => {
    const change = request.changes[index];
    return row.selectionKey !== change.selectionKey || row.addonSelectionId !== change.addonSelectionId
      || row.fromDefinitionVersionId === change.targetDefinitionVersionId;
  })) invalidCommercialRead();
  return sources;
}
