"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchiveRestore, FileArchive, Filter, RefreshCw, Trash2 } from "lucide-react";
import { BackupArtifactStatus, type BackupArtifact } from "../types";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupStatusBadge } from "../components/BackupStatusBadge";
import { useBackupArtifacts } from "../hooks/useBackupArtifacts";
import { formatBackupBytes, formatBackupDate, shortBackupId } from "../lib/backup-format";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";
import { Card, CardContent, Field, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, DataTable, DegradedBanner, type ColumnDef } from "@/design-system";

export function BackupArtifactsScreen() {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const view = useBackupArtifacts();
  const [runId, setRunId] = useState(view.query.runId ?? "");
  const [databaseServerId, setDatabaseServerId] = useState(view.query.databaseServerId ?? "");
  const [tenantId, setTenantId] = useState(view.query.tenantId ?? "");
  const [deletingArtifact, setDeletingArtifact] = useState<BackupArtifact | null>(null);

  const [prevQuery, setPrevQuery] = useState(view.query);
  if (view.query !== prevQuery) {
    setPrevQuery(view.query);
    setRunId(view.query.runId ?? "");
    setDatabaseServerId(view.query.databaseServerId ?? "");
    setTenantId(view.query.tenantId ?? "");
  }

  const invalidUuid = [runId, databaseServerId, tenantId].some((value) => value && !uuidPattern.test(value));

  const columns: ColumnDef<BackupArtifact>[] = [
    {
      key: "artifact",
      headerEn: "Artifact",
      headerAr: "النسخة",
      cell: (artifact) => (
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-400">
            <FileArchive className="size-4" />
          </span>
          <div>
            <p className="font-mono font-semibold" title={artifact.id}>{shortBackupId(artifact.id)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground" title={artifact.runId}>{isArabic ? "العملية" : "Run"}: {shortBackupId(artifact.runId)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "database",
      headerEn: "Database",
      headerAr: "قاعدة البيانات",
      cell: (artifact) => (
        <div>
          <p className="font-mono font-semibold">{artifact.databaseName}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground" title={artifact.tenantId}>{shortBackupId(artifact.tenantId)}</p>
        </div>
      ),
    },
    { key: "size", headerEn: "Size", headerAr: "الحجم", cell: (artifact) => <span className="font-mono font-semibold">{formatBackupBytes(artifact.sizeBytes, isArabic ? "ar-EG" : "en-US")}</span> },
    { key: "sha256", headerEn: "SHA-256", headerAr: "SHA-256", cell: (artifact) => <span className="font-mono text-xs" title={artifact.sha256 ?? ""}>{artifact.sha256 ? `${artifact.sha256.slice(0, 12)}…` : "—"}</span> },
    { key: "finished", headerEn: "Finished", headerAr: "الاكتمال", cell: (artifact) => <span className="text-muted-foreground">{formatBackupDate(artifact.finishedAt, isArabic ? "ar-EG" : "en-US")}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (artifact) => (
        <div>
          <BackupStatusBadge status={artifact.status} />
          {artifact.hasFailure && <p className="mt-2 max-w-xs text-xs text-danger-600 dark:text-danger-400">{isArabic ? "تم تسجيل تفاصيل الفشل بأمان في Worker." : "Failure details are retained in Worker logs."}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      headerEn: "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (artifact) => {
        const terminal = artifact.status !== BackupArtifactStatus.PENDING && artifact.status !== BackupArtifactStatus.RUNNING;
        return (
          <div className="flex items-center justify-end gap-1">
            {view.canRestore && artifact.status === BackupArtifactStatus.COMPLETED && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={`/backup/restores?artifactId=${encodeURIComponent(artifact.id)}`}>
                  <ArchiveRestore className="size-4" />
                  {isArabic ? "استعادة" : "Restore"}
                </Link>
              </Button>
            )}
            {view.canDelete && terminal && (
              <button
                type="button"
                onClick={() => setDeletingArtifact(artifact)}
                aria-label={isArabic ? "حذف النسخة" : "Delete artifact"}
                className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950/40 dark:hover:text-danger-400"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-6">
      <BackupPageHeader
        eyebrow={isArabic ? "دليل قابل للاستعادة" : "Recoverable evidence"}
        title={isArabic ? "النسخ المحفوظة" : "Backup artifacts"}
        description={
          isArabic
            ? "عرض النسخ المكتملة وحجمها وبصمتها الآمنة. مفاتيح ومسارات التخزين لا تظهر في الواجهة."
            : "Inspect retained copies, sizes, and safe checksum evidence. Storage keys and paths are intentionally never rendered."
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
          <Field label={isArabic ? "معرف العملية" : "Run ID"}>
            {(fp) => <Input {...fp} value={runId} onChange={(e) => setRunId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
          <Field label={isArabic ? "الخادم" : "Server"}>
            {(fp) => (
              <Select value={databaseServerId} onValueChange={setDatabaseServerId}>
                <SelectTrigger {...fp}>
                  <SelectValue placeholder={isArabic ? "كل الخوادم" : "All servers"} />
                </SelectTrigger>
                <SelectContent>
                  {view.servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={isArabic ? "معرف المستأجر" : "Tenant ID"}>
            {(fp) => <Input {...fp} value={tenantId} onChange={(e) => setTenantId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
          <Button
            type="button"
            variant="primary"
            onClick={() => view.setQuery({ ...(runId ? { runId } : {}), ...(databaseServerId ? { databaseServerId } : {}), ...(tenantId ? { tenantId } : {}) })}
            disabled={invalidUuid}
          >
            <Filter className="size-4" />
            {isArabic ? "تطبيق" : "Apply"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading}>
            <RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />
            {isArabic ? "تحديث" : "Refresh"}
          </Button>
        </CardContent>
        {invalidUuid && <p className="px-5 pb-4 text-xs font-semibold text-danger-600">{isArabic ? "الفلاتر المعرّفة يجب أن تكون UUID صحيحة." : "Entered ID filters must be valid UUIDs."}</p>}
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{isArabic ? "تعذر تحميل أسماء خوادم قواعد البيانات" : "Database server names are unavailable"}</p>
          <p className="text-xs leading-5">{isArabic ? "تظل بيانات النسخ المحفوظة من Worker متاحة، بينما خيارات فلترة أسماء الخوادم غير متاحة مؤقتًا." : "Worker artifact data remains available; server-name filter options are temporarily unavailable."}</p>
        </DegradedBanner>
      )}

      {view.error ? null : (
        <div className="rounded-lg border border-border bg-card">
          <DataTable
            columns={columns}
            data={view.artifacts}
            isLoading={view.isLoading}
            getRowId={(artifact) => artifact.id}
            pagination={{ page: 1, limit: view.artifacts.length || 1, totalItems: view.artifacts.length, totalPages: 1, onPageChange: () => {} }}
            emptyState={{
              titleEn: "No matching artifacts",
              titleAr: "لا توجد نسخ مطابقة",
              descriptionEn: "Change the filters or inspect backup runs.",
              descriptionAr: "غيّر الفلاتر أو راجع عمليات النسخ.",
            }}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {isArabic ? "لا تعرض هذه الصفحة storageKey أو metadata أو أي مرجع اعتماد." : "This page never renders storageKey, raw metadata, or credential references."}
          </p>
        </div>
      )}

      <DestructiveActionModal
        isOpen={deletingArtifact !== null}
        onClose={() => {
          if (!view.activeAction) setDeletingArtifact(null);
        }}
        onConfirm={() => {
          if (!deletingArtifact) return;
          void view.deleteArtifact(deletingArtifact.id).then(() => setDeletingArtifact(null)).catch(() => undefined);
        }}
        title={isArabic ? "حذف النسخة المحفوظة نهائيًا" : "Permanently delete backup artifact"}
        description={
          isArabic
            ? "يحذف Worker ملف النسخة وسجلها. وإذا كانت آخر نسخة في العملية فسيحذف أيضًا سجل العملية وملف manifest؛ لن تعود نقطة الاستعادة متاحة."
            : "Worker deletes this backup object and row. If it is the run's last artifact, Worker also deletes the parent run and manifest; this recovery point will no longer be available."
        }
        targetName={deletingArtifact?.id ?? ""}
        actionType="destroy"
        requireNameTyping
        isSubmitting={deletingArtifact ? view.activeAction === `delete:${deletingArtifact.id}` : false}
      />
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
