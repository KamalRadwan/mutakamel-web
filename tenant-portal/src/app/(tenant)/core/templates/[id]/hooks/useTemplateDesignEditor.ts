"use client";

import type { DesignerNativeRuntime } from "../../designer-native-runtime";
import type { DesignerNativeSource } from "../../designer-native-context";
import type { TemplateOwnerAdmission } from "../../template-owner-admission";
import { fetchTemplateOwnerAdmission } from "../../template-owner-admission-api";
import { TEMPLATE_ADAPTER_KEYS } from "../../template-source-metadata";
import { useDesignerInteractionExit } from "./useDesignerInteractionExit";
import { useDesignerLocalSessions } from "./useDesignerLocalSessions";
import { useSalesQuotationOriginBinding } from "./useSalesQuotationOriginBinding";
import { useDesignerNodeCommands } from "./useDesignerNodeCommands";
import { useDesignerCommandState } from "./useDesignerCommandState";
import { useQuotationImageUpload } from "./useQuotationImageUpload";
import { useSalesDraftSaveRecovery } from "./useSalesDraftSaveRecovery";
import { editableQuotationText, useSalesDraftTypingRecovery } from "./useSalesDraftTypingRecovery";
import { salesDraftEditorOwnerKey } from "./sales-draft-typing-storage";
import { clearSalesDraftSave, readSalesDraftSave, retainSalesDraftSave, salesDraftSaveStorageKey } from "./sales-draft-save-storage";
import type { DesignerCommand } from "../../designer-command-store";
import type { ScopedTableRowUniquenessReader } from "../bindings/scoped-table-source";
import type { TemplateDesignDraftRefresh } from "../design/useTemplateDesignDefinition";
import { classifyDraftConflict, isLocalWriteFence, type DraftOwner, type SaveFlight, type BoundDraftIntent } from "./template-design-flight";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { supportsBasicSalesPageSetup } from "../../designer-page-host";
import { useTenantAuth } from "@/context/AuthContext";
import { subscribeToTenantAuthEvents } from "@/lib/auth/sessionCoordinator";
import { can } from "@/lib/auth/permission-scope";
import { useI18n } from "@/i18n/I18nContext";
import { getStoredTenantSessionMeta } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { requiresSameKeyRecovery } from "@/lib/api/outcomes";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { sha256 } from "@noble/hashes/sha2.js";
import { fetchTemplateDataSchema, fetchTemplateDraft, saveTemplateDraft, type TemplateDataSchema, type TemplateDraftDocument } from "../../template-design-api";
import { numericTemplateDraftPrecondition } from "../../template-draft-receipt";
import { fetchTemplateAssets, type TemplateAsset } from "../../template-assets-contract";
import { useTemplateDesignPreview } from "./useTemplateDesignPreview";
import { orderedEditorNodes, updateEditorNode, type EditorDocument } from "../../template-editor-model";
import { TEMPLATE_ASSETS_PERMISSION, TEMPLATE_READ_PERMISSION, TEMPLATE_UPDATE_PERMISSION, type TemplateDetail } from "../../templates-contract";
import { invalidCoreResponse, isMember } from "../../../contracts/core-page";
import { templateDesignFailure, templateDesignTarget } from "../../template-design-route";

const subscribeWithoutDraftRefresh = () => () => {};
const emptyDraftRefreshSnapshot = () => null;

export function useTemplateDesignEditor(template: TemplateDetail, canMutate: boolean, nativeRuntime?: DesignerNativeRuntime,
  draftRefresh?: TemplateDesignDraftRefresh) {
  const { t } = useI18n(); const copy = t.quotationPdf;
  const { authState, user, realtimeAuthGeneration } = useTenantAuth();
  const { type: scopeType, companyId, branchId } = template.scope;
  const target = scopeType === "TENANT" ? { tenantWide: true } : { companyId, ...(scopeType === "BRANCH" ? { branchId } : {}) };
  const canReadDraft = authState === "AUTHENTICATED" && Boolean(user?.id && realtimeAuthGeneration) &&
    can(user, TEMPLATE_READ_PERMISSION, target) && can(user, TEMPLATE_UPDATE_PERMISSION, target);
  const canManageAssets = template.manageAssets?.state === "ENABLED" && can(user, TEMPLATE_ASSETS_PERMISSION, target);
  const currentAssetGrant = useRef(false);
  useLayoutEffect(() => {
    currentAssetGrant.current = canManageAssets;
    return () => { currentAssetGrant.current = false; };
  }, [canManageAssets]);
  const ownerKey = salesDraftEditorOwnerKey(template, authState, user?.id, realtimeAuthGeneration, canReadDraft);
  const draftSource = useMemo(() => ({ documentType: template.documentType, outputChannel: template.outputChannel,
    layoutMode: template.layoutMode, dataSourceKey: template.dataSourceKey, locale: template.locale }),
    [template.documentType, template.outputChannel, template.layoutMode, template.dataSourceKey, template.locale]);
  const writeAccess = useRef(false);
  useLayoutEffect(() => {
    writeAccess.current = canMutate && canReadDraft;
    return () => { writeAccess.current = false; };
  }, [canMutate, canReadDraft]);
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  const owner = useMemo<DraftOwner>(() => ({ key: ownerKey, epoch }), [ownerKey, epoch]);
  const salesSaveKey = useMemo(() => template.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && canReadDraft
    ? salesDraftSaveStorageKey(ownerKey) : null, [ownerKey, canReadDraft, template.dataSourceKey]);
  const refreshRecovery = useSalesDraftSaveRecovery(owner, salesSaveKey);
  const readRefreshRecovery = refreshRecovery.read;
  const activeOwner = useRef<DraftOwner | null>(null);
  const readyDraft = useRef<TemplateDraftDocument | null>(null);
  const currentTableDetail = useRef<TemplateDetail | null>(null);
  const refreshAfterReload = useRef(false);
  useLayoutEffect(() => {
    currentTableDetail.current = template;
    return () => {
      currentTableDetail.current = null;
      draftRefresh?.cancel();
    };
  }, [template, draftRefresh]);
  const actorId = user?.id;
  const matchesTransport = useCallback((sessionId = getStoredTenantSessionMeta()?.sessionId) =>
    Boolean(sessionId && actorId) && realtimeAuthGeneration === `tenant:${sessionId}:${actorId}`,
    [actorId, realtimeAuthGeneration]);
  const isCurrentAuthority = useCallback(() =>
    canReadDraft && activeOwner.current === owner && owner.epoch === epochRef.current && matchesTransport(),
    [owner, matchesTransport, canReadDraft],
  );
  useLayoutEffect(() => {
    activeOwner.current = owner;
    const unsubscribe = subscribeToTenantAuthEvents(event => {
      const sameSession = Boolean(actorId) &&
        realtimeAuthGeneration === `tenant:${event.sessionId}:${actorId}`;
      if (event.kind === "session-ended" ? sameSession : !sameSession) {
        readyDraft.current = null;
        draftRefresh?.cancel();
        epochRef.current += 1;
        setEpoch(epochRef.current);
      }
    });
    return () => {
      unsubscribe();
      activeOwner.current = null;
      readyDraft.current = null;
      draftRefresh?.cancel();
    };
  }, [owner, actorId, realtimeAuthGeneration, draftRefresh]);
  const [draftState, setDraft] = useState<{ owner: DraftOwner; value: TemplateDraftDocument } | null>(null);
  const commands = useDesignerCommandState();
  const observeDefinitionDraft = useCallback((draft: TemplateDraftDocument, force: boolean) => {
    const detail = currentTableDetail.current;
    const session = getStoredTenantSessionMeta();
    if (!draftRefresh || !detail || detail.outputChannel !== "PRINT" || !session) return;
    const { sessionId, authorizationVersion } = session;
    const generation = commands.store.getSnapshot().generation;
    void draftRefresh.observe(detail, draft, () => {
      const live = getStoredTenantSessionMeta();
      return currentTableDetail.current === detail && readyDraft.current === draft && isCurrentAuthority() &&
        commands.store.getSnapshot().generation === generation &&
        live?.sessionId === sessionId && live.authorizationVersion === authorizationVersion;
    }, force);
  }, [commands.store, draftRefresh, isCurrentAuthority]);
  const nativeAuthoring = useRef<{ canEdit(): boolean; execute(next: EditorDocument, isCurrent?: () => boolean): boolean } | null>(null);
  const gestureToken = useRef<number | null>(null);
  const selectedId = commands.viewport.selectedId;
  const setSelectedId = (id: string | null) => !localSessions.has() && commands.store.setViewport({ selectedId: id });
  const [ownerSource, setOwnerSource] = useState<{ owner: DraftOwner; runtime: DesignerNativeRuntime; admission: TemplateOwnerAdmission } | null>(null);
  const [loadedNative, setLoadedNative] = useState<{ draft: TemplateDraftDocument; generation: number; admission: TemplateOwnerAdmission; source: DesignerNativeSource } | null>(null);
  const readyOwnerSource = useRef<TemplateOwnerAdmission | null>(null);
  const [schema, setSchema] = useState<TemplateDataSchema | null>(null);
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<DraftOwner | null>(null);
  const [savingFlight, setSavingFlight] = useState<SaveFlight | null>(null);
  const [fencedOwner, setFencedOwner] = useState<DraftOwner | null>(null);
  const [saveError, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [pendingState, setUnknown] = useState<BoundDraftIntent | null>(null);
  const pendingRef = useRef<typeof pendingState>(null);
  const [loadFailureState, setLoadFailure] = useState<{ owner: DraftOwner; reason: ReturnType<typeof templateDesignFailure> } | null>(null);
  const [assetsUnavailable, setAssetsUnavailable] = useState(false);
  const [reload, setReload] = useState(0);
  const inFlight = useRef<SaveFlight | null>(null);
  const loading = loadedOwner !== owner || fencedOwner === owner;
  const saving = savingFlight?.owner === owner;
  const unknown = fencedOwner !== owner && pendingState?.owner === owner ? pendingState.intent : null;
  const draft = !loading && draftState?.owner === owner ? draftState.value : null;
  const document = draft ? commands.document : null;
  const loadFailure = !loading && loadFailureState?.owner === owner ? loadFailureState.reason : null;
  const fixedAuthoring = useMemo(() => template.layoutMode === "FIXED_CANVAS" && template.documentType === "QUOTATION" &&
    template.outputChannel === "PRINT" && template.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && !!document &&
    validateTemplateDocumentModel(document).valid, [template.layoutMode, template.documentType, template.outputChannel, template.dataSourceKey, document]);
  const editable = (template.layoutMode !== "FIXED_CANVAS" || fixedAuthoring) && canMutate && canReadDraft && !!schema && !loading && !loadFailure;
  const guardedSaveSchema = template.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" &&
    schema?.draftSavePrecondition === "draft-schema" ? schema : null;
  const rolloverChecksum = scopeType === "COMPANY" ? guardedSaveSchema?.schemaChecksum ?? null : null;
  const { restore: restoreDraftTyping, discard: discardDraftTyping, restoreRollover: restoreRolloverDraftTyping } =
    useSalesDraftTypingRecovery(owner, salesSaveKey, commands.store, readyDraft, writeAccess, isCurrentAuthority,
      rolloverChecksum);
  const hasPending = saving || pendingState?.owner === owner || refreshRecovery.unresolved;
  const dirty = !!draft && commands.state.dirty;
  const localOwnerKey = JSON.stringify([owner.key, owner.epoch, draft?.draftId]);
  const { sessions: localSessions, pending: localPending, epoch: localSessionEpoch, discard: discardLocalChanges } = useDesignerLocalSessions(localOwnerKey, commands.state.generation);
  const interactionExit = useDesignerInteractionExit({ bridgeKey: localOwnerKey, generation: commands.state.generation }, () => isCurrentAuthority() && !!draft ? { bridgeKey: localOwnerKey, generation: commands.store.getSnapshot().generation } : null);
  const canReview = useCallback(() => {
    if (isCurrentAuthority()) return true;
    if (activeOwner.current === owner && canReadDraft) setFencedOwner(owner);
    return false;
  }, [owner, isCurrentAuthority, canReadDraft, setFencedOwner]);

  const { sample, emailSample, previewing, preview, clearSample } = useTemplateDesignPreview(template, draft, schema, owner, {
    blocked: dirty || hasPending || commands.state.gestureActive || localPending,
    current: canReview, ready: () => readyDraft.current === draft && !localSessions.has(), onError: setError, failure: copy.previewFailed,
  });
  // Direct storage changes can be observed before AuthContext rerenders.
  // Resume the same owner only after its transport identity is current again.
  useLayoutEffect(() => {
    if (fencedOwner !== owner || !isCurrentAuthority()) return;
    queueMicrotask(() => {
      if (!isCurrentAuthority()) return;
      setFencedOwner(current => current === owner ? null : current);
      if (loadedOwner !== owner) setReload(value => value + 1);
    });
  });

  const clearProtectedContent = useCallback(() => {
    readyDraft.current = null;
    draftRefresh?.cancel();
    readyOwnerSource.current = null; setOwnerSource(null);
    setLoadedNative(null);
    pendingRef.current = null;
    setDraft(null); commands.store.reset(null); gestureToken.current = null;
    setSchema(null); setAssets([]); clearSample(); setUnknown(null); setConflict(false);
  }, [commands.store, draftRefresh, clearSample, setDraft, setSchema, setAssets, setUnknown, setConflict, setOwnerSource, setLoadedNative]);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!canReadDraft) {
      clearProtectedContent();
      setLoadFailure({ owner, reason: "denied" });
      setLoadedOwner(owner);
      return;
    }
    if (!isCurrentAuthority()) {
      if (activeOwner.current === owner) setFencedOwner(owner);
      return;
    }
    clearProtectedContent();
    const pendingSave = readRefreshRecovery();
    setError(null); setLoadFailure(null); setAssetsUnavailable(false);
    try {
      const current = await fetchTemplateDraft(template.id, signal, template.dataSourceKey);
      if (signal.aborted || activeOwner.current !== owner) return;
      if (!isCurrentAuthority()) { setFencedOwner(owner); return; }
      if (current.templateId !== template.id || current.etag !== `"${current.revision}"`) invalidCoreResponse();
      const sourceGeneration = commands.store.getSnapshot().generation;
      const ownerHost = nativeRuntime && nativeRuntime.isCurrent() ? { pins: nativeRuntime.pins, canonicalJson: nativeRuntime.canonicalJson,
        isCurrent: () => !signal.aborted && isCurrentAuthority() && nativeRuntime.isCurrent() && commands.store.getSnapshot().generation === sourceGeneration } : null;
      const [dataSchema, assetPage, ownerAdmission] = await Promise.allSettled([
        fetchTemplateDataSchema(template.dataSourceKey, { type: scopeType, companyId, branchId }, signal),
        fetchTemplateAssets({ scope: "ALL_AUTHORIZED", status: "ACTIVE", sort: "createdAt:desc" }, signal),
        ownerHost && isMember(TEMPLATE_ADAPTER_KEYS, template.dataSourceKey)
          ? fetchTemplateOwnerAdmission(template.dataSourceKey, { type: scopeType, companyId, branchId }, ownerHost, signal) : Promise.resolve(null),
      ]);
      if (signal.aborted || activeOwner.current !== owner) return;
      if (!isCurrentAuthority()) { setFencedOwner(owner); return; }
      if ([dataSchema, assetPage].some(result => result.status === "rejected"
        && templateDesignFailure(result.reason) === "unavailable")) {
        setLoadFailure({ owner, reason: "unavailable" });
        return;
      }
      readyDraft.current = current;
      setDraft({ owner, value: current });
      commands.store.reset(current.editorDocument, draftSource);
      if (!pendingSave && dataSchema.status === "fulfilled") restoreDraftTyping(current);
      observeDefinitionDraft(current, refreshAfterReload.current);
      refreshAfterReload.current = false;
      if (dataSchema.status === "fulfilled") setSchema(dataSchema.value);
      if (dataSchema.status === "fulfilled" && ownerAdmission.status === "fulfilled" && ownerAdmission.value &&
        ownerAdmission.value.descriptorChecksum === dataSchema.value.schemaChecksum) {
        readyOwnerSource.current = ownerAdmission.value;
        if (nativeRuntime?.isCurrent()) {
          setOwnerSource({ owner, runtime: nativeRuntime, admission: ownerAdmission.value });
        }
      }
      if (assetPage.status === "fulfilled") {
        setAssets(assetPage.value.items.filter(asset => asset.status === "ACTIVE" &&
          (asset.definitionId === null || asset.definitionId === template.id)));
      } else {
        setAssetsUnavailable(true);
      }
    } catch (cause) {
      if (!signal.aborted && activeOwner.current === owner) {
        if (isCurrentAuthority()) setLoadFailure({ owner, reason: templateDesignFailure(cause) });
        else setFencedOwner(owner);
      }
    } finally {
      if (!signal.aborted && isCurrentAuthority()) setLoadedOwner(owner);
    }
  }, [owner, canReadDraft, isCurrentAuthority, scopeType, companyId, branchId, clearProtectedContent, readRefreshRecovery, restoreDraftTyping, commands.store, draftSource, template.id, template.dataSourceKey, setLoadFailure, setLoadedOwner, setFencedOwner, setError, setAssetsUnavailable, setDraft, setSchema, setAssets, setOwnerSource, nativeRuntime, observeDefinitionDraft]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load, reload]);

  function canEditCurrentDraft() {
    return editable && writeAccess.current && isCurrentAuthority() && !conflict && !hasPending &&
      !!draft && readyDraft.current === draft &&
      pendingRef.current?.owner !== owner && inFlight.current?.owner !== owner && !refreshRecovery.blocked();
  }

  const executeScoped = (command: DesignerCommand, isCurrent?: () => boolean) => {
    if (!canEditCurrentDraft()) return false;
    try {
      if (isCurrent && !isCurrent()) return false;
      const admitted = fixedAuthoring ? admitFixedCommand(commands.store.getSnapshot().document, command) : command;
      if (!admitted) { setError(copy.requestError); return false; }
      const changed = gestureToken.current === null ? commands.store.execute(admitted) : commands.store.updateGesture(gestureToken.current, admitted);
      setError(null); clearSample(); return changed;
    } catch { setError(copy.requestError); return false; }
  };
  const execute = (command: DesignerCommand) => !localSessions.has() && executeScoped(command);
  useLayoutEffect(() => {
    const authoring = {
      canEdit: () => canEditCurrentDraft() && !localSessions.hasOther("inspector"),
      execute: (next: EditorDocument, isCurrent?: () => boolean) => !localSessions.hasOther("inspector") && !commands.store.getSnapshot().gestureActive &&
        executeScoped({ kind: "EDIT_DOCUMENT", document: next }, isCurrent),
    };
    nativeAuthoring.current = authoring;
    return () => { if (nativeAuthoring.current === authoring) nativeAuthoring.current = null; };
  });
  const change = (next: EditorDocument) => {
    if (next !== document) execute({ kind: "EDIT_DOCUMENT", document: next });
  };
  const beginGesture = () => {
    if (canEditCurrentDraft() && !localSessions.has()) { gestureToken.current = commands.store.beginGesture(); return gestureToken.current; }
    return null;
  };
  const finishGesture = (commit: boolean) => {
    const token = gestureToken.current;
    gestureToken.current = null;
    if (token === null) return;
    if (commit && canEditCurrentDraft()) commands.store.commitGesture(token);
    else commands.store.cancelGesture(token);
  };
  useLayoutEffect(() => interactionExit.register("canonical", { read: () => commands.store.getSnapshot().gestureActive ? "active" : "inactive", cancel: () => finishGesture(false) }));
  useLayoutEffect(() => {
    if (!canMutate || !canReadDraft) {
      const token = gestureToken.current;
      gestureToken.current = null;
      if (token !== null) commands.store.cancelGesture(token);
    }
  }, [canMutate, canReadDraft, commands.store]);

  function retainIntent({ owner, intent, base, request }: BoundDraftIntent) {
    pendingRef.current = { owner, intent, base, request };
    setUnknown(pendingRef.current);
    setError(copy.unknownHint);
  }

  function isFlightAuthorityCurrent(flight: SaveFlight): boolean {
    return !flight.transportFenced && isCurrentAuthority() &&
      getStoredTenantSessionMeta()?.authorizationVersion === flight.authorizationVersion;
  }

  function adoptFlight(flight: SaveFlight): boolean {
    if (activeOwner.current !== owner || owner.epoch !== epochRef.current) return false;
    if (isFlightAuthorityCurrent(flight)) return true;
    retainIntent(flight);
    setFencedOwner(owner);
    return false;
  }

  function settleStoredSave(mutationId: string) {
    if (!salesSaveKey) return;
    const command = readSalesDraftSave(salesSaveKey);
    if (command && command !== "invalid" && command.mutationId === mutationId) clearSalesDraftSave(salesSaveKey, command);
  }

  function reloadCurrentDraft() {
    discardDraftTyping();
    readyDraft.current = null;
    refreshAfterReload.current = true;
    draftRefresh?.cancel();
    setLoadedOwner(null);
    setReload(value => value + 1);
  }

  function pinSavedDraft(saved: TemplateDraftDocument, clearRecovery?: () => boolean) {
    const admitted = commands.store.prepareReplacement(saved.editorDocument);
    if (clearRecovery && !clearRecovery()) return;
    readyDraft.current = saved;
    setDraft({ owner, value: saved });
    commands.store.markSaved(admitted);
    if (clearRecovery) restoreDraftTyping(saved);
    else discardDraftTyping();
    observeDefinitionDraft(saved, true);
  }

  const write = async (mode: "save" | "recover") => {
    if (localSessions.has() || !writeAccess.current || activeOwner.current !== owner || owner.epoch !== epochRef.current) return;
    const session = getStoredTenantSessionMeta();
    if (!session || !matchesTransport(session.sessionId)) {
      const flight = inFlight.current;
      if (flight?.owner === owner) flight.transportFenced = true;
      setFencedOwner(owner);
      return;
    }
    const unresolved = pendingRef.current?.owner === owner ? pendingRef.current : null;
    if (!editable || readyDraft.current !== draft || !draft || !document ||
      inFlight.current?.owner === owner || refreshRecovery.blocked() || commands.store.getSnapshot().gestureActive || conflict ||
      (mode === "save" ? !dirty || !!unresolved : !unresolved)) return;

    if (unresolved && (unresolved.base.templateId !== draft.templateId || unresolved.base.draftId !== draft.draftId ||
      unresolved.base.revision !== draft.revision || numericTemplateDraftPrecondition(unresolved.request.etag) !== draft.etag)) return;
    const descriptorChecksum = unresolved ? null : readSaveDescriptorChecksum();
    if (!unresolved && guardedSaveSchema && !descriptorChecksum) {
      if (!saveAuthority) setError(copy.draftSaveAuthorityUnavailable);
      return;
    }
    const request = unresolved?.request ?? Object.freeze({
      documentJson: JSON.stringify(commands.store.getSnapshot().document), mutationId: generateUUIDv7(),
      etag: descriptorChecksum ? `"draft-schema:${descriptorChecksum}:${draft.revision}"` : draft.etag,
    });
    const requestDocument = JSON.parse(request.documentJson) as EditorDocument;
    if (salesSaveKey && !unresolved) {
      try {
        if (!retainSalesDraftSave(salesSaveKey, draft, requestDocument, request.mutationId, request.etag)) {
          readRefreshRecovery();
          return;
        }
      } catch {
        setError(copy.requestError);
        return;
      }
    }
    const intent = unresolved?.intent ?? { document, etag: request.etag, mutationId: request.mutationId };
    const flight: SaveFlight = {
      owner, intent, request, base: { ...draft }, authorizationVersion: session.authorizationVersion, transportFenced: false,
    };
    inFlight.current = flight;
    setSavingFlight(flight);
    setError(null);
    try {
      const saved = await saveTemplateDraft(flight.base.templateId, requestDocument, request.etag, request.mutationId, {
        assertCurrent: () => {
          if (isFlightAuthorityCurrent(flight)) return;
          flight.transportFenced = true;
          throw new DOMException("Draft write authority changed.", "AbortError");
        },
      });
      if (!adoptFlight(flight)) return;
      if (saved.templateId !== flight.base.templateId || saved.draftId !== flight.base.draftId ||
        saved.revision <= flight.base.revision || saved.etag !== `"${saved.revision}"`) {
        retainIntent(flight);
        return;
      }
      pinSavedDraft(saved);
      settleStoredSave(request.mutationId);
      pendingRef.current = null;
      setUnknown(null);
    } catch (cause) {
      if (!adoptFlight(flight)) return;
      const failure = normalizeApiError(cause);
      const receipt = classifyDraftConflict(cause, flight.base.templateId);
      const stale = receipt === "stale";
      const unconfirmedConflict = template.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && receipt === "unconfirmed";
      const coreInFlight = failure.code === "CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT";
      // A replay admission denial or contradictory response cannot settle an
      // older unresolved request. Only a coherent owner receipt can do that.
      if (requiresSameKeyRecovery(failure) || coreInFlight || isLocalWriteFence(cause, failure.code) || unconfirmedConflict ||
        (unresolved && !stale)) {
        retainIntent(flight);
      } else if (templateDesignFailure(cause) !== "failed") {
        settleStoredSave(request.mutationId);
        clearProtectedContent();
        setLoadFailure({ owner, reason: templateDesignFailure(cause) });
      } else {
        settleStoredSave(request.mutationId);
        pendingRef.current = null;
        setUnknown(null);
        if (receipt === "schema-changed") {
          setConflict(false);
          setError(copy.draftSchemaChanged);
          return;
        }
        if (stale) {
          readyDraft.current = null;
          draftRefresh?.cancel();
        }
        setConflict(stale);
        setError(stale ? copy.conflict : copy.requestError);
      }
    } finally {
      if (inFlight.current === flight) inFlight.current = null;
      if (activeOwner.current) setSavingFlight(current => current === flight ? null : current);
    }
  };
  const canCheckRefreshedSave = () => !loading && !!draft && readyDraft.current === draft &&
    writeAccess.current && isCurrentAuthority() && !localSessions.has();
  const admission = ownerSource?.owner === owner && ownerSource.runtime === nativeRuntime ? ownerSource.admission : null;
  const generation = commands.state.generation;
  const nativeSource = admission && loadedNative?.admission === admission && loadedNative.draft === draft && loadedNative.generation === generation
    ? loadedNative.source : undefined;
  useEffect(() => {
    if (!nativeRuntime || !admission || !draft) return;
    const controller = new AbortController();
    const { signal } = controller;
    const currentSource = () => !signal.aborted && isCurrentAuthority() && nativeRuntime.isCurrent() && readyDraft.current === draft &&
      readyOwnerSource.current === admission && commands.store.getSnapshot().generation === generation;
    let timer: number | undefined;
    void (async () => {
      try {
        if (!currentSource()) return;
        const source = await nativeRuntime.createSource(admission, () => currentSource() ? admission : null,
          { bridgeKey: localOwnerKey, generation }, {
            draft, scope: { type: scopeType, companyId, branchId }, signal, isCurrent: currentSource,
            bridge: {
              read: () => { const state = commands.store.getSnapshot(); return currentSource() ? state : { ...state, document: null }; },
              context: () => ({ key: localOwnerKey, canRead: currentSource(), readOnly: !writeAccess.current }),
              canEdit: () => currentSource() && !!nativeAuthoring.current?.canEdit(),
              selection: () => commands.store.getViewport().selectedIds,
              execute: next => currentSource() && !!nativeAuthoring.current?.execute(next),
              executeScoped: (next, isCurrent) => currentSource() && !!nativeAuthoring.current?.execute(next, isCurrent),
              subscribe: commands.store.subscribe,
            },
          });
        if (!source || !currentSource() || !source.binding.currentIdentity()) return;
        setLoadedNative({ draft, generation, admission, source });
        // The opaque R10 lease owns its deadline. This retires the mounted UI;
        // native commands also verify currentness synchronously.
        timer = window.setInterval(() => {
          if (currentSource() && source.binding.currentIdentity()) return;
          window.clearInterval(timer);
          setLoadedNative(value => value?.source === source ? null : value);
        }, 250);
      } catch { /* Native qualification failure does not block the base editor. */ }
    })();
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [nativeRuntime, admission, draft, isCurrentAuthority, commands.store, generation, localOwnerKey, scopeType, companyId, branchId, canMutate]);
  const readScopedTableDraftBinding: ScopedTableRowUniquenessReader["readCurrentDraft"] = () => {
    const dataHost = nativeSource?.dataHost;
    const current = commands.store.getSnapshot();
    const saved = draftRefresh ? (draft && draftRefresh.read(template, draft)?.currentDraft) : template.currentDraft;
    if (currentTableDetail.current !== template || !dataHost || !draft || !saved || !admission || !nativeRuntime ||
        !canEditCurrentDraft() || localSessions.has() || !current.document || current.dirty || current.gestureActive ||
        current.generation !== generation || template.outputChannel !== "PRINT" ||
        draft.templateId !== template.id || draft.draftId !== saved.draftId || draft.revision !== saved.revision ||
        !Number.isSafeInteger(saved.revision) || saved.revision < 1 || saved.etag !== '"' + saved.revision + '"' || draft.etag !== saved.etag ||
        !/^[0-9a-f]{64}$/u.test(saved.contentChecksum)) return null;
    try {
      const target = templateDesignTarget(template.scope);
      const authority = dataHost.bridge.context();
      if (!target || !authority.canRead || authority.readOnly || authority.key !== localOwnerKey ||
          !isUUIDv7(authority.tenantId) || authority.companyId !== target.companyId ||
          !nativeRuntime.isCurrent() || nativeSource.binding.currentIdentity()?.fingerprint !== admission.fingerprint ||
          dataHost.readSourceFingerprint() !== admission.fingerprint || !dataHost.bridge.canEdit() ||
          dataHost.bridge.read() !== current) return null;
      const canonicalDraft = nativeRuntime.canonicalJson(draft.editorDocument);
      if (nativeRuntime.canonicalJson(current.document) !== canonicalDraft) return null;
      const checksum = Array.from(sha256(new TextEncoder().encode(canonicalDraft)), byte => byte.toString(16).padStart(2, "0")).join("");
      if (checksum !== saved.contentChecksum) return null;
      return Object.freeze({
        templateId: template.id, draftId: saved.draftId, revision: saved.revision, etag: saved.etag,
        contentChecksum: saved.contentChecksum, authorityKey: authority.key, tenantId: authority.tenantId,
        companyId: target.companyId, generation,
      });
    } catch { return null; }
  };
  const insertBound = (prepare: (current: EditorDocument, selection: readonly string[]) => EditorDocument | null, scope?: "rendered" | (() => boolean)): boolean => {
    const dataHost = nativeSource?.dataHost;
    const current = commands.store.getSnapshot();
    if (!dataHost || !current.document || current.gestureActive) return false;
    const ownerCanInsert = () => dataHost.bridge.canEdit() && dataHost.bridge.read() === current;
    if (!canEditCurrentDraft() || localSessions.has() || !ownerCanInsert()) return false;
    const selection = commands.store.getViewport().selectedIds;
    // Scoped commands belong to the private snapshot and selection that produced this render.
    if (scope && (current !== commands.state || selection !== commands.viewport.selectedIds ||
      commands.store.getSnapshot() !== current)) return false;
    const next = prepare(current.document, selection);
    if (!next) return false;
    if (scope) {
      const isCurrent = () => (typeof scope !== "function" || scope()) && ownerCanInsert() && canEditCurrentDraft() && !localSessions.has() &&
        commands.store.getSnapshot() === current && commands.store.getViewport().selectedIds === selection;
      return isCurrent() && dataHost.bridge.executeScoped?.(next, isCurrent) === true;
    }
    return commands.store.getSnapshot() === current && dataHost.bridge.execute(next);
  };
  const { store: tableStore, state: tableState, viewport: { selectedIds: tableSelection } } = commands;
  // Resolve the private document paired with this render's public clone and selection.
  const readCurrentScopedDocument = useCallback(() =>
    document && !tableState.gestureActive && tableSelection.length === 1 &&
      tableStore.getSnapshot() === tableState && tableStore.getViewport().selectedIds === tableSelection
      ? tableState.document : null,
    [document, tableStore, tableState, tableSelection]);
  // Readback can settle independently of the command store while the Ribbon derives its offer during render.
  useSyncExternalStore(draftRefresh?.subscribe ?? subscribeWithoutDraftRefresh,
    draftRefresh?.getSnapshot ?? emptyDraftRefreshSnapshot, emptyDraftRefreshSnapshot);
  const nodeCommands = useDesignerNodeCommands(document, selectedId, schema, assets, copy, () => commands.store.getSnapshot().document,
    change, execute, insertBound, readCurrentScopedDocument, nativeSource?.dataHost);
  const isCurrentSalesDraft = useCallback(() => currentTableDetail.current === template && readyDraft.current === draft &&
    isCurrentAuthority(), [template, draft, isCurrentAuthority]);
  const salesBinding = useSalesQuotationOriginBinding(template, canMutate && !nativeSource?.dataHost ? draft : null, localOwnerKey,
    commands.state.generation, commands.store, isCurrentSalesDraft,
    () => canEditCurrentDraft() && !localSessions.has() && !nativeSource?.dataHost,
    (next, isCurrent) => executeScoped({ kind: "EDIT_DOCUMENT", document: next }, isCurrent));
  const readRolloverChecksum = salesBinding.readSaveDescriptorChecksum;
  useLayoutEffect(() => {
    if (draft && editable && !hasPending && !localPending && rolloverChecksum &&
      readRolloverChecksum() === rolloverChecksum) restoreRolloverDraftTyping(draft, readRolloverChecksum);
  }, [draft, editable, hasPending, localPending, rolloverChecksum, readRolloverChecksum, restoreRolloverDraftTyping]);

  function readSaveDescriptorChecksum() {
    if (!guardedSaveSchema) return null;
    const { schemaChecksum } = guardedSaveSchema;
    const nativeMatches = admission && readyOwnerSource.current === admission &&
      admission.descriptorChecksum === schemaChecksum && nativeRuntime?.isCurrent();
    return nativeMatches || salesBinding.readSaveDescriptorChecksum() === schemaChecksum ? schemaChecksum : null;
  }
  const saveAuthority = editable && guardedSaveSchema && !readSaveDescriptorChecksum()
    ? salesBinding.saveObservationPending ? "waiting" : "unavailable"
    : null;
  const quotationText = document && selectedId && tableSelection.length === 1
    ? editableQuotationText(document, selectedId) : null;
  const updateQuotationText = (text: string) => {
    const current = readCurrentScopedDocument();
    if (!quotationText || !current) return;
    const node = editableQuotationText(current, quotationText.id);
    if (!node) return;
    const candidate = updateEditorNode(current, node.id, { props: { ...node.props, text } });
    if (validateTemplateDocumentModel(candidate).valid) execute({ kind: "EDIT_DOCUMENT", document: candidate });
  };
  const supportsQuotationImageUpload = canManageAssets && !nativeSource && supportsBasicSalesPageSetup(document) &&
    (document?.layoutMode === "FLOW_DOCUMENT" || document?.layoutMode === "HYBRID_DOCUMENT");
  const uploadBlocked = !editable || hasPending || localPending || conflict || commands.state.gestureActive;
  const assetAuthorization = getStoredTenantSessionMeta()?.authorizationVersion;
  const uploadOwnerIsCurrent = () => !uploadBlocked && currentAssetGrant.current &&
    currentTableDetail.current === template && canEditCurrentDraft() && !localSessions.has() &&
    assetAuthorization !== undefined && getStoredTenantSessionMeta()?.authorizationVersion === assetAuthorization &&
    !commands.store.getSnapshot().gestureActive;
  const quotationImageUpload = useQuotationImageUpload(draft && supportsQuotationImageUpload ? {
    ownerKey: JSON.stringify([localOwnerKey, assetAuthorization]),
    definitionId: template.id,
    draftRevision: draft.revision,
    disabled: uploadBlocked || assetAuthorization === undefined,
    isCurrent: uploadOwnerIsCurrent,
    accept: (asset: TemplateAsset) => {
      if (!uploadOwnerIsCurrent() || asset.definitionId !== template.id) return false;
      setAssets(current => [asset, ...current.filter(item => item.id !== asset.id)]);
      return true;
    },
  } : null);
  return {
    quotationImageUpload,
    readScopedTableDraftBinding,
    salesBinding,
    recoveryAuthority: { key: owner.key, epoch: owner.epoch, readable: canReadDraft && !!draft && !loading, writable: editable && !hasPending && !conflict, current: canReview },
    interactionBridge: {
      read: () => { const state = commands.store.getSnapshot(); return isCurrentAuthority() && draft ? state : { ...state, document: null }; },
      context: () => ({ key: localOwnerKey, canRead: isCurrentAuthority() && !!draft }),
      canEdit: () => canEditCurrentDraft() && !localSessions.has(),
      selection: () => commands.store.getViewport().selectedIds,
      select: (ids: readonly string[]) => !localSessions.has() && commands.store.setViewport({ selectedIds: ids }),
      execute: (next: EditorDocument) => !commands.store.getSnapshot().gestureActive && execute({ kind: "EDIT_DOCUMENT", document: next }),
      begin: beginGesture,
      update: (token: number, next: EditorDocument) => gestureToken.current === token && execute({ kind: "EDIT_DOCUMENT", document: next }),
      commit: (token: number) => { if (gestureToken.current === token) finishGesture(true); },
      cancel: (token: number) => { if (gestureToken.current === token) finishGesture(false); },
    },
    pageBridge: {
      context: () => ({ key: localOwnerKey, canRead: isCurrentAuthority() && !!draft }),
      canEdit: () => canEditCurrentDraft() && !localSessions.hasOther("pages"),
      execute: (next: EditorDocument) => !localSessions.hasOther("pages") && !commands.store.getSnapshot().gestureActive && executeScoped({ kind: "EDIT_DOCUMENT", document: next }),
    },
    nativeSource, bindingPaletteAvailable: !!nativeSource?.dataHost, commandStore: commands.store, localSessions, localPending, localSessionEpoch, discardLocalChanges, interactionExit,
    inspectorBridge: {
      read: () => { const state = commands.store.getSnapshot(); return isCurrentAuthority() && draft ? state : { ...state, document: null }; },
      context: () => ({ key: localOwnerKey, canRead: isCurrentAuthority() && !!draft }),
      canEdit: () => canEditCurrentDraft() && !localSessions.hasOther("inspector"),
      selection: () => commands.store.getViewport().selectedIds,
      select: (ids: readonly string[]) => !localSessions.has() && commands.store.setViewport({ selectedIds: ids }),
      execute: (next: EditorDocument) => !localSessions.hasOther("inspector") && !commands.store.getSnapshot().gestureActive && executeScoped({ kind: "EDIT_DOCUMENT", document: next }),
    },
    richTextBridge: {
      read: () => { const state = commands.store.getSnapshot(); return isCurrentAuthority() && draft ? state : { ...state, document: null }; },
      context: () => ({ key: localOwnerKey, canRead: isCurrentAuthority() && !!draft }),
      canEdit: () => canEditCurrentDraft() && !localSessions.hasOther("richText"),
      selection: () => commands.store.getViewport().selectedIds,
      execute: (next: EditorDocument) => !localSessions.hasOther("richText") && !commands.store.getSnapshot().gestureActive && executeScoped({ kind: "EDIT_DOCUMENT", document: next }),
    },
    t, editable, viewport: commands.viewport,
    setViewport: (patch: Parameters<typeof commands.store.setViewport>[0]) =>
      !(localSessions.has() && (patch.selectedId !== undefined || patch.selectedIds !== undefined)) && commands.store.setViewport(patch),
    beginGesture, commitGesture: () => finishGesture(true), cancelGesture: () => finishGesture(false), gestureActive: commands.state.gestureActive,
    setNodeFlags: (nodeId: string, flags: { locked?: boolean; hidden?: boolean }) => execute({ kind: "NODE_FLAGS", nodeId, ...flags }),
    loadFailure, assetsUnavailable: !loading && assetsUnavailable,
    draft, document, nodes: document ? orderedEditorNodes(document) : [], select: setSelectedId,
    schema: loading ? null : schema, assets: loading ? [] : assets, loading, saving,
    dirty, saveAuthority, error: loading ? null : saveError, conflict: !loading && conflict, unknown, hasPending,
    retrySaveVerification: saveAuthority === "unavailable" ? salesBinding.retrySaveVerification : undefined,
    discardRetainedTyping: discardDraftTyping,
    refreshedSave: !loading && refreshRecovery.unresolved ? {
      checking: refreshRecovery.checking,
      unconfirmed: refreshRecovery.unconfirmed,
      canCheck: refreshRecovery.canCheck && !!draft && canMutate,
      canDiscard: !!draft && canMutate && !refreshRecovery.checking,
      check: () => refreshRecovery.check(template.id, canCheckRefreshedSave, pinSavedDraft),
      discard: () => { if (canCheckRefreshedSave() && refreshRecovery.discard()) reloadCurrentDraft(); },
    } : null,
    sample: loading ? null : sample, emailSample: loading ? null : emailSample, closeSample: clearSample, previewing, preview,
    save: () => write("save"), recover: () => write("recover"),
    isCurrentAuthority: canReview,
    reload: () => {
      if (!localSessions.has() && isCurrentAuthority() && pendingRef.current?.owner !== owner && inFlight.current?.owner !== owner &&
        (!refreshRecovery.blocked() || !readyDraft.current)) reloadCurrentDraft();
    },
    canUndo: editable && !conflict && !hasPending && !localPending && commands.state.canUndo,
    canRedo: editable && !conflict && !hasPending && !localPending && commands.state.canRedo,
    undo: () => { if (canEditCurrentDraft() && !localSessions.has()) commands.store.undo(); },
    redo: () => { if (canEditCurrentDraft() && !localSessions.has()) commands.store.redo(); },
    change, editableQuotationText: quotationText, updateQuotationText, ...nodeCommands,
  };
}

function admitFixedCommand(document: EditorDocument | null, command: DesignerCommand): DesignerCommand | null {
  if (!document) return null;
  if (command.kind === "EDIT_DOCUMENT") return validateTemplateDocumentModel(command.document).valid ? command : null;
  if (command.kind !== "NODE_FLAGS") return null;
  const node = document.nodes[command.nodeId];
  if (!node) return null;
  const updated = { ...node, locked: command.locked ?? node.locked, hidden: command.hidden ?? node.hidden };
  const candidate = { ...document, nodes: { ...document.nodes, [node.id]: updated } };
  return validateTemplateDocumentModel(candidate).valid ? { kind: "EDIT_DOCUMENT", document: candidate } : null;
}
