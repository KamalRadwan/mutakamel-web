"use client";

import { useEffect, useState } from "react";
import { UserPlus, X, Loader2, Mail, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import { inviteAdminUser, listRoles } from "../api/adminUsersApi";
import { getErrorMessageAndDetails } from "../utils/errorMapping";
import type { AdminRole } from "../types";

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

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesForbidden, setRolesForbidden] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRolesData() {
      try {
        setRolesForbidden(false);
        const res = await listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" });
        const items = res?.data;
        if (Array.isArray(items)) {
          setRoles(items);
        } else if ((items as any)?.items) {
          setRoles((items as any).items);
        }
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

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await inviteAdminUser({
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roleId,
        isSuperAdmin: user?.isSuperAdmin ? isSuperAdmin : false,
      });

      toast.success(
        lang === "ar" ? "تمت الدعوة بنجاح" : "Invitation Sent",
        lang === "ar"
          ? "تم إرسال دعوة الانضمام للمشرف الجديد بنجاح."
          : "The invitation email has been sent successfully."
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      const details = getErrorMessageAndDetails(err, lang);
      if (details.fieldErrors) {
        setFieldErrors(details.fieldErrors);
      }
      setFormError(details.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAr = lang === "ar";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800 shrink-0">
            <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
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

        {formError && !Object.keys(fieldErrors).length && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400">
            {formError}
          </div>
        )}

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
              <span className="text-[10px] text-red-500 font-medium block mt-1">
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
                disabled={isLoadingRoles}
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
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSuperAdmin}
                  onChange={(e) => setIsSuperAdmin(e.target.checked)}
                  className="size-4 rounded text-blue-600 focus:ring-blue-600"
                />
                <div className="flex flex-col gap-0.5">
                  <span>{t.users.superAdminCheckbox}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
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
              disabled={isSubmitting}
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
  );
}
