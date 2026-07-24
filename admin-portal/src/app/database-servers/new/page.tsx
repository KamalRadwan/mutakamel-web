"use client";

import { Navbar } from "@/components/layout/Navbar";
import { 
  Server, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database, 
  Lock, 
  Sliders,
  Key,
  Shield,
  Clock
} from "lucide-react";
import { useRegisterDatabaseServer } from "./hooks/useRegisterDatabaseServer";
import { useI18n } from "@/i18n/I18nContext";

export default function RegisterDatabaseServerPage() {
  const {
    t,
    formData,
    setFormData,
    isTesting,
    testResult,
    isSubmitting,
    handleTestConnection,
    handleSubmit,
    onCancel,
  } = useRegisterDatabaseServer();
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        {/* Header Title with Back Button */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {lang === "ar" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>{t.dbServers.registerTitle}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.dbServers.registerSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Connectivity Test Alert */}
        {testResult && (
          <div
            className={`p-4 text-xs font-semibold rounded-2xl border flex items-center gap-3 animate-in fade-in ${
              testResult.connected
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
            }`}
          >
            {testResult.connected ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Main Multi-Section Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info & Placement */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>1. البيانات الأساسية والسعة المعمارية (Basic Host Info & Placement)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.hostName} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. DB-PRIMARY-EG-02"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.hostAddress} *
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="e.g. db-primary-02.internal"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.port} *
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.maxTenants} *
                </label>
                <input
                  type="number"
                  value={formData.maxTenants}
                  onChange={(e) => setFormData({ ...formData, maxTenants: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.countryIso}
                </label>
                <select
                  value={formData.countryIsoCode}
                  onChange={(e) => setFormData({ ...formData, countryIsoCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                >
                  <option value="EG">مصر (EG)</option>
                  <option value="SA">المملكة العربية السعودية (SA)</option>
                  <option value="AE">الإمارات العربية المتحدة (AE)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.maintenanceDb}
                </label>
                <input
                  type="text"
                  value={formData.maintenanceDatabase}
                  onChange={(e) => setFormData({ ...formData, maintenanceDatabase: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Primary Maintenance Credentials */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>2. اعتمادات الصيانة الرئيسية (Primary Maintenance Credentials)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.dbUser}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. postgres_admin"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.dbPassword}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dedicated Runtime Application Pool Logins */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>3. اعتمادات التطبيقات ذات الصلاحية المحدودة (Runtime App Pool Logins)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Core App */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Core App Pool Logins</span>
                <input
                  type="text"
                  value={formData.coreAppUser}
                  onChange={(e) => setFormData({ ...formData, coreAppUser: e.target.value })}
                  placeholder="Core Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.coreAppPass}
                  onChange={(e) => setFormData({ ...formData, coreAppPass: e.target.value })}
                  placeholder="Core Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* CRM App */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">CRM App Pool Logins</span>
                <input
                  type="text"
                  value={formData.crmAppUser}
                  onChange={(e) => setFormData({ ...formData, crmAppUser: e.target.value })}
                  placeholder="CRM Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.crmAppPass}
                  onChange={(e) => setFormData({ ...formData, crmAppPass: e.target.value })}
                  placeholder="CRM Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Trade App */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Trade App Pool Logins</span>
                <input
                  type="text"
                  value={formData.tradeAppUser}
                  onChange={(e) => setFormData({ ...formData, tradeAppUser: e.target.value })}
                  placeholder="Trade Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.tradeAppPass}
                  onChange={(e) => setFormData({ ...formData, tradeAppPass: e.target.value })}
                  placeholder="Trade Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Worker App */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Worker App Pool Logins</span>
                <input
                  type="text"
                  value={formData.workerAppUser}
                  onChange={(e) => setFormData({ ...formData, workerAppUser: e.target.value })}
                  placeholder="Worker Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.workerAppPass}
                  onChange={(e) => setFormData({ ...formData, workerAppPass: e.target.value })}
                  placeholder="Worker Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Provisioning & Backup Credentials */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>4. اعتمادات التجهيز والنسخ الاحتياطي (Provisioning & Backup Credentials)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Provisioning Credentials */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Provisioning Admin Login</span>
                <input
                  type="text"
                  value={formData.provisioningUser}
                  onChange={(e) => setFormData({ ...formData, provisioningUser: e.target.value })}
                  placeholder="Provisioning Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.provisioningPass}
                  onChange={(e) => setFormData({ ...formData, provisioningPass: e.target.value })}
                  placeholder="Provisioning Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              {/* Backup Credentials */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Backup & Restore Login</span>
                <input
                  type="text"
                  value={formData.backupUser}
                  onChange={(e) => setFormData({ ...formData, backupUser: e.target.value })}
                  placeholder="Backup Username"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="password"
                  value={formData.backupPass}
                  onChange={(e) => setFormData({ ...formData, backupPass: e.target.value })}
                  placeholder="Backup Password"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 5: SSL Config & Certificates */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>5. إعدادات الشهادات وتشفير SSL (SSL Encryption & Certificates)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.dbServers.sslMode}
                </label>
                <select
                  value={formData.sslMode}
                  onChange={(e) => setFormData({ ...formData, sslMode: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
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
                    checked={formData.sslRejectUnauthorized}
                    onChange={(e) => setFormData({ ...formData, sslRejectUnauthorized: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رفض الشهادات غير الموثوقة (sslRejectUnauthorized)
                  </span>
                </label>
              </div>
            </div>

            {/* PEM Certificates Area */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  شهادة CA الرئيسية (sslConfig.ca) — PEM Certificate Text
                </label>
                <textarea
                  value={formData.sslCa}
                  onChange={(e) => setFormData({ ...formData, sslCa: e.target.value })}
                  rows={2}
                  placeholder="-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----"
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Client Certificate (sslConfig.cert)
                  </label>
                  <textarea
                    value={formData.sslCert}
                    onChange={(e) => setFormData({ ...formData, sslCert: e.target.value })}
                    rows={2}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Private Key (sslConfig.key)
                  </label>
                  <textarea
                    value={formData.sslKey}
                    onChange={(e) => setFormData({ ...formData, sslKey: e.target.value })}
                    rows={2}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Connection Pool Tuning & Timeouts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>6. ضبط الـ Pool والمهل الزمنية (Connection Pool & Timeouts)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pool Min (0-100)
                </label>
                <input
                  type="number"
                  value={formData.poolMin}
                  onChange={(e) => setFormData({ ...formData, poolMin: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pool Max (1-500)
                </label>
                <input
                  type="number"
                  value={formData.poolMax}
                  onChange={(e) => setFormData({ ...formData, poolMax: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Connect Timeout Ms (1000-60000)
                </label>
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Statement Timeout Ms (1000-300000)
                </label>
                <input
                  type="number"
                  value={formData.statementTimeoutMs}
                  onChange={(e) => setFormData({ ...formData, statementTimeoutMs: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Idle Timeout Ms (1000-300000)
                </label>
                <input
                  type="number"
                  value={formData.idleTimeoutMs}
                  onChange={(e) => setFormData({ ...formData, idleTimeoutMs: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>{t.dbServers.saveServer}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
