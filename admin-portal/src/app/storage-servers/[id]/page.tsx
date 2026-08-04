"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Database, AlertCircle, Play, StopCircle, RefreshCw,
  Trash2, Copy, Check, Lock, Key, Edit, ShieldCheck, Activity, HardDrive
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServerDetail } from "../hooks/useStorageServerDetail";
import { useToast } from "@/components/ui/ToastContext";
import { Navbar } from "@/components/layout/Navbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { UpdateStorageServerDto } from "@/types/storage-server";

function StorageServerDetailView({ id }: { id: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lang, t } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const {
    server,
    isLoading,
    error,
    canRead,
    canUpdate,
    canDelete,
    handleUpdate,
    handleActivate,
    handleOffline,
    handleDelete,
    handleMakePlatformDefault,
  } = useStorageServerDetail(id);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (!canRead) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          {lang === "ar" ? "تم رفض الوصول" : "Access Denied"}
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          {lang === "ar"
            ? "ليس لديك الصلاحيات الكافية لعرض تفاصيل الخادم."
            : "You do not have the required permissions to view server details."}
        </p>
      </div>
    );
  }

  if (isLoading && !server) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6 animate-pulse">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            </div>
            <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col items-center justify-center text-center p-6">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
          {lang === "ar" ? "الخادم غير موجود" : "Server not found"}
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          {error?.message || (lang === "ar" ? "تعذر تحميل تفاصيل الخادم." : "Could not load server details.")}
        </p>
        <Link
          href="/storage-servers"
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {lang === "ar" ? "العودة للقائمة" : "Back to Directory"}
        </Link>
      </div>
    );
  }

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(server.id);
      toast.success(
        lang === "ar" ? "تم النسخ" : "Copied",
        lang === "ar" ? "تم نسخ معرف خادم التخزين." : "The storage server ID was copied.",
      );
    } catch {
      toast.error(
        lang === "ar" ? "فشل النسخ" : "Copy Failed",
        lang === "ar" ? "تعذر نسخ معرف الخادم." : "The server ID could not be copied.",
      );
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeAction = async (actionFn: () => Promise<any>, successMsgAr: string, successMsgEn: string) => {
    setIsActionLoading(true);
    try {
      await actionFn();
      toast.success(
        lang === "ar" ? "تم بنجاح" : "Success",
        lang === "ar" ? successMsgAr : successMsgEn
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(
        lang === "ar" ? "فشل الإجراء" : "Action Failed",
        err.message || "An error occurred"
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActivateClick = async () => {
    setIsActionLoading(true);
    try {
      await handleActivate();
      toast.success(
        lang === "ar" ? "تم التفعيل بنجاح" : "Activated successfully",
        lang === "ar" ? "اجتاز الخادم اختبار الاتصال وهو الآن نشط." : "Server passed connection tests and is now ACTIVE."
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status === 503) {
        toast.error(
          lang === "ar" ? "فشل اختبار الاتصال" : "Connection Test Failed",
          lang === "ar" ? "تعذر الاتصال بالخادم. يرجى مراجعة بيانات الاعتماد أو الإعدادات." : "Could not connect to the server. Please check credentials and settings."
        );
      } else {
        toast.error(
          lang === "ar" ? "فشل التفعيل" : "Activation Failed",
          err.message || "An error occurred"
        );
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    await executeAction(
      async () => {
        await handleDelete();
        setIsDeleteModalOpen(false);
        router.push("/storage-servers");
      },
      "تم الحذف بنجاح",
      "Deleted successfully"
    );
  };

  const isAr = lang === "ar";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Header Hero Banner with Rich Colors */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-500/20 shadow-xl">
          <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <Link
                href="/storage-servers"
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl transition-all shrink-0 shadow-sm backdrop-blur-md"
              >
                <ArrowLeft className={`w-5 h-5 ${isAr ? "rotate-180" : ""}`} />
              </Link>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-xl shadow-md">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {server.name}
                  </h1>
                  {server.isPlatformDefault && (
                    <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] px-3 py-1 rounded-full uppercase font-black tracking-wider shadow-sm border border-white/20">
                      {isAr ? "الأساسي" : "Platform Default"}
                    </span>
                  )}
                  <StatusBadge status={server.status} enumType="db-server" />
                </div>
                <p className="text-xs text-indigo-200/80 mt-1 flex items-center gap-2">
                  <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-[11px] border border-white/10">{server.code}</span>
                  <span>•</span>
                  <span>{server.endpoint}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canUpdate && server.status === "ACTIVE" && !server.isPlatformDefault && (
                <button
                  onClick={() => executeAction(handleMakePlatformDefault, "تم التعيين كالأساسي", "Set as platform default")}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-indigo-400/30 backdrop-blur-md"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  {isAr ? "تعيين كأساسي" : "Make Default"}
                </button>
              )}

              {canUpdate && (server.status === "DRAFT" || server.status === "OFFLINE") && (
                <button
                  onClick={handleActivateClick}
                  disabled={isActionLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 border border-white/20"
                >
                  <Play className="w-4 h-4" />
                  {isAr ? "تفعيل واختبار" : "Activate & Test"}
                </button>
              )}

              {canUpdate && server.status === "ACTIVE" && !server.isPlatformDefault && (
                <button
                  onClick={() => executeAction(handleOffline, "تم إيقاف الخادم", "Server taken offline")}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-rose-400/30 backdrop-blur-md"
                >
                  <StopCircle className="w-4 h-4 text-rose-400" />
                  {isAr ? "إيقاف الخادم" : "Take Offline"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Main Configuration Card with Colorful Highlights */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden relative">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
                    <Database className="w-4 h-4" />
                  </div>
                  <span>{isAr ? "تكوين ومعلمات الخادم" : "Server Parameters & Storage Configuration"}</span>
                </h2>
                {canUpdate && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    disabled={isActionLoading || (server.status === 'ACTIVE' && server.assignedTenants > 0)}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all disabled:opacity-50 border border-indigo-200 dark:border-indigo-800/50 shadow-xs flex items-center gap-1.5 text-xs font-bold"
                    title={isAr ? "تعديل الإعدادات" : "Edit Settings"}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{isAr ? "تعديل" : "Edit"}</span>
                  </button>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-xs">
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "الرقم التعريفي (ID)" : "Server UUID"}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 font-semibold">{server.id}</span>
                    <button onClick={copyId} className="text-slate-400 hover:text-indigo-600 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "اسم الخادم" : "Display Name"}</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{server.name}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "نقطة النهاية (S3 Endpoint)" : "S3 Storage Endpoint"}</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl block border border-slate-200 dark:border-slate-700/60 font-semibold text-xs">
                    {server.endpoint}
                  </span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "المنطقة التخزينية (Region)" : "S3 Region"}</span>
                  <span className="font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-900/60 font-bold inline-block">
                    {server.region}
                  </span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "اسم الدلو (Bucket)" : "S3 Bucket Name"}</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 font-bold inline-block">
                    {server.bucketName}
                  </span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "المستأجرين المخصصين" : "Assigned Tenants"}</span>
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 w-max">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    {server.assignedTenants} / {server.maxTenants === null ? '∞' : server.maxTenants}
                  </div>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isAr ? "رقم المراجعة" : "Config Revision"}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">v{server.configRevision}</span>
                </div>
              </div>
            </div>

            {/* Secret Credentials Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                    <Lock className="w-4 h-4" />
                  </div>
                  <span>{isAr ? "بيانات الاعتماد السرية (S3 Keys)" : "Encrypted Access Credentials"}</span>
                </h2>
                {canUpdate && (
                  <button
                    onClick={() => setIsCredsModalOpen(true)}
                    disabled={isActionLoading}
                    className="px-3.5 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 rounded-xl text-xs font-bold transition-all border border-amber-200 dark:border-amber-900/50 shadow-xs flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isAr ? "تدوير البيانات" : "Rotate Keys"}</span>
                  </button>
                )}
              </div>

              <div className="p-6">
                {server.credentialsConfigured ? (
                  <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                    <div className="p-2.5 bg-emerald-500 text-white rounded-xl shrink-0 shadow-md shadow-emerald-500/20">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-300 mb-1">
                        {isAr ? "بيانات الاعتماد محفوظة ومحمية بالتشفير" : "Access Credentials Securely Stored"}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400/80 leading-relaxed max-w-lg">
                        {isAr
                          ? "مفاتيح S3 مشفرة بالكامل بالنظام ولا يتم إظهارها في المتصفح للحفاظ على الأمان. يمكنك تدوير المفاتيح في أي وقت."
                          : "Your access keys are encrypted at rest. For zero-trust compliance, raw keys are never returned over HTTP."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-md shadow-amber-500/20">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-900 dark:text-amber-300 mb-1">
                        {isAr ? "لم يتم تكوين بيانات الاعتماد" : "Credentials Not Provisioned"}
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed max-w-lg">
                        {isAr
                          ? "يرجى النقر على زر 'تدوير البيانات' لإدخال مفتاح Access Key ID و Secret Access Key لتشغيل الخادم."
                          : "Please rotate credentials to supply Access Key ID & Secret Access Key for connectivity."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Connection Status Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span>{isAr ? "فحص حيوية الاتصال" : "Health Diagnostics"}</span>
                </h2>
              </div>
              <div className="p-5">
                <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  server.lastConnectionTestStatus === "PASSED"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300"
                    : server.lastConnectionTestStatus === "FAILED"
                    ? "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300"
                    : "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300"
                }`}>
                  {server.lastConnectionTestStatus === "PASSED" ? (
                    <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : server.lastConnectionTestStatus === "FAILED" ? (
                    <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 bg-slate-400 text-white rounded-xl shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-black">
                      {server.lastConnectionTestStatus === "PASSED" && (isAr ? "الاتصال سليم وعامل" : "Connection Test Passed")}
                      {server.lastConnectionTestStatus === "FAILED" && (isAr ? "فشل اختبار الاتصال" : "Connection Failed")}
                      {server.lastConnectionTestStatus === "NOT_TESTED" && (isAr ? "لم يتم الاختبار بعد" : "Not Tested Yet")}
                    </div>
                    {server.lastConnectionTestedAt && (
                      <div className="text-[10px] opacity-80 mt-1 font-mono">
                        {new Date(server.lastConnectionTestedAt).toLocaleString()}
                      </div>
                    )}
                    {server.lastConnectionTestErrorCode && (
                      <div className="mt-2 text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 p-2 rounded-xl font-mono break-all font-bold border border-rose-200 dark:border-rose-800">
                        ERR: {server.lastConnectionTestErrorCode}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-4 px-1 leading-relaxed">
                  {isAr
                    ? "يتم إجراء فحص الاتصال تلقائياً عند النقر على تفعيل واختبار الخادم."
                    : "Live check connects to S3 bucket to verify credentials & network route."}
                </p>
              </div>
            </div>

            {canDelete && server.status === "OFFLINE" && server.assignedTenants === 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-5 flex flex-col gap-3 shadow-md">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  <h3 className="text-sm font-extrabold">{isAr ? "حذف الخادم" : "Delete Storage Node"}</h3>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-400/80 leading-relaxed">
                  {isAr
                    ? "بما أن الخادم غير متصل ولا يحتوي على مستأجرين، يمكنك حذفه نهائياً من النظام."
                    : "Offline server with 0 tenants can be permanently deleted."}
                </p>
                <button
                  onClick={handleDeleteClick}
                  disabled={isActionLoading}
                  className="w-full mt-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
                >
                  {isAr ? "حذف الخادم نهائياً" : "Delete Node Permanently"}
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditModalOpen && (
          <EditConfigModal
            server={server}
            onClose={() => setIsEditModalOpen(false)}
            onSave={handleUpdate}
            isAr={isAr}
          />
        )}

        {isCredsModalOpen && (
          <RotateCredsModal
            onClose={() => setIsCredsModalOpen(false)}
            onSave={handleUpdate}
            isAr={isAr}
          />
        )}

        <DestructiveActionModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title={isAr ? "حذف الخادم نهائياً" : "Delete Storage Server"}
          targetName={server.name}
          description={isAr ? "سيؤدي هذا إلى حذف الخادم نهائياً. لا يمكن التراجع عن هذا الإجراء." : "This will permanently delete the server. This action cannot be undone."}
          actionType="delete"
          requireNameTyping={true}
          isSubmitting={isActionLoading}
        />
      </main>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditConfigModal({ server, onClose, onSave, isAr }: { server: any, onClose: () => void, onSave: (d: any) => Promise<any>, isAr: boolean }) {
  const [formData, setFormData] = useState({
    name: server.name,
    endpoint: server.endpoint,
    region: server.region,
    bucketName: server.bucketName,
    maxTenants: server.maxTenants === null ? "" : server.maxTenants.toString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        name: formData.name,
        endpoint: formData.endpoint,
        region: formData.region,
        bucketName: formData.bucketName,
        maxTenants: formData.maxTenants === "" ? null : parseInt(formData.maxTenants, 10)
      });
      toast.success(isAr ? "تم الحفظ" : "Saved", isAr ? "تم تحديث الإعدادات" : "Configuration updated");
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(isAr ? "خطأ" : "Error", err.message || "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{isAr ? "تعديل الإعدادات" : "Edit Configuration"}</h2>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 font-medium flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {isAr ? "تعديل بيانات الاتصال سيؤدي إلى إرجاع الخادم لحالة مسودة!" : "Editing connection details will revert the server to DRAFT status!"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "الاسم" : "Name"}</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "نقطة النهاية" : "Endpoint"}</label>
            <input
              required
              type="url"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono transition-shadow"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "المنطقة" : "Region"}</label>
              <input
                required
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "اسم الدلو" : "Bucket Name"}</label>
              <input
                required
                type="text"
                value={formData.bucketName}
                onChange={(e) => setFormData({ ...formData, bucketName: e.target.value })}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono transition-shadow"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "الحد الأقصى للمستأجرين (اختياري)" : "Max Tenants (Optional)"}</label>
            <input
              type="number"
              min={0}
              value={formData.maxTenants}
              onChange={(e) => setFormData({ ...formData, maxTenants: e.target.value })}
              placeholder={isAr ? "فارغ = غير محدود" : "Empty = Unlimited"}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-shadow"
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-blue-600/20"
            >
              {isSubmitting ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RotateCredsModal({ onClose, onSave, isAr }: { onClose: () => void, onSave: (d: any) => Promise<any>, isAr: boolean }) {
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
      toast.success(isAr ? "تم الحفظ" : "Saved", isAr ? "تم تدوير المفاتيح بنجاح" : "Credentials rotated successfully");
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(isAr ? "خطأ" : "Error", err.message || "Failed to update credentials");
    } finally {
      setIsSubmitting(false);
      setAccessKeyId("");
      setSecretAccessKey("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            {isAr ? "تدوير بيانات الاعتماد" : "Rotate Credentials"}
          </h2>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 font-medium flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {isAr
              ? "تحذير: سيتم استبدال المفاتيح القديمة فوراً. قد تفقد التطبيقات الاتصال إذا كانت البيانات غير صحيحة."
              : "Warning: Old keys will be immediately replaced. Apps may lose connection if invalid keys are provided."}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "معرف مفتاح الوصول الجديد" : "New Access Key ID"}</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute top-3 start-3.5" />
              <input
                required
                type="text"
                autoComplete="off"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                className="w-full ps-10 pe-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono transition-shadow"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? "مفتاح الوصول السري الجديد" : "New Secret Access Key"}</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute top-3 start-3.5" />
              <input
                required
                type="password"
                autoComplete="off"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                className="w-full ps-10 pe-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono transition-shadow"
              />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !accessKeyId || !secretAccessKey}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-amber-600/20 flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
              {isSubmitting ? (isAr ? "جاري التدوير..." : "Rotating...") : (isAr ? "تدوير المفاتيح" : "Rotate Keys")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <StorageServerDetailView id={id} />
  );
}
