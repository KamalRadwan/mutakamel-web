"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";

const SETTINGS_PATH = "/api/tenant/crm/v1/settings";
const SETTINGS_RESPONSE_LIMIT = 256 * 1024;

export interface CrmSettings {
  id: string;
  requireQualifiedStageForConversion: boolean;
  defaultLeadStageId: string | null;
  defaultPipelineId: string;
  outboundEmailContentRetentionDays: number;
  outboundEmailRetentionPolicyRevision: number;
  asteriskIntegration: {
    enabled: boolean;
    allowInvalidTlsCertificate: boolean;
  };
}

export interface EditableCrmSettings {
  requireQualifiedStageForConversion: boolean;
  outboundEmailContentRetentionDays: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredUuidV7(
  value: Record<string, unknown>,
  key: string,
): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) {
    throw new Error("Invalid CRM settings response.");
  }
  return candidate;
}

export function parseCrmSettingsResponse(payload: unknown): CrmSettings {
  const settings = record(payload);
  const asterisk =
    settings?.asteriskIntegration === undefined
      ? {}
      : record(settings.asteriskIntegration);
  if (
    !settings ||
    !asterisk ||
    typeof settings.requireQualifiedStageForConversion !== "boolean" ||
    !(
      settings.defaultLeadStageId === null ||
      isUUIDv7(settings.defaultLeadStageId)
    ) ||
    !Number.isInteger(settings.outboundEmailContentRetentionDays) ||
    (settings.outboundEmailContentRetentionDays as number) < 30 ||
    (settings.outboundEmailContentRetentionDays as number) > 2555 ||
    !Number.isSafeInteger(settings.outboundEmailRetentionPolicyRevision) ||
    (settings.outboundEmailRetentionPolicyRevision as number) < 1 ||
    (asterisk.enabled !== undefined &&
      typeof asterisk.enabled !== "boolean") ||
    (asterisk.allowInvalidTlsCertificate !== undefined &&
      typeof asterisk.allowInvalidTlsCertificate !== "boolean")
  ) {
    throw new Error("Invalid CRM settings response.");
  }

  return {
    id: requiredUuidV7(settings, "id"),
    requireQualifiedStageForConversion:
      settings.requireQualifiedStageForConversion,
    defaultLeadStageId: settings.defaultLeadStageId as string | null,
    defaultPipelineId: requiredUuidV7(settings, "defaultPipelineId"),
    outboundEmailContentRetentionDays:
      settings.outboundEmailContentRetentionDays as number,
    outboundEmailRetentionPolicyRevision:
      settings.outboundEmailRetentionPolicyRevision as number,
    asteriskIntegration: {
      enabled: asterisk.enabled ?? false,
      allowInvalidTlsCertificate:
        asterisk.allowInvalidTlsCertificate ?? false,
    },
  };
}

function editable(settings: CrmSettings): EditableCrmSettings {
  return {
    requireQualifiedStageForConversion:
      settings.requireQualifiedStageForConversion,
    outboundEmailContentRetentionDays:
      settings.outboundEmailContentRetentionDays,
  };
}

export function buildCrmSettingsPatch(
  current: CrmSettings,
  draft: EditableCrmSettings,
): Partial<EditableCrmSettings> {
  if (
    !Number.isInteger(draft.outboundEmailContentRetentionDays) ||
    draft.outboundEmailContentRetentionDays < 30 ||
    draft.outboundEmailContentRetentionDays > 2555
  ) {
    throw new Error("Retention days must be an integer from 30 to 2555.");
  }

  return {
    ...(draft.requireQualifiedStageForConversion ===
    current.requireQualifiedStageForConversion
      ? {}
      : {
          requireQualifiedStageForConversion:
            draft.requireQualifiedStageForConversion,
        }),
    ...(draft.outboundEmailContentRetentionDays ===
    current.outboundEmailContentRetentionDays
      ? {}
      : {
          outboundEmailContentRetentionDays:
            draft.outboundEmailContentRetentionDays,
        }),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}

async function readSettings(signal?: AbortSignal): Promise<CrmSettings> {
  const response = await axiosClient.get<unknown>(SETTINGS_PATH, {
    signal,
    cache: "no-store",
    maxResponseBytes: SETTINGS_RESPONSE_LIMIT,
  });
  return parseCrmSettingsResponse(response.data);
}

export function useCrmSettings() {
  const { user } = useTenantAuth();
  const canManage =
    user?.permissions.some((permission) =>
      ["crm.settings.manage", "crm.settings.update"].includes(permission),
    ) ?? false;
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [draft, setDraft] = useState<EditableCrmSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyServerSettings = useCallback((next: CrmSettings) => {
    setSettings(next);
    setDraft(editable(next));
  }, []);

  const fetchSettings = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        applyServerSettings(await readSettings(signal));
      } catch (caught) {
        if (isAbortError(caught)) return;
        setSettings(null);
        setDraft(null);
        setError(errorMessage(caught, "Unable to load CRM settings."));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [applyServerSettings],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchSettings(controller.signal);
    });
    return () => controller.abort();
  }, [fetchSettings]);

  const isDirty = useMemo(
    () =>
      settings !== null &&
      draft !== null &&
      (settings.requireQualifiedStageForConversion !==
        draft.requireQualifiedStageForConversion ||
        settings.outboundEmailContentRetentionDays !==
          draft.outboundEmailContentRetentionDays),
    [draft, settings],
  );

  const resetDraft = () => {
    if (settings) setDraft(editable(settings));
  };

  const saveSettings = async (): Promise<boolean> => {
    if (!settings || !draft || isSaving) return false;
    if (!canManage) {
      setError("You do not have permission to update CRM settings.");
      return false;
    }
    setIsSaving(true);
    setError(null);
    try {
      const patch = buildCrmSettingsPatch(settings, draft);
      if (Object.keys(patch).length === 0) return true;
      const response = await axiosClient.put<unknown>(SETTINGS_PATH, patch, {
        nonReplayable: true,
        skipAutoIdempotency: true,
        cache: "no-store",
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT,
      });
      applyServerSettings(parseCrmSettingsResponse(response.data));
      return true;
    } catch (caught) {
      if (isAmbiguousMutationError(caught)) {
        try {
          applyServerSettings(await readSettings());
        } catch {
          // Keep the last confirmed server state when reconciliation is unavailable.
        }
      }
      setError(errorMessage(caught, "Unable to update CRM settings."));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    settings,
    draft,
    setDraft,
    isLoading,
    isSaving,
    isDirty,
    canManage,
    error,
    fetchSettings,
    resetDraft,
    saveSettings,
  };
}
