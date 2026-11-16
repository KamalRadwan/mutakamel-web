"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import type { TradeResult } from "../../trade-api";
import { isAmbiguousWriteError, type AmbiguousMutationState } from "./idempotent-mutation";

interface Command<Action extends string> {
  scopeKey: string;
  action: Action;
  operation: string;
  key: string;
  send: (key: string) => Promise<TradeResult>;
  correlationId?: string;
}
interface Options<Action extends string> {
  scopeKey: string;
  onSuccess: (action: Action, response: TradeResult) => Promise<void>;
  onRejected: (action: Action, error: NormalizedApiError) => Promise<void> | void;
}

/** A write's captured body/headers survive ambiguity; subsequent reads are separate. */
export function usePricingMutation<Action extends string>({ scopeKey, onSuccess, onRejected }: Options<Action>) {
  const [pending, setPending] = useState<Action | null>(null);
  const [ambiguous, setAmbiguous] = useState<AmbiguousMutationState | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [errorAction, setErrorAction] = useState<Action | null>(null);
  const unresolved = useRef(new Map<string, Command<Action>>());
  const running = useRef(new Map<string, Command<Action>>());
  const activeScope = useRef<string | null>(scopeKey);
  const handlers = useRef({ onSuccess, onRejected });
  useLayoutEffect(() => {
    activeScope.current = scopeKey;
    handlers.current = { onSuccess, onRejected };
    return () => { activeScope.current = null; };
  }, [scopeKey, onSuccess, onRejected]);

  const execute = useCallback(async function executeCommand(command: Command<Action>): Promise<boolean> {
    if (running.current.has(command.scopeKey) || activeScope.current !== command.scopeKey) return false;
    running.current.set(command.scopeKey, command);
    setPending(command.action);
    setError(null);
    setErrorAction(null);
    let response: TradeResult;
    try {
      response = await command.send(command.key);
    } catch (err) {
      const normalized = normalizeApiError(err);
      const current = activeScope.current === command.scopeKey;
      const recoveringUnknown = unresolved.current.has(command.scopeKey);
      if (isAmbiguousWriteError(normalized) || recoveringUnknown) {
        command.correlationId = normalized.correlationId;
        unresolved.current.set(command.scopeKey, command);
        if (current) setAmbiguous({
          intentName: command.action, operation: command.operation, idempotencyKey: command.key,
          correlationId: command.correlationId, retry: () => executeCommand(command),
        });
        if (recoveringUnknown && !isAmbiguousWriteError(normalized) && current) {
          setError(normalized); setErrorAction(command.action);
          try { await handlers.current.onRejected(command.action, normalized); }
          catch { /* A later rejection cannot disprove the original unknown write. */ }
        }
      } else {
        unresolved.current.delete(command.scopeKey);
        if (current) {
          setAmbiguous(null); setError(normalized); setErrorAction(command.action);
          try { await handlers.current.onRejected(command.action, normalized); }
          catch { /* Keep the original rejection if a follow-up read is unavailable. */ }
        }
      }
      running.current.delete(command.scopeKey);
      if (activeScope.current === command.scopeKey) setPending(null);
      return false;
    }
    unresolved.current.delete(command.scopeKey);
    // A confirmed write followed by a failed refresh must never become a retryable write.
    if (activeScope.current === command.scopeKey) {
      setAmbiguous(null);
      try {
        await handlers.current.onSuccess(command.action, response);
      } catch (err) {
        if (activeScope.current === command.scopeKey) setError(normalizeApiError(err));
      }
    }
    running.current.delete(command.scopeKey);
    if (activeScope.current === command.scopeKey) setPending(null);
    return activeScope.current === command.scopeKey;
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const command = unresolved.current.get(scopeKey);
      setPending(running.current.get(scopeKey)?.action ?? null);
      setError(null);
      setErrorAction(null);
      setAmbiguous(command ? {
        intentName: command.action, operation: command.operation, idempotencyKey: command.key,
        correlationId: command.correlationId, retry: () => execute(command),
      } : null);
    });
    return () => { cancelled = true; };
  }, [scopeKey, execute]);

  const run = useCallback((action: Action, operation: string, send: Command<Action>["send"]): Promise<boolean> => {
    if (unresolved.current.has(scopeKey) || running.current.has(scopeKey)) return Promise.resolve(false);
    return execute({ scopeKey, action, operation, send, key: generateUUIDv7() });
  }, [scopeKey, execute]);

  const blockedNow = useCallback(() => unresolved.current.has(scopeKey) || running.current.has(scopeKey), [scopeKey]);
  const clearError = useCallback(() => { setError(null); setErrorAction(null); }, []);
  return { pending, ambiguous, error, errorAction, clearError, blockedNow, isBlocked: pending !== null || ambiguous !== null, run };
}
