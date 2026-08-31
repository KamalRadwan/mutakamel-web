"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  deleteTenantUser,
  fetchTenantUser,
  setTenantUserStatus,
  updateTenantUser,
  type TenantUser,
  type UpdateUserInput,
} from "../../../contracts/user-contract";
import { allowedUserActions, type UserRowAction } from "../../hooks/useTenantUsers";

export function useTenantUserDetail(id: string) {
  const { t, lang } = useI18n();
  const { user: actor } = useTenantAuth();
  const permissions = actor?.permissions ?? [];

  const [user, setUser] = useState<TenantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingAction, setPendingAction] = useState<UserRowAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<NormalizedApiError | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
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
          if (!controller.signal.aborted) setUser(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setUser(null);
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

  const confirmAction = useCallback(async () => {
    if (!pendingAction || !user) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (pendingAction === "delete") {
        await deleteTenantUser(user.id);
        setIsDeleted(true);
      } else {
        setUser(await setTenantUserStatus(user.id, pendingAction));
      }
      setPendingAction(null);
    } catch (error) {
      setPendingAction(null);
      setActionError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingAction, user]);

  const saveEdits = useCallback(
    async (patch: UpdateUserInput): Promise<boolean> => {
      if (!user) return false;
      setIsSubmitting(true);
      setActionError(null);
      try {
        setUser(await updateTenantUser(user.id, patch));
        setIsEditOpen(false);
        return true;
      } catch (error) {
        setActionError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user],
  );

  return {
    t,
    lang,
    user,
    isEditOpen,
    openEdit: () => {
      setActionError(null);
      setIsEditOpen(true);
    },
    closeEdit: () => setIsEditOpen(false),
    saveEdits,
    isLoading,
    loadError,
    // A user deleted from this very screen is "gone" for the same reason a
    // stale link is: the record no longer exists and a retry cannot help.
    isMissing: isMissing || isDeleted,
    reload,
    canRead: permissions.includes("users.user.read"),
    canDeactivate: permissions.includes("users.user.deactivate"),
    canDelete: permissions.includes("users.user.delete"),
    canManageMemberships: permissions.includes("users.user.manage_memberships"),
    canAssignRoles: permissions.includes("users.user.assign_roles"),
    canUpdate: permissions.includes("users.user.update"),
    isTenantOwnerActor: actor?.isTenantOwner ?? false,
    allowedActions: user
      ? allowedUserActions(user, actor?.id ?? null)
      : { suspend: false, activate: false, delete: false },
    pendingAction,
    requestAction: setPendingAction,
    cancelAction: () => setPendingAction(null),
    confirmAction,
    isSubmitting,
    actionError,
  };
}
