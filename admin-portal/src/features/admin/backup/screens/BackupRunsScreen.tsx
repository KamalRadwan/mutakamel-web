"use client";

import { useMemo, useState } from "react";
import { DatabaseBackup, Play, RefreshCw, Trash2 } from "lucide-react";
import { BackupRunStatus, type BackupRun } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { useBackupRuns } from "../hooks/useBackupRuns";
import { formatBackupDate, formatBackupNumber, shortBackupId } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Textarea,
  Button,
  DataTable,
  DegradedBanner,
  AmbiguousOutcomePanel,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";

export function BackupRunsScreen() {
  const { dir, lang, t } = useI18n();
  const copy = t.backup.runsScreen;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const view = useBackupRuns();
  const [startOpen, setStartOpen] = useState(false);
  const [startServerId, setStartServerId] = useState("");
  const [reason, setReason] = useState("");
  const [tenantConcurrency, setTenantConcurrency] = useState(2);
  const [deletingRun, setDeletingRun] = useState<BackupRun | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const serverNameById = useMemo(
    () => new Map(view.servers.map((server) => [server.id, server.name])),
    [view.servers],
  );

  const openStart = () => {
    setStartServerId(
      view.pendingCommandAttempt?.resource.kind === "DATABASE_SERVER"
        ? view.pendingCommandAttempt.resource.id
        : view.databaseServerId || view.servers[0]?.id || "",
    );
    setReason("");
    setTenantConcurrency(2);
    setStartOpen(true);
  };

  const columns: ColumnDef<BackupRun>[] = [
    {
      key: "run",
      headerEn: "Run",
      headerAr: "العملية",
      cell: (run) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">
            <DatabaseBackup className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p dir="ltr" className="font-mono font-semibold" title={run.id}>{shortBackupId(run.id)}</p>
            {run.reason && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={run.reason}>{run.reason}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "server",
      headerEn: "Server",
      headerAr: "الخادم",
      cell: (run) => <p className="font-semibold">{serverNameById.get(run.databaseServerId) ?? <span dir="ltr" className="font-mono">{shortBackupId(run.databaseServerId)}</span>}</p>,
    },
    { key: "trigger", headerEn: "Trigger", headerAr: "النوع", cell: (run) => <span className="font-semibold">{lang === "ar" ? (run.trigger === "manual" ? "يدوي" : "مجدول") : run.trigger === "manual" ? "Manual" : "Scheduled"}</span> },
    {
      key: "progress",
      headerEn: "Progress",
      headerAr: "النتيجة",
      cell: (run) => (
        <div>
          <p className="font-semibold tabular-nums"><bdi>{formatBackupNumber(run.succeededTenants, locale)}</bdi> / <bdi>{formatBackupNumber(run.totalTenants, locale)}</bdi></p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lang === "ar"
              ? <><bdi>{formatBackupNumber(run.failedTenants, locale)}</bdi> فشل · <bdi>{formatBackupNumber(run.skippedTenants, locale)}</bdi> تم تخطيه</>
              : <>{formatBackupNumber(run.failedTenants, locale)} failed · {formatBackupNumber(run.skippedTenants, locale)} skipped</>}
          </p>
        </div>
      ),
    },
    { key: "started", headerEn: "Started", headerAr: "بدأت", cell: (run) => <span className="text-muted-foreground">{formatBackupDate(run.startedAt, locale)}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (run) => (
        <div>
          <StatusBadge status={run.status} />
          {run.hasFailure && <p className="mt-2 max-w-xs text-xs text-destructive">{t.backup.artifactsScreen.failureRetainedNote}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      headerEn: "Actions",
      headerAr: "الإجراءات",
      align: "end",
      cell: (run) => {
        const terminal = run.status !== BackupRunStatus.PENDING && run.status !== BackupRunStatus.RUNNING;
        return view.canDelete && terminal ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
            onClick={() => {
              setDeletingRun(run);
              setDeleteConfirmation("");
            }}
            disabled={Boolean(view.activeAction)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {copy.deleteAction}
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
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
        actions={
          view.canStart && (
            <Button type="button" variant="primary" onClick={openStart} disabled={Boolean(view.activeAction)}>
              <Play className="size-4" aria-hidden="true" />
              {copy.startManualBackupAction}
            </Button>
          )
        }
      />

      {(view.retryableCommandError || view.pendingCommandAttempt) && (
        <AmbiguousOutcomePanel
          idempotencyKey={view.pendingCommandAttempt?.idempotencyKey}
          correlationId={view.retryableCommandError?.correlationId}
          message={copy.ambiguousMessage}
        />
      )}

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] lg:items-end">
          <Field label={copy.serverFilterLabel}>
            {(fp) => (
              <Select value={view.databaseServerId} onValueChange={view.setDatabaseServerId} dir={dir}>
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
          <Field label={copy.statusFilterLabel}>
            {(fp) => (
              <Select value={view.status} onValueChange={(v) => view.setStatus(v as BackupRunStatus | "")} dir={dir}>
                <SelectTrigger {...fp}>
                  <SelectValue placeholder={copy.allStatusesPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(BackupRunStatus).map((status) => (
                    <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Button type="button" variant="outline" className="sm:col-span-2 lg:col-span-1" onClick={() => void view.refresh()} disabled={view.isLoading} loading={view.isLoading}>
            {!view.isLoading && <RefreshCw className="size-4" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && !startOpen && !deletingRun && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{t.backup.artifactsScreen.degradedTitle}</p>
          <p className="text-xs leading-5">{copy.degradedDescription}</p>
        </DegradedBanner>
      )}

      {view.error && view.runs.length === 0 ? null : (
        <div className="space-y-3">
          <DataTable
            labelEn="Backup runs"
            labelAr="عمليات النسخ الاحتياطي"
            columns={columns}
            data={view.runs}
            isLoading={view.isLoading && view.runs.length === 0}
            isRefreshing={view.isLoading && view.runs.length > 0}
            getRowId={(run) => run.id}
            getRowLabel={(run) => `${lang === "ar" ? "عملية" : "Run"} ${shortBackupId(run.id)}`}
            responsiveMode="record-cards"
            pagination={{ page: 1, limit: view.runs.length || 1, totalItems: view.runs.length, totalPages: 1, onPageChange: () => {} }}
            emptyState={{
              titleEn: "No backup runs",
              titleAr: "لا توجد عمليات",
              descriptionEn: "No run matches the current filters.",
              descriptionAr: "لا توجد نتائج مطابقة للفلاتر الحالية.",
            }}
          />
          <p className="rounded-md border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            {copy.boundedHistoryNote}
          </p>
        </div>
      )}

      <BackupDialog
        open={startOpen}
        title={copy.startManualBackupDialogTitle}
        description={copy.dialogDescription}
        confirmLabel={copy.confirmStart}
        onClose={() => {
          if (!view.activeAction) setStartOpen(false);
        }}
        onConfirm={() =>
          void view
            .startRun({ databaseServerId: startServerId, reason: reason.trim(), tenantConcurrency })
            .then((run) => {
              if (run) setStartOpen(false);
            })
            .catch(() => undefined)
        }
        isSubmitting={view.activeAction === "start"}
        confirmDisabled={!uuidV7Pattern.test(startServerId) || !reason.trim() || reason.length > 500 || tenantConcurrency < 1 || tenantConcurrency > 10}
        error={view.error ?? view.retryableCommandError}
      >
        {view.canReadServers ? (
          <BackupServerSelect label={copy.databaseServerFieldLabel} value={startServerId} servers={view.servers} onChange={setStartServerId} placeholder={copy.selectServerPlaceholder} required />
        ) : (
          <Field label={copy.databaseServerIdLabel} hint={copy.databaseServerIdHint} required>
            {(fp) => <Input {...fp} dir="ltr" value={startServerId} onChange={(e) => setStartServerId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
        )}
        <Field label={copy.concurrencyLabel} required>
          {(fp) => <Input {...fp} dir="ltr" type="number" min={1} max={10} value={tenantConcurrency} onChange={(e) => setTenantConcurrency(Number(e.target.value))} />}
        </Field>
        <Field label={copy.auditReasonLabel} required>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} />}
        </Field>
      </BackupDialog>

      <BackupDialog
        open={deletingRun !== null}
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        confirmLabel={copy.deleteAction}
        onClose={() => {
          if (!view.activeAction) {
            setDeletingRun(null);
            setDeleteConfirmation("");
          }
        }}
        onConfirm={() => {
          if (!deletingRun) return;
          void view.deleteRun(deletingRun.id).then(() => {
            setDeletingRun(null);
            setDeleteConfirmation("");
          }).catch(() => undefined);
        }}
        isSubmitting={deletingRun ? view.activeAction === `delete:${deletingRun.id}` : false}
        confirmDisabled={!deletingRun || deleteConfirmation !== deletingRun.id}
        destructive
        error={view.error}
      >
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
          <p>{lang === "ar" ? "معرّف العملية المطلوب:" : "Required run ID:"}</p>
          <p dir="ltr" className="mt-1 break-all font-mono font-semibold">{deletingRun?.id}</p>
        </div>
        <Field label={lang === "ar" ? "اكتب معرّف العملية للتأكيد" : "Type the run ID to confirm"} required>
          {(fp) => <Input {...fp} dir="ltr" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />}
        </Field>
      </BackupDialog>
    </div>
  );
}

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
