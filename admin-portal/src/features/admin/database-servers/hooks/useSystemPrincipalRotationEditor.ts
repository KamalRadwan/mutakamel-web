import { useState } from "react";
import type {
  DatabaseServerProvisioningPrincipalBindingView,
  UpdateDatabaseServerSystemPrincipalRotationDto,
} from "../types";

export function useSystemPrincipalRotationEditor(
  binding: DatabaseServerProvisioningPrincipalBindingView,
  onSave: (dto: UpdateDatabaseServerSystemPrincipalRotationDto) => Promise<unknown>,
  messages?: {
    invalidInterval: string;
    invalidReason: string;
    updateFailed: string;
  },
) {
  const [prevBinding, setPrevBinding] = useState(binding);
  const [enabled, setEnabled] = useState(binding.rotationEnabled);
  const [intervalHours, setIntervalHours] = useState(binding.rotationIntervalHours);
  const [windowStart, setWindowStart] = useState(binding.maintenanceWindowStartUtc);
  const [windowHours, setWindowHours] = useState(binding.maintenanceWindowHours);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (binding !== prevBinding) {
    setPrevBinding(binding);
    setEnabled(binding.rotationEnabled);
    setIntervalHours(binding.rotationIntervalHours);
    setWindowStart(binding.maintenanceWindowStartUtc);
    setWindowHours(binding.maintenanceWindowHours);
  }

  const submit = async () => {
    if (intervalHours < 24 || intervalHours > 8760) {
      setError(messages?.invalidInterval ?? "Rotation interval must be between 24 and 8760 hours.");
      return;
    }
    if (reason.trim().length < 8) {
      setError(messages?.invalidReason ?? "Enter a reason of at least 8 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({
        expectedCredentialRevision: binding.credentialRevision,
        rotationEnabled: enabled,
        rotationIntervalHours: intervalHours,
        maintenanceWindowStartUtc: windowStart,
        maintenanceWindowHours: windowHours,
        reason: reason.trim(),
      });
      setReason("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : (messages?.updateFailed ?? "Policy update failed."));
    } finally {
      setPending(false);
    }
  };

  return {
    enabled,
    intervalHours,
    windowStart,
    windowHours,
    reason,
    error,
    pending,
    setEnabled,
    setIntervalHours,
    setWindowStart,
    setWindowHours,
    setReason,
    submit,
  };
}
