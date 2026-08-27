import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  DatabaseZap,
  History,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { en as enDict } from "@/i18n/dictionaries/en";
import { ar as arDict } from "@/i18n/dictionaries/ar";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import type {
  ProvisioningWorkspaceSection,
  TenantProvisioningWorkspaceModel,
} from "../hooks/useTenantProvisioningWorkspace";
import { canResolveSeedConflict } from "../model/readers";
import type {
  ProvisioningResource,
  SeedConflictDecision,
  TenantOperationStatus,
  TenantOperationStepStatus,
} from "../types";

export interface TenantProvisioningWorkspaceViewProps {
  model: TenantProvisioningWorkspaceModel;
}

function tpCopy(isAr: boolean) {
  return (isAr ? arDict : enDict).tenantProvisioning;
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  const visibleError =
    model.localError ?? provisioning.mutation.error?.errorCode ?? null;

  return (
    <section
      dir={model.dir}
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-label={copy.ariaLabel}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              {copy.title}
            </h2>
            {provisioning.polling && (
              <Badge tone="neutral">
                <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
                {copy.livePollingBadge}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {copy.asyncNote}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void provisioning.refreshAll()}
          disabled={provisioning.authLoading}
        >
          <RefreshCw
            className={`size-3.5 ${provisioning.operations.refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.refreshButton}
        </Button>
      </header>

      <Tabs
        value={model.section}
        onValueChange={(value) => model.setSection(value as ProvisioningWorkspaceSection)}
        className="border-b border-border px-3 pt-2"
      >
        <TabsList className="h-auto justify-start gap-1.5 overflow-x-auto border-b-0 pb-2 scrollbar-none">
          {SECTIONS.map(([key, Icon, en, arabic]) => (
            <TabsTrigger key={key} value={key} className="h-8 shrink-0 gap-1.5 rounded-md px-3 py-1.5 text-xs after:hidden data-[state=active]:bg-ink-100 dark:data-[state=active]:bg-ink-800">
              <Icon className="size-3.5" aria-hidden="true" />
              {ar ? arabic : en}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visibleError && (
        <div
          role="alert"
          className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-800 dark:border-danger-900/70 dark:bg-danger-950/30 dark:text-danger-300"
        >
          <span>
            <strong>{copy.actionErrorPrefix}</strong>
            {localizeError(visibleError, ar)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              model.clearLocalError();
              provisioning.clearMutationError();
            }}
            className="h-auto shrink-0 p-1"
            aria-label={copy.dismissErrorAriaLabel}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.operations} ar={ar}>
      {provisioning.operations.data.items.length === 0 ? (
        <EmptyState icon={CircleDashed} title={copy.noOperationsTitle} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="max-h-[44rem] space-y-2 overflow-y-auto pe-1">
            {provisioning.operations.data.items.map((operation) => (
              <button
                type="button"
                key={operation.id}
                onClick={() => provisioning.selectOperation(operation.id)}
                className={`w-full rounded-lg border p-3 text-start transition ${
                  provisioning.selectedOperationId === operation.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                    : "border-border hover:border-ink-300 dark:hover:border-ink-600"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {operationTypeLabel(operation.type, ar)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy.generationLabel} {operation.generation} ·{" "}
                      {formatDate(operation.requestedAt, model.lang)}
                    </p>
                  </div>
                  <StatusBadge status={operation.status} ar={ar} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{operation.currentPhase}</span>
                  <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.selectedOperation} ar={ar} compact>
      {!provisioning.selectedOperation.data ? (
        <EmptyState icon={CircleDashed} title={copy.selectOperationTitle} />
      ) : (
        <div className="space-y-4">
          {(() => {
            const operation = provisioning.selectedOperation.data;
            const latestOperation = provisioning.operations.data.items.reduce(
              (latest, candidate) =>
                candidate.generation > latest.generation ? candidate : latest,
            );
            const isLatestOperation = latestOperation.id === operation.id;
            const isHistoricalOperation =
              operation.generation < latestOperation.generation;
            const canRetry =
              provisioning.permissions.canRetryOrCancel &&
              isLatestOperation &&
              ["FAILED_RETRYABLE", "MANUAL_RECOVERY_REQUIRED", "CANCELLED"].includes(
                operation.status,
              );
            const canCancel =
              provisioning.permissions.canRetryOrCancel &&
              isLatestOperation &&
              [
                "REQUESTED",
                "PLANNING",
                "QUEUED",
                "RUNNING",
                "WAITING_RETRY",
              ].includes(operation.status);
            return (
              <>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {operationTypeLabel(operation.type, ar)} · {copy.generationLabelLower} {operation.generation}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">{operation.currentPhase}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={operation.status} ar={ar} />
                      {canRetry && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => void provisioning.retryOperation(operation.id).catch(() => undefined)}
                          disabled={provisioning.mutation.name !== null}
                        >
                          {copy.retryButton}
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void provisioning.cancelOperation(operation.id).catch(() => undefined)}
                          disabled={provisioning.mutation.name !== null}
                          className="border-danger-300 text-danger-700 hover:bg-danger-50 dark:border-danger-800 dark:text-danger-300 dark:hover:bg-danger-950/30"
                        >
                          {copy.requestCancelButton}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isHistoricalOperation && (
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-ink-100 p-2 text-xs text-muted-foreground dark:bg-ink-900/70">
                      <History className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <p>
                        {copy.historicalOperationNote(operation.generation, latestOperation.generation)}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{copy.weightedProgressLabel}</span>
                      <span>{operation.progress.percent}%</span>
                    </div>
                    <Progress value={operation.progress.percent} tone={progressTone(operation.status)} />
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>{operation.progress.completedSteps}/{operation.progress.totalSteps} {copy.stepsWord}</span>
                      <span>{operation.progress.failedSteps} {copy.failedWord}</span>
                      <span>{copy.policyRevisionLabel}: {operation.accessPolicyRevision}</span>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Evidence label={copy.planDigestLabel} value={shortDigest(operation.planDigest)} />
                    <Evidence label={copy.requestedLabel} value={formatDate(operation.requestedAt, model.lang)} />
                  </dl>
                  {operation.safeError && (operation.safeError.code || operation.safeError.message) && (
                    <div className="mt-3 rounded-md bg-danger-50 p-2 text-xs text-danger-800 dark:bg-danger-950/30 dark:text-danger-300">
                      {operation.safeError.code ?? "OPERATION_FAILED"}
                      {operation.safeError.message ? ` — ${operation.safeError.message}` : ""}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy.stepsHeading}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-start text-xs">
                      <thead className="bg-ink-100 text-muted-foreground dark:bg-ink-900">
                        <tr>
                          <Th>{copy.stepColumnHeader}</Th>
                          <Th>{copy.kindColumnHeader}</Th>
                          <Th>{copy.statusColumnHeader}</Th>
                          <Th>{copy.attemptsColumnHeader}</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {operation.steps.map((step) => (
                          <tr key={step.id}>
                            <Td>
                              <span className="font-semibold text-foreground">{step.stepKey}</span>
                              {step.componentKey && <span className="block text-xs text-muted-foreground">{step.componentKey}</span>}
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
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {copy.timelineLabel} ({operation.timelineEventCount})
                  </h4>
                  <ResourceBoundary resource={provisioning.timeline} ar={ar} compact>
                    <ol className="space-y-2 border-s border-border ps-4">
                      {provisioning.timeline.data.items.map((event) => (
                        <li key={event.id} className="relative rounded-md bg-ink-100 p-2 text-xs dark:bg-ink-900/70">
                          <span className="absolute -start-[1.18rem] top-3 size-2 rounded-full bg-brand-500" />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{event.eventType}</span>
                            <span className="text-xs text-muted-foreground">#{event.sequence} · {formatDate(event.occurredAt, model.lang)}</span>
                          </div>
                          {event.message && <p className="mt-1 text-muted-foreground">{event.message}</p>}
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  return (
    <ResourceBoundary resource={provisioning.updates} ar={ar}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{copy.availableUpdatesTitle}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{copy.updatesNote}</p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void model.applySelectedUpdates()}
            disabled={!provisioning.permissions.canApplyUpdates || !model.selectedUpdateKeys.length || provisioning.mutation.name !== null}
          >
            {copy.applySelectedButton(model.selectedUpdateKeys.length)}
          </Button>
        </div>
        {provisioning.updates.data.items.length === 0 ? (
          <EmptyState icon={CircleDashed} title={copy.noUpdatesTitle} />
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
                  className={`rounded-lg border p-3 text-start disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{update.componentKey}</p>
                      <p className="text-xs text-muted-foreground">{update.ownerApp} · {update.installationState}</p>
                    </div>
                    <CheckMark checked={checked} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Evidence label={copy.currentLabel} value={update.current.releaseVersion} />
                    <Evidence label={copy.targetLabel} value={update.availableRelease.releaseVersion} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone="neutral">{update.availableRelease.riskLevel}</Badge>
                    {update.availableRelease.requiresBackup && <Badge tone="neutral">{copy.backupBadge}</Badge>}
                    {update.availableRelease.requiresMaintenance && <Badge tone="neutral">{copy.maintenanceBadge}</Badge>}
                    {update.updateAlreadyPlanned && <Badge tone="neutral">{copy.alreadyPlannedBadge}</Badge>}
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  return (
    <div className="space-y-5">
      <ResourceBoundary resource={provisioning.components} ar={ar}>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{copy.installedComponentsTitle}</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-ink-100 text-muted-foreground dark:bg-ink-900"><tr><Th>{copy.componentColumnHeader}</Th><Th>{copy.sourceColumnHeader}</Th><Th>{copy.stateColumnHeader}</Th><Th>{copy.desiredColumnHeader}</Th><Th>{copy.appliedColumnHeader}</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {provisioning.components.data.items.map((component) => (
                  <tr key={component.id}><Td><strong className="text-foreground">{component.componentKey}</strong><span className="block text-xs text-muted-foreground">{component.ownerApp}</span></Td><Td>{component.selectionSource}</Td><Td><Badge tone="neutral">{component.state}</Badge></Td><Td>{component.desired.releaseVersion ?? "—"}</Td><Td>{component.applied.releaseVersion ?? "—"}</Td></tr>
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
              <h3 className="text-sm font-semibold text-foreground">{copy.seedStateTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{copy.seedStateNote}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={model.conflictDecision} onValueChange={(value) => model.setConflictDecision(value as SeedConflictDecision)}>
                <SelectTrigger aria-label={copy.conflictDecisionAriaLabel} className="h-8 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KEEP_TENANT_VALUE">KEEP_TENANT_VALUE</SelectItem>
                  <SelectItem value="APPLY_RELEASE_VALUE_IF_UNMODIFIED">APPLY_RELEASE_VALUE_IF_UNMODIFIED</SelectItem>
                  <SelectItem value="SKIP_THIS_RELEASE">SKIP_THIS_RELEASE</SelectItem>
                </SelectContent>
              </Select>
              <Input value={model.conflictReasonCode} onChange={(event) => model.setConflictReasonCode(event.target.value)} className="h-8 w-auto text-xs" aria-label={copy.conflictReasonCodeAriaLabel} />
            </div>
          </div>
          <div className="space-y-2">
            {provisioning.seeds.data.items.map((seed) => (
              <div key={seed.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{seed.componentKey} / {seed.seedKey}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{seed.policy} · {seed.status}{seed.conflictCode ? ` · ${seed.conflictCode}` : ""}</p>
                </div>
                {seed.status === "CONFLICT" && (
                  <div className="text-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!provisioning.permissions.canResolveConflicts || !canResolveSeedConflict(seed) || provisioning.mutation.name !== null}
                      onClick={() => void model.resolveConflict(seed)}
                    >
                      {copy.resolveConflictButton}
                    </Button>
                    {seed.revision === null && (
                      <p className="mt-1 max-w-sm text-xs text-warn-700 dark:text-warn-300">
                        {copy.failClosedNote}
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  const selectedOperation = provisioning.selectedOperation.data;
  const prerequisitesRequired = (selectedOperation?.prerequisiteCount ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{copy.requestPrereqTitle}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{selectedOperation ? `${selectedOperation.type} · ${shortDigest(selectedOperation.planDigest)}` : copy.selectOperationFirstText}</p>
            {selectedOperation && !prerequisitesRequired && (
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.noPrereqRequiredNote}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input value={model.prerequisiteReasonCode} onChange={(event) => model.setPrerequisiteReasonCode(event.target.value)} className="h-8 w-auto text-xs" aria-label={copy.prereqReasonAriaLabel} />
            <Button type="button" variant="primary" size="sm" onClick={() => void model.requestSelectedPrerequisites()} disabled={!provisioning.permissions.canRequestPrerequisites || !selectedOperation || !prerequisitesRequired || provisioning.mutation.name !== null}>{copy.requestButton}</Button>
          </div>
        </div>
      </div>

      <ResourceBoundary resource={provisioning.prerequisites} ar={ar}>
        {provisioning.prerequisites.data.length === 0 ? (
          <EmptyState icon={CircleDashed} title={copy.noPrereqEvidenceTitle} />
        ) : (
          <div className="space-y-3">
            {provisioning.prerequisites.data.map((request) => (
              <article key={request.requestId} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-xs font-semibold text-foreground">{copy.requestLabelInline} {request.generation}</p><p className="mt-1 text-xs text-muted-foreground">{shortDigest(request.requestDigest)} · {formatDate(request.requestedAt, model.lang)}</p></div>
                  <Badge tone="neutral">{request.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{request.releasePins.map((pin) => <Badge tone="neutral" key={`${request.requestId}-${pin.componentKey}`}>{pin.componentKey}{pin.requiresBackup ? " · backup" : ""}{pin.requiresMaintenance ? " · maintenance" : ""}</Badge>)}</div>
                {request.maintenanceFence && (
                  <div className="mt-3 rounded-md bg-warn-50 p-2 text-xs text-warn-900 dark:bg-warn-950/30 dark:text-warn-200">
                    {copy.maintenanceFenceLabel}: {request.maintenanceFence.status} · {copy.revisionWord} {request.maintenanceFence.accessPolicyRevision}
                  </div>
                )}
                {request.evidence.map((evidence) => (
                  <div key={evidence.evidenceId} className="mt-2 grid gap-2 rounded-md bg-ink-100 p-2 text-xs dark:bg-ink-900/40 sm:grid-cols-3">
                    <Evidence label={copy.evidenceLabel} value={evidence.status} />
                    <Evidence label={copy.digestLabel} value={shortDigest(evidence.evidenceDigest)} />
                    <Evidence label={copy.backupBytesLabel} value={evidence.backupEvidence?.sizeBytes ?? "—"} />
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
  const copy = tpCopy(ar);
  const { provisioning } = model;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CommandCard title={copy.addApplicationTitle} description={copy.addApplicationDescription}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={copy.applicationKeyLabel}>
            {(fieldProps) => <Input {...fieldProps} value={model.applicationKey} onChange={(event) => model.setApplicationKey(event.target.value)} />}
          </Field>
          <Field label={copy.accessPolicyRevisionLabel}>
            {(fieldProps) => <Input {...fieldProps} inputMode="numeric" value={model.accessPolicyRevision} onChange={(event) => model.setAccessPolicyRevision(event.target.value)} />}
          </Field>
        </div>
        <Field label={copy.reasonCodeLabel}>
          {(fieldProps) => <Input {...fieldProps} value={model.addApplicationReasonCode} onChange={(event) => model.setAddApplicationReasonCode(event.target.value)} />}
        </Field>
        <div className="space-y-2">
          {model.managedTargets.map((target, index) => (
            <div key={target.key} className="rounded-md border border-border p-2">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>{copy.targetLabelInline(index + 1)}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => model.removeManagedTarget(target.key)} className="h-auto p-0 text-danger-600 hover:text-danger-700 hover:bg-transparent dark:text-danger-400">
                  {copy.removeButton}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["componentKey", "componentId", "targetReleaseId", "targetReleaseVersion", "targetManifestChecksum"] as const).map((field) => (
                  <Input key={field} className={field === "targetManifestChecksum" ? "sm:col-span-2" : ""} placeholder={field} value={target[field]} onChange={(event) => model.updateManagedTarget(target.key, field, event.target.value)} aria-label={field} />
                ))}
              </div>
            </div>
          ))}
          <Button type="button" variant="link" size="sm" onClick={model.addManagedTarget} className="h-auto p-0">+ {copy.addTargetButton}</Button>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={!provisioning.permissions.canAddApplication || provisioning.mutation.name !== null} onClick={() => void model.submitAddApplication()}>{copy.createAddOperationButton}</Button>
      </CommandCard>

      <div className="space-y-4">
        <CommandCard title={copy.repairComponentTitle} description={copy.repairDescription}>
          <Field label={copy.componentLabel}>
            {(fieldProps) => <ComponentSelect model={model} value={model.repairComponentId} onChange={model.setRepairComponentId} id={fieldProps.id} />}
          </Field>
          <Field label={copy.reasonCodeLabel}>
            {(fieldProps) => <Input {...fieldProps} value={model.repairReasonCode} onChange={(event) => model.setRepairReasonCode(event.target.value)} />}
          </Field>
          <Button type="button" variant="primary" size="sm" disabled={!provisioning.permissions.canRepair || provisioning.mutation.name !== null} onClick={() => void model.submitRepair()}>{copy.createRepairButton}</Button>
        </CommandCard>

        <CommandCard title={copy.retainedDecommissionTitle} description={copy.retainedDecommissionDescription}>
          <Field label={copy.componentLabel}>
            {(fieldProps) => <ComponentSelect model={model} value={model.decommissionComponentId} onChange={model.setDecommissionComponentId} id={fieldProps.id} />}
          </Field>
          <Field label={copy.reasonCodeLabel}>
            {(fieldProps) => <Input {...fieldProps} value={model.decommissionReasonCode} onChange={(event) => model.setDecommissionReasonCode(event.target.value)} />}
          </Field>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox checked={model.retentionAcknowledged} onCheckedChange={(checked) => model.setRetentionAcknowledged(checked === true)} className="mt-0.5" />
            <span>{copy.retentionAckLabel}</span>
          </label>
          <Button type="button" variant="destructive" size="sm" disabled={!provisioning.permissions.canDecommission || !model.retentionAcknowledged || provisioning.mutation.name !== null} onClick={() => void model.submitDecommission()}>{copy.createDecommissionButton}</Button>
        </CommandCard>
      </div>
    </div>
  );
}

function ComponentSelect({ model, value, onChange, id }: TenantProvisioningWorkspaceViewProps & { value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {model.provisioning.components.data.items.map((component) => (
          <SelectItem key={component.id} value={component.id}>{component.componentKey} · {component.state}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ResourceBoundary<T>({ resource, ar, compact = false, children }: { resource: ProvisioningResource<T>; ar: boolean; compact?: boolean; children: ReactNode }) {
  const copy = tpCopy(ar);
  if (resource.status === "loading" || resource.status === "idle") return <div className={`grid place-items-center ${compact ? "min-h-24" : "min-h-48"}`}><span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><RefreshCw className="size-4 animate-spin" aria-hidden="true" />{copy.loadingLabel}</span></div>;
  if (resource.status === "forbidden") return <Notice icon={<ShieldCheck className="size-5" />} title={copy.permissionRequiredTitle} description={copy.permissionRequiredDescription} />;
  if (resource.status === "error") return <Notice icon={<XCircle className="size-5" />} title={copy.resourceUnavailableTitle} description={`${resource.error?.errorCode ?? "UNKNOWN_ERROR"}${resource.error?.correlationId ? ` · ${resource.error.correlationId}` : ""}`} />;
  return <>{children}</>;
}

function Notice({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center">
      <div>
        <span className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-ink-100 text-muted-foreground dark:bg-ink-800">{icon}</span>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, ar }: { status: TenantOperationStatus; ar: boolean }) {
  return <Badge tone={statusTone(status)}>{operationStatusLabel(status, ar)}</Badge>;
}

function statusTone(status: TenantOperationStatus): "brand" | "danger" | "warn" | "neutral" {
  if (status === "SUCCEEDED") return "brand";
  if (status === "FAILED_RETRYABLE" || status === "MANUAL_RECOVERY_REQUIRED") return "danger";
  if (status === "CANCEL_REQUESTED") return "warn";
  return "neutral";
}

function progressTone(status: TenantOperationStatus): "running" | "succeeded" | "failed" {
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED_RETRYABLE" || status === "MANUAL_RECOVERY_REQUIRED") return "failed";
  return "running";
}

function StepBadge({ status }: { status: TenantOperationStepStatus }) {
  const Icon = status === "SUCCEEDED" || status === "SKIPPED" ? CheckCircle2 : status === "FAILED" || status === "CONFLICT" ? AlertTriangle : status === "CANCELLED" ? XCircle : CircleDashed;
  const tone = status === "SUCCEEDED" || status === "SKIPPED" ? "brand" : status === "FAILED" || status === "CONFLICT" ? "danger" : "neutral";
  return <Badge tone={tone}><Icon className="size-3" aria-hidden="true" />{status}</Badge>;
}

function CommandCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/** Decorative selection indicator inside an already-interactive toggle
 * button — a real Checkbox (a button under the hood) can't nest there. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-5 shrink-0 place-items-center rounded-xs border ${
        checked
          ? "border-brand-500 bg-brand-500 text-ink-950"
          : "border-border text-transparent"
      }`}
    >
      <Check className="size-3.5" />
    </span>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="truncate font-mono text-foreground" title={value}>{value}</dd></div>;
}

function Th({ children }: { children: ReactNode }) { return <th className="px-3 py-2 text-start font-semibold">{children}</th>; }
function Td({ children }: { children: ReactNode }) { return <td className="px-3 py-2 text-muted-foreground">{children}</td>; }

function shortDigest(value: string): string { return `${value.slice(0, 10)}…${value.slice(-6)}`; }
function formatDate(value: string, locale: string): string { return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function operationTypeLabel(type: string, ar: boolean): string { const labels: Record<string, [string, string]> = { INITIAL_PROVISION: ["Initial provision", "التجهيز الأولي"], RETRY: ["Retry", "إعادة محاولة"], UPDATE: ["Update", "تحديث"], ADD_APPLICATION: ["Add Application", "إضافة تطبيق"], REPAIR: ["Repair", "إصلاح"], DECOMMISSION: ["Decommission", "إيقاف"] }; return labels[type]?.[ar ? 1 : 0] ?? type; }
function operationStatusLabel(status: TenantOperationStatus, ar: boolean): string { if (!ar) return status; const labels: Partial<Record<TenantOperationStatus, string>> = { REQUESTED: "مطلوبة", PLANNING: "تخطيط", QUEUED: "بالطابور", RUNNING: "قيد التنفيذ", WAITING_RETRY: "انتظار إعادة", CANCEL_REQUESTED: "طلب إلغاء", SUCCEEDED: "نجحت", FAILED_RETRYABLE: "فشل قابل للإعادة", MANUAL_RECOVERY_REQUIRED: "تدخل يدوي", CANCELLED: "ملغاة" }; return labels[status] ?? status; }
function localizeError(code: string, ar: boolean): string { const messages: Record<string, [string, string]> = { TENANT_SEED_CONFLICT_REVISION_UNAVAILABLE: ["Core has not exposed the conflict revision; resolution is disabled safely.", "لم تعرض Core مراجعة التعارض؛ تم تعطيل الحل بأمان."], TENANT_UPDATE_SELECTION_REQUIRED: ["Select at least one update.", "اختر تحديثًا واحدًا على الأقل."], TENANT_DECOMMISSION_RETENTION_ACK_REQUIRED: ["Acknowledge retained-data behavior.", "أكد سلوك الاحتفاظ بالبيانات."], TENANT_PROVISIONING_OPERATION_SUPERSEDED: ["This operation was superseded by a newer generation. Refresh the history and select the latest operation.", "حلّ جيل أحدث محل هذه العملية. حدّث السجل واختر أحدث عملية."], INVALID_PROVISIONING_REASON_CODE: ["Use an uppercase safe reason code.", "استخدم رمز سبب آمنًا بأحرف كبيرة."], "GW.IDEM.IN_FLIGHT": ["The exact command is still in flight; retry keeps the same key.", "الأمر نفسه ما زال قيد التنفيذ؛ الإعادة تحتفظ بالمفتاح نفسه."] }; return messages[code]?.[ar ? 1 : 0] ?? code; }
