"use client";
import { useCallback } from "react";
import type { AmbiguousMutationState } from "./idempotent-mutation";

export function usePriceBookWriteRecovery(command: AmbiguousMutationState, onResolved?: () => void) {
  return useCallback(() => {
    void Promise.resolve(command.retry()).then(completed => {
      if (completed) onResolved?.();
    });
  }, [command, onResolved]);
}
