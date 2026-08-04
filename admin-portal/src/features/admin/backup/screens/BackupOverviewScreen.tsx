"use client";

import Link from "next/link";
import { ArchiveRestore, CalendarClock, DatabaseBackup, FileCheck2, RefreshCw } from "lucide-react";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { ProtectionChain, type ProtectionChainStep } from "../components/ProtectionChain";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupOverview } from "../hooks/useBackupOverview";
import { formatBackupDate } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";

export function BackupOverviewScreen() {
  const { lang } = useI18n();
  const view = useBackupOverview();
  const isArabic = lang === "ar";
  const accessUnavailable = Boolean(view.databaseAccessError);

  if (view.isLoading) {
    return (
      <BackupStatePanel
        kind="loading"
        title={isArabic ? "جارٍ تحميل حالة الحماية" : "Loading protection state"}
        description={isArabic ? "يتم جمع الأدلة من Core وWorker." : "Collecting evidence from Core and Worker."}
      />
    );
  }

  if (view.error) {
    return (
      <BackupStatePanel
        kind="error"
        title={isArabic ? "تعذر تحميل وحدة النسخ الاحتياطي" : "Backup module could not be loaded"}
        description={view.error.message}
        correlationId={view.error.correlationId}
        action={
          <button type="button" onClick={() => void view.refresh()} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
            {isArabic ? "إعادة المحاولة" : "Retry"}
          </button>
        }
      />
    );
  }

  const chain: ProtectionChainStep[] = [
    {
      label: isArabic ? "صلاحية قاعدة البيانات" : "Database access",
      detail: !view.canReadDatabaseAccess
        ? isArabic ? "لا توجد صلاحية لقراءة دليل Core." : "Core evidence is permission restricted."
        : view.isDatabaseAccessLoading
          ? isArabic ? "جارٍ تحميل دليل Core." : "Core evidence is loading."
        : accessUnavailable
          ? isArabic ? "تعذر التحقق من دليل Core الآن." : "Core evidence is currently unavailable."
        : view.accessBinding?.status === "READY"
          ? isArabic ? "حساب النسخ الاحتياطي جاهز." : "Dedicated Backup principal is ready."
          : isArabic ? "لا يوجد دليل جاهزية مكتمل." : "No complete readiness evidence.",
      state: !view.canReadDatabaseAccess
        ? "unknown"
        : view.isDatabaseAccessLoading || accessUnavailable
          ? "unknown"
        : view.accessBinding?.status === "READY"
          ? "ready"
          : "attention",
    },
    {
      label: isArabic ? "سياسة الجدولة" : "Schedule policy",
      detail: view.selectedData.policy?.enabled
        ? `${view.selectedData.policy.cronExpression} · ${view.selectedData.policy.timezone}`
        : isArabic ? "لا توجد سياسة مفعلة لهذا الخادم." : "No enabled policy for this server.",
      state: view.selectedData.policy?.enabled ? "ready" : "attention",
    },
    {
      label: isArabic ? "آخر نسخة" : "Latest backup",
      detail: view.selectedData.latestRun
        ? `${view.selectedData.latestRun.status.replaceAll("_", " ")} · ${formatBackupDate(view.selectedData.latestRun.startedAt, isArabic ? "ar-EG" : "en-US")}`
        : isArabic ? "لا توجد عملية مسجلة." : "No run evidence recorded.",
      state: view.selectedData.latestRun?.status === "COMPLETED"
        ? "ready"
        : view.selectedData.latestRun
          ? "attention"
          : "unknown",
    },
    {
      label: isArabic ? "اختبار الاستعادة" : "Restore verification",
      detail: view.selectedData.latestRestore
        ? `${view.selectedData.latestRestore.status} · ${formatBackupDate(view.selectedData.latestRestore.startedAt, isArabic ? "ar-EG" : "en-US")}`
        : isArabic ? "لا يوجد دليل اختبار استعادة." : "No restore test evidence recorded.",
      state: view.selectedData.latestRestore?.status === "VERIFIED" || view.selectedData.latestRestore?.status === "PROMOTED"
        ? "ready"
        : view.selectedData.latestRestore
          ? "attention"
          : "unknown",
    },
  ];

  return (
    <div className="space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "مركز التعافي" : "Recovery control"}
        title={isArabic ? "نظرة عامة على النسخ الاحتياطي" : "Backup overview"}
        description={isArabic
          ? "رؤية تشغيلية للسياسات والنسخ المحفوظة واختبارات الاستعادة، بدون كشف مسارات التخزين أو بيانات الاعتماد."
          : "Operational evidence for policies, retained artifacts, and restore verification without exposing storage paths or credentials."}
        actions={
          <button type="button" onClick={() => void view.refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className="size-4" aria-hidden="true" />
            {isArabic ? "تحديث" : "Refresh"}
          </button>
        }
      />

      {view.databaseAccessError ? <BackupErrorBanner error={view.databaseAccessError} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: isArabic ? "سياسات مفعلة محملة" : "Loaded enabled policies", value: view.metrics.enabledPolicies, icon: CalendarClock },
          { label: isArabic ? "عمليات نشطة محملة" : "Loaded active runs", value: view.metrics.activeRuns, icon: DatabaseBackup },
          { label: isArabic ? "نسخ مكتملة محملة" : "Loaded completed artifacts", value: view.metrics.completedArtifacts, icon: FileCheck2 },
          { label: isArabic ? "استعادات موثقة محملة" : "Loaded verified restores", value: view.metrics.verifiedRestores, icon: ArchiveRestore },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{metric.label}</span>
              <metric.icon className="size-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
            </div>
            <p className="mt-4 font-mono text-3xl font-black text-slate-950 dark:text-white">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{isArabic ? "هذه الأرقام تصف لقطة Worker المحدودة التي أعادتها الـ API، وليست إجماليات كاملة للأسطول." : "These counts describe the bounded Worker snapshot returned by the APIs; they are not fleet-wide totals."}</p>

      {view.canReadDatabaseAccess ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <BackupServerSelect
              label={isArabic ? "سياق الخادم" : "Server context"}
              value={view.selectedServerId}
              servers={view.servers}
              onChange={view.setSelectedServerId}
              placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"}
            />
            {view.selectedServerId ? (
              <Link href={`/backup/access?databaseServerId=${encodeURIComponent(view.selectedServerId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-700 px-4 text-sm font-bold text-white hover:bg-cyan-800">
                {isArabic ? "فحص الصلاحية" : "Inspect access"}
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <BackupStatePanel
          kind="forbidden"
          title={isArabic ? "تفاصيل صلاحية قاعدة البيانات مقيدة" : "Database access detail is restricted"}
          description={isArabic ? "تظل مقاييس Worker متاحة، لكن ربطها بخادم يتطلب admin.database_servers.read." : "Worker metrics remain available, but server-level access evidence requires admin.database_servers.read."}
        />
      )}

      {view.canReadDatabaseAccess && view.isDatabaseAccessLoading ? (
        <BackupStatePanel
          kind="loading"
          title={isArabic ? "جارٍ تحميل سياق الخادم" : "Loading server context"}
          description={isArabic ? "قراءة دليل Core بشكل مستقل عن بيانات Worker." : "Reading Core evidence independently from Worker data."}
        />
      ) : view.canReadDatabaseAccess && view.databaseAccessError ? null
      : view.canReadDatabaseAccess && view.servers.length === 0 ? (
        <BackupStatePanel
          kind="empty"
          title={isArabic ? "لا توجد خوادم مسجلة" : "No registered database servers"}
          description={isArabic ? "سجّل خادم قاعدة بيانات قبل إعداد النسخ الاحتياطي." : "Register a database server before configuring backup."}
        />
      ) : view.canReadDatabaseAccess ? (
        <ProtectionChain
          steps={chain}
          title={isArabic ? "سلسلة الحماية" : "Protection chain"}
          description={isArabic ? "دليل الجاهزية من صلاحية قاعدة البيانات حتى إثبات الاستعادة. غير معروف تعني عدم وجود دليل من API." : "Readiness evidence from database access through recoverability. Unknown means the API returned no proof."}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">{isArabic ? "آخر عملية نسخ" : "Latest backup run"}</h2>
            <Link href="/backup/runs" className="text-sm font-bold text-cyan-700 hover:underline dark:text-cyan-300">{isArabic ? "عرض الكل" : "View all"}</Link>
          </div>
          {view.selectedData.latestRun ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold">{view.selectedData.latestRun.id}</p>
                <p className="mt-1 text-sm text-slate-500">{formatBackupDate(view.selectedData.latestRun.startedAt, isArabic ? "ar-EG" : "en-US")}</p>
              </div>
              <BackupStatusBadge status={view.selectedData.latestRun.status} />
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">{isArabic ? "لا توجد بيانات." : "No evidence available."}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold">{isArabic ? "آخر عملية استعادة" : "Latest restore"}</h2>
            <Link href="/backup/restores" className="text-sm font-bold text-cyan-700 hover:underline dark:text-cyan-300">{isArabic ? "عرض الكل" : "View all"}</Link>
          </div>
          {view.selectedData.latestRestore ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold">{view.selectedData.latestRestore.id}</p>
                <p className="mt-1 text-sm text-slate-500">{formatBackupDate(view.selectedData.latestRestore.startedAt, isArabic ? "ar-EG" : "en-US")}</p>
              </div>
              <BackupStatusBadge status={view.selectedData.latestRestore.status} />
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">{isArabic ? "لا توجد بيانات." : "No evidence available."}</p>}
        </section>
      </div>
    </div>
  );
}
