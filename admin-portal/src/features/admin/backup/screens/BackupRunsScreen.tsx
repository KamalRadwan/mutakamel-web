"use client";

import { useState } from "react";
import { DatabaseBackup, Play, RefreshCw, Trash2 } from "lucide-react";
import { BackupRunStatus, type BackupRun } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupServerSelect } from "../components/BackupServerSelect";
import { useBackupRuns } from "../hooks/useBackupRuns";
import { formatBackupDate, shortBackupId } from "../lib/backup-format";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
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
  const { lang, t } = useI18n();
  const copy = t.backup.runsScreen;
  const view = useBackupRuns();
  const [startOpen, setStartOpen] = useState(false);
  const [startServerId, setStartServerId] = useState("");
  const [reason, setReason] = useState("");
  const [tenantConcurrency, setTenantConcurrency] = useState(2);
  const [deletingRun, setDeletingRun] = useState<BackupRun | null>(null);

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
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-400">
            <DatabaseBackup className="size-4" />
          </span>
          <div>
            <p className="font-mono font-semibold" title={run.id}>{shortBackupId(run.id)}</p>
            {run.reason && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={run.reason}>{run.reason}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "server",
      headerEn: "Server",
      headerAr: "الخادم",
      cell: (run) => <p className="font-semibold">{view.servers.find((s) => s.id === run.databaseServerId)?.name ?? shortBackupId(run.databaseServerId)}</p>,
    },
    { key: "trigger", headerEn: "Trigger", headerAr: "النوع", cell: (run) => <span className="font-semibold uppercase">{run.trigger}</span> },
    {
      key: "progress",
      headerEn: "Progress",
      headerAr: "النتيجة",
      cell: (run) => (
        <div>
          <p className="font-mono font-semibold">{run.succeededTenants}/{run.totalTenants}</p>
          <p className="mt-1 text-xs text-muted-foreground">{run.failedTenants} failed · {run.skippedTenants} skipped</p>
        </div>
      ),
    },
    { key: "started", headerEn: "Started", headerAr: "بدأت", cell: (run) => <span className="text-muted-foreground">{formatBackupDate(run.startedAt, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (run) => (
        <div>
          <StatusBadge status={run.status} />
          {run.hasFailure && <p className="mt-2 max-w-xs text-xs text-danger-600 dark:text-danger-400">{t.backup.artifactsScreen.failureRetainedNote}</p>}
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
          <Button type="button" variant="ghost" size="sm" onClick={() => setDeletingRun(run)}>
            <Trash2 className="size-4" />
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
              <Play className="size-4" />
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
              <Select value={view.databaseServerId} onValueChange={view.setDatabaseServerId}>
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
              <Select value={view.status} onValueChange={(v) => view.setStatus(v as BackupRunStatus | "")}>
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
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading}>
            <RefreshCw className={`size-4 ${view.isLoading ? "animate-spin" : ""}`} />
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{t.backup.artifactsScreen.degradedTitle}</p>
          <p className="text-xs leading-5">{copy.degradedDescription}</p>
        </DegradedBanner>
      )}

      {view.error ? null : (
        <div className="rounded-lg border border-border bg-card">
          <DataTable
            columns={columns}
            data={view.runs}
            isLoading={view.isLoading}
            getRowId={(run) => run.id}
            pagination={{ page: 1, limit: view.runs.length || 1, totalItems: view.runs.length, totalPages: 1, onPageChange: () => {} }}
            emptyState={{
              titleEn: "No backup runs",
              titleAr: "لا توجد عمليات",
              descriptionEn: "No run matches the current filters.",
              descriptionAr: "لا توجد نتائج مطابقة للفلاتر الحالية.",
            }}
          />
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
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
      >
        {view.canReadServers ? (
          <BackupServerSelect label={copy.databaseServerFieldLabel} value={startServerId} servers={view.servers} onChange={setStartServerId} placeholder={copy.selectServerPlaceholder} />
        ) : (
          <Field label={copy.databaseServerIdLabel} hint={copy.databaseServerIdHint}>
            {(fp) => <Input {...fp} value={startServerId} onChange={(e) => setStartServerId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
        )}
        <Field label={copy.concurrencyLabel}>
          {(fp) => <Input {...fp} type="number" min={1} max={10} value={tenantConcurrency} onChange={(e) => setTenantConcurrency(Number(e.target.value))} />}
        </Field>
        <Field label={copy.auditReasonLabel}>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} />}
        </Field>
      </BackupDialog>

      <DestructiveActionModal
        isOpen={deletingRun !== null}
        onClose={() => {
          if (!view.activeAction) setDeletingRun(null);
        }}
        onConfirm={() => {
          if (!deletingRun) return;
          void view.deleteRun(deletingRun.id).then(() => setDeletingRun(null)).catch(() => undefined);
        }}
        title={copy.deleteModalTitle}
        description={copy.deleteModalDescription}
        targetName={deletingRun?.id ?? ""}
        actionType="destroy"
        requireNameTyping
        isSubmitting={deletingRun ? view.activeAction === `delete:${deletingRun.id}` : false}
      />
    </div>
  );
}

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
