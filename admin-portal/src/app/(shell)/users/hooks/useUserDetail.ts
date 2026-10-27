"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { notifyWebphoneChanged } from "@mutakamel/webphone-ui";
import { adminCan } from "@/lib/auth/rbac";
import {
  WEBPHONE_EXTENSIONS_PATH,
  createUserWebphone,
  getAdminUser,
  getExtensionServers,
  getUserWebphone,
  isForbiddenError,
  listWebphoneServers,
  putExtensionServers,
  updateAdminUser,
  assignUserRole,
  updateUserWebphone,
  userWebphonePath,
  userWebphoneServersPath,
  suspendAdminUser,
  activateAdminUser,
  resendAdminInvite,
  deleteAdminUser,
  normalizeErrorCode,
} from "../api/adminUsersApi";
import {
  extensionServerRowsChanged,
  extensionServersToRows,
  moveInList,
  rowsToExtensionServers,
  validateExtensionServerRows,
  type ExtensionServerRow,
  type WebphoneExtensionServer,
  type WebphoneServer,
} from "../../settings/webphone/webphone-contract";
import { getErrorMessageAndDetails, type MappedErrorDetails } from "../utils/errorMapping";
import type {
  AdminUser,
  AdminWebphoneExtension,
  AdminUserStatus,
} from "../types";
import {
  claimAdminUserWriteIntent,
  settleAdminUserWriteIntent,
  type AdminUserWriteIntent,
} from "../model/writeIntent";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { getUserRowPermissions } from "./useUserPermissions";
import { useAdminRoleCatalogue } from "./useAdminRoleCatalogue";

/**
 * The user's WebPhone identity.
 *
 * There is no transport here: a transport is the scheme of a server's own
 * WebSocket URL, so it belongs to the server the user is pointed at, not to
 * the user. Which servers those are, and in what order, is the separate chain
 * below.
 */
export type WebphoneForm = {
  enabled: boolean;
  extension: string;
  sipUsername: string;
  sipPassword: string;
  displayName: string;
  outboundCallerId: string;
};

const emptyWebphoneForm: WebphoneForm = {
  enabled: false,
  extension: "",
  sipUsername: "",
  sipPassword: "",
  displayName: "",
  outboundCallerId: "",
};

/** The editable credential fields, in the order the editor presents them. */
export type WebphoneFieldName = "extension" | "sipUsername" | "sipPassword";

/**
 * What a WebPhone save actually did.
 *
 * `ok` is true only for a write the server confirmed. A rejected form and a
 * failed request both report false, because the caller closes the editor on
 * this answer: returning nothing let a save that never left the browser look
 * exactly like one that landed, so the editor collapsed back to the summary
 * over a value that was never stored. `focusField` names the first field the
 * operator has to correct.
 */
export type WebphoneSaveOutcome = {
  ok: boolean;
  focusField?: WebphoneFieldName;
};

export type WebphoneReadState =
  | { status: "idle" | "loading" | "success" }
  | { status: "error"; message: string };

export type UserDetailLoadState =
  | "loading"
  | "ready"
  | "degraded"
  | "error"
  | "not-found"
  | "forbidden";

function toastErrorMessage(details: MappedErrorDetails) {
  return details.correlationId
    ? `${details.message}\nCorrelation ID: ${details.correlationId}`
    : details.message;
}

export function useUserDetail(id: string) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  // The extension list belongs to the WebPhone module, so an admin without its
  // read permission must not be sent there at all — the transport toasts every
  // 403 it sees, and one would fire on a screen that never asked for WebPhone.
  const canReadWebphone = adminCan(currentUser, "admin.webphone.read");

  const [user, setUser] = useState<AdminUser>();
  const rolePermissions = getUserRowPermissions(currentUser, user?.id, user?.status, user?.isSuperAdmin);
  const canAssignRole = user?.id === id && rolePermissions.canAssignRole && !rolePermissions.isSelf;
  const { roles, rolesStatus, reloadRoles } = useAdminRoleCatalogue(
    "assignment", canAssignRole, JSON.stringify([id, currentUser?.id, currentUser?.isSuperAdmin, currentUser?.permissions]),
  );
  const availableRoles = useMemo(() => {
    const assignedRole = user?.role;
    return assignedRole && !roles.some((role) => role.id === assignedRole.id)
      ? [assignedRole, ...roles] : roles;
  }, [roles, user]);
  const [assignedRoleId, setAssignedRoleId] = useState<string | undefined>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [status, setStatus] = useState<AdminUserStatus>("INVITED");

  const [webphone, setWebphone] = useState<AdminWebphoneExtension>();
  const [webphoneForm, setWebphoneForm] = useState<WebphoneForm>(emptyWebphoneForm);
  const [webphoneServers, setWebphoneServers] = useState<WebphoneServer[]>([]);
  const [serverChain, setServerChain] = useState<WebphoneExtensionServer[]>([]);
  const [serverChainRows, setServerChainRows] = useState<ExtensionServerRow[]>(
    [],
  );
  const [webphoneRead, setWebphoneRead] = useState<WebphoneReadState>({ status: "idle" });
  const [serversRead, setServersRead] = useState<WebphoneReadState>({ status: "idle" });
  const [chainRead, setChainRead] = useState<WebphoneReadState>({ status: "idle" });
  const webphoneReadVersion = useRef(0);

  const [detailLoad, setDetailLoad] = useState<{ id: string; status: UserDetailLoadState }>({ id, status: "loading" });
  const detailLoadState = detailLoad.id === id ? detailLoad.status : "loading";
  const isLoading = detailLoadState === "loading";
  const notFound = detailLoadState === "not-found";
  const permissionDenied = detailLoadState === "forbidden";
  const loadedUserId = useRef<string | undefined>(undefined);
  const userReadVersion = useRef(0);
  const [loadError, setLoadError] = useState<ReturnType<typeof normalizeApiError> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [sipUsernameError, setSipUsernameError] = useState<string | null>(null);
  const [sipPasswordError, setSipPasswordError] = useState<string | null>(null);
  const writeIntentsRef = useRef(
    new Map<string, AdminUserWriteIntent<unknown>>(),
  );
  const resendInFlight = useRef(false);

  const runWrite = useCallback(
    async <T,>(
      slot: string,
      method: "POST" | "PUT" | "PATCH" | "DELETE",
      path: string,
      command: T,
      invoke: (intent: AdminUserWriteIntent<T>) => Promise<unknown>,
      reconcile?: () => Promise<boolean>,
    ) => {
      const current = writeIntentsRef.current.get(slot) as
        | AdminUserWriteIntent<T>
        | undefined;
      const intent = claimAdminUserWriteIntent(
        current ?? null,
        method,
        path,
        command,
      );
      writeIntentsRef.current.set(slot, intent);
      try {
        const result = await invoke(intent);
        writeIntentsRef.current.delete(slot);
        return result;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        const next = settleAdminUserWriteIntent(intent, caught, normalized);
        if (next) writeIntentsRef.current.set(slot, next);
        else writeIntentsRef.current.delete(slot);
        if (next?.ambiguous && reconcile && (await reconcile())) {
          writeIntentsRef.current.delete(slot);
          return undefined;
        }
        throw caught;
      }
    },
    [],
  );

  const loadServerChain = useCallback(async (extensionId: string, version: number) => {
    if (version !== webphoneReadVersion.current) return false;
    setChainRead({ status: "loading" });
    try {
      const chain = await getExtensionServers(extensionId);
      if (version !== webphoneReadVersion.current) return false;
      setServerChain(chain);
      setServerChainRows(extensionServersToRows(chain));
      setChainRead({ status: "success" });
      return true;
    } catch (error) {
      if (version === webphoneReadVersion.current) {
        setChainRead({
          status: "error",
          message: toastErrorMessage(getErrorMessageAndDetails(error, lang)),
        });
      }
      return false;
    }
  }, [lang]);

  // Retry only the WebPhone resources, leaving unrelated user edits intact.
  // A generation prevents an old read from restoring an editable baseline.
  const reloadWebphone = useCallback(async () => {
    const version = ++webphoneReadVersion.current;
    if (!canReadWebphone) {
      setWebphoneRead({ status: "idle" });
      setServersRead({ status: "idle" });
      setChainRead({ status: "idle" });
      return;
    }
    setWebphoneRead({ status: "loading" });
    setServersRead({ status: "loading" });
    setChainRead({ status: "idle" });
    await Promise.all([
      (async () => {
        try {
          const extension = await getUserWebphone(id);
          if (version !== webphoneReadVersion.current) return;
          setWebphone(extension);
          setWebphoneForm(webphoneFormFromExtension(extension));
          setWebphoneRead({ status: "success" });
          if (extension) {
            await loadServerChain(extension.id, version);
          } else {
            // Only a successful owner lookup can establish an absent extension.
            setServerChain([]);
            setServerChainRows([]);
            setChainRead({ status: "success" });
          }
        } catch (error) {
          if (version === webphoneReadVersion.current) {
            setWebphoneRead({
              status: "error",
              message: toastErrorMessage(getErrorMessageAndDetails(error, lang)),
            });
          }
        }
      })(),
      (async () => {
        try {
          const servers = await listWebphoneServers();
          if (version !== webphoneReadVersion.current) return;
          setWebphoneServers(servers);
          setServersRead({ status: "success" });
        } catch (error) {
          if (version === webphoneReadVersion.current) {
            setServersRead({
              status: "error",
              message: toastErrorMessage(getErrorMessageAndDetails(error, lang)),
            });
          }
        }
      })(),
    ]);
  }, [canReadWebphone, id, lang, loadServerChain]);

  const loadUser = useCallback(async () => {
    const version = ++userReadVersion.current;
    setDetailLoad({ id, status: "loading" });
    setLoadError(null);

    try {
      const [loadedUser] =
        await Promise.all([
          getAdminUser(id),
          reloadWebphone(),
        ]);

      if (version !== userReadVersion.current) return;
      setUser(loadedUser);
      loadedUserId.current = id;
      setFirstName(loadedUser.firstName);
      setLastName(loadedUser.lastName);
      setIsSuperAdmin(loadedUser.isSuperAdmin);
      setStatus(loadedUser.status);
      setAssignedRoleId(loadedUser.roleId ?? loadedUser.role?.id ?? undefined);
      setDetailLoad({ id, status: "ready" });
    } catch (requestError: any) {
      if (version !== userReadVersion.current) return;
      const code = normalizeErrorCode(requestError);

      if (requestError?.response?.status === 404 || code === "ADMIN_USER_NOT_FOUND") {
        setDetailLoad({ id, status: "not-found" });
      } else if (isForbiddenError(requestError) || code === "MISSING_REQUIRED_PERMISSIONS") {
        setDetailLoad({ id, status: "forbidden" });
      } else {
        const details = getErrorMessageAndDetails(requestError, lang);
        setLoadError({ ...normalizeApiError(requestError), message: details.message });
        setDetailLoad({ id, status: loadedUserId.current === id ? "degraded" : "error" });
      }
    }
  }, [id, lang, reloadWebphone]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadUser(); });
    return () => {
      active = false;
      userReadVersion.current++;
      webphoneReadVersion.current++;
    };
  }, [loadUser]);

  const identityHasChanges = useMemo(() => {
    if (!user) return false;
    return (
      firstName.trim() !== user.firstName ||
      lastName.trim() !== user.lastName ||
      isSuperAdmin !== user.isSuperAdmin
    );
  }, [user, firstName, lastName, isSuperAdmin]);

  const roleHasChanges = useMemo(() => {
    if (!user) return false;
    return (assignedRoleId ?? null) !== (user.roleId ?? null);
  }, [user, assignedRoleId]);

  const webphoneHasChanges = useMemo(
    () => webphoneFormChanged(webphoneForm, webphone),
    [webphone, webphoneForm]
  );

  const serverChainErrors = useMemo(
    () => validateExtensionServerRows(serverChainRows),
    [serverChainRows],
  );

  const serverChainHasChanges = useMemo(
    () => extensionServerRowsChanged(serverChainRows, serverChain),
    [serverChain, serverChainRows],
  );

  const canEditServerChain = Boolean(webphone) && user?.id === id &&
    canReadWebphone && adminCan(currentUser, "admin.webphone.update") &&
    webphoneRead.status === "success" && serversRead.status === "success" &&
    chainRead.status === "success";

  const moveServerChainRow = useCallback((from: number, to: number) => {
    setServerChainRows((current) => moveInList(current, from, to));
  }, []);

  const updateServerChainRow = useCallback(
    (
      serverId: string,
      field: "timeoutSeconds" | "maxRetries",
      value: string,
    ) => {
      setServerChainRows((current) =>
        current.map((row) =>
          row.serverId === serverId ? { ...row, [field]: value } : row,
        ),
      );
    },
    [],
  );

  const addServerToChain = useCallback((serverId: string) => {
    setServerChainRows((current) =>
      current.some((row) => row.serverId === serverId)
        ? current
        : // Blank overrides mean "inherit this server's defaults", which is
          // the right starting point for a link nobody has tuned yet.
          [...current, { serverId, timeoutSeconds: "", maxRetries: "" }],
    );
  }, []);

  const removeServerFromChain = useCallback((serverId: string) => {
    setServerChainRows((current) =>
      current.filter((row) => row.serverId !== serverId),
    );
  }, []);

  const resetServerChain = useCallback(() => {
    setServerChainRows(extensionServersToRows(serverChain));
  }, [serverChain]);

  const saveServerChain = async () => {
    if (!canEditServerChain || !webphone || !serverChainHasChanges || isSaving) return;
    if (Object.keys(serverChainErrors).length > 0) {
      toast.error(t.users.validationErrorTitle, t.users.serverChainInvalidMsg);
      return;
    }

    const readVersion = webphoneReadVersion.current;
    setIsSaving(true);

    try {
      const chain = rowsToExtensionServers(serverChainRows);
      await runWrite(
        "webphone:servers",
        "PUT",
        userWebphoneServersPath(webphone.id),
        chain,
        (intent) =>
          putExtensionServers(webphone.id, intent.command, intent.idempotencyKey),
        async () => {
          // The write replaces the whole chain, so the stored order either
          // matches what was sent or the write never landed — nothing partial
          // to reason about.
          const fresh = await getExtensionServers(webphone.id).catch(() => null);
          if (!fresh) return false;
          const matches = chainsMatch(chain, fresh);
          if (matches && readVersion === webphoneReadVersion.current) {
            setServerChain(fresh);
            setServerChainRows(extensionServersToRows(fresh));
          }
          return matches;
        },
      );

      const refreshed = await loadServerChain(webphone.id, readVersion);
      // The dock resolves its failover order from `/me`, so a reordered chain
      // is stale there until this signal makes it read again.
      notifyWebphoneChanged();
      if (refreshed) toast.success(t.users.serverChainSavedTitle, t.users.serverChainSavedDesc);
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.saveErrorTitle, toastErrorMessage(details));
    } finally {
      setIsSaving(false);
    }
  };

  const saveIdentity = async () => {
    if (!user || !identityHasChanges || isSaving) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(t.users.requiredFieldTitle, t.users.identityRequiredFieldMsg);
      return;
    }

    setIsSaving(true);

    try {
      const command = {
        firstName: firstName.trim() !== user.firstName ? firstName.trim() : undefined,
        lastName: lastName.trim() !== user.lastName ? lastName.trim() : undefined,
        isSuperAdmin: isSuperAdmin !== user.isSuperAdmin ? isSuperAdmin : undefined,
      };
      let updated = (await runWrite(
        "identity",
        "PATCH",
        `/api/admin/core/v1/users/${encodeURIComponent(user.id)}`,
        command,
        (intent) => updateAdminUser(user.id, intent.command, intent.idempotencyKey),
        async () => {
          const fresh = await getAdminUser(user.id).catch(() => null);
          if (!fresh) return false;
          const matches =
            (command.firstName === undefined || fresh.firstName === command.firstName) &&
            (command.lastName === undefined || fresh.lastName === command.lastName) &&
            (command.isSuperAdmin === undefined || fresh.isSuperAdmin === command.isSuperAdmin);
          if (matches) setUser(fresh);
          return matches;
        },
      )) as AdminUser | undefined;
      updated ??= await getAdminUser(user.id);

      setUser(updated);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setIsSuperAdmin(updated.isSuperAdmin);
      toast.success(t.users.identitySavedTitle, t.users.identitySavedDesc);
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.saveErrorTitle, toastErrorMessage(details));

      if (!writeIntentsRef.current.get("identity")?.ambiguous) {
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setIsSuperAdmin(user.isSuperAdmin);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveRole = async () => {
    if (!canAssignRole || !user || !roleHasChanges || !assignedRoleId || isSaving) return;
    if (rolesStatus !== "success" || !roles.some((role) => role.id === assignedRoleId)) return;

    setIsSaving(true);

    try {
      const command = { roleId: assignedRoleId };
      await runWrite(
        "role",
        "PATCH",
        `/api/admin/core/v1/users/${encodeURIComponent(user.id)}/roles`,
        command,
        (intent) => assignUserRole(user.id, intent.command, intent.idempotencyKey),
        async () => {
          const fresh = await getAdminUser(user.id).catch(() => null);
          return fresh?.roleId === command.roleId;
        },
      );
      const freshUser = await getAdminUser(user.id);

      setUser(freshUser);
      setAssignedRoleId(freshUser.roleId ?? freshUser.role?.id ?? undefined);
      toast.success(t.users.roleAssignedTitle, t.users.roleAssignedDesc);
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.saveErrorTitle, toastErrorMessage(details));

      if (!writeIntentsRef.current.get("role")?.ambiguous) {
        setAssignedRoleId(user.roleId ?? user.role?.id ?? undefined);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveWebphone = async (): Promise<WebphoneSaveOutcome> => {
    if (!user || user.id !== id || !canReadWebphone ||
        !adminCan(currentUser, "admin.webphone.update") ||
        webphoneRead.status !== "success" || !webphoneHasChanges || isSaving) return { ok: false };

    // A rejected form is reported on the fields themselves, not only as a
    // toast: an inline error is the persistent, programmatically associated
    // target the operator can correct, and it survives the toast timing out
    // (docs/design-system/toast-contract.md).
    const invalidField = firstInvalidWebphoneField(webphoneForm, webphone);
    if (invalidField) {
      const message =
        invalidField === "sipPassword"
          ? t.users.webphoneRequiresPasswordMsg
          : t.users.webphoneRequiresExtensionMsg;
      setExtensionError(invalidField === "extension" ? message : null);
      setSipUsernameError(invalidField === "sipUsername" ? message : null);
      setSipPasswordError(invalidField === "sipPassword" ? message : null);
      toast.error(t.users.validationErrorTitle, message);
      return { ok: false, focusField: invalidField };
    }

    const readVersion = webphoneReadVersion.current;
    setIsSaving(true);
    setExtensionError(null);
    setSipUsernameError(null);
    setSipPasswordError(null);

    try {
      const fields = webphoneFieldsFromForm(webphoneForm);
      const existing = webphone;

      // An ambiguous write is reconciled against the owner's extension either
      // way: after a create it proves the row now exists, after an update that
      // the edit landed. Both read the same list, so one closure serves both.
      const reconcile = async () => {
        const fresh = await getUserWebphone(user.id).catch(() => null);
        if (!fresh) return false;
        const matches = webphoneFieldsMatch(fields, fresh);
        if (matches && readVersion === webphoneReadVersion.current) setWebphone(fresh);
        return matches;
      };

      // A user with no extension row is having their first one created; the
      // module keys extensions by owner and allows at most one per user, so
      // this branch is the whole difference between the two writes.
      let updated = (existing
        ? await runWrite(
            "webphone",
            "PATCH",
            userWebphonePath(existing.id),
            fields,
            (intent) =>
              updateUserWebphone(existing.id, intent.command, intent.idempotencyKey),
            reconcile,
          )
        : await runWrite(
            "webphone",
            "POST",
            WEBPHONE_EXTENSIONS_PATH,
            { ownerId: user.id, ...fields },
            (intent) => createUserWebphone(intent.command, intent.idempotencyKey),
            reconcile,
          )) as AdminWebphoneExtension | undefined;
      updated ??= await getUserWebphone(user.id);

      if (readVersion !== webphoneReadVersion.current) return { ok: false };
      setWebphone(updated);
      setWebphoneForm(webphoneFormFromExtension(updated));
      // A first save creates the extension, and only then does it have an id
      // to hang a chain off — so the chain is read here rather than left empty
      // until the next full page load.
      if (!existing && updated) {
        await loadServerChain(updated.id, readVersion);
      }
      // The dock in the root layout read `/me` when the shell mounted. If this
      // save was the admin giving themselves a phone, that read is now stale
      // and only this signal makes the widget appear without a page reload.
      notifyWebphoneChanged();
      toast.success(t.users.webphoneSavedTitle, t.users.webphoneSavedDesc);
      return { ok: true };
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      if (details.fieldErrors?.extension) setExtensionError(details.fieldErrors.extension);
      if (details.fieldErrors?.sipUsername) setSipUsernameError(details.fieldErrors.sipUsername);

      toast.error(t.users.saveErrorTitle, toastErrorMessage(details));
      // The extension was not stored, so the editor stays open over the values
      // the operator submitted rather than collapsing to a stale summary.
      return {
        ok: false,
        focusField: details.fieldErrors?.extension
          ? "extension"
          : details.fieldErrors?.sipUsername
            ? "sipUsername"
            : undefined,
      };
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendInvite = async () => {
    if (!user || isSaving || resendInFlight.current ||
        !getUserRowPermissions(currentUser, user.id, user.status, user.isSuperAdmin).canResendInvite) return;
    resendInFlight.current = true;
    setIsSaving(true);
    try {
      const updated = await runWrite(
        "resend-invite",
        "POST",
        `/api/admin/core/v1/users/${encodeURIComponent(user.id)}/resend-invite`,
        {},
        (intent) => resendAdminInvite(user.id, intent.idempotencyKey),
      ) as AdminUser;
      setUser(updated);
      setStatus(updated.status);
      toast.success(t.users.inviteResentTitle, t.users.inviteResentDesc);
    } catch (requestError: unknown) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.updateErrorTitle, toastErrorMessage(details));
    } finally {
      resendInFlight.current = false;
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: "ACTIVE" | "SUSPENDED") => {
    if (!user || isSaving) return;

    setIsSaving(true);

    try {
      const action = nextStatus === "ACTIVE" ? "activate" : "suspend";
      let updated = (await runWrite(
        `status:${action}`,
        "POST",
        `/api/admin/core/v1/users/${encodeURIComponent(user.id)}/${action}`,
        {},
        (intent) =>
          nextStatus === "ACTIVE"
            ? activateAdminUser(user.id, intent.idempotencyKey)
            : suspendAdminUser(user.id, intent.idempotencyKey),
        async () => {
          const fresh = await getAdminUser(user.id).catch(() => null);
          if (fresh?.status === nextStatus) setUser(fresh);
          return fresh?.status === nextStatus;
        },
      )) as AdminUser | undefined;
      updated ??= await getAdminUser(user.id);

      setUser(updated);
      setStatus(updated.status);
      toast.success(t.users.statusUpdatedTitle, t.users.statusUpdatedDesc);
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.updateErrorTitle, toastErrorMessage(details));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || isSaving) return;

    setIsSaving(true);

    try {
      await runWrite(
        "delete",
        "DELETE",
        `/api/admin/core/v1/users/${encodeURIComponent(user.id)}`,
        null,
        (intent) => deleteAdminUser(user.id, intent.idempotencyKey),
        async () => {
          try {
            await getAdminUser(user.id);
            return false;
          } catch (caught) {
            return normalizeErrorCode(caught) === "ADMIN_USER_NOT_FOUND" ||
              (caught as { response?: { status?: number } })?.response?.status === 404;
          }
        },
      );
      toast.success(t.users.deletedTitle, t.users.deletedFromDetailDesc);
      router.push("/users");
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(t.users.deleteErrorTitle, toastErrorMessage(details));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    lang,
    t,
    router,
    user,
    isLoading,
    detailLoadState,
    loadError,
    isSaving,
    notFound,
    permissionDenied,
    reload: loadUser,
    handleResendInvite,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email: user?.email ?? "",
    isSuperAdmin,
    setIsSuperAdmin,
    assignedRoleId,
    setAssignedRoleId,
    availableRoles,
    hasAssignableRoles: roles.length > 0,
    rolesStatus,
    reloadRoles,
    status,

    identityHasChanges,
    roleHasChanges,
    webphoneHasChanges,

    webphoneEnabled: webphoneForm.enabled,
    setWebphoneEnabled: (enabled: boolean) =>
      setWebphoneForm((current) => ({ ...current, enabled })),
    sipExtension: webphoneForm.extension,
    setSipExtension: (extension: string) => {
      setExtensionError(null);
      setWebphoneForm((current) => ({ ...current, extension }));
    },
    sipUsername: webphoneForm.sipUsername,
    setSipUsername: (sipUsername: string) => {
      setSipUsernameError(null);
      setWebphoneForm((current) => ({ ...current, sipUsername }));
    },
    sipPassword: webphoneForm.sipPassword,
    setSipPassword: (sipPassword: string) => {
      setSipPasswordError(null);
      setWebphoneForm((current) => ({ ...current, sipPassword }));
    },
    webphoneDisplayName: webphoneForm.displayName,
    setWebphoneDisplayName: (displayName: string) =>
      setWebphoneForm((current) => ({ ...current, displayName })),
    outboundCallerId: webphoneForm.outboundCallerId,
    setOutboundCallerId: (outboundCallerId: string) =>
      setWebphoneForm((current) => ({ ...current, outboundCallerId })),
    passwordConfigured: Boolean(webphone?.passwordConfigured),

    webphoneExtension: webphone,
    webphoneRead,
    serversRead,
    chainRead,
    reloadWebphone,
    extensionError,
    sipUsernameError,
    sipPasswordError,

    webphoneServers,
    serverChainRows,
    serverChainErrors,
    serverChainHasChanges,
    canEditServerChain,
    moveServerChainRow,
    updateServerChainRow,
    addServerToChain,
    removeServerFromChain,
    resetServerChain,
    saveServerChain,

    saveIdentity,
    saveRole,
    saveWebphone,
    handleStatusChange,
    handleDelete,
  };
}

function chainsMatch(
  sent: readonly WebphoneExtensionServer[],
  stored: readonly WebphoneExtensionServer[],
): boolean {
  return (
    sent.length === stored.length &&
    sent.every((link, index) => {
      const current = stored[index];
      return (
        link.serverId === current.serverId &&
        link.timeoutSeconds === current.timeoutSeconds &&
        link.maxRetries === current.maxRetries
      );
    })
  );
}

function webphoneFormFromExtension(
  extension?: AdminWebphoneExtension | null,
): WebphoneForm {
  return {
    enabled: Boolean(extension?.enabled),
    extension: extension?.extension ?? "",
    sipUsername: extension?.sipUsername ?? "",
    sipPassword: "",
    displayName: extension?.displayName ?? "",
    outboundCallerId: extension?.outboundCallerId ?? "",
  };
}

/**
 * The editable fields, shaped for the wire.
 *
 * Both writes carry the same fields — a create only adds the owner — so one
 * builder serves both, and the same object is what an ambiguous write is
 * reconciled against.
 */
function webphoneFieldsFromForm(form: WebphoneForm) {
  const sipPassword = form.sipPassword.trim();
  return {
    enabled: form.enabled,
    extension: form.extension.trim(),
    sipUsername: form.sipUsername.trim(),
    displayName: nullableText(form.displayName),
    outboundCallerId: nullableText(form.outboundCallerId),
    ...(sipPassword ? { sipPassword } : {}),
  };
}

function webphoneFormChanged(
  form: WebphoneForm,
  extension?: AdminWebphoneExtension | null,
) {
  const baseline = webphoneFormFromExtension(extension);
  return (
    form.enabled !== baseline.enabled ||
    form.extension.trim() !== baseline.extension ||
    form.sipUsername.trim() !== baseline.sipUsername ||
    Boolean(form.sipPassword.trim()) ||
    form.displayName.trim() !== baseline.displayName ||
    form.outboundCallerId.trim() !== baseline.outboundCallerId
  );
}

/**
 * The first field the operator has to fix, or undefined when the form is
 * submittable. Returning the field rather than a message is what lets the
 * editor mark and focus it instead of only announcing a toast.
 */
export function firstInvalidWebphoneField(
  form: WebphoneForm,
  extension?: AdminWebphoneExtension,
): WebphoneFieldName | undefined {
  // An extension row cannot exist without a number and a SIP username, so both
  // are required for every save — not only when enabling. Clearing them does
  // not delete the extension; that is done from Settings → WebPhone.
  if (!form.extension.trim()) return "extension";
  if (!form.sipUsername.trim()) return "sipUsername";
  if (form.enabled && !form.sipPassword.trim() && !extension?.passwordConfigured) {
    return "sipPassword";
  }
  return undefined;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function webphoneFieldsMatch(
  fields: ReturnType<typeof webphoneFieldsFromForm>,
  extension: AdminWebphoneExtension,
): boolean {
  return (
    extension.enabled === fields.enabled &&
    extension.extension === fields.extension &&
    extension.sipUsername === fields.sipUsername &&
    extension.displayName === fields.displayName &&
    extension.outboundCallerId === fields.outboundCallerId &&
    // A submitted password can never be confirmed from a response that only
    // reports whether one exists, so such a write stays ambiguous.
    !("sipPassword" in fields)
  );
}
