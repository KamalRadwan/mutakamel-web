"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { generateUUIDv7 } from "@/lib/uuid";
import { parseAcceptedResponse, type OutboundEmailAccepted } from "../outbound-email-contract";

export interface EmailWriteResult {
  accepted: OutboundEmailAccepted | null;
  replayed: boolean;
  error: NormalizedApiError | null;
}

interface Intent {
  path: string;
  body: Record<string, unknown>;
  key: string;
  scope: string;
}

// Gateway create/retry are domain-idempotent but transport NEVER retries.
// Keep one frozen body/key until its result is known; only an explicit user
// reconciliation may replay that same intent.
export function useOutboundEmailWrite(scope: string, canWrite: boolean) {
  const current = useRef({ scope, canWrite });
  useLayoutEffect(() => { current.current = { scope, canWrite }; }, [scope, canWrite]);
  const intent = useRef<Intent | null>(null);
  const pending = useRef(false);
  const complete = useRef(false);
  const [isPending, setPending] = useState(false);
  const [stateScope, setStateScope] = useState(scope);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    intent.current = null;
    pending.current = false;
    complete.current = false;
    queueMicrotask(() => {
      if (current.current.scope === scope && !pending.current && !intent.current) {
        setStateScope(scope); setPending(false); setUncertain(false); setError(null);
      }
    });
    return () => { if (current.current.scope === scope) current.current = { scope: "", canWrite: false }; };
  }, [scope]);

  async function execute(target: Intent): Promise<EmailWriteResult> {
    if (pending.current || complete.current || !current.current.canWrite || target.scope !== current.current.scope) {
      return { accepted: null, replayed: false, error: null };
    }
    pending.current = true;
    setStateScope(target.scope);
    setPending(true);
    setError(null);
    try {
      const response = await axiosClient.post<unknown>(target.path, target.body, {
        cache: "no-store", maxResponseBytes: 512 * 1024,
        nonReplayable: true, headers: { "x-idempotency-key": target.key },
      });
      if (current.current.scope !== target.scope) return { accepted: null, replayed: false, error: null };
      const accepted = parseAcceptedResponse(response.data);
      complete.current = true;
      setUncertain(false);
      return { accepted, replayed: isIdempotentReplay(response.headers), error: null };
    } catch (failure) {
      if (current.current.scope !== target.scope) return { accepted: null, replayed: false, error: null };
      const normalized = normalizeApiError(failure);
      const unknown = normalized.status === 0 || normalized.status >= 500 ||
        normalized.code === "GW.IDEM.IN_FLIGHT" || normalized.code === "IDEMPOTENCY_REQUEST_PROCESSING";
      setUncertain(unknown);
      setError(normalized);
      if (!unknown) intent.current = null;
      return { accepted: null, replayed: false, error: normalized };
    } finally {
      if (current.current.scope === target.scope) {
        pending.current = false;
        setPending(false);
      }
    }
  }

  function submit(path: string, body: Record<string, unknown>) {
    if (intent.current || pending.current || complete.current || !current.current.canWrite) {
      return Promise.resolve<EmailWriteResult>({ accepted: null, replayed: false, error: null });
    }
    const target = { path, body, key: generateUUIDv7(), scope: current.current.scope };
    intent.current = target;
    return execute(target);
  }

  return {
    isPending: stateScope === scope && isPending,
    uncertain: stateScope === scope && uncertain,
    error: stateScope === scope ? error : null,
    isBlocked: () => pending.current || complete.current || intent.current !== null,
    submit,
    reconcile: () => intent.current ? execute(intent.current) : Promise.resolve<EmailWriteResult>({ accepted: null, replayed: false, error: null }),
    clear: () => {
      if (pending.current || (intent.current && !complete.current)) return false;
      intent.current = null;
      complete.current = false;
      setUncertain(false);
      setError(null);
      return true;
    },
  };
}
