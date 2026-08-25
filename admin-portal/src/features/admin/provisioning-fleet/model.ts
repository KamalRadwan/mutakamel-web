import type { UserProfile } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { ProvisioningFleetContractError } from "./contracts";
import type {
  FleetCommandState,
  FleetManageAction,
  FleetRequestState,
  FleetRolloutStatus,
} from "./types";

export interface ProvisioningFleetPermissions {
  canRead: boolean;
  canCreatePreview: boolean;
  canCreateRollout: boolean;
  canManage: boolean;
  canReadReport: boolean;
  canAttest: boolean;
}

const STALE_CODES = new Set([
  "PROVISIONING_FLEET_PREVIEW_STALE",
  "PROVISIONING_FLEET_PREVIEW_EVIDENCE_INCOMPLETE",
  "PROVISIONING_FLEET_TENANT_FILTER_STALE",
  "PROVISIONING_FLEET_REVISION_CONFLICT",
  "PROVISIONING_FLEET_ELIGIBILITY_STALE",
  "PROVISIONING_FLEET_EVIDENCE_STALE",
]);

export function deriveProvisioningFleetPermissions(
  user: UserProfile | null | undefined,
): ProvisioningFleetPermissions {
  return {
    canRead: adminCan(user, "admin.provisioning.rollouts.read"),
    canCreatePreview: adminCan(
      user,
      "admin.provisioning.rollouts.create",
    ),
    canCreateRollout: adminCanAll(user, [
      "admin.provisioning.rollouts.create",
      "admin.provisioning.critical",
    ]),
    canManage: adminCanAll(user, [
      "admin.provisioning.rollouts.manage",
      "admin.provisioning.critical",
    ]),
    canReadReport: adminCan(user, "admin.provisioning.rollouts.report"),
    canAttest: adminCanAll(user, [
      "admin.provisioning.rollouts.report",
      "admin.provisioning.critical",
    ]),
  };
}

export function classifyFleetReadFailure(
  caught: unknown,
  error: NormalizedApiError,
): FleetRequestState {
  if (caught instanceof ProvisioningFleetContractError) return "INVALID";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 404) return "NOT_FOUND";
  if (error.httpStatus === 503 || error.httpStatus >= 500) return "UNAVAILABLE";
  return "ERROR";
}

export function classifyFleetCommandFailure(
  error: NormalizedApiError,
): FleetCommandState {
  if (
    error.httpStatus === 429 ||
    isAmbiguousWriteOutcome(error)
  ) {
    return "AMBIGUOUS";
  }
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (STALE_CODES.has(error.errorCode)) return "STALE";
  if (error.httpStatus === 400 || error.httpStatus === 422) {
    return "VALIDATION";
  }
  if (error.httpStatus === 409) return "CONFLICT";
  return "ERROR";
}

export function shouldRetainFleetIntent(error: NormalizedApiError): boolean {
  return error.httpStatus === 429 || !shouldRotateWriteCommandKey(error);
}

export function isFleetActionAllowed(
  status: FleetRolloutStatus,
  action: FleetManageAction,
): boolean {
  if (action === "pause") return status === "RUNNING";
  if (action === "resume") return status === "PAUSED";
  return status === "RUNNING" || status === "PAUSED";
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ERR_CANCELED")
  );
}
