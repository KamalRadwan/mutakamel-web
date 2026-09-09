import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { uuid7 } from "@/shared/api/commercial-contract";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { sha256CanonicalJson } from "@/shared/api/persisted-command-recovery";
import { shouldRotateWriteCommandKey } from "@/shared/api/write-command-recovery";
import type { SubscriptionCommercial } from "@/features/admin/tenant-workspace/billing/model/subscription-commercial";
import { commercialChangeApi } from "../commercial-change.api";
import { commercialDraftRequest, initialCommercialTargets, type ApplicationTarget } from "../commercial-change-draft";
import { emptyCommercialJournal, newPreparationJournal, readCommercialJournal, saveCommercialJournal, type CommercialJournal } from "../commercial-change-journal";
import type { CommercialApplyReceipt, CommercialOperationReceipt, CommercialPreview } from "../commercial-change-readers";
import { readCommercialRecoveryRequest, type CommercialRecoveryRequest } from "../commercial-change-request";
import { useCommercialCatalogue } from "./useCommercialCatalogue";

export type CommercialChangeWorkspaceProps = { source: SubscriptionCommercial; lang: "ar" | "en"; onCommitted: () => void | Promise<void> };
export function useCommercialChangeSessionKey(source: SubscriptionCommercial) {
  const { user } = useAuth();
  return JSON.stringify([user?.id, user?.isSuperAdmin, [...(user?.permissions ?? [])].sort(), source.subscription.tenantId, source.subscription.id]);
}
export function useCommercialChangeWorkspace({ source, onCommitted }: CommercialChangeWorkspaceProps) {
  const { user } = useAuth();
  const actor = user?.id ?? "";
  const canRead = Boolean(actor) && adminCanAll(user, ["admin.subscriptions.read"]);
  const canPrepare = Boolean(actor) && adminCanAll(user, ["admin.subscriptions.update"]);
  const canApply = canPrepare && adminCanAll(user, ["admin.subscriptions.critical"]);
  const canReadApplications = Boolean(actor) && adminCanAll(user, ["admin.applications.read"]);
  const canReadCatalogue = Boolean(actor) && adminCanAll(user, ["admin.catalog.read"]);
  const [baseline, setBaseline] = useState(source);
  const [targets, setTargets] = useState(() => initialCommercialTargets(source));
  const [journal, setJournal] = useState<CommercialJournal>(emptyCommercialJournal);
  const [journalReady, setJournalReady] = useState(false);
  const [operation, setOperation] = useState<CommercialOperationReceipt | null>(null);
  const [preview, setPreview] = useState<CommercialPreview | null>(null);
  const [receipt, setReceipt] = useState<CommercialApplyReceipt | null>(null);
  const [historicalReceipt, setHistoricalReceipt] = useState<CommercialApplyReceipt | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("");
  const [operationReference, setOperationReference] = useState("");
  const [receiptReference, setReceiptReference] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const current = useRef(true);
  const running = useRef(false);
  const retained = useRef(journal);
  const errorRef = useRef<HTMLDivElement>(null);
  const lastNotified = useRef<string | null>(null);
  const storageKey = `admin.commercial-change:${actor}:${source.subscription.tenantId}:${source.subscription.id}`;
  const catalogue = useCommercialCatalogue(canReadApplications, canReadCatalogue);
  const request = useMemo(() => commercialDraftRequest(baseline, targets), [baseline, targets]);
  const labels = Object.fromEntries(targets.flatMap(item => [[item.selectionKey, item.name], ...item.addons.map(addon => [addon.selectionKey, `${item.name} · ${addon.name}`]) ]));

  useLayoutEffect(() => {
    current.current = true;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { const saved = readCommercialJournal(storageKey); retained.current = saved; setJournal(saved); setJournalReady(true); }
      catch (cause) { setError(normalizeApiError(cause)); }
    });
    return () => { active = false; current.current = false; };
  }, [storageKey]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, Date.parse(preview.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [preview]);
  useEffect(() => {
    if (!receipt || lastNotified.current === receipt.previewId) return;
    lastNotified.current = receipt.previewId;
    void onCommitted();
  }, [receipt, onCommitted]);

  const save = (value: CommercialJournal) => { saveCommercialJournal(storageKey, value); retained.current = value; if (current.current) setJournal(value); };
  const run = async (work: () => Promise<void>) => {
    if (running.current || !journalReady) return;
    running.current = true; setBusy(true); setError(null);
    try { await work(); }
    catch (cause) { if (current.current) setError(normalizeApiError(cause)); }
    finally { running.current = false; if (current.current) setBusy(false); }
  };
  const acceptOperation = (value: CommercialOperationReceipt) => {
    if (!current.current) return;
    setOperation(previous => previous?.operationId === value.operationId && BigInt(previous.operationRevision) > BigInt(value.operationRevision) ? previous : value);
  };
  const terminal = operation?.state === "COMMITTED" || operation?.state === "ABORTED";
  const draftLocked = !journalReady || busy || Boolean(journal.request || journal.preparationId || operation);
  const sourceChanged = source.subscriptionRevision !== (journal.request?.expectedSubscriptionRevision ?? baseline.subscriptionRevision);
  const lifecycleAllowsChange = source.subscription.status === "TRIAL" || source.subscription.status === "ACTIVE";

  const sendPending = async (recoveryReason = reason) => {
    const saved = retained.current;
    const pending = saved.pending;
    if (!pending || !canPrepare || ((pending.kind === "APPLY" || pending.kind === "RECOVER") && !canApply)) return;
    try {
      if (pending.kind === "PREPARE") {
        const result = await commercialChangeApi.prepare(source.subscription.id, saved.request!, pending.key);
        save({ ...saved, preparationId: result.operationId, pending: null });
        acceptOperation(result);
      } else if (pending.kind === "PREVIEW") {
        const result = await commercialChangeApi.preview(source.subscription.id, { ...saved.request!, preparationId: saved.preparationId! }, pending.key);
        save({ ...saved, previewKey: pending.key, previewId: result.previewId, pending: null });
        if (current.current) { setPreview(result); setReviewed(false); setExpired(Date.parse(result.expiresAt) <= Date.now()); }
      } else if (pending.kind === "APPLY") {
        // Restore original evidence through the same preview key after a reload.
        const evidence = preview?.previewId === saved.previewId ? preview : await commercialChangeApi.preview(source.subscription.id,
          { ...saved.request!, preparationId: saved.preparationId! }, saved.previewKey!);
        if (evidence.previewId !== saved.previewId || !current.current) return;
        const result = await commercialChangeApi.apply(source.subscription.id, evidence, pending.key);
        save({ ...saved, pending: null });
        if (current.current) { setPreview(evidence); setReceipt(result); setReviewed(false); }
      } else {
        const recovery = pending.recovery!;
        const reasonHash = await sha256CanonicalJson(recoveryReason.trim());
        if (!current.current) return;
        if (reasonHash !== recovery.reasonHash) throw new Error("PENDING_COMMAND_INTENT_MISMATCH");
        const body = readCommercialRecoveryRequest({ expectedOperationRevision: recovery.expectedOperationRevision, action: recovery.action, reason: recoveryReason.trim() });
        const result = await commercialChangeApi.recover({ tenantId: source.subscription.tenantId, operationId: saved.preparationId! }, body, pending.key);
        save({ ...saved, pending: null }); acceptOperation(result);
        if (current.current) { setPreview(null); setReviewed(false); setReason(""); }
      }
    } catch (cause) {
      const failure = normalizeApiError(cause);
      if (shouldRotateWriteCommandKey(failure)) {
        save({ ...saved, pending: null, ...(pending.kind === "PREPARE" ? { request: null } : {}),
          ...(pending.kind === "PREVIEW" || pending.kind === "APPLY" ? { previewKey: null, previewId: null } : {}) });
        if (current.current) { setPreview(null); setReviewed(false); }
      }
      throw cause;
    }
  };
  const prepare = () => run(async () => {
    if (!canPrepare || draftLocked || !request || sourceChanged || !lifecycleAllowsChange) return;
    save(newPreparationJournal(request, generateUUIDv7()));
    await sendPending();
  });
  const price = (restore = false) => run(async () => {
    const saved = retained.current;
    if (!canPrepare || saved.pending || !saved.preparationId || !saved.request || terminal || receipt) return;
    if (!restore && (sourceChanged || operation?.state !== "READY")) return;
    const key = restore ? saved.previewKey : generateUUIDv7();
    if (!key) return;
    save({ ...saved, pending: { kind: "PREVIEW", key, recovery: null } });
    setPreview(null); setReviewed(false); await sendPending();
  });
  const apply = () => run(async () => {
    const saved = retained.current;
    if (!canApply || saved.pending || !preview || preview.previewId !== saved.previewId || !reviewed || expired || !preview.financial.canApply
      || sourceChanged || terminal || receipt || Date.parse(preview.expiresAt) <= Date.now()) return;
    save({ ...saved, pending: { kind: "APPLY", key: generateUUIDv7(), recovery: null } });
    await sendPending();
  });
  const fetchReceipt = async (previewId: string, preparationId?: string) => {
    const result = await commercialChangeApi.getReceipt({ subscriptionId: source.subscription.id, previewId, preparationId });
    const saved = retained.current;
    const resolvesCurrent = result.projection.preparationId === (saved.preparationId ?? operation?.operationId);
    if (current.current) {
      if (resolvesCurrent) { setReceipt(result); setReviewed(false); }
      else setHistoricalReceipt(result);
    }
    // A verified original receipt resolves an ambiguous apply without another write.
    if (saved.previewId === result.previewId && saved.pending?.kind === "APPLY") save({ ...saved, pending: null });
  };
  const refreshOperation = () => run(async () => {
    if (!canRead) return;
    const saved = retained.current;
    if (saved.request && !saved.preparationId) return;
    const operationId = uuid7(saved.preparationId ?? operation?.operationId ?? operationReference.trim());
    const result = await commercialChangeApi.getOperation({ tenantId: source.subscription.tenantId, operationId,
      ...(saved.preparationId ? { preparationId: saved.preparationId } : {}) });
    acceptOperation(result);
    if (!current.current) return;
    if (result.committedReceiptRef) await fetchReceipt(result.committedReceiptRef, result.operationId);
  });
  const recover = (action: CommercialRecoveryRequest["action"]) => run(async () => {
    const saved = retained.current;
    if (!canApply || saved.pending || !operation || !reason.trim()) return;
    const body = readCommercialRecoveryRequest({ expectedOperationRevision: operation.operationRevision, action, reason: reason.trim() });
    const reasonHash = await sha256CanonicalJson(body.reason);
    if (!current.current) return;
    save({ ...saved, preparationId: operation.operationId, pending: { kind: "RECOVER", key: generateUUIDv7(),
      recovery: { action, expectedOperationRevision: body.expectedOperationRevision, reasonHash } } });
    await sendPending(body.reason);
  });
  const reset = () => {
    if (busy || !journalReady || journal.pending || ((journal.preparationId || operation) && !terminal && !receipt)) return;
    if (receipt && BigInt(source.subscriptionRevision) < BigInt(receipt.subscriptionRevision)) return;
    try {
      save(emptyCommercialJournal()); setBaseline(source); setTargets(initialCommercialTargets(source));
      setOperation(null); setPreview(null); setReceipt(null); setReviewed(false); setExpired(false); setError(null);
    } catch (cause) { setError(normalizeApiError(cause)); }
  };
  const updateTarget = (key: string, update: Partial<ApplicationTarget>) => {
    if (!draftLocked) setTargets(items => items.map(item => item.selectionKey === key ? { ...item, ...update } : item));
  };
  const chooseApplication = (application: { id: string; key: string }) => {
    if (draftLocked || catalogue.loading) return;
    setSelectedTier(targets.find(item => item.applicationId === application.id)?.tierId ?? "");
    void catalogue.chooseApplication(application);
  };
  const useTier = () => {
    const application = catalogue.selected;
    const tier = catalogue.tiers.find(item => item.id === selectedTier);
    if (draftLocked || !application || !tier) return;
    const existing = targets.find(item => item.applicationId === application.id);
    if (existing) updateTarget(existing.selectionKey, { tierId: tier.id, tierName: tier.name, removed: false });
    else {
      const candidate = catalogue.applications.find(item => item.id === application.id);
      if (!candidate || targets.filter(item => !item.removed).length >= 100) return;
      setTargets(items => [...items, { selectionKey: generateUUIDv7(), applicationId: candidate.id, key: candidate.key,
        name: candidate.name, tierId: tier.id, tierName: tier.name, seats: 1, removed: false, addons: [] }]);
    }
  };
  const addonParent = targets.find(item => item.applicationId === catalogue.selected?.id && !item.removed);
  const definition = catalogue.detail?.published;
  const addonAvailable = Boolean(addonParent && catalogue.detail?.ownerRegistrationAvailable && catalogue.detail.lifecycleStatus === "ACTIVE"
    && !catalogue.detail.deleted && definition && !definition.revokedAt && (definition.mode === "ALL_ACTIVE" || definition.tierIds.includes(addonParent.tierId))
    && !targets.some(item => item.addons.some(addon => addon.addonId === catalogue.detail?.id)));
  const addAddon = () => {
    if (draftLocked || !addonAvailable || !addonParent || !catalogue.detail || !definition) return;
    updateTarget(addonParent.selectionKey, { addons: [...addonParent.addons, { selectionKey: generateUUIDv7(), addonId: catalogue.detail.id,
      name: catalogue.detail.name, definitionVersionId: definition.id, seats: 1, removed: false }] });
  };
  return { targets, updateTarget, request, journal, journalReady, operation, preview, receipt, historicalReceipt, error, errorRef, busy, expired, reviewed,
    setReviewed, reason, setReason, operationReference, setOperationReference, receiptReference, setReceiptReference,
    canRead, canPrepare, canApply, canReadApplications, canReadCatalogue, catalogue, draftLocked, sourceChanged, lifecycleAllowsChange, labels, terminal,
    selectedTier, setSelectedTier, chooseApplication, useTier, addonAvailable, addAddon,
    prepare, price, apply, recover, reset, refreshOperation, retry: () => run(() => sendPending()),
    readReceipt: () => run(async () => { if (canRead) await fetchReceipt(uuid7(receiptReference.trim())); }) };
}
