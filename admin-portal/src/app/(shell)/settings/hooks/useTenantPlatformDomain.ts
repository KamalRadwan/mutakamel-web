"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { axiosClient, getApiRequestOutcome } from "@/lib/api/axiosClient";
import { adminCan, adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { extractCoreData, type SuccessResponse } from "@/shared/api/core-envelope";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { isAmbiguousWriteOutcome } from "@/shared/api/write-command-recovery";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { readSettingEnvelope, TENANT_PLATFORM_DOMAIN_KEY, type SettingsLoadState } from "./useSettings";

const SETTINGS_URL = "/api/admin/core/v1/system-settings";
const DOMAIN_NOT_ALLOWED = "TENANT_PLATFORM_DOMAIN_NOT_ALLOWED";

interface DomainOptions {
  defaultDomain: string | null;
  eligibleDomains: string[];
}

function readDomainOptions(value: unknown): DomainOptions {
  if (!value || typeof value !== "object" || !("defaultDomain" in value) || !("eligibleDomains" in value)) {
    throw new Error("INVALID_TENANT_PLATFORM_DOMAIN_OPTIONS");
  }
  const { defaultDomain, eligibleDomains } = value;
  if (
    (defaultDomain !== null && (typeof defaultDomain !== "string" || !defaultDomain.trim())) ||
    !Array.isArray(eligibleDomains) ||
    !eligibleDomains.every((domain): domain is string => typeof domain === "string" && Boolean(domain.trim()))
  ) {
    throw new Error("INVALID_TENANT_PLATFORM_DOMAIN_OPTIONS");
  }
  return { defaultDomain, eligibleDomains };
}

export function useTenantPlatformDomain() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.settings.read");
  const canWrite = adminCanAll(user, ADMIN_RBAC_CRITICAL.SETTINGS_UPDATE);
  const actorId = user?.id;
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const loadRequest = useRef<AbortController | null>(null);
  const saveRequest = useRef<AbortController | null>(null);
  const [options, setOptions] = useState<DomainOptions | null>(null);
  const [selected, setSelected] = useState("");
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);

  const reload = useCallback(async () => {
    if (saveRequest.current || !canRead || isAuthLoading) return;
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    setOptions(null);
    setSelected("");
    setLoadError(null);
    setWriteError(null);
    setAmbiguous(false);
    resetKey();
    setLoadState("LOADING");

    try {
      const response = await axiosClient.get<SuccessResponse<unknown>>(
        `${SETTINGS_URL}/tenant-platform-domain`,
        { cache: "no-store", signal: controller.signal },
      );
      const latest = readDomainOptions(extractCoreData(response));
      if (controller.signal.aborted) return;
      setOptions(latest);
      setSelected(latest.eligibleDomains.find((domain) => domain === latest.defaultDomain) ?? "");
      setLoadState("READY");
    } catch (caught) {
      if (controller.signal.aborted) return;
      const error = normalizeApiError(caught);
      setLoadError(error);
      setLoadState(error.httpStatus === 403 ? "FORBIDDEN" : "ERROR");
    }
  }, [canRead, isAuthLoading, resetKey]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void reload();
      if (!saveRequest.current) setIsSaving(false);
    });
    return () => {
      cancelled = true;
      loadRequest.current?.abort();
      saveRequest.current?.abort();
      saveRequest.current = null;
    };
  }, [actorId, canWrite, reload]);

  const stale = !ambiguous && (
    writeError?.errorCode === DOMAIN_NOT_ALLOWED || writeError?.httpStatus === 409
  );
  const writeForbidden = writeError?.httpStatus === 403;
  const canSelect = canWrite && !isSaving && !stale && !writeForbidden && !ambiguous;
  const canSave = canWrite && !isSaving && !stale && !writeForbidden &&
    options?.eligibleDomains.includes(selected) === true && selected !== options.defaultDomain;

  const select = (value: string) => {
    if (!canSelect || !options?.eligibleDomains.includes(value)) return;
    setSelected(value);
    setWriteError(null);
  };

  const save = async () => {
    if (!canSave || !canRead || isAuthLoading || saveRequest.current) return;
    const controller = new AbortController();
    saveRequest.current = controller;
    setIsSaving(true);
    setWriteError(null);
    const dto = { value: selected };

    try {
      const response = await axiosClient.put<unknown>(
        `${SETTINGS_URL}/${TENANT_PLATFORM_DOMAIN_KEY}`,
        dto,
        {
          headers: { "x-idempotency-key": getIdempotencyKey(dto) },
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const setting = readSettingEnvelope(response.data, TENANT_PLATFORM_DOMAIN_KEY);
      if (setting.value !== dto.value) throw new Error("INVALID_TENANT_PLATFORM_DOMAIN_SETTING");
      if (controller.signal.aborted) return;
      resetKey();
      setAmbiguous(false);
      setOptions((current) => current && { ...current, defaultDomain: dto.value });
    } catch (caught) {
      if (controller.signal.aborted) return;
      const error = normalizeApiError(caught);
      const needsReconciliation = isAmbiguousWriteOutcome({
        ...error,
        requestOutcome: getApiRequestOutcome(caught),
      });
      if (!needsReconciliation) resetKey();
      setAmbiguous(needsReconciliation);
      setWriteError(error);
    } finally {
      if (saveRequest.current === controller) {
        saveRequest.current = null;
        setIsSaving(false);
      }
    }
  };

  return {
    options,
    selected,
    loadState: isAuthLoading ? "LOADING" : canRead ? loadState : "FORBIDDEN",
    loadError,
    writeError,
    stale,
    ambiguous,
    isSaving,
    canWrite,
    canSelect,
    canSave,
    reload,
    select,
    save,
  };
}
