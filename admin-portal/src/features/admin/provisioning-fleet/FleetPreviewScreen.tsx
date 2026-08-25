"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { buildRolloutCommand, initialRolloutDraft } from "./contracts";
import { getProvisioningFleetCopy } from "./copy";
import { useFleetPreview } from "./hooks";
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
  CreateFleetRolloutCommand,
  FieldErrors,
  FleetPreview,
  FleetRolloutDraft,
} from "./types";

export function FleetPreviewScreen({ previewId }: { previewId: string }) {
  const { lang, dir } = useI18n();
  const copy = getProvisioningFleetCopy(lang);
  const view = useFleetPreview(previewId);
  const preview = view.preview.data?.data ?? null;
  const [draft, setDraft] = useState<FleetRolloutDraft>(() =>
    initialRolloutDraft(null),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingCommand, setPendingCommand] =
    useState<CreateFleetRolloutCommand | null>(null);
  const pending = view.rolloutCommand.state === "PENDING";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    const built = buildRolloutCommand(preview, draft);
    setErrors(built.errors);
    if (built.command) setPendingCommand(built.command);
  };

  return (
    <FleetPageFrame dir={dir}>
      <FleetBackLink href="/provisioning/fleet" label={copy.directory} dir={dir} />
      <FleetHero
        copy={copy}
        action={
          <RefreshButton
            copy={copy}
            onClick={view.refresh}
            pending={view.preview.isRefreshing || view.tenants.isRefreshing}
          />
        }
      />

      <FleetStatePanel
        state={view.authLoading ? "LOADING" : view.preview.state}
        error={view.preview.error}
        copy={copy}
        invalid={view.routeValid ? copy.contractError : copy.invalidRouteId}
        onRetry={view.routeValid ? view.refresh : undefined}
      />

      {preview ? (
        <>
          <PreviewSummary preview={preview} copy={copy} />
          {view.preview.data ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <FleetMeta result={view.preview.data} copy={copy} />
            </div>
          ) : null}
          <PreviewTargets preview={preview} copy={copy} />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">{copy.tenantEvidence}</h2>
              <span className="text-sm font-bold text-slate-500">
                {copy.total}: {view.tenants.data?.total ?? 0}
              </span>
            </header>
            <FleetStatePanel
              state={view.tenants.state}
              error={view.tenants.error}
              copy={copy}
              invalid={view.routeValid ? copy.contractError : copy.invalidRouteId}
              onRetry={view.refresh}
            />
            {view.tenants.state === "EMPTY" ? (
              <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {copy.emptyTenants}
              </p>
            ) : null}
            {view.tenants.data?.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-start text-sm">
                  <caption className="sr-only">{copy.tenantEvidence}</caption>
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-start">{copy.tenantId}</th>
                      <th className="px-3 py-2 text-start">{copy.eligible}</th>
                      <th className="px-3 py-2 text-start">{copy.rank}</th>
                      <th className="px-3 py-2 text-start">{copy.safeReason}</th>
                      <th className="px-3 py-2 text-start">{copy.eligibilityDigest}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {view.tenants.data.items.map((tenant) => (
                      <tr key={tenant.tenantId}>
                        <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.tenantId}</td>
                        <td className="px-3 py-3 font-bold">{tenant.eligible ? copy.yes : copy.no}</td>
                        <td className="px-3 py-3">{tenant.deterministicRank}</td>
                        <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.safeReasonCode ?? copy.none}</td>
                        <td dir="ltr" className="px-3 py-3 text-start font-mono text-xs">{tenant.eligibilityDigest}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {view.tenants.data ? (
              <>
                <FleetPagination
                  page={view.tenants.data.page}
                  totalPages={view.tenants.data.totalPages}
                  hasPrev={view.tenants.data.hasPrev}
                  hasNext={view.tenants.data.hasNext}
                  onPage={view.setPage}
                  copy={copy}
                />
                <FleetMeta result={view.tenants.data} copy={copy} />
              </>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-rose-300 bg-white p-5 shadow-sm dark:border-rose-900 dark:bg-slate-900">
            <header>
              <h2 className="text-xl font-black">{copy.launchRollout}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.launchHint}</p>
            </header>
            {!view.permissions.canCreateRollout ? (
              <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                {copy.forbiddenRolloutCreate}
              </p>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField id="fleet-canary" label={copy.canarySize} value={draft.canarySize} error={errors.canarySize} copy={copy} onChange={(canarySize) => setDraft((current) => ({ ...current, canarySize }))} />
                  <NumberField id="fleet-batch-size" label={copy.batchSize} value={draft.batchSize} error={errors.batchSize} copy={copy} onChange={(batchSize) => setDraft((current) => ({ ...current, batchSize }))} />
                  <NumberField id="fleet-parallel" label={copy.maxParallel} value={draft.maxParallel} error={errors.maxParallel} copy={copy} onChange={(maxParallel) => setDraft((current) => ({ ...current, maxParallel }))} />
                  <NumberField id="fleet-failure" label={copy.failureThreshold} value={draft.failureThreshold} error={errors.failureThreshold} copy={copy} onChange={(failureThreshold) => setDraft((current) => ({ ...current, failureThreshold }))} />
                </div>
                <FleetFieldError id="fleet-preview-expired" code={errors.preview} copy={copy} />
                <FleetCommandNotice
                  view={view.rolloutCommand}
                  copy={copy}
                  successLabel={copy.rolloutCreated}
                  onRetryExact={() => void view.retryRolloutExact()}
                  onClear={view.clearRolloutCommand}
                  successAction={
                    view.rolloutCommand.result ? (
                      <Link href={`/provisioning/fleet/rollouts/${view.rolloutCommand.result.data.rolloutId}`} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-emerald-800 px-4 text-xs font-black text-white">
                        {copy.open}
                      </Link>
                    ) : null
                  }
                />
                <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-black text-white disabled:opacity-50">
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  {pending ? copy.launching : copy.launch}
                </button>
              </form>
            )}
          </section>
        </>
      ) : null}

      <FleetConfirmDialog
        open={pendingCommand !== null}
        title={copy.confirmLaunchTitle}
        body={copy.confirmLaunchBody}
        target={pendingCommand ? JSON.stringify(pendingCommand) : ""}
        copy={copy}
        pending={pending}
        onClose={() => !pending && setPendingCommand(null)}
        onConfirm={() => {
          if (!pendingCommand) return;
          void view.createRollout(pendingCommand).then((result) => {
            if (result) setPendingCommand(null);
          });
        }}
      />
    </FleetPageFrame>
  );
}

function PreviewSummary({ preview, copy }: { preview: FleetPreview; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{copy.previewDetail}</h2>
          <code dir="ltr" className="mt-1 block break-all text-start text-xs text-slate-500">{preview.previewId}</code>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{copy.operation[preview.operationType]}</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FleetDatum label={copy.eligible} value={preview.eligibleCount} />
        <FleetDatum label={copy.ineligible} value={preview.ineligibleCount} />
        <FleetDatum label={copy.createdAt} value={formatInstant(preview.createdAt)} />
        <FleetDatum label={copy.expiresAt} value={formatInstant(preview.expiresAt)} />
        <FleetDatum label={copy.targetSelectionDigest} value={preview.targetSelectionDigest} mono />
        <FleetDatum label={copy.selectionDigest} value={preview.selectionDigest} mono />
        <FleetDatum label={copy.operationCommand} value={JSON.stringify(preview.operationCommand)} mono />
        <FleetDatum label={copy.selection} value={JSON.stringify(preview.selectionFilter)} mono />
      </dl>
    </section>
  );
}

function PreviewTargets({ preview, copy }: { preview: FleetPreview; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black">{copy.targets}</h2>
      {preview.targetSelection.length ? preview.targetSelection.map((target) => (
        <dl key={target.componentKey} className="grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-950/50">
          <FleetDatum label={copy.componentKey} value={target.componentKey} mono />
          <FleetDatum label={copy.componentId} value={target.componentId} mono />
          <FleetDatum label={copy.targetReleaseId} value={target.targetReleaseId} mono />
          <FleetDatum label={copy.targetReleaseVersion} value={target.targetReleaseVersion} mono />
          <FleetDatum label={copy.targetManifestChecksum} value={target.targetManifestChecksum} mono />
          <FleetDatum label={copy.expectedCurrentReleaseId} value={target.expectedCurrentReleaseId ?? copy.none} mono />
          <FleetDatum label={copy.expectedCurrentManifestChecksum} value={target.expectedCurrentManifestChecksum ?? copy.none} mono />
        </dl>
      )) : <p className="text-sm text-slate-500">{copy.none}</p>}
    </section>
  );
}

function NumberField({ id, label, value, error, copy, onChange }: { id: string; label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-bold">
      <span>{label}</span>
      <input id={id} type="number" min={1} step={1} inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
      <FleetFieldError id={errorId} code={error} copy={copy} />
    </label>
  );
}
