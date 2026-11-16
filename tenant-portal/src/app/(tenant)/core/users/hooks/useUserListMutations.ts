"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  deleteTenantUser,
  inviteTenantUser,
  resendTenantUserInvite,
  revokeTenantUserSessions,
  setTenantUserStatus,
  updateTenantUser,
  USER_LIMIT_REACHED_CODE,
  type InviteUserInput,
  type TenantUser,
} from "../../contracts/user-contract";
import { toUpdateInput, type UserFormValues } from "../user-payloads";
import {
  allowedUserActions,
  canInviteWithPlacement,
  canOpenUserInvite,
  canPerformUserAction,
  canSubmitUserInvite,
  canSubmitUserUpdate,
  type UserPermissionActor,
  type UserRowAction,
} from "../user-permissions";

interface UseUserListMutationsOptions {
  actor: UserPermissionActor | null | undefined;
  rows: TenantUser[];
  setRows: Dispatch<SetStateAction<TenantUser[]>>;
  reload: () => void;
}

/**
 * Owns invite, edit, and lifecycle confirmation mutations for `/core/users`.
 * Every open/submit/confirm callback re-verifies current branch-scoped
 * authority, owner/self protections, valid source status, and synchronous
 * in-flight fences immediately before dispatch.
 */
export function useUserListMutations({
  actor,
  rows,
  setRows,
  reload,
}: UseUserListMutationsOptions) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    user: TenantUser;
    action: UserRowAction;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [seatLimitReached, setSeatLimitReached] = useState(false);
  const [inviteQueuedUser, setInviteQueuedUser] = useState<TenantUser | null>(null);

  const inFlightRef = useRef(false);
  const latestRef = useRef({ actor, rows, editingUser, pendingAction });

  useEffect(() => {
    latestRef.current = { actor, rows, editingUser, pendingAction };
  });

  const openInvite = useCallback(() => {
    const currentActor = latestRef.current.actor;
    if (
      inFlightRef.current ||
      !canOpenUserInvite(currentActor) ||
      !canInviteWithPlacement(currentActor)
    ) {
      return;
    }
    setMutationError(null);
    setSeatLimitReached(false);
    latestRef.current.editingUser = null;
    setEditingUser(null);
    setIsInviteOpen(true);
  }, []);

  const closeInvite = useCallback(() => {
    if (inFlightRef.current) return;
    setIsInviteOpen(false);
    setMutationError(null);
  }, []);

  const handleInvite = useCallback(
    async (body: InviteUserInput): Promise<boolean> => {
      const currentActor = latestRef.current.actor;
      if (
        inFlightRef.current ||
        !canOpenUserInvite(currentActor) ||
        !canInviteWithPlacement(currentActor) ||
        !canSubmitUserInvite(currentActor, body.branchId)
      ) {
        return false;
      }
      inFlightRef.current = true;
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await inviteTenantUser(body);
        setIsInviteOpen(false);
        setSeatLimitReached(false);
        reload();
        return true;
      } catch (cause) {
        const normalized = normalizeApiError(cause);
        if (normalized.status === 403 && normalized.code === USER_LIMIT_REACHED_CODE) {
          setSeatLimitReached(true);
        }
        setMutationError(normalized);
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const openEdit = useCallback((target: TenantUser) => {
    const state = latestRef.current;
    const currentTarget = state.rows.find((row) => row.id === target.id) ?? target;
    if (inFlightRef.current || !allowedUserActions(currentTarget, state.actor).edit) {
      return;
    }
    setMutationError(null);
    setIsInviteOpen(false);
    latestRef.current.editingUser = currentTarget;
    setEditingUser(currentTarget);
  }, []);

  const closeEdit = useCallback(() => {
    if (inFlightRef.current) return;
    latestRef.current.editingUser = null;
    setEditingUser(null);
    setMutationError(null);
  }, []);

  const handleUpdate = useCallback(
    async (values: UserFormValues): Promise<boolean> => {
      const state = latestRef.current;
      const baseTarget = state.editingUser;
      const currentTarget = baseTarget
        ? (state.rows.find((row) => row.id === baseTarget.id) ?? baseTarget)
        : null;
      if (
        inFlightRef.current ||
        !currentTarget ||
        !canSubmitUserUpdate(state.actor, currentTarget, values.branchId)
      ) {
        return false;
      }
      inFlightRef.current = true;
      setIsSubmitting(true);
      setMutationError(null);
      try {
        const saved = await updateTenantUser(
          currentTarget.id,
          toUpdateInput(currentTarget, values),
        );
        setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
        latestRef.current.editingUser = null;
        setEditingUser(null);
        reload();
        return true;
      } catch (cause) {
        setMutationError(normalizeApiError(cause));
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [reload, setRows],
  );

  const requestAction = useCallback((target: TenantUser, action: UserRowAction) => {
    const state = latestRef.current;
    const currentTarget = state.rows.find((row) => row.id === target.id) ?? target;
    if (
      inFlightRef.current ||
      !canPerformUserAction(state.actor, currentTarget, action)
    ) {
      return;
    }
    setMutationError(null);
    const nextPending = { user: currentTarget, action };
    latestRef.current.pendingAction = nextPending;
    setPendingAction(nextPending);
  }, []);

  const cancelAction = useCallback(() => {
    if (inFlightRef.current) return;
    latestRef.current.pendingAction = null;
    setPendingAction(null);
    setMutationError(null);
  }, []);

  const confirmAction = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    const state = latestRef.current;
    const pending = state.pendingAction;
    if (!pending) return;

    const currentTarget =
      state.rows.find((row) => row.id === pending.user.id) ?? pending.user;

    if (!canPerformUserAction(state.actor, currentTarget, pending.action)) {
      latestRef.current.pendingAction = null;
      setPendingAction(null);
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const { action } = pending;
      if (action === "delete") {
        await deleteTenantUser(currentTarget.id);
      } else if (action === "resendInvite") {
        const result = await resendTenantUserInvite(currentTarget.id);
        if (result.deliveryStatus === "QUEUED") {
          setInviteQueuedUser(currentTarget);
        }
      } else if (action === "revokeSessions") {
        const saved = await revokeTenantUserSessions(currentTarget.id);
        setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      } else {
        const saved = await setTenantUserStatus(currentTarget.id, action);
        setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
        if (saved.status !== "INVITED") {
          setInviteQueuedUser((prev) => (prev?.id === saved.id ? null : prev));
        }
      }
      latestRef.current.pendingAction = null;
      setPendingAction(null);
      reload();
    } catch (cause) {
      // Preserve `pendingAction` on failure so the user retains context and can retry.
      setMutationError(normalizeApiError(cause));
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [reload, setRows]);

  const currentEditingUser = editingUser
    ? (rows.find((row) => row.id === editingUser.id) ?? editingUser)
    : null;
  const effectiveEditingUser =
    currentEditingUser && allowedUserActions(currentEditingUser, actor).edit
      ? currentEditingUser
      : null;

  return {
    isInviteOpen:
      isInviteOpen && canOpenUserInvite(actor) && canInviteWithPlacement(actor),
    openInvite,
    closeInvite,
    handleInvite,
    editingUser: effectiveEditingUser,
    openEdit,
    closeEdit,
    handleUpdate,
    pendingAction,
    requestAction,
    cancelAction,
    confirmAction,
    isSubmitting,
    mutationError,
    seatLimitReached,
    dismissSeatLimit: () => setSeatLimitReached(false),
    inviteQueuedUser,
    dismissInviteQueued: () => setInviteQueuedUser(null),
  };
}
