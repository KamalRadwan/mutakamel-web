import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  DatabaseZap,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  SquareCheckBig,
  Wrench,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TenantProvisioningWorkspaceModel } from "../hooks/useTenantProvisioningWorkspace";
import { canResolveSeedConflict } from "../model/readers";
import type {
  ProvisioningResource,
  SeedConflictDecision,
  TenantOperationStatus,
} from "../types";

export interface TenantProvisioningWorkspaceViewProps {
  model: TenantProvisioningWorkspaceModel;
}

const SECTIONS = [
  ["operations", History, "Operations", "العمليات"],
  ["updates", RotateCcw, "Updates", "التحديثات"],
  ["state", Boxes, "State", "الحالة"],
  ["prerequisites", ShieldCheck, "Prerequisites", "المتطلبات"],
  ["managed", Wrench, "Managed actions", "إجراءات مُدارة"],
] as const;

export function TenantProvisioningWorkspaceView({
  model,
}: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  const visibleError =
    model.localError ?? provisioning.mutation.error?.errorCode ?? null;

  return (
    <section
      dir={model.dir}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
      aria-label={ar ? "إدارة تجهيز المستأجر" : "Tenant provisioning management"}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              {ar ? "تجهيز المستأجر" : "Tenant provisioning"}
            </h2>
            {provisioning.polling && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <RefreshCw className="size-3 animate-spin" />
                {ar ? "متابعة مباشرة" : "Live polling"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {ar
              ? "العمليات غير متزامنة. لا تُعتبر قاعدة البيانات جاهزة إلا بعد نجاح التفعيل."
              : "Operations are asynchronous. The tenant database is ready only after activation succeeds."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void provisioning.refreshAll()}
          disabled={provisioning.authLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw
            className={`size-3.5 ${
              provisioning.operations.refreshing ? "animate-spin" : ""
            }`}
          />
          {ar ? "تحديث" : "Refresh"}
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        {SECTIONS.map(([key, Icon, en, arabic]) => (
          <button
            key={key}
            type="button"
            onClick={() => model.setSection(key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              model.section === key
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            }`}
          >
            <Icon className="size-3.5" />
            {ar ? arabic : en}
          </button>
        ))}
      </nav>

      {visibleError && (
        <div
          role="alert"
          className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <span>
            <strong>{ar ? "تعذر تنفيذ الإجراء: " : "Action could not complete: "}</strong>
            {localizeError(visibleError, ar)}
          </span>
          <button
            type="button"
            onClick={() => {
              model.clearLocalError();
              provisioning.clearMutationError();
            }}
            className="font-bold"
            aria-label={ar ? "إغلاق الخطأ" : "Dismiss error"}
          >
            ×
          </button>
        </div>
      )}

      <div className="p-4">
        {model.section === "operations" && <OperationsSection model={model} />}
        {model.section === "updates" && <UpdatesSection model={model} />}
        {model.section === "state" && <StateSection model={model} />}
        {model.section === "prerequisites" && (
          <PrerequisitesSection model={model} />
        )}
        {model.section === "managed" && <ManagedSection model={model} />}
      </div>
    </section>
  );
}

function OperationsSection({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.operations} ar={ar}>
      {provisioning.operations.data.items.length === 0 ? (
        <EmptyState ar={ar} labelEn="No provisioning operations." labelAr="لا توجد عمليات تجهيز." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="max-h-[44rem] space-y-2 overflow-y-auto pe-1">
            {provisioning.operations.data.items.map((operation) => (
              <button
                type="button"
                key={operation.id}
                onClick={() => provisioning.selectOperation(operation.id)}
                className={`w-full rounded-xl border p-3 text-start transition ${
                  provisioning.selectedOperationId === operation.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {operationTypeLabel(operation.type, ar)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {ar ? "الجيل" : "Generation"} {operation.generation} ·{" "}
                      {formatDate(operation.requestedAt, model.lang)}
                    </p>
                  </div>
                  <StatusBadge status={operation.status} ar={ar} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="truncate">{operation.currentPhase}</span>
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </div>
              </button>
            ))}
          </div>
          <OperationDetail model={model} />
        </div>
      )}
    </ResourceBoundary>
  );
}

function OperationDetail({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.selectedOperation} ar={ar} compact>
      {!provisioning.selectedOperation.data ? (
        <EmptyState ar={ar} labelEn="Select an operation." labelAr="اختر عملية." />
      ) : (
        <div className="space-y-4">
          {(() => {
            const operation = provisioning.selectedOperation.data;
            const canRetry =
              provisioning.permissions.canRetryOrCancel &&
              ["FAILED_RETRYABLE", "MANUAL_RECOVERY_REQUIRED", "CANCELLED"].includes(
                operation.status,
              );
            const canCancel =
              provisioning.permissions.canRetryOrCancel &&
              [
                "REQUESTED",
                "PLANNING",
                "QUEUED",
                "RUNNING",
                "WAITING_RETRY",
              ].includes(operation.status);
            return (
              <>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                        {operationTypeLabel(operation.type, ar)} · {ar ? "الجيل" : "generation"} {operation.generation}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{operation.currentPhase}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={operation.status} ar={ar} />
                      {canRetry && (
                        <button
                          type="button"
                          onClick={() => void provisioning.retryOperation(operation.id).catch(() => undefined)}
                          disabled={provisioning.mutation.name !== null}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {ar ? "إعادة المحاولة" : "Retry"}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => void provisioning.cancelOperation(operation.id).catch(() => undefined)}
                          disabled={provisioning.mutation.name !== null}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"
                        >
                          {ar ? "طلب الإلغاء" : "Request cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                      <span>{ar ? "التقدم الموزون" : "Weighted progress"}</span>
                      <span>{operation.progress.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-[width]"
                        style={{ width: `${operation.progress.percent}%` }}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-3">
                      <span>{operation.progress.completedSteps}/{operation.progress.totalSteps} {ar ? "خطوات" : "steps"}</span>
                      <span>{operation.progress.failedSteps} {ar ? "فشلت" : "failed"}</span>
                      <span>{ar ? "مراجعة السياسة" : "Policy revision"}: {operation.accessPolicyRevision}</span>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                    <Evidence label={ar ? "بصمة الخطة" : "Plan digest"} value={shortDigest(operation.planDigest)} />
                    <Evidence label={ar ? "وقت الطلب" : "Requested"} value={formatDate(operation.requestedAt, model.lang)} />
                  </dl>
                  {operation.safeError && (operation.safeError.code || operation.safeError.message) && (
                    <div className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                      {operation.safeError.code ?? "OPERATION_FAILED"}
                      {operation.safeError.message ? ` — ${operation.safeError.message}` : ""}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {ar ? "الخطوات" : "Steps"}
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-start text-xs">
                      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
                        <tr>
                          <Th>{ar ? "الخطوة" : "Step"}</Th>
                          <Th>{ar ? "النوع" : "Kind"}</Th>
                          <Th>{ar ? "الحالة" : "Status"}</Th>
                          <Th>{ar ? "المحاولات" : "Attempts"}</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {operation.steps.map((step) => (
                          <tr key={step.id}>
                            <Td>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{step.stepKey}</span>
                              {step.componentKey && <span className="block text-[10px] text-slate-500">{step.componentKey}</span>}
                            </Td>
                            <Td>{step.kind}</Td>
                            <Td><StepBadge status={step.status} /></Td>
                            <Td>{step.attemptCount}{step.retryable ? " ↻" : ""}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {ar ? "الخط الزمني" : "Timeline"} ({operation.timelineEventCount})
                  </h4>
                  <ResourceBoundary resource={provisioning.timeline} ar={ar} compact>
                    <ol className="space-y-2 border-s border-slate-200 ps-4 dark:border-slate-800">
                      {provisioning.timeline.data.items.map((event) => (
                        <li key={event.id} className="relative rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900/70">
                          <span className="absolute -start-[1.18rem] top-3 size-2 rounded-full bg-indigo-500" />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{event.eventType}</span>
                            <span className="text-[10px] text-slate-500">#{event.sequence} · {formatDate(event.occurredAt, model.lang)}</span>
                          </div>
                          {event.message && <p className="mt-1 text-slate-600 dark:text-slate-300">{event.message}</p>}
                        </li>
                      ))}
                    </ol>
                  </ResourceBoundary>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </ResourceBoundary>
  );
}

function UpdatesSection({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.updates} ar={ar}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ar ? "التحديثات المتاحة" : "Available updates"}</h3>
            <p className="mt-1 text-xs text-slate-500">{ar ? "يُرسل الاختيار ببصمات الإصدار الحالي والهدف كما أعادها الخادم." : "Selections submit the exact current and target release evidence returned by Core."}</p>
          </div>
          <button
            type="button"
            onClick={() => void model.applySelectedUpdates()}
            disabled={!provisioning.permissions.canApplyUpdates || !model.selectedUpdateKeys.length || provisioning.mutation.name !== null}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ar ? `تطبيق المحدد (${model.selectedUpdateKeys.length})` : `Apply selected (${model.selectedUpdateKeys.length})`}
          </button>
        </div>
        {provisioning.updates.data.items.length === 0 ? (
          <EmptyState ar={ar} labelEn="No safe updates are currently offered." labelAr="لا توجد تحديثات آمنة متاحة حاليًا." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {provisioning.updates.data.items.map((update) => {
              const checked = model.selectedUpdateKeys.includes(update.componentKey);
              const selectable = !update.updateAlreadyPlanned && update.current.manifestChecksum !== null;
              return (
                <button
                  type="button"
                  key={update.componentKey}
                  disabled={!selectable}
                  onClick={() => model.toggleUpdate(update.componentKey)}
                  className={`rounded-xl border p-3 text-start disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-200 dark:border-slate-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{update.componentKey}</p>
                      <p className="text-[11px] text-slate-500">{update.ownerApp} · {update.installationState}</p>
                    </div>
                    {checked ? <SquareCheckBig className="size-5 text-indigo-600" /> : <Square className="size-5 text-slate-400" />}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Evidence label={ar ? "الحالي" : "Current"} value={update.current.releaseVersion} />
                    <Evidence label={ar ? "الهدف" : "Target"} value={update.availableRelease.releaseVersion} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                    <Tag>{update.availableRelease.riskLevel}</Tag>
                    {update.availableRelease.requiresBackup && <Tag>{ar ? "نسخة احتياطية" : "Backup"}</Tag>}
                    {update.availableRelease.requiresMaintenance && <Tag>{ar ? "صيانة" : "Maintenance"}</Tag>}
                    {update.updateAlreadyPlanned && <Tag>{ar ? "مخطط بالفعل" : "Already planned"}</Tag>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ResourceBoundary>
  );
}

function StateSection({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <div className="space-y-5">
      <ResourceBoundary resource={provisioning.components} ar={ar}>
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{ar ? "المكونات المثبتة" : "Installed components"}</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900"><tr><Th>{ar ? "المكون" : "Component"}</Th><Th>{ar ? "المصدر" : "Source"}</Th><Th>{ar ? "الحالة" : "State"}</Th><Th>{ar ? "المطلوب" : "Desired"}</Th><Th>{ar ? "المطبق" : "Applied"}</Th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {provisioning.components.data.items.map((component) => (
                  <tr key={component.id}><Td><strong>{component.componentKey}</strong><span className="block text-[10px] text-slate-500">{component.ownerApp}</span></Td><Td>{component.selectionSource}</Td><Td><Tag>{component.state}</Tag></Td><Td>{component.desired.releaseVersion ?? "—"}</Td><Td>{component.applied.releaseVersion ?? "—"}</Td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ResourceBoundary>

      <ResourceBoundary resource={provisioning.seeds} ar={ar}>
        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ar ? "حالة البذور" : "Seed state"}</h3>
              <p className="mt-1 text-xs text-slate-500">{ar ? "حل التعارض يتطلب مراجعة صريحة وبصمات حالية." : "Conflict resolution requires an explicit revision and exact checksums."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={model.conflictDecision} onChange={(event) => model.setConflictDecision(event.target.value as SeedConflictDecision)} className={inputClass}>
                <option value="KEEP_TENANT_VALUE">KEEP_TENANT_VALUE</option>
                <option value="APPLY_RELEASE_VALUE_IF_UNMODIFIED">APPLY_RELEASE_VALUE_IF_UNMODIFIED</option>
                <option value="SKIP_THIS_RELEASE">SKIP_THIS_RELEASE</option>
              </select>
              <input value={model.conflictReasonCode} onChange={(event) => model.setConflictReasonCode(event.target.value)} className={inputClass} aria-label={ar ? "رمز سبب حل التعارض" : "Conflict reason code"} />
            </div>
          </div>
          <div className="space-y-2">
            {provisioning.seeds.data.items.map((seed) => (
              <div key={seed.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{seed.componentKey} / {seed.seedKey}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{seed.policy} · {seed.status}{seed.conflictCode ? ` · ${seed.conflictCode}` : ""}</p>
                </div>
                {seed.status === "CONFLICT" && (
                  <div className="text-end">
                    <button
                      type="button"
                      disabled={!provisioning.permissions.canResolveConflicts || !canResolveSeedConflict(seed) || provisioning.mutation.name !== null}
                      onClick={() => void model.resolveConflict(seed)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ar ? "حل التعارض" : "Resolve conflict"}
                    </button>
                    {seed.revision === null && (
                      <p className="mt-1 max-w-sm text-[10px] text-amber-700 dark:text-amber-300">
                        {ar ? "معطل بأمان: هذه الاستجابة لم تعرض expectedConflictRevision." : "Fail-closed: this response omitted expectedConflictRevision."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ResourceBoundary>
    </div>
  );
}

function PrerequisitesSection({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ar ? "طلب متطلبات العملية المحددة" : "Request selected operation prerequisites"}</h3>
            <p className="mt-1 text-xs text-slate-500">{provisioning.selectedOperation.data ? `${provisioning.selectedOperation.data.type} · ${shortDigest(provisioning.selectedOperation.data.planDigest)}` : (ar ? "اختر عملية من سجل العمليات أولًا." : "Select an operation in history first.")}</p>
          </div>
          <div className="flex gap-2">
            <input value={model.prerequisiteReasonCode} onChange={(event) => model.setPrerequisiteReasonCode(event.target.value)} className={inputClass} aria-label={ar ? "رمز سبب طلب المتطلبات" : "Prerequisite reason code"} />
            <button type="button" onClick={() => void model.requestSelectedPrerequisites()} disabled={!provisioning.permissions.canRequestPrerequisites || !provisioning.selectedOperation.data || provisioning.mutation.name !== null} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{ar ? "إرسال الطلب" : "Request"}</button>
          </div>
        </div>
      </div>

      <ResourceBoundary resource={provisioning.prerequisites} ar={ar}>
        {provisioning.prerequisites.data.length === 0 ? (
          <EmptyState ar={ar} labelEn="No prerequisite evidence." labelAr="لا يوجد دليل متطلبات." />
        ) : (
          <div className="space-y-3">
            {provisioning.prerequisites.data.map((request) => (
              <article key={request.requestId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-xs font-bold text-slate-900 dark:text-white">{ar ? "طلب" : "Request"} {request.generation}</p><p className="mt-1 text-[10px] text-slate-500">{shortDigest(request.requestDigest)} · {formatDate(request.requestedAt, model.lang)}</p></div>
                  <Tag>{request.status}</Tag>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{request.releasePins.map((pin) => <Tag key={`${request.requestId}-${pin.componentKey}`}>{pin.componentKey}{pin.requiresBackup ? " · backup" : ""}{pin.requiresMaintenance ? " · maintenance" : ""}</Tag>)}</div>
                {request.maintenanceFence && (
                  <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {ar ? "سياج الصيانة" : "Maintenance fence"}: {request.maintenanceFence.status} · {ar ? "مراجعة" : "revision"} {request.maintenanceFence.accessPolicyRevision}
                  </div>
                )}
                {request.evidence.map((evidence) => (
                  <div key={evidence.evidenceId} className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-900 sm:grid-cols-3">
                    <Evidence label={ar ? "الدليل" : "Evidence"} value={evidence.status} />
                    <Evidence label={ar ? "البصمة" : "Digest"} value={shortDigest(evidence.evidenceDigest)} />
                    <Evidence label={ar ? "الحجم" : "Backup bytes"} value={evidence.backupEvidence?.sizeBytes ?? "—"} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </ResourceBoundary>
    </div>
  );
}

function ManagedSection({ model }: TenantProvisioningWorkspaceViewProps) {
  const ar = model.lang === "ar";
  const { provisioning } = model;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CommandCard title={ar ? "إضافة تطبيق" : "Add Application"} description={ar ? "استخدم مراجعة حديثة موثوقة واختيارات إصدار دقيقة؛ الاكتشاف للقراءة فقط وكل تغيير تثبيت صريح." : "Use a fresh authoritative access-policy revision and exact release pins; discovery is read-only and installation changes are explicit."}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={ar ? "مفتاح التطبيق" : "Application key"}><input className={inputClass} value={model.applicationKey} onChange={(event) => model.setApplicationKey(event.target.value)} /></Field>
          <Field label={ar ? "مراجعة سياسة الوصول" : "Access-policy revision"}><input className={inputClass} inputMode="numeric" value={model.accessPolicyRevision} onChange={(event) => model.setAccessPolicyRevision(event.target.value)} /></Field>
        </div>
        <Field label={ar ? "رمز السبب" : "Reason code"}><input className={inputClass} value={model.addApplicationReasonCode} onChange={(event) => model.setAddApplicationReasonCode(event.target.value)} /></Field>
        <div className="space-y-2">
          {model.managedTargets.map((target, index) => (
            <div key={target.key} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{ar ? "هدف" : "Target"} {index + 1}</span><button type="button" onClick={() => model.removeManagedTarget(target.key)} className="text-rose-600">{ar ? "إزالة" : "Remove"}</button></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["componentKey", "componentId", "targetReleaseId", "targetReleaseVersion", "targetManifestChecksum"] as const).map((field) => (
                  <input key={field} className={`${inputClass} ${field === "targetManifestChecksum" ? "sm:col-span-2" : ""}`} placeholder={field} value={target[field]} onChange={(event) => model.updateManagedTarget(target.key, field, event.target.value)} aria-label={field} />
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={model.addManagedTarget} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">+ {ar ? "إضافة هدف" : "Add target"}</button>
        </div>
        <CommandButton disabled={!provisioning.permissions.canAddApplication || provisioning.mutation.name !== null} onClick={() => void model.submitAddApplication()}>{ar ? "إنشاء عملية إضافة" : "Create add operation"}</CommandButton>
      </CommandCard>

      <div className="space-y-4">
        <CommandCard title={ar ? "إصلاح مكون" : "Repair component"} description={ar ? "الإصلاح مثبت على الإصدار المطلوب الحالي ولا يقوم بالترقية." : "Repair is pinned to the current desired release; it does not upgrade."}>
          <Field label={ar ? "المكون" : "Component"}><ComponentSelect model={model} value={model.repairComponentId} onChange={model.setRepairComponentId} /></Field>
          <Field label={ar ? "رمز السبب" : "Reason code"}><input className={inputClass} value={model.repairReasonCode} onChange={(event) => model.setRepairReasonCode(event.target.value)} /></Field>
          <CommandButton disabled={!provisioning.permissions.canRepair || provisioning.mutation.name !== null} onClick={() => void model.submitRepair()}>{ar ? "إنشاء عملية إصلاح" : "Create repair"}</CommandButton>
        </CommandCard>

        <CommandCard title={ar ? "إيقاف مكون مع الاحتفاظ" : "Retained decommission"} description={ar ? "يتطلب إزالة الاستحقاق وعدم وجود تبعيات نشطة، ويُجبر النسخ الاحتياطي والصيانة." : "Requires removed entitlement and no enabled dependants; backup and maintenance are mandatory."}>
          <Field label={ar ? "المكون" : "Component"}><ComponentSelect model={model} value={model.decommissionComponentId} onChange={model.setDecommissionComponentId} /></Field>
          <Field label={ar ? "رمز السبب" : "Reason code"}><input className={inputClass} value={model.decommissionReasonCode} onChange={(event) => model.setDecommissionReasonCode(event.target.value)} /></Field>
          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={model.retentionAcknowledged} onChange={(event) => model.setRetentionAcknowledged(event.target.checked)} className="mt-0.5" /><span>{ar ? "أقر أن البيانات ستظل محتفظًا بها وأن المكون سيُعطل فقط." : "I acknowledge that data is retained and the component is disabled rather than erased."}</span></label>
          <CommandButton danger disabled={!provisioning.permissions.canDecommission || !model.retentionAcknowledged || provisioning.mutation.name !== null} onClick={() => void model.submitDecommission()}>{ar ? "إنشاء عملية إيقاف" : "Create decommission"}</CommandButton>
        </CommandCard>
      </div>
    </div>
  );
}

function ComponentSelect({ model, value, onChange }: TenantProvisioningWorkspaceViewProps & { value: string; onChange: (value: string) => void }) {
  return <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">—</option>{model.provisioning.components.data.items.map((component) => <option key={component.id} value={component.id}>{component.componentKey} · {component.state}</option>)}</select>;
}

function ResourceBoundary<T>({ resource, ar, compact = false, children }: { resource: ProvisioningResource<T>; ar: boolean; compact?: boolean; children: ReactNode }) {
  if (resource.status === "loading" || resource.status === "idle") return <div className={`grid place-items-center ${compact ? "min-h-24" : "min-h-48"}`}><span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><RefreshCw className="size-4 animate-spin" />{ar ? "جارٍ التحميل…" : "Loading…"}</span></div>;
  if (resource.status === "forbidden") return <Notice icon={<ShieldCheck className="size-5" />} title={ar ? "صلاحية مطلوبة" : "Permission required"} description={ar ? "هذا المورد مستقل في الصلاحيات ولا يُعرض كقائمة فارغة." : "This independently permissioned resource is not represented as empty."} />;
  if (resource.status === "error") return <Notice icon={<XCircle className="size-5" />} title={ar ? "المورد غير متاح" : "Resource unavailable"} description={`${resource.error?.errorCode ?? "UNKNOWN_ERROR"}${resource.error?.correlationId ? ` · ${resource.error.correlationId}` : ""}`} />;
  return <>{children}</>;
}

function Notice({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700"><div><span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900">{icon}</span><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div></div>;
}

function EmptyState({ ar, labelEn, labelAr }: { ar: boolean; labelEn: string; labelAr: string }) {
  return <Notice icon={<CircleDashed className="size-5" />} title={ar ? labelAr : labelEn} description={ar ? "تؤكد الاستجابة الموثوقة عدم وجود سجلات." : "The authoritative response contains no records."} />;
}

function StatusBadge({ status, ar }: { status: TenantOperationStatus; ar: boolean }) {
  const colors = status === "SUCCEEDED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : status === "FAILED_RETRYABLE" || status === "MANUAL_RECOVERY_REQUIRED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" : status === "CANCELLED" ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : status === "CANCEL_REQUESTED" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${colors}`}>{operationStatusLabel(status, ar)}</span>;
}

function StepBadge({ status }: { status: string }) {
  const Icon = status === "SUCCEEDED" || status === "SKIPPED" ? CheckCircle2 : status === "FAILED" || status === "CONFLICT" ? AlertTriangle : status === "CANCELLED" ? XCircle : CircleDashed;
  return <span className="inline-flex items-center gap-1"><Icon className="size-3" />{status}</span>;
}

function CommandCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <article className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-xs text-slate-500">{description}</p></div>{children}</article>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300"><span className="mb-1 block">{label}</span>{children}</label>;
}

function CommandButton({ danger = false, disabled, onClick, children }: { danger?: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "bg-rose-600" : "bg-indigo-600"}`}>{children}</button>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="truncate font-mono text-slate-800 dark:text-slate-100" title={value}>{value}</dd></div>;
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{children}</span>;
}

function Th({ children }: { children: ReactNode }) { return <th className="px-3 py-2 text-start font-semibold">{children}</th>; }
function Td({ children }: { children: ReactNode }) { return <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{children}</td>; }

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function shortDigest(value: string): string { return `${value.slice(0, 10)}…${value.slice(-6)}`; }
function formatDate(value: string, locale: string): string { return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function operationTypeLabel(type: string, ar: boolean): string { const labels: Record<string, [string, string]> = { INITIAL_PROVISION: ["Initial provision", "التجهيز الأولي"], RETRY: ["Retry", "إعادة محاولة"], UPDATE: ["Update", "تحديث"], ADD_APPLICATION: ["Add Application", "إضافة تطبيق"], REPAIR: ["Repair", "إصلاح"], DECOMMISSION: ["Decommission", "إيقاف"] }; return labels[type]?.[ar ? 1 : 0] ?? type; }
function operationStatusLabel(status: TenantOperationStatus, ar: boolean): string { if (!ar) return status; const labels: Partial<Record<TenantOperationStatus, string>> = { REQUESTED: "مطلوبة", PLANNING: "تخطيط", QUEUED: "بالطابور", RUNNING: "قيد التنفيذ", WAITING_RETRY: "انتظار إعادة", CANCEL_REQUESTED: "طلب إلغاء", SUCCEEDED: "نجحت", FAILED_RETRYABLE: "فشل قابل للإعادة", MANUAL_RECOVERY_REQUIRED: "تدخل يدوي", CANCELLED: "ملغاة" }; return labels[status] ?? status; }
function localizeError(code: string, ar: boolean): string { const messages: Record<string, [string, string]> = { TENANT_SEED_CONFLICT_REVISION_UNAVAILABLE: ["Core has not exposed the conflict revision; resolution is disabled safely.", "لم تعرض Core مراجعة التعارض؛ تم تعطيل الحل بأمان."], TENANT_UPDATE_SELECTION_REQUIRED: ["Select at least one update.", "اختر تحديثًا واحدًا على الأقل."], TENANT_DECOMMISSION_RETENTION_ACK_REQUIRED: ["Acknowledge retained-data behavior.", "أكد سلوك الاحتفاظ بالبيانات."], INVALID_PROVISIONING_REASON_CODE: ["Use an uppercase safe reason code.", "استخدم رمز سبب آمنًا بأحرف كبيرة."], "GW.IDEM.IN_FLIGHT": ["The exact command is still in flight; retry keeps the same key.", "الأمر نفسه ما زال قيد التنفيذ؛ الإعادة تحتفظ بالمفتاح نفسه."] }; return messages[code]?.[ar ? 1 : 0] ?? code; }
