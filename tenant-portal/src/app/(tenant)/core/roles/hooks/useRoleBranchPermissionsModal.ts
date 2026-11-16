"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchRoleBranchPermissions,
  MAX_PERMISSIONS_PER_BRANCH,
  MAX_ROLE_BRANCH_PROFILES,
  type RoleBranchPermissionsDocument,
  type RoleRecordScope,
} from "../contracts/role-branch-contract";
import { isAuthorityChangedError, resolveRoleBranchErrorText } from "./branch-permissions-reconcile";
import { classifyBranchAccessMode, computeBranchReviewItems } from "./branch-permissions-review";
import {
  changeBranchActionRecordScope,
  filterBranchTaxonomy,
  toggleBranchActionRow,
  toggleBranchRowCollection,
  type BranchPermissionFilterMode,
} from "./branch-permissions-selection";
import { buildBranchCatalogueTaxonomy, type BranchActionRow } from "./branch-permissions-taxonomy";
import {
  buildRoleBranchStepperSteps,
  computeRoleBranchDiscardDescription,
  computeRoleBranchSubmitLabel,
  resolveWizardStepClick,
  type RoleBranchWizardStep,
} from "./branch-permissions-wizard";
import { GLOBAL_VIEW_BRANCH_ID, useRoleBranchDraftState } from "./useRoleBranchDraftState";
import { useRoleBranchSaveFlow } from "./useRoleBranchSaveFlow";
import { useRoleBranchScopeOptions } from "./useRoleBranchScopeOptions";

interface UseRoleBranchPermissionsModalOptions {
  open: boolean;
  roleId: string | null;
  roleDisplayName: string;
  isSystemHint?: boolean;
  initialMode: "edit" | "view";
  onSaved: (doc: RoleBranchPermissionsDocument, receiptLines: string[]) => void;
}

export function useRoleBranchPermissionsModal({
  open,
  roleId,
  roleDisplayName,
  isSystemHint = false,
  initialMode,
  onSaved,
}: UseRoleBranchPermissionsModalOptions) {
  const { t, lang } = useI18n();
  const [document, setDocument] = useState<RoleBranchPermissionsDocument | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const effectiveMode: "edit" | "view" =
    initialMode === "view" || isSystemHint || (document?.isSystem ?? false) ? "view" : "edit";

  const [step, setStep] = useState<RoleBranchWizardStep>(
    effectiveMode === "view" ? "permissions" : "scope",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<BranchPermissionFilterMode>("all");
  const [showWorkspaceLocked, setShowWorkspaceLocked] = useState(false);
  const [confirmClearAllOpen, setConfirmClearAllOpen] = useState(false);

  const scopeState = useRoleBranchScopeOptions({
    open,
    mode: effectiveMode,
    savedProfiles: document?.profiles ?? [],
    reloadToken,
  });

  const taxonomy = useMemo(
    () => buildBranchCatalogueTaxonomy(document?.catalogue ?? []),
    [document?.catalogue],
  );

  const enterViewMode = useCallback(() => setStep("permissions"), []);
  const noopMutate = useCallback(() => undefined, []);

  const draft = useRoleBranchDraftState({
    document,
    effectiveMode,
    companies: scopeState.companies,
    branches: scopeState.branches,
    branchesById: scopeState.branchesById,
    isScopeComplete: scopeState.isComplete,
    isLoadingScope: scopeState.isLoadingScope,
    onEnterViewMode: enterViewMode,
    onDraftMutated: noopMutate,
  });

  const saveFlow = useRoleBranchSaveFlow({
    document,
    setDocument,
    draftProfiles: draft.draftProfiles,
    setDraftProfiles: draft.setDraftProfiles,
    selectedCompanyIds: draft.selectedCompanyIds,
    branchesById: scopeState.branchesById,
    taxonomy,
    setStep,
    t,
    lang,
    onSaved,
  });
  const { setOutcomeDialog, setOutcomeError, clearWriteError } = saveFlow;

  useEffect(() => {
    if (!open || !roleId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isUUIDv7(roleId)) {
        setOutcomeError({ status: 404, code: "ROLE_NOT_FOUND" });
        setOutcomeDialog("read-error");
        return;
      }
      setIsLoadingDoc(true);
      fetchRoleBranchPermissions(roleId, controller.signal)
        .then((loaded) => {
          if (controller.signal.aborted) return;
          setDocument(loaded);
          setOutcomeDialog(null);
          setOutcomeError(null);
        })
        .catch((rawError: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(rawError);
          setOutcomeError(normalized);
          setOutcomeDialog(isAuthorityChangedError(normalized) ? "authority-changed" : "read-error");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingDoc(false);
        });
    });
    return () => controller.abort();
  }, [open, reloadToken, roleId, setOutcomeDialog, setOutcomeError]);

  useEffect(() => {
    if (!scopeState.scopeError || effectiveMode !== "edit") return;
    queueMicrotask(() => {
      setOutcomeError(scopeState.scopeError);
      setOutcomeDialog(
        isAuthorityChangedError(scopeState.scopeError!) ? "authority-changed" : "read-error",
      );
    });
  }, [effectiveMode, scopeState.scopeError, setOutcomeDialog, setOutcomeError]);

  const maxBranches = document?.limits.branches ?? MAX_ROLE_BRANCH_PROFILES;
  const maxPerBranch = document?.limits.permissionsPerBranch ?? MAX_PERMISSIONS_PER_BRANCH;
  const isClearingAllSaved =
    effectiveMode === "edit" &&
    (document?.profiles.length ?? 0) > 0 &&
    draft.draftBranchIds.length === 0;

  const activePermissionIds = useMemo(
    () =>
      draft.activeBranchId === GLOBAL_VIEW_BRANCH_ID
        ? (document?.globalPermissionIds ?? [])
        : (draft.draftProfiles[draft.activeBranchId] ?? []),
    [document?.globalPermissionIds, draft.activeBranchId, draft.draftProfiles],
  );
  const activeSelectedSet = useMemo(() => new Set(activePermissionIds), [activePermissionIds]);
  const isActiveBranchIncluded =
    draft.activeBranchId === GLOBAL_VIEW_BRANCH_ID ||
    Object.prototype.hasOwnProperty.call(draft.draftProfiles, draft.activeBranchId);

  const filteredModules = useMemo(
    () =>
      filterBranchTaxonomy(taxonomy.modules, {
        searchQuery,
        filterMode,
        selectedSet: activeSelectedSet,
        lang,
      }),
    [activeSelectedSet, filterMode, lang, searchQuery, taxonomy.modules],
  );

  const updateActiveBranchPermissions = useCallback(
    (updater: (current: string[]) => string[]) => {
      if (effectiveMode !== "edit" || !isActiveBranchIncluded || draft.activeBranchId === GLOBAL_VIEW_BRANCH_ID) {
        return;
      }
      clearWriteError();
      draft.setDraftProfiles((current) => ({
        ...current,
        [draft.activeBranchId]: updater(current[draft.activeBranchId] ?? []),
      }));
    },
    [clearWriteError, draft, effectiveMode, isActiveBranchIncluded],
  );

  const reviewState = useMemo(
    () =>
      document
        ? computeBranchReviewItems({
            document,
            draftProfiles: draft.draftProfiles,
            selectedCompanyIds: draft.selectedCompanyIds,
            branchesById: scopeState.branchesById,
            taxonomy,
          })
        : { items: [], dirtyBranchCount: 0, isDirty: false },
    [document, draft.draftProfiles, draft.selectedCompanyIds, scopeState.branchesById, taxonomy],
  );

  const anyBranchOverLimit = useMemo(
    () => Object.values(draft.draftProfiles).some((ids) => ids.length > maxPerBranch),
    [draft.draftProfiles, maxPerBranch],
  );

  const hasInactiveSelection = draft.draftBranchIds.some(id =>
    scopeState.branchesById.get(id)?.isActive !== true);
  const scopeInvalid =
    hasInactiveSelection ||
    draft.selectedCompanyIds.length === 0 ||
    draft.draftBranchIds.length === 0 ||
    draft.draftBranchIds.length > maxBranches;
  const scopeHasBlockingError =
    effectiveMode === "edit" && draft.showScopeValidation && !isClearingAllSaved && scopeInvalid;

  const ensureActiveIncludedBranch = useCallback(() => {
    if (!draft.activeBranchId || !Object.prototype.hasOwnProperty.call(draft.draftProfiles, draft.activeBranchId)) {
      draft.setActiveBranchId(draft.draftBranchIds[0]);
    }
  }, [draft]);

  const handleStepSelect = useCallback(
    (targetId: string) => {
      const res = resolveWizardStepClick({
        target: targetId as RoleBranchWizardStep,
        effectiveMode,
        isClearingAllSaved,
        scopeInvalid,
        anyBranchOverLimit,
      });
      if (res.flagScopeInvalid) draft.setShowScopeValidation(true);
      if (res.ensureActiveBranch) ensureActiveIncludedBranch();
      if (res.nextStep) setStep(res.nextStep);
    },
    [anyBranchOverLimit, draft, effectiveMode, ensureActiveIncludedBranch, isClearingAllSaved, scopeInvalid],
  );

  const handlePrimarySubmit = useCallback(() => {
    if (effectiveMode === "view") return;
    if (scopeInvalid && !isClearingAllSaved) {
      draft.setShowScopeValidation(true);
      setStep("scope");
      return;
    }
    if (step === "scope") {
      if (isClearingAllSaved) return setStep("review");
      ensureActiveIncludedBranch();
      return setStep("permissions");
    }
    if (step === "permissions") {
      if (!anyBranchOverLimit) setStep("review");
      return;
    }
    if (isClearingAllSaved) return setConfirmClearAllOpen(true);
    void saveFlow.executeSave();
  }, [anyBranchOverLimit, draft, effectiveMode, ensureActiveIncludedBranch, isClearingAllSaved, saveFlow, scopeInvalid, step]);

  const isLoading = isLoadingDoc || (scopeState.isLoadingScope && !draft.initialized);
  const isDirty = effectiveMode === "edit" && reviewState.isDirty;

  return {
    t, lang, effectiveMode, step, document, isLoading, isDirty,
    steps: buildRoleBranchStepperSteps({ step, scopeHasBlockingError, anyBranchOverLimit, t }),
    handleStepSelect,
    handleBack: () => setStep(step === "review" && !isClearingAllSaved ? "permissions" : "scope"),
    submitLabel: computeRoleBranchSubmitLabel({ step, isClearingAllSaved, t }),
    submitDisabled:
      isLoading ||
      saveFlow.unavailableSelectionCount > 0 ||
      scopeHasBlockingError ||
      (step === "review" && scopeInvalid && !isClearingAllSaved) ||
      (step === "permissions" && anyBranchOverLimit) ||
      (step === "review" && (!isDirty || anyBranchOverLimit || draft.draftBranchIds.length > maxBranches)),
    roleName: document?.roleName ?? roleDisplayName,
    isSystem: document?.isSystem ?? isSystemHint,
    retryLoad: () => { setOutcomeDialog(null); setReloadToken((n) => n + 1); },
    companies: scopeState.companies,
    branches: scopeState.branches,
    ...draft,
    isClearingAllSaved, hasInactiveSelection, maxBranches, maxPerBranch, isActiveBranchIncluded,
    activePermissionIds, activeSelectedSet, taxonomy, filteredModules,
    activeBranchMode: classifyBranchAccessMode(activePermissionIds, isActiveBranchIncluded, taxonomy),
    searchQuery, setSearchQuery, clearSearch: () => setSearchQuery(""),
    filterMode, setFilterMode, showWorkspaceLocked,
    toggleWorkspaceLocked: () => setShowWorkspaceLocked((prev) => !prev),
    toggleActionRow: (row: BranchActionRow) => updateActiveBranchPermissions((ids) => toggleBranchActionRow(ids, row)),
    changeRecordScope: (row: BranchActionRow, nextScope: RoleRecordScope) =>
      updateActiveBranchPermissions((ids) => changeBranchActionRecordScope(ids, row, nextScope)),
    toggleCollection: (rows: BranchActionRow[]) =>
      updateActiveBranchPermissions((ids) => toggleBranchRowCollection(ids, rows)),
    reviewState, handlePrimarySubmit, confirmClearAllOpen, setConfirmClearAllOpen,
    discardDescription: computeRoleBranchDiscardDescription(reviewState.dirtyBranchCount, t, lang),
    confirmClearAllSave: () => { setConfirmClearAllOpen(false); void saveFlow.executeSave(); },
    adoptServerVersion: () => { draft.resetToServerDocument(); saveFlow.setStatusBanner(null); },
    writeErrorText: resolveRoleBranchErrorText(saveFlow.writeError, t),
    outcomeErrorText: resolveRoleBranchErrorText(saveFlow.outcomeError, t),
    ...saveFlow,
  };
}
