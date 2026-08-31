"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Card,
  ConfirmActionModal,
  DataTable,
  Field,
  Input,
  Progress,
  Textarea,
  type ColumnDef,
} from "@/design-system";
import {
  buildAttestationCommand,
  buildManageCommand,
} from "./contracts";
import { getProvisioningFleetCopy } from "./copy";
import { useFleetRollout } from "./hooks";
import { isFleetActionAllowed } from "./model";
import {
  FleetBackLink,
  FleetCommandNotice,
  FleetDatum,
  FleetHero,
  FleetMeta,
  FleetPageFrame,
  FleetStatePanel,
  FleetStatusBadge,
  RefreshButton,
  formatInstant,
} from "./shared";
import type {
  AttestFleetReportCommand,
  FieldErrors,
  FleetAttestationDraft,
  FleetManageAction,
  FleetManageDraft,
  FleetReport,
  FleetRollout,
  FleetRolloutTenant,
  ManageFleetRolloutCommand,
} from "./types";

type Confirmation =
  | {
      kind: "manage";
      action: FleetManageAction;
      command: ManageFleetRolloutCommand;
    }
  | { kind: "attest"; command: AttestFleetReportCommand };

export function FleetRolloutScreen({ rolloutId }: { rolloutId: string }) {
  const { lang, dir } = useI18n();
  const copy = getProvisioningFleetCopy(lang);
  const copyEn = getProvisioningFleetCopy("en");
  const copyAr = getProvisioningFleetCopy("ar");
  const view = useFleetRollout(rolloutId);
  const rollout = view.rollout.data?.data ?? null;
  const report = view.report.data?.data ?? null;
  const [manageDraft, setManageDraft] = useState<FleetManageDraft>({
    expectedRevision: "",
    reasonCode: "",
  });
  const [manageErrors, setManageErrors] = useState<FieldErrors>({});
  const [attestationDraft, setAttestationDraft] =
    useState<FleetAttestationDraft>({
      expectedRevision: "",
      publisherKeyId: "",
      signatureBase64: "",
    });
  const [attestationErrors, setAttestationErrors] = useState<FieldErrors>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copied, setCopied] = useState(false);
  const pendingManage = view.manageCommand.state === "PENDING";
  const pendingAttest = view.attestCommand.state === "PENDING";

  const prepareManage = (action: FleetManageAction) => {
    if (!rollout || !isFleetActionAllowed(rollout.status, action)) return;
    const built = buildManageCommand({
      ...manageDraft,
      expectedRevision:
        manageDraft.expectedRevision || String(rollout.revision),
    });
    setManageErrors(built.errors);
    if (built.command) setConfirmation({ kind: "manage", action, command: built.command });
  };

  const prepareAttestation = (event: FormEvent) => {
    event.preventDefault();
    if (!report) return;
    const built = buildAttestationCommand({
      ...attestationDraft,
      expectedRevision:
        attestationDraft.expectedRevision || String(report.revision),
    });
    setAttestationErrors(built.errors);
    if (built.command) setConfirmation({ kind: "attest", command: built.command });
  };

  const confirmCommand = () => {
    if (!confirmation) return;
    if (confirmation.kind === "manage") {
      void view
        .manage(confirmation.action, confirmation.command)
        .then((result) => {
          if (result) {
            setConfirmation(null);
            setManageDraft({ expectedRevision: "", reasonCode: "" });
          }
        });
      return;
    }
    void view.attest(confirmation.command).then((result) => {
      if (result) {
        setConfirmation(null);
        setAttestationDraft({
          expectedRevision: "",
          publisherKeyId: "",
          signatureBase64: "",
        });
      }
    });
  };

  const confirmationCopy = confirmation
    ? confirmation.kind === "attest"
      ? { titleEn: copyEn.confirmAttestTitle, titleAr: copyAr.confirmAttestTitle, bodyEn: copyEn.confirmAttestBody, bodyAr: copyAr.confirmAttestBody }
      : confirmation.action === "pause"
        ? { titleEn: copyEn.confirmPauseTitle, titleAr: copyAr.confirmPauseTitle, bodyEn: copyEn.confirmPauseBody, bodyAr: copyAr.confirmPauseBody }
        : confirmation.action === "resume"
          ? { titleEn: copyEn.confirmResumeTitle, titleAr: copyAr.confirmResumeTitle, bodyEn: copyEn.confirmResumeBody, bodyAr: copyAr.confirmResumeBody }
          : { titleEn: copyEn.confirmCancelTitle, titleAr: copyAr.confirmCancelTitle, bodyEn: copyEn.confirmCancelBody, bodyAr: copyAr.confirmCancelBody }
    : { titleEn: "", titleAr: "", bodyEn: "", bodyAr: "" };

  return (
    <FleetPageFrame dir={dir}>
      <FleetBackLink href="/provisioning/fleet" label={copy.directory} dir={dir} />
      <FleetHero
        copy={copy}
        action={
          <RefreshButton
            copy={copy}
            onClick={view.refresh}
            pending={
              view.rollout.isRefreshing ||
              view.tenants.isRefreshing ||
              view.report.isRefreshing
            }
          />
        }
      />
      <FleetStatePanel
        state={view.authLoading ? "LOADING" : view.rollout.state}
        error={view.rollout.error}
        copy={copy}
        invalid={view.routeValid ? copy.contractError : copy.invalidRouteId}
        onRetry={view.routeValid ? view.refresh : undefined}
      />

      {rollout ? (
        <>
          <RolloutSummary rollout={rollout} copy={copy} lang={lang} />
          {view.rollout.data ? (
            <Card className="p-5">
              <FleetMeta result={view.rollout.data} copy={copy} lang={lang} />
            </Card>
          ) : null}

          <Card className="space-y-4 border-warning/30 p-5">
            <header>
              <h2 className="text-xl font-semibold text-foreground">{copy.lifecycleControls}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{copy.reasonHint}</p>
            </header>
            {!view.permissions.canManage ? (
              <p role="note" className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm font-semibold text-warning-subtle-foreground">
                {copy.forbiddenManage}
              </p>
            ) : (
              <form
                onSubmit={(event) => event.preventDefault()}
                className="space-y-4"
              >
                <fieldset disabled={pendingManage} className="grid gap-3 md:grid-cols-2">
                  <Field label={copy.expectedRevision} error={manageErrors.expectedRevision ? (copy.validation[manageErrors.expectedRevision as keyof typeof copy.validation] ?? copy.validationFailed) : undefined}>
                    {(fieldProps) => (
                      <Input {...fieldProps} type="number" min={1} step={1} inputMode="numeric" value={manageDraft.expectedRevision || String(rollout.revision)} onChange={(event) => setManageDraft((current) => ({ ...current, expectedRevision: event.target.value }))} />
                    )}
                  </Field>
                  <Field label={copy.reasonCode} error={manageErrors.reasonCode ? (copy.validation[manageErrors.reasonCode as keyof typeof copy.validation] ?? copy.validationFailed) : undefined}>
                    {(fieldProps) => (
                      <Input {...fieldProps} dir="ltr" value={manageDraft.reasonCode} onChange={(event) => setManageDraft((current) => ({ ...current, reasonCode: event.target.value }))} className="text-start font-mono text-xs uppercase" />
                    )}
                  </Field>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  {(["pause", "resume", "cancel"] as FleetManageAction[]).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant={action === "cancel" ? "destructive" : action === "resume" ? "primary" : "outline"}
                      disabled={pendingManage || !isFleetActionAllowed(rollout.status, action)}
                      onClick={() => prepareManage(action)}
                    >
                      {copy[action]}
                    </Button>
                  ))}
                </div>
                <FleetCommandNotice
                  view={view.manageCommand}
                  copy={copy}
                  onRetryExact={() => void view.retryManageExact()}
                  onClear={view.clearManageCommand}
                />
              </form>
            )}
          </Card>

          <RolloutTenants view={view} copy={copy} lang={lang} />
        </>
      ) : null}

      <Card className="space-y-4 p-5">
        <h2 className="text-xl font-semibold text-foreground">{copy.report}</h2>
        <FleetStatePanel
          state={view.authLoading ? "LOADING" : view.report.state}
          error={view.report.error}
          copy={copy}
          forbidden={copy.forbiddenReport}
          invalid={view.routeValid ? copy.contractError : copy.invalidRouteId}
          onRetry={view.permissions.canReadReport ? view.refresh : undefined}
        />
        {report ? (
          <>
            <ReportDetail
              report={report}
              copy={copy}
              lang={lang}
              copied={copied}
              onCopy={() => {
                if (!report.payloadBase64) return;
                void navigator.clipboard.writeText(report.payloadBase64).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2_000);
                });
              }}
            />
            {view.report.data ? <FleetMeta result={view.report.data} copy={copy} lang={lang} /> : null}

            {report.status === "READY_FOR_ATTESTATION" ? (
              !view.permissions.canAttest ? (
                <p role="note" className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm font-semibold text-warning-subtle-foreground">
                  {copy.forbiddenAttest}
                </p>
              ) : (
                <Card className="border-destructive/30 bg-destructive-subtle">
                  <form aria-label={copy.attestation} onSubmit={prepareAttestation} noValidate>
                    <div className="space-y-4 p-4">
                      <header>
                        <h3 className="text-lg font-semibold text-foreground">{copy.attestation}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.signatureHint}</p>
                      </header>
                      <fieldset disabled={pendingAttest} className="grid gap-3 md:grid-cols-2">
                        <AttestationField label={copy.expectedRevision} value={attestationDraft.expectedRevision || String(report.revision)} error={attestationErrors.expectedRevision} copy={copy} type="number" onChange={(expectedRevision) => setAttestationDraft((current) => ({ ...current, expectedRevision }))} />
                        <AttestationField label={copy.publisherKeyId} value={attestationDraft.publisherKeyId} error={attestationErrors.publisherKeyId} copy={copy} onChange={(publisherKeyId) => setAttestationDraft((current) => ({ ...current, publisherKeyId }))} />
                      </fieldset>
                      <Field label={copy.signatureBase64} hint={copy.signatureHint} error={attestationErrors.signatureBase64 ? (copy.validation[attestationErrors.signatureBase64 as keyof typeof copy.validation] ?? copy.validationFailed) : undefined}>
                        {(fieldProps) => (
                          <Textarea {...fieldProps} dir="ltr" spellCheck={false} rows={4} value={attestationDraft.signatureBase64} onChange={(event) => setAttestationDraft((current) => ({ ...current, signatureBase64: event.target.value }))} className="font-mono text-xs" />
                        )}
                      </Field>
                      <FleetCommandNotice view={view.attestCommand} copy={copy} onRetryExact={() => void view.retryAttestExact()} onClear={view.clearAttestCommand} />
                      <Button type="submit" variant="destructive" disabled={pendingAttest} loading={pendingAttest}>
                        {pendingAttest ? copy.attesting : copy.attest}
                      </Button>
                    </div>
                  </form>
                </Card>
              )
            ) : null}
            {report.status !== "READY_FOR_ATTESTATION" ? (
              <FleetCommandNotice view={view.attestCommand} copy={copy} onRetryExact={() => void view.retryAttestExact()} onClear={view.clearAttestCommand} />
            ) : null}
          </>
        ) : null}
      </Card>

      <ConfirmActionModal
        isOpen={confirmation !== null}
        titleEn={confirmationCopy.titleEn}
        titleAr={confirmationCopy.titleAr}
        descriptionEn={confirmationCopy.bodyEn}
        descriptionAr={confirmationCopy.bodyAr}
        confirmTextEn={copyEn.confirm}
        confirmTextAr={copyAr.confirm}
        isLoading={pendingManage || pendingAttest}
        onClose={() => {
          if (!pendingManage && !pendingAttest) setConfirmation(null);
        }}
        onConfirm={confirmCommand}
      />
    </FleetPageFrame>
  );
}

function RolloutSummary({ rollout, copy, lang }: { rollout: FleetRollout; copy: ReturnType<typeof getProvisioningFleetCopy>; lang: "ar" | "en" }) {
  const progress = rollout.totalCount
    ? Math.min(100, Math.round(((rollout.completedCount + rollout.failedCount) / rollout.totalCount) * 100))
    : 0;
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{copy.rolloutDetail}</h2>
          <code dir="ltr" className="mt-1 block break-all text-start text-xs text-muted-foreground">{rollout.rolloutId}</code>
        </div>
        <FleetStatusBadge status={rollout.status} label={copy.rolloutStatus[rollout.status]} />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold text-foreground"><span>{copy.progress}</span><span>{progress}%</span></div>
        <Progress value={progress} aria-label={copy.progress} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FleetDatum label={copy.previewId} value={rollout.previewId} mono />
        <FleetDatum label={copy.operationType} value={copy.operation[rollout.operationType]} />
        <FleetDatum label={copy.operationCommand} value={JSON.stringify(rollout.operationCommand)} mono />
        <FleetDatum label={copy.revision} value={rollout.revision} />
        <FleetDatum label={copy.canarySize} value={rollout.canarySize} />
        <FleetDatum label={copy.batchSize} value={rollout.batchSize} />
        <FleetDatum label={copy.maxParallel} value={rollout.maxParallel} />
        <FleetDatum label={copy.failureThreshold} value={rollout.failureThreshold} />
        <FleetDatum label={copy.total} value={rollout.totalCount} />
        <FleetDatum label={copy.completed} value={rollout.completedCount} />
        <FleetDatum label={copy.failed} value={rollout.failedCount} />
        <FleetDatum label={copy.currentBatch} value={rollout.currentBatch} />
        <FleetDatum label={copy.targetSelectionDigest} value={rollout.targetSelectionDigest} mono />
        <FleetDatum label={copy.selectionDigest} value={rollout.selectionDigest} mono />
        <FleetDatum label={copy.safeReason} value={rollout.safeReasonCode ?? copy.none} mono />
        <FleetDatum label={copy.createdAt} value={formatInstant(rollout.createdAt, lang)} />
        <FleetDatum label={copy.startedAt} value={formatInstant(rollout.startedAt, lang)} />
        <FleetDatum label={copy.pausedAt} value={formatInstant(rollout.pausedAt, lang)} />
        <FleetDatum label={copy.completedAt} value={formatInstant(rollout.completedAt, lang)} />
      </dl>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{copy.targets}</h3>
        {rollout.targetSelection.length ? rollout.targetSelection.map((target) => (
          <code key={target.componentKey} dir="ltr" className="block break-all rounded-lg bg-muted p-3 text-start text-xs">{JSON.stringify(target)}</code>
        )) : <p className="text-sm text-muted-foreground">{copy.none}</p>}
      </div>
    </Card>
  );
}

function RolloutTenants({ view, copy, lang }: { view: ReturnType<typeof useFleetRollout>; copy: ReturnType<typeof getProvisioningFleetCopy>; lang: "ar" | "en" }) {
  const columns: ColumnDef<FleetRolloutTenant>[] = [
    { key: "tenantId", headerEn: "Tenant", headerAr: "المستأجر", cell: (t) => <span dir="ltr" className="text-start font-mono text-xs">{t.tenantId}</span> },
    { key: "rank", headerEn: copy.rank, headerAr: copy.rank, cell: (t) => t.deterministicRank },
    { key: "batch", headerEn: copy.batch, headerAr: copy.batch, cell: (t) => t.batchNumber },
    { key: "status", headerEn: copy.currentStatus, headerAr: copy.currentStatus, cell: (t) => <FleetStatusBadge status={t.status} label={copy.tenantStatus[t.status]} /> },
    { key: "operationId", headerEn: copy.operationId, headerAr: copy.operationId, cell: (t) => <span dir="ltr" className="text-start font-mono text-xs">{t.operationId ?? copy.none}</span> },
    { key: "eligibilityDigest", headerEn: copy.eligibilityDigest, headerAr: copy.eligibilityDigest, cell: (t) => <span dir="ltr" className="text-start font-mono text-xs">{t.eligibilityDigest}</span> },
    { key: "evidenceDigest", headerEn: copy.evidenceDigest, headerAr: copy.evidenceDigest, cell: (t) => <span dir="ltr" className="text-start font-mono text-xs">{t.evidenceDigest ?? copy.none}</span> },
    { key: "safeReason", headerEn: copy.safeReason, headerAr: copy.safeReason, cell: (t) => <span dir="ltr" className="text-start font-mono text-xs">{t.safeReasonCode ?? copy.none}</span> },
    { key: "dispatchedAt", headerEn: copy.dispatchedAt, headerAr: copy.dispatchedAt, cell: (t) => <span className="text-xs">{formatInstant(t.dispatchedAt, lang)}</span> },
    { key: "completedAt", headerEn: copy.completedAt, headerAr: copy.completedAt, cell: (t) => <span className="text-xs">{formatInstant(t.completedAt, lang)}</span> },
  ];
  return (
    <Card className="space-y-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">{copy.tenantEvidence}</h2>
        <span className="text-sm font-semibold text-muted-foreground">{copy.total}: {view.tenants.data?.total ?? 0}</span>
      </header>
      <FleetStatePanel state={view.tenants.state} error={view.tenants.error} copy={copy} invalid={view.routeValid ? copy.contractError : copy.invalidRouteId} onRetry={view.refresh} />
      {view.tenants.state === "EMPTY" ? <p className="rounded-lg bg-muted p-5 text-center text-sm text-muted-foreground">{copy.emptyTenants}</p> : null}
      {view.tenants.data?.items.length ? (
        <DataTable
          labelEn="Fleet rollout tenant evidence"
          labelAr="أدلة مستأجري إطلاق الأسطول"
          columns={columns}
          data={view.tenants.data.items}
          isRefreshing={view.tenants.isRefreshing}
          getRowId={(row) => row.tenantId}
          pagination={{
            page: view.tenants.data.page,
            limit: view.tenants.data.limit,
            totalItems: view.tenants.data.total,
            totalPages: view.tenants.data.totalPages,
            onPageChange: view.setPage,
          }}
        />
      ) : null}
      {view.tenants.data ? <FleetMeta result={view.tenants.data} copy={copy} lang={lang} /> : null}
    </Card>
  );
}

function ReportDetail({ report, copy, lang, copied, onCopy }: { report: FleetReport; copy: ReturnType<typeof getProvisioningFleetCopy>; lang: "ar" | "en"; copied: boolean; onCopy: () => void }) {
  const statusLabel = report.status === "NOT_READY" ? copy.reportNotReady : report.status === "READY_FOR_ATTESTATION" ? copy.readyForAttestation : copy.attested;
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4 text-sm font-semibold text-foreground">
        <FleetStatusBadge status={report.status} label={statusLabel} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FleetDatum label={copy.rolloutId} value={report.rolloutId} mono />
        <FleetDatum label={copy.revision} value={report.revision} />
        <FleetDatum label={copy.currentStatus} value={report.status} mono />
        <FleetDatum label={copy.generatedAt} value={formatInstant(report.generatedAt, lang)} />
        <FleetDatum label={copy.signingDigest} value={report.signingDigest ?? copy.none} mono />
        <FleetDatum label={copy.reportDigest} value={report.reportDigest ?? copy.none} mono />
        <FleetDatum label={copy.publisherKeyId} value={report.publisherKeyId ?? copy.none} mono />
        <FleetDatum label={copy.signatureAlgorithm} value={report.signatureAlgorithm ?? copy.none} mono />
        <FleetDatum label={copy.signatureBase64} value={report.signatureBase64 ?? copy.none} mono />
        <FleetDatum label={copy.attestedAt} value={formatInstant(report.attestedAt, lang)} />
        <FleetDatum label={copy.attestedByActorRef} value={report.attestedByActorRef ?? copy.none} mono />
      </dl>
      {report.payloadBase64 ? (
        <Field label={copy.payloadBase64}>
          {(fieldProps) => (
            <div className="space-y-2">
              <Textarea {...fieldProps} dir="ltr" readOnly rows={7} value={report.payloadBase64 ?? ""} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={onCopy}>
                {copied ? copy.copied : copy.copyPayload}
              </Button>
            </div>
          )}
        </Field>
      ) : null}
    </div>
  );
}

function AttestationField({ label, value, error, copy, type = "text", onChange }: { label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; type?: "text" | "number"; onChange: (value: string) => void }) {
  return (
    <Field label={label} error={error ? (copy.validation[error as keyof typeof copy.validation] ?? copy.validationFailed) : undefined}>
      {(fieldProps) => (
        <Input {...fieldProps} type={type} dir="ltr" min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="text-start font-mono text-xs" />
      )}
    </Field>
  );
}
