"use client";

import { useCallback, useState } from "react";
import { branchRoleAssignmentKey } from "../../../contracts/role-assignment-contract";
import type { useRoleGrantOptions } from "../../../hooks/useRoleGrantOptions";
import type { useUserRoleGrants } from "./useUserRoleGrants";

interface UseBranchRoleFormOptions {
  panel: ReturnType<typeof useUserRoleGrants>;
  grantOptions: ReturnType<typeof useRoleGrantOptions>;
}

/**
 * Owns pair selection and add/replace modal transitions for `BranchRolesSection`.
 */
export function useBranchRoleForm({
  panel,
  grantOptions,
}: UseBranchRoleFormOptions) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState("");
  const [selectedBranchId = "", selectedRoleId = ""] = selectedPair.split(":");

  const selected = grantOptions.choices.find(
    (row) => `${row.branchId}:${row.roleId}` === selectedPair,
  );

  const editingDisabled =
    panel.isSubmitting ||
    panel.isBranchLoading ||
    Boolean(panel.branchError) ||
    !grantOptions.isReady;

  const draft = panel.branchDraft;

  const isDraftDirty =
    draft !== null &&
    (draft.length !== panel.branchRoles.length ||
      draft.some(
        (grant, index) =>
          branchRoleAssignmentKey(grant) !==
          branchRoleAssignmentKey(
            panel.branchRoles[index] ?? { branchId: "", roleId: "" },
          ),
      ));

  const openAdd = useCallback(() => {
    panel.clearWriteError();
    setSelectedPair("");
    setIsAddOpen(true);
  }, [panel]);

  const closeAdd = useCallback(() => {
    setSelectedPair("");
    panel.clearWriteError();
    setIsAddOpen(false);
  }, [panel]);

  const startReplace = useCallback(() => {
    setSelectedPair("");
    panel.startBranchReplace();
  }, [panel]);

  const closeReplace = useCallback(() => {
    setSelectedPair("");
    panel.cancelBranchReplace();
  }, [panel]);

  const submitSingleAdd = useCallback(async () => {
    if (!selected || editingDisabled) return;
    const ok = await panel.addBranchRole({
      branchId: selected.branchId,
      roleId: selected.roleId,
    });
    if (ok) {
      setSelectedPair("");
      setIsAddOpen(false);
    }
  }, [editingDisabled, panel, selected]);

  const addDraftRow = useCallback(() => {
    if (!selected || !draft || editingDisabled) return;
    const exists = draft.some(
      (grant) =>
        grant.branchId === selected.branchId && grant.roleId === selected.roleId,
    );
    if (!exists) {
      panel.setBranchDraft([
        ...draft,
        { branchId: selected.branchId, roleId: selected.roleId },
      ]);
    }
    setSelectedPair("");
  }, [draft, editingDisabled, panel, selected]);

  return {
    isAddOpen,
    openAdd,
    closeAdd,
    selectedPair,
    setSelectedPair,
    selectedBranchId,
    selectedRoleId,
    selected,
    editingDisabled,
    draft,
    isDraftDirty,
    startReplace,
    closeReplace,
    submitSingleAdd,
    addDraftRow,
  };
}
