"use client";

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  buildApplyUpdatesDto,
  buildDecommissionOperationDto,
  buildRepairOperationDto,
} from "../model/commands";
import type {
  CreateAddApplicationOperationDto,
  SeedConflictDecision,
  TenantSeedState,
} from "../types";
import { useTenantProvisioning } from "./useTenantProvisioning";

export type ProvisioningWorkspaceSection =
  | "operations"
  | "updates"
  | "state"
  | "prerequisites"
  | "managed";

export interface ManagedTargetDraft {
  key: string;
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
}

export function useTenantProvisioningWorkspace(tenantId: string) {
  const { lang, dir } = useI18n();
  const provisioning = useTenantProvisioning(tenantId);
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
      await provisioning.applyUpdates(buildApplyUpdatesDto(selected));
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

  const submitRepair = useCallback(async () => {
    setLocalError(null);
    const component = provisioning.components.data.items.find(
      (row) => row.id === effectiveRepairComponentId,
    );
    if (!component) {
      setLocalError("TENANT_REPAIR_COMPONENT_REQUIRED");
      return;
    }
    try {
      await provisioning.repair(
        buildRepairOperationDto(component, repairReasonCode),
      );
      setSection("operations");
    } catch (error) {
      setLocalError(readLocalError(error));
    }
  }, [effectiveRepairComponentId, provisioning, repairReasonCode]);

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
    section,
    setSection,
    selectedUpdateKeys: effectiveSelectedUpdateKeys,
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
    submitRepair,
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
