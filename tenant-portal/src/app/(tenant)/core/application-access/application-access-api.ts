import { readCoreResponse, type CorePath } from "@/lib/api/envelope";
import {
  parseApplicationAccessResponse,
  validateApplicationAccessRequest,
  type ApplicationAccessRequest,
} from "./application-access-contract";

export async function readApplicationAccess(input: ApplicationAccessRequest, signal?: AbortSignal) {
  const request = validateApplicationAccessRequest(input);
  const path = readPath(request);
  const response = await readCoreResponse(path, {
    signal, cache: "no-store",
    // Bound transport before parsing; safe configuration values have their own 64 KiB/depth limit.
    maxResponseBytes: 1_048_576,
  });
  return parseApplicationAccessResponse(response.data, request);
}

// Keep full canonical templates visible to the route-contract verification gate.
function readPath(request: ApplicationAccessRequest): CorePath {
  switch (request.kind) {
    case "APPLICATION_ACTIVATION":
      return `/api/tenant/core/v1/companies/${request.companyId}/application-activations/${request.applicationKey}`;
    case "ADDON_ACTIVATION":
      return `/api/tenant/core/v1/companies/${request.companyId}/application-activations/${request.applicationKey}/addons/${request.addonKey}`;
    case "BRANCH_OVERRIDE":
      return `/api/tenant/core/v1/branches/${request.branchId}/application-activations/${request.applicationKey}/addons/${request.addonKey}`;
    case "COMPANY_CONFIGURATION":
      return `/api/tenant/core/v1/companies/${request.companyId}/application-activations/${request.applicationKey}/addons/${request.addonKey}/configuration`;
    case "BRANCH_CONFIGURATION":
      return `/api/tenant/core/v1/branches/${request.branchId}/application-activations/${request.applicationKey}/addons/${request.addonKey}/configuration`;
  }
}
