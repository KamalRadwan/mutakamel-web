"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  buildPreviewCommand,
  emptyTargetDraft,
  initialPreviewDraft,
  isUuidV7,
} from "./contracts";
import { getProvisioningFleetCopy } from "./copy";
import { useFleetDirectory } from "./hooks";
import {
  FleetBackLink,
  FleetCommandNotice,
  FleetConfirmDialog,
  FleetDatum,
  FleetFieldError,
  FleetHero,
  FleetMeta,
  FleetPageFrame,
  FleetStatePanel,
  RefreshButton,
  formatInstant,
} from "./shared";
import type {
  CreateFleetPreviewCommand,
  FieldErrors,
  FleetOperationType,
  FleetPreviewDraft,
  FleetTargetDraft,
  TenantLifecycleStatus,
} from "./types";

export function FleetDirectoryScreen() {
  const { lang, dir } = useI18n();
  const copy = getProvisioningFleetCopy(lang);
  const view = useFleetDirectory();
  const router = useRouter();
  const [draft, setDraft] = useState<FleetPreviewDraft>(initialPreviewDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingCommand, setPendingCommand] =
    useState<CreateFleetPreviewCommand | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const pending = view.previewCommand.state === "PENDING";

  const submitPreview = (event: FormEvent) => {
    event.preventDefault();
    const built = buildPreviewCommand(draft);
    setErrors(built.errors);
    if (built.command) setPendingCommand(built.command);
  };

  const openLookup = (event: FormEvent) => {
    event.preventDefault();
    const normalized = lookupId.trim().toLowerCase();
    if (!isUuidV7(normalized)) {
      setLookupError("uuid");
      return;
    }
    setLookupError(undefined);
    router.push(`/provisioning/fleet/previews/${normalized}`);
  };

  return (
    <FleetPageFrame dir={dir}>
      <FleetBackLink href="/provisioning" label={copy.back} dir={dir} />
      <FleetHero
        copy={copy}
        action={
          <RefreshButton
            copy={copy}
            onClick={view.refresh}
            pending={view.rollouts.isRefreshing}
          />
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header>
            <h2 className="text-xl font-semibold">{copy.directory}</h2>
          </header>
          <FleetStatePanel
            state={view.authLoading ? "LOADING" : view.rollouts.state}
            error={view.rollouts.error}
            copy={copy}
            onRetry={view.refresh}
          />
          {view.rollouts.state === "EMPTY" ? (
            <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              {copy.emptyRollouts}
            </p>
          ) : null}
          {view.rollouts.data?.data.map((rollout) => (
            <article
              key={rollout.rolloutId}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {copy.operation[rollout.operationType]}
                  </p>
                  <code dir="ltr" className="mt-1 block break-all text-start text-xs text-slate-500">
                    {rollout.rolloutId}
                  </code>
                </div>
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100">
                  {copy.rolloutStatus[rollout.status]}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 sm:grid-cols-4">
                <FleetDatum label={copy.total} value={rollout.totalCount} />
                <FleetDatum label={copy.completed} value={rollout.completedCount} />
                <FleetDatum label={copy.failed} value={rollout.failedCount} />
                <FleetDatum label={copy.revision} value={rollout.revision} />
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{formatInstant(rollout.createdAt)}</span>
                <Link
                  href={`/provisioning/fleet/rollouts/${rollout.rolloutId}`}
                  className="inline-flex min-h-10 items-center rounded-xl bg-cyan-700 px-4 font-semibold text-white"
                >
                  {copy.open}
                </Link>
              </div>
            </article>
          ))}
          {view.rollouts.data ? (
            <FleetMeta result={view.rollouts.data} copy={copy} />
          ) : null}
        </div>

        <form
          aria-label={copy.lookupPreview}
          onSubmit={openLookup}
          className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold">{copy.lookupPreview}</h2>
          <label htmlFor="fleet-preview-lookup" className="grid gap-1.5 text-sm font-semibold">
            <span>{copy.previewId}</span>
            <input
              id="fleet-preview-lookup"
              dir="ltr"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              aria-invalid={Boolean(lookupError)}
              aria-describedby={lookupError ? "fleet-preview-lookup-error" : undefined}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-start font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <FleetFieldError id="fleet-preview-lookup-error" code={lookupError} copy={copy} />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white dark:bg-cyan-700">
            {copy.openPreview}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header>
          <h2 className="text-xl font-semibold">{copy.previewBuilder}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {copy.previewBuilderHint}
          </p>
        </header>
        {view.authLoading ? (
          <FleetStatePanel state="LOADING" error={null} copy={copy} />
        ) : !view.permissions.canCreatePreview ? (
          <p role="note" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {copy.forbiddenPreviewCreate}
          </p>
        ) : (
          <form onSubmit={submitPreview} noValidate className="mt-5 space-y-6">
            <fieldset disabled={pending} className="space-y-4">
              <legend className="sr-only">{copy.previewBuilder}</legend>
              <label htmlFor="fleet-operation" className="grid gap-1.5 text-sm font-semibold">
                <span>{copy.operationType}</span>
                <select
                  id="fleet-operation"
                  value={draft.operationType}
                  onChange={(event) =>
                    changeOperation(
                      event.target.value as FleetOperationType,
                      draft,
                      setDraft,
                    )
                  }
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  {Object.entries(copy.operation).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {draft.operationType === "ADD_APPLICATION" ? (
                <TextField id="fleet-application-key" label={copy.applicationKey} value={draft.applicationKey} error={errors.applicationKey} copy={copy} onChange={(applicationKey) => setDraft((current) => ({ ...current, applicationKey }))} />
              ) : null}
              {draft.operationType === "DECOMMISSION" ? (
                <div className="space-y-3">
                  <TextField id="fleet-component-key" label={copy.componentKey} value={draft.componentKey} error={errors.componentKey} copy={copy} onChange={(componentKey) => setDraft((current) => ({ ...current, componentKey }))} />
                  <CheckField id="fleet-retention" label={copy.retentionAcknowledged} checked={draft.retentionAcknowledged} error={errors.retentionAcknowledged} copy={copy} onChange={(retentionAcknowledged) => setDraft((current) => ({ ...current, retentionAcknowledged }))} />
                </div>
              ) : (
                <TargetEditor draft={draft} setDraft={setDraft} errors={errors} copy={copy} />
              )}

              <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <legend className="px-2 text-sm font-semibold">{copy.selection}</legend>
                <div className="flex flex-wrap gap-4">
                  <RadioField id="fleet-explicit" label={copy.explicitSelection} checked={!draft.broadSelection} onChange={() => setDraft((current) => ({ ...current, broadSelection: false, allEligibleTenantsAcknowledged: false }))} />
                  <RadioField id="fleet-broad" label={copy.broadSelection} checked={draft.broadSelection} onChange={() => setDraft((current) => ({ ...current, broadSelection: true, tenantIdsText: "" }))} />
                </div>
                {draft.broadSelection ? (
                  <CheckField id="fleet-broad-ack" label={copy.broadAcknowledge} checked={draft.allEligibleTenantsAcknowledged} error={errors.allEligibleTenantsAcknowledged} copy={copy} onChange={(allEligibleTenantsAcknowledged) => setDraft((current) => ({ ...current, allEligibleTenantsAcknowledged }))} />
                ) : (
                  <label htmlFor="fleet-tenant-ids" className="grid gap-1.5 text-sm font-semibold">
                    <span>{copy.tenantIds}</span>
                    <textarea id="fleet-tenant-ids" dir="ltr" spellCheck={false} rows={5} value={draft.tenantIdsText} onChange={(event) => setDraft((current) => ({ ...current, tenantIdsText: event.target.value }))} aria-invalid={Boolean(errors.tenantIds)} aria-describedby={`fleet-tenant-hint${errors.tenantIds ? " fleet-tenant-error" : ""}`} className="rounded-xl border border-slate-300 bg-white p-3 text-start font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
                    <span id="fleet-tenant-hint" className="text-xs font-normal text-slate-500">{copy.tenantIdsHint}</span>
                    <FleetFieldError id="fleet-tenant-error" code={errors.tenantIds} copy={copy} />
                  </label>
                )}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">{copy.tenantStatuses}</legend>
                  <div className="flex gap-4">
                    {(["ACTIVE", "SUSPENDED"] as TenantLifecycleStatus[]).map((status) => (
                      <CheckField key={status} id={`fleet-status-${status}`} label={status === "ACTIVE" ? copy.active : copy.suspended} checked={draft.tenantStatuses.includes(status)} copy={copy} onChange={(checked) => setDraft((current) => ({ ...current, tenantStatuses: toggleStatus(current.tenantStatuses, status, checked) }))} />
                    ))}
                  </div>
                  <FleetFieldError id="fleet-status-error" code={errors.tenantStatuses} copy={copy} />
                </fieldset>
              </fieldset>
            </fieldset>

            <FleetCommandNotice
              view={view.previewCommand}
              copy={copy}
              successLabel={copy.createdPreview}
              onRetryExact={() => void view.retryPreviewExact()}
              onClear={view.clearPreviewCommand}
              successAction={
                view.previewCommand.result ? (
                  <Link href={`/provisioning/fleet/previews/${view.previewCommand.result.data.previewId}`} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white">
                    {copy.openPreview}
                  </Link>
                ) : null
              }
            />
            <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? copy.creatingPreview : copy.createPreview}
            </button>
          </form>
        )}
      </section>

      <FleetConfirmDialog
        open={pendingCommand !== null}
        title={copy.confirmPreviewTitle}
        body={copy.confirmPreviewBody}
        target={pendingCommand ? JSON.stringify(pendingCommand) : ""}
        copy={copy}
        pending={pending}
        onClose={() => !pending && setPendingCommand(null)}
        onConfirm={() => {
          if (!pendingCommand) return;
          void view.createPreview(pendingCommand).then((result) => {
            if (result) setPendingCommand(null);
          });
        }}
      />
    </FleetPageFrame>
  );
}

function TargetEditor({
  draft,
  setDraft,
  errors,
  copy,
}: {
  draft: FleetPreviewDraft;
  setDraft: React.Dispatch<React.SetStateAction<FleetPreviewDraft>>;
  errors: FieldErrors;
  copy: ReturnType<typeof getProvisioningFleetCopy>;
}) {
  const fields: Array<{ key: keyof FleetTargetDraft; label: string }> = [
    { key: "componentKey", label: copy.componentKey },
    { key: "componentId", label: copy.componentId },
    { key: "targetReleaseId", label: copy.targetReleaseId },
    { key: "targetReleaseVersion", label: copy.targetReleaseVersion },
    { key: "targetManifestChecksum", label: copy.targetManifestChecksum },
    { key: "expectedCurrentReleaseId", label: copy.expectedCurrentReleaseId },
    { key: "expectedCurrentManifestChecksum", label: copy.expectedCurrentManifestChecksum },
  ];
  return (
    <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <legend className="px-2 text-sm font-semibold">{copy.targets}</legend>
      <p className="text-xs text-slate-500">{copy.currentFenceHint}</p>
      <FleetFieldError id="fleet-targets-error" code={errors.targets} copy={copy} />
      {draft.targets.map((target, index) => (
        <div key={index} className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{copy.targetNumber} {index + 1}</h3>
            <button type="button" disabled={draft.targets.length === 1 && draft.operationType === "REPAIR"} onClick={() => setDraft((current) => ({ ...current, targets: current.targets.filter((_, targetIndex) => targetIndex !== index) }))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-300 px-3 text-xs font-semibold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300">
              <Trash2 className="size-4" aria-hidden="true" />{copy.removeTarget}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => {
              const error = errors[`targets.${index}.${field.key}`];
              return <TextField key={field.key} id={`fleet-target-${index}-${field.key}`} label={field.label} value={target[field.key]} error={error} copy={copy} mono={field.key !== "targetReleaseVersion" && field.key !== "componentKey"} onChange={(value) => setDraft((current) => ({ ...current, targets: current.targets.map((item, targetIndex) => targetIndex === index ? { ...item, [field.key]: value } : item) }))} />;
            })}
          </div>
          <FleetFieldError id={`fleet-target-${index}-pair-error`} code={errors[`targets.${index}.currentPair`]} copy={copy} />
        </div>
      ))}
      {draft.operationType !== "REPAIR" && draft.targets.length < 100 ? (
        <button type="button" onClick={() => setDraft((current) => ({ ...current, targets: [...current.targets, emptyTargetDraft()] }))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300 px-4 text-sm font-semibold text-cyan-800 dark:border-cyan-900 dark:text-cyan-200">
          <Plus className="size-4" aria-hidden="true" />{copy.addTarget}
        </button>
      ) : null}
    </fieldset>
  );
}

function TextField({ id, label, value, error, copy, onChange, mono }: { id: string; label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (value: string) => void; mono?: boolean }) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-sm font-semibold">
      <span>{label}</span>
      <input id={id} dir={mono ? "ltr" : undefined} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`min-h-11 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950 ${mono ? "text-start font-mono text-xs" : ""}`} />
      <FleetFieldError id={errorId} code={error} copy={copy} />
    </label>
  );
}

function CheckField({ id, label, checked, error, copy, onChange }: { id: string; label: string; checked: boolean; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (checked: boolean) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-start gap-3 text-sm font-semibold">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="mt-1 size-4 accent-cyan-700" />
        <span>{label}</span>
      </label>
      <FleetFieldError id={`${id}-error`} code={error} copy={copy} />
    </div>
  );
}

function RadioField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
      <input id={id} name="fleet-selection-mode" type="radio" checked={checked} onChange={onChange} className="size-4 accent-cyan-700" />
      <span>{label}</span>
    </label>
  );
}

function changeOperation(operationType: FleetOperationType, draft: FleetPreviewDraft, setDraft: React.Dispatch<React.SetStateAction<FleetPreviewDraft>>) {
  setDraft({
    ...draft,
    operationType,
    applicationKey: "",
    componentKey: "",
    retentionAcknowledged: false,
    targets: operationType === "DECOMMISSION" ? [] : draft.targets.length ? draft.targets : [emptyTargetDraft()],
  });
}

function toggleStatus(current: TenantLifecycleStatus[], status: TenantLifecycleStatus, checked: boolean): TenantLifecycleStatus[] {
  const next = checked ? [...new Set([...current, status])] : current.filter((item) => item !== status);
  return next.sort();
}
