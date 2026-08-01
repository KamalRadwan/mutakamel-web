"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Server, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  History, 
  Building2, 
  Save, 
  Trash2, 
  Database, 
  Loader2, 
  Lock, 
  Shield, 
  Key, 
  Clock, 
  Sliders 
} from "lucide-react";
import { useDatabaseServerDetail } from "./hooks/useDatabaseServerDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";
import Link from "next/link";
import { Country } from "country-state-city";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { DatabaseServerConnectivityResult } from "../components/DatabaseServerConnectivityResult";
import { useAuth } from "@/context/AuthContext";
import { adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";

export default function DatabaseServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    t,
    server,
    formData,
    setFormData,
    isLoading,
    error,
    isForbidden,
    fieldErrors,
    activeTab,
    setActiveTab,
    placedTenants,
    tenantsLoading,
    tenantsError,
    tenantsMeta,
    tenantsPage,
    setTenantsPage,
    auditLogs,
    historyLoading,
    historyError,
    isTesting,
    testResult,
    requiresConnectionTest,
    isTestedAndConnected,
    handleTestConnection,
    isSubmitting,
    isSaved,
    handleUpdateSubmit,
    modalActionType,
    openActivateModal,
    openDrainModal,
    openOfflineModal,
    openDeleteModal,
    closeModal,
    confirmModalAction,
    onBack,
  } = useDatabaseServerDetail(id);
  const { lang } = useI18n();
  const { user } = useAuth();
  const canUpdate = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_UPDATE);
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.DB_SERVERS_DELETE);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm font-semibold">جاري التحميل...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || isForbidden || !server) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-4 max-w-md mx-auto mt-12">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isForbidden ? "غير مصرح" : "حدث خطأ"}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {error || (isForbidden ? "ليس لديك الصلاحية الكافية لعرض هذه الصفحة." : "تعذر العثور على الخادم.")}
            </p>
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              العودة للقائمة
            </button>
          </div>
        </main>
      </div>
    );
  }

  const utilPct = server.maxTenants > 0 ? Math.round((server.currentTenants / server.maxTenants) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Header Title with Status & Lifecycle Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                  {server.name}
                </h1>
                <StatusBadge status={server.status} enumType="db-server" size="md" />
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {server.host}:{server.port} · {Country.getCountryByCode(server.countryIsoCode || "")?.flag || ""} {Country.getCountryByCode(server.countryIsoCode || "")?.name || server.countryName || server.countryIsoCode}
              </p>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2">
            {server.status === "DRAINING" || server.status === "OFFLINE" ? (
              canUpdate && (
                <button
                  onClick={openActivateModal}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {t.dbServers.activate}
                </button>
              )
            ) : server.status === "ACTIVE" ? (
              canUpdate && (
                <button
                  onClick={openDrainModal}
                  className="px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {t.dbServers.drain}
                </button>
              )
            ) : null}

            {server.status !== "OFFLINE" && canUpdate && (
              <button
                onClick={openOfflineModal}
                className="px-3.5 py-1.5 text-xs font-bold bg-slate-600 hover:bg-slate-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                إيقاف (Offline)
              </button>
            )}

            {canDelete && (
              <button
                onClick={openDeleteModal}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.dbServers.delete}</span>
              </button>
            )}
          </div>
        </div>

        {/* Top Health Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.dbServers.tenantsCapacity}</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {server.currentTenants} / {server.maxTenants} ({utilPct}%)
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full ${
                  utilPct >= 85 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.dbServers.maintenanceDb}</span>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {server.maintenanceDatabase}
            </div>
            <p className="text-[11px] text-slate-400">{t.dbServers.sslMode}: {server.sslMode}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.dbServers.placementStatus}</span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {server.status === "ACTIVE" && server.currentTenants < server.maxTenants ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">🟢 متاح للتسكين</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 text-sm">🟡 غير متاح</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">تاريخ الإنشاء: {new Date(server.createdAt).toLocaleString("en-GB")}</p>
          </div>
        </div>

        {/* Tab Navigation Workspace */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              📝 البيانات وتعديل الاعتمادات
            </button>
            <button
              onClick={() => setActiveTab("tenants")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "tenants"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              🏢 المستأجرين المخدومين
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "history"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              📜 {t.dbServers.historyTitle}
            </button>
          </div>
        </div>

        {/* Tab 1: Full Update Form */}
        {activeTab === "details" && (
          <>
            {testResult && <DatabaseServerConnectivityResult result={testResult} lang={lang} />}
            <form onSubmit={handleUpdateSubmit} className="space-y-6">
            {/* Section A: Host Basic & Capacity */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>أ. البيانات الأساسية والسعة الاستيعابية</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.hostName}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.hostAddress}</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.port}</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.maxTenants}</label>
                  <input
                    type="number"
                    value={formData.maxTenants}
                    onChange={(e) => setFormData({ ...formData, maxTenants: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.countryIso}</label>
                  <CountrySelect
                    value={formData.countryIsoCode}
                    onChange={(code) => setFormData({ ...formData, countryIsoCode: code })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.maintenanceDb}</label>
                  <input
                    type="text"
                    value={formData.maintenanceDatabase}
                    onChange={(e) => setFormData({ ...formData, maintenanceDatabase: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Update Maintenance Credentials */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>ب. تحديث كلمة مرور اعتمادات الصيانة الرئيسية</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.dbUser}</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="استبدال اسم المستخدم (اختياري)"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.dbPassword}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="اتركها فارغة إذا لم ترد التغيير"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Section C: Update Runtime App Logins */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>جـ. تحديث اعتمادات تطبيقات الـ Runtime</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Core App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Core App Runtime Login</span>
                  <input
                    type="text"
                    value={formData.coreAppUser}
                    onChange={(e) => setFormData({ ...formData, coreAppUser: e.target.value })}
                    placeholder="Core Username (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={formData.coreAppPass}
                    onChange={(e) => setFormData({ ...formData, coreAppPass: e.target.value })}
                    placeholder="Core Password (تغيير كلمة المرور)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* CRM App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">CRM App Runtime Login</span>
                  <input
                    type="text"
                    value={formData.crmAppUser}
                    onChange={(e) => setFormData({ ...formData, crmAppUser: e.target.value })}
                    placeholder="CRM Username (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={formData.crmAppPass}
                    onChange={(e) => setFormData({ ...formData, crmAppPass: e.target.value })}
                    placeholder="CRM Password (تغيير كلمة المرور)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* Trade App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Trade App Runtime Login</span>
                  <input
                    type="text"
                    value={formData.tradeAppUser}
                    onChange={(e) => setFormData({ ...formData, tradeAppUser: e.target.value })}
                    placeholder="Trade Username (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={formData.tradeAppPass}
                    onChange={(e) => setFormData({ ...formData, tradeAppPass: e.target.value })}
                    placeholder="Trade Password (تغيير كلمة المرور)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* Worker App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Worker App Runtime Login</span>
                  <input
                    type="text"
                    value={formData.workerAppUser}
                    onChange={(e) => setFormData({ ...formData, workerAppUser: e.target.value })}
                    placeholder="Worker Username (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={formData.workerAppPass}
                    onChange={(e) => setFormData({ ...formData, workerAppPass: e.target.value })}
                    placeholder="Worker Password (تغيير كلمة المرور)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Section D: Provisioning & Backup Logins */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>د. تحديث اعتمادات التجهيز والنسخ الاحتياطي</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">اعتمادات التجهيز</span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.removeProvisioningCredentials}
                        onChange={(e) => setFormData({ ...formData, removeProvisioningCredentials: e.target.checked })}
                        className="rounded"
                      />
                      <span>حذف الاعتمادات</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={formData.provisioningUser}
                    onChange={(e) => setFormData({ ...formData, provisioningUser: e.target.value })}
                    placeholder="استبدال اسم المستخدم (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    disabled={formData.removeProvisioningCredentials}
                  />
                  <input
                    type="password"
                    value={formData.provisioningPass}
                    onChange={(e) => setFormData({ ...formData, provisioningPass: e.target.value })}
                    placeholder="استبدال كلمة المرور"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    disabled={formData.removeProvisioningCredentials}
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">اعتمادات النسخ الاحتياطي</span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.removeBackupCredentials}
                        onChange={(e) => setFormData({ ...formData, removeBackupCredentials: e.target.checked })}
                        className="rounded"
                      />
                      <span>حذف الاعتمادات</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={formData.backupUser}
                    onChange={(e) => setFormData({ ...formData, backupUser: e.target.value })}
                    placeholder="استبدال اسم المستخدم (اختياري)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    disabled={formData.removeBackupCredentials}
                  />
                  <input
                    type="password"
                    value={formData.backupPass}
                    onChange={(e) => setFormData({ ...formData, backupPass: e.target.value })}
                    placeholder="استبدال كلمة المرور"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                    disabled={formData.removeBackupCredentials}
                  />
                </div>
              </div>
            </div>

            {/* Section E: SSL Config & Certificates */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>هـ. تحديث شهادات وإعدادات تشفير SSL</span>
                </h3>
                <label className="flex items-center gap-1 text-xs text-rose-500 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.removeSslConfig}
                    onChange={(e) => setFormData({ ...formData, removeSslConfig: e.target.checked })}
                    className="rounded"
                  />
                  <span>حذف تكوين SSL (الشهادات والمفتاح)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.sslMode}</label>
                  <select
                    value={formData.sslMode}
                    onChange={(e) => setFormData({ ...formData, sslMode: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    disabled={formData.removeSslConfig}
                  >
                    <option value="disable">disable</option>
                    <option value="require">require</option>
                    <option value="verify-ca">verify-ca</option>
                    <option value="verify-full">verify-full</option>
                  </select>
                </div>

                {formData.sslMode !== "disable" && (
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.sslRejectUnauthorized}
                        onChange={(e) => setFormData({ ...formData, sslRejectUnauthorized: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-50"
                        disabled={formData.removeSslConfig}
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ar" ? "رفض الشهادات غير الموثوقة (sslRejectUnauthorized)" : "Reject Unauthorized Certificates"}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {formData.sslMode !== "disable" && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "شهادة CA الرئيسية (Root CA Certificate - استبدال)" : "Root CA Certificate (sslConfig.ca - replace)"}
                    </label>
                    <textarea
                      value={formData.sslCa}
                      onChange={(e) => setFormData({ ...formData, sslCa: e.target.value })}
                      rows={2}
                      placeholder="-----BEGIN CERTIFICATE-----"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50"
                      disabled={formData.removeSslConfig}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ar" ? "شهادة العميل (Client Cert - استبدال)" : "Client Certificate (sslConfig.cert - replace)"}
                      </label>
                      <textarea
                        value={formData.sslCert}
                        onChange={(e) => setFormData({ ...formData, sslCert: e.target.value })}
                        rows={2}
                        placeholder="-----BEGIN CERTIFICATE-----"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50"
                        disabled={formData.removeSslConfig}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {lang === "ar" ? "المفتاح الخاص (Private Key - استبدال)" : "Private Key (sslConfig.key - replace)"}
                      </label>
                      <textarea
                        value={formData.sslKey}
                        onChange={(e) => setFormData({ ...formData, sslKey: e.target.value })}
                        rows={2}
                        placeholder="-----BEGIN PRIVATE KEY-----"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50"
                        disabled={formData.removeSslConfig}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "كلمة مرور المفتاح الخاص (Passphrase)" : "Private Key Passphrase"}
                    </label>
                    <input
                      type="password"
                      value={formData.sslPassphrase}
                      onChange={(e) => setFormData({ ...formData, sslPassphrase: e.target.value })}
                      placeholder="Passphrase"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50"
                      disabled={formData.removeSslConfig}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section F: Pool Tuning & Timeouts */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>و. تعديل مهل الاتصال وحجم الـ Connection Pool</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pool Min</label>
                  <input
                    type="number"
                    value={formData.poolMin}
                    onChange={(e) => setFormData({ ...formData, poolMin: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pool Max</label>
                  <input
                    type="number"
                    value={formData.poolMax}
                    onChange={(e) => setFormData({ ...formData, poolMax: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Connect Timeout Ms</label>
                  <input
                    type="number"
                    value={formData.connectTimeoutMs}
                    onChange={(e) => setFormData({ ...formData, connectTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Statement Timeout Ms</label>
                  <input
                    type="number"
                    value={formData.statementTimeoutMs}
                    onChange={(e) => setFormData({ ...formData, statementTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Idle Timeout Ms</label>
                  <input
                    type="number"
                    value={formData.idleTimeoutMs}
                    onChange={(e) => setFormData({ ...formData, idleTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Save & Test Connection Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>{t.dbServers.testingConnectivity}</span>
                  </>
                ) : (
                  <span>{t.dbServers.testConnectionBtn}</span>
                )}
              </button>

              <div className="flex items-center gap-3">
                {requiresConnectionTest && !isTestedAndConnected && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
                    {lang === "ar" ? "يلزم اختبار الاتصال بنجاح لتأكيد التعديلات" : "Test connection required to save changes"}
                  </span>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || (requiresConnectionTest && !isTestedAndConnected)}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحديث...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ كافة التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            </form>
          </>
        )}

        {/* Tab 2: Placed Tenants */}
        {activeTab === "tenants" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>قائمة المستأجرين المستضافين على هذا السيرفر ({placedTenants.length})</span>
            </h3>

            {tenantsLoading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : tenantsError ? (
              <div className="py-8 text-center text-rose-500 text-xs font-semibold">{tenantsError}</div>
            ) : placedTenants.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-semibold">لا يوجد مستأجرين مضافين على هذا الخادم.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                        <th className="pb-3 text-start">معرف المستأجر</th>
                        <th className="pb-3 text-start">الاسم</th>
                        <th className="pb-3 text-start">حالة الدفع</th>
                        <th className="pb-3 text-start">الحالة</th>
                        <th className="pb-3 text-start">تاريخ الانضمام</th>
                        <th className="pb-3 text-start"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {placedTenants.map((ten) => (
                        <tr key={ten.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-mono text-slate-500">{ten.tenantId || ten.id}</td>
                          <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{ten.name || ten.subdomain}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{ten.subscriptionStatus || "N/A"}</td>
                          <td className="py-3">
                            <StatusBadge status={ten.status} enumType="tenant" size="sm" />
                          </td>
                          <td className="py-3 font-mono text-slate-400">
                            {new Date(ten.createdAt).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-3 text-end">
                            <Link
                              href={`/tenants/${ten.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              عرض
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Optional Tenants Pagination */}
                {tenantsMeta && tenantsMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-500">الصفحة {tenantsPage} من {tenantsMeta.totalPages}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTenantsPage(tenantsPage - 1)}
                        disabled={!tenantsMeta.hasPrev}
                        className="px-3 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                      >
                        السابق
                      </button>
                      <button
                        onClick={() => setTenantsPage(tenantsPage + 1)}
                        disabled={!tenantsMeta.hasNext}
                        className="px-3 py-1 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
                      >
                        التالي
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: Audit Log History */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>سجل الحركات والتغييرات التاريخية</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">إجمالي التغييرات: {auditLogs.length}</span>
            </div>

            {historyLoading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : historyError ? (
              <div className="py-8 text-center text-rose-500 text-xs font-semibold">{historyError}</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs font-semibold">لا يوجد سجل تاريخي لهذا الخادم.</div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
                          {log.action}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          بواسطة: {log.actorId || "النظام"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(log.createdAt).toLocaleString("en-GB")}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {Array.isArray(log.changes) && log.changes.map((ch, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800/80 items-center text-xs"
                        >
                          <div className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>{ch.label || ch.field}</span>
                          </div>

                          <div className="font-mono text-xs flex items-center gap-1.5" dir="ltr">
                            <span className="text-[10px] text-slate-400 font-sans">old:</span>
                            <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-medium border border-rose-200/60 dark:border-rose-800/60 line-through">
                              {String(ch.previousValue ?? "N/A")}
                            </span>
                          </div>

                          <div className="font-mono text-xs flex items-center gap-1.5" dir="ltr">
                            <span className="text-[10px] text-slate-400 font-sans">new:</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-800/60">
                              {String(ch.newValue ?? "N/A")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {modalActionType && (
        <DestructiveActionModal
          isOpen={true}
          onClose={closeModal}
          onConfirm={confirmModalAction}
          actionType={modalActionType}
          targetName={server.name}
          requireNameTyping={modalActionType !== "activate"}
          title={
            modalActionType === "activate"
              ? `تأكيد إعادة تفعيل السيرفر (${server.name})`
              : modalActionType === "drain"
              ? `تأكيد تفريغ السيرفر (${server.name})`
              : modalActionType === "offline"
              ? `تأكيد إيقاف السيرفر (${server.name})`
              : `تأكيد حذف السيرفر (${server.name})`
          }
          description={
            modalActionType === "activate"
              ? "سيسمح هذا الإجراء باستقبال مستأجرين جدد على هذا السيرفر."
              : modalActionType === "drain"
              ? "سيعمل هذا الإجراء على منع تخصيص أي مستأجرين جدد على هذا السيرفر ونقل المستأجرين الحاليين عند الطلب."
              : modalActionType === "offline"
              ? "سيقوم هذا الإجراء بإيقاف السيرفر وجعله غير متاح كلياً."
              : "سيقوم هذا الإجراء بإزالة السيرفر نهائياً بشرط عدم وجود مستأجرين مرتبطين به."
          }
        />
      )}
    </div>
  );
}
