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
import { Badge, Button } from "@/design-system";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  ApplicationTechnicalReadinessReason,
  ApplicationTechnicalReadinessView,
  ApplicationSelectionBlocker,
} from "../types";
import {
  canLinkPrimaryComponent,
  deriveTechnicalIdentityPreview,
} from "../lib/technical-provisioning-state";

interface Props {
  applicationKey: string;
  databasePrincipal: string | null;
  readiness: ApplicationTechnicalReadinessView | null;
  error: NormalizedApiError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  canManage: boolean;
  onRetry: () => void;
  onOpenAdoption: () => void;
  onOpenBinding: () => void;
}

export function ApplicationTechnicalProvisioningPanel({
  applicationKey,
  databasePrincipal,
  readiness,
  error,
  isLoading,
  isRefreshing,
  canManage,
  onRetry,
  onOpenAdoption,
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
  const identity = deriveTechnicalIdentityPreview(applicationKey);
  const showAdoptionAction =
    readiness?.lifecycleStatus === "DRAFT" && !readiness.runtimeTarget;
  const showBindingAction = canLinkPrimaryComponent(readiness);

  return (
    <section
      aria-labelledby="technical-readiness-title"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-col justify-between gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <p className="text-xs font-semibold text-primary">
            {copy.eyebrow}
          </p>
          <h2 id="technical-readiness-title" className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Route className="h-4 w-4" aria-hidden="true" /> {copy.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={isLoading || isRefreshing}
          loading={isRefreshing}
          className="self-start"
        >
          {!isRefreshing && <RefreshCw className="size-3.5" aria-hidden="true" />}
          {copy.refresh}
        </Button>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {isLoading ? (
          <div role="status" className="flex min-h-28 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {copy.loading}
          </div>
        ) : error || !readiness ? (
          <div role="alert" className="rounded-md border border-warning bg-warning-subtle p-4 text-xs text-warning-subtle-foreground">
            <p className="font-semibold">{error?.httpStatus === 403 ? copy.readinessForbidden : copy.unavailable}</p>
            {error?.message && error.httpStatus !== 403 && <p className="mt-1">{error.message}</p>}
            {error?.correlationId && (
              <p className="mt-2 font-mono text-xs opacity-75">
                {copy.correlationId}: {error.correlationId}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {readiness.activationAllowed ? (
                  <CheckCircle2 className="size-7 text-success" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="size-7 text-warning" aria-hidden="true" />
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground">{copy.statuses[readiness.status]}</div>
                  <div className="text-xs text-muted-foreground">
                    {copy.revisionLabel} {readiness.technicalDefinitionRevision}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground" dir="ltr">
                  {applicationKey}
                </code>
                <code className="rounded-md bg-info-subtle px-2.5 py-1.5 text-xs font-semibold text-info-subtle-foreground" dir="ltr">
                  {copy.workerTarget}: {readiness.runtimeTarget ?? copy.notAdopted}
                </code>
              </div>
            </div>

            <div className="rounded-md border border-info/30 bg-info-subtle p-4">
              <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]" dir={dir}>
                <ChainStep label={copy.applicationKey} value={applicationKey} />
                <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                <ChainStep
                  label={copy.workerTarget}
                  value={readiness.runtimeTarget ?? identity.runtimeTarget}
                />
                <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                <ChainStep
                  label={copy.databasePrincipal}
                  value={databasePrincipal ?? identity.databasePrincipal}
                />
                <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                <ChainStep label={copy.componentKey} value={identity.primaryComponentKey} />
              </div>
              <p className="mt-3 text-xs text-info-subtle-foreground">
                {readiness.runtimeTarget ? copy.identityAuthoritative : copy.identityPreview}
              </p>
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
              <ul className="space-y-2 rounded-md border border-warning bg-warning-subtle p-4 text-xs text-warning-subtle-foreground">
                {readiness.reasons.map((item) => (
                  <li key={item} className="flex gap-2">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{reasonLabels[item]}</span>
                  </li>
                ))}
              </ul>
            )}

            {readiness.selectionBlockers.length > 0 && (
              <div className="rounded-md border border-border bg-muted p-4">
                <h3 className="text-xs font-semibold text-foreground">{copy.selectionTitle}</h3>
                <ul className="mt-2 grid gap-2 text-xs text-foreground sm:grid-cols-2">
                  {readiness.selectionBlockers.map((item) => (
                    <li key={item} className="flex gap-2">
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
                      <span>{selectionLabels[item]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.components.map((component) => (
              <article key={component.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary" dir="ltr">{component.key}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{component.kind} · {copy.contractShort} {component.contractVersion}</p>
                  </div>
                  {component.latestPublishedRelease ? (
                    <Badge tone="success">
                      {copy.release} {component.latestPublishedRelease.releaseVersion}
                    </Badge>
                  ) : (
                    <Badge tone="warn">
                      {copy.releaseRequired}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]" dir={dir}>
                  <ChainStep label={copy.applicationKey} value={applicationKey} />
                  <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                  <ChainStep label={copy.componentKey} value={component.key} />
                  <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                  <ChainStep label={copy.workerTarget} value={component.workerTarget ?? copy.notAdopted} />
                  <ArrowRight className="mx-auto hidden size-4 text-primary rtl:rotate-180 sm:block" aria-hidden="true" />
                  <ChainStep label={copy.release} value={component.latestPublishedRelease?.releaseVersion ?? copy.pending} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{copy.noCredential}</p>
              </article>
            ))}

            {showAdoptionAction && (
              <div className="flex flex-col justify-between gap-3 rounded-md border border-info/30 bg-info-subtle p-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-semibold text-info-subtle-foreground">{copy.adoptionCalloutTitle}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-info-subtle-foreground">{copy.adoptionCalloutDescription}</p>
                  {!canManage && (
                    <p className="mt-2 font-mono text-xs text-warning-subtle-foreground">{copy.permissionRequired}</p>
                  )}
                </div>
                {canManage && (
                  <Button variant="primary" className="shrink-0" onClick={onOpenAdoption}>
                    {copy.adoptIdentity}
                  </Button>
                )}
              </div>
            )}

            {showBindingAction && (
              <div className="flex flex-col justify-between gap-3 rounded-md border border-info/30 bg-info-subtle p-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-semibold text-info-subtle-foreground">{copy.bindingCalloutTitle}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-info-subtle-foreground">{copy.bindingCalloutDescription}</p>
                  {!canManage && (
                    <p className="mt-2 font-mono text-xs text-warning-subtle-foreground">{copy.permissionRequired}</p>
                  )}
                </div>
                {canManage && (
                  <Button variant="primary" className="shrink-0" onClick={onOpenBinding}>
                    {copy.linkComponent}
                  </Button>
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
    <div className={`rounded-md border p-3 ${value ? "border-success/30 bg-success-subtle" : "border-warning/30 bg-warning-subtle"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${value ? "text-success" : "text-warning"}`} aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <div className={`mt-1 text-xs ${value ? "text-success-subtle-foreground" : "text-warning-subtle-foreground"}`}>{value ? passed : blocked}</div>
    </div>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-xs font-semibold text-foreground" dir="ltr">{value}</div>
    </div>
  );
}
