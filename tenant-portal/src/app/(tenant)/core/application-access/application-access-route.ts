import { applicationAccessSchemas, validateApplicationAccessRequest, type ApplicationAccessRequest } from "./application-access-contract";

export function applicationAccessScopeRoute(target: readonly string[]): { scope: "COMPANY" | "BRANCH"; scopeId: string } | null {
  if (target.length !== 2 || !["companies", "branches"].includes(target[0])) return null;
  const id = applicationAccessSchemas.uuid.safeParse(target[1]);
  return id.success ? { scope: target[0] === "companies" ? "COMPANY" : "BRANCH", scopeId: id.data } : null;
}

/** UI deep links mirror the five verified read targets; this does not grant access. */
export function applicationAccessRoute(target: readonly string[]): ApplicationAccessRequest | null {
  const [scope, scopeId, activation, applicationKey, addons, addonKey, configuration] = target;
  if (activation !== "application-activations" || ![4, 6, 7].includes(target.length)
    || (target.length >= 6 && addons !== "addons") || (target.length === 7 && configuration !== "configuration")) return null;
  let input: unknown;
  if (scope === "companies") input = {
    kind: target.length === 4 ? "APPLICATION_ACTIVATION" : target.length === 6 ? "ADDON_ACTIVATION" : "COMPANY_CONFIGURATION",
    companyId: scopeId, applicationKey, ...(target.length > 4 ? { addonKey } : {}),
  };
  else if (scope === "branches" && target.length > 4) input = {
    kind: target.length === 6 ? "BRANCH_OVERRIDE" : "BRANCH_CONFIGURATION", branchId: scopeId, applicationKey, addonKey,
  };
  else return null;
  try { return validateApplicationAccessRequest(input); } catch { return null; }
}
