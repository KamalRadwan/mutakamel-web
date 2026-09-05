"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { notifyWebphoneChanged } from "@mutakamel/webphone";
import { adminCan } from "@/lib/auth/rbac";
import {
  WEBPHONE_EXTENSIONS_PATH,
  createUserWebphone,
  getAdminUser,
  getExtensionServers,
  getUserWebphone,
  isForbiddenError,
  listRoles,
  listWebphoneServers,
  putExtensionServers,
  updateAdminUser,
  assignUserRole,
  updateUserWebphone,
  userWebphonePath,
  userWebphoneServersPath,
  suspendAdminUser,
  activateAdminUser,
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
  AdminRole,
  AdminWebphoneExtension,
  AdminUserStatus,
} from "../types";
import {
  claimAdminUserWriteIntent,
  settleAdminUserWriteIntent,
  type AdminUserWriteIntent,
} from "../model/writeIntent";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

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
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>([]);
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [sipUsernameError, setSipUsernameError] = useState<string | null>(null);
  const [sipPasswordError, setSipPasswordError] = useState<string | null>(null);
  const writeIntentsRef = useRef(
    new Map<string, AdminUserWriteIntent<unknown>>(),
  );

  const runWrite = useCallback(
    async <T,>(
      slot: string,
      method: "POST" | "PATCH" | "DELETE",
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

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    setPermissionDenied(false);

    try {
      const [loadedUser, loadedWebphone, loadedServers, rolesData] =
        await Promise.all([
          getAdminUser(id),
          canReadWebphone ? getUserWebphone(id).catch(() => undefined) : undefined,
          canReadWebphone ? listWebphoneServers().catch(() => []) : [],
          listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" }).catch(() => undefined),
        ]);

      // The chain hangs off the extension, so it can only be read once the
      // extension id is known — a user with no extension has no chain, which
      // is an empty list rather than a failed read.
      const loadedChain = loadedWebphone
        ? await getExtensionServers(loadedWebphone.id).catch(() => [])
        : [];

      const assignedRoles = loadedUser.role ? [loadedUser.role] : [];
      const rolesList = rolesData?.data ?? assignedRoles;

      setUser(loadedUser);
      setFirstName(loadedUser.firstName);
      setLastName(loadedUser.lastName);
      setIsSuperAdmin(loadedUser.isSuperAdmin);
      setStatus(loadedUser.status);
      setAvailableRoles(rolesList);
      setAssignedRoleId(loadedUser.roleId ?? loadedUser.role?.id ?? undefined);

      // Set unconditionally: a user with no extension is a real state, and a
      // reload after one is removed elsewhere must clear the panel, not keep
      // showing the extension that no longer exists.
      setWebphone(loadedWebphone);
      setWebphoneForm(webphoneFormFromExtension(loadedWebphone));
      setWebphoneServers(loadedServers);
      setServerChain(loadedChain);
      setServerChainRows(extensionServersToRows(loadedChain));
    } catch (requestError: any) {
      const code = normalizeErrorCode(requestError);

      if (requestError?.response?.status === 404 || code === "ADMIN_USER_NOT_FOUND") {
        setNotFound(true);
      } else if (isForbiddenError(requestError) || code === "MISSING_REQUIRED_PERMISSIONS") {
        setPermissionDenied(true);
      } else {
        const details = getErrorMessageAndDetails(requestError, lang);
        toast.error(t.users.loadFailedTitle, toastErrorMessage(details));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, lang, t, toast, canReadWebphone]);

  useEffect(() => {
    queueMicrotask(() => loadUser());
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
    if (!webphone || !serverChainHasChanges || isSaving) return;
    if (Object.keys(serverChainErrors).length > 0) {
      toast.error(t.users.validationErrorTitle, t.users.serverChainInvalidMsg);
      return;
    }

    setIsSaving(true);

    try {
      const chain = rowsToExtensionServers(serverChainRows);
      await runWrite(
        "webphone:servers",
        "PATCH",
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
          if (matches) {
            setServerChain(fresh);
            setServerChainRows(extensionServersToRows(fresh));
          }
          return matches;
        },
      );

      const fresh = await getExtensionServers(webphone.id);
      setServerChain(fresh);
      setServerChainRows(extensionServersToRows(fresh));
      // The dock resolves its failover order from `/me`, so a reordered chain
      // is stale there until this signal makes it read again.
      notifyWebphoneChanged();
      toast.success(t.users.serverChainSavedTitle, t.users.serverChainSavedDesc);
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
    if (!user || !roleHasChanges || !assignedRoleId || isSaving) return;

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
    if (!user || !webphoneHasChanges || isSaving) return { ok: false };

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
        if (matches) setWebphone(fresh);
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

      setWebphone(updated);
      setWebphoneForm(webphoneFormFromExtension(updated));
      // A first save creates the extension, and only then does it have an id
      // to hang a chain off — so the chain is read here rather than left empty
      // until the next full page load.
      if (!existing && updated) {
        const chain = await getExtensionServers(updated.id).catch(() => []);
        setServerChain(chain);
        setServerChainRows(extensionServersToRows(chain));
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
    isSaving,
    notFound,
    permissionDenied,
    reload: loadUser,

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
    extensionError,
    sipUsernameError,
    sipPasswordError,

    webphoneServers,
    serverChainRows,
    serverChainErrors,
    serverChainHasChanges,
    // A chain hangs off an extension, so it can only be edited once one exists.
    canEditServerChain: Boolean(webphone),
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
