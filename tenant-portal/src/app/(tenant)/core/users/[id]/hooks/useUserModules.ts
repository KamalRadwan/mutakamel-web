"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  assignUserModule,
  fetchUserModules,
  MODULE_KEY_PATTERN,
  SEAT_LIMIT_REACHED_CODE,
  unassignUserModule,
  type UserModuleAssignment,
} from "../../../contracts/user-subresource-contract";

interface ScopedState<T> {
  userId: string;
  value: T;
}

export function useUserModules(
  userId: string,
  enabled: boolean,
  canWrite: boolean = enabled,
) {
  const [assignments, setAssignments] = useState<UserModuleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [baselineUserId, setBaselineUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeErrorState, setWriteErrorState] =
    useState<ScopedState<NormalizedApiError> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [assignOpenUserId, setAssignOpenUserId] = useState<string | null>(null);
  const [moduleKeyState, setModuleKeyState] = useState<ScopedState<string> | null>(null);
  const [removalState, setRemovalState] =
    useState<ScopedState<UserModuleAssignment> | null>(null);
  const [seatLimitUserId, setSeatLimitUserId] = useState<string | null>(null);

  const canAssign = enabled && canWrite && isUUIDv7(userId);
  const canRemove =
    canAssign && baselineUserId === userId && !isLoading && !loadError;
  const moduleKey = moduleKeyState?.userId === userId ? moduleKeyState.value : "";
  const writeError = writeErrorState?.userId === userId ? writeErrorState.value : null;
  const pendingRemoval = removalState?.userId === userId ? removalState.value : null;
  const isSeatLimitReached = seatLimitUserId === userId;

  const inFlightRef = useRef(false);
  const latestRef = useRef({
    userId,
    canWrite,
    canAssign,
    canRemove,
    moduleKeyState,
    removalState,
  });

  useEffect(() => {
    latestRef.current = {
      userId,
      canWrite,
      canAssign,
      canRemove,
      moduleKeyState,
      removalState,
    };
  });

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsLoading(false);
        setBaselineUserId(null);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setBaselineUserId(null);
      fetchUserModules(userId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setAssignments(result);
          setBaselineUserId(userId);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setAssignments([]);
          setLoadError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, reloadToken, userId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const setModuleKey = useCallback((value: string) => {
    const scoped = { userId: latestRef.current.userId, value };
    latestRef.current.moduleKeyState = scoped;
    setModuleKeyState(scoped);
  }, []);

  const openAssign = useCallback(() => {
    const state = latestRef.current;
    if (inFlightRef.current || !state.canAssign) return;
    setWriteErrorState(null);
    setSeatLimitUserId(null);
    setModuleKey("");
    setAssignOpenUserId(state.userId);
  }, [setModuleKey]);

  const closeAssign = useCallback(() => {
    if (inFlightRef.current) return;
    setAssignOpenUserId(null);
    setWriteErrorState(null);
    setSeatLimitUserId(null);
    setModuleKey("");
  }, [setModuleKey]);

  const assign = useCallback(async (): Promise<boolean> => {
    const state = latestRef.current;
    const rawKey =
      state.moduleKeyState?.userId === state.userId ? state.moduleKeyState.value : "";
    const key = rawKey.trim().toLowerCase();
    if (inFlightRef.current || !state.canAssign || !MODULE_KEY_PATTERN.test(key)) {
      return false;
    }
    inFlightRef.current = true;
    setIsSubmitting(true);
    setWriteErrorState(null);
    setSeatLimitUserId(null);
    try {
      await assignUserModule(state.userId, key);
      setModuleKey("");
      setAssignOpenUserId(null);
      reload();
      return true;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === SEAT_LIMIT_REACHED_CODE) {
        setSeatLimitUserId(state.userId);
      }
      setWriteErrorState({ userId: state.userId, value: normalized });
      return false;
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [reload, setModuleKey]);

  const unassign = useCallback(async () => {
    const state = latestRef.current;
    const activeRemoval =
      state.removalState?.userId === state.userId ? state.removalState.value : null;
    if (inFlightRef.current || !activeRemoval || !state.canRemove) {
      if (!state.canWrite) setRemovalState(null);
      return;
    }
    inFlightRef.current = true;
    setIsSubmitting(true);
    setWriteErrorState(null);
    try {
      await unassignUserModule(state.userId, activeRemoval.moduleKey);
      latestRef.current.removalState = null;
      setRemovalState(null);
      reload();
    } catch (error) {
      setWriteErrorState({ userId: state.userId, value: normalizeApiError(error) });
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [reload]);

  return {
    assignments: baselineUserId === userId ? assignments : [],
    isLoading,
    loadError,
    writeError,
    isSubmitting,
    isSeatLimitReached,
    reload,
    isAssignOpen: assignOpenUserId === userId && canWrite,
    openAssign,
    closeAssign,
    moduleKey,
    setModuleKey,
    isModuleKeyValid: MODULE_KEY_PATTERN.test(moduleKey.trim().toLowerCase()),
    assign,
    pendingRemoval,
    requestRemoval: (target: UserModuleAssignment | null) => {
      const state = latestRef.current;
      if (target && (inFlightRef.current || !state.canRemove)) return;
      setWriteErrorState(null);
      const scoped = target ? { userId: state.userId, value: target } : null;
      latestRef.current.removalState = scoped;
      setRemovalState(scoped);
    },
    cancelRemoval: () => {
      if (!inFlightRef.current) {
        latestRef.current.removalState = null;
        setRemovalState(null);
        setWriteErrorState(null);
      }
    },
    unassign,
  };
}
