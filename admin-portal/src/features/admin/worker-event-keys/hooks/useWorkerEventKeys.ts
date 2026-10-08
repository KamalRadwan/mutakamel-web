import { useCallback, useEffect, useRef, useState } from "react";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import { workerEventKeysApi } from "../api";
import type { AdoptWorkerKey, ConfiguredWorkerKey, WorkerEventKey } from "../contract";

// The view remounts this hook when the authenticated owner or permissions change.
export function useWorkerEventKeys(canRead: boolean, canManage: boolean) {
  const [rows, setRows] = useState<WorkerEventKey[]>([]);
  const [loading, setLoading] = useState(canRead);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [currentKey, setCurrentKey] = useState<ConfiguredWorkerKey | null>(null);
  const [configError, setConfigError] = useState<NormalizedApiError | null>(null);
  const [intent, setIntent] = useState<{ dto: AdoptWorkerKey; key: string } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [receipt, setReceipt] = useState<WorkerEventKey | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!canRead) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError(null);
    setConfigError(null);
    setCurrentKey(null);
    const [registry, configured] = await Promise.allSettled([
      workerEventKeysApi.list(controller.signal), workerEventKeysApi.configured(controller.signal),
    ]);
    if (!mounted.current || controller.signal.aborted) return;
    if (registry.status === "fulfilled") setRows(registry.value);
    else setLoadError(normalizeApiError(registry.reason));
    if (configured.status === "fulfilled") setCurrentKey(configured.value.find((key) => key.trustSlot === "ACTIVE") ?? null);
    else setConfigError(normalizeApiError(configured.reason));
    setLoading(false);
  }, [canRead]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    return () => { disposed = true; mounted.current = false; request.current?.abort(); };
  }, [refresh]);
  useEffect(() => { if (mutationError) errorRef.current?.focus(); }, [mutationError]);
  const review = () => {
    if (!canRead || !canManage || busy.current || confirmationOpen) return;
    if (unknown && intent) { setConfirmationOpen(true); return; }
    if (loading || configError || !currentKey) return;
    setReceipt(null);
    setIntent({ dto: { trustSlot: "ACTIVE", expectedIssuer: currentKey.issuer,
      expectedKeyId: currentKey.keyId, expectedPublicKeyFingerprint: currentKey.publicKeyFingerprint }, key: generateUUIDv7() });
    setConfirmationOpen(true);
  };
  const confirm = async () => {
    if (!canRead || !canManage || !intent || busy.current) return;
    busy.current = true;
    setPending(true);
    setMutationError(null);
    setReceipt(null);
    try {
      const result = await workerEventKeysApi.adopt(intent.dto, intent.key);
      if (!mounted.current) return;
      setReceipt(result);
      setUnknown(false);
      setIntent(null);
      void refresh();
    } catch (error) {
      if (!mounted.current) return;
      const normalized = normalizeApiError(error);
      const retain = !shouldRotateWriteCommandKey(normalized);
      setMutationError(normalized);
      setUnknown(retain);
      if (!retain) { setIntent(null); void refresh(); }
    } finally {
      busy.current = false;
      if (mounted.current) { setPending(false); setConfirmationOpen(false); }
    }
  };
  return { rows, loading, loadError, refresh, currentKey, configError, errorRef, review, confirm,
    intent, confirmationOpen, pending, unknown, mutationError, receipt,
    closeConfirmation: () => { if (!busy.current) setConfirmationOpen(false); } };
}
