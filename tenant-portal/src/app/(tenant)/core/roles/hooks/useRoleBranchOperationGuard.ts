"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Serializes actions synchronously and invalidates their callbacks on close. */
export function useRoleBranchOperationGuard() {
  const lifecycle = useRef({ mounted: false, operation: null as symbol | null });
  useLayoutEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    return () => { state.mounted = false; state.operation = null; };
  }, []);
  return useCallback(() => {
    const state = lifecycle.current;
    if (!state.mounted || state.operation !== null) return null;
    const token = Symbol();
    state.operation = token;
    return {
      isCurrent: () => state.mounted && state.operation === token,
      finish: () => { if (state.operation === token) state.operation = null; },
    };
  }, []);
}

export async function runRoleBranchOperation(
  begin: ReturnType<typeof useRoleBranchOperationGuard>,
  setBusy: (busy: boolean) => void,
  task: (isCurrent: () => boolean) => Promise<void>,
  onError: (error: unknown) => void,
) {
  const operation = begin();
  if (!operation) return;
  setBusy(true);
  try { await task(operation.isCurrent); }
  catch (error) { if (operation.isCurrent()) onError(error); }
  finally {
    if (operation.isCurrent()) setBusy(false);
    operation.finish();
  }
}
