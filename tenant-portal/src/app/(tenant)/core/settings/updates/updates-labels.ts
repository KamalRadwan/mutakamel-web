import type { Dictionary } from "@/i18n/dictionaries/ar";
import { wireLabel } from "@/lib/format/wire-label";
import type {
  ComponentReleaseRisk,
  TenantOperationStatus,
  UpdateEligibility,
} from "./provisioning-updates-contract";

export interface UpdateEligibilityPresentation {
  label: string;
  tone: "positive" | "caution" | "neutral";
  reason: string | null;
}

export type OperationSurfaceKind =
  | "active"
  | "waiting"
  | "cancelling"
  | "succeeded"
  | "failedRetryable"
  | "manualRecovery"
  | "cancelled";

export function formatRiskLabel(risk: string, t: Dictionary): string {
  const labels: Record<ComponentReleaseRisk, string> = {
    LOW: t.trade.riskClass_LOW,
    MEDIUM: t.trade.riskClass_MEDIUM,
    HIGH: t.trade.riskClass_HIGH,
  };
  return wireLabel(labels, risk.trim().toUpperCase(), t.common.unknownCode, "updates.riskLevel");
}

export function formatOwnerAppLabel(ownerApp: string, t: Dictionary): string {
  return wireLabel(
    t.audit.ledger.apps,
    ownerApp.trim().toUpperCase(),
    t.common.unknownCode,
    "updates.ownerApp",
  );
}

export function formatOperationStatusLabel(status: string, t: Dictionary): string {
  const labels: Record<TenantOperationStatus, string> = t.coreSettings.updatesUi.operationStatus;
  // Pass `operationStatusUnknown` (no `{code}` placeholder) so unknown wire values never render raw.
  return wireLabel(
    labels,
    status.trim(),
    t.coreSettings.updatesUi.operationStatusUnknown,
    "updates.operationStatus",
  );
}

export function formatOperationGuidance(status: TenantOperationStatus, t: Dictionary): string {
  const updatesUi = t.coreSettings.updatesUi;
  switch (status) {
    case "REQUESTED":
      return updatesUi.operationGuidanceRequested;
    case "PLANNING":
      return updatesUi.operationGuidancePlanning;
    case "QUEUED":
      return updatesUi.operationGuidanceQueued;
    case "RUNNING":
      return updatesUi.operationGuidanceRunning;
    case "WAITING_RETRY":
      return updatesUi.operationGuidanceWaitingRetry;
    case "CANCEL_REQUESTED":
      return updatesUi.operationGuidanceCancelRequested;
    case "SUCCEEDED":
      return updatesUi.operationGuidanceSucceeded;
    case "FAILED_RETRYABLE":
      return updatesUi.operationGuidanceFailedRetryable;
    case "MANUAL_RECOVERY_REQUIRED":
      return updatesUi.operationGuidanceManualRecovery;
    case "CANCELLED":
      return updatesUi.operationGuidanceCancelled;
  }
}

// Only Core prerequisite tokens from `tenant-provisioning-prerequisite.service.ts` are rendered;
// Worker DAG `stepKey` values and redundant status echoes are suppressed.
export function formatOperationPhaseLabel(
  currentPhase: string | null | undefined,
  t: Dictionary,
  status?: TenantOperationStatus,
): string | null {
  if (!currentPhase || status === "SUCCEEDED" || status === "CANCELLED") {
    return null;
  }
  const updatesUi = t.coreSettings.updatesUi;
  switch (currentPhase.trim()) {
    case "AWAITING_PREREQUISITES":
      return updatesUi.operationPhaseAwaitingPrerequisites;
    case "PREREQUISITE_FAILED":
      return updatesUi.operationPhasePrerequisiteFailed;
    case "PREREQUISITE_EXPIRED":
      return updatesUi.operationPhasePrerequisiteExpired;
    default:
      return null;
  }
}

export function classifyOperationSurface(status: TenantOperationStatus): OperationSurfaceKind {
  switch (status) {
    case "REQUESTED":
    case "PLANNING":
    case "QUEUED":
    case "RUNNING":
      return "active";
    case "WAITING_RETRY":
      return "waiting";
    case "CANCEL_REQUESTED":
      return "cancelling";
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED_RETRYABLE":
      return "failedRetryable";
    case "MANUAL_RECOVERY_REQUIRED":
      return "manualRecovery";
    case "CANCELLED":
      return "cancelled";
  }
}

export function formatUpdateEligibility(
  eligibility: UpdateEligibility,
  t: Dictionary,
): UpdateEligibilityPresentation {
  const updatesUi = t.coreSettings.updatesUi;
  switch (eligibility) {
    case "ELIGIBLE":
      return { label: updatesUi.statusEligible, tone: "positive", reason: null };
    case "PLANNED":
      return {
        label: updatesUi.statusPlanned,
        tone: "caution",
        reason: updatesUi.reasonPlanned,
      };
    case "ADMIN_MANAGED":
      return {
        label: updatesUi.statusAdminManaged,
        tone: "neutral",
        reason: updatesUi.reasonAdminManaged,
      };
    case "INCOMPLETE_EVIDENCE":
      return {
        label: updatesUi.statusIncompleteEvidence,
        tone: "neutral",
        reason: updatesUi.reasonIncompleteEvidence,
      };
  }
}

export function riskTone(risk: ComponentReleaseRisk): "positive" | "caution" | "negative" {
  if (risk === "LOW") return "positive";
  if (risk === "MEDIUM") return "caution";
  return "negative";
}

export function operationTone(
  status: string,
): "positive" | "caution" | "negative" | "brand" | "neutral" {
  const trimmed = status.trim();
  if (trimmed === "SUCCEEDED") return "positive";
  if (
    trimmed === "REQUESTED" ||
    trimmed === "PLANNING" ||
    trimmed === "QUEUED" ||
    trimmed === "RUNNING"
  ) {
    return "brand";
  }
  if (
    trimmed === "WAITING_RETRY" ||
    trimmed === "CANCEL_REQUESTED" ||
    trimmed === "MANUAL_RECOVERY_REQUIRED"
  ) {
    return "caution";
  }
  if (trimmed === "FAILED_RETRYABLE") return "negative";
  return "neutral";
}
