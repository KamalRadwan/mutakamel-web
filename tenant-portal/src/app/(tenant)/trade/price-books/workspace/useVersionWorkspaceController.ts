"use client";

import { useCallback, useMemo, useRef, useState, type SetStateAction } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useConnectivity, useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { isUuidV7 } from "../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import { isTradeReplay, tradeDelete, tradeGet, tradeIfMatch, tradePatch, tradePost, type TradeResult } from "../../trade-api";
import {
  POLICY_PUBLISH_PERMISSION, PRICING_MANAGE_PERMISSION, PRICING_READ_PERMISSION,
  RETIRE_REASON_MAX_LENGTH, SOLO_OWNER_APPROVAL_NOTES_MAX_LENGTH,
  parsePriceBookVersionDiff, parsePriceBookVersionTestReport, priceBookVersionActionPath,
  priceBookVersionDiffPath, priceBookVersionPath, type PriceBookVersionDetail, type PriceBookVersionDiff,
} from "../pricing-contract";
import { pricingFormMessage, pricingMessage } from "../pricing-messages";
import { buildUpdatePriceBookVersionRequest, detectVersionDraftConflicts, hydrateVersionDraftFromDetail, type PriceBookVersionDraft } from "../version-draft";
import { isStaleVersionError, type StaleConflictSnapshot } from "./idempotent-mutation";
import { usePricingMutation } from "./usePricingMutation";
import { useVersionLoader } from "./useVersionLoader";

type VersionAction = "save" | "test" | "publish" | "retire" | "delete";
export type VersionPendingAction = VersionAction | null;
interface Options {
  versionId: string | null;
  expectedBookId?: string;
  onParentMutated?: () => Promise<void> | void;
  onVersionDeleted?: (deletedId: string) => void;
}

export function useVersionWorkspaceController({ versionId, expectedBookId, onParentMutated, onVersionDeleted }: Options) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const isOffline = useConnectivity().status === "offline";
  const { user, authState, realtimeAuthGeneration } = useTenantAuth();
  const scope = useTradeScope("COMPANY", null);
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, PRICING_READ_PERMISSION);
  const canManage = hasTradePermission(scope.permissions, scope.isTenantOwner, PRICING_MANAGE_PERMISSION);
  const canPublishGrant = hasTradePermission(scope.permissions, scope.isTenantOwner, POLICY_PUBLISH_PERMISSION);
  const [supersedesVersionId, setSupersedesVersionId] = useState("");
  const [soloOwnerAttestation, setSoloOwnerAttestation] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [diffResult, setDiffResult] = useState<PriceBookVersionDiff | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [replayNotice, setReplayNotice] = useState<string | null>(null);
  const [staleConflict, setStaleConflict] = useState<StaleConflictSnapshot<PriceBookVersionDraft, PriceBookVersionDetail> | null>(null);
  const staleRevision = useRef(false);
  const confirmedWriteAwaitingRead = useRef(false);
  const diffSequence = useRef(0);
  const resetTransient = useCallback(() => {
    setSupersedesVersionId(""); setSoloOwnerAttestation(false); setApprovalNotes("");
    setDiffResult(null); setIsDiffLoading(false); setReplayNotice(null); setStaleConflict(null);
    staleRevision.current = false; confirmedWriteAwaitingRead.current = false; diffSequence.current += 1;
  }, []);
  const actorScope = JSON.stringify([user?.id, realtimeAuthGeneration, scope.permissions, scope.isTenantOwner]);
  const loader = useVersionLoader({ versionId, actorId: actorScope, expectedBookId, canRead, isResolved: scope.isResolved, headers: scope.headers, onResetTransient: resetTransient });
  const { detail, draft, setDraft, baselineJson, loadVersion, adoptDetail, isCurrentScope } = loader;
  const isDirty = Boolean(draft && baselineJson && JSON.stringify(draft) !== baselineJson);
  const currencyCode = detail?.book.currencyCode;
  const conflictReport = useMemo(() => draft ? detectVersionDraftConflicts(draft, currencyCode) : null, [draft, currencyCode]);

  const onRejected = useCallback(async (_action: VersionAction, error: NormalizedApiError) => {
    if (isStaleVersionError(error) && draft) {
      staleRevision.current = true;
      const latestServer = await loadVersion(versionId, { preserveLocalDraft: true });
      if (isCurrentScope()) setStaleConflict({ retainedDraft: draft, latestServer });
    } else if (!toast.outcomeFromApi(error)) {
      toast.error(t.tradeCommon.actionFailed, pricingMessage(error, t) ?? error.message);
    }
  }, [draft, loadVersion, versionId, isCurrentScope, toast, t]);

  const onSuccess = useCallback(async (action: VersionAction, response: TradeResult) => {
    if (action !== "delete") confirmedWriteAwaitingRead.current = true;
    const replay = isTradeReplay(response.headers);
    setReplayNotice(replay ? t.tradePricing.replayAlreadyCompletedNotice : null);
    if (action === "test") {
      let report;
      try { report = parsePriceBookVersionTestReport(response.data); }
      catch {
        toast.error(t.tradePricing.testFailedTitle, t.tradeCommon.actionFailed);
        if (await loadVersion(versionId)) confirmedWriteAwaitingRead.current = false;
        return;
      }
      loader.setTestReport(report);
      if (report.passed) toast.success(t.tradeCommon.savedTitle, t.tradePricing.testPassed);
      else toast.warning(t.tradePricing.testFailedTitle, t.tradePricing.errorTestFailed);
    } else {
      const message = { save: t.tradePricing.versionSaved, publish: t.tradePricing.versionPublished,
        retire: t.tradePricing.versionRetired, delete: t.tradePricing.versionDeleted }[action];
      toast.success(t.tradeCommon.savedTitle, replay ? t.tradeCommon.replayedDescription : message);
      if (action === "save" || action === "publish") { setSoloOwnerAttestation(false); setApprovalNotes(""); setSupersedesVersionId(""); }
    }
    if (action !== "delete" && await loadVersion(versionId, { preserveTestReport: action === "test" })) confirmedWriteAwaitingRead.current = false;
    if (!isCurrentScope()) return;
    await onParentMutated?.();
    if (action === "delete" && versionId && isCurrentScope()) onVersionDeleted?.(versionId);
  }, [t, loader, toast, loadVersion, versionId, isCurrentScope, onParentMutated, onVersionDeleted]);
  const mutationScopeKey = JSON.stringify([versionId, user?.id, scope.headers[COMPANY_SCOPE_HEADER]]);
  const mutation = usePricingMutation<VersionAction>({ scopeKey: mutationScopeKey, onSuccess, onRejected });
  const error = loader.error;
  const ready = Boolean(detail && scope.isResolved && !loader.isLoading && !error && mutation.error?.status !== 403 && authState === "AUTHENTICATED");
  const available = ready && !isOffline && !mutation.isBlocked && !staleConflict;
  const isEditableStatus = detail?.version.status === "DRAFT" || detail?.version.status === "TESTED";
  const isMakerSameAsActor = Boolean(user?.id && detail?.version.createdByUserId === user.id);
  const soloEligible = Boolean(detail?.soloOwnerGovernanceEligible);
  const evidence = detail?.latestTestEvidence;
  // The backend projects only the current checksum's evidence; legacy projections may omit its hash.
  const savedEvidenceMatchesChecksum = Boolean(evidence && (!evidence.contentHash || evidence.contentHash === detail?.version.checksum));
  const publishDisabledReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!canPublishGrant) reasons.push(t.tradePricing.publishPermissionRequired);
    if (!ready) reasons.push(t.tradePricing.publishRefreshRequired);
    if (mutation.isBlocked || staleConflict) reasons.push(t.tradePricing.publishActionPending);
    if (isDirty) reasons.push(t.tradePricing.unsavedChangesBadge);
    if (detail?.version.status !== "TESTED") reasons.push(t.tradePricing.publishTestedRequired);
    if (!evidence?.passed || !savedEvidenceMatchesChecksum) reasons.push(t.tradePricing.publishEvidenceRequired);
    if (!user?.id) reasons.push(t.tradePricing.publishIdentityRequired);
    if (isMakerSameAsActor && !soloEligible) reasons.push(t.tradePricing.publishCheckerRequired);
    else if (isMakerSameAsActor && !soloOwnerAttestation) reasons.push(t.tradePricing.publishAttestationRequired);
    return reasons;
  }, [canPublishGrant, ready, mutation.isBlocked, staleConflict, isDirty, detail?.version.status, evidence?.passed, savedEvidenceMatchesChecksum, user?.id, isMakerSameAsActor, soloEligible, soloOwnerAttestation, t.tradePricing]);
  const canTest = Boolean(available && canManage && isEditableStatus && !isDirty);
  const canPublish = Boolean(available && publishDisabledReasons.length === 0);
  const canRetire = Boolean(available && canPublishGrant && (detail?.version.status === "PUBLISHED" || detail?.version.status === "SCHEDULED"));
  const canDeleteDraft = Boolean(available && canManage && detail?.version.status === "DRAFT");

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!detail || !draft || !available || !canManage || !isEditableStatus || staleRevision.current || conflictReport?.hasBlockingErrors) return false;
    try {
      const body = buildUpdatePriceBookVersionRequest(draft);
      const baseline = hydrateVersionDraftFromDetail(detail);
      // Editing another field must preserve the server timestamp's seconds and offset.
      if (draft.effectiveFrom === baseline.effectiveFrom) body.effectiveFrom = detail.version.effectiveFrom;
      if (draft.effectiveTo === baseline.effectiveTo) body.effectiveTo = detail.version.effectiveTo;
      const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.version.version) };
      return mutation.run("save", t.tradePricing.saveDraftChanges, key => tradePatch(priceBookVersionPath(detail.version.id), body, { headers: { ...headers, "x-idempotency-key": key } }));
    } catch (err) { toast.error(t.tradeCommon.actionFailed, pricingFormMessage(err, t)); return false; }
  }, [detail, draft, available, canManage, isEditableStatus, conflictReport, scope.headers, mutation, t, toast]);

  const test = useCallback(async () => {
    if (!detail || !canTest || staleRevision.current) return;
    const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.version.version) };
    await mutation.run("test", t.tradePricing.runTest, key => tradePost(priceBookVersionActionPath(detail.version.id, "test"), undefined, { headers: { ...headers, "x-idempotency-key": key }, maxResponseBytes: 500_000 }));
  }, [detail, canTest, scope.headers, mutation, t.tradePricing.runTest]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (!detail || !canPublish || staleRevision.current) return false;
    const predecessor = supersedesVersionId.trim();
    if ((predecessor && !isUuidV7(predecessor)) || approvalNotes.trim().length > SOLO_OWNER_APPROVAL_NOTES_MAX_LENGTH) return false;
    const body = { ...(predecessor ? { supersedesVersionId: predecessor } : {}),
      ...(isMakerSameAsActor && soloOwnerAttestation ? { soloOwnerAttestation: true, ...(approvalNotes.trim() ? { approvalNotes: approvalNotes.trim() } : {}) } : {}) };
    const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.version.version) };
    return mutation.run("publish", t.tradePricing.publishScheduleAction, key => tradePost(priceBookVersionActionPath(detail.version.id, "publish"), body, { headers: { ...headers, "x-idempotency-key": key } }));
  }, [detail, canPublish, supersedesVersionId, approvalNotes, isMakerSameAsActor, soloOwnerAttestation, scope.headers, mutation, t.tradePricing.publishScheduleAction]);

  const retire = useCallback(async (reason?: string): Promise<boolean> => {
    if (!detail || !canRetire || (reason?.trim().length ?? 0) > RETIRE_REASON_MAX_LENGTH) return false;
    const body = reason?.trim() ? { reason: reason.trim() } : {};
    const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.version.version) };
    return mutation.run("retire", t.tradePricing.retireVersionAction, key => tradePost(priceBookVersionActionPath(detail.version.id, "retire"), body, { headers: { ...headers, "x-idempotency-key": key } }));
  }, [detail, canRetire, scope.headers, mutation, t.tradePricing.retireVersionAction]);
  const deleteDraft = useCallback(async (): Promise<boolean> => {
    if (!detail || !canDeleteDraft) return false;
    const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.version.version) };
    return mutation.run("delete", t.tradePricing.deleteDraftAction, key => tradeDelete(priceBookVersionPath(detail.version.id), { headers: { ...headers, "x-idempotency-key": key } }));
  }, [detail, canDeleteDraft, scope.headers, mutation, t.tradePricing.deleteDraftAction]);

  const loadDiff = useCallback(async (otherId: string) => {
    if (!detail || !isUuidV7(otherId) || !scope.isResolved) return;
    const request = ++diffSequence.current;
    setIsDiffLoading(true); setDiffResult(null);
    try {
      const response = await tradeGet(priceBookVersionDiffPath(detail.version.id, otherId), { headers: scope.headers, maxResponseBytes: 5_000_000 });
      if (isCurrentScope() && request === diffSequence.current) setDiffResult(parsePriceBookVersionDiff(response.data));
    } catch (err) {
      if (isCurrentScope() && request === diffSequence.current) {
        const normalized = normalizeApiError(err);
        if (!toast.outcomeFromApi(normalized)) toast.error(t.tradeCommon.actionFailed, pricingMessage(normalized, t) ?? normalized.message);
      }
    } finally { if (isCurrentScope() && request === diffSequence.current) setIsDiffLoading(false); }
  }, [detail, scope.isResolved, scope.headers, isCurrentScope, toast, t]);
  const discardChanges = useCallback(() => {
    if (mutation.blockedNow()) return;
    if (staleConflict?.latestServer) {
      adoptDetail(staleConflict.latestServer); staleRevision.current = false; setStaleConflict(null); mutation.clearError();
      return;
    }
    if (staleConflict) return;
    if (detail) adoptDetail(detail);
  }, [staleConflict, detail, adoptDetail, mutation]);
  const acceptServerReloadOnConflict = useCallback(async () => {
    const latest = staleConflict?.latestServer ?? await loadVersion(versionId, { preserveLocalDraft: true });
    if (latest && isCurrentScope()) { adoptDetail(latest); staleRevision.current = false; setStaleConflict(null); mutation.clearError(); }
  }, [staleConflict, loadVersion, versionId, isCurrentScope, adoptDetail, mutation]);
  const editDraft = useCallback((next: SetStateAction<PriceBookVersionDraft | null>) => {
    if (ready && canManage && isEditableStatus && !mutation.blockedNow()) setDraft(next);
  }, [ready, canManage, isEditableStatus, mutation, setDraft]);
  const reload = useCallback(async () => {
    mutation.clearError();
    // After a confirmed write, the next successful read establishes the new revision.
    const latest = await loadVersion(versionId, { preserveLocalDraft: !confirmedWriteAwaitingRead.current && (isDirty || Boolean(staleConflict)) });
    if (latest) confirmedWriteAwaitingRead.current = false;
    return latest;
  }, [mutation, loadVersion, versionId, isDirty, staleConflict]);
  return {
    t, lang, user, scope, isOffline, validId: loader.validId, isEditableStatus: Boolean(isEditableStatus),
    canRead, canManage, canPublishGrant, canTest, canPublish, canRetire, canDeleteDraft,
    isMakerSameAsActor, soloEligible, savedEvidenceMatchesChecksum, publishDisabledReasons,
    detail, draft, setDraft: editDraft, isDirty, discardChanges, conflictReport, isLoading: loader.isLoading, error,
    mutationError: mutation.error, mutationPermission: mutation.errorAction === "publish" || mutation.errorAction === "retire" ? POLICY_PUBLISH_PERMISSION : PRICING_MANAGE_PERMISSION,
    pending: mutation.pending, testReport: loader.testReport, supersedesVersionId, setSupersedesVersionId,
    soloOwnerAttestation, setSoloOwnerAttestation, approvalNotes, setApprovalNotes, diffResult, isDiffLoading,
    ambiguous: mutation.ambiguous,
    replayNotice, staleConflict, acceptServerReloadOnConflict,
    reload,
    saveDraft, test, publish, retire, deleteDraft, loadDiff,
  };
}
