"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Shield, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import { adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { rolesApi } from "../api";
import type { CreateRoleCommand } from "../contract";

interface CreateIntent {
  fingerprint: string;
  idempotencyKey: string;
  command: CreateRoleCommand;
  ambiguous: boolean;
}

export function CreateRoleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const canCreate = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_CREATE);
  const intentRef = useRef<CreateIntent | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isAmbiguous, setIsAmbiguous] = useState(false);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length < 2 || trimmedName.length > 120
      ? lang === "ar"
        ? "يجب أن يكون الاسم بين حرفين و120 حرفاً."
        : "Name must contain between 2 and 120 characters."
      : null;
  const descriptionError =
    description.trim().length > 2_000
      ? lang === "ar"
        ? "الحد الأقصى للوصف 2000 حرف."
        : "Description cannot exceed 2,000 characters."
      : null;

  const closeSafely = () => {
    if (!isSubmitting && !isAmbiguous) onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) {
      setError({
        isNormalized: true,
        httpStatus: 403,
        errorCode: "ADMIN_PERMISSION_DENIED",
        errorCategory: "AUTHORIZATION",
        message:
          "Both admin.roles.create and admin.roles.critical are required.",
      });
      return;
    }
    if (nameError || descriptionError || isSubmitting) return;
    const trimmedDescription = description.trim();
    const command: CreateRoleCommand = {
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    };
    const fingerprint = JSON.stringify(command);
    const current = intentRef.current;
    if (current?.ambiguous && current.fingerprint !== fingerprint) return;
    const intent =
      current?.fingerprint === fingerprint
        ? current
        : {
            fingerprint,
            command,
            idempotencyKey: generateUUIDv7(),
            ambiguous: false,
          };
    intentRef.current = intent;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await rolesApi.create(command, intent.idempotencyKey);
      intentRef.current = null;
      setIsAmbiguous(false);
      toast.success(
        lang === "ar" ? "تم الإنشاء" : "Role created",
        lang === "ar"
          ? "تم إنشاء الدور بنجاح."
          : "Role created successfully.",
      );
      onSuccess?.();
      onClose();
      router.push(`/roles/${result.data.id}`);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      const ambiguous =
        getApiRequestOutcome(caught) === "settled-before-session-change" ||
        isAmbiguousWriteOutcome(normalized) ||
        /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(normalized.errorCode);
      if (ambiguous) intentRef.current = { ...intent, ambiguous: true };
      else if (shouldRotateWriteCommandKey(normalized)) intentRef.current = null;
      setIsAmbiguous(ambiguous);
      setError(normalized);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeSafely();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-role-title"
        aria-busy={isSubmitting}
        className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          onClick={closeSafely}
          disabled={isSubmitting || isAmbiguous}
          aria-label={lang === "ar" ? "إغلاق" : "Close"}
          className="absolute end-4 top-4 rounded-xl bg-slate-50 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/30">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 id="create-role-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? "إنشاء دور مشرف جديد" : "Create Admin Role"}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === "ar"
                ? "أدخل المعلومات الأساسية ثم عيّن الصلاحيات في صفحة الدور."
                : "Enter basic information, then assign permissions on the role page."}
            </p>
          </div>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {isAmbiguous
                    ? lang === "ar"
                      ? "نتيجة الإنشاء غير مؤكدة"
                      : "Creation outcome is not confirmed"
                    : error.message}
                </p>
                {isAmbiguous ? (
                  <p className="mt-1">
                    {lang === "ar"
                      ? "أعد المحاولة بنفس البيانات لإعادة استخدام مفتاح العملية نفسه."
                      : "Retry the unchanged form to reuse the exact command key."}
                  </p>
                ) : null}
                {error.correlationId ? (
                  <p className="mt-1 font-mono">{error.correlationId}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="create-role-name" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {lang === "ar" ? "اسم الدور" : "Role Name"} <span className="text-red-500">*</span>
            </label>
            <input
              id="create-role-name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting || isAmbiguous}
              aria-invalid={Boolean(name && nameError)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
            />
            {name && nameError ? <p className="mt-1 text-xs text-rose-600">{nameError}</p> : null}
          </div>

          <div>
            <label htmlFor="create-role-description" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {lang === "ar" ? "الوصف" : "Description"}
            </label>
            <textarea
              id="create-role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting || isAmbiguous}
              maxLength={2_001}
              rows={3}
              aria-invalid={Boolean(descriptionError)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
            />
            {descriptionError ? <p className="mt-1 text-xs text-rose-600">{descriptionError}</p> : null}
          </div>

          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={closeSafely}
              disabled={isSubmitting || isAmbiguous}
              className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(nameError || descriptionError)}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAmbiguous
                ? lang === "ar"
                  ? "إعادة المحاولة بنفس العملية"
                  : "Retry exact operation"
                : lang === "ar"
                  ? "إنشاء والمتابعة"
                  : "Create & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
