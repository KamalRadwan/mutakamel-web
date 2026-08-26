"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, X, Loader2, Mail, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  inviteAdminUser,
  listAdminUsers,
  listRoles,
} from "../api/adminUsersApi";
import { getErrorMessageAndDetails } from "../utils/errorMapping";
import {
  claimAdminUserWriteIntent,
  settleAdminUserWriteIntent,
  type AdminUserWriteIntent,
} from "../model/writeIntent";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import type { AdminRole, CreateAdminUserDto } from "../types";

export function InviteUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAmbiguous, setIsAmbiguous] = useState(false);
  const inviteIntentRef = useRef<AdminUserWriteIntent<CreateAdminUserDto> | null>(
    null,
  );

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesForbidden, setRolesForbidden] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadRolesData() {
      try {
        setRolesForbidden(false);
        const res = await listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" });
        const items = res?.data;
        if (Array.isArray(items)) {
          setRoles(items);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if ((items as any)?.items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRoles((items as any).items);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setRolesForbidden(true);
        } else {
          toast.error(lang === "ar" ? "تعذر تحميل الأدوار" : "Failed to load roles");
        }
      } finally {
        setIsLoadingRoles(false);
      }
    }
    loadRolesData();
  }, [lang, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !roleId) return;

    const command: CreateAdminUserDto = {
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleId,
      isSuperAdmin: user?.isSuperAdmin ? isSuperAdmin : false,
    };
    let intent: AdminUserWriteIntent<CreateAdminUserDto>;
    try {
      intent = claimAdminUserWriteIntent(
        inviteIntentRef.current,
        "POST",
        "/api/admin/core/v1/users",
        command,
      );
    } catch {
      toast.error(
        lang === "ar" ? "\u0627\u0644\u0637\u0644\u0628 \u063a\u064a\u0631 \u0645\u0637\u0627\u0628\u0642" : "Request changed",
        lang === "ar"
          ? "\u0623\u0639\u062f \u0627\u0644\u0642\u064a\u0645 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629."
          : "Restore the original values before retrying the unresolved invitation.",
      );
      return;
    }
    inviteIntentRef.current = intent;

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      await inviteAdminUser(intent.command, intent.idempotencyKey);
      inviteIntentRef.current = null;
      setIsAmbiguous(false);

      toast.success(
        lang === "ar" ? "تمت الدعوة بنجاح" : "Invitation Sent",
        lang === "ar"
          ? "تم إرسال دعوة الانضمام للمشرف الجديد بنجاح."
          : "The invitation email has been sent successfully."
      );

      onSuccess();
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      const nextIntent = settleAdminUserWriteIntent(intent, err, normalized);
      inviteIntentRef.current = nextIntent;
      const ambiguous = nextIntent?.ambiguous === true;
      setIsAmbiguous(ambiguous);

      if (ambiguous && (await invitedUserExists(intent.command))) {
        inviteIntentRef.current = null;
        setIsAmbiguous(false);
        toast.success(
          lang === "ar" ? "\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0639\u0648\u0629" : "Invitation confirmed",
          lang === "ar"
            ? "\u0623\u0643\u062f\u062a \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0623\u0646 \u0627\u0644\u062f\u0639\u0648\u0629 \u062d\u0641\u0638\u062a \u0628\u0646\u062c\u0627\u062d."
            : "An authoritative user read confirmed the invitation was saved.",
        );
        onSuccess();
        onClose();
        return;
      }

      const details = getErrorMessageAndDetails(err, lang);
      if (details.fieldErrors) {
        setFieldErrors(details.fieldErrors);
      }
      if (!details.fieldErrors || Object.keys(details.fieldErrors).length === 0) {
        toast.error(lang === "ar" ? "فشل إرسال الدعوة" : "Invitation Failed", details.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAr = lang === "ar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-xl border border-white/20 dark:border-slate-700/50 max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute -top-32 -end-32 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -start-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <button
            onClick={onClose}
            disabled={isAmbiguous}
            aria-label={isAr ? "Close" : "Close"}
            className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.users.inviteTitle}
            </h2>
            <p className="text-xs text-slate-500">
              {t.users.inviteSubtitle}
            </p>
          </div>
        </div>

        <div className="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          {t.users.invitedInfoBanner}
        </div>

        {isAmbiguous ? (
          <div role="alert" className="p-3 mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            {isAr
              ? "\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u062f\u0639\u0648\u0629 \u063a\u064a\u0631 \u0645\u0624\u0643\u062f\u0629. \u0623\u0639\u062f \u0645\u062d\u0627\u0648\u0644\u0629 \u0646\u0641\u0633 \u0627\u0644\u0637\u0644\u0628."
              : "The invitation outcome is unconfirmed. Retry the exact unchanged request."}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.users.firstNameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                maxLength={80}
                value={firstName}
                disabled={isAmbiguous}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={isAr ? "عمر" : "Omar"}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.users.lastNameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                maxLength={80}
                value={lastName}
                disabled={isAmbiguous}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={isAr ? "حسين" : "Hassan"}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.users.emailLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
              <input
                required
                type="email"
                maxLength={255}
                value={email}
                disabled={isAmbiguous}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
                placeholder="ops.manager@mutakamel.ai"
                className={`w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none ${
                  fieldErrors.email
                    ? "border-red-500 focus:border-red-500"
                    : "border-slate-200 dark:border-slate-700/80 focus:border-blue-600"
                }`}
              />
            </div>
            {fieldErrors.email && (
              <span className="text-xs text-red-500 font-medium block mt-1">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>
                {t.users.roleLabel} <span className="text-red-500">*</span>
              </span>
              {isLoadingRoles && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            </label>
            {rolesForbidden ? (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{t.users.rolesUnavailable}</span>
              </div>
            ) : (
              <select
                required
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={isLoadingRoles || isAmbiguous}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer disabled:opacity-50"
              >
                <option value="" disabled>
                  {isAr ? "اختر الدور" : "Select a role"}
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameI18n?.[lang] || r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {user?.isSuperAdmin && (
            <div className="pt-1">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSuperAdmin}
                  disabled={isAmbiguous}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="size-4 rounded text-blue-600 focus:ring-blue-600"
                />
                <div className="flex flex-col gap-0.5">
                  <span>{t.users.superAdminCheckbox}</span>
                  <span className="text-xs text-slate-400 font-normal">
                    {isAr
                      ? "يتجاوز جميع قيود الصلاحيات النظامية."
                      : "Bypasses all permission checks authoritative backend logic."}
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isAmbiguous}
              className="flex-1 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                rolesForbidden ||
                !email.trim() ||
                !firstName.trim() ||
                !lastName.trim() ||
                !roleId
              }
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? t.users.sendingInvite : t.users.sendInvite}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

async function invitedUserExists(command: CreateAdminUserDto): Promise<boolean> {
  try {
    const result = await listAdminUsers({
      page: 1,
      limit: 100,
      search: command.email,
    });
    return result.data.some(
      (candidate) =>
        candidate.email.toLowerCase() === command.email &&
        candidate.firstName === command.firstName &&
        candidate.lastName === command.lastName &&
        candidate.roleId === command.roleId &&
        candidate.isSuperAdmin === Boolean(command.isSuperAdmin),
    );
  } catch {
    return false;
  }
}
