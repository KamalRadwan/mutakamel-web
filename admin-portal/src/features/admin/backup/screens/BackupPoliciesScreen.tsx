"use client";

import { useState } from "react";
import { RefreshCw, Settings2, SlidersHorizontal, Undo2 } from "lucide-react";
import { BackupCompressionAlgorithm, type BackupDatabaseConfig } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupPolicies } from "../hooks/useBackupPolicies";
import { useI18n } from "@/i18n/I18nContext";

export function BackupPoliciesScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupPolicies();
  const [enabled, setEnabled] = useState(true);
  const [cronExpression, setCronExpression] = useState("0 2 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [retentionDays, setRetentionDays] = useState("30");
  const [serverConcurrency, setServerConcurrency] = useState(2);
  const [tenantConcurrency, setTenantConcurrency] = useState(2);
  const [defaultBackupEnabled, setDefaultBackupEnabled] = useState(true);
  const [defaultCompressionEnabled, setDefaultCompressionEnabled] = useState(true);
  const [defaultAlgorithm, setDefaultAlgorithm] = useState<BackupCompressionAlgorithm>(BackupCompressionAlgorithm.GZIP);
  const [editingDatabase, setEditingDatabase] = useState<BackupDatabaseConfig | null>(null);
  const [overrideBackup, setOverrideBackup] = useState("inherit");
  const [overrideCompression, setOverrideCompression] = useState("inherit");
  const [overrideAlgorithm, setOverrideAlgorithm] = useState("inherit");

  const [prevPolicy, setPrevPolicy] = useState(view.policy);
  if (view.policy !== prevPolicy) {
    setPrevPolicy(view.policy);
    if (view.policy) {
      setEnabled(view.policy.enabled);
      setCronExpression(view.policy.cronExpression);
      setTimezone(view.policy.timezone);
      setRetentionDays(view.policy.retentionDays === null ? "" : String(view.policy.retentionDays));
      setServerConcurrency(view.policy.serverConcurrency);
      setTenantConcurrency(view.policy.tenantConcurrency);
      setDefaultBackupEnabled(view.policy.defaultBackupEnabled);
      setDefaultCompressionEnabled(view.policy.defaultCompressionEnabled);
      setDefaultAlgorithm(view.policy.defaultCompressionAlgorithm);
    }
  }

  const openOverride = (database: BackupDatabaseConfig) => {
    setEditingDatabase(database);
    setOverrideBackup(database.override?.backupEnabled === null || database.override?.backupEnabled === undefined ? "inherit" : database.override.backupEnabled ? "enabled" : "disabled");
    setOverrideCompression(database.override?.compressionEnabled === null || database.override?.compressionEnabled === undefined ? "inherit" : database.override.compressionEnabled ? "enabled" : "disabled");
    setOverrideAlgorithm(database.override?.compressionAlgorithm ?? "inherit");
  };

  if (!view.canReadServers) {
    return (
      <BackupStatePanel
        kind="forbidden"
        title={isArabic ? "اختيار الخادم غير متاح" : "Server selection is restricted"}
        description={isArabic ? "تحتاج إلى admin.database_servers.read لإعداد سياسة لخادم جديد." : "admin.database_servers.read is required to configure a policy for a registered server."}
      />
    );
  }

  const policyValid =
    cronExpression.trim().length > 0 &&
    cronExpression.length <= 120 &&
    timezone.trim().length > 0 &&
    timezone.length <= 80 &&
    (retentionDays === "" || (Number(retentionDays) >= 1 && Number(retentionDays) <= 3650)) &&
    serverConcurrency >= 1 && serverConcurrency <= 10 &&
    tenantConcurrency >= 1 && tenantConcurrency <= 10;

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "جدولة Worker" : "Worker scheduling"}
        title={isArabic ? "سياسات النسخ الاحتياطي" : "Backup policies"}
        description={isArabic
          ? "سياسة مستقلة لكل خادم مع إعدادات افتراضية واستثناءات محددة لكل قاعدة بيانات."
          : "One policy per database server, with inherited defaults and explicit per-database overrides."}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <BackupServerSelect label={isArabic ? "خادم قاعدة البيانات" : "Database server"} value={view.selectedServerId} servers={view.servers} onChange={view.setSelectedServerId} disabled={view.isLoading || Boolean(view.activeAction)} placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"} />
          <button type="button" onClick={() => void view.refresh()} disabled={!view.selectedServerId || view.isLoadingData} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900">
            <RefreshCw className={`size-4 ${view.isLoadingData ? "animate-spin" : ""}`} aria-hidden="true" />{isArabic ? "تحديث" : "Refresh"}
          </button>
        </div>
      </section>

      {view.error ? <BackupErrorBanner error={view.error} /> : null}

      {view.isLoading || view.isLoadingData ? (
        <BackupStatePanel kind="loading" title={isArabic ? "جارٍ تحميل السياسة" : "Loading policy"} description={isArabic ? "قراءة الإعدادات وقواعد البيانات التابعة." : "Reading policy and tenant database configuration."} />
      ) : view.error ? null : !view.selectedServerId || !view.policy ? (
        <BackupStatePanel kind="empty" title={isArabic ? "اختر خادمًا" : "Select a server"} description={isArabic ? "لا توجد سياسة قابلة للعرض بدون سياق خادم." : "A server context is required before a policy can be displayed."} />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold"><Settings2 className="size-5 text-cyan-700" aria-hidden="true" />{isArabic ? "الإعدادات الافتراضية" : "Policy defaults"}</h2>
                <p className="mt-1 text-sm text-slate-500">{isArabic ? "تطبق على قواعد البيانات التي لا تملك استثناءً." : "Applied to databases without an explicit override."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{enabled ? (isArabic ? "مفعلة" : "Enabled") : (isArabic ? "متوقفة" : "Disabled")}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-slate-700"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={!view.canManage} />{isArabic ? "تفعيل السياسة" : "Policy enabled"}</label>
              <Field label={isArabic ? "تعبير Cron" : "Cron expression"}><input value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} disabled={!view.canManage} maxLength={120} className={inputClass} /></Field>
              <Field label={isArabic ? "المنطقة الزمنية" : "Timezone"}><input value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={!view.canManage} maxLength={80} className={inputClass} /></Field>
              <Field label={isArabic ? "الاحتفاظ بالأيام" : "Retention days"}><input type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} disabled={!view.canManage} className={inputClass} placeholder={isArabic ? "بدون حذف" : "No expiry"} /></Field>
              <Field label={isArabic ? "تزامن الخادم" : "Server concurrency"}><input type="number" min={1} max={10} value={serverConcurrency} onChange={(event) => setServerConcurrency(Number(event.target.value))} disabled={!view.canManage} className={inputClass} /></Field>
              <Field label={isArabic ? "تزامن العملاء" : "Tenant concurrency"}><input type="number" min={1} max={10} value={tenantConcurrency} onChange={(event) => setTenantConcurrency(Number(event.target.value))} disabled={!view.canManage} className={inputClass} /></Field>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-slate-700"><input type="checkbox" checked={defaultBackupEnabled} onChange={(event) => setDefaultBackupEnabled(event.target.checked)} disabled={!view.canManage} />{isArabic ? "النسخ افتراضيًا" : "Backup by default"}</label>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-bold dark:border-slate-700"><input type="checkbox" checked={defaultCompressionEnabled} onChange={(event) => setDefaultCompressionEnabled(event.target.checked)} disabled={!view.canManage} />{isArabic ? "الضغط افتراضيًا" : "Compress by default"}</label>
              <Field label={isArabic ? "خوارزمية الضغط" : "Compression algorithm"}><select value={defaultAlgorithm} onChange={(event) => setDefaultAlgorithm(event.target.value as BackupCompressionAlgorithm)} disabled={!view.canManage} className={inputClass}><option value={BackupCompressionAlgorithm.GZIP}>gzip</option><option value={BackupCompressionAlgorithm.NONE}>none</option></select></Field>
            </div>

            {view.canManage ? (
              <div className="mt-6 flex justify-end">
                <button type="button" disabled={!policyValid || !view.ownsSelectedServerState || view.activeAction === "policy"} onClick={() => void view.savePolicy({ enabled, cronExpression: cronExpression.trim(), timezone: timezone.trim(), retentionDays: retentionDays === "" ? null : Number(retentionDays), serverConcurrency, tenantConcurrency, defaultBackupEnabled, defaultCompressionEnabled, defaultCompressionAlgorithm: defaultAlgorithm }).catch(() => undefined)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-5 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50"><Settings2 className="size-4" aria-hidden="true" />{isArabic ? "حفظ السياسة" : "Save policy"}</button>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
              <div><h2 className="flex items-center gap-2 text-base font-bold"><SlidersHorizontal className="size-5 text-cyan-700" aria-hidden="true" />{isArabic ? "إعدادات قواعد البيانات" : "Database configuration"}</h2><p className="mt-1 text-sm text-slate-500">{isArabic ? "الاستثناءات ظاهرة بوضوح ويمكن إعادتها للقيم الافتراضية." : "Overrides are explicit and can be reset to policy defaults."}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold dark:bg-slate-800">{view.databases.length}</span>
            </div>
            {view.databases.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">{isArabic ? "لا توجد قواعد بيانات مستأجرين على هذا الخادم." : "No tenant databases are placed on this server."}</p>
            ) : (
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3 text-start">{isArabic ? "قاعدة البيانات" : "Database"}</th><th className="px-5 py-3 text-start">{isArabic ? "حالة المستأجر" : "Tenant status"}</th><th className="px-5 py-3 text-start">{isArabic ? "النسخ" : "Backup"}</th><th className="px-5 py-3 text-start">{isArabic ? "الضغط" : "Compression"}</th><th className="px-5 py-3 text-end">{isArabic ? "الإجراءات" : "Actions"}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{view.databases.map((database) => <tr key={database.tenantId}><td className="px-5 py-4"><p className="font-mono font-bold">{database.databaseName}</p><p className="mt-1 font-mono text-xs text-slate-500">{database.tenantId}</p></td><td className="px-5 py-4 font-semibold">{database.tenantStatus}</td><td className="px-5 py-4">{database.backupEnabled ? (isArabic ? "مفعّل" : "Enabled") : (isArabic ? "متوقف" : "Disabled")}{database.override ? <span className="ms-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">Override</span> : null}</td><td className="px-5 py-4">{database.compressionEnabled ? database.compressionAlgorithm : "none"}</td><td className="px-5 py-4 text-end"><div className="inline-flex gap-2">{view.canManage ? <button type="button" onClick={() => openOverride(database)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">{isArabic ? "تعديل" : "Edit"}</button> : null}{view.canManage && database.override ? <button type="button" onClick={() => void view.resetOverride(database.tenantId).catch(() => undefined)} disabled={view.activeAction === `reset:${database.tenantId}`} className="grid size-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-900" aria-label={isArabic ? "إعادة الافتراضي" : "Reset override"}><Undo2 className="size-4" /></button> : null}</div></td></tr>)}</tbody></table></div>
            )}
          </section>
        </>
      )}

      <BackupDialog open={editingDatabase !== null} title={isArabic ? "تعديل استثناء قاعدة البيانات" : "Edit database override"} description={editingDatabase ? editingDatabase.databaseName : ""} confirmLabel={isArabic ? "حفظ الاستثناء" : "Save override"} onClose={() => setEditingDatabase(null)} onConfirm={() => { if (!editingDatabase) return; void view.saveOverride(editingDatabase.tenantId, { backupEnabled: triStateBoolean(overrideBackup), compressionEnabled: triStateBoolean(overrideCompression), compressionAlgorithm: overrideAlgorithm === "inherit" ? null : overrideAlgorithm as BackupCompressionAlgorithm }).then(() => setEditingDatabase(null)).catch(() => undefined); }} isSubmitting={editingDatabase ? view.activeAction === `override:${editingDatabase.tenantId}` : false} confirmDisabled={!view.ownsSelectedServerState}>
        <Field label={isArabic ? "النسخ الاحتياطي" : "Backup enabled"}><select value={overrideBackup} onChange={(event) => setOverrideBackup(event.target.value)} className={inputClass}><option value="inherit">{isArabic ? "يرث السياسة" : "Inherit policy"}</option><option value="enabled">{isArabic ? "مفعّل" : "Enabled"}</option><option value="disabled">{isArabic ? "متوقف" : "Disabled"}</option></select></Field>
        <Field label={isArabic ? "الضغط" : "Compression enabled"}><select value={overrideCompression} onChange={(event) => setOverrideCompression(event.target.value)} className={inputClass}><option value="inherit">{isArabic ? "يرث السياسة" : "Inherit policy"}</option><option value="enabled">{isArabic ? "مفعّل" : "Enabled"}</option><option value="disabled">{isArabic ? "متوقف" : "Disabled"}</option></select></Field>
        <Field label={isArabic ? "الخوارزمية" : "Compression algorithm"}><select value={overrideAlgorithm} onChange={(event) => setOverrideAlgorithm(event.target.value)} className={inputClass}><option value="inherit">{isArabic ? "يرث السياسة" : "Inherit policy"}</option><option value={BackupCompressionAlgorithm.GZIP}>gzip</option><option value={BackupCompressionAlgorithm.NONE}>none</option></select></Field>
      </BackupDialog>
    </div>
  );
}

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">{label}{children}</label>;
}

function triStateBoolean(value: string): boolean | null {
  if (value === "enabled") return true;
  if (value === "disabled") return false;
  return null;
}
