import { isUUIDv7 } from "@/lib/utils/uuid";
import type { CoreBaseFeaturePolicyReceipt, FeatureView } from "../types";

export const TEMPLATE_DESIGNER_FEATURE_KEY = "core.template_designer";

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2_147_483_647;
}

/** Missing or malformed policy evidence is unavailable, never excluded. */
export function readCoreBaseFeaturePolicy(value: unknown): CoreBaseFeaturePolicyReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isUUIDv7(row.id) || !isUUIDv7(row.moduleId) || row.key !== TEMPLATE_DESIGNER_FEATURE_KEY
    || typeof row.baseIncluded !== "boolean" || !isRevision(row.baseGrantRevision)) return null;
  return {
    id: row.id, moduleId: row.moduleId, key: TEMPLATE_DESIGNER_FEATURE_KEY,
    baseIncluded: row.baseIncluded, baseGrantRevision: row.baseGrantRevision,
  };
}

export function templateDesignerPolicy(feature: FeatureView | undefined, applicationId: string) {
  const policy = readCoreBaseFeaturePolicy(feature);
  return policy?.moduleId === applicationId ? policy : null;
}
