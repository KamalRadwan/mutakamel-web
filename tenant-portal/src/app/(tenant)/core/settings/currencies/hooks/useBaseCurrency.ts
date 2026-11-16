"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBaseCurrency, type Currency } from "../currency-contract";
import { normalizeCurrencyQueryError } from "./currency-errors";

export type BaseCurrencyStatus = "loading" | "ready" | "unknown";

interface UseBaseCurrencyOptions {
  authFenceKey: string;
  enabled: boolean;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Reads the workspace's current default currency via `isDefault=true`
 * independently of the table's active search, status/default filters, or page.
 *
 * Keeps an explicit `"unknown"` status on transport/contract failure so rate
 * labels and confirmation dialogs never fabricate `"EGP"` or guess from
 * filtered rows, while clearing default evidence across actor/scope changes or
 * authoritative `403` denials.
 */
export function useBaseCurrency({ authFenceKey, enabled }: UseBaseCurrencyOptions) {
  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedEnabled, setTrackedEnabled] = useState(enabled);
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null);
  const [baseStatus, setBaseStatus] = useState<BaseCurrencyStatus>("loading");
  const [isBaseLoading, setIsBaseLoading] = useState(enabled);
  const activeLoadRef = useRef<AbortController | null>(null);
  const latestLoadIdRef = useRef(0);
  const latestAuthFenceRef = useRef(authFenceKey);
  const mountedRef = useRef(true);

  if (trackedAuthKey !== authFenceKey || trackedEnabled !== enabled) {
    setTrackedAuthKey(authFenceKey);
    setTrackedEnabled(enabled);
    setBaseCurrency(null);
    setBaseStatus("loading");
    setIsBaseLoading(enabled);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
  }, [authFenceKey]);

  const reloadBaseCurrency = useCallback(async (): Promise<void> => {
    activeLoadRef.current?.abort();
    if (!mountedRef.current) return;
    if (!enabled) {
      activeLoadRef.current = null;
      latestLoadIdRef.current += 1;
      setBaseCurrency(null);
      setBaseStatus("loading");
      setIsBaseLoading(false);
      return;
    }

    const startedFence = authFenceKey;
    const controller = new AbortController();
    activeLoadRef.current = controller;
    const requestId = ++latestLoadIdRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      activeLoadRef.current === controller &&
      latestLoadIdRef.current === requestId &&
      latestAuthFenceRef.current === startedFence;

    setIsBaseLoading(true);
    try {
      const currentDefault = await fetchBaseCurrency(controller.signal);
      if (!isCurrent()) return;
      setBaseCurrency(currentDefault);
      setBaseStatus("ready");
    } catch (error) {
      if (!isCurrent() || isAbortError(error)) return;
      const normalized = normalizeCurrencyQueryError(error);
      setBaseCurrency(null);
      setBaseStatus(normalized.status === 403 ? "loading" : "unknown");
    } finally {
      if (isCurrent()) setIsBaseLoading(false);
    }
  }, [authFenceKey, enabled]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reloadBaseCurrency();
    });
    return () => {
      cancelled = true;
      latestLoadIdRef.current += 1;
      activeLoadRef.current?.abort();
      activeLoadRef.current = null;
    };
  }, [reloadBaseCurrency]);

  return {
    baseCurrency,
    baseStatus,
    isBaseLoading,
    reloadBaseCurrency,
  };
}
