"use client";

import Link from "next/link";
import { ArchiveRestore, CalendarClock, DatabaseBackup, FileCheck2, RefreshCw } from "lucide-react";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupOverview } from "../hooks/useBackupOverview";
import { formatBackupDate } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import { StatGrid, StatCard, Card, CardHeader, CardTitle, CardContent, Button, OperationTimeline, type OperationTimelineStep } from "@/design-system";

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
          <Button type="button" variant="primary" onClick={() => void view.refresh()}>
            {isArabic ? "إعادة المحاولة" : "Retry"}
          </Button>
        }
      />
    );
  }

  const chain: OperationTimelineStep[] = [
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
        ? "pending"
        : view.isDatabaseAccessLoading || accessUnavailable
          ? "pending"
          : view.accessBinding?.status === "READY"
            ? "done"
            : "warning",
    },
    {
      label: isArabic ? "سياسة الجدولة" : "Schedule policy",
      detail: view.selectedData.policy?.enabled
        ? `${view.selectedData.policy.cronExpression} · ${view.selectedData.policy.timezone}`
        : isArabic ? "لا توجد سياسة مفعلة لهذا الخادم." : "No enabled policy for this server.",
      state: view.selectedData.policy?.enabled ? "done" : "warning",
    },
    {
      label: isArabic ? "آخر نسخة" : "Latest backup",
      detail: view.selectedData.latestRun
        ? `${view.selectedData.latestRun.status.replaceAll("_", " ")} · ${formatBackupDate(view.selectedData.latestRun.startedAt, isArabic ? "ar-EG" : "en-US")}`
        : isArabic ? "لا توجد عملية مسجلة." : "No run evidence recorded.",
      state: view.selectedData.latestRun?.status === "COMPLETED" ? "done" : view.selectedData.latestRun ? "warning" : "pending",
    },
    {
      label: isArabic ? "اختبار الاستعادة" : "Restore verification",
      detail: view.selectedData.latestRestore
        ? `${view.selectedData.latestRestore.status} · ${formatBackupDate(view.selectedData.latestRestore.startedAt, isArabic ? "ar-EG" : "en-US")}`
        : isArabic ? "لا يوجد دليل اختبار استعادة." : "No restore test evidence recorded.",
      state:
        view.selectedData.latestRestore?.status === "VERIFIED" || view.selectedData.latestRestore?.status === "PROMOTED"
          ? "done"
          : view.selectedData.latestRestore
            ? "warning"
            : "pending",
    },
  ];

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "مركز التعافي" : "Recovery control"}
        title={isArabic ? "نظرة عامة على النسخ الاحتياطي" : "Backup overview"}
        description={
          isArabic
            ? "رؤية تشغيلية للسياسات والنسخ المحفوظة واختبارات الاستعادة، بدون كشف مسارات التخزين أو بيانات الاعتماد."
            : "Operational evidence for policies, retained artifacts, and restore verification without exposing storage paths or credentials."
        }
        actions={
          <Button type="button" variant="outline" onClick={() => void view.refresh()}>
            <RefreshCw className="size-4" />
            {isArabic ? "تحديث" : "Refresh"}
          </Button>
        }
      />

      {view.databaseAccessError && <BackupErrorBanner error={view.databaseAccessError} />}

      <StatGrid>
        <StatCard label={isArabic ? "سياسات مفعلة محملة" : "Loaded enabled policies"} value={view.metrics.enabledPolicies} icon={CalendarClock} />
        <StatCard label={isArabic ? "عمليات نشطة محملة" : "Loaded active runs"} value={view.metrics.activeRuns} icon={DatabaseBackup} />
        <StatCard label={isArabic ? "نسخ مكتملة محملة" : "Loaded completed artifacts"} value={view.metrics.completedArtifacts} icon={FileCheck2} />
        <StatCard label={isArabic ? "استعادات موثقة محملة" : "Loaded verified restores"} value={view.metrics.verifiedRestores} icon={ArchiveRestore} />
      </StatGrid>
      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "هذه الأرقام تصف لقطة Worker المحدودة التي أعادتها الـ API، وليست إجماليات كاملة للأسطول."
          : "These counts describe the bounded Worker snapshot returned by the APIs; they are not fleet-wide totals."}
      </p>

      {view.canReadDatabaseAccess ? (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <BackupServerSelect
              label={isArabic ? "سياق الخادم" : "Server context"}
              value={view.selectedServerId}
              servers={view.servers}
              onChange={view.setSelectedServerId}
              placeholder={isArabic ? "اختر خادم قاعدة بيانات" : "Select a database server"}
            />
            {view.selectedServerId && (
              <Button variant="primary" asChild>
                <Link href={`/backup/access?databaseServerId=${encodeURIComponent(view.selectedServerId)}`}>
                  {isArabic ? "فحص الصلاحية" : "Inspect access"}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
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
      ) : view.canReadDatabaseAccess && view.databaseAccessError ? null : view.canReadDatabaseAccess && view.servers.length === 0 ? (
        <BackupStatePanel
          kind="empty"
          title={isArabic ? "لا توجد خوادم مسجلة" : "No registered database servers"}
          description={isArabic ? "سجّل خادم قاعدة بيانات قبل إعداد النسخ الاحتياطي." : "Register a database server before configuring backup."}
        />
      ) : view.canReadDatabaseAccess ? (
        <OperationTimeline
          steps={chain}
          title={isArabic ? "سلسلة الحماية" : "Protection chain"}
          description={isArabic ? "دليل الجاهزية من صلاحية قاعدة البيانات حتى إثبات الاستعادة. غير معروف تعني عدم وجود دليل من API." : "Readiness evidence from database access through recoverability. Unknown means the API returned no proof."}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{isArabic ? "آخر عملية نسخ" : "Latest backup run"}</CardTitle>
            <Link href="/backup/runs" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              {isArabic ? "عرض الكل" : "View all"}
            </Link>
          </CardHeader>
          <CardContent>
            {view.selectedData.latestRun ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-semibold">{view.selectedData.latestRun.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatBackupDate(view.selectedData.latestRun.startedAt, isArabic ? "ar-EG" : "en-US")}</p>
                </div>
                <BackupStatusBadge status={view.selectedData.latestRun.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد بيانات." : "No evidence available."}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{isArabic ? "آخر عملية استعادة" : "Latest restore"}</CardTitle>
            <Link href="/backup/restores" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              {isArabic ? "عرض الكل" : "View all"}
            </Link>
          </CardHeader>
          <CardContent>
            {view.selectedData.latestRestore ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-semibold">{view.selectedData.latestRestore.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatBackupDate(view.selectedData.latestRestore.startedAt, isArabic ? "ar-EG" : "en-US")}</p>
                </div>
                <BackupStatusBadge status={view.selectedData.latestRestore.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد بيانات." : "No evidence available."}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
