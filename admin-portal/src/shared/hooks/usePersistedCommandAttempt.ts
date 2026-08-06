"use client";

import { useCallback, useState } from "react";
import {
  clearPersistedCommandAttempt,
  preparePersistedCommandAttempt,
  readPersistedCommandAttempt,
  type PersistedCommandAttempt,
  type PersistedCommandResource,
} from "@/shared/api/persisted-command-recovery";

export function usePersistedCommandAttempt(storageKey: string, route: string) {
  const [pendingAttempt, setPendingAttempt] =
    useState<PersistedCommandAttempt | null>(() =>
      readPersistedCommandAttempt(storageKey, route),
    );

  const prepare = useCallback(
    async (intent: unknown, resource: PersistedCommandResource) => {
      const attempt = await preparePersistedCommandAttempt({
        storageKey,
        route,
        intent,
        resource,
      });
      setPendingAttempt(attempt);
      return attempt.idempotencyKey;
    },
    [route, storageKey],
  );

  const clear = useCallback(() => {
    clearPersistedCommandAttempt(storageKey);
    setPendingAttempt(null);
  }, [storageKey]);

  return { pendingAttempt, prepare, clear };
}
