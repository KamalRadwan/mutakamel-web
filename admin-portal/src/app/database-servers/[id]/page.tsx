"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Server, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
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
import { useI18n } from "@/i18n/I18nContext";

export default function DatabaseServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    t,
    server,
    setServer,
    activeTab,
    setActiveTab,
    placedTenants,
    auditLogs,
    isSubmitting,
    isSaved,
    handleUpdateSubmit,
    handleActivate,
    handleDrain,
    handleDelete,
    onBack,
  } = useDatabaseServerDetail(id);
  const { lang } = useI18n();

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
                {server.host}:{server.port} · {server.countryName}
              </p>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2">
            {server.status === "DRAINING" ? (
              <button
                onClick={handleActivate}
                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t.dbServers.activate}
              </button>
            ) : server.status === "ACTIVE" ? (
              <button
                onClick={handleDrain}
                className="px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t.dbServers.drain}
              </button>
            ) : null}

            <button
              onClick={handleDelete}
              className="px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.dbServers.delete}</span>
            </button>
          </div>
        </div>

        {/* Saved Toast Notification */}
        {isSaved && (
          <div className="p-3 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ تعديلات سيرفر قواعد البيانات بنجاح!</span>
          </div>
        )}

        {/* Top Health Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
            <span className="text-xs text-slate-500 font-semibold">{t.dbServers.tenantsCapacity}</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {server.currentTenants} / {server.maxTenants} ({server.utilization}%)
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full ${
                  server.utilization >= 85 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${server.utilization}%` }}
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
              {server.isPlacementTarget ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">🟢 متاح للتسكين</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 text-sm">🟡 متوقف مؤقتاً</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">تاريخ الإنشاء: {server.createdAt}</p>
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
              🏢 المستأجرين المخدومين ({placedTenants.length})
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

        {/* Tab 1: Full Update Form (UpdateDatabaseServerDto) */}
        {activeTab === "details" && (
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
                    value={server.name}
                    onChange={(e) => setServer({ ...server, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.hostAddress}</label>
                  <input
                    type="text"
                    value={server.host}
                    onChange={(e) => setServer({ ...server, host: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.port}</label>
                  <input
                    type="number"
                    value={server.port}
                    onChange={(e) => setServer({ ...server, port: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.maxTenants}</label>
                  <input
                    type="number"
                    value={server.maxTenants}
                    onChange={(e) => setServer({ ...server, maxTenants: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.countryIso}</label>
                  <select
                    value={server.countryIsoCode}
                    onChange={(e) => setServer({ ...server, countryIsoCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="EG">مصر (EG)</option>
                    <option value="SA">المملكة العربية السعودية (SA)</option>
                    <option value="AE">الإمارات العربية المتحدة (AE)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.maintenanceDb}</label>
                  <input
                    type="text"
                    value={server.maintenanceDatabase}
                    onChange={(e) => setServer({ ...server, maintenanceDatabase: e.target.value })}
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
                    value={server.username}
                    onChange={(e) => setServer({ ...server, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.dbPassword}</label>
                  <input
                    type="password"
                    value={server.password}
                    onChange={(e) => setServer({ ...server, password: e.target.value })}
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
                    value={server.coreAppUser}
                    onChange={(e) => setServer({ ...server, coreAppUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.coreAppPass}
                    onChange={(e) => setServer({ ...server, coreAppPass: e.target.value })}
                    placeholder="تغيير كلمة مرور Core"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* CRM App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">CRM App Runtime Login</span>
                  <input
                    type="text"
                    value={server.crmAppUser}
                    onChange={(e) => setServer({ ...server, crmAppUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.crmAppPass}
                    onChange={(e) => setServer({ ...server, crmAppPass: e.target.value })}
                    placeholder="تغيير كلمة مرور CRM"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* Trade App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Trade App Runtime Login</span>
                  <input
                    type="text"
                    value={server.tradeAppUser}
                    onChange={(e) => setServer({ ...server, tradeAppUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.tradeAppPass}
                    onChange={(e) => setServer({ ...server, tradeAppPass: e.target.value })}
                    placeholder="تغيير كلمة مرور Trade"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* Worker App */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Worker App Runtime Login</span>
                  <input
                    type="text"
                    value={server.workerAppUser}
                    onChange={(e) => setServer({ ...server, workerAppUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.workerAppPass}
                    onChange={(e) => setServer({ ...server, workerAppPass: e.target.value })}
                    placeholder="تغيير كلمة مرور Worker"
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
                        checked={server.removeProvisioningCredentials}
                        onChange={(e) => setServer({ ...server, removeProvisioningCredentials: e.target.checked })}
                        className="rounded"
                      />
                      <span>حذف الاعتمادات</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={server.provisioningUser}
                    onChange={(e) => setServer({ ...server, provisioningUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.provisioningPass}
                    onChange={(e) => setServer({ ...server, provisioningPass: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">اعتمادات النسخ الاحتياطي</span>
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={server.removeBackupCredentials}
                        onChange={(e) => setServer({ ...server, removeBackupCredentials: e.target.checked })}
                        className="rounded"
                      />
                      <span>حذف الاعتمادات</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={server.backupUser}
                    onChange={(e) => setServer({ ...server, backupUser: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                  <input
                    type="password"
                    value={server.backupPass}
                    onChange={(e) => setServer({ ...server, backupPass: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
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
                    checked={server.removeSslConfig}
                    onChange={(e) => setServer({ ...server, removeSslConfig: e.target.checked })}
                    className="rounded"
                  />
                  <span>حذف تكوين SSL</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.dbServers.sslMode}</label>
                  <select
                    value={server.sslMode}
                    onChange={(e) => setServer({ ...server, sslMode: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="disable">disable</option>
                    <option value="require">require</option>
                    <option value="verify-ca">verify-ca</option>
                    <option value="verify-full">verify-full</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={server.sslRejectUnauthorized}
                      onChange={(e) => setServer({ ...server, sslRejectUnauthorized: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      رفض الشهادات غير الموثوقة
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">CA Certificate</label>
                  <textarea
                    value={server.sslCa}
                    onChange={(e) => setServer({ ...server, sslCa: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Client Cert</label>
                    <textarea
                      value={server.sslCert}
                      onChange={(e) => setServer({ ...server, sslCert: e.target.value })}
                      rows={2}
                      placeholder="-----BEGIN CERTIFICATE-----"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Private Key</label>
                    <textarea
                      value={server.sslKey}
                      onChange={(e) => setServer({ ...server, sslKey: e.target.value })}
                      rows={2}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
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
                    value={server.poolMin}
                    onChange={(e) => setServer({ ...server, poolMin: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pool Max</label>
                  <input
                    type="number"
                    value={server.poolMax}
                    onChange={(e) => setServer({ ...server, poolMax: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Connect Timeout Ms</label>
                  <input
                    type="number"
                    value={server.connectTimeoutMs}
                    onChange={(e) => setServer({ ...server, connectTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Statement Timeout Ms</label>
                  <input
                    type="number"
                    value={server.statementTimeoutMs}
                    onChange={(e) => setServer({ ...server, statementTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Idle Timeout Ms</label>
                  <input
                    type="number"
                    value={server.idleTimeoutMs}
                    onChange={(e) => setServer({ ...server, idleTimeoutMs: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Save Button Footer */}
            <div className="flex items-center justify-end bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-colors cursor-pointer flex items-center gap-2"
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
          </form>
        )}

        {/* Tab 2: Placed Tenants */}
        {activeTab === "tenants" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>قائمة المستأجرين المستضافين على هذا السيرفر ({placedTenants.length})</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 text-start">اسم الشركة</th>
                    <th className="pb-3 text-start">الرمز</th>
                    <th className="pb-3 text-start">الباقة</th>
                    <th className="pb-3 text-start">الحالة</th>
                    <th className="pb-3 text-start">تاريخ الانضمام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {placedTenants.map((ten) => (
                    <tr key={ten.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{ten.name}</td>
                      <td className="py-3 font-mono text-slate-500">{ten.code}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{ten.plan}</td>
                      <td className="py-3">
                        <StatusBadge status={ten.status} enumType="tenant" size="sm" />
                      </td>
                      <td className="py-3 font-mono text-slate-400">{ten.joinedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
                        {log.action}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        بواسطة: {log.user}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{log.timestamp}</span>
                  </div>

                  <div className="space-y-2">
                    {log.changes.map((ch, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800/80 items-center text-xs"
                      >
                        <div className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>{ch.field}</span>
                        </div>

                        <div className="font-mono text-xs flex items-center gap-1.5" dir="ltr">
                          <span className="text-[10px] text-slate-400 font-sans">old:</span>
                          <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-medium border border-rose-200/60 dark:border-rose-800/60 line-through">
                            {ch.oldValue}
                          </span>
                        </div>

                        <div className="font-mono text-xs flex items-center gap-1.5" dir="ltr">
                          <span className="text-[10px] text-slate-400 font-sans">new:</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-800/60">
                            {ch.newValue}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
