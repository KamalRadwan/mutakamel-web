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
  isArabic: boolean;
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
  isArabic,
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
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Package className="size-4 text-amber-600 dark:text-amber-400" />
            {isArabic
              ? "الخطوة 3: التطبيقات والاشتراك"
              : "Step 3: Applications & Subscription"}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            {isArabic
              ? "اختر فقط التطبيقات التجارية المؤهلة تقنياً. يتم اشتقاق مكونات Core وWorker الأساسية من الخادم ولا يمكن اختيارها يدوياً."
              : "Select only commercially and technically eligible Applications. Core and Worker foundation components are derived by the server and are never user-selectable."}
          </p>
        </div>
        <label className="min-w-44 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="mb-1.5 block">
            {isArabic ? "دورة الفوترة" : "Billing cycle"}
          </span>
          <select
            value={billingCycle}
            onChange={(event) =>
              onBillingCycleChange(event.target.value as TenantBillingCycle)
            }
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="MONTHLY">{isArabic ? "شهري" : "Monthly"}</option>
            <option value="ANNUAL">{isArabic ? "سنوي" : "Annual"}</option>
          </select>
        </label>
      </header>

      {state === "loading" ? (
        <StateCard
          icon={<Loader2 className="size-4 animate-spin" />}
          tone="blue"
          title={isArabic ? "جاري تحميل كتالوج التطبيقات" : "Loading the Application Catalogue"}
            description={
              isArabic
                ? "يتم تحميل لقطة واحدة متسقة من التطبيقات والجاهزية التقنية والـtiers."
                : "Loading one consistent snapshot of Applications, technical readiness, and active tiers."
          }
        />
      ) : null}

      {state === "forbidden" ? (
        <StateCard
          icon={<LockKeyhole className="size-4" />}
          tone="amber"
          title={isArabic ? "صلاحية إنشاء العميل مطلوبة" : "Tenant-create permission required"}
          description={
            isArabic
              ? "هذه الخطوة تحتاج admin.tenants.create فقط؛ لا تمنح الشاشة صلاحيات قراءة الكتالوج العامة."
              : "This step requires only admin.tenants.create; it does not require broad catalogue-read permissions."
          }
        />
      ) : null}

      {state === "error" ? (
        <RetryCard
          isArabic={isArabic}
          title={isArabic ? "تعذر تحميل التطبيقات المؤهلة" : "Eligible Applications are unavailable"}
          error={error}
          onRetry={onRetryCandidates}
        />
      ) : null}

      {state === "empty" ? (
        <StateCard
          icon={<AlertCircle className="size-4" />}
          tone="amber"
          title={isArabic ? "لا توجد تطبيقات قابلة للاختيار" : "No selectable Applications"}
          description={
            isArabic
              ? "يجب أن يكون التطبيق Tenant وActive وPublished وPublic وله tier نشط وتعريف تقني جاهز."
              : "An Application must be Tenant, Active, Published, Public, technically ready, and have an active tier."
          }
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
                className={`rounded-xl border p-4 transition-colors ${
                  selection
                    ? "border-blue-400 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                    : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/30"
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
                    className="mt-1 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`tenant-application-${candidate.key}`}
                      className={`flex min-h-6 items-center justify-between gap-3 font-semibold ${
                        candidate.selectionAllowed
                          ? "cursor-pointer text-slate-900 dark:text-slate-100"
                          : "cursor-not-allowed text-slate-500"
                      }`}
                    >
                      <span className="truncate">{candidate.name}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-2xs uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {candidate.key}
                      </span>
                    </label>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {candidate.description ??
                        (isArabic ? "لا يوجد وصف منشور." : "No published description.")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-2xs font-semibold uppercase tracking-wide">
                      <span className="rounded-full bg-white px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {candidate.commercialMode}
                      </span>
                      {candidate.selectionAllowed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" /> {isArabic ? "جاهز" : "Ready"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {isArabic ? "غير قابل للاختيار" : "Unavailable"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!candidate.selectionAllowed ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    {unavailableReasons.length > 0 ? (
                      <ul className="list-inside list-disc space-y-1">
                        {unavailableReasons.map((reason) => (
                          <li key={reason}>{evidenceLabel(reason)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{isArabic ? "الدليل الحالي لا يسمح بالاختيار." : "Current evidence does not allow selection."}</p>
                    )}
                  </div>
                ) : null}

                {selection ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="mb-1.5 block">{isArabic ? "الخطة" : "Tier"}</span>
                      <select
                        value={selection.tierId}
                        onChange={(event) =>
                          onUpdateSelection(candidate.key, {
                            tierId: event.target.value,
                          })
                        }
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {candidate.tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name} ({tier.key})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="mb-1.5 block">{isArabic ? "المقاعد" : "Seats"}</span>
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
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
        <p className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400" role="alert">
          <AlertCircle className="size-4" />
          {isArabic
            ? "اختر تطبيقاً مؤهلاً واحداً على الأقل وحدد tier ومقاعد صحيحة."
            : "Select at least one eligible Application with a valid tier and seat count."}
        </p>
      ) : null}

      <section aria-labelledby="provisioning-preview-title" className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <header className="flex items-start gap-3 bg-slate-950 px-4 py-3 text-white">
          <Route className="mt-0.5 size-4 text-cyan-300" />
          <div>
            <h4 id="provisioning-preview-title" className="text-xs font-semibold">
              {isArabic ? "معاينة خطة التجهيز" : "Provisioning plan preview"}
            </h4>
            <p className="mt-1 text-xs text-slate-300">
              {isArabic
                ? "الخادم يضيف الـfoundation والاعتماديات ويثبت الإصدارات قبل الإنشاء."
                : "The server derives foundation components and dependencies, then pins releases before creation."}
            </p>
          </div>
        </header>
        <div className="p-4">
          {previewState === "idle" ? (
            <p className="text-xs text-slate-500">
              {isArabic ? "اختر التطبيقات لعرض الخطة." : "Select Applications to preview the plan."}
            </p>
          ) : null}
          {previewState === "loading" ? (
            <p className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300" role="status">
              <Loader2 className="size-4 animate-spin" />
              {isArabic ? "جاري بناء المعاينة..." : "Building the preview..."}
            </p>
          ) : null}
          {previewState === "error" ? (
            <RetryCard
              isArabic={isArabic}
              title={isArabic ? "تعذر بناء الخطة" : "The provisioning plan could not be built"}
              error={previewError}
              onRetry={onRetryPreview}
            />
          ) : null}
          {previewState === "empty" ? (
            <StateCard
              icon={<AlertCircle className="size-4" />}
              tone="amber"
              title={isArabic ? "لا توجد خطة صالحة" : "No valid plan available"}
              description={isArabic ? "أعد المحاولة بعد مراجعة التطبيقات." : "Review the selected Applications and retry."}
            />
          ) : null}
          {previewState === "ready" && preview ? (
            <div className="space-y-4">
              <dl className="grid gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500">{isArabic ? "التطبيقات" : "Selected Applications"}</dt>
                  <dd className="mt-1 font-mono font-semibold">{preview.selectedApplicationKeys.join(", ")}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500">{isArabic ? "المكونات" : "Derived components"}</dt>
                  <dd className="mt-1 font-semibold">{preview.components.length}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-slate-500">{isArabic ? "خطوات التنفيذ" : "Execution steps"}</dt>
                  <dd className="mt-1 font-semibold">{preview.steps.length}</dd>
                </div>
              </dl>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.components.map((component) => (
                  <div key={component.componentId} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">{component.componentKey}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide ${component.selectionSource === "FOUNDATION" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300" : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"}`}>
                        {component.selectionSource}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">{component.ownerApp} · v{component.releaseVersion}</p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-2 font-mono text-xs text-slate-500" title={preview.selectionDigest}>
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
  isArabic,
  title,
  error,
  onRetry,
}: {
  isArabic: boolean;
  title: string;
  error: NormalizedApiError | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold">{title}</p>
          {error?.message ? <p className="mt-1 text-xs">{error.message}</p> : null}
          {error?.correlationId ? <p className="mt-1 break-all font-mono text-xs">Correlation ID: {error.correlationId}</p> : null}
        </div>
      </div>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:hover:bg-rose-950">
        <RefreshCw className="size-3.5" /> {isArabic ? "إعادة المحاولة" : "Retry"}
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
  tone: "blue" | "amber";
  title: string;
  description: string;
}) {
  const classes = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${classes}`} role={tone === "blue" ? "status" : "alert"}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-90">{description}</p>
      </div>
    </div>
  );
}
