import { array, contractFailure, integer, nullable, object, oneOf, positiveRevision, text, uuid, uuid7 } from "@/shared/api/commercial-contract";

export const INITIAL_OPTIONS_RESPONSE_MAX_BYTES = 1024 * 1024;
const key = text(64, /^[a-z][a-z0-9_]{0,63}$/u);
const name = text(128, /[\s\S]/u);
const rank = integer(-2147483648, 2147483647);
const selectionCodes = ["APPLICATION_LIFECYCLE_NOT_ACTIVE", "APPLICATION_NOT_PUBLISHED", "APPLICATION_NOT_PUBLIC", "APPLICATION_NON_BILLABLE", "TECHNICAL_READINESS_BLOCKED"] as const;
const readinessCodes = ["RUNTIME_TARGET_REQUIRED", "COMPONENT_BINDING_REQUIRED", "ACTIVE_COMPONENT_REQUIRED", "PUBLISHED_RELEASE_REQUIRED", "MINIMUM_RELEASE_NOT_SATISFIED", "DATABASE_PERMISSION_MANIFEST_REQUIRED", "DATABASE_PERMISSION_MANIFEST_INVALID"] as const;
const addon = object({ addonId: uuid7, key: text(65, /^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u), name,
  description: nullable(text(512)), definitionVersionId: uuid7, compatibleTierIds: array(uuid),
  catalogueReasons: array(oneOf(["ADDON_DEFINITION_REVOKED", "ACTIVE_COMPATIBLE_TIER_REQUIRED"]), 2) });
const application = object({ applicationId: uuid, key, name, description: nullable(text(512)), rank,
  commercialMode: oneOf(["INCLUDED", "SUBSCRIPTION"]), technicalDefinitionRevision: positiveRevision,
  selectionBlockers: array(oneOf(selectionCodes), selectionCodes.length), readinessReasons: array(oneOf(readinessCodes), readinessCodes.length),
  catalogueReasons: array(oneOf(["ACTIVE_TIER_REQUIRED"]), 1),
  tiers: array(object({ id: uuid, key, name, rank })), addons: array(addon) });
const options = object({ quoteRequired: oneOf([true]), applications: array(application) });
export type InitialCreateOptions = ReturnType<typeof options>;
export type InitialApplicationOption = InitialCreateOptions["applications"][number];
export type InitialAddonOption = InitialApplicationOption["addons"][number];
function unique(values: string[]) { if (new Set(values).size !== values.length) contractFailure(); }
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
function ordered<T>(values: T[], order: (left: T, right: T) => number) {
  if (values.some((value, index) => index > 0 && order(values[index - 1], value) > 0)) contractFailure();
}

/** Display diagnostics are not price, dependency, installation or use authority. */
export function readInitialCreateOptions(value: unknown): InitialCreateOptions {
  const result = options(value);
  if (new TextEncoder().encode(JSON.stringify(result)).length > INITIAL_OPTIONS_RESPONSE_MAX_BYTES - 1024) contractFailure();
  unique(result.applications.map(item => item.applicationId)); unique(result.applications.map(item => item.key));
  unique(result.applications.flatMap(item => item.tiers.map(tier => tier.id)));
  const children = result.applications.flatMap(item => item.addons);
  if (children.length > 100) contractFailure();
  unique(children.map(item => item.addonId)); unique(children.map(item => item.key));
  ordered(result.applications, (a, b) => a.rank - b.rank || compare(a.key, b.key) || compare(a.applicationId, b.applicationId));
  for (const item of result.applications) {
    unique(item.selectionBlockers); unique(item.readinessReasons); unique(item.tiers.map(tier => tier.key));
    if (JSON.stringify(item.catalogueReasons) !== JSON.stringify(item.tiers.length ? [] : ["ACTIVE_TIER_REQUIRED"])) contractFailure();
    ordered(item.tiers, (a, b) => a.rank - b.rank || compare(a.key, b.key) || compare(a.id, b.id));
    ordered(item.addons, (a, b) => compare(a.key, b.key) || compare(a.addonId, b.addonId));
    for (const child of item.addons) {
      if (child.key.split(".")[0] !== item.key) contractFailure();
      unique(child.compatibleTierIds); unique(child.catalogueReasons);
      const subset = item.tiers.filter(tier => child.compatibleTierIds.includes(tier.id)).map(tier => tier.id);
      if (JSON.stringify(subset) !== JSON.stringify(child.compatibleTierIds)) contractFailure();
      const expected = [...(child.catalogueReasons.includes("ADDON_DEFINITION_REVOKED") ? ["ADDON_DEFINITION_REVOKED"] : []),
        ...(subset.length ? [] : ["ACTIVE_COMPATIBLE_TIER_REQUIRED"])];
      if (JSON.stringify(expected) !== JSON.stringify(child.catalogueReasons)) contractFailure();
    }
  }
  return result;
}
