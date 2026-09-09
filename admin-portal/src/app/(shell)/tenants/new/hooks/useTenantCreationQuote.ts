import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAdminAuthHandling } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { tenantRegistrationApi } from "../api/tenant-registration.api";
import type { TenantBillingCycle, TenantSubscriptionLine, TenantSubscriptionQuote } from "../types";

export function useTenantCreationQuote({ owner, lines, billingCycle, enabled }: {
  owner: string; lines: readonly TenantSubscriptionLine[]; billingCycle: TenantBillingCycle; enabled: boolean;
}) {
  const [evidence, setEvidence] = useState<{ owner: string; quote: TenantSubscriptionQuote } | null>(null);
  const [failure, setFailure] = useState<{ owner: string; error: NormalizedApiError } | null>(null);
  const [loadingOwner, setLoadingOwner] = useState<string | null>(null);
  const [expiredQuoteId, setExpiredQuoteId] = useState<string | null>(null);
  const scope = useRef(owner);
  const request = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    scope.current = owner;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setEvidence(null); setFailure(null); setLoadingOwner(null); setExpiredQuoteId(null);
    });
    return () => { active = false; request.current?.abort(); };
  }, [owner]);
  useEffect(() => {
    if (!evidence || evidence.owner !== owner) return;
    const timer = setTimeout(() => setExpiredQuoteId(evidence.quote.quoteId), Math.max(0, Date.parse(evidence.quote.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [evidence, owner]);
  const error = failure?.owner === owner ? failure.error : null;
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const quote = evidence?.owner === owner ? evidence.quote : null;
  const expired = quote !== null && expiredQuoteId === quote.quoteId;
  const load = async () => {
    if (!enabled || (request.current && !request.current.signal.aborted)) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoadingOwner(owner); setFailure(null); setEvidence(null);
    try {
      const quote = await tenantRegistrationApi.quote(lines, billingCycle, controller.signal);
      if (scope.current === owner && !controller.signal.aborted) {
        setExpiredQuoteId(Date.parse(quote.expiresAt) <= Date.now() ? quote.quoteId : null);
        setEvidence({ owner, quote });
      }
    } catch (cause) {
      const handling = getAdminAuthHandling(cause);
      if (scope.current === owner && !controller.signal.aborted && handling !== "session-ended" && handling !== "permission-denied") setFailure({ owner, error: normalizeApiError(cause) });
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (scope.current === owner) setLoadingOwner(null);
      }
    }
  };
  return { quote, expired, canCreate: quote !== null && !expired, loading: loadingOwner === owner, error, errorRef, load };
}
