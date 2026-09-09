import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { clearPersistedCommandAttempt, preparePersistedCommandAttempt, readPersistedCommandAttempt, type PersistedCommandAttempt } from "@/shared/api/persisted-command-recovery";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import { addonsApi } from "../api/addons.api";
import type { AddonCommand, priceBody } from "../lib/addon-contract";

export type AddonWrite = { type: "definition"; addonKey: string; command: AddonCommand }
  | { type: "pricing"; addonKey: string; addonId: string; body: ReturnType<typeof priceBody> };

/** Persist only hashes/IDs, never descriptions, configuration or request bodies. */
export function useAddonMutation(applicationKey: string, resourceKey: string, actorId: string) {
  const route = `/api/admin/core/v1/applications/${applicationKey}/addons`;
  const storageKey = `admin.addons.command:${actorId}:${applicationKey}:${resourceKey}`;
  const busy = useRef(false);
  const mounted = useRef(true);
  const lastWrite = useRef<AddonWrite | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PersistedCommandAttempt | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [hasRetry, setHasRetry] = useState(false);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) setPending(readPersistedCommandAttempt(storageKey, route)); });
    return () => { mounted.current = false; };
  }, [route, storageKey]);

  const submit = useCallback(async (write: AddonWrite) => {
    if (busy.current) return null;
    busy.current = true;
    setSubmitting(true); setError(null);
    try {
      const attempt = await preparePersistedCommandAttempt({ storageKey, route,
        intent: { actorId, applicationKey, write }, resource: { kind: write.type === "pricing" ? "PRICING_REPLACE" : write.command.kind, id: write.addonKey } });
      // This may be a retry of an earlier unknown outcome. Not dispatching this
      // attempt does not resolve that earlier command, so retain its journal.
      if (!mounted.current) return null;
      lastWrite.current = write;
      setHasRetry(true);
      setPending(attempt);
      const receipt = write.type === "pricing"
        ? await addonsApi.replacePrices(applicationKey, write.addonKey, write.addonId, write.body, attempt.idempotencyKey)
        : await addonsApi.command(applicationKey, write.addonKey, write.command, attempt.idempotencyKey);
      clearPersistedCommandAttempt(storageKey);
      lastWrite.current = null;
      if (!mounted.current) return null;
      setPending(null); setHasRetry(false);
      return receipt;
    } catch (cause) {
      const normalized = normalizeApiError(cause);
      if (shouldRotateWriteCommandKey(normalized)) {
        clearPersistedCommandAttempt(storageKey); lastWrite.current = null;
        if (mounted.current) setHasRetry(false);
      }
      if (mounted.current) { setPending(readPersistedCommandAttempt(storageKey, route)); setError(normalized); }
      return null;
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [actorId, applicationKey, route, storageKey]);
  const retry = useCallback(() => lastWrite.current ? submit(lastWrite.current) : Promise.resolve(null), [submit]);
  return { submit, retry, isSubmitting, pending, error, canRetry: pending !== null && hasRetry };
}
