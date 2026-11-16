"use client";

import { useI18n } from "@/i18n/I18nContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import type { ScopeBranchOption, ScopeCompanyOption } from "./branch-permissions-review";
import { deriveInitialScopeSelection } from "./useRoleBranchScopeOptions";

export const GLOBAL_VIEW_BRANCH_ID = "__GLOBAL__";

interface PendingBranchRemoval {
  branchIds: string[];
  branchLabel: string;
  nextCompanyIds?: string[];
}

interface UseRoleBranchDraftStateOptions {
  document: RoleBranchPermissionsDocument | null;
  effectiveMode: "edit" | "view";
  companies: ScopeCompanyOption[];
  branches: ScopeBranchOption[];
  branchesById: ReadonlyMap<string, ScopeBranchOption>;
  isScopeComplete: boolean;
  isLoadingScope: boolean;
  onEnterViewMode: () => void;
  onDraftMutated: () => void;
}

export function useRoleBranchDraftState({
  document,
  effectiveMode,
  companies,
  branches,
  branchesById,
  isScopeComplete,
  isLoadingScope,
  onEnterViewMode,
  onDraftMutated,
}: UseRoleBranchDraftStateOptions) {
  const { t } = useI18n();
  const [initialized, setInitialized] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [draftProfiles, setDraftProfiles] = useState<Record<string, string[]>>({});
  const [autoSingleCompany, setAutoSingleCompany] = useState(false);
  const [autoSingleBranchId, setAutoSingleBranchId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState("");
  const [showScopeValidation, setShowScopeValidation] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingBranchRemoval | null>(null);

  useEffect(() => {
    if (!document || initialized) return;
    const scopeReady = isScopeComplete || (effectiveMode === "view" && !isLoadingScope);
    if (!scopeReady) return;
    queueMicrotask(() => {
      const derived = deriveInitialScopeSelection({
        savedProfiles: document.profiles,
        companies,
        branches,
        isComplete: isScopeComplete,
      });
      setSelectedCompanyIds(derived.selectedCompanyIds);
      setDraftProfiles(derived.draftProfiles);
      setAutoSingleCompany(derived.autoSelectedSingleCompany);
      setAutoSingleBranchId(derived.autoSelectedSingleBranchId);
      const firstDraftBranch = Object.keys(derived.draftProfiles)[0];
      const defaultViewBranch =
        effectiveMode === "view" &&
        document.permissionMode === "GLOBAL" &&
        document.profiles.length === 0
          ? GLOBAL_VIEW_BRANCH_ID
          : firstDraftBranch ?? branches[0]?.id ?? "";
      setActiveBranchId(defaultViewBranch);
      if (effectiveMode === "view") onEnterViewMode();
      setInitialized(true);
    });
  }, [
    branches,
    companies,
    document,
    effectiveMode,
    initialized,
    isLoadingScope,
    isScopeComplete,
    onEnterViewMode,
  ]);

  const baselineBranchIds = useMemo(
    () => new Set((document?.profiles ?? []).map((profile) => profile.branchId)),
    [document?.profiles],
  );
  const draftBranchIds = useMemo(() => Object.keys(draftProfiles), [draftProfiles]);

  const applyBranchRemovals = useCallback(
    (branchIds: string[], nextCompanyIds?: string[]) => {
      const autoBranchIds = isScopeComplete
        ? (nextCompanyIds ?? []).filter((id) => !selectedCompanyIds.includes(id)).flatMap((companyId) => {
          const available = branches.filter((branch) => branch.companyId === companyId && branch.isActive);
          return available.length === 1 ? [available[0]!.id] : [];
        })
        : [];
      onDraftMutated();
      setDraftProfiles((current) => {
        const copy = { ...current };
        for (const id of branchIds) delete copy[id];
        for (const id of autoBranchIds) copy[id] ??= [];
        return copy;
      });
      if (nextCompanyIds !== undefined) {
        setSelectedCompanyIds(nextCompanyIds);
        setAutoSingleBranchId(autoBranchIds.length === 1 ? autoBranchIds[0]! : null);
      }
      if (autoBranchIds.length && (!draftProfiles[activeBranchId] || branchIds.includes(activeBranchId))) {
        setActiveBranchId(autoBranchIds[0]!);
      }
      setPendingRemoval(null);
    },
    [activeBranchId, branches, draftProfiles, isScopeComplete, onDraftMutated, selectedCompanyIds],
  );

  const handleCompanySelectionChange = useCallback(
    (nextCompanyIds: string[]) => {
      if (effectiveMode !== "edit") return;
      setAutoSingleCompany(false);
      setShowScopeValidation(false);
      const affected = draftBranchIds.filter((branchId) => {
        const meta = branchesById.get(branchId);
        return meta ? !nextCompanyIds.includes(meta.companyId) : false;
      });
      const protectedRemovals = affected.filter(
        (id) => baselineBranchIds.has(id) || (draftProfiles[id]?.length ?? 0) > 0,
      );
      if (protectedRemovals.length > 0) {
        const names = protectedRemovals
          .map((id) => branchesById.get(id)?.name ?? t.common.nameUnavailable)
          .join("، ");
        setPendingRemoval({
          // Confirmation protects saved/edited branches, then removes every
          // draft belonging to the deselected company, including empty ones.
          branchIds: affected,
          branchLabel: names,
          nextCompanyIds,
        });
        return;
      }
      applyBranchRemovals(affected, nextCompanyIds);
    },
    [applyBranchRemovals, baselineBranchIds, branchesById, draftBranchIds, draftProfiles, effectiveMode, t.common.nameUnavailable],
  );

  const handleToggleBranch = useCallback(
    (branchId: string) => {
      if (effectiveMode !== "edit") return;
      setShowScopeValidation(false);
      setAutoSingleBranchId(null);
      if (Object.prototype.hasOwnProperty.call(draftProfiles, branchId)) {
        if (baselineBranchIds.has(branchId) || (draftProfiles[branchId]?.length ?? 0) > 0) {
          setPendingRemoval({
            branchIds: [branchId],
            branchLabel: branchesById.get(branchId)?.name ?? t.common.nameUnavailable,
          });
          return;
        }
        applyBranchRemovals([branchId]);
        return;
      }
      onDraftMutated();
      setDraftProfiles((current) => ({ ...current, [branchId]: [] }));
      if (!activeBranchId || !Object.prototype.hasOwnProperty.call(draftProfiles, activeBranchId)) {
        setActiveBranchId(branchId);
      }
    },
    [activeBranchId, applyBranchRemovals, baselineBranchIds, branchesById, draftProfiles, effectiveMode, onDraftMutated, t.common.nameUnavailable],
  );

  const resetToServerDocument = useCallback(() => {
    if (!document) return;
    const derived = deriveInitialScopeSelection({
      savedProfiles: document.profiles,
      companies,
      branches,
      isComplete: isScopeComplete,
    });
    setSelectedCompanyIds(derived.selectedCompanyIds);
    setDraftProfiles(derived.draftProfiles);
  }, [branches, companies, document, isScopeComplete]);

  return {
    initialized,
    selectedCompanyIds,
    draftProfiles,
    setDraftProfiles,
    draftBranchIds,
    autoSingleCompany,
    autoSingleBranchId,
    activeBranchId,
    setActiveBranchId,
    showScopeValidation,
    setShowScopeValidation,
    pendingRemoval,
    cancelRemoval: () => setPendingRemoval(null),
    confirmRemoval: () =>
      pendingRemoval &&
      applyBranchRemovals(pendingRemoval.branchIds, pendingRemoval.nextCompanyIds),
    handleCompanySelectionChange,
    handleToggleBranch,
    resetToServerDocument,
  };
}
