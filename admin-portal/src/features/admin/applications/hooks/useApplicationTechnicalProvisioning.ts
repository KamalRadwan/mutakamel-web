import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import {
  classifyTechnicalProvisioningError,
  shouldReconcileTechnicalProvisioning,
} from "../lib/technical-provisioning-state";
import type {
  ApplicationTechnicalReadinessView,
  CreateApplicationProvisioningBindingDto,
} from "../types";

interface LinkPrimaryComponentInput {
  contractVersion: number;
  reason: string;
}

interface Options {
  onChanged?: () => void | Promise<void>;
}

export function useApplicationTechnicalProvisioning(
  applicationKey: string,
  options: Options = {},
) {
  const toast = useToast();
  const { t } = useI18n();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const requestSequence = useRef(0);
  const pendingIntent = useRef<CreateApplicationProvisioningBindingDto | null>(null);
  const onChangedRef = useRef(options.onChanged);

  const [readiness, setReadiness] =
    useState<ApplicationTechnicalReadinessView | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [commandError, setCommandError] =
    useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [hasPendingIntent, setHasPendingIntent] = useState(false);

  useEffect(() => {
    onChangedRef.current = options.onChanged;
  }, [options.onChanged]);

  const fetchReadiness = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsRefreshing(true);
    setError(null);

    try {
      const next = await applicationsApi.getTechnicalProvisioning(applicationKey);
      if (sequence === requestSequence.current) setReadiness(next);
      return next;
    } catch (fetchError) {
      const normalized = normalizeApiError(fetchError);
      if (sequence === requestSequence.current) {
        setError(normalized);
      }
      return null;
    } finally {
      if (sequence === requestSequence.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [applicationKey]);

  useEffect(() => {
    queueMicrotask(() => {
      setReadiness(null);
      setIsLoading(true);
      setCommandError(null);
      pendingIntent.current = null;
      setHasPendingIntent(false);
      resetKey();
      void fetchReadiness();
    });
  }, [applicationKey, fetchReadiness, resetKey]);

  const executeBinding = useCallback(
    async (dto: CreateApplicationProvisioningBindingDto) => {
      setIsLinking(true);
      setCommandError(null);
      pendingIntent.current = dto;
      setHasPendingIntent(true);

      try {
        const key = getIdempotencyKey(dto);
        await applicationsApi.createPrimaryProvisioningComponent(
          applicationKey,
          dto,
          key,
        );
        pendingIntent.current = null;
        setHasPendingIntent(false);
        resetKey();
        await Promise.all([fetchReadiness(), onChangedRef.current?.()]);
        toast.success(
          t.applications.technicalProvisioning.toastSuccessTitle,
          t.applications.technicalProvisioning.toastSuccessMessage,
        );
        return true;
      } catch (bindingError) {
        const normalized = normalizeApiError(bindingError);
        const kind = classifyTechnicalProvisioningError(normalized);
        let reconciled: ApplicationTechnicalReadinessView | null = null;

        if (kind === "STALE") {
          pendingIntent.current = null;
          setHasPendingIntent(false);
          resetKey();
        }
        if (shouldReconcileTechnicalProvisioning(kind)) {
          reconciled = await fetchReadiness();
        }
        if (reconciled?.components.length) {
          pendingIntent.current = null;
          setHasPendingIntent(false);
          resetKey();
          await onChangedRef.current?.();
          toast.success(
            t.applications.technicalProvisioning.toastSuccessTitle,
            t.applications.technicalProvisioning.reconciledSuccess,
          );
          return true;
        }

        setCommandError(normalized);
        if (kind === "IN_FLIGHT" || kind === "AMBIGUOUS") {
          toast.warning(
            t.applications.technicalProvisioning.processingTitle,
            t.applications.technicalProvisioning.processingMessage,
          );
        } else {
          toast.error(
            t.applications.technicalProvisioning.toastErrorTitle,
            normalized.message,
          );
        }
        return false;
      } finally {
        setIsLinking(false);
      }
    },
    [
      applicationKey,
      fetchReadiness,
      getIdempotencyKey,
      resetKey,
      t,
      toast,
    ],
  );

  const linkPrimaryComponent = useCallback(
    async ({ contractVersion, reason }: LinkPrimaryComponentInput) => {
      if (!readiness) return false;
      return executeBinding({
        expectedTechnicalDefinitionRevision:
          readiness.technicalDefinitionRevision,
        contractVersion,
        reason,
      });
    },
    [executeBinding, readiness],
  );

  const retryPendingIntent = useCallback(async () => {
    if (!pendingIntent.current) return false;
    return executeBinding(pendingIntent.current);
  }, [executeBinding]);

  const clearCommandError = useCallback(() => setCommandError(null), []);

  return {
    readiness,
    error,
    commandError,
    isLoading,
    isRefreshing,
    isLinking,
    hasPendingIntent,
    refresh: fetchReadiness,
    linkPrimaryComponent,
    retryPendingIntent,
    clearCommandError,
  };
}
