"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { provisioningReleasesApi } from "../api/provisioning-releases-api";
import { classifyReleaseReadError } from "../model/release-errors";
import { readReleasePermissions } from "../model/release-permissions";
import type {
  CoreSnapshot,
  ProvisioningRelease,
  ReleaseDraft,
  ResourceState,
} from "../types/provisioning-releases";

export function useReleaseIndex() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readReleasePermissions(user), [user]);
  const [drafts, setDrafts] = useState<CoreSnapshot<ReleaseDraft[]> | null>(null);
  const [releases, setReleases] = useState<CoreSnapshot<ProvisioningRelease[]> | null>(null);
  const [state, setState] = useState<ResourceState>("LOADING");
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [revision, setRevision] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const generation = useRef(0);
  const hasSnapshot = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== generation.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });
    void Promise.all([
      provisioningReleasesApi.listDrafts(controller.signal),
      provisioningReleasesApi.listReleases(controller.signal),
    ])
      .then(([nextDrafts, nextReleases]) => {
        if (controller.signal.aborted || current !== generation.current) return;
        hasSnapshot.current = true;
        setDrafts(nextDrafts);
        setReleases(nextReleases);
        setState(nextDrafts.data.length || nextReleases.data.length ? "READY" : "EMPTY");
      })
      .catch((caught) => {
        if (controller.signal.aborted || current !== generation.current || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setDrafts(null);
        setReleases(null);
        setError(normalized);
        setState(classifyReleaseReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [isAuthLoading, permissions.canRead, revision]);

  const visibleState: ResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return {
    permissions,
    state: visibleState,
    drafts: visibleState === "READY" || visibleState === "EMPTY" ? drafts : null,
    releases: visibleState === "READY" || visibleState === "EMPTY" ? releases : null,
    error,
    isRefreshing,
    refresh,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "AbortError");
}
