"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUuidV7 } from "../../trade-advanced-validation";
import { tradeGet } from "../../trade-api";
import { parsePriceBookVersionDetail, priceBookVersionPath, type PriceBookVersionDetail, type PriceBookVersionTestReport } from "../pricing-contract";
import { hydrateVersionDraftFromDetail, type PriceBookVersionDraft } from "../version-draft";

interface Params {
  versionId: string | null;
  actorId?: string;
  expectedBookId?: string;
  canRead: boolean;
  isResolved: boolean;
  headers: Record<string, string>;
  onResetTransient: () => void;
}
interface LoadOptions { preserveLocalDraft?: boolean; preserveTestReport?: boolean; signal?: AbortSignal }

export function useVersionLoader({ versionId, actorId, expectedBookId, canRead, isResolved, headers, onResetTransient }: Params) {
  const validId = Boolean(versionId && isUuidV7(versionId));
  const scopeKey = useMemo(() => JSON.stringify([versionId, actorId, headers, canRead, isResolved, expectedBookId]),
    [versionId, actorId, headers, canRead, isResolved, expectedBookId]);
  const activeKey = useRef<string | null>(scopeKey);
  const seq = useRef(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [detail, setDetail] = useState<PriceBookVersionDetail | null>(null);
  const [draft, setDraft] = useState<PriceBookVersionDraft | null>(null);
  const [baselineJson, setBaselineJson] = useState("");
  const [isLoading, setIsLoading] = useState(validId);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [testReport, setTestReport] = useState<PriceBookVersionTestReport | null>(null);

  useLayoutEffect(() => {
    activeKey.current = scopeKey;
    seq.current += 1;
    return () => { activeKey.current = null; seq.current += 1; };
  }, [scopeKey]);

  const loadVersion = useCallback(async (targetId: string | null, options?: LoadOptions): Promise<PriceBookVersionDetail | null> => {
    if (activeKey.current !== scopeKey || targetId !== versionId || options?.signal?.aborted) return null;
    if (!targetId || !isUuidV7(targetId) || !canRead || !isResolved) {
      setDetail(null); setDraft(null); setBaselineJson(""); setTestReport(null);
      setLoadedKey(scopeKey); setError(null); setIsLoading(false);
      return null;
    }
    const request = ++seq.current;
    const current = () => activeKey.current === scopeKey && seq.current === request && !options?.signal?.aborted;
    setIsLoading(true); setError(null);
    try {
      const result = await tradeGet(priceBookVersionPath(targetId), {
        signal: options?.signal, headers, maxResponseBytes: 5_000_000,
      });
      const parsed = parsePriceBookVersionDetail(result.data);
      if (!current()) return null;
      if (parsed.version.id !== targetId || (expectedBookId && parsed.book.id !== expectedBookId)) throw new Error("INVALID_PRICING_RESPONSE");
      // A conflict comparison must not advance the revision behind retained local edits.
      if (!options?.preserveLocalDraft) {
        setDetail(parsed);
        const hydrated = hydrateVersionDraftFromDetail(parsed);
        setDraft(hydrated); setBaselineJson(JSON.stringify(hydrated));
        if (!options?.preserveTestReport || parsed.latestTestEvidence?.report) setTestReport(parsed.latestTestEvidence?.report ?? null);
      }
      setLoadedKey(scopeKey);
      return parsed;
    } catch (err) {
      if (current()) { setError(normalizeApiError(err)); setLoadedKey(scopeKey); }
      return null;
    } finally {
      if (current()) setIsLoading(false);
    }
  }, [scopeKey, versionId, canRead, isResolved, headers, expectedBookId]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      onResetTransient();
      void loadVersion(versionId, { signal: controller.signal });
    });
    return () => controller.abort();
  }, [versionId, loadVersion, onResetTransient]);

  const adoptDetail = useCallback((next: PriceBookVersionDetail) => {
    if (activeKey.current !== scopeKey || next.version.id !== versionId) return;
    setDetail(next);
    const hydrated = hydrateVersionDraftFromDetail(next);
    setDraft(hydrated); setBaselineJson(JSON.stringify(hydrated));
    setLoadedKey(scopeKey); setError(null);
    setTestReport(next.latestTestEvidence?.report ?? null);
  }, [scopeKey, versionId]);

  const visible = loadedKey === scopeKey;
  const isCurrentScope = useCallback(() => activeKey.current === scopeKey, [scopeKey]);
  return {
    scopeKey, isCurrentScope, validId, detail: visible ? detail : null, draft: visible ? draft : null,
    setDraft, baselineJson: visible ? baselineJson : "", isLoading: Boolean(canRead && isResolved && validId && (!visible || isLoading)),
    error: visible ? error : null, testReport: visible ? testReport : null,
    setTestReport, loadVersion, adoptDetail,
  };
}
