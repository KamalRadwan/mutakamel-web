"use client";

import { useId, useState, type FormEvent } from "react";
import { FlaskConical, Loader2, ShieldAlert, X } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { readFleetHealth } from "../model/migration-outcomes";
import {
  MIGRATION_APPLICATION_KEYS,
  type FleetStatus,
  type MigrationApplicationKey,
  type MigrationRunMode,
  type MigrationRunScope,
  type StartMigrationRunDto,
} from "../types/database-migrations";
import {
  migrationInputClass,
  migrationLabelClass,
  type MigrationsCopy,
} from "./migrations-shared";

export interface StartMigrationDialogProps {
  open: boolean;
  copy: MigrationsCopy;
  isSubmitting: boolean;
  /**
   * Fleet roll-ups, used to name the blast radius of a real fleet run in the
   * confirmation. `null` when the projection is unreadable.
   */
  fleet: FleetStatus[] | null;
  defaultApplicationKey?: string;
  defaultTenantId?: string;
  defaultScope?: MigrationRunScope;
  onClose: () => void;
  onStart: (dto: StartMigrationRunDto) => void;
}

type FieldErrors = Partial<
  Record<"applicationKey" | "targetVersion" | "tenantId" | "reason" | "batchSize", string>
>;

export function StartMigrationDialog({
  open,
  copy,
  isSubmitting,
  fleet,
  defaultApplicationKey,
  defaultTenantId,
  defaultScope = "FLEET",
  onClose,
  onStart,
}: StartMigrationDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const [mode, setMode] = useState<MigrationRunMode>("DRY_RUN");
  const [scope, setScope] = useState<MigrationRunScope>(defaultScope);
  const [applicationKey, setApplicationKey] = useState(
    defaultApplicationKey ?? "",
  );
  const [targetVersion, setTargetVersion] = useState("");
  const [tenantId, setTenantId] = useState(defaultTenantId ?? "");
  const [reason, setReason] = useState("");
  const [batchSize, setBatchSize] = useState("50");
  const [failFast, setFailFast] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const buildDto = (): StartMigrationRunDto | null => {
    const nextErrors: FieldErrors = {};
    const application = applicationKey.trim();
    const version = targetVersion.trim();
    const tenant = tenantId.trim();
    const auditReason = reason.trim();
    const batch = Number(batchSize);

    if (
      !(MIGRATION_APPLICATION_KEYS as readonly string[]).includes(application)
    ) {
      nextErrors.applicationKey = copy.validationApplication;
    }
    if (!version) nextErrors.targetVersion = copy.validationVersion;
    if (scope === "SINGLE_TENANT" && !tenant) {
      nextErrors.tenantId = copy.validationTenant;
    }
    if (auditReason.length < 3) nextErrors.reason = copy.validationReason;
    if (!Number.isInteger(batch) || batch < 1 || batch > 500) {
      nextErrors.batchSize = copy.validationBatch;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      applicationKey: application as MigrationApplicationKey,
      targetVersion: version,
      strategy: "batched",
      batchSize: batch,
      failFast,
      dryRun: mode === "DRY_RUN",
      ...(scope === "SINGLE_TENANT" ? { tenantFilter: { ids: [tenant] } } : {}),
      triggeredBy: auditReason,
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dto = buildDto();
    if (!dto) return;
    // A dry run changes no schema, so it needs no typed confirmation. Anything
    // that writes to a tenant database does.
    if (dto.dryRun) {
      onStart(dto);
      return;
    }
    setConfirming(true);
  };

  const confirmTarget =
    scope === "FLEET" ? applicationKey.trim() : tenantId.trim();
  const selectedFleet =
    fleet?.find((entry) => entry.applicationKey === applicationKey.trim()) ??
    null;
  const behindCount = selectedFleet
    ? readFleetHealth(
        selectedFleet.counts,
        selectedFleet.versionDistribution.length,
      ).behind
    : null;
  const confirmBody =
    scope === "FLEET"
      ? copy.confirmFleetBody(
          applicationKey.trim(),
          behindCount === null
            ? copy.confirmFleetUnknownCount
            : copy.confirmFleetCount(behindCount),
        )
      : copy.confirmSingleBody(tenantId.trim(), applicationKey.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative my-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label={copy.close}
          className="absolute end-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2 id={titleId} className="text-lg font-black">
          {copy.startTitle}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {copy.startHelp}
        </p>

        <form
          className="mt-5 space-y-5"
          aria-label={copy.startTitle}
          onSubmit={handleSubmit}
        >
          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="px-1 text-xs font-black uppercase tracking-wider text-slate-500">
              {copy.modeLegend}
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ModeCard
                name={`${fieldId}-mode`}
                value="DRY_RUN"
                checked={mode === "DRY_RUN"}
                onChange={() => setMode("DRY_RUN")}
                title={copy.dryRunName}
                help={copy.dryRunHelp}
                tone="safe"
              />
              <ModeCard
                name={`${fieldId}-mode`}
                value="APPLY"
                checked={mode === "APPLY"}
                onChange={() => setMode("APPLY")}
                title={copy.applyName}
                help={copy.applyHelp}
                tone="critical"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <legend className="px-1 text-xs font-black uppercase tracking-wider text-slate-500">
              {copy.scopeLegend}
            </legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ModeCard
                name={`${fieldId}-scope`}
                value="FLEET"
                checked={scope === "FLEET"}
                onChange={() => setScope("FLEET")}
                title={copy.scopeFleet}
                help={copy.scopeFleetHelp}
                tone="neutral"
              />
              <ModeCard
                name={`${fieldId}-scope`}
                value="SINGLE_TENANT"
                checked={scope === "SINGLE_TENANT"}
                onChange={() => setScope("SINGLE_TENANT")}
                title={copy.scopeSingle}
                help={copy.scopeSingleHelp}
                tone="neutral"
              />
            </div>
            {scope === "SINGLE_TENANT" ? (
              <div className="mt-3">
                <label
                  className={migrationLabelClass}
                  htmlFor={`${fieldId}-tenant`}
                >
                  {copy.tenantIdLabel}
                </label>
                <input
                  id={`${fieldId}-tenant`}
                  dir="ltr"
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                  aria-invalid={errors.tenantId ? "true" : undefined}
                  aria-describedby={
                    errors.tenantId ? `${fieldId}-tenant-error` : undefined
                  }
                  className={`${migrationInputClass} font-mono`}
                />
                <FieldError id={`${fieldId}-tenant-error`} message={errors.tenantId} />
                <p className="mt-1 text-xs text-slate-500">{copy.tenantIdHelp}</p>
              </div>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={migrationLabelClass} htmlFor={`${fieldId}-app`}>
                {copy.applicationLabel}
              </label>
              <select
                id={`${fieldId}-app`}
                value={applicationKey}
                onChange={(event) => setApplicationKey(event.target.value)}
                aria-invalid={errors.applicationKey ? "true" : undefined}
                aria-describedby={
                  errors.applicationKey ? `${fieldId}-app-error` : undefined
                }
                className={migrationInputClass}
              >
                <option value="">{copy.allApplications}</option>
                {MIGRATION_APPLICATION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <FieldError
                id={`${fieldId}-app-error`}
                message={errors.applicationKey}
              />
            </div>

            <div>
              <label
                className={migrationLabelClass}
                htmlFor={`${fieldId}-version`}
              >
                {copy.targetVersionLabel}
              </label>
              <input
                id={`${fieldId}-version`}
                dir="ltr"
                value={targetVersion}
                onChange={(event) => setTargetVersion(event.target.value)}
                aria-invalid={errors.targetVersion ? "true" : undefined}
                aria-describedby={
                  errors.targetVersion ? `${fieldId}-version-error` : undefined
                }
                className={`${migrationInputClass} font-mono`}
              />
              <FieldError
                id={`${fieldId}-version-error`}
                message={errors.targetVersion}
              />
              <p className="mt-1 text-xs text-slate-500">
                {copy.targetVersionHelp}
              </p>
            </div>

            <div>
              <label
                className={migrationLabelClass}
                htmlFor={`${fieldId}-batch`}
              >
                {copy.batchSizeLabel}
              </label>
              <input
                id={`${fieldId}-batch`}
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(event) => setBatchSize(event.target.value)}
                aria-invalid={errors.batchSize ? "true" : undefined}
                aria-describedby={
                  errors.batchSize ? `${fieldId}-batch-error` : undefined
                }
                className={migrationInputClass}
              />
              <FieldError
                id={`${fieldId}-batch-error`}
                message={errors.batchSize}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={failFast}
                  onChange={(event) => setFailFast(event.target.checked)}
                  className="mt-1 size-4 rounded"
                />
                <span>
                  <span className="font-bold">{copy.failFastLabel}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {copy.failFastHelp}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className={migrationLabelClass} htmlFor={`${fieldId}-reason`}>
              {copy.triggeredByLabel}
            </label>
            <textarea
              id={`${fieldId}-reason`}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={errors.reason ? "true" : undefined}
              aria-describedby={
                errors.reason ? `${fieldId}-reason-error` : undefined
              }
              className={`${migrationInputClass} py-3`}
            />
            <FieldError id={`${fieldId}-reason-error`} message={errors.reason} />
            <p className="mt-1 text-xs text-slate-500">
              {copy.triggeredByHelp}
            </p>
          </div>

          <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
            <h3 className="font-black">{copy.canaryTitle}</h3>
            <p className="mt-1">{copy.canaryHelp}</p>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold disabled:opacity-50 dark:border-slate-700"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black text-white disabled:opacity-50 ${
                mode === "DRY_RUN"
                  ? "bg-cyan-700 hover:bg-cyan-800"
                  : "bg-rose-700 hover:bg-rose-800"
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : mode === "DRY_RUN" ? (
                <FlaskConical className="size-4" aria-hidden="true" />
              ) : (
                <ShieldAlert className="size-4" aria-hidden="true" />
              )}
              {isSubmitting
                ? copy.starting
                : mode === "DRY_RUN"
                  ? copy.startDryRun
                  : copy.startApply}
            </button>
          </div>
        </form>
      </div>

      <DestructiveActionModal
        isOpen={confirming}
        onClose={() => {
          if (!isSubmitting) setConfirming(false);
        }}
        onConfirm={() => {
          const dto = buildDto();
          if (!dto) {
            setConfirming(false);
            return;
          }
          setConfirming(false);
          onStart(dto);
        }}
        title={
          scope === "FLEET" ? copy.confirmFleetTitle : copy.confirmSingleTitle
        }
        description={confirmBody}
        targetName={confirmTarget}
        actionType="destroy"
        requireNameTyping
        isSubmitting={isSubmitting}
        confirmLabel={copy.startApply}
        submittingLabel={copy.starting}
      />
    </div>
  );
}

function ModeCard({
  name,
  value,
  checked,
  onChange,
  title,
  help,
  tone,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  help: string;
  tone: "safe" | "critical" | "neutral";
}) {
  const selected =
    tone === "critical"
      ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
      : tone === "safe"
        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40"
        : "border-slate-500 bg-slate-100 dark:bg-slate-800";
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition-colors ${
        checked
          ? selected
          : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0"
      />
      <span>
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">
          {help}
        </span>
      </span>
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span
      id={id}
      role="alert"
      className="mt-1 block text-xs font-bold text-rose-600 dark:text-rose-300"
    >
      {message}
    </span>
  );
}
