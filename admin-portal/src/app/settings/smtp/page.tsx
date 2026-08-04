"use client";

import { useState } from "react";
import { useSmtpSettings } from "./hooks/useSmtpSettings";
import { Mail, Save, Loader2, PlayCircle, Eye, EyeOff, History, UserCheck } from "lucide-react";

import { useToast } from "@/components/ui/ToastContext";

export default function SmtpSettingsPage() {
  const toast = useToast();
  const {
    lang,
    config,
    auditLogs,
    isLoading,
    isSaving,
    handleUpdate,
    saveConfig,
    verifyConnection,
    isVerifying,
    hasUpdatePermission,
  } = useSmtpSettings();

  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onSave = async () => {
    try {
      await saveConfig(passwordInput || undefined);
      setPasswordInput("");
      toast.success(
        lang === "ar" ? "تم حفظ إعدادات البريد" : "SMTP Settings Saved",
        lang === "ar" ? "تمت تحديثات الخادم البريدي بنجاح." : "SMTP Gateway configuration has been updated."
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(
        lang === "ar" ? "فشل الحفظ" : "Save Failed",
        err?.message || (lang === "ar" ? "تعذر حفظ الإعدادات" : "Could not save SMTP configuration")
      );
    }
  };

  const onTestConnection = async () => {
    toast.info(
      lang === "ar" ? "اختبار الاتصال" : "Testing Connection",
      lang === "ar" ? "جاري الاتصال بخادم SMTP..." : "Attempting socket connection to SMTP host..."
    );
    try {
      await verifyConnection();
      toast.success(
        lang === "ar" ? "تم الاتصال بنجاح" : "Connection Verified",
        lang === "ar" ? "تم الاتصال بخادم البريد الإلكتروني بنجاح." : "SMTP host is reachable and active."
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(
        lang === "ar" ? "فشل اختبار الاتصال" : "Verification Failed",
        err?.message || (lang === "ar" ? "تعذر الاتصال بالخادم" : "SMTP connection failed")
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {lang === "ar" ? "إعدادات البريد (SMTP Gateway)" : "SMTP Email Gateway"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === "ar" ? "إعدادات الخادم البريدي لإرسال الدعوات وإشعارات النظام." : "Configure the SMTP gateway used for dispatching platform emails and invites."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasUpdatePermission && (
            <button
              onClick={onTestConnection}
              disabled={isVerifying || isLoading}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {lang === "ar" ? "اختبار الاتصال" : "Test Connection"}
            </button>
          )}

          {hasUpdatePermission && (
            <button
              onClick={onSave}
              disabled={isSaving || isLoading}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {lang === "ar" ? "حفظ التغييرات" : "Save Settings"}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {lang === "ar" ? "إعدادات المرسل" : "Sender Configuration"}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "البريد المرسل (From Address)" : "From Address"}
                  </label>
                  <input
                    type="email"
                    value={config.fromAddress || ""}
                    onChange={(e) => handleUpdate("fromAddress", e.target.value)}
                    disabled={!hasUpdatePermission}
                    placeholder="no-reply@mutakamel.ai"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "اسم المرسل (From Name)" : "From Name"}
                  </label>
                  <input
                    type="text"
                    value={config.fromName || ""}
                    onChange={(e) => handleUpdate("fromName", e.target.value)}
                    disabled={!hasUpdatePermission}
                    placeholder="Mutakamel Platform"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "نطاق المرسل (Sender Domain)" : "Sender Domain"}
                  </label>
                  <input
                    type="text"
                    value={config.senderDomain || ""}
                    onChange={(e) => handleUpdate("senderDomain", e.target.value)}
                    disabled={!hasUpdatePermission}
                    placeholder="mutakamel.ai"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {lang === "ar" ? "إعدادات الخادم والاتصال" : "Server & Connection"}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === "ar" ? "خادم SMTP (Host)" : "SMTP Host"}
                    </label>
                    <input
                      type="text"
                      value={config.smtpHost || ""}
                      onChange={(e) => handleUpdate("smtpHost", e.target.value)}
                      disabled={!hasUpdatePermission}
                      placeholder="smtp.example.com"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === "ar" ? "المنفذ (Port)" : "SMTP Port"}
                    </label>
                    <input
                      type="number"
                      value={config.smtpPort || ""}
                      onChange={(e) => handleUpdate("smtpPort", Number(e.target.value))}
                      disabled={!hasUpdatePermission}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === "ar" ? "البروتوكول (Protocol)" : "Protocol"}
                    </label>
                    <select
                      value={config.smtpProtocol || "smtp"}
                      onChange={(e) => handleUpdate("smtpProtocol", e.target.value)}
                      disabled={!hasUpdatePermission}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <option value="smtp">SMTP (TLS/STARTTLS)</option>
                      <option value="smtps">SMTPS (SSL)</option>
                    </select>
                  </div>

                  <div className="col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 mt-1">
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {lang === "ar" ? "اتصال آمن (Secure)" : "Secure Connection"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {lang === "ar" ? "يفضل تفعيله للمنافذ 465" : "Recommended true for port 465"}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!hasUpdatePermission}
                      onClick={() => handleUpdate("smtpSecure", !config.smtpSecure)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${!hasUpdatePermission ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${config.smtpSecure ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.smtpSecure ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden lg:col-span-2">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {lang === "ar" ? "الاعتمادات (Credentials)" : "Authentication Credentials"}
                </h2>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "اسم المستخدم (Username)" : "SMTP Username"}
                  </label>
                  <input
                    type="text"
                    value={config.smtpUsername || ""}
                    onChange={(e) => handleUpdate("smtpUsername", e.target.value)}
                    disabled={!hasUpdatePermission}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === "ar" ? "كلمة المرور (Password)" : "SMTP Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      disabled={!hasUpdatePermission}
                      placeholder={config.smtpPasswordConfigured ? (lang === "ar" ? "تم الحفظ. اكتب قيمة جديدة لتغييرها." : "Configured. Type to overwrite.") : ""}
                      className="w-full ps-3 pe-10 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-2.5 end-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                {lang === "ar" ? "سجل التعديلات (SMTP Audit Trail)" : "SMTP Audit Trail Log"}
              </h2>
              {config.revision !== undefined && config.revision !== null && (
                <span className="px-2 py-0.5 text-xs font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/40">
                  Revision #{config.revision}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {lang === "ar" ? "لا توجد سجلات تعديل سابقة." : "No audit trail records found."}
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                          log.action === "CONFIGURED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          log.action === "CONNECTION_VERIFIED" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}>
                          {log.action}
                        </span>
                        {log.revision && (
                          <span className="text-xs font-mono text-slate-400">r{log.revision}</span>
                        )}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          {log.actor}
                        </span>
                      </div>

                      {log.changes && log.changes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {log.changes.map((c, idx) => (
                            <span key={idx} className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-mono">
                              {c.label}: <span className="line-through text-slate-400 me-1">{String(c.previousValue ?? "null")}</span> &rarr; <span className="font-semibold text-slate-900 dark:text-slate-200">{String(c.newValue)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
