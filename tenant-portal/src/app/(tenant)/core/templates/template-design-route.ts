import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { ACCESS_POLICY_BLOCKED_CODE, type TemplateDetail, type TemplateScope } from "./templates-contract";

export function supportsTemplateDesign(template: TemplateDetail): boolean {
  return template.outputChannel === "PRINT"
    ? ["HYBRID_DOCUMENT", "FLOW_DOCUMENT", "FIXED_CANVAS"].includes(template.layoutMode)
    : template.outputChannel === "EMAIL" && template.layoutMode === "EMAIL_FLOW";
}

export function templateDesignTarget(scope: TemplateScope) {
  if (scope.branchId !== undefined) return null;
  if (scope.type === "TENANT" && scope.companyId === undefined) return { companyId: null };
  if (scope.type === "COMPANY" && isUUIDv7(scope.companyId)) return { companyId: scope.companyId };
  return null;
}

export function templateDesignFailure(cause: unknown) {
  const error = normalizeApiError(cause);
  if (error.code === ACCESS_POLICY_BLOCKED_CODE) return "unavailable";
  if (error.status === 401 || error.status === 403) return "denied";
  if (error.status === 404) return "missing";
  return "failed";
}
