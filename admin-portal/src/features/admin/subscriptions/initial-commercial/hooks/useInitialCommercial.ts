import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getAdminAuthHandling } from "@/lib/api/axiosClient";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll, adminCanAny } from "@/lib/auth/rbac";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { clearPersistedCommandAttempt, preparePersistedCommandAttempt, readPersistedCommandAttempt,
  type PersistedCommandAttempt } from "@/shared/api/persisted-command-recovery";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import type { InitialQuoteView, OriginalInitialSeedReceipt } from "../../initial-commercial-readers";
import { initialCommercialApi, initialSeedUrl } from "../initial-commercial.api";
import { buildInitialSeedRequest, creationCommercialFields, readInitialQuoteRequest, type InitialQuoteRequest, type InitialSeedRequest } from "../initial-commercial-request";

export type InitialCommercialContext = { intentId: string } & (
  | { purpose: "TENANT_CREATION" }
  | { purpose: "INITIAL_SEED"; targetTenantId: string; subscriptionId: string | null; subscriptionRevision: string | null }
);
type QuoteEvidence = { value: InitialQuoteView; request: InitialQuoteRequest; owner: string; fingerprint: string };
type SeedAttempt = { quote: InitialQuoteView; request: InitialSeedRequest; key: string; owner: string; storageKey: string; route: string; tenantId: string };
const localError = (errorCode: string): NormalizedApiError => ({ isNormalized: true, httpStatus: 400, errorCode, message: errorCode });

/** Quote ownership and exact seed recovery; installation authority stays with Core. */
export function useInitialCommercial(context: InitialCommercialContext, input: unknown) {
  const { user } = useAuth();
  const actorId = user?.id ?? "";
  const canQuote = Boolean(actorId) && adminCanAny(user, ["admin.catalog.read", "admin.tenants.create"]);
  const canSeed = Boolean(actorId) && adminCanAll(user, ["admin.subscriptions.create", "admin.subscriptions.critical"]);
  const tenantId = context.purpose === "INITIAL_SEED" ? context.targetTenantId : null;
  const parsed = useMemo(() => {
    try {
      const request = readInitialQuoteRequest(input);
      if (request.purpose !== context.purpose || (request.purpose === "INITIAL_SEED" && request.targetTenantId !== tenantId)) return null;
      return request;
    } catch { return null; }
  }, [input, context.purpose, tenantId]);
  const fingerprint = JSON.stringify(parsed);
  const owner = JSON.stringify([actorId, context, canQuote, canSeed, fingerprint]);
  const route = tenantId ? initialSeedUrl(tenantId) : "";
  const storageKey = `admin.initial-seed:${actorId}:${tenantId ?? "creation"}`;
  const [quote, setQuote] = useState<QuoteEvidence | null>(null);
  const [receipt, setReceipt] = useState<{ owner: string; value: OriginalInitialSeedReceipt } | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState<PersistedCommandAttempt | null>(null);
  const [journalOwner, setJournalOwner] = useState<string | null>(null);
  const journalReady = journalOwner === owner;
  const [retryIdentity, setRetryIdentity] = useState<{ owner: string; key: string } | null>(null);
  const epoch = useRef(0);
  const quoteSequence = useRef(0);
  const quoteAbort = useRef<AbortController | null>(null);
  const seedBusy = useRef(false);
  const lastSeed = useRef<SeedAttempt | null>(null);

  useLayoutEffect(() => {
    const generation = ++epoch.current;
    quoteAbort.current?.abort();
    queueMicrotask(() => {
      if (epoch.current !== generation) return;
      setQuote(null); setError(null); setQuoting(false); setSeeding(false); setExpired(false);
      setPending(route ? readPersistedCommandAttempt(storageKey, route) : null); setJournalOwner(owner);
    });
    return () => { epoch.current = generation + 1; quoteAbort.current?.abort(); };
  }, [owner, fingerprint, route, storageKey]);

  useEffect(() => {
    if (!quote) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(quote.value.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [quote]);

  const currentQuote = quote?.owner === owner && quote.fingerprint === fingerprint ? quote : null;
  const currentReceipt = receipt?.owner === owner ? receipt.value : null;
  const quoteIsExpired = expired;
  const currentSubscription = context.purpose === "INITIAL_SEED" && context.subscriptionId !== null;
  const locked = seeding || pending !== null || currentReceipt !== null;

  const requestQuote = async () => {
    if (!canQuote || !journalReady || locked || seedBusy.current || (quoteAbort.current && !quoteAbort.current.signal.aborted)) return;
    if (!parsed) { setError(localError("INITIAL_SELECTION_INVALID")); return; }
    const started = epoch.current;
    const sequence = ++quoteSequence.current;
    quoteAbort.current?.abort();
    const controller = new AbortController(); quoteAbort.current = controller;
    setQuoting(true); setError(null); setQuote(null); setExpired(false);
    try {
      const value = await initialCommercialApi.quote(parsed, controller.signal);
      if (epoch.current !== started || sequence !== quoteSequence.current || controller.signal.aborted) return;
      if (Date.parse(value.expiresAt) <= Date.now()) { setError(localError("INITIAL_QUOTE_EXPIRED")); return; }
      setQuote({ value, request: parsed, owner, fingerprint });
    } catch (cause) {
      const handling = getAdminAuthHandling(cause);
      if (epoch.current === started && sequence === quoteSequence.current && !controller.signal.aborted
        && handling !== "session-ended" && handling !== "permission-denied") setError(normalizeApiError(cause));
    } finally {
      if (quoteAbort.current === controller) quoteAbort.current = null;
      if (epoch.current === started && sequence === quoteSequence.current) setQuoting(false);
    }
  };

  const clearAttempt = (attempt: SeedAttempt) => {
    if (readPersistedCommandAttempt(attempt.storageKey, attempt.route)?.idempotencyKey === attempt.key) clearPersistedCommandAttempt(attempt.storageKey);
  };
  const sendSeed = async (retry: boolean) => {
    if (!canSeed || !tenantId || !journalReady || seedBusy.current || currentReceipt) return;
    if (!retry && (pending || currentSubscription || !currentQuote || quoteIsExpired || Date.parse(currentQuote.value.expiresAt) <= Date.now())) {
      setError(localError(pending ? "INITIAL_SEED_RECOVERY_REQUIRED" : "INITIAL_QUOTE_REQUIRED")); return;
    }
    if (retry && (!lastSeed.current || lastSeed.current.owner !== owner || lastSeed.current.key !== pending?.idempotencyKey)) return;
    const started = epoch.current;
    seedBusy.current = true; setSeeding(true); setError(null);
    let attempt: SeedAttempt | null = retry ? lastSeed.current : null;
    try {
      if (!attempt) {
        const evidence = currentQuote!;
        const request = buildInitialSeedRequest(evidence.value, evidence.request);
        const saved = await preparePersistedCommandAttempt({ storageKey, route,
          intent: { actorId, tenantId, intentId: context.intentId, request }, resource: { kind: "INITIAL_SEED", id: request.quoteId } });
        if (epoch.current !== started) return;
        attempt = { request, quote: evidence.value, key: saved.idempotencyKey, owner, storageKey, route, tenantId };
        lastSeed.current = attempt; setPending(saved); setRetryIdentity({ owner, key: attempt.key });
      }
      const value = await initialCommercialApi.seed(attempt.tenantId, attempt.request, attempt.quote, attempt.key);
      clearAttempt(attempt);
      if (epoch.current !== started) return;
      lastSeed.current = null; setRetryIdentity(null); setPending(null); setReceipt({ owner, value });
    } catch (cause) {
      const failure = normalizeApiError(cause);
      if (attempt && shouldRotateWriteCommandKey(failure)) {
        clearAttempt(attempt); lastSeed.current = null;
        if (epoch.current === started) setRetryIdentity(null);
      }
      if (epoch.current !== started) return;
      setPending(readPersistedCommandAttempt(storageKey, route)); setError(failure);
      if (shouldRotateWriteCommandKey(failure)) setQuote(null);
    } finally {
      seedBusy.current = false;
      if (epoch.current === started) setSeeding(false);
    }
  };

  return { canQuote, canSeed, validSelection: parsed !== null, quote: currentQuote?.value ?? null, receipt: currentReceipt,
    error, quoting, seeding, pending, journalReady, locked, quoteIsExpired, currentSubscription,
    canRetry: canSeed && pending !== null && retryIdentity?.owner === owner && retryIdentity.key === pending.idempotencyKey,
    creationFields: context.purpose === "TENANT_CREATION" && currentQuote && !quoteIsExpired
      ? creationCommercialFields(currentQuote.value, currentQuote.request) : null,
    requestQuote, seed: () => sendSeed(false), retrySeed: () => sendSeed(true) };
}
