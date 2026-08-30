"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchiveRestore, FileArchive, Filter, RefreshCw, Trash2 } from "lucide-react";
import { BackupArtifactStatus, type BackupArtifact } from "../types";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupDialog } from "../components/BackupDialog";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { useBackupArtifacts } from "../hooks/useBackupArtifacts";
import { formatBackupBytes, formatBackupDate, shortBackupId } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import { Card, CardContent, Field, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, DataTable, DegradedBanner, StatusBadge, type ColumnDef } from "@/design-system";

export function BackupArtifactsScreen() {
  const { dir, lang, t } = useI18n();
  const copy = t.backup.artifactsScreen;
  const view = useBackupArtifacts();
  const queryKey = `${view.query.runId ?? ""}|${view.query.databaseServerId ?? ""}|${view.query.tenantId ?? ""}`;
  const queryDraft = {
    queryKey,
    runId: view.query.runId ?? "",
    databaseServerId: view.query.databaseServerId ?? "",
    tenantId: view.query.tenantId ?? "",
  };
  const [filterDraft, setFilterDraft] = useState(queryDraft);
  const currentFilterDraft = filterDraft.queryKey === queryKey ? filterDraft : queryDraft;
  const { runId, databaseServerId, tenantId } = currentFilterDraft;
  const updateFilterDraft = (next: Partial<Omit<typeof currentFilterDraft, "queryKey">>) => {
    setFilterDraft({ ...currentFilterDraft, ...next, queryKey });
  };
  const [deletingArtifact, setDeletingArtifact] = useState<BackupArtifact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const runIdError = runId && !uuidPattern.test(runId) ? copy.invalidUuidError : undefined;
  const serverIdError = databaseServerId && !uuidPattern.test(databaseServerId) ? copy.invalidUuidError : undefined;
  const tenantIdError = tenantId && !uuidPattern.test(tenantId) ? copy.invalidUuidError : undefined;
  const invalidUuid = Boolean(runIdError || serverIdError || tenantIdError);

  const columns: ColumnDef<BackupArtifact>[] = [
    {
      key: "artifact",
      headerEn: "Artifact",
      headerAr: "النسخة",
      cell: (artifact) => (
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">
            <FileArchive className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p dir="ltr" className="font-mono font-semibold" title={artifact.id}>{shortBackupId(artifact.id)}</p>
            <p className="mt-1 text-xs text-muted-foreground" title={artifact.runId}>{copy.runLabel}: <span dir="ltr" className="font-mono">{shortBackupId(artifact.runId)}</span></p>
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
          <p dir="ltr" className="font-mono font-semibold">{artifact.databaseName}</p>
          <p dir="ltr" className="mt-1 font-mono text-xs text-muted-foreground" title={artifact.tenantId}>{shortBackupId(artifact.tenantId)}</p>
        </div>
      ),
    },
    { key: "size", headerEn: "Size", headerAr: "الحجم", cell: (artifact) => <span dir="ltr" className="font-mono font-semibold">{formatBackupBytes(artifact.sizeBytes, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    { key: "sha256", headerEn: "SHA-256", headerAr: "SHA-256", cell: (artifact) => <span dir="ltr" className="font-mono text-xs" title={artifact.sha256 ?? ""}>{artifact.sha256 ? `${artifact.sha256.slice(0, 12)}…` : "—"}</span> },
    { key: "finished", headerEn: "Finished", headerAr: "الاكتمال", cell: (artifact) => <span className="text-muted-foreground">{formatBackupDate(artifact.finishedAt, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (artifact) => (
        <div>
          <StatusBadge status={artifact.status} enumType="backup-artifact" />
          {artifact.hasFailure && <p className="mt-2 max-w-xs text-xs text-destructive">{copy.failureRetainedNote}</p>}
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
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                  {copy.restoreAction}
                </Link>
              </Button>
            )}
            {view.canDelete && terminal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeletingArtifact(artifact);
                  setDeleteConfirmation("");
                }}
                disabled={Boolean(view.activeAction)}
                aria-label={copy.deleteAriaLabel}
                className="size-9 p-0 text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
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
          <Field label={copy.runIdLabel} error={runIdError}>
            {(fp) => <Input {...fp} dir="ltr" value={runId} onChange={(e) => updateFilterDraft({ runId: e.target.value.trim() })} placeholder="UUIDv7" />}
          </Field>
          <Field label={copy.serverLabel} error={serverIdError}>
            {(fp) => (
              <Select value={databaseServerId} onValueChange={(value) => updateFilterDraft({ databaseServerId: value })} dir={dir}>
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
          <Field label={copy.tenantIdLabel} error={tenantIdError}>
            {(fp) => <Input {...fp} dir="ltr" value={tenantId} onChange={(e) => updateFilterDraft({ tenantId: e.target.value.trim() })} placeholder="UUIDv7" />}
          </Field>
          <Button
            type="button"
            variant="primary"
            onClick={() => view.setQuery({ ...(runId ? { runId } : {}), ...(databaseServerId ? { databaseServerId } : {}), ...(tenantId ? { tenantId } : {}) })}
            disabled={invalidUuid}
          >
            <Filter className="size-4" aria-hidden="true" />
            {copy.applyButton}
          </Button>
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading} loading={view.isLoading}>
            {!view.isLoading && <RefreshCw className="size-4" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && !deletingArtifact && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{copy.degradedTitle}</p>
          <p className="text-xs leading-5">{copy.degradedDescription}</p>
        </DegradedBanner>
      )}

      {view.error && view.artifacts.length === 0 ? null : (
        <div className="space-y-3">
          <DataTable
            labelEn="Backup artifacts"
            labelAr="نسخ النسخ الاحتياطي"
            columns={columns}
            data={view.artifacts}
            isLoading={view.isLoading && view.artifacts.length === 0}
            isRefreshing={view.isLoading && view.artifacts.length > 0}
            getRowId={(artifact) => artifact.id}
            getRowLabel={(artifact) => `${lang === "ar" ? "نسخة" : "Artifact"} ${shortBackupId(artifact.id)}`}
            responsiveMode="record-cards"
            pagination={{ page: 1, limit: view.artifacts.length || 1, totalItems: view.artifacts.length, totalPages: 1, onPageChange: () => {} }}
            emptyState={{
              titleEn: "No matching artifacts",
              titleAr: "لا توجد نسخ مطابقة",
              descriptionEn: "Change the filters or inspect backup runs.",
              descriptionAr: "غيّر الفلاتر أو راجع عمليات النسخ.",
            }}
          />
          <p className="rounded-md border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            {copy.noSensitiveDataNote}
          </p>
        </div>
      )}

      <BackupDialog
        open={deletingArtifact !== null}
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        confirmLabel={copy.deleteAriaLabel}
        onClose={() => {
          if (!view.activeAction) {
            setDeletingArtifact(null);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={() => {
          if (!deletingArtifact) return;
          void view.deleteArtifact(deletingArtifact.id).then(() => {
            setDeletingArtifact(null);
            setDeleteConfirmation("");
          }).catch(() => undefined);
        }}
        isSubmitting={deletingArtifact ? view.activeAction === `delete:${deletingArtifact.id}` : false}
        confirmDisabled={!deletingArtifact || deleteConfirmation !== deletingArtifact.id}
        destructive
        error={view.error}
      >
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
          <p>{lang === "ar" ? "معرّف النسخة المطلوب:" : "Required artifact ID:"}</p>
          <p dir="ltr" className="mt-1 break-all font-mono font-semibold">{deletingArtifact?.id}</p>
        </div>
        <Field label={lang === "ar" ? "اكتب معرّف النسخة للتأكيد" : "Type the artifact ID to confirm"} required>
          {(fp) => <Input {...fp} dir="ltr" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />}
        </Field>
      </BackupDialog>
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
