"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
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
  FleetConfirmDialog,
  FleetDatum,
  FleetFieldError,
  FleetHero,
  FleetMeta,
  FleetPageFrame,
  FleetPagination,
  FleetStatePanel,
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
      ? { title: copy.confirmAttestTitle, body: copy.confirmAttestBody }
      : confirmation.action === "pause"
        ? { title: copy.confirmPauseTitle, body: copy.confirmPauseBody }
        : confirmation.action === "resume"
          ? { title: copy.confirmResumeTitle, body: copy.confirmResumeBody }
          : { title: copy.confirmCancelTitle, body: copy.confirmCancelBody }
    : { title: "", body: "" };

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
          <RolloutSummary rollout={rollout} copy={copy} />
          {view.rollout.data ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <FleetMeta result={view.rollout.data} copy={copy} />
            </div>
          ) : null}

          <section className="space-y-4 rounded-xl border border-amber-300 bg-white p-5 shadow-sm dark:border-amber-900 dark:bg-slate-900">
            <header>
              <h2 className="text-xl font-semibold">{copy.lifecycleControls}</h2>
              <p className="mt-1 text-xs text-slate-500">{copy.reasonHint}</p>
            </header>
            {!view.permissions.canManage ? (
              <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {copy.forbiddenManage}
              </p>
            ) : (
              <form
                onSubmit={(event) => event.preventDefault()}
                className="space-y-4"
              >
                <fieldset disabled={pendingManage} className="grid gap-3 md:grid-cols-2">
                  <label htmlFor="fleet-manage-revision" className="grid gap-1.5 text-sm font-semibold">
                    <span>{copy.expectedRevision}</span>
                    <input id="fleet-manage-revision" type="number" min={1} step={1} inputMode="numeric" value={manageDraft.expectedRevision || String(rollout.revision)} onChange={(event) => setManageDraft((current) => ({ ...current, expectedRevision: event.target.value }))} aria-invalid={Boolean(manageErrors.expectedRevision)} aria-describedby={manageErrors.expectedRevision ? "fleet-manage-revision-error" : undefined} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
                    <FleetFieldError id="fleet-manage-revision-error" code={manageErrors.expectedRevision} copy={copy} />
                  </label>
                  <label htmlFor="fleet-manage-reason" className="grid gap-1.5 text-sm font-semibold">
                    <span>{copy.reasonCode}</span>
                    <input id="fleet-manage-reason" dir="ltr" value={manageDraft.reasonCode} onChange={(event) => setManageDraft((current) => ({ ...current, reasonCode: event.target.value }))} aria-invalid={Boolean(manageErrors.reasonCode)} aria-describedby={manageErrors.reasonCode ? "fleet-manage-reason-error" : undefined} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-start font-mono text-xs uppercase dark:border-slate-700 dark:bg-slate-950" />
                    <FleetFieldError id="fleet-manage-reason-error" code={manageErrors.reasonCode} copy={copy} />
                  </label>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  {(["pause", "resume", "cancel"] as FleetManageAction[]).map((action) => (
                    <button key={action} type="button" disabled={pendingManage || !isFleetActionAllowed(rollout.status, action)} onClick={() => prepareManage(action)} className={`min-h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35 ${action === "cancel" ? "bg-rose-700" : action === "pause" ? "bg-amber-700" : "bg-emerald-700"}`}>
                      {copy[action]}
                    </button>
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
          </section>

          <RolloutTenants view={view} copy={copy} />
        </>
      ) : null}

      <section className="space-y-4 rounded-xl border border-indigo-300 bg-white p-5 shadow-sm dark:border-indigo-900 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">{copy.report}</h2>
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
                  copied={copied}
                  onCopy={() => {
                    if (!report.payloadBase64) return;
                    void navigator.clipboard.writeText(report.payloadBase64).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2_000);
                    });
                  }}
                />
                {view.report.data ? <FleetMeta result={view.report.data} copy={copy} /> : null}

                {report.status === "READY_FOR_ATTESTATION" ? (
                  !view.permissions.canAttest ? (
                    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                      {copy.forbiddenAttest}
                    </p>
                  ) : (
                    <form aria-label={copy.attestation} onSubmit={prepareAttestation} noValidate className="space-y-4 rounded-xl border border-rose-300 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/10">
                      <header>
                        <h3 className="text-lg font-semibold">{copy.attestation}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{copy.signatureHint}</p>
                      </header>
                      <fieldset disabled={pendingAttest} className="grid gap-3 md:grid-cols-2">
                        <AttestationField id="fleet-attest-revision" label={copy.expectedRevision} value={attestationDraft.expectedRevision || String(report.revision)} error={attestationErrors.expectedRevision} copy={copy} type="number" onChange={(expectedRevision) => setAttestationDraft((current) => ({ ...current, expectedRevision }))} />
                        <AttestationField id="fleet-publisher-key" label={copy.publisherKeyId} value={attestationDraft.publisherKeyId} error={attestationErrors.publisherKeyId} copy={copy} onChange={(publisherKeyId) => setAttestationDraft((current) => ({ ...current, publisherKeyId }))} />
                      </fieldset>
                      <label htmlFor="fleet-signature" className="grid gap-1.5 text-sm font-semibold">
                        <span>{copy.signatureBase64}</span>
                        <textarea id="fleet-signature" dir="ltr" spellCheck={false} rows={4} value={attestationDraft.signatureBase64} onChange={(event) => setAttestationDraft((current) => ({ ...current, signatureBase64: event.target.value }))} aria-invalid={Boolean(attestationErrors.signatureBase64)} aria-describedby={`fleet-signature-hint${attestationErrors.signatureBase64 ? " fleet-signature-error" : ""}`} className="rounded-xl border border-slate-300 bg-white p-3 text-start font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
                        <span id="fleet-signature-hint" className="text-xs font-normal text-slate-500">{copy.signatureHint}</span>
                        <FleetFieldError id="fleet-signature-error" code={attestationErrors.signatureBase64} copy={copy} />
                      </label>
                      <FleetCommandNotice view={view.attestCommand} copy={copy} onRetryExact={() => void view.retryAttestExact()} onClear={view.clearAttestCommand} />
                      <button type="submit" disabled={pendingAttest} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
                        {pendingAttest ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                        {pendingAttest ? copy.attesting : copy.attest}
                      </button>
                    </form>
                  )
                ) : null}
                {report.status !== "READY_FOR_ATTESTATION" ? (
                  <FleetCommandNotice view={view.attestCommand} copy={copy} onRetryExact={() => void view.retryAttestExact()} onClear={view.clearAttestCommand} />
                ) : null}
              </>
            ) : null}
      </section>

      <FleetConfirmDialog
        open={confirmation !== null}
        title={confirmationCopy.title}
        body={confirmationCopy.body}
        target={confirmation ? JSON.stringify(confirmation.command) : ""}
        copy={copy}
        pending={pendingManage || pendingAttest}
        onClose={() => {
          if (!pendingManage && !pendingAttest) setConfirmation(null);
        }}
        onConfirm={confirmCommand}
      />
    </FleetPageFrame>
  );
}

function RolloutSummary({ rollout, copy }: { rollout: FleetRollout; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  const progress = rollout.totalCount
    ? Math.min(100, Math.round(((rollout.completedCount + rollout.failedCount) / rollout.totalCount) * 100))
    : 0;
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{copy.rolloutDetail}</h2>
          <code dir="ltr" className="mt-1 block break-all text-start text-xs text-slate-500">{rollout.rolloutId}</code>
        </div>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">{copy.rolloutStatus[rollout.status]}</span>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold"><span>{copy.progress}</span><span>{progress}%</span></div>
        <div role="progressbar" aria-label={copy.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${progress}%` }} /></div>
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
        <FleetDatum label={copy.createdAt} value={formatInstant(rollout.createdAt)} />
        <FleetDatum label={copy.startedAt} value={formatInstant(rollout.startedAt)} />
        <FleetDatum label={copy.pausedAt} value={formatInstant(rollout.pausedAt)} />
        <FleetDatum label={copy.completedAt} value={formatInstant(rollout.completedAt)} />
      </dl>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{copy.targets}</h3>
        {rollout.targetSelection.length ? rollout.targetSelection.map((target) => (
          <code key={target.componentKey} dir="ltr" className="block break-all rounded-xl bg-slate-100 p-3 text-start text-xs dark:bg-slate-950">{JSON.stringify(target)}</code>
        )) : <p className="text-sm text-slate-500">{copy.none}</p>}
      </div>
    </section>
  );
}

function RolloutTenants({ view, copy }: { view: ReturnType<typeof useFleetRollout>; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{copy.tenantEvidence}</h2>
        <span className="text-sm font-semibold text-slate-500">{copy.total}: {view.tenants.data?.total ?? 0}</span>
      </header>
      <FleetStatePanel state={view.tenants.state} error={view.tenants.error} copy={copy} invalid={view.routeValid ? copy.contractError : copy.invalidRouteId} onRetry={view.refresh} />
      {view.tenants.state === "EMPTY" ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">{copy.emptyTenants}</p> : null}
      {view.tenants.data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1350px] text-start text-sm">
            <caption className="sr-only">{copy.tenantEvidence}</caption>
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                {[copy.tenantId, copy.rank, copy.batch, copy.currentStatus, copy.operationId, copy.eligibilityDigest, copy.evidenceDigest, copy.safeReason, copy.dispatchedAt, copy.completedAt].map((label) => <th key={label} className="px-3 py-2 text-start">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {view.tenants.data.items.map((tenant) => (
                <tr key={tenant.tenantId}>
                  <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.tenantId}</td>
                  <td className="px-3 py-3">{tenant.deterministicRank}</td>
                  <td className="px-3 py-3">{tenant.batchNumber}</td>
                  <td className="px-3 py-3 font-semibold">{copy.tenantStatus[tenant.status]}</td>
                  <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.operationId ?? copy.none}</td>
                  <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.eligibilityDigest}</td>
                  <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.evidenceDigest ?? copy.none}</td>
                  <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.safeReasonCode ?? copy.none}</td>
                  <td className="px-3 py-3 text-xs">{formatInstant(tenant.dispatchedAt)}</td>
                  <td className="px-3 py-3 text-xs">{formatInstant(tenant.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {view.tenants.data ? <><FleetPagination page={view.tenants.data.page} totalPages={view.tenants.data.totalPages} hasPrev={view.tenants.data.hasPrev} hasNext={view.tenants.data.hasNext} onPage={view.setPage} copy={copy} /><FleetMeta result={view.tenants.data} copy={copy} /></> : null}
    </section>
  );
}

function ReportDetail({ report, copy, copied, onCopy }: { report: FleetReport; copy: ReturnType<typeof getProvisioningFleetCopy>; copied: boolean; onCopy: () => void }) {
  const statusLabel = report.status === "NOT_READY" ? copy.reportNotReady : report.status === "READY_FOR_ATTESTATION" ? copy.readyForAttestation : copy.attested;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100">{statusLabel}</div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FleetDatum label={copy.rolloutId} value={report.rolloutId} mono />
        <FleetDatum label={copy.revision} value={report.revision} />
        <FleetDatum label={copy.currentStatus} value={report.status} mono />
        <FleetDatum label={copy.generatedAt} value={formatInstant(report.generatedAt)} />
        <FleetDatum label={copy.signingDigest} value={report.signingDigest ?? copy.none} mono />
        <FleetDatum label={copy.reportDigest} value={report.reportDigest ?? copy.none} mono />
        <FleetDatum label={copy.publisherKeyId} value={report.publisherKeyId ?? copy.none} mono />
        <FleetDatum label={copy.signatureAlgorithm} value={report.signatureAlgorithm ?? copy.none} mono />
        <FleetDatum label={copy.signatureBase64} value={report.signatureBase64 ?? copy.none} mono />
        <FleetDatum label={copy.attestedAt} value={formatInstant(report.attestedAt)} />
        <FleetDatum label={copy.attestedByActorRef} value={report.attestedByActorRef ?? copy.none} mono />
      </dl>
      {report.payloadBase64 ? (
        <label htmlFor="fleet-report-payload" className="grid gap-2 text-sm font-semibold">
          <span>{copy.payloadBase64}</span>
          <textarea id="fleet-report-payload" dir="ltr" readOnly rows={7} value={report.payloadBase64} className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-start font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={onCopy} className="w-fit min-h-10 rounded-xl border border-indigo-300 px-4 text-xs font-semibold text-indigo-800 dark:border-indigo-900 dark:text-indigo-200">{copied ? copy.copied : copy.copyPayload}</button>
        </label>
      ) : null}
    </div>
  );
}

function AttestationField({ id, label, value, error, copy, type = "text", onChange }: { id: string; label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; type?: "text" | "number"; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-semibold">
      <span>{label}</span>
      <input id={id} type={type} dir="ltr" min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-start font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
      <FleetFieldError id={errorId} code={error} copy={copy} />
    </label>
  );
}
