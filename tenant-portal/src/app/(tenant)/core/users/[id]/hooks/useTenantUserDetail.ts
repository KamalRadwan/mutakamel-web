"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  deleteTenantUser,
  fetchTenantUser,
  resendTenantUserInvite,
  revokeTenantUserSessions,
  setTenantUserStatus,
  updateTenantUser,
  type TenantUser,
  type UpdateUserInput,
} from "../../../contracts/user-contract";
import {
  allowedUserActions,
  canAssignUserRoles,
  canManageUserMemberships,
  canManageUserModules,
  canPerformUserAction,
  canSubmitUserUpdate,
  type AllowedUserActions,
  type UserRowAction,
} from "../../user-permissions";

const NO_ACTIONS: AllowedUserActions = {
  edit: false,
  suspend: false,
  activate: false,
  revokeSessions: false,
  resendInvite: false,
  delete: false,
  reason: null,
};

interface ScopedState<T> {
  userId: string;
  value: T;
}

export function useTenantUserDetail(id: string) {
  const { t, lang } = useI18n();
  const { user: actor } = useTenantAuth();

  const [loadedUser, setLoadedUser] = useState<TenantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingState, setPendingState] = useState<ScopedState<UserRowAction> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionErrorState, setActionErrorState] =
    useState<ScopedState<NormalizedApiError> | null>(null);
  const [deletedUserId, setDeletedUserId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [inviteQueuedUserId, setInviteQueuedUserId] = useState<string | null>(null);

  const user = loadedUser?.id === id ? loadedUser : null;
  const pendingAction = pendingState?.userId === id ? pendingState.value : null;
  const actionError = actionErrorState?.userId === id ? actionErrorState.value : null;
  const isDeleted = deletedUserId === id;
  const inviteQueued = inviteQueuedUserId === id;

  const inFlightRef = useRef(false);
  const latestRef = useRef({ id, actor, user, isLoading, pendingState });

  useEffect(() => {
    latestRef.current = { id, actor, user, isLoading, pendingState };
  });

  const isSelfTarget = Boolean(user && user.id === actor?.id);
  const isProtectedTarget = Boolean(user && (user.isTenantOwner || isSelfTarget));
  const protectedTargetReason = isProtectedTarget
    ? user?.isTenantOwner
      ? t.coreIdentity.users.ownerManagementProtected
      : t.coreIdentity.users.selfManagementProtected
    : undefined;

  const allowedActions = user ? allowedUserActions(user, actor) : NO_ACTIONS;
  const canUpdateInBranch = Boolean(
    user && can(actor, "users.user.update", { branchId: user.branchId }),
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isUUIDv7(id)) {
        setIsLoading(false);
        setIsMissing(true);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setIsMissing(false);
      fetchTenantUser(id, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setLoadedUser(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setLoadedUser(null);
          if (normalized.status === 404) setIsMissing(true);
          else setLoadError(normalized);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const openEdit = useCallback(() => {
    const state = latestRef.current;
    if (
      inFlightRef.current ||
      state.isLoading ||
      !state.user ||
      !allowedUserActions(state.user, state.actor).edit
    ) {
      return;
    }
    setActionErrorState(null);
    setEditUserId(state.user.id);
  }, []);

  const closeEdit = useCallback(() => {
    if (inFlightRef.current) return;
    setEditUserId(null);
    setActionErrorState(null);
  }, []);

  const requestAction = useCallback((action: UserRowAction) => {
    const state = latestRef.current;
    if (
      inFlightRef.current ||
      state.isLoading ||
      !state.user ||
      !canPerformUserAction(state.actor, state.user, action)
    ) {
      return;
    }
    setActionErrorState(null);
    const scoped = { userId: state.user.id, value: action };
    latestRef.current.pendingState = scoped;
    setPendingState(scoped);
  }, []);

  const cancelAction = useCallback(() => {
    if (inFlightRef.current) return;
    latestRef.current.pendingState = null;
    setPendingState(null);
    setActionErrorState(null);
  }, []);

  const confirmAction = useCallback(async () => {
    if (inFlightRef.current) return;
    const state = latestRef.current;
    const currentPending =
      state.pendingState?.userId === state.id ? state.pendingState.value : null;
    if (!currentPending) return;

    if (
      state.isLoading ||
      !state.user ||
      !canPerformUserAction(state.actor, state.user, currentPending)
    ) {
      latestRef.current.pendingState = null;
      setPendingState(null);
      return;
    }

    const currentUser = state.user;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setActionErrorState(null);
    try {
      if (currentPending === "delete") {
        await deleteTenantUser(currentUser.id);
        setDeletedUserId(currentUser.id);
      } else if (currentPending === "resendInvite") {
        const result = await resendTenantUserInvite(currentUser.id);
        if (result.deliveryStatus === "QUEUED") {
          setInviteQueuedUserId(currentUser.id);
        }
      } else if (currentPending === "revokeSessions") {
        setLoadedUser(await revokeTenantUserSessions(currentUser.id));
      } else {
        const next = await setTenantUserStatus(currentUser.id, currentPending);
        setLoadedUser(next);
        if (next.status !== "INVITED") {
          setInviteQueuedUserId((prev) => (prev === currentUser.id ? null : prev));
        }
      }
      latestRef.current.pendingState = null;
      setPendingState(null);
    } catch (error) {
      setActionErrorState({ userId: currentUser.id, value: normalizeApiError(error) });
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  const saveEdits = useCallback(
    async (patch: UpdateUserInput): Promise<boolean> => {
      if (inFlightRef.current) return false;
      const state = latestRef.current;
      if (
        state.isLoading ||
        !state.user ||
        !canSubmitUserUpdate(state.actor, state.user, patch.branchId)
      ) {
        return false;
      }
      const currentUser = state.user;
      inFlightRef.current = true;
      setIsSubmitting(true);
      setActionErrorState(null);
      try {
        setLoadedUser(await updateTenantUser(currentUser.id, patch));
        setEditUserId(null);
        return true;
      } catch (error) {
        setActionErrorState({ userId: currentUser.id, value: normalizeApiError(error) });
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    t,
    lang,
    user,
    isEditOpen: editUserId === id && allowedActions.edit,
    isProtectedTarget,
    isSelfTarget,
    protectedTargetReason,
    openEdit,
    closeEdit,
    saveEdits,
    isLoading,
    loadError,
    isMissing: isMissing || isDeleted,
    reload,
    canRead: can(actor, "users.user.read"),
    canReadAddonAssignments:
      actor?.isTenantOwner === true ||
      can(actor, "applications.addon_seats.read") ||
      can(actor, "applications.addon_seats.manage"),
    canUpdateInBranch,
    canManageMemberships: canManageUserMemberships(actor, user),
    canAssignRoles: canAssignUserRoles(actor),
    canManageModules: canManageUserModules(actor, user),
    isTenantOwnerActor: actor?.isTenantOwner ?? false,
    allowedActions,
    pendingAction,
    requestAction,
    cancelAction,
    confirmAction,
    isSubmitting,
    actionError,
    inviteQueued,
    dismissInviteQueued: () => setInviteQueuedUserId(null),
  };
}
