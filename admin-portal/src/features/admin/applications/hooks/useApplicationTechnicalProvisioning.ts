import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@/components/ui/ToastContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { applicationsApi } from "../api/applications.api";
import {
  canLinkPrimaryComponent,
  classifyTechnicalProvisioningError,
  deriveTechnicalIdentityPreview,
  shouldReconcileTechnicalProvisioning,
} from "../lib/technical-provisioning-state";
import type {
  AdoptApplicationTechnicalPackageDto,
  ApplicationTechnicalReadinessView,
  CreateApplicationProvisioningBindingDto,
} from "../types";

type PendingTechnicalIntent =
  | {
      ownerToken: symbol;
      applicationKey: string;
      kind: "ADOPT";
      dto: AdoptApplicationTechnicalPackageDto;
    }
  | {
      ownerToken: symbol;
      applicationKey: string;
      kind: "BIND";
      dto: CreateApplicationProvisioningBindingDto;
    };

interface Options {
  onChanged?: () => void | Promise<void>;
}

export function useApplicationTechnicalProvisioning(
  applicationKey: string,
  options: Options = {},
) {
  const toast = useToast();
  const { t } = useI18n();
  const {
    getIdempotencyKey: getAdoptionIdempotencyKey,
    resetKey: resetAdoptionIdempotencyKey,
  } = useIdempotency();
  const {
    getIdempotencyKey: getBindingIdempotencyKey,
    resetKey: resetBindingIdempotencyKey,
  } = useIdempotency();
  const ownerToken = useMemo(
    () => Symbol(`application:${applicationKey}`),
    [applicationKey],
  );
  const applicationKeyRef = useRef(applicationKey);
  const ownerTokenRef = useRef(ownerToken);
  const requestSequence = useRef(0);
  const pendingIntent = useRef<PendingTechnicalIntent | null>(null);
  const onChangedRef = useRef(options.onChanged);

  const [readiness, setReadiness] =
    useState<ApplicationTechnicalReadinessView | null>(null);
  const [readinessOwnerToken, setReadinessOwnerToken] =
    useState<symbol | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [commandError, setCommandError] =
    useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [pendingIntentKind, setPendingIntentKind] =
    useState<PendingTechnicalIntent["kind"] | null>(null);

  useLayoutEffect(() => {
    applicationKeyRef.current = applicationKey;
    ownerTokenRef.current = ownerToken;
  }, [applicationKey, ownerToken]);

  useEffect(() => {
    onChangedRef.current = options.onChanged;
  }, [options.onChanged]);

  const fetchReadiness = useCallback(async () => {
    const requestedApplicationKey = applicationKey;
    const requestedOwnerToken = ownerToken;
    if (
      applicationKeyRef.current !== requestedApplicationKey ||
      ownerTokenRef.current !== requestedOwnerToken
    ) return null;
    const sequence = ++requestSequence.current;
    setIsRefreshing(true);
    setError(null);

    try {
      const next = await applicationsApi.getTechnicalProvisioning(
        requestedApplicationKey,
      );
      if (
        sequence !== requestSequence.current ||
        applicationKeyRef.current !== requestedApplicationKey ||
        ownerTokenRef.current !== requestedOwnerToken
      ) {
        return null;
      }
      setReadiness(next);
      setReadinessOwnerToken(requestedOwnerToken);
      return next;
    } catch (fetchError) {
      const normalized = normalizeApiError(fetchError);
      if (
        sequence === requestSequence.current &&
        applicationKeyRef.current === requestedApplicationKey &&
        ownerTokenRef.current === requestedOwnerToken
      ) {
        setError(normalized);
      }
      return null;
    } finally {
      if (
        sequence === requestSequence.current &&
        applicationKeyRef.current === requestedApplicationKey &&
        ownerTokenRef.current === requestedOwnerToken
      ) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [applicationKey, ownerToken]);

  useEffect(() => {
    queueMicrotask(() => {
      if (ownerTokenRef.current !== ownerToken) return;
      setReadiness(null);
      setReadinessOwnerToken(null);
      setIsLoading(true);
      setIsRefreshing(false);
      setIsAdopting(false);
      setIsLinking(false);
      setCommandError(null);
      pendingIntent.current = null;
      setPendingIntentKind(null);
      resetAdoptionIdempotencyKey();
      resetBindingIdempotencyKey();
      void fetchReadiness();
    });
  }, [
    applicationKey,
    fetchReadiness,
    ownerToken,
    resetAdoptionIdempotencyKey,
    resetBindingIdempotencyKey,
  ]);

  const clearPendingIntent = useCallback((
    kind: PendingTechnicalIntent["kind"],
    ownerApplicationKey: string,
    intentOwnerToken: symbol,
  ) => {
    if (
      ownerTokenRef.current !== intentOwnerToken ||
      applicationKeyRef.current !== ownerApplicationKey ||
      pendingIntent.current?.ownerToken !== intentOwnerToken
    ) {
      return;
    }
    pendingIntent.current = null;
    setPendingIntentKind(null);
    if (kind === "ADOPT") resetAdoptionIdempotencyKey();
    else resetBindingIdempotencyKey();
  }, [resetAdoptionIdempotencyKey, resetBindingIdempotencyKey]);

  const executeIntent = useCallback(
    async (intent: PendingTechnicalIntent) => {
      const ownerApplicationKey = intent.applicationKey;
      const intentOwnerToken = intent.ownerToken;
      if (
        ownerTokenRef.current !== intentOwnerToken ||
        applicationKeyRef.current !== ownerApplicationKey
      ) return false;
      const adopting = intent.kind === "ADOPT";
      if (adopting) setIsAdopting(true);
      else setIsLinking(true);
      setCommandError(null);
      pendingIntent.current = intent;
      setPendingIntentKind(intent.kind);

      try {
        const key = adopting
          ? getAdoptionIdempotencyKey(intent.dto)
          : getBindingIdempotencyKey(intent.dto);
        if (adopting) {
          await applicationsApi.adoptTechnicalPackage(
            ownerApplicationKey,
            intent.dto,
            key,
          );
        } else {
          await applicationsApi.createPrimaryProvisioningComponent(
            ownerApplicationKey,
            intent.dto,
            key,
          );
        }
        if (
          ownerTokenRef.current !== intentOwnerToken ||
          applicationKeyRef.current !== ownerApplicationKey
        ) return false;
        clearPendingIntent(intent.kind, ownerApplicationKey, intentOwnerToken);
        await Promise.all([fetchReadiness(), onChangedRef.current?.()]);
        if (ownerTokenRef.current !== intentOwnerToken) return false;
        toast.success(
          adopting
            ? t.applications.technicalProvisioning.adoptionSuccessTitle
            : t.applications.technicalProvisioning.toastSuccessTitle,
          adopting
            ? t.applications.technicalProvisioning.adoptionSuccessMessage
            : t.applications.technicalProvisioning.toastSuccessMessage,
        );
        return true;
      } catch (commandFailure) {
        const normalized = normalizeApiError(commandFailure);
        if (
          ownerTokenRef.current !== intentOwnerToken ||
          applicationKeyRef.current !== ownerApplicationKey
        ) return false;
        const kind = classifyTechnicalProvisioningError(normalized);
        let reconciled: ApplicationTechnicalReadinessView | null = null;

        if (shouldReconcileTechnicalProvisioning(kind)) {
          reconciled = await fetchReadiness();
          if (ownerTokenRef.current !== intentOwnerToken) return false;
        }
        const derived = deriveTechnicalIdentityPreview(ownerApplicationKey);
        const completed = adopting
          ? reconciled?.runtimeTarget === derived.runtimeTarget
          : reconciled?.components.some(
              (component) =>
                component.key === derived.primaryComponentKey &&
                component.contractVersion === 1,
            );
        if (completed) {
          clearPendingIntent(intent.kind, ownerApplicationKey, intentOwnerToken);
          await onChangedRef.current?.();
          if (ownerTokenRef.current !== intentOwnerToken) return false;
          toast.success(
            adopting
              ? t.applications.technicalProvisioning.adoptionSuccessTitle
              : t.applications.technicalProvisioning.toastSuccessTitle,
            t.applications.technicalProvisioning.reconciledSuccess,
          );
          return true;
        }

        if (kind !== "IN_FLIGHT" && kind !== "AMBIGUOUS") {
          clearPendingIntent(intent.kind, ownerApplicationKey, intentOwnerToken);
        }
        setCommandError(normalized);
        if (kind === "IN_FLIGHT" || kind === "AMBIGUOUS") {
          toast.warning(
            t.applications.technicalProvisioning.processingTitle,
            t.applications.technicalProvisioning.processingMessage,
          );
        } else {
          toast.error(
            adopting
              ? t.applications.technicalProvisioning.adoptionErrorTitle
              : t.applications.technicalProvisioning.toastErrorTitle,
            normalized.message,
          );
        }
        return false;
      } finally {
        if (ownerTokenRef.current === intentOwnerToken) {
          if (adopting) setIsAdopting(false);
          else setIsLinking(false);
        }
      }
    },
    [
      clearPendingIntent,
      fetchReadiness,
      getAdoptionIdempotencyKey,
      getBindingIdempotencyKey,
      t,
      toast,
    ],
  );

  const currentReadiness =
    readinessOwnerToken === ownerToken &&
    readiness?.applicationKey === applicationKey
      ? readiness
      : null;

  const adoptTechnicalPackage = useCallback(
    async (reason: string) => {
      if (
        !currentReadiness ||
        ownerTokenRef.current !== ownerToken ||
        applicationKeyRef.current !== applicationKey
      ) {
        return false;
      }
      return executeIntent({
        ownerToken,
        applicationKey,
        kind: "ADOPT",
        dto: {
          expectedTechnicalDefinitionRevision:
            currentReadiness.technicalDefinitionRevision,
          reason,
        },
      });
    },
    [applicationKey, currentReadiness, executeIntent, ownerToken],
  );

  const linkPrimaryComponent = useCallback(
    async (reason: string) => {
      if (
        !currentReadiness ||
        !canLinkPrimaryComponent(currentReadiness) ||
        ownerTokenRef.current !== ownerToken ||
        applicationKeyRef.current !== applicationKey
      ) {
        return false;
      }
      return executeIntent({
        ownerToken,
        applicationKey,
        kind: "BIND",
        dto: {
          expectedTechnicalDefinitionRevision:
            currentReadiness.technicalDefinitionRevision,
          reason,
        },
      });
    },
    [applicationKey, currentReadiness, executeIntent, ownerToken],
  );

  const retryPendingIntent = useCallback(async () => {
    if (
      !pendingIntent.current ||
      pendingIntent.current.ownerToken !== ownerTokenRef.current ||
      pendingIntent.current.applicationKey !== applicationKeyRef.current
    ) {
      return false;
    }
    return executeIntent(pendingIntent.current);
  }, [executeIntent]);

  const clearCommandError = useCallback(() => setCommandError(null), []);

  return {
    readiness: currentReadiness,
    error,
    commandError,
    isLoading,
    isRefreshing,
    isAdopting,
    isLinking,
    pendingIntentKind,
    refresh: fetchReadiness,
    adoptTechnicalPackage,
    linkPrimaryComponent,
    retryPendingIntent,
    clearCommandError,
  };
}
