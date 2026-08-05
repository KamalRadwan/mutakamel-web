"use client";

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  Route,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  ApplicationTechnicalReadinessReason,
  ApplicationTechnicalReadinessView,
  ApplicationSelectionBlocker,
} from "../types";

interface Props {
  applicationKey: string;
  readiness: ApplicationTechnicalReadinessView | null;
  error: NormalizedApiError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  canManage: boolean;
  onRetry: () => void;
  onOpenBinding: () => void;
}

export function ApplicationTechnicalProvisioningPanel({
  applicationKey,
  readiness,
  error,
  isLoading,
  isRefreshing,
  canManage,
  onRetry,
  onOpenBinding,
}: Props) {
  const { t, dir } = useI18n();
  const copy = t.applications.technicalProvisioning;
  const reasonLabels: Record<ApplicationTechnicalReadinessReason, string> = {
    RUNTIME_TARGET_REQUIRED: copy.reasons.runtimeTargetRequired,
    COMPONENT_BINDING_REQUIRED: copy.reasons.componentBindingRequired,
    ACTIVE_COMPONENT_REQUIRED: copy.reasons.activeComponentRequired,
    PUBLISHED_RELEASE_REQUIRED: copy.reasons.publishedReleaseRequired,
    MINIMUM_RELEASE_NOT_SATISFIED: copy.reasons.minimumReleaseNotSatisfied,
    DATABASE_PERMISSION_MANIFEST_REQUIRED:
      copy.reasons.databasePermissionManifestRequired,
    DATABASE_PERMISSION_MANIFEST_INVALID:
      copy.reasons.databasePermissionManifestInvalid,
  };
  const selectionLabels: Record<ApplicationSelectionBlocker, string> = {
    APPLICATION_LIFECYCLE_NOT_ACTIVE:
      copy.selectionBlockers.applicationLifecycleNotActive,
    APPLICATION_NOT_PUBLISHED:
      copy.selectionBlockers.applicationNotPublished,
    APPLICATION_NOT_PUBLIC: copy.selectionBlockers.applicationNotPublic,
    APPLICATION_NON_BILLABLE:
      copy.selectionBlockers.applicationNonBillable,
    TECHNICAL_READINESS_BLOCKED:
      copy.selectionBlockers.technicalReadinessBlocked,
  };
  const showBindingAction =
    readiness?.lifecycleStatus === "DRAFT" &&
    Boolean(readiness.runtimeTarget) &&
    readiness.components.length === 0;

  return (
    <section
      aria-labelledby="technical-readiness-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
            {copy.eyebrow}
          </p>
          <h2 id="technical-readiness-title" className="mt-1 flex items-center gap-2 text-sm font-black">
            <Route className="h-4 w-4" /> {copy.title}
          </h2>
          <p className="mt-1 text-xs text-slate-300">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading || isRefreshing}
          className="inline-flex min-h-11 self-start items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {copy.refresh}
        </button>
      </header>

      <div className="space-y-5 p-5">
        {isLoading ? (
          <div role="status" className="flex min-h-28 items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> {copy.loading}
          </div>
        ) : error || !readiness ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-bold">{error?.httpStatus === 403 ? copy.readinessForbidden : copy.unavailable}</p>
            {error?.message && error.httpStatus !== 403 && <p className="mt-1">{error.message}</p>}
            {error?.correlationId && (
              <p className="mt-2 font-mono text-[10px] opacity-75">
                {copy.correlationId}: {error.correlationId}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {readiness.activationAllowed ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-7 w-7 text-amber-500" />
                )}
                <div>
                  <div className="text-sm font-black">{copy.statuses[readiness.status]}</div>
                  <div className="text-[11px] text-slate-500">
                    {copy.revisionLabel} {readiness.technicalDefinitionRevision}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200" dir="ltr">
                  {applicationKey}
                </code>
                <code className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-[11px] font-bold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200" dir="ltr">
                  {copy.workerTarget}: {readiness.runtimeTarget ?? copy.notAdopted}
                </code>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Check label={copy.checks.runtimeTarget} value={readiness.checks.runtimeTarget} icon={Route} passed={copy.passed} blocked={copy.blocked} />
              <Check label={copy.checks.componentBinding} value={readiness.checks.componentBinding} icon={Boxes} passed={copy.passed} blocked={copy.blocked} />
              <Check label={copy.checks.activeComponents} value={readiness.checks.activeComponents} icon={CheckCircle2} passed={copy.passed} blocked={copy.blocked} />
              <Check label={copy.checks.publishedReleases} value={readiness.checks.publishedReleases} icon={PackageCheck} passed={copy.passed} blocked={copy.blocked} />
              <Check label={copy.checks.minimumReleases} value={readiness.checks.minimumReleases} icon={PackageCheck} passed={copy.passed} blocked={copy.blocked} />
              <Check label={copy.checks.permissionManifest} value={readiness.checks.databasePermissionManifest} icon={LockKeyhole} passed={copy.passed} blocked={copy.blocked} />
            </div>

            {readiness.reasons.length > 0 && (
              <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {readiness.reasons.map((item) => (
                  <li key={item} className="flex gap-2">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{reasonLabels[item]}</span>
                  </li>
                ))}
              </ul>
            )}

            {readiness.selectionBlockers.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <h3 className="text-xs font-black">{copy.selectionTitle}</h3>
                <ul className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                  {readiness.selectionBlockers.map((item) => (
                    <li key={item} className="flex gap-2">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{selectionLabels[item]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.components.map((component) => (
              <article key={component.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-black text-cyan-700 dark:text-cyan-300" dir="ltr">{component.key}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{component.kind} · {copy.contractShort} {component.contractVersion}</p>
                  </div>
                  {component.latestPublishedRelease ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {copy.release} {component.latestPublishedRelease.releaseVersion}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {copy.releaseRequired}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]" dir="ltr">
                  <ChainStep label={copy.applicationKey} value={applicationKey} />
                  <ArrowRight className={`mx-auto hidden h-4 w-4 text-cyan-500 sm:block ${dir === "rtl" ? "rotate-180" : ""}`} />
                  <ChainStep label={copy.componentKey} value={component.key} />
                  <ArrowRight className={`mx-auto hidden h-4 w-4 text-cyan-500 sm:block ${dir === "rtl" ? "rotate-180" : ""}`} />
                  <ChainStep label={copy.workerTarget} value={component.workerTarget ?? copy.notAdopted} />
                  <ArrowRight className={`mx-auto hidden h-4 w-4 text-cyan-500 sm:block ${dir === "rtl" ? "rotate-180" : ""}`} />
                  <ChainStep label={copy.release} value={component.latestPublishedRelease?.releaseVersion ?? copy.pending} />
                </div>
                <p className="mt-3 text-[11px] text-slate-500">{copy.noCredential}</p>
              </article>
            ))}

            {showBindingAction && (
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:flex-row sm:items-center dark:border-cyan-900 dark:bg-cyan-950/20">
                <div>
                  <h3 className="text-xs font-black text-cyan-950 dark:text-cyan-100">{copy.bindingCalloutTitle}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-cyan-800 dark:text-cyan-300">{copy.bindingCalloutDescription}</p>
                  {!canManage && (
                    <p className="mt-2 font-mono text-[10px] text-amber-700 dark:text-amber-300">{copy.permissionRequired}</p>
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={onOpenBinding}
                    className="min-h-11 shrink-0 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                  >
                    {copy.linkComponent}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Check({ label, value, icon: Icon, passed, blocked }: { label: string; value: boolean; icon: typeof Boxes; passed: string; blocked: string }) {
  return (
    <div className={`rounded-xl border p-3 ${value ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${value ? "text-emerald-600" : "text-amber-600"}`} />
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{value ? passed : blocked}</div>
    </div>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 break-all font-mono text-[11px] font-black text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
