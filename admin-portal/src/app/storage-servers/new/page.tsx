"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Server, Database, Globe, Lock, Key, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useStorageServers } from "../hooks/useStorageServers";
import type { CreateStorageServerDto } from "@/types/storage-server";

export default function CreateStorageServerPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lang, t } = useI18n();
  const toast = useToast();
  const { handleCreate, canCreate } = useStorageServers();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateStorageServerDto>({
    code: "",
    name: "",
    endpoint: "",
    region: "",
    bucketName: "",
    maxTenants: null,
    credentials: {
      accessKeyId: "",
      secretAccessKey: "",
    },
  });

  if (!canCreate) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-200px)]">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          {lang === "ar" ? "تم رفض الوصول" : "Access Denied"}
        </h2>
        <p className="text-sm text-slate-500">
          {lang === "ar"
            ? "ليس لديك الصلاحيات الكافية لإنشاء خوادم تخزين."
            : "You do not have the required permissions to create storage servers."}
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Validate inputs loosely
      if (!formData.endpoint.startsWith("https://") && !formData.endpoint.startsWith("http://")) {
        throw new Error(lang === "ar" ? "يجب أن تبدأ نقطة النهاية بـ https://" : "Endpoint must start with https://");
      }
      if (formData.credentials.accessKeyId.length === 0 || formData.credentials.secretAccessKey.length === 0) {
        throw new Error(lang === "ar" ? "بيانات الاعتماد مطلوبة" : "Credentials are required");
      }

      await handleCreate(formData);
      toast.success(
        lang === "ar" ? "تم الإنشاء" : "Created",
        lang === "ar" ? "تم إنشاء خادم التخزين بنجاح" : "Storage server created successfully",
      );
      router.push("/storage-servers");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(
        lang === "ar" ? "فشل إنشاء خادم التخزين" : "Storage Server Creation Failed",
        err.message || err.response?.data?.message || (lang === "ar" ? "حدث خطأ" : "An error occurred"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/storage-servers")}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className={`w-5 h-5 text-slate-500 ${lang === "ar" ? "rotate-180" : ""}`} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            {lang === "ar" ? "إضافة خادم تخزين جديد" : "Add New Storage Server"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {lang === "ar"
              ? "قم بتكوين خادم متوافق مع S3 لدعم بيانات المستأجرين"
              : "Configure an S3-compatible server to back tenant data"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? "المعلومات الأساسية" : "Basic Information"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "اسم الخادم" : "Server Name"}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={lang === "ar" ? "مثال: US East Cluster 1" : "e.g., US East Cluster 1"}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "رمز الخادم" : "Server Code"}
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="USE1-CL1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 font-mono uppercase"
              />
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                {lang === "ar" ? "هذا الرمز لا يمكن تغييره لاحقاً." : "This code cannot be changed later."}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? "الاتصال بالمزود" : "Provider Connection"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "نقطة النهاية (Endpoint)" : "Endpoint URL"}
              </label>
              <input
                type="url"
                required
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="https://s3.us-east-1.amazonaws.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "المنطقة" : "Region"}
              </label>
              <input
                type="text"
                required
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="us-east-1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "اسم الدلو الرئيسي" : "Root Bucket Name"}
              </label>
              <input
                type="text"
                required
                value={formData.bucketName}
                onChange={(e) => setFormData({ ...formData, bucketName: e.target.value })}
                placeholder="mtk-production-data"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 relative">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === "ar" ? "بيانات الاعتماد" : "Credentials"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "معرف مفتاح الوصول" : "Access Key ID"}
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={formData.credentials.accessKeyId}
                  onChange={(e) => setFormData({ ...formData, credentials: { ...formData.credentials, accessKeyId: e.target.value } })}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full ps-9 pe-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "ar" ? "مفتاح الوصول السري" : "Secret Access Key"}
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
                <input
                  type="password"
                  required
                  autoComplete="off"
                  value={formData.credentials.secretAccessKey}
                  onChange={(e) => setFormData({ ...formData, credentials: { ...formData.credentials, secretAccessKey: e.target.value } })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full ps-9 pe-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/storage-servers")}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-blue-600/20"
          >
            <Save className="w-4 h-4" />
            {isSubmitting
              ? lang === "ar" ? "جاري الحفظ..." : "Saving..."
              : lang === "ar" ? "حفظ وإنشاء الخادم" : "Save & Create Server"}
          </button>
        </div>
      </form>
    </div>
  );
}
