"use client";

import { useCallback, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";
import {
  TEAM_MEMBERSHIP_ROLES,
  type TeamMembershipRole,
} from "../../../contracts/user-subresource-contract";
import { useOrganizationCascade } from "../../../hooks/useOrganizationCascade";
import type {
  TeamMembershipDraftItem,
  useUserTeamMemberships,
} from "./useUserTeamMemberships";

export interface TeamPickerCascadeState {
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string;
}

const EMPTY_CASCADE: TeamPickerCascadeState = {
  companyId: "",
  branchId: "",
  departmentId: "",
  teamId: "",
};

const CASCADE_PERMISSIONS = [
  "org.company.read",
  "org.branch.read",
  "org.department.read",
] as const;

export function useTeamMembershipModalForm(options: {
  enabled: boolean;
  panel: ReturnType<typeof useUserTeamMemberships>;
  draft?: TeamMembershipDraftItem[];
  onClose?: () => void;
}) {
  const { enabled, panel, draft, onClose } = options;
  const { user: actor } = useTenantAuth();
  const canCascade = CASCADE_PERMISSIONS.every((key) => can(actor, key));

  const [selection, setSelection] = useState<TeamPickerCascadeState>(EMPTY_CASCADE);
  const [role, setRoleState] = useState<TeamMembershipRole>("MEMBER");

  const patchSelection = useCallback((patch: Partial<TeamPickerCascadeState>) => {
    setSelection((current) => ({ ...current, ...patch }));
  }, []);

  const cascade = useOrganizationCascade({
    enabled: enabled && canCascade,
    companyId: selection.companyId,
    branchId: selection.branchId,
    departmentId: selection.departmentId,
    teamId: selection.teamId,
    includeBranches: true,
    includeDepartments: true,
    includeTeams: true,
    autoSelectTeams: true,
    onChange: patchSelection,
  });

  const setRole = useCallback((next: string) => {
    setRoleState(TEAM_MEMBERSHIP_ROLES.find((item) => item === next) ?? "MEMBER");
  }, []);

  const reset = useCallback(() => {
    setSelection(EMPTY_CASCADE);
    setRoleState("MEMBER");
  }, []);

  const submitAdd = useCallback(async () => {
    if (!selection.teamId || panel.isSubmitting) return;
    const ok = await panel.add({ teamId: selection.teamId, role });
    if (ok) {
      reset();
      onClose?.();
    }
  }, [onClose, panel, reset, role, selection.teamId]);

  const addDraftItem = useCallback(() => {
    if (!selection.teamId || !draft) return;
    if (draft.some((item) => item.teamId === selection.teamId)) return;
    const hasExistingPrimary = draft.some((item) => item.isPrimary);
    panel.setDraft([
      ...draft,
      {
        teamId: selection.teamId,
        role,
        isPrimary: draft.length === 0 && !hasExistingPrimary,
      },
    ]);
    setSelection((current) => ({ ...current, teamId: "" }));
  }, [draft, panel, role, selection.teamId]);

  const updateDraftRole = useCallback(
    (teamId: string, nextRole: string) => {
      if (!draft) return;
      const resolved =
        TEAM_MEMBERSHIP_ROLES.find((item) => item === nextRole) ?? "MEMBER";
      panel.setDraft(
        draft.map((entry) =>
          entry.teamId === teamId ? { ...entry, role: resolved } : entry,
        ),
      );
    },
    [draft, panel],
  );

  const removeDraftItem = useCallback(
    (teamId: string) => {
      if (!draft) return;
      const removed = draft.find((entry) => entry.teamId === teamId);
      const remaining = draft.filter((entry) => entry.teamId !== teamId);
      if (
        removed?.isPrimary &&
        remaining.length > 0 &&
        !remaining.some((entry) => entry.isPrimary)
      ) {
        panel.setDraft(
          remaining.map((entry, idx) =>
            idx === 0 ? { ...entry, isPrimary: true } : entry,
          ),
        );
        return;
      }
      panel.setDraft(remaining);
    },
    [draft, panel],
  );

  return {
    canCascade,
    selection,
    patchSelection,
    cascade,
    role,
    setRole,
    reset,
    submitAdd,
    addDraftItem,
    updateDraftRole,
    removeDraftItem,
  };
}
