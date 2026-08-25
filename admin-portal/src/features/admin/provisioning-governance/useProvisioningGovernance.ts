"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { provisioningGovernanceApi } from "./api";
import type {
  AsyncView,
  ComponentQuery,
  CreateDiscoveryRunCommand,
  DiscoveryRun,
  DiscoveryRunDetail,
  Paginated,
  ProvisioningComponent,
  ProvisioningRelease,
  ReleaseQuery,
  RequestState,
} from "./types";

const DEFAULT_COMPONENT_QUERY: ComponentQuery = {
  page: 1,
  limit: 20,
  sortBy: "key",
  sortDir: "ASC",
};

const DEFAULT_RELEASE_QUERY: ReleaseQuery = {
  page: 1,
  limit: 20,
  sortBy: "publishedAt",
  sortDir: "DESC",
};

export function useProvisioningGovernance() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const authorizationOwnerId = user?.id ?? null;
  const authorizationOwnerRef = useRef(authorizationOwnerId);
  const canReadCatalogue = adminCan(user, "admin.tenants.read");
  const canReadDiscovery = adminCan(user, "admin.provisioning.discovery.read");
  const canRunDiscovery = adminCanAll(user, [
    "admin.provisioning.discovery.run",
    "admin.provisioning.critical",
  ]);
  const canReadFleet = adminCan(user, "admin.provisioning.rollouts.read");
  const canReadPublisherKeys = adminCan(
    user,
    "admin.provisioning.publisher-keys.read",
  );
  const canReadReleases = adminCan(user, "admin.provisioning.releases.read");

  const [componentDraft, setComponentDraft] = useState<ComponentQuery>(
    DEFAULT_COMPONENT_QUERY,
  );
  const [componentQuery, setComponentQuery] = useState<ComponentQuery>(
    DEFAULT_COMPONENT_QUERY,
  );
  const [componentRevision, setComponentRevision] = useState(0);
  const [componentState, setComponentState] = useState<RequestState>("LOADING");
  const [components, setComponents] =
    useState<Paginated<ProvisioningComponent> | null>(null);
  const [componentError, setComponentError] =
    useState<NormalizedApiError | null>(null);
  const [componentOwnerId, setComponentOwnerId] = useState<string | null>(null);
  const [componentsRefreshing, setComponentsRefreshing] = useState(false);
  const componentsRef = useRef<Paginated<ProvisioningComponent> | null>(null);

  const [selectedComponent, setSelectedComponent] =
    useState<ProvisioningComponent | null>(null);
  const [releaseDraft, setReleaseDraft] = useState<ReleaseQuery>(
    DEFAULT_RELEASE_QUERY,
  );
  const [releaseQuery, setReleaseQuery] = useState<ReleaseQuery>(
    DEFAULT_RELEASE_QUERY,
  );
  const [releaseRevision, setReleaseRevision] = useState(0);
  const [releaseState, setReleaseState] = useState<RequestState>("IDLE");
  const [releases, setReleases] =
    useState<Paginated<ProvisioningRelease> | null>(null);
  const [releaseError, setReleaseError] = useState<NormalizedApiError | null>(
    null,
  );
  const [releaseOwnerId, setReleaseOwnerId] = useState<string | null>(null);
  const [releasesRefreshing, setReleasesRefreshing] = useState(false);
  const releasesRef = useRef<Paginated<ProvisioningRelease> | null>(null);

  const [discoveryRevision, setDiscoveryRevision] = useState(0);
  const [discoveryState, setDiscoveryState] = useState<RequestState>("LOADING");
  const [discoveryRuns, setDiscoveryRuns] = useState<{
    items: DiscoveryRun[];
    correlationId: string;
    timestamp: string;
  } | null>(null);
  const [discoveryError, setDiscoveryError] =
    useState<NormalizedApiError | null>(null);
  const [discoveryOwnerId, setDiscoveryOwnerId] = useState<string | null>(null);
  const [discoveryRefreshing, setDiscoveryRefreshing] = useState(false);
  const discoveryRunsRef = useRef<typeof discoveryRuns>(null);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<RequestState>("IDLE");
  const [detail, setDetail] = useState<DiscoveryRunDetail | null>(null);
  const [detailError, setDetailError] = useState<NormalizedApiError | null>(
    null,
  );
  const [detailOwnerId, setDetailOwnerId] = useState<string | null>(null);

  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(
    null,
  );
  const [createdRun, setCreatedRun] = useState<DiscoveryRun | null>(null);
  const [exactRetryAvailable, setExactRetryAvailable] = useState(false);
  const [mutationOwnerId, setMutationOwnerId] = useState<string | null>(null);
  const mutationAttemptRef = useRef<string | null>(null);
  const discoveryIntent = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);

  useEffect(() => {
    authorizationOwnerRef.current = authorizationOwnerId;
    discoveryIntent.current = null;
    mutationAttemptRef.current = null;
  }, [authorizationOwnerId]);

  useEffect(() => {
    if (isAuthLoading || !canReadCatalogue || !authorizationOwnerId) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      if (componentsRef.current) setComponentsRefreshing(true);
      else setComponentState("LOADING");
      setComponentError(null);
      try {
        const result = await provisioningGovernanceApi.listComponents(
          componentQuery,
          controller.signal,
        );
        if (disposed) return;
        setComponents(result);
        componentsRef.current = result;
        setComponentOwnerId(authorizationOwnerId);
        setComponentState(result.items.length ? "READY" : "EMPTY");
      } catch (caught) {
        if (disposed || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        setComponents(null);
        componentsRef.current = null;
        setComponentOwnerId(authorizationOwnerId);
        setComponentError(normalized);
        setComponentState(classifyFailure(caught, normalized));
      } finally {
        if (!disposed) setComponentsRefreshing(false);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    authorizationOwnerId,
    canReadCatalogue,
    componentQuery,
    componentRevision,
    isAuthLoading,
  ]);

  useEffect(() => {
    if (
      isAuthLoading ||
      !canReadCatalogue ||
      !authorizationOwnerId ||
      !selectedComponent
    ) {
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      if (releasesRef.current) setReleasesRefreshing(true);
      else setReleaseState("LOADING");
      setReleaseError(null);
      try {
        const result = await provisioningGovernanceApi.listComponentReleases(
          selectedComponent.id,
          releaseQuery,
          controller.signal,
        );
        if (disposed) return;
        setReleases(result);
        releasesRef.current = result;
        setReleaseOwnerId(authorizationOwnerId);
        setReleaseState(result.items.length ? "READY" : "EMPTY");
      } catch (caught) {
        if (disposed || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        setReleases(null);
        releasesRef.current = null;
        setReleaseOwnerId(authorizationOwnerId);
        setReleaseError(normalized);
        setReleaseState(classifyFailure(caught, normalized));
      } finally {
        if (!disposed) setReleasesRefreshing(false);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    authorizationOwnerId,
    canReadCatalogue,
    isAuthLoading,
    releaseQuery,
    releaseRevision,
    selectedComponent,
  ]);

  useEffect(() => {
    if (isAuthLoading || !canReadDiscovery || !authorizationOwnerId) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      if (discoveryRunsRef.current) setDiscoveryRefreshing(true);
      else setDiscoveryState("LOADING");
      setDiscoveryError(null);
      try {
        const result = await provisioningGovernanceApi.listDiscoveryRuns(
          controller.signal,
        );
        if (disposed) return;
        setDiscoveryRuns(result);
        discoveryRunsRef.current = result;
        setDiscoveryOwnerId(authorizationOwnerId);
        setDiscoveryState(result.items.length ? "READY" : "EMPTY");
      } catch (caught) {
        if (disposed || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        setDiscoveryRuns(null);
        discoveryRunsRef.current = null;
        setDiscoveryOwnerId(authorizationOwnerId);
        setDiscoveryError(normalized);
        setDiscoveryState(classifyFailure(caught, normalized));
      } finally {
        if (!disposed) setDiscoveryRefreshing(false);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    authorizationOwnerId,
    canReadDiscovery,
    discoveryRevision,
    isAuthLoading,
  ]);

  useEffect(() => {
    if (
      isAuthLoading ||
      !canReadDiscovery ||
      !authorizationOwnerId ||
      !selectedRunId
    ) {
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      setDetail(null);
      setDetailError(null);
      setDetailState("LOADING");
      void provisioningGovernanceApi
        .getDiscoveryRun(selectedRunId, controller.signal)
        .then((result) => {
          if (disposed) return;
          setDetail(result);
          setDetailOwnerId(authorizationOwnerId);
          setDetailState(result.results.length ? "READY" : "EMPTY");
        })
        .catch((caught: unknown) => {
          if (disposed || isAbortError(caught)) return;
          const normalized = normalizeApiError(caught);
          setDetailError(normalized);
          setDetailOwnerId(authorizationOwnerId);
          setDetailState(classifyFailure(caught, normalized));
        });
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [authorizationOwnerId, canReadDiscovery, isAuthLoading, selectedRunId]);

  const runDiscovery = useCallback(
    async (command: CreateDiscoveryRunCommand) => {
      if (!canRunDiscovery || mutationAttemptRef.current) return null;
      const operationOwnerId = authorizationOwnerId;
      if (!operationOwnerId) return null;
      const commandSnapshot = { ...command };
      const fingerprint = [
        commandSnapshot.mode,
        commandSnapshot.cutoffAt,
        String(commandSnapshot.maxTenants),
      ].join("\u0000");
      if (discoveryIntent.current?.fingerprint !== fingerprint) {
        discoveryIntent.current = {
          fingerprint,
          idempotencyKey: generateUUIDv7(),
        };
      }
      const idempotencyKey = discoveryIntent.current.idempotencyKey;
      const attemptId = generateUUIDv7();
      mutationAttemptRef.current = attemptId;
      setMutationOwnerId(operationOwnerId);
      setMutationPending(true);
      setMutationError(null);
      setCreatedRun(null);
      setExactRetryAvailable(false);
      try {
        const result = await provisioningGovernanceApi.createDiscoveryRun(
          commandSnapshot,
          idempotencyKey,
        );
        if (
          mutationAttemptRef.current !== attemptId ||
          authorizationOwnerRef.current !== operationOwnerId
        ) {
          return null;
        }
        discoveryIntent.current = null;
        setExactRetryAvailable(false);
        setCreatedRun(result);
        setDiscoveryRevision((current) => current + 1);
        return result;
      } catch (caught) {
        if (
          mutationAttemptRef.current !== attemptId ||
          authorizationOwnerRef.current !== operationOwnerId
        ) {
          return null;
        }
        const normalized = normalizeApiError(caught);
        const retain = retainIntent(normalized);
        if (!retain) discoveryIntent.current = null;
        setExactRetryAvailable(retain);
        setMutationError(normalized);
        return null;
      } finally {
        if (mutationAttemptRef.current === attemptId) {
          mutationAttemptRef.current = null;
          setMutationPending(false);
        }
      }
    },
    [authorizationOwnerId, canRunDiscovery],
  );

  const ownsMutation =
    canRunDiscovery && mutationOwnerId === authorizationOwnerId;

  const catalogue = visibleView(
    isAuthLoading,
    canReadCatalogue,
    authorizationOwnerId,
    componentOwnerId,
    componentState,
    components,
    componentError,
    componentsRefreshing,
  );
  const releaseView = selectedComponent
    ? visibleView(
        isAuthLoading,
        canReadCatalogue,
        authorizationOwnerId,
        releaseOwnerId,
        releaseState,
        releases,
        releaseError,
        releasesRefreshing,
      )
    : {
        state: "IDLE" as const,
        data: null,
        error: null,
        isRefreshing: false,
      };
  const discovery = visibleView(
    isAuthLoading,
    canReadDiscovery,
    authorizationOwnerId,
    discoveryOwnerId,
    discoveryState,
    discoveryRuns,
    discoveryError,
    discoveryRefreshing,
  );
  const detailView = selectedRunId
    ? visibleView(
        isAuthLoading,
        canReadDiscovery,
        authorizationOwnerId,
        detailOwnerId,
        detailState,
        detail,
        detailError,
        false,
      )
    : {
        state: "IDLE" as const,
        data: null,
        error: null,
        isRefreshing: false,
      };

  return {
    permissions: {
      canReadCatalogue,
      canReadDiscovery,
      canRunDiscovery,
      canReadFleet,
      canReadPublisherKeys,
      canReadReleases,
    },
    componentDraft,
    setComponentDraft,
    componentQuery,
    catalogue,
    applyComponentFilters: () =>
      setComponentQuery({ ...componentDraft, page: 1 }),
    resetComponentFilters: () => {
      setComponentDraft(DEFAULT_COMPONENT_QUERY);
      setComponentQuery(DEFAULT_COMPONENT_QUERY);
    },
    setComponentPage: (page: number) =>
      setComponentQuery((current) => ({ ...current, page })),
    refreshComponents: () => setComponentRevision((current) => current + 1),
    selectedComponent,
    selectComponent: (value: ProvisioningComponent | null) => {
      setSelectedComponent(value);
      setReleaseDraft(DEFAULT_RELEASE_QUERY);
      setReleaseQuery(DEFAULT_RELEASE_QUERY);
      setReleases(null);
      releasesRef.current = null;
      setReleaseOwnerId(null);
      setReleaseState(value ? "LOADING" : "IDLE");
    },
    releaseDraft,
    setReleaseDraft,
    releaseQuery,
    releases: releaseView,
    applyReleaseFilters: () => setReleaseQuery({ ...releaseDraft, page: 1 }),
    resetReleaseFilters: () => {
      setReleaseDraft(DEFAULT_RELEASE_QUERY);
      setReleaseQuery(DEFAULT_RELEASE_QUERY);
    },
    setReleasePage: (page: number) =>
      setReleaseQuery((current) => ({ ...current, page })),
    refreshReleases: () => setReleaseRevision((current) => current + 1),
    discovery,
    refreshDiscovery: () => setDiscoveryRevision((current) => current + 1),
    selectedRunId,
    selectRun: setSelectedRunId,
    detail: detailView,
    mutation: {
      isPending: ownsMutation && mutationPending,
      error: ownsMutation ? mutationError : null,
      result: ownsMutation ? createdRun : null,
      exactRetryAvailable:
        ownsMutation && mutationError !== null && exactRetryAvailable,
      clear: () => {
        setMutationError(null);
        setCreatedRun(null);
        setExactRetryAvailable(false);
      },
    },
    runDiscovery,
  };
}

function visibleView<T>(
  isAuthLoading: boolean,
  allowed: boolean,
  authorizationOwnerId: string | null,
  responseOwnerId: string | null,
  state: RequestState,
  data: T | null,
  error: NormalizedApiError | null,
  isRefreshing: boolean,
): AsyncView<T> {
  if (isAuthLoading) {
    return { state: "LOADING", data: null, error: null, isRefreshing: false };
  }
  if (!allowed) {
    return { state: "FORBIDDEN", data: null, error: null, isRefreshing: false };
  }
  if (!authorizationOwnerId || responseOwnerId !== authorizationOwnerId) {
    return { state: "LOADING", data: null, error: null, isRefreshing: false };
  }
  return { state, data, error, isRefreshing };
}

function classifyFailure(
  original: unknown,
  normalized: NormalizedApiError,
): RequestState {
  if (normalized.httpStatus === 403) return "FORBIDDEN";
  if (
    original instanceof TypeError ||
    [502, 503, 504].includes(normalized.httpStatus) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(normalized.errorCode)
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function retainIntent(error: NormalizedApiError): boolean {
  return (
    error.httpStatus >= 500 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT" ||
    error.errorCode === "UNKNOWN_ERROR"
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export type ProvisioningGovernanceView = ReturnType<
  typeof useProvisioningGovernance
>;
