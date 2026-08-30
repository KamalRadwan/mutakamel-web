"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, CheckCircle2, Play, RefreshCw } from "lucide-react";
import { RestoreRunStatus, type RestoreRun } from "../types";
import { BackupDialog } from "../components/BackupDialog";
import { BackupErrorBanner } from "../components/BackupErrorBanner";
import { BackupPageHeader } from "../components/BackupPageHeader";
import { BackupStatePanel } from "../components/BackupStatePanel";
import { useBackupRestores } from "../hooks/useBackupRestores";
import { formatBackupDate, shortBackupId } from "../lib/backup-format";
import { useI18n } from "@/i18n/I18nContext";
import {
  Card,
  CardContent,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  DataTable,
  DegradedBanner,
  AmbiguousOutcomePanel,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";

export function BackupRestoresScreen() {
  const { dir, lang, t } = useI18n();
  const copy = t.backup.restoresScreen;
  const view = useBackupRestores();
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState<RestoreRunStatus | "">("");
  const requestedArtifact = view.artifacts.find((artifact) => artifact.id === view.requestedArtifactId);
  const startSourceKey = `${view.requestedArtifactId}|${requestedArtifact?.id ?? ""}`;
  const requestedStartDraft = {
    sourceKey: startSourceKey,
    open: Boolean(requestedArtifact),
    artifactId: requestedArtifact?.id ?? "",
    targetDatabaseName: "",
    reason: "",
  };
  const [startDraft, setStartDraft] = useState(requestedStartDraft);
  const currentStartDraft = startDraft.sourceKey === startSourceKey ? startDraft : requestedStartDraft;
  const { open: startOpen, artifactId, targetDatabaseName, reason } = currentStartDraft;
  const updateStartDraft = (next: Partial<Omit<typeof currentStartDraft, "sourceKey">>) => {
    setStartDraft({ ...currentStartDraft, ...next, sourceKey: startSourceKey });
  };
  const [promotingRun, setPromotingRun] = useState<RestoreRun | null>(null);
  const [promotionReason, setPromotionReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const serverNameById = useMemo(
    () => new Map(view.servers.map((server) => [server.id, server.name])),
    [view.servers],
  );

  const openStart = () => {
    setStartDraft({
      sourceKey: startSourceKey,
      open: true,
      artifactId: view.pendingStartAttempt?.resource.kind === "BACKUP_ARTIFACT"
        ? view.pendingStartAttempt.resource.id
        : requestedArtifact?.id ?? view.artifacts[0]?.id ?? "",
      targetDatabaseName: "",
      reason: "",
    });
  };

  const targetValid = !targetDatabaseName || targetDatabaseNamePattern.test(targetDatabaseName);
  const tenantValid = !tenantId || uuidPattern.test(tenantId);

  const columns: ColumnDef<RestoreRun>[] = [
    {
      key: "restore",
      headerEn: "Restore",
      headerAr: "الاستعادة",
      cell: (restore) => (
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">
            <ArchiveRestore className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p dir="ltr" className="font-mono font-semibold" title={restore.id}>{shortBackupId(restore.id)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{serverNameById.get(restore.databaseServerId) ?? <span dir="ltr" className="font-mono">{shortBackupId(restore.databaseServerId)}</span>}</p>
          </div>
        </div>
      ),
    },
    { key: "source", headerEn: "Source", headerAr: "المصدر", cell: (restore) => <span dir="ltr" className="font-mono font-semibold">{restore.sourceDatabaseName}</span> },
    { key: "target", headerEn: "Target", headerAr: "الهدف", cell: (restore) => <span dir="ltr" className="font-mono font-semibold">{restore.targetDatabaseName}</span> },
    {
      key: "verification",
      headerEn: "Verification",
      headerAr: "الدليل",
      cell: (restore) =>
        restore.hasVerification ? (
          <span className="inline-flex items-center gap-2 text-info">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {copy.evidenceRecorded}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.notAvailable}</span>
        ),
    },
    { key: "started", headerEn: "Started", headerAr: "بدأت", cell: (restore) => <span className="text-muted-foreground">{formatBackupDate(restore.startedAt, lang === "ar" ? "ar-EG" : "en-US")}</span> },
    {
      key: "status",
      headerEn: "Status",
      headerAr: "الحالة",
      cell: (restore) => (
        <div>
          <StatusBadge status={restore.status} />
          {restore.hasFailure && <p className="mt-2 max-w-xs text-xs text-destructive">{t.backup.artifactsScreen.failureRetainedNote}</p>}
        </div>
      ),
    },
    {
      key: "action",
      headerEn: "Action",
      headerAr: "الإجراء",
      align: "end",
      cell: (restore) => {
        const anotherPromotionIsPending = Boolean(view.pendingPromotionAttempt && view.pendingPromotionAttempt.resource.id !== restore.id);
        return view.canRestore && restore.status === RestoreRunStatus.VERIFIED ? (
          <div className="max-w-xs text-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setPromotingRun(restore);
                setPromotionReason("");
                setConfirmationText("");
              }}
              disabled={Boolean(view.activeAction) || anotherPromotionIsPending}
              aria-describedby={anotherPromotionIsPending ? `promotion-blocked-${restore.id}` : undefined}
            >
              {copy.promoteAction}
            </Button>
            {anotherPromotionIsPending && (
              <p id={`promotion-blocked-${restore.id}`} className="mt-2 text-xs text-warning-subtle-foreground">
                {copy.resolvePreviousPromotionTitle}
              </p>
            )}
          </div>
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
          view.canRestore && (
            <Button type="button" variant="primary" onClick={openStart} disabled={view.artifacts.length === 0 || Boolean(view.activeAction)}>
              <Play className="size-4" aria-hidden="true" />
              {copy.startRestoreTestAction}
            </Button>
          )
        }
      />

      {(view.retryableCommandError || view.pendingStartAttempt || view.pendingPromotionAttempt) && (
        <AmbiguousOutcomePanel
          idempotencyKey={view.pendingStartAttempt?.idempotencyKey ?? view.pendingPromotionAttempt?.idempotencyKey}
          correlationId={view.retryableCommandError?.correlationId}
          message={copy.ambiguousMessage}
        />
      )}

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <Field label={copy.tenantIdLabel} error={!tenantValid ? copy.tenantIdError : undefined}>
            {(fp) => <Input {...fp} dir="ltr" value={tenantId} onChange={(e) => setTenantId(e.target.value.trim())} placeholder="UUIDv7" />}
          </Field>
          <Field label={copy.statusLabel}>
            {(fp) => (
              <Select value={status} onValueChange={(v) => setStatus(v as RestoreRunStatus | "")} dir={dir}>
                <SelectTrigger {...fp}>
                  <SelectValue placeholder={copy.allStatusesPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(RestoreRunStatus).map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Button type="button" variant="primary" disabled={!tenantValid} onClick={() => view.setQuery(tenantId, status)}>
            {copy.applyButton}
          </Button>
          <Button type="button" variant="outline" onClick={() => void view.refresh()} disabled={view.isLoading} loading={view.isLoading}>
            {!view.isLoading && <RefreshCw className="size-4" aria-hidden="true" />}
            {copy.refreshButton}
          </Button>
        </CardContent>
      </Card>

      {view.error && !startOpen && !promotingRun && <BackupErrorBanner error={view.error} />}
      {view.enrichmentWarning && (
        <DegradedBanner>
          <p className="font-medium">{t.backup.artifactsScreen.degradedTitle}</p>
          <p className="text-xs leading-5">{copy.degradedDescription}</p>
        </DegradedBanner>
      )}

      {view.error && view.restores.length === 0 ? null : view.restores.length === 0 && !view.isLoading ? (
        <BackupStatePanel
          kind="empty"
          title={copy.emptyTitle}
          description={view.artifacts.length === 0 ? copy.emptyNoArtifacts : copy.emptyStartHint}
        />
      ) : (
        <div className="space-y-3">
          <DataTable
            labelEn="Restore verification runs"
            labelAr="عمليات التحقق من الاستعادة"
            columns={columns}
            data={view.restores}
            isLoading={view.isLoading && view.restores.length === 0}
            isRefreshing={view.isLoading && view.restores.length > 0}
            getRowId={(restore) => restore.id}
            getRowLabel={(restore) => `${lang === "ar" ? "استعادة" : "Restore"} ${shortBackupId(restore.id)}`}
            responsiveMode="record-cards"
            pagination={{ page: 1, limit: view.restores.length || 1, totalItems: view.restores.length, totalPages: 1, onPageChange: () => {} }}
          />
          <p className="rounded-md border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            {copy.verificationNote}
          </p>
        </div>
      )}

      <BackupDialog
        open={startOpen}
        title={copy.startRestoreTestAction}
        description={copy.startDialogDescription}
        confirmLabel={copy.confirmStartTest}
        onClose={() => {
          if (!view.activeAction) updateStartDraft({ open: false });
        }}
        onConfirm={() =>
          void view
            .startRestore({ artifactId, ...(targetDatabaseName ? { targetDatabaseName } : {}), reason: reason.trim() })
            .then((run) => {
              if (run) updateStartDraft({ open: false });
            })
            .catch(() => undefined)
        }
        isSubmitting={view.activeAction === "start"}
        confirmDisabled={!artifactId || !reason.trim() || reason.length > 500 || !targetValid}
        error={view.error ?? view.retryableCommandError}
      >
        <Field label={copy.completedArtifactLabel} required>
          {(fp) => (
            <Select value={artifactId} onValueChange={(value) => updateStartDraft({ artifactId: value })} dir={dir}>
              <SelectTrigger {...fp}>
                <SelectValue placeholder={copy.selectArtifactPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {view.artifacts.map((artifact) => (
                  <SelectItem key={artifact.id} value={artifact.id}>{artifact.databaseName} · <span dir="ltr" className="font-mono">{shortBackupId(artifact.id)}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field
          label={copy.targetDbNameLabel}
          error={!targetValid ? copy.targetDbNameError : undefined}
        >
          {(fp) => <Input {...fp} dir="ltr" value={targetDatabaseName} onChange={(e) => updateStartDraft({ targetDatabaseName: e.target.value })} maxLength={63} placeholder="restore_tenant_..." />}
        </Field>
        <Field label={copy.auditReasonLabel} required>
          {(fp) => <Textarea {...fp} value={reason} onChange={(e) => updateStartDraft({ reason: e.target.value })} maxLength={500} rows={4} />}
        </Field>
      </BackupDialog>

      <BackupDialog
        open={promotingRun !== null}
        title={copy.promoteDialogTitle}
        description={copy.promoteDialogDescription}
        confirmLabel={copy.confirmPromote}
        onClose={() => {
          if (!view.activeAction) setPromotingRun(null);
        }}
        onConfirm={() => {
          if (!promotingRun) return;
          void view
            .promoteRestore(promotingRun.id, { reason: promotionReason.trim(), confirmationText })
            .then((run) => {
              if (run) setPromotingRun(null);
            })
            .catch(() => undefined);
        }}
        isSubmitting={promotingRun ? view.activeAction === `promote:${promotingRun.id}` : false}
        confirmDisabled={!promotingRun || promotionReason.trim().length === 0 || promotionReason.length > 500 || confirmationText !== promotingRun.targetDatabaseName}
        destructive
        error={view.error ?? view.retryableCommandError}
      >
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle p-4 text-sm text-destructive-subtle-foreground">
          <p dir="ltr" className="font-mono font-semibold">{promotingRun?.targetDatabaseName}</p>
          <p className="mt-1 text-xs">{copy.verifiedOnlyNote}</p>
        </div>
        <Field label={copy.promotionReasonLabel} required>
          {(fp) => <Textarea {...fp} value={promotionReason} onChange={(e) => setPromotionReason(e.target.value)} maxLength={500} rows={3} />}
        </Field>
        <Field label={copy.targetConfirmationLabel} required>
          {(fp) => <Input {...fp} dir="ltr" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} maxLength={63} />}
        </Field>
      </BackupDialog>
    </div>
  );
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const targetDatabaseNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
