"use client";
 
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  getAdminUser,
  getUserWebphone,
  listRoles,
  updateAdminUser,
  assignUserRole,
  updateUserWebphone,
  suspendAdminUser,
  activateAdminUser,
  deleteAdminUser,
  normalizeErrorCode,
} from "../api/adminUsersApi";
import { getErrorMessageAndDetails, type MappedErrorDetails } from "../utils/errorMapping";
import type {
  AdminUser,
  AdminRole,
  AdminWebphoneConfig,
  AdminUserStatus,
} from "../types";

export type WebphoneForm = {
  enabled: boolean;
  extension: string;
  sipUsername: string;
  sipPassword: string;
  displayName: string;
  outboundCallerId: string;
  transport: "ws" | "wss";
};

const emptyWebphoneForm: WebphoneForm = {
  enabled: false,
  extension: "",
  sipUsername: "",
  sipPassword: "",
  displayName: "",
  outboundCallerId: "",
  transport: "wss",
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

  const [user, setUser] = useState<AdminUser>();
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>([]);
  const [assignedRoleId, setAssignedRoleId] = useState<string | undefined>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [status, setStatus] = useState<AdminUserStatus>("INVITED");

  const [webphone, setWebphone] = useState<AdminWebphoneConfig>();
  const [webphoneForm, setWebphoneForm] = useState<WebphoneForm>(emptyWebphoneForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [sipUsernameError, setSipUsernameError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    setPermissionDenied(false);

    try {
      const [loadedUser, loadedWebphone, rolesData] = await Promise.all([
        getAdminUser(id),
        getUserWebphone(id).catch(() => undefined),
        listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" }).catch(() => undefined),
      ]);

      const assignedRoles = loadedUser.role ? [loadedUser.role] : [];
      const rolesList = rolesData?.data ?? assignedRoles;

      setUser(loadedUser);
      setFirstName(loadedUser.firstName);
      setLastName(loadedUser.lastName);
      setIsSuperAdmin(loadedUser.isSuperAdmin);
      setStatus(loadedUser.status);
      setAvailableRoles(rolesList);
      setAssignedRoleId(loadedUser.roleId ?? loadedUser.role?.id ?? undefined);

      if (loadedWebphone) {
        setWebphone(loadedWebphone);
        setWebphoneForm(webphoneFormFromConfig(loadedWebphone));
      }
    } catch (requestError: any) {
      const code = normalizeErrorCode(requestError);

      if (requestError?.response?.status === 404 || code === "ADMIN_USER_NOT_FOUND") {
        setNotFound(true);
      } else if (requestError?.response?.status === 403 || code === "MISSING_REQUIRED_PERMISSIONS") {
        setPermissionDenied(true);
      } else {
        const details = getErrorMessageAndDetails(requestError, lang);
        toast.error(lang === "ar" ? "فشل التحميل" : "Load Error", toastErrorMessage(details));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, lang, toast]);

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

  const saveIdentity = async () => {
    if (!user || !identityHasChanges || isSaving) return;
    if (!firstName.trim() || !lastName.trim()) {
      const msg = lang === "ar" ? "الاسم الأول واسم العائلة مطلوبان." : "First name and last name are required.";
      toast.error(lang === "ar" ? "حقل مطلوب" : "Required Field", msg);
      return;
    }

    setIsSaving(true);

    try {
      const updated = await updateAdminUser(user.id, {
        firstName: firstName.trim() !== user.firstName ? firstName.trim() : undefined,
        lastName: lastName.trim() !== user.lastName ? lastName.trim() : undefined,
        isSuperAdmin: isSuperAdmin !== user.isSuperAdmin ? isSuperAdmin : undefined,
      });

      setUser(updated);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setIsSuperAdmin(updated.isSuperAdmin);
      toast.success(
        lang === "ar" ? "تم الحفظ" : "Saved",
        lang === "ar" ? "تم تحديث البيانات الشخصية بنجاح." : "Identity profile updated successfully."
      );
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(lang === "ar" ? "خطأ في الحفظ" : "Save Error", toastErrorMessage(details));

      setFirstName(user.firstName);
      setLastName(user.lastName);
      setIsSuperAdmin(user.isSuperAdmin);
    } finally {
      setIsSaving(false);
    }
  };

  const saveRole = async () => {
    if (!user || !roleHasChanges || !assignedRoleId || isSaving) return;

    setIsSaving(true);

    try {
      await assignUserRole(user.id, { roleId: assignedRoleId });
      const freshUser = await getAdminUser(user.id);

      setUser(freshUser);
      setAssignedRoleId(freshUser.roleId ?? freshUser.role?.id ?? undefined);
      toast.success(
        lang === "ar" ? "تم تعيين الدور" : "Role Assigned",
        lang === "ar"
          ? "تم تحديث دور المشرف بنجاح وتم إبطال الجلسات السابقة."
          : "Role updated successfully. Active sessions have been invalidated."
      );
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(lang === "ar" ? "خطأ في الحفظ" : "Save Error", toastErrorMessage(details));

      setAssignedRoleId(user.roleId ?? user.role?.id ?? undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const saveWebphone = async () => {
    if (!user || !webphoneHasChanges || isSaving) return;

    const validationError = validateWebphoneForm(webphoneForm, webphone, lang);
    if (validationError) {
      toast.error(lang === "ar" ? "خطأ في التحقق" : "Validation Error", validationError);
      return;
    }

    setIsSaving(true);
    setExtensionError(null);
    setSipUsernameError(null);

    try {
      const payload = webphonePayloadFromForm(webphoneForm);
      const updated = await updateUserWebphone(user.id, payload);

      setWebphone(updated);
      setWebphoneForm(webphoneFormFromConfig(updated));
      toast.success(
        lang === "ar" ? "تم حفظ إعدادات الهاتف" : "Phone Settings Saved",
        lang === "ar" ? "تم تحديث إعدادات WebPhone بنجاح." : "WebPhone configuration updated successfully."
      );
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      if (details.fieldErrors?.extension) setExtensionError(details.fieldErrors.extension);
      if (details.fieldErrors?.sipUsername) setSipUsernameError(details.fieldErrors.sipUsername);

      toast.error(lang === "ar" ? "خطأ في الحفظ" : "Save Error", toastErrorMessage(details));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: "ACTIVE" | "SUSPENDED") => {
    if (!user || isSaving) return;

    setIsSaving(true);

    try {
      const updated =
        nextStatus === "ACTIVE" ? await activateAdminUser(user.id) : await suspendAdminUser(user.id);

      setUser(updated);
      setStatus(updated.status);
      toast.success(
        lang === "ar" ? "نجاح" : "Success",
        lang === "ar" ? "تم تحديث حالة المستخدم بنجاح." : "User status updated successfully."
      );
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(lang === "ar" ? "خطأ في التحديث" : "Update Error", toastErrorMessage(details));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || isSaving) return;

    setIsSaving(true);

    try {
      await deleteAdminUser(user.id);
      toast.success(
        lang === "ar" ? "تم الحذف" : "Deleted",
        lang === "ar" ? "تم حذف حساب المشرف بنجاح." : "Admin user deleted successfully."
      );
      router.push("/users");
    } catch (requestError: any) {
      const details = getErrorMessageAndDetails(requestError, lang);
      toast.error(lang === "ar" ? "خطأ في الحذف" : "Delete Error", toastErrorMessage(details));
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
    setSipPassword: (sipPassword: string) =>
      setWebphoneForm((current) => ({ ...current, sipPassword })),
    webphoneDisplayName: webphoneForm.displayName,
    setWebphoneDisplayName: (displayName: string) =>
      setWebphoneForm((current) => ({ ...current, displayName })),
    outboundCallerId: webphoneForm.outboundCallerId,
    setOutboundCallerId: (outboundCallerId: string) =>
      setWebphoneForm((current) => ({ ...current, outboundCallerId })),
    webphoneTransport: webphoneForm.transport,
    setWebphoneTransport: (transport: "ws" | "wss") =>
      setWebphoneForm((current) => ({ ...current, transport })),
    passwordConfigured: Boolean(webphone?.passwordConfigured),

    webphoneConfig: webphone,
    extensionError,
    sipUsernameError,

    saveIdentity,
    saveRole,
    saveWebphone,
    handleStatusChange,
    handleDelete,
  };
}

function webphoneFormFromConfig(config?: AdminWebphoneConfig | null): WebphoneForm {
  return {
    enabled: Boolean(config?.enabled),
    extension: config?.extension ?? "",
    sipUsername: config?.sipUsername ?? "",
    sipPassword: "",
    displayName: config?.displayName ?? "",
    outboundCallerId: config?.outboundCallerId ?? "",
    transport: config?.transport === "ws" ? "ws" : "wss",
  };
}

function webphonePayloadFromForm(form: WebphoneForm) {
  return {
    enabled: form.enabled,
    extension: nullableText(form.extension),
    sipUsername: nullableText(form.sipUsername),
    ...(form.sipPassword.trim() ? { sipPassword: form.sipPassword.trim() } : {}),
    displayName: nullableText(form.displayName),
    outboundCallerId: nullableText(form.outboundCallerId),
    transport: form.transport,
  };
}

function webphoneFormChanged(form: WebphoneForm, config?: AdminWebphoneConfig | null) {
  const baseline = webphoneFormFromConfig(config);
  return (
    form.enabled !== baseline.enabled ||
    form.extension.trim() !== baseline.extension ||
    form.sipUsername.trim() !== baseline.sipUsername ||
    Boolean(form.sipPassword.trim()) ||
    form.displayName.trim() !== baseline.displayName ||
    form.outboundCallerId.trim() !== baseline.outboundCallerId ||
    form.transport !== baseline.transport
  );
}

function validateWebphoneForm(
  form: WebphoneForm,
  config: AdminWebphoneConfig | undefined,
  lang: "ar" | "en"
) {
  if (!form.enabled) return undefined;
  if (!form.extension.trim() || !form.sipUsername.trim()) {
    return lang === "ar"
      ? "تفعيل WebPhone يتطلب رقم الامتداد واسم مستخدم SIP."
      : "Enabled WebPhone settings require an extension and SIP username.";
  }
  if (!form.sipPassword.trim() && !config?.passwordConfigured) {
    return lang === "ar"
      ? "تفعيل WebPhone يتطلب كلمة مرور SIP."
      : "Enabled WebPhone settings require a SIP password.";
  }
  return undefined;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
