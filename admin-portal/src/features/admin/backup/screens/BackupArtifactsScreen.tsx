"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchiveRestore, FileArchive, Filter, RefreshCw, Trash2 } from "lucide-react";
import { BackupArtifactStatus, type BackupArtifact } from "../types";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { useBackupArtifacts } from "../hooks/useBackupArtifacts";
import { formatBackupBytes, formatBackupDate, shortBackupId } from "../lib/backup-format";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";
import { Card, CardContent, Field, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, DataTable, DegradedBanner, StatusBadge, type ColumnDef } from "@/design-system";

export function BackupArtifactsScreen() {
  const { lang, t } = useI18n();
  const copy = t.backup.artifactsScreen;
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
            <p className="mt-1 font-mono text-xs text-muted-foreground" title={artifact.runId}>{copy.runLabel}: {shortBackupId(artifact.runId)}</p>
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
    { key: "size", headerEn: "Size", headerAr: "الحجم", cell: (artifact) => <span className="font-mono font-semibold">{formatBackupBytes(artifact.sizeBytes, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    { key: "sha256", headerEn: "SHA-256", headerAr: "SHA-256", cell: (artifact) => <span className="font-mono text-xs" title={artifact.sha256 ?? ""}>{artifact.sha256 ? `${artifact.sha256.slice(0, 12)}…` : "—"}</span> },
    { key: "finished", headerEn: "Finished", headerAr: "الاكتمال", cell: (artifact) => <span className="text-muted-foreground">{formatBackupDate(artifact.finishedAt, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (artifact) => (
        <div>
          <StatusBadge status={artifact.status} />
          {artifact.hasFailure && <p className="mt-2 max-w-xs text-xs text-danger-600 dark:text-danger-400">{copy.failureRetainedNote}</p>}
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
                  {copy.restoreAction}
                </Link>
              </Button>
            )}
            {view.canDelete && terminal && (
              <button
                type="button"
                onClick={() => setDeletingArtifact(artifact)}
                aria-label={copy.deleteAriaLabel}
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
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
          <Field label={copy.runIdLabel}>
            {(fp) => <Input {...fp} value={runId} onChange={(e) => setRunId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
          <Field label={copy.serverLabel}>
            {(fp) => (
              <Select value={databaseServerId} onValueChange={setDatabaseServerId}>
                <SelectTrigger {...fp}>
                  <SelectValue placeholder={copy.allServersPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {view.servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={copy.tenantIdLabel}>
            {(fp) => <Input {...fp} value={tenantId} onChange={(e) => setTenantId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
          <Button
            type="button"
            variant="primary"
            onClick={() => view.setQuery({ ...(runId ? { runId } : {}), ...(databaseServerId ? { databaseServerId } : {}), ...(tenantId ? { tenantId } : {}) })}
            disabled={invalidUuid}
          >
            <Filter className="size-4" />
            {copy.applyButton}
          </Button>
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading}>
            <RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />
            {copy.refreshButton}
          </Button>
        </CardContent>
        {invalidUuid && <p className="px-5 pb-4 text-xs font-semibold text-danger-600">{copy.invalidUuidError}</p>}
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{copy.degradedTitle}</p>
          <p className="text-xs leading-5">{copy.degradedDescription}</p>
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
            {copy.noSensitiveDataNote}
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
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        targetName={deletingArtifact?.id ?? ""}
        actionType="destroy"
        requireNameTyping
        isSubmitting={deletingArtifact ? view.activeAction === `delete:${deletingArtifact.id}` : false}
      />
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
