"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { provisioningReleasesApi } from "../api/provisioning-releases-api";
import { classifyReleaseMutationError, classifyReleaseReadError } from "../model/release-errors";
import {
  createReleaseIntentStore,
  shouldRetainReleaseIntent,
  stableReleaseFingerprint,
} from "../model/release-intents";
import { readReleasePermissions } from "../model/release-permissions";
import {
  releaseCatalogueStanding,
  SUPERSEDED_RETIREMENT_REASON_CODE,
} from "../model/release-standing";
import {
  buildRetireReleaseDto,
  validateRetireDraft,
} from "../model/release-validation";
import type {
  CoreSnapshot,
  ProvisioningRelease,
  ReleaseMutationState,
  ReleaseValidationErrors,
  ResourceState,
  RetireDraft,
} from "../types/provisioning-releases";
import { useReleaseCatalogue } from "./use-release-catalogue";

const EMPTY_MUTATION: ReleaseMutationState = {
  name: null,
  phase: "IDLE",
  error: null,
  correlationId: null,
};
const EMPTY_RETIRE: RetireDraft = { reasonCode: "", confirmed: false };

export function useReleaseDetail(releaseId: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readReleasePermissions(user), [user]);
  const [state, setState] = useState<ResourceState>("LOADING");
  const [snapshot, setSnapshot] = useState<CoreSnapshot<ProvisioningRelease> | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retireDraft, setRetireDraft] = useState<RetireDraft>({ ...EMPTY_RETIRE });
  const [retireErrors, setRetireErrors] = useState<ReleaseValidationErrors>({});
  const [mutation, setMutation] = useState<ReleaseMutationState>(EMPTY_MUTATION);
  const requestGeneration = useRef(0);
  const hasSnapshot = useRef(false);
  const intents = useRef(createReleaseIntentStore());
  const catalogue = useReleaseCatalogue(revision, permissions.canRead);
  const standing = snapshot
    ? releaseCatalogueStanding(snapshot.data, catalogue.catalogue)
    : "UNKNOWN";
  // Retirement waits for the standing read to settle, so a current release is
  // never retired in the moment before it is recognised as current.
  const standingSettled = catalogue.state !== "LOADING";

  const applyRelease = useCallback((next: CoreSnapshot<ProvisioningRelease>) => {
    hasSnapshot.current = true;
    setSnapshot(next);
    setState("READY");
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      intents.current.clearAll();
      hasSnapshot.current = false;
      setSnapshot(null);
      setRetireDraft({ ...EMPTY_RETIRE });
      setRetireErrors({});
      setMutation(EMPTY_MUTATION);
    });
    return () => {
      cancelled = true;
    };
  }, [releaseId]);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++requestGeneration.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== requestGeneration.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });
    void provisioningReleasesApi
      .getRelease(releaseId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted || current !== requestGeneration.current) return;
        applyRelease(next);
      })
      .catch((caught) => {
        if (controller.signal.aborted || current !== requestGeneration.current || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setSnapshot(null);
        setError(normalized);
        setState(classifyReleaseReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === requestGeneration.current) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [applyRelease, isAuthLoading, permissions.canRead, releaseId, revision]);

  const updateRetireDraft = useCallback(<K extends keyof RetireDraft>(field: K, value: RetireDraft[K]) => {
    setRetireDraft((current) => ({ ...current, [field]: value }));
    setRetireErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const retire = useCallback(async () => {
    const release = snapshot?.data;
    if (
      !release ||
      release.status !== "PUBLISHED" ||
      // Retiring a component's current release leaves it nothing to execute.
      standing === "CURRENT" ||
      !standingSettled ||
      !permissions.canRetireCritical ||
      mutation.phase === "PENDING"
    ) {
      return null;
    }
    const errors = validateRetireDraft(retireDraft);
    setRetireErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildRetireReleaseDto(release.manifestChecksum, retireDraft);
    const scope = `release:retire:${release.releaseId}`;
    const key = intents.current.get(scope, stableReleaseFingerprint(dto));
    setMutation({ name: "RETIRE", phase: "PENDING", error: null, correlationId: null });
    try {
      const result = await provisioningReleasesApi.retireRelease(release.releaseId, dto, key);
      intents.current.clear(scope);
      requestGeneration.current += 1;
      applyRelease(result);
      setMutation({ name: "RETIRE", phase: "SUCCEEDED", error: null, correlationId: result.correlationId });
      return result;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (!shouldRetainReleaseIntent(normalized)) intents.current.clear(scope);
      const phase = classifyReleaseMutationError(caught, normalized);
      setMutation({
        name: "RETIRE",
        phase,
        error: normalized,
        correlationId: normalized.correlationId ?? null,
      });
      if (["CONFLICT", "IN_FLIGHT", "UNAVAILABLE"].includes(phase)) {
        setRevision((current) => current + 1);
      }
      return null;
    }
  }, [applyRelease, mutation.phase, permissions.canRetireCritical, retireDraft, snapshot, standing, standingSettled]);

  const visibleState: ResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;
  return {
    permissions,
    state: visibleState,
    snapshot: visibleState === "READY" ? snapshot : null,
    error,
    isRefreshing,
    retireDraft,
    retireErrors,
    mutation,
    standing,
    catalogueState: catalogue.state,
    componentKey: snapshot
      ? (catalogue.catalogue?.get(snapshot.data.componentId.toLowerCase())?.key ?? null)
      : null,
    canRetire: Boolean(
      permissions.canRetireCritical &&
        snapshot?.data.status === "PUBLISHED" &&
        standing !== "CURRENT" &&
        standingSettled,
    ),
    updateRetireDraft,
    applySupersededReason: () =>
      updateRetireDraft("reasonCode", SUPERSEDED_RETIREMENT_REASON_CODE),
    retire,
    refresh: () => setRevision((current) => current + 1),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "AbortError");
}
