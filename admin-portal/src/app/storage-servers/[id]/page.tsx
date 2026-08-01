"use client";

import React, { use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Server, Database, AlertCircle, Play, StopCircle, RefreshCw, 
  Trash2, Copy, Check, Activity, BarChart3, Settings, Shield, HardDrive
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useStorageServerDetail } from "../hooks/useStorageServerDetail";
import { useToast } from "@/components/ui/ToastContext";
import { formatBytes } from "@/lib/utils/formatters";
import { getErrorMessageAndDetails } from "../utils/errorMapping";

function StorageServerDetailView({ id }: { id: string }) {
  const { lang, t } = useI18n();
  const toast = useToast();
  
  const {
    server,
    history,
    isLoading,
    error,
    canRead,
    canUpdate,
    canDelete,
    handleActivate,
    handleDrain,
    handleOffline,
    handleDelete,
    handleVerify,
  } = useStorageServerDetail(id);

  const [isCopied, setIsCopied] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-200px)]">
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
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center h-[calc(100vh-200px)]">
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

  const copyId = () => {
    navigator.clipboard.writeText(server.id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const executeAction = async (actionFn: () => Promise<any>, successMsgAr: string, successMsgEn: string) => {
    setIsActionLoading(true);
    try {
      await actionFn();
      toast.success(
        lang === "ar" ? "تم بنجاح" : "Success",
        lang === "ar" ? successMsgAr : successMsgEn
      );
    } catch (err: any) {
      const details = getErrorMessageAndDetails(err, lang);
      toast.error(
        lang === "ar" ? "فشل الإجراء" : "Action Failed",
        details.message
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const isAr = lang === "ar";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/storage-servers"
          className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
        >
          <ArrowLeft className={`w-5 h-5 ${isAr ? "rotate-180" : ""}`} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Server className="w-6 h-6 text-blue-600 dark:text-blue-500" />
              {server.name}
            </h1>
            <StatusBadge status={server.status} lang={lang} />
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span className="font-mono text-xs">{server.code}</span>
            <span>•</span>
            <span>{server.region}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span>{isAr ? "معلومات الخادم" : "Server Information"}</span>
              </h2>
              <div className="flex gap-2">
                {canUpdate && server.status === "DRAFT" && (
                  <button
                    onClick={() => executeAction(handleActivate, "تم تفعيل الخادم بنجاح", "Server activated successfully")}
                    disabled={isActionLoading}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isAr ? "تفعيل" : "Activate"}
                  </button>
                )}
                {canUpdate && server.status === "ACTIVE" && (
                  <button
                    onClick={() => executeAction(handleDrain, "بدأ استنزاف الخادم", "Server drain started")}
                    disabled={isActionLoading}
                    className="px-3 py-1.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    {isAr ? "استنزاف" : "Drain"}
                  </button>
                )}
                {canUpdate && server.status === "DRAINING" && (
                  <button
                    onClick={() => executeAction(handleOffline, "تم إيقاف الخادم", "Server taken offline")}
                    disabled={isActionLoading}
                    className="px-3 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    {isAr ? "إيقاف" : "Take Offline"}
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 mb-1">{isAr ? "الرقم التعريفي" : "ID"}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-900 dark:text-slate-100">{server.id}</span>
                  <button onClick={copyId} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">{isAr ? "نوع الربط" : "Provider"}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{server.provider}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">{isAr ? "دور التسكين" : "Placement Role"}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{server.placementRole}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">{isAr ? "فئة التوافر" : "Availability Class"}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{server.availabilityClass || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-slate-500 mb-1">{isAr ? "نقطة النهاية الداخلية" : "Internal Endpoint"}</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 break-all bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg block">
                  {server.internalEndpoint}
                </span>
              </div>
              <div className="col-span-2">
                <span className="block text-slate-500 mb-1">{isAr ? "نقطة النهاية العامة" : "Public Endpoint"}</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 break-all bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg block">
                  {server.publicEndpoint}
                </span>
              </div>
            </div>
          </div>

          {/* Capacity Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <span>{isAr ? "السعة والمقاييس" : "Capacity & Metrics"}</span>
              </h2>
            </div>
            
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <MetricItem 
                label={isAr ? "السعة المتاحة" : "Usable Cap"} 
                value={server.usableCapacityBytes ? formatBytes(parseInt(server.usableCapacityBytes)) : "-"} 
              />
              <MetricItem 
                label={isAr ? "السعة المستخدمة" : "Used Cap"} 
                value={server.usedCapacityBytes ? formatBytes(parseInt(server.usedCapacityBytes)) : "-"} 
              />
              <MetricItem 
                label={isAr ? "السعة المخصصة" : "Allocatable"} 
                value={server.allocatableCapacityBytes ? formatBytes(parseInt(server.allocatableCapacityBytes)) : "-"} 
              />
              <MetricItem 
                label={isAr ? "النسخ المتماثل" : "Replication"} 
                value={`${server.observedReplicationFactor || 0} / ${server.requiredReplicationFactor}`} 
              />
              <MetricItem 
                label={isAr ? "المستأجرين الحاليين" : "Current Tenants"} 
                value={server.currentTenants || 0} 
              />
              <MetricItem 
                label={isAr ? "المستأجرين المحتفظ بهم" : "Retained Tenants"} 
                value={server.retainedTenants || 0} 
              />
              <MetricItem 
                label={isAr ? "الحد الأقصى" : "Max Tenants"} 
                value={server.maxTenants} 
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Health Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>{isAr ? "حالة الصحة" : "Health Status"}</span>
              </h2>
              {canUpdate && (
                <button
                  onClick={() => executeAction(handleVerify, "تم طلب التحقق بنجاح", "Verification requested successfully")}
                  disabled={isActionLoading}
                  className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/60 rounded-lg transition-colors"
                  title={isAr ? "التحقق من الاتصال" : "Verify Connectivity"}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>
            <div className="p-4">
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                server.healthStatus === "HEALTHY" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400"
                  : server.healthStatus === "UNHEALTHY"
                  ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400"
                  : "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300"
              }`}>
                {server.healthStatus === "HEALTHY" ? (
                  <Check className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <div>
                  <div className="text-[13px] font-bold">
                    {server.healthStatus || (isAr ? "غير معروف" : "Unknown")}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    {isAr ? "اخر تحديث للاتصال" : "Last connectivity check"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {canDelete && server.status === "OFFLINE" && (
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">{isAr ? "حذف الخادم" : "Delete Server"}</h3>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400/80">
                {isAr 
                  ? "بما أن الخادم غير متصل، يمكنك حذفه نهائياً من النظام. هذا الإجراء لا يمكن التراجع عنه."
                  : "Since the server is offline, you can permanently delete it. This action cannot be undone."}
              </p>
              <button
                onClick={() => executeAction(handleDelete, "تم حذف الخادم", "Server deleted")}
                disabled={isActionLoading}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isAr ? "حذف الخادم نهائياً" : "Permanently Delete Server"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
      <div className="text-[10px] text-slate-500 mb-1 truncate">{label}</div>
      <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const map: Record<string, { cls: string; ar: string; en: string }> = {
    ACTIVE: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900", ar: "نشط", en: "Active" },
    DRAFT: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900", ar: "مسودة", en: "Draft" },
    DRAINING: { cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900", ar: "استنزاف", en: "Draining" },
    OFFLINE: { cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900", ar: "غير متصل", en: "Offline" },
  };

  const c = map[status] || { cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", ar: status, en: status };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${c.cls}`}>
      {lang === "ar" ? c.ar : c.en}
    </span>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <StorageServerDetailView id={id} />
  );
}
