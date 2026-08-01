"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, X, Loader2, Info } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { useI18n } from "@/i18n/I18nContext";

export function CreateRoleModal({ onClose, onSuccess }: { onClose: () => void, onSuccess?: () => void }) {
  const { lang } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axiosClient.post('/api/admin/core/v1/roles', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      
      const newRoleId = res.data?.data?.id;
      
      toast.success(
        lang === "ar" ? "تم الإنشاء" : "Role Created",
        lang === "ar" ? "تم إنشاء الدور بنجاح." : "Role created successfully."
      );
      
      onClose();
      if (onSuccess) onSuccess();
      
      if (newRoleId) {
        router.push(`/roles/${newRoleId}`);
      }
    } catch (error: any) {
      toast.error(
        lang === "ar" ? "فشل الإنشاء" : "Creation failed",
        error?.response?.data?.message || (lang === "ar" ? "حدث خطأ أثناء إنشاء الدور." : "An error occurred while creating the role.")
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? "إنشاء دور مشرف جديد" : "Create Admin Role"}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === "ar" ? "حدد المعلومات الأساسية. سيتم تعيين الصلاحيات في الخطوة التالية." : "Set basic info. Permissions will be configured in the next step."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === "ar" ? "اسم الدور" : "Role Name"} <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === "ar" ? "مثال: مدير الفواتير" : "e.g., Billing Manager"}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === "ar" ? "الوصف" : "Description"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === "ar" ? "وصف مهام هذا الدور..." : "Describe the responsibilities of this role..."}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {lang === "ar" ? "إنشاء والمتابعة للصلاحيات" : "Create & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
