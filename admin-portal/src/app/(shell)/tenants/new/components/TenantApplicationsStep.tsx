"use client";

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Layers3,
  Loader2,
  LockKeyhole,
  Package,
  Route,
  User,
} from "lucide-react";
import {
  Badge,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { canSelectTenantApplication } from "../lib/tenant-registration";
import { TenantApplicationAddons } from "./TenantApplicationAddons";
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
  headingRef?: React.Ref<HTMLHeadingElement>;
  candidates: readonly TenantApplicationCandidate[];
  selections: Readonly<Record<string, TenantApplicationSelection>>;
  state: TenantRegistrationLoadState;
  error: NormalizedApiError | null;
  selectedLines: readonly TenantSubscriptionLine[];
  billingCycle: TenantBillingCycle;
  showSelectionError: boolean;
  selectionError?: string;
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
  headingRef,
  candidates,
  selections,
  state,
  error,
  selectedLines,
  billingCycle,
  showSelectionError,
  selectionError,
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
    <section className="space-y-3 rounded-md border border-border bg-card p-3 sm:p-3.5">
      <header className="flex flex-col gap-2 border-b border-border pb-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="flex items-center gap-2 rounded-sm text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Package aria-hidden="true" className="size-4 text-primary" />
            {copy.stepHeading}
          </h2>
          {copy.stepDescription ? (
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              {copy.stepDescription}
            </p>
          ) : null}
        </div>
        <Field id="tenant-billing-cycle" label={copy.billingCycleLabel} hideLabel className="min-w-40">
          {(field) => (
            <Select
              name="billingCycle"
              value={billingCycle}
              onValueChange={(value) =>
                onBillingCycleChange(value as TenantBillingCycle)
              }
            >
              <SelectTrigger id={field.id} size="sm" aria-describedby={field["aria-describedby"]}>
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <SelectValue placeholder={copy.billingCycleLabel} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">{copy.monthlyOption}</SelectItem>
                <SelectItem value="ANNUAL">{copy.annualOption}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </header>

      <div
        id="tenant-applications-selection"
        tabIndex={-1}
        aria-describedby={showSelectionError ? "tenant-applications-selection-error" : undefined}
        className="space-y-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >

      {state === "loading" ? (
        <StateCard
          icon={<Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
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
        <ErrorState
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
        <div className="grid gap-2.5 lg:grid-cols-2">
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
                className={`rounded-md border-s-4 p-3 transition-colors motion-reduce:transition-none ${
                  selection
                    ? "border-primary bg-selected text-selected-foreground"
                    : "border-border bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id={`tenant-application-${candidate.key}`}
                    name={`applications.${candidate.key}.selected`}
                    checked={Boolean(selection)}
                    disabled={!canSelectTenantApplication(candidate)}
                    onCheckedChange={(checked) =>
                      onToggle(candidate.key, checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`tenant-application-${candidate.key}`}
                      className={`flex min-h-5 items-center justify-between gap-2 font-semibold text-xs sm:text-sm ${
                        canSelectTenantApplication(candidate)
                          ? "cursor-pointer text-foreground"
                          : "cursor-not-allowed text-muted-foreground"
                      }`}
                    >
                      <span className="truncate">{candidate.name}</span>
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {candidate.key}
                      </span>
                    </label>
                    <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                      {candidate.description ?? copy.noDescriptionFallback}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-xs font-medium">
                      <Badge tone="neutral">{candidate.commercialMode}</Badge>
                      {canSelectTenantApplication(candidate) ? (
                        <Badge tone="brand">
                          <CheckCircle2 className="size-3" /> {copy.readyBadge}
                        </Badge>
                      ) : (
                        <Badge tone="warn">{copy.unavailableBadge}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {!canSelectTenantApplication(candidate) ? (
                  <div className="mt-2.5 rounded-md border border-warning/30 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                    {unavailableReasons.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
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
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_8.5rem]">
                    <Field
                      id={`tenant-application-${candidate.key}-tier`}
                      label={copy.tierLabel}
                      hideLabel
                      required
                    >
                      {(field) => (
                      <Select
                        name={`applications.${candidate.key}.tierId`}
                        disabled={selection.addons.length > 0}
                        value={selection.tierId}
                        onValueChange={(value) =>
                          onUpdateSelection(candidate.key, { tierId: value })
                        }
                      >
                        <SelectTrigger id={field.id} size="sm">
                          <div className="flex items-center gap-2 truncate">
                            <Layers3 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <SelectValue placeholder={`${copy.tierLabel} *`} />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {candidate.tiers.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name} ({tier.key})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      )}
                    </Field>
                    <Field
                      id={`tenant-application-${candidate.key}-seats`}
                      label={copy.seatsLabel}
                      hideLabel
                      required
                    >
                      {(field) => (
                      <Input
                        {...field}
                        size="sm"
                        name={`applications.${candidate.key}.seats`}
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        value={selection.seats}
                        leading={<User className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                        placeholder={`${copy.seatsLabel} *`}
                        onChange={(event) =>
                          onUpdateSelection(candidate.key, {
                            seats: Number(event.target.value),
                          })
                        }
                      />
                      )}
                    </Field>
                  </div>
                ) : null}
                {selection && <TenantApplicationAddons candidate={candidate} selection={selection} onChange={patch => onUpdateSelection(candidate.key, patch)} />}
              </article>
            );
          })}
        </div>
      ) : null}

      {showSelectionError && selectedLines.length === 0 ? (
        <p
          id="tenant-applications-selection-error"
          className="flex items-center gap-2 text-xs font-semibold text-destructive-subtle-foreground"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="size-4" />
          {selectionError ?? copy.selectionRequiredError}
        </p>
      ) : null}
      </div>

      <section aria-labelledby="provisioning-preview-title" className="overflow-hidden rounded-md border border-border">
        <header className="flex items-start gap-2.5 bg-info-subtle px-3 py-2 text-info-subtle-foreground">
          <Route aria-hidden="true" className="mt-0.5 size-3.5" />
          <div>
            <h4 id="provisioning-preview-title" className="text-xs font-semibold">
              {copy.previewTitle}
            </h4>
            {copy.previewDesc ? (
              <p className="mt-0.5 text-xs opacity-80">
                {copy.previewDesc}
              </p>
            ) : null}
          </div>
        </header>
        <div className="p-3">
          {previewState === "idle" ? (
            <p className="text-xs text-muted-foreground">
              {copy.previewIdle}
            </p>
          ) : null}
          {previewState === "loading" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              {copy.previewLoading}
            </p>
          ) : null}
          {previewState === "error" ? (
            <ErrorState
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
            <div className="space-y-2.5">
              <dl className="grid grid-cols-3 gap-1.5 text-2xs">
                <div className="rounded-md bg-muted p-2">
                  <dt className="text-muted-foreground">{copy.selectedApplicationsLabel}</dt>
                  <dd className="mt-0.5 font-mono font-semibold">{preview.selectedApplicationKeys.join(", ")}</dd>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <dt className="text-muted-foreground">{copy.derivedComponentsLabel}</dt>
                  <dd className="mt-0.5 font-semibold">{preview.components.length}</dd>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <dt className="text-muted-foreground">{copy.executionStepsLabel}</dt>
                  <dd className="mt-0.5 font-semibold">{preview.steps.length}</dd>
                </div>
              </dl>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {preview.components.map((component) => (
                  <div
                    key={component.componentId}
                    className="rounded-md border border-border px-2 py-1.5 text-2xs leading-4"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="truncate font-mono font-semibold text-foreground">{component.componentKey}</p>
                      <span
                        className={`shrink-0 rounded-sm px-1 py-0.5 text-2xs font-semibold ${component.selectionSource === "FOUNDATION" ? "bg-info-subtle text-info-subtle-foreground" : "bg-muted text-muted-foreground"}`}
                        title={component.selectionSource}
                      >
                        {component.selectionSource.charAt(0)}
                        <span className="sr-only">{component.selectionSource.slice(1)}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-muted-foreground" title={`${component.ownerApp} · v${component.releaseVersion}`}>
                      {component.ownerApp} · v{component.releaseVersion}
                    </p>
                  </div>
                ))}
              </div>
              <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground" title={preview.selectionDigest}>
                <Layers3 className="size-3.5" /> {preview.selectionDigest.slice(0, 16)}…
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
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
    ? "border-border bg-muted text-foreground"
    : "border-warning/30 bg-warning-subtle text-warning-subtle-foreground";
  return (
    <div className={`flex items-start gap-2.5 rounded-md border p-3 ${classes}`} role={tone === "neutral" ? "status" : "alert"}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-4 opacity-90">{description}</p>
      </div>
    </div>
  );
}
