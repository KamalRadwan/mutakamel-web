"use client";
import { useCallback, useEffect, useRef } from "react";
import type { TradePath } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { tradePatch, tradePost } from "../../trade-api";

interface Intent { fingerprint: string; key: string; actorIdentity: string; method: "POST" | "PATCH"; path: TradePath; body: unknown; headers: Record<string, string>; maxResponseBytes: number }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

/** Complete only after validating the success payload; an invalid 200 is still unresolved. */
export function useInventoryWriteIntent(actorIdentity = "") {
  const intent = useRef<Intent | null>(null);
  const execute = useCallback(async (method: "POST" | "PATCH", path: TradePath, body: unknown, headers: Record<string, string>, maxResponseBytes: number) => {
    const fingerprint = JSON.stringify(stable([actorIdentity, method, path, body, headers]));
    if (intent.current && intent.current.fingerprint !== fingerprint) throw new Error("INVENTORY_UNRESOLVED_WRITE");
    intent.current ??= { fingerprint, key: generateUUIDv7(), actorIdentity, method, path, body, headers, maxResponseBytes };
    const current = intent.current;
    try {
      return await (method === "POST" ? tradePost : tradePatch)(path, current.body, {
        headers: { ...current.headers, "x-idempotency-key": current.key }, maxResponseBytes,
      });
    } catch (error) {
      const normalized = normalizeApiError(error);
      // The server may still be processing this key. A changed form cannot replace it.
      if (normalized.status >= 400 && normalized.status < 500 && normalized.code !== "TRADE.IDEMPOTENCY.IN_FLIGHT") intent.current = null;
      throw error;
    }
  }, [actorIdentity]);
  const canRetry = useCallback((path: TradePath, headers: Record<string, string>) => {
    const current = intent.current;
    return Boolean(current && current.actorIdentity === actorIdentity && current.path === path && JSON.stringify(stable(current.headers)) === JSON.stringify(stable(headers)));
  }, [actorIdentity]);
  const retry = useCallback((path: TradePath, headers: Record<string, string>) => {
    const current = intent.current;
    if (!current || !canRetry(path, headers)) return Promise.reject(new Error("INVENTORY_UNRESOLVED_WRITE"));
    return execute(current.method, current.path, current.body, current.headers, current.maxResponseBytes);
  }, [canRetry, execute]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (intent.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return {
    post: useCallback((path: TradePath, body: unknown, headers: Record<string, string>, maxResponseBytes = 40_000) => execute("POST", path, body, headers, maxResponseBytes), [execute]),
    patch: useCallback((path: TradePath, body: unknown, headers: Record<string, string>, maxResponseBytes = 40_000) => execute("PATCH", path, body, headers, maxResponseBytes), [execute]),
    complete: useCallback(() => { intent.current = null; }, []),
    hasPending: useCallback(() => intent.current !== null, []),
    canRetry,
    retry,
  };
}
