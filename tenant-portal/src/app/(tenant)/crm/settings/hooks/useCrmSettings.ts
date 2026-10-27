"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";

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
    throw new Error("INVALID_CRM_SETTINGS_RESPONSE");
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
    throw new Error("INVALID_CRM_SETTINGS_RESPONSE");
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
): Partial<EditableCrmSettings> & {
  expectedOutboundEmailRetentionPolicyRevision?: number;
} {
  if (
    !Number.isInteger(draft.outboundEmailContentRetentionDays) ||
    draft.outboundEmailContentRetentionDays < 30 ||
    draft.outboundEmailContentRetentionDays > 2555
  ) {
    throw new RangeError("CRM_SETTINGS_RETENTION_INVALID");
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
          expectedOutboundEmailRetentionPolicyRevision:
            current.outboundEmailRetentionPolicyRevision,
        }),
  };
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
  const { t } = useI18n();
  const crmErrorText = useCrmErrorText();
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
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [hasRetentionConflict, setHasRetentionConflict] = useState(false);

  const applyServerSettings = useCallback((next: CrmSettings) => {
    setSettings(next);
    setDraft(editable(next));
  }, []);

  const fetchSettings = useCallback(
    async (signal?: AbortSignal, preserveDraft = false) => {
      setIsLoading(true);
      setError(null);
      setQueryError(null);
      try {
        const next = await readSettings(signal);
        if (preserveDraft) setSettings(next);
        else applyServerSettings(next);
        setHasRetentionConflict(false);
      } catch (caught) {
        if (isAbortError(caught)) return;
        if (!preserveDraft) {
          setSettings(null);
          setDraft(null);
        }
        const { status, code } = normalizeApiError(caught);
        setQueryError({ status, code });
        setError(caught instanceof TenantApiClientError
          ? crmErrorText({ status, code })
          : t.crmSettings.loadFailed);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [applyServerSettings, crmErrorText, t],
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
    if (!settings || !draft || isSaving || isLoading || hasRetentionConflict) return false;
    if (!canManage) {
      setError(t.crmSettings.manageForbidden);
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
      const failure = normalizeApiError(caught);
      if (failure.status === 409 && failure.code === "CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE") {
        setHasRetentionConflict(true);
        return false;
      }
      if (isAmbiguousMutationError(caught)) {
        try {
          applyServerSettings(await readSettings());
        } catch {
          // Keep the last confirmed server state when reconciliation is unavailable.
        }
      }
      setError(caught instanceof RangeError
        ? t.crmSettings.retentionHelp
        : caught instanceof TenantApiClientError
          ? crmErrorText({ status: failure.status, code: failure.code })
          : t.crmSettings.saveFailed);
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
    queryError,
    hasRetentionConflict,
    reloadRetentionPolicy: () => fetchSettings(undefined, true),
    fetchSettings,
    resetDraft,
    saveSettings,
  };
}
