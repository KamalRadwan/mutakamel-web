"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useUserModules(userId: string, enabled: boolean) {
  const [assignments, setAssignments] = useState<UserModuleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [moduleKey, setModuleKey] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<UserModuleAssignment | null>(null);
  /**
   * Seat exhaustion is an expected outcome of `POST /users/:id/modules`, behind
   * a PostgreSQL advisory lock — and it is a **422 `SEAT_LIMIT_REACHED`**, not
   * the 403 the plan predicted (`UserModulesService.assign`).
   */
  const [isSeatLimitReached, setIsSeatLimitReached] = useState(false);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      fetchUserModules(userId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setAssignments(result);
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

  const assign = useCallback(async () => {
    const key = moduleKey.trim().toLowerCase();
    if (!MODULE_KEY_PATTERN.test(key)) return;
    setIsSubmitting(true);
    setWriteError(null);
    setIsSeatLimitReached(false);
    try {
      await assignUserModule(userId, key);
      setModuleKey("");
      reload();
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.code === SEAT_LIMIT_REACHED_CODE) setIsSeatLimitReached(true);
      setWriteError(normalized);
    } finally {
      setIsSubmitting(false);
    }
  }, [moduleKey, reload, userId]);

  const unassign = useCallback(async () => {
    const target = pendingRemoval;
    if (!target) return;
    setIsSubmitting(true);
    setWriteError(null);
    try {
      await unassignUserModule(userId, target.moduleKey);
      setPendingRemoval(null);
      reload();
    } catch (error) {
      setPendingRemoval(null);
      setWriteError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingRemoval, reload, userId]);

  return {
    assignments,
    isLoading,
    loadError,
    writeError,
    isSubmitting,
    isSeatLimitReached,
    reload,
    moduleKey,
    setModuleKey,
    isModuleKeyValid: MODULE_KEY_PATTERN.test(moduleKey.trim().toLowerCase()),
    assign,
    pendingRemoval,
    requestRemoval: setPendingRemoval,
    cancelRemoval: () => setPendingRemoval(null),
    unassign,
  };
}
