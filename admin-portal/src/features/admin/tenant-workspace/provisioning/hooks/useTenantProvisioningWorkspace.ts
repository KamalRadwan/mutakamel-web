"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  buildApplyUpdatesDto,
  buildDecommissionOperationDto,
  buildRepairOperationDto,
} from "../model/commands";
import {
  provisioningActionState,
  repairExitFromHistory,
  type ProvisioningActionState,
} from "../model/operation-actions";
import type {
  CreateAddApplicationOperationDto,
  CreateRepairOperationDto,
  SeedConflictDecision,
  TenantComponentInstallation,
  TenantOperationDetail,
  TenantPrerequisiteEvidenceRecord,
  TenantSeedState,
} from "../types";
import { useTenantProvisioning } from "./useTenantProvisioning";

export type ProvisioningWorkspaceSection =
  | "operations"
  | "updates"
  | "state"
  | "prerequisites"
  | "managed";

/**
 * The command awaiting the operator's confirmation, with the exact resource
 * it was raised on so the dialog names what will change. A repair carries its
 * already-validated body: what is confirmed is exactly what is sent.
 */
export type ProvisioningConfirmation =
  | { kind: "resend-release" | "close-failed"; request: TenantPrerequisiteEvidenceRecord }
  | { kind: "cancel"; operation: TenantOperationDetail }
  | { kind: "retry"; operation: TenantOperationDetail }
  | {
      kind: "repair";
      component: TenantComponentInstallation;
      dto: CreateRepairOperationDto;
    };

export interface ProvisioningOperationActions {
  cancel: ProvisioningActionState;
  retry: ProvisioningActionState;
  resync: ProvisioningActionState;
}

const NO_ACTION: ProvisioningActionState = {
  visible: false,
  enabled: false,
  reasonCode: null,
};

export interface ManagedTargetDraft {
  key: string;
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
}

export function useTenantProvisioningWorkspace(tenantId: string) {
  const { lang, dir, t } = useI18n();
  const toast = useToast();
  const [confirmation, setConfirmation] =
    useState<ProvisioningConfirmation | null>(null);
  // An open confirmation holds background refresh so the state the operator
  // is deciding on does not shift underneath the dialog.
  const provisioning = useTenantProvisioning(tenantId, {
    paused: confirmation !== null,
  });
  const latestOperation = provisioning.operations.data.items.reduce(
    (latest, candidate) => !latest || candidate.generation > latest.generation ? candidate : latest,
    null as (typeof provisioning.operations.data.items)[number] | null,
  );
  const hasOpenOperation = !!latestOperation && ["REQUESTED", "PLANNING", "QUEUED", "RUNNING", "WAITING_RETRY", "CANCEL_REQUESTED"].includes(latestOperation.status);
  const selectedDetail = provisioning.selectedOperation.data;
  const commandInFlight = provisioning.mutation.name !== null;

  /** Cancel, re-provision and resync for the selected operation, from Core's exits. */
  const operationActions = useMemo<ProvisioningOperationActions>(() => {
    if (!selectedDetail) {
      return { cancel: NO_ACTION, retry: NO_ACTION, resync: NO_ACTION };
    }
    const permitted = provisioning.permissions.canRetryOrCancel;
    return {
      cancel: provisioningActionState("cancel", selectedDetail.exits.cancel, permitted, commandInFlight),
      retry: provisioningActionState("retry", selectedDetail.exits.retry, permitted, commandInFlight),
      resync: provisioningActionState(
        "resync",
        selectedDetail.exits.resync,
        provisioning.permissions.canResync,
        commandInFlight,
      ),
    };
  }, [
    commandInFlight,
    provisioning.permissions.canResync,
    provisioning.permissions.canRetryOrCancel,
    selectedDetail,
  ]);

  /**
   * Repair needs no open operation. Core's exit on the selected detail is
   * authoritative when it holds repair closed; the history can only close it
   * further, for when no detail is loaded or a newer operation has appeared.
   */
  const repairAction = useMemo<ProvisioningActionState>(() => {
    const exit =
      selectedDetail && !selectedDetail.exits.repair.allowed
        ? selectedDetail.exits.repair
        : repairExitFromHistory(latestOperation);
    return provisioningActionState("repair", exit, provisioning.permissions.canRepair, commandInFlight);
  }, [commandInFlight, latestOperation, provisioning.permissions.canRepair, selectedDetail]);
  const [section, setSection] =
    useState<ProvisioningWorkspaceSection>("operations");
  const [selectedUpdateKeys, setSelectedUpdateKeys] = useState<string[]>([]);
  const [prerequisiteReasonCode, setPrerequisiteReasonCode] = useState(
    "ADMIN.PREREQUISITE_REQUEST",
  );
  const [repairComponentId, setRepairComponentId] = useState("");
  const [repairReasonCode, setRepairReasonCode] = useState("ADMIN.REPAIR");
  const [decommissionComponentId, setDecommissionComponentId] = useState("");
  const [decommissionReasonCode, setDecommissionReasonCode] = useState(
    "ADMIN.DECOMMISSION",
  );
  const [retentionAcknowledged, setRetentionAcknowledged] = useState(false);
  const [applicationKey, setApplicationKey] = useState("");
  const [accessPolicyRevision, setAccessPolicyRevision] = useState("");
  const [addApplicationReasonCode, setAddApplicationReasonCode] = useState(
    "ADMIN.ADD_APPLICATION",
  );
  const [managedTargets, setManagedTargets] = useState<ManagedTargetDraft[]>([
    emptyTarget(1),
  ]);
  const [conflictDecision, setConflictDecision] =
    useState<SeedConflictDecision>("KEEP_TENANT_VALUE");
  const [conflictReasonCode, setConflictReasonCode] = useState(
    "ADMIN.SEED_CONFLICT",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  /**
   * The components the operator selected, per UPDATE operation this page
   * applied. Core may move more than that; the operation detail shows which
   * components it added (see `model/update-scope.ts`).
   */
  const [requestedUpdateKeys, setRequestedUpdateKeys] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});

  const availableUpdateKeys = useMemo(
    () => new Set(provisioning.updates.data.items.map((row) => row.componentKey)),
    [provisioning.updates.data.items],
  );

  const effectiveSelectedUpdateKeys = useMemo(
    () => selectedUpdateKeys.filter((key) => availableUpdateKeys.has(key)),
    [availableUpdateKeys, selectedUpdateKeys],
  );
  const effectiveRepairComponentId =
    repairComponentId || provisioning.components.data.items[0]?.id || "";
  const effectiveDecommissionComponentId =
    decommissionComponentId || provisioning.components.data.items[0]?.id || "";

  const toggleUpdate = useCallback((componentKey: string) => {
    setSelectedUpdateKeys((current) =>
      current.includes(componentKey)
        ? current.filter((key) => key !== componentKey)
        : [...current, componentKey],
    );
  }, []);

  const applySelectedUpdates = useCallback(async () => {
    setLocalError(null);
    try {
      const selected = provisioning.updates.data.items.filter((update) =>
        effectiveSelectedUpdateKeys.includes(update.componentKey),
      );
      const dto = buildApplyUpdatesDto(selected);
      const result = await provisioning.applyUpdates(dto);
      setRequestedUpdateKeys((current) => ({
        ...current,
        [result.operation.id]: dto.selections.map(
          (selection) => selection.componentKey,
        ),
      }));
      setSelectedUpdateKeys([]);
      setSection("operations");
    } catch (error) {
      setLocalError(readLocalError(error));
    }
  }, [effectiveSelectedUpdateKeys, provisioning]);

  const requestSelectedPrerequisites = useCallback(async () => {
    setLocalError(null);
    const operation = provisioning.selectedOperation.data;
    if (!operation) {
      setLocalError("TENANT_PROVISIONING_OPERATION_REQUIRED");
      return;
    }
    if (operation.prerequisiteCount === 0) {
      setLocalError("TENANT_PROVISIONING_PREREQUISITE_NOT_REQUIRED");
      return;
    }
    try {
      await provisioning.requestPrerequisites({
        operationId: operation.id,
        expectedPlanDigest: operation.planDigest,
        reasonCode: prerequisiteReasonCode,
      });
    } catch (error) {
      setLocalError(readLocalError(error));
    }
  }, [prerequisiteReasonCode, provisioning]);

  /**
   * Cancel, re-provision and repair are significant, recoverable commands:
   * each first opens a confirmation naming the resource and its consequence.
   * Nothing is sent until `confirmPending`.
   */
  const requestCancel = useCallback((operation: TenantOperationDetail) => {
    setLocalError(null);
    setConfirmation({ kind: "cancel", operation });
  }, []);

  const requestRetry = useCallback((operation: TenantOperationDetail) => {
    setLocalError(null);
    setConfirmation({ kind: "retry", operation });
  }, []);

  const requestRecovery = useCallback((kind: "resend-release" | "close-failed", request: TenantPrerequisiteEvidenceRecord) => {
    setLocalError(null);
    setConfirmation({ kind, request });
  }, []);

  const requestRepair = useCallback(() => {
    setLocalError(null);
    const component = provisioning.components.data.items.find(
      (row) => row.id === effectiveRepairComponentId,
    );
    if (!component) {
      setLocalError("TENANT_REPAIR_COMPONENT_REQUIRED");
      return;
    }
    // Invalid evidence or reason code is reported before asking to confirm.
    let dto: CreateRepairOperationDto;
    try {
      dto = buildRepairOperationDto(component, repairReasonCode);
    } catch (error) {
      setLocalError(readLocalError(error));
      return;
    }
    setConfirmation({ kind: "repair", component, dto });
  }, [effectiveRepairComponentId, provisioning.components.data.items, repairReasonCode]);

  /**
   * Resync changes nothing by itself -- the Worker re-delivers what it already
   * signed, and Core applies each record as the first delivery would have --
   * so, like a prerequisite request, it is sent without a confirmation. An
   * accepted request is a toast; a refusal lands in the workspace alert.
   */
  const requestResync = useCallback(
    async (operation: TenantOperationDetail) => {
      setLocalError(null);
      try {
        await provisioning.resyncOperation(operation.id);
        toast.success(
          t.tenantProvisioning.resyncRequestedTitle,
          t.tenantProvisioning.resyncRequestedMessage,
        );
      } catch (error) {
        setLocalError(readLocalError(error));
      }
    },
    [provisioning, t, toast],
  );

  /** Closing is refused while the confirmed command is still in flight. */
  const dismissConfirmation = useCallback(() => {
    if (provisioning.mutation.name !== null) return;
    setConfirmation(null);
  }, [provisioning.mutation.name]);

  /**
   * Sends the confirmed command once. The dialog closes either way; a
   * rejection is shown in the workspace alert, which takes focus, and an
   * uncertain outcome keeps its idempotency key for the exact retry.
   */
  const confirmPending = useCallback(async () => {
    const pending = confirmation;
    if (!pending || provisioning.mutation.name !== null) return;
    setLocalError(null);
    try {
      if (pending.kind === "cancel") {
        await provisioning.cancelOperation(pending.operation.id);
      } else if (pending.kind === "retry") {
        await provisioning.retryOperation(pending.operation.id);
      } else if (pending.kind === "repair") {
        await provisioning.repair(pending.dto);
        setSection("operations");
      } else {
        await provisioning.recoverPrerequisite(pending.kind, {
          operationId: pending.request.operationId,
          expectedPlanDigest: pending.request.planDigest,
          reasonCode: pending.kind === "resend-release" ? "CORE.PROVISIONING.RELEASE_RECOVERY_ADMIN" : "CORE.PROVISIONING.CLOSE_FAILED_ADMIN",
        });
        toast.success(t.tenantProvisioning.recoveryAcceptedTitle,
          pending.kind === "resend-release" ? t.tenantProvisioning.releaseResentMessage : t.tenantProvisioning.failedClosedMessage);
      }
    } catch (error) {
      setLocalError(readLocalError(error));
    } finally {
      setConfirmation(null);
    }
  }, [confirmation, provisioning, t, toast]);

  const submitDecommission = useCallback(async () => {
    setLocalError(null);
    const component = provisioning.components.data.items.find(
      (row) => row.id === effectiveDecommissionComponentId,
    );
    if (!component) {
      setLocalError("TENANT_DECOMMISSION_COMPONENT_REQUIRED");
      return;
    }
    try {
      await provisioning.decommission(
        buildDecommissionOperationDto(
          component,
          decommissionReasonCode,
          retentionAcknowledged,
        ),
      );
      setRetentionAcknowledged(false);
      setSection("operations");
    } catch (error) {
      setLocalError(readLocalError(error));
    }
  }, [
    decommissionReasonCode,
    effectiveDecommissionComponentId,
    provisioning,
    retentionAcknowledged,
  ]);

  const submitAddApplication = useCallback(async () => {
    setLocalError(null);
    const dto: CreateAddApplicationOperationDto = {
      applicationKey: applicationKey.trim(),
      expectedAccessPolicyRevision: Number(accessPolicyRevision),
      targetSelection: managedTargets.map((target) => ({
        componentKey: target.componentKey.trim(),
        componentId: target.componentId.trim(),
        targetReleaseId: target.targetReleaseId.trim(),
        targetReleaseVersion: target.targetReleaseVersion.trim(),
        targetManifestChecksum: target.targetManifestChecksum.trim(),
      })),
      reasonCode: addApplicationReasonCode,
    };
    try {
      await provisioning.addApplication(dto);
      setSection("operations");
    } catch (error) {
      setLocalError(readLocalError(error));
    }
  }, [
    accessPolicyRevision,
    addApplicationReasonCode,
    applicationKey,
    managedTargets,
    provisioning,
  ]);

  const resolveConflict = useCallback(
    async (seed: TenantSeedState) => {
      setLocalError(null);
      try {
        await provisioning.resolveSeedConflict(
          seed,
          conflictDecision,
          conflictReasonCode,
        );
      } catch (error) {
        setLocalError(readLocalError(error));
      }
    },
    [conflictDecision, conflictReasonCode, provisioning],
  );

  const updateManagedTarget = useCallback(
    (key: string, field: keyof Omit<ManagedTargetDraft, "key">, value: string) => {
      setManagedTargets((current) =>
        current.map((target) =>
          target.key === key ? { ...target, [field]: value } : target,
        ),
      );
    },
    [],
  );

  const addManagedTarget = useCallback(() => {
    setManagedTargets((current) => [
      ...current,
      emptyTarget(
        current.reduce(
          (maximum, target) =>
            Math.max(maximum, Number(target.key.replace("target-", "")) || 0),
          0,
        ) + 1,
      ),
    ]);
  }, []);

  const removeManagedTarget = useCallback((key: string) => {
    setManagedTargets((current) =>
      current.length === 1
        ? current
        : current.filter((target) => target.key !== key),
    );
  }, []);

  return {
    lang,
    dir,
    provisioning,
    latestOperation,
    hasOpenOperation,
    operationActions,
    repairAction,
    confirmation,
    requestCancel,
    requestRetry,
    requestRecovery,
    requestResync,
    requestRepair,
    dismissConfirmation,
    confirmPending,
    section,
    setSection,
    selectedUpdateKeys: effectiveSelectedUpdateKeys,
    requestedUpdateKeys,
    toggleUpdate,
    prerequisiteReasonCode,
    setPrerequisiteReasonCode,
    repairComponentId: effectiveRepairComponentId,
    setRepairComponentId,
    repairReasonCode,
    setRepairReasonCode,
    decommissionComponentId: effectiveDecommissionComponentId,
    setDecommissionComponentId,
    decommissionReasonCode,
    setDecommissionReasonCode,
    retentionAcknowledged,
    setRetentionAcknowledged,
    applicationKey,
    setApplicationKey,
    accessPolicyRevision,
    setAccessPolicyRevision,
    addApplicationReasonCode,
    setAddApplicationReasonCode,
    managedTargets,
    updateManagedTarget,
    addManagedTarget,
    removeManagedTarget,
    conflictDecision,
    setConflictDecision,
    conflictReasonCode,
    setConflictReasonCode,
    localError,
    clearLocalError: () => setLocalError(null),
    applySelectedUpdates,
    requestSelectedPrerequisites,
    submitDecommission,
    submitAddApplication,
    resolveConflict,
  };
}

export type TenantProvisioningWorkspaceModel = ReturnType<
  typeof useTenantProvisioningWorkspace
>;

function emptyTarget(index: number): ManagedTargetDraft {
  return {
    key: `target-${index}`,
    componentKey: "",
    componentId: "",
    targetReleaseId: "",
    targetReleaseVersion: "",
    targetManifestChecksum: "",
  };
}

function readLocalError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    typeof error.errorCode === "string"
  ) {
    return error.errorCode;
  }
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}
