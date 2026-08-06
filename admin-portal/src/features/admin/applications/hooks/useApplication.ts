import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@/components/ui/ToastContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useActionMutation } from "@/shared/hooks/useActionMutation";
import { applicationsApi } from "../api/applications.api";
import type {
  ApplicationLifecycleCommandDto,
  ApplicationManifestEvidenceView,
  ApplicationView,
  PublishApplicationDto,
  UpdateApplicationDatabasePolicyDto,
  UpdateApplicationDto,
} from "../types";

export function useApplication(applicationKey: string) {
  const toast = useToast();
  const { mutate, isMutating } = useActionMutation();
  const ownerToken = useMemo(
    () => Symbol(`application:${applicationKey}`),
    [applicationKey],
  );
  const applicationKeyRef = useRef(applicationKey);
  const ownerTokenRef = useRef(ownerToken);
  const requestGeneration = useRef(0);
  const manifestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const manifestAbort = useRef<AbortController | null>(null);

  const [application, setApplication] = useState<ApplicationView | null>(null);
  const [loadedApplicationKey, setLoadedApplicationKey] = useState<string | null>(null);
  const [loadedApplicationOwnerToken, setLoadedApplicationOwnerToken] =
    useState<symbol | null>(null);
  const [manifests, setManifests] = useState<ApplicationManifestEvidenceView[]>([]);
  const [loadedManifestKey, setLoadedManifestKey] = useState<string | null>(null);
  const [loadedManifestOwnerToken, setLoadedManifestOwnerToken] =
    useState<symbol | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isManifestLoading, setIsManifestLoading] = useState(false);

  useLayoutEffect(() => {
    applicationKeyRef.current = applicationKey;
    ownerTokenRef.current = ownerToken;
  }, [applicationKey, ownerToken]);

  const fetchManifests = useCallback(async () => {
    const requestedKey = applicationKey;
    const requestedOwnerToken = ownerToken;
    if (ownerTokenRef.current !== requestedOwnerToken) return;
    const generation = ++manifestGeneration.current;
    manifestAbort.current?.abort();
    const controller = new AbortController();
    manifestAbort.current = controller;
    setIsManifestLoading(true);
    setManifestError(null);
    try {
      const next = await applicationsApi.getManifests(requestedKey, controller.signal);
      if (
        generation === manifestGeneration.current &&
        !controller.signal.aborted &&
        applicationKeyRef.current === requestedKey &&
        ownerTokenRef.current === requestedOwnerToken
      ) {
        setManifests(next);
        setLoadedManifestKey(requestedKey);
        setLoadedManifestOwnerToken(requestedOwnerToken);
      }
    } catch (err) {
      if (
        generation === manifestGeneration.current &&
        !controller.signal.aborted &&
        applicationKeyRef.current === requestedKey &&
        ownerTokenRef.current === requestedOwnerToken
      ) {
        setManifestError(normalizeApiError(err).message);
        setLoadedManifestKey(null);
        setLoadedManifestOwnerToken(null);
      }
    } finally {
      if (
        generation === manifestGeneration.current &&
        ownerTokenRef.current === requestedOwnerToken
      ) setIsManifestLoading(false);
    }
  }, [applicationKey, ownerToken]);

  const fetchApplication = useCallback(async () => {
    const requestedKey = applicationKey;
    const requestedOwnerToken = ownerToken;
    if (ownerTokenRef.current !== requestedOwnerToken) return;
    const generation = ++requestGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const data = await applicationsApi.get(requestedKey, controller.signal);
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted ||
        applicationKeyRef.current !== requestedKey ||
        ownerTokenRef.current !== requestedOwnerToken
      ) {
        return;
      }
      setApplication(data);
      setLoadedApplicationKey(requestedKey);
      setLoadedApplicationOwnerToken(requestedOwnerToken);
      await fetchManifests();
    } catch (err) {
      if (
        generation !== requestGeneration.current ||
        controller.signal.aborted ||
        applicationKeyRef.current !== requestedKey ||
        ownerTokenRef.current !== requestedOwnerToken
      ) {
        return;
      }
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      setLoadedApplicationKey(null);
      setLoadedApplicationOwnerToken(null);
      toast.error("Error", normalized.message);
    } finally {
      if (
        generation === requestGeneration.current &&
        ownerTokenRef.current === requestedOwnerToken
      ) setIsLoading(false);
    }
  }, [applicationKey, fetchManifests, ownerToken, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      if (ownerTokenRef.current !== ownerToken) return;
      setApplication(null);
      setLoadedApplicationKey(null);
      setLoadedApplicationOwnerToken(null);
      setManifests([]);
      setLoadedManifestKey(null);
      setLoadedManifestOwnerToken(null);
      void fetchApplication();
    });
    return () => {
      requestAbort.current?.abort();
      manifestAbort.current?.abort();
    };
  }, [applicationKey, fetchApplication, ownerToken]);

  const mutationOptions = (message: string) => {
    const ownerApplicationKey = applicationKey;
    const mutationOwnerToken = ownerToken;
    const reconcileOwner = () => {
      if (
        ownerTokenRef.current !== mutationOwnerToken ||
        applicationKeyRef.current !== ownerApplicationKey
      ) return;
      return fetchApplication();
    };
    return {
      onSuccessMessage: message,
      onSuccess: reconcileOwner,
      onErrorReconcile: reconcileOwner,
    };
  };

  const assertCurrentKey = () => {
    if (
      applicationKeyRef.current !== applicationKey ||
      ownerTokenRef.current !== ownerToken ||
      loadedApplicationOwnerToken !== ownerToken ||
      loadedApplicationKey !== applicationKey
    ) {
      throw new Error("APPLICATION_CONTEXT_CHANGED");
    }
  };

  const updateApplication = (dto: UpdateApplicationDto) => {
    assertCurrentKey();
    return mutate(
      { operation: "UPDATE", applicationKey, dto },
      (key) => applicationsApi.update(applicationKey, dto, key),
      mutationOptions("Application updated successfully."),
    );
  };

  const updateDatabasePolicy = (dto: UpdateApplicationDatabasePolicyDto) => {
    assertCurrentKey();
    return mutate(
      { operation: "UPDATE_DATABASE_POLICY", applicationKey, dto },
      (key) => applicationsApi.updateDatabasePolicy(applicationKey, dto, key),
      mutationOptions("Database policy updated."),
    );
  };

  const publishApplication = (dto: PublishApplicationDto) => {
    assertCurrentKey();
    return mutate(
      { operation: "PUBLISH", applicationKey, dto },
      (key) => applicationsApi.publish(applicationKey, dto, key),
      mutationOptions("Application revision published."),
    );
  };

  const activateApplication = (expectedCatalogueRevision: string, reason: string) => {
    assertCurrentKey();
    const dto = { expectedCatalogueRevision, reason };
    return mutate(
      { operation: "ACTIVATE", applicationKey, dto },
      (key) => applicationsApi.activate(applicationKey, expectedCatalogueRevision, reason, key),
      mutationOptions("Application activated."),
    );
  };

  const deprecateApplication = (dto: ApplicationLifecycleCommandDto) => {
    assertCurrentKey();
    return mutate(
      { operation: "DEPRECATE", applicationKey, dto },
      (key) => applicationsApi.deprecate(applicationKey, dto, key),
      mutationOptions("Application deprecated."),
    );
  };

  const disableApplication = (dto: ApplicationLifecycleCommandDto) => {
    assertCurrentKey();
    return mutate(
      { operation: "DISABLE", applicationKey, dto },
      (key) => applicationsApi.disable(applicationKey, dto, key),
      mutationOptions("Application disabled."),
    );
  };

  const deleteApplication = (expectedCatalogueRevision: string, reason: string) => {
    assertCurrentKey();
    const dto = { expectedCatalogueRevision, reason };
    return mutate(
      { operation: "DELETE", applicationKey, dto },
      async (key) => {
        await applicationsApi.delete(applicationKey, expectedCatalogueRevision, reason, key);
        return true;
      },
      {
        onSuccessMessage: "Application deleted.",
        onErrorReconcile: () => {
          if (
            ownerTokenRef.current !== ownerToken ||
            applicationKeyRef.current !== applicationKey
          ) return;
          return fetchApplication();
        },
      },
    );
  };

  const isCurrentApplication =
    loadedApplicationOwnerToken === ownerToken &&
    loadedApplicationKey === applicationKey;
  return {
    application: isCurrentApplication ? application : null,
    loadedApplicationKey,
    manifests:
      loadedManifestOwnerToken === ownerToken &&
      loadedManifestKey === applicationKey
        ? manifests
        : [],
    manifestError,
    isManifestLoading,
    isMutating,
    isLoading,
    error,
    fetchApplication,
    fetchManifests,
    updateApplication,
    updateDatabasePolicy,
    publishApplication,
    activateApplication,
    deprecateApplication,
    disableApplication,
    deleteApplication,
  };
}
