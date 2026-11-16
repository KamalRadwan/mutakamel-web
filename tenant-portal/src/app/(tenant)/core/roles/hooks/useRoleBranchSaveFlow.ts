"use client";

import { useCallback, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { Language } from "@/i18n/useLanguage";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchRoleBranchPermissions, saveRoleBranchPermissions,
  type RoleBranchPermissionsDocument, type SaveRoleBranchProfileInput,
} from "../contracts/role-branch-contract";
import { buildSavedReceiptLines, isAuthorityChangedError, isUncertainSaveError, reconcileUncertainSave } from "./branch-permissions-reconcile";
import type { ScopeBranchOption } from "./branch-permissions-review";
import type { BranchCatalogueTaxonomy } from "./branch-permissions-taxonomy";
import { runRoleBranchOperation, useRoleBranchOperationGuard } from "./useRoleBranchOperationGuard";

export type RoleBranchOutcomeDialogKind =
  | "read-error" | "authority-changed" | "catalogue-changed" | "concurrent-edit" | "save-uncertain";
export type RoleBranchStatusBanner = "comparison" | "not-applied" | null;

interface UseRoleBranchSaveFlowOptions {
  document: RoleBranchPermissionsDocument | null;
  setDocument: (doc: RoleBranchPermissionsDocument) => void;
  draftProfiles: Record<string, string[]>;
  setDraftProfiles: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  selectedCompanyIds: string[];
  branchesById: ReadonlyMap<string, ScopeBranchOption>;
  taxonomy: BranchCatalogueTaxonomy;
  setStep: (step: "scope" | "permissions" | "review") => void;
  t: Dictionary;
  lang: Language;
  onSaved: (doc: RoleBranchPermissionsDocument, receiptLines: string[]) => void;
}

export function useRoleBranchSaveFlow({
  document, setDocument, draftProfiles, setDraftProfiles, selectedCompanyIds,
  branchesById, taxonomy, setStep, t, lang, onSaved,
}: UseRoleBranchSaveFlowOptions) {
  const { retryBootstrap } = useTenantAuth();
  const beginOperation = useRoleBranchOperationGuard();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [outcomeDialog, setOutcomeDialog] = useState<RoleBranchOutcomeDialogKind | null>(null);
  const [outcomeError, setOutcomeError] = useState<NormalizedApiError | null>(null);
  const [statusBanner, setStatusBanner] = useState<RoleBranchStatusBanner>(null);
  const [intendedSave, setIntendedSave] = useState<{
    baselineRevision: string; profiles: SaveRoleBranchProfileInput[];
  } | null>(null);

  const reportSaved = useCallback(async (savedDoc: RoleBranchPermissionsDocument, isCurrent: () => boolean) => {
    const receipt = buildSavedReceiptLines({ savedDoc, selectedCompanyIds, branchesById, t, lang });
    try { await retryBootstrap(); }
    catch { receipt.push(t.coreIdentity.roleBranch.dialogs.saved.sessionRefreshFailed); }
    if (isCurrent()) onSaved(savedDoc, receipt);
  }, [branchesById, lang, onSaved, retryBootstrap, selectedCompanyIds, t]);

  const handleWriteError = useCallback((rawError: unknown) => {
    const error = normalizeApiError(rawError);
    const dialog = isUncertainSaveError(error) ? "save-uncertain"
      : isAuthorityChangedError(error) ? "authority-changed"
      : error.code === "ROLE_BRANCH_CATALOGUE_CHANGED" ? "catalogue-changed"
      : error.code === "ROLE_BRANCH_REVISION_CONFLICT" ? "concurrent-edit" : null;
    if (dialog) { setOutcomeError(error); setOutcomeDialog(dialog); }
    else setWriteError(error);
  }, []);
  const handleRecoveryError = useCallback((error: unknown) => setOutcomeError(normalizeApiError(error)), []);

  const executeSave = useCallback(async () => {
    if (!document || document.isSystem || isSubmitting) return;
    await runRoleBranchOperation(beginOperation, setIsSubmitting, async (isCurrent) => {
      // Preserve every selected ID. The validator blocks unavailable choices;
      // only an explicit draft action may remove them.
      const profiles = Object.entries(draftProfiles).map(([branchId, permissionIds]) => ({
        branchId, permissionIds: [...permissionIds],
      }));
      setWriteError(null);
      setStatusBanner(null);
      setIntendedSave({ baselineRevision: document.revision, profiles });
      const saved = await saveRoleBranchPermissions(document.roleId, {
        expectedRevision: document.revision, catalogueRevision: document.catalogueRevision, profiles,
      }, { limits: document.limits, branchCatalogueIds: taxonomy.branchCatalogueIds });
      if (!isCurrent()) return;
      setDocument(saved);
      await reportSaved(saved, isCurrent);
    }, handleWriteError);
  }, [beginOperation, document, draftProfiles, handleWriteError, isSubmitting, reportSaved, setDocument, taxonomy.branchCatalogueIds]);

  const checkCurrentState = useCallback(async () => {
    if (!document || isReconciling) return;
    await runRoleBranchOperation(beginOperation, setIsReconciling, async (isCurrent) => {
      const latest = await fetchRoleBranchPermissions(document.roleId);
      if (!isCurrent()) return;
      setDocument(latest);
      if (!intendedSave) { setOutcomeDialog(null); return; }
      const outcome = reconcileUncertainSave(intendedSave.profiles, intendedSave.baselineRevision, latest);
      if (outcome === "APPLIED") {
        setOutcomeDialog(null);
        await reportSaved(latest, isCurrent);
      } else if (outcome === "CONFLICT") setOutcomeDialog("concurrent-edit");
      else { setOutcomeDialog(null); setStatusBanner("not-applied"); setStep("review"); }
    }, handleRecoveryError);
  }, [beginOperation, document, handleRecoveryError, intendedSave, isReconciling, reportSaved, setDocument, setStep]);

  const refreshCatalogue = useCallback(async () => {
    if (!document || isReconciling) return;
    await runRoleBranchOperation(beginOperation, setIsReconciling, async (isCurrent) => {
      const latest = await fetchRoleBranchPermissions(document.roleId);
      if (!isCurrent()) return;
      setDocument(latest);
      setOutcomeDialog(null);
      if (latest.revision !== document.revision) setStatusBanner("comparison");
      setStep("permissions");
    }, handleRecoveryError);
  }, [beginOperation, document, handleRecoveryError, isReconciling, setDocument, setStep]);

  const reviewLatestVersion = useCallback(async () => {
    if (!document || isReconciling) return;
    await runRoleBranchOperation(beginOperation, setIsReconciling, async (isCurrent) => {
      const latest = await fetchRoleBranchPermissions(document.roleId);
      if (!isCurrent()) return;
      setDocument(latest);
      setOutcomeDialog(null);
      setStatusBanner("comparison");
      setStep("review");
    }, handleRecoveryError);
  }, [beginOperation, document, handleRecoveryError, isReconciling, setDocument, setStep]);

  const recheckAuthority = useCallback(async () => {
    if (!document || isReconciling) return;
    await runRoleBranchOperation(beginOperation, setIsReconciling, async (isCurrent) => {
      await retryBootstrap();
      if (!isCurrent()) return;
      const latest = await fetchRoleBranchPermissions(document.roleId);
      if (!isCurrent()) return;
      setDocument(latest);
      setOutcomeDialog(null);
      setOutcomeError(null);
    }, handleRecoveryError);
  }, [beginOperation, document, handleRecoveryError, isReconciling, retryBootstrap, setDocument]);

  const unavailableSelectionCount = Object.values(draftProfiles).reduce(
    (count, ids) => count + ids.filter(id => !taxonomy.branchCatalogueIds.has(id)).length, 0,
  );
  const removeUnavailableSelections = useCallback(() => {
    setDraftProfiles(current => Object.fromEntries(Object.entries(current).map(([branchId, ids]) => [
      branchId, ids.filter(id => taxonomy.branchCatalogueIds.has(id)),
    ])));
    setStep("permissions");
  }, [setDraftProfiles, setStep, taxonomy.branchCatalogueIds]);

  return {
    isSubmitting, isReconciling, writeError, clearWriteError: () => setWriteError(null),
    outcomeDialog, setOutcomeDialog, outcomeError, setOutcomeError, statusBanner, setStatusBanner,
    executeSave, checkCurrentState, refreshCatalogue, reviewLatestVersion, recheckAuthority,
    unavailableSelectionCount, removeUnavailableSelections,
  };
}
