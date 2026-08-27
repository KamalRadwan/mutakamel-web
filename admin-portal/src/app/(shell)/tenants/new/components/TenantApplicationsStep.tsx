"use client";

import {
  AlertCircle,
  CheckCircle2,
  Layers3,
  Loader2,
  LockKeyhole,
  Package,
  RefreshCw,
  Route,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  TenantApplicationCandidate,
  TenantApplicationSelection,
  TenantBillingCycle,
  TenantProvisioningPlanPreview,
  TenantRegistrationLoadState,
  TenantSubscriptionLine,
} from "../types";

interface TenantApplicationsStepProps {
  candidates: readonly TenantApplicationCandidate[];
  selections: Readonly<Record<string, TenantApplicationSelection>>;
  state: TenantRegistrationLoadState;
  error: NormalizedApiError | null;
  selectedLines: readonly TenantSubscriptionLine[];
  billingCycle: TenantBillingCycle;
  showSelectionError: boolean;
  preview: TenantProvisioningPlanPreview | null;
  previewState: TenantRegistrationLoadState;
  previewError: NormalizedApiError | null;
  onRetryCandidates: () => void;
  onRetryPreview: () => void;
  onToggle: (applicationKey: string, selected: boolean) => void;
  onUpdateSelection: (
    applicationKey: string,
    patch: Partial<TenantApplicationSelection>,
  ) => void;
  onBillingCycleChange: (cycle: TenantBillingCycle) => void;
}

function evidenceLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function TenantApplicationsStep({
  candidates,
  selections,
  state,
  error,
  selectedLines,
  billingCycle,
  showSelectionError,
  preview,
  previewState,
  previewError,
  onRetryCandidates,
  onRetryPreview,
  onToggle,
  onUpdateSelection,
  onBillingCycleChange,
}: TenantApplicationsStepProps) {
  const { t } = useI18n();
  const copy = t.tenants.wizard.applicationsStep;
  return (
    <section className="space-y-5 rounded-xl border border-border bg-white p-5 shadow-2xs dark:border-border dark:bg-ink-900">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-border">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="size-4 text-warn-600 dark:text-warn-400" />
            {copy.stepHeading}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            {copy.stepDescription}
          </p>
        </div>
        <label className="min-w-44 text-xs font-semibold text-foreground">
          <span className="mb-1.5 block">
            {copy.billingCycleLabel}
          </span>
          <select
            value={billingCycle}
            onChange={(event) =>
              onBillingCycleChange(event.target.value as TenantBillingCycle)
            }
            className="min-h-11 w-full rounded-lg border border-border bg-ink-100 px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-ink-800"
          >
            <option value="MONTHLY">{copy.monthlyOption}</option>
            <option value="ANNUAL">{copy.annualOption}</option>
          </select>
        </label>
      </header>

      {state === "loading" ? (
        <StateCard
          icon={<Loader2 className="size-4 animate-spin" />}
          tone="neutral"
          title={copy.loadingCatalogueTitle}
            description={copy.loadingCatalogueDesc}
        />
      ) : null}

      {state === "forbidden" ? (
        <StateCard
          icon={<LockKeyhole className="size-4" />}
          tone="amber"
          title={copy.forbiddenTitle}
          description={copy.forbiddenDesc}
        />
      ) : null}

      {state === "error" ? (
        <RetryCard
          title={copy.loadErrorTitle}
          error={error}
          onRetry={onRetryCandidates}
        />
      ) : null}

      {state === "empty" ? (
        <StateCard
          icon={<AlertCircle className="size-4" />}
          tone="amber"
          title={copy.emptyTitle}
          description={copy.emptyDesc}
        />
      ) : null}

      {state === "ready" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {candidates.map((candidate) => {
            const selection = selections[candidate.key];
            const unavailableReasons: string[] = [
              ...candidate.selectionBlockers,
              ...candidate.readinessReasons,
              ...candidate.catalogueReasons,
            ];
            return (
              <article
                key={candidate.applicationId}
                className={`rounded-lg border p-4 transition-colors ${
                  selection
                    ? "border-brand-400 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-950/30"
                    : "border-border bg-ink-100/70 dark:bg-ink-1000/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    id={`tenant-application-${candidate.key}`}
                    type="checkbox"
                    checked={Boolean(selection)}
                    disabled={!candidate.selectionAllowed}
                    onChange={(event) =>
                      onToggle(candidate.key, event.target.checked)
                    }
                    className="mt-1 size-4 rounded border-border text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`tenant-application-${candidate.key}`}
                      className={`flex min-h-6 items-center justify-between gap-3 font-semibold ${
                        candidate.selectionAllowed
                          ? "cursor-pointer text-foreground"
                          : "cursor-not-allowed text-muted-foreground"
                      }`}
                    >
                      <span className="truncate">{candidate.name}</span>
                      <span className="rounded-full bg-ink-200 px-2 py-0.5 font-mono text-2xs uppercase text-foreground dark:bg-ink-800 dark:text-muted-foreground">
                        {candidate.key}
                      </span>
                    </label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {candidate.description ?? copy.noDescriptionFallback}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-2xs font-semibold uppercase tracking-wide">
                      <span className="rounded-full bg-card px-2 py-1 text-muted-foreground">
                        {candidate.commercialMode}
                      </span>
                      {candidate.selectionAllowed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-1 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                          <CheckCircle2 className="size-3" /> {copy.readyBadge}
                        </span>
                      ) : (
                        <span className="rounded-full bg-warn-100 px-2 py-1 text-warn-800 dark:bg-warn-950/60 dark:text-warn-300">
                          {copy.unavailableBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!candidate.selectionAllowed ? (
                  <div className="mt-3 rounded-xl border border-warn-200 bg-warn-50 p-3 text-xs text-warn-800 dark:border-warn-900 dark:bg-warn-950/40 dark:text-warn-300">
                    {unavailableReasons.length > 0 ? (
                      <ul className="list-inside list-disc space-y-1">
                        {unavailableReasons.map((reason) => (
                          <li key={reason}>{evidenceLabel(reason)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{copy.noEvidenceReason}</p>
                    )}
                  </div>
                ) : null}

                {selection ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
                    <label className="text-xs font-semibold text-foreground">
                      <span className="mb-1.5 block">{copy.tierLabel}</span>
                      <select
                        value={selection.tierId}
                        onChange={(event) =>
                          onUpdateSelection(candidate.key, {
                            tierId: event.target.value,
                          })
                        }
                        className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        {candidate.tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name} ({tier.key})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-foreground">
                      <span className="mb-1.5 block">{copy.seatsLabel}</span>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        value={selection.seats}
                        onChange={(event) =>
                          onUpdateSelection(candidate.key, {
                            seats: Number(event.target.value),
                          })
                        }
                        className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      />
                    </label>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {showSelectionError && selectedLines.length === 0 ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-danger-600 dark:text-danger-400" role="alert">
          <AlertCircle className="size-4" />
          {copy.selectionRequiredError}
        </p>
      ) : null}

      <section aria-labelledby="provisioning-preview-title" className="overflow-hidden rounded-xl border border-border">
        <header className="flex items-start gap-3 bg-ink-1000 px-4 py-3 text-white">
          <Route className="mt-0.5 size-4 text-brand-400" />
          <div>
            <h4 id="provisioning-preview-title" className="text-xs font-semibold">
              {copy.previewTitle}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.previewDesc}
            </p>
          </div>
        </header>
        <div className="p-4">
          {previewState === "idle" ? (
            <p className="text-xs text-muted-foreground">
              {copy.previewIdle}
            </p>
          ) : null}
          {previewState === "loading" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" />
              {copy.previewLoading}
            </p>
          ) : null}
          {previewState === "error" ? (
            <RetryCard
              title={copy.previewErrorTitle}
              error={previewError}
              onRetry={onRetryPreview}
            />
          ) : null}
          {previewState === "empty" ? (
            <StateCard
              icon={<AlertCircle className="size-4" />}
              tone="amber"
              title={copy.previewEmptyTitle}
              description={copy.previewEmptyDesc}
            />
          ) : null}
          {previewState === "ready" && preview ? (
            <div className="space-y-4">
              <dl className="grid gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800/60">
                  <dt className="text-muted-foreground">{copy.selectedApplicationsLabel}</dt>
                  <dd className="mt-1 font-mono font-semibold">{preview.selectedApplicationKeys.join(", ")}</dd>
                </div>
                <div className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800/60">
                  <dt className="text-muted-foreground">{copy.derivedComponentsLabel}</dt>
                  <dd className="mt-1 font-semibold">{preview.components.length}</dd>
                </div>
                <div className="rounded-xl bg-ink-100 p-3 dark:bg-ink-800/60">
                  <dt className="text-muted-foreground">{copy.executionStepsLabel}</dt>
                  <dd className="mt-1 font-semibold">{preview.steps.length}</dd>
                </div>
              </dl>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.components.map((component) => (
                  <div key={component.componentId} className="rounded-xl border border-border p-3 text-xs dark:border-border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono font-semibold text-foreground">{component.componentKey}</p>
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold tracking-wide ${component.selectionSource === "FOUNDATION" ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300" : "bg-ink-200 text-foreground dark:bg-ink-800 dark:text-muted-foreground"}`}>
                        {component.selectionSource}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{component.ownerApp} · v{component.releaseVersion}</p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground" title={preview.selectionDigest}>
                <Layers3 className="size-3.5" /> {preview.selectionDigest.slice(0, 16)}…
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function RetryCard({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: NormalizedApiError | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300" role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold">{title}</p>
          {error?.message ? <p className="mt-1 text-xs">{error.message}</p> : null}
          {error?.correlationId ? <p className="mt-1 break-all font-mono text-xs">Correlation ID: {error.correlationId}</p> : null}
        </div>
      </div>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-danger-300 bg-card px-3 text-xs font-semibold hover:bg-danger-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 dark:border-danger-800 dark:hover:bg-danger-950">
        <RefreshCw className="size-3.5" /> {t.tenants.wizard.retryButton}
      </button>
    </div>
  );
}

function StateCard({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode;
  tone: "neutral" | "amber";
  title: string;
  description: string;
}) {
  const classes = tone === "neutral"
    ? "border-border bg-ink-100 text-foreground dark:bg-ink-800/40"
    : "border-warn-200 bg-warn-50 text-warn-800 dark:border-warn-900 dark:bg-warn-950/40 dark:text-warn-300";
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${classes}`} role={tone === "neutral" ? "status" : "alert"}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-90">{description}</p>
      </div>
    </div>
  );
}
