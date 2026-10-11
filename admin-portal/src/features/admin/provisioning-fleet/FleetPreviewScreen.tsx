"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Button,
  Card,
  ConfirmActionModal,
  DataTable,
  Field,
  Input,
  type ColumnDef,
} from "@/design-system";
import { buildRolloutCommand, initialRolloutDraft } from "./contracts";
import { getProvisioningFleetCopy } from "./copy";
import { useFleetPreview } from "./hooks";
import {
  FleetBackLink,
  FleetCommandNotice,
  FleetDatum,
  FleetFieldError,
  FleetHero,
  FleetMeta,
  FleetPageFrame,
  FleetSafeReason,
  FleetStatePanel,
  FleetStatusBadge,
  RefreshButton,
  formatInstant,
} from "./shared";
import type {
  CreateFleetRolloutCommand,
  FieldErrors,
  FleetMovedComponent,
  FleetPreview,
  FleetPreviewTenant,
  FleetRolloutDraft,
} from "./types";

export function FleetPreviewScreen({ previewId }: { previewId: string }) {
  const { lang, dir } = useI18n();
  const copy = getProvisioningFleetCopy(lang);
  const copyEn = getProvisioningFleetCopy("en");
  const copyAr = getProvisioningFleetCopy("ar");
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

  const tenantColumns: ColumnDef<FleetPreviewTenant>[] = [
    {
      key: "tenantId",
      headerEn: "Tenant",
      headerAr: "المستأجر",
      cell: (tenant) => <span dir="ltr" className="text-start font-mono text-xs">{tenant.tenantId}</span>,
    },
    {
      key: "eligible",
      headerEn: copy.eligible,
      headerAr: copy.eligible,
      cell: (tenant) => <FleetStatusBadge status={tenant.eligible ? "ELIGIBLE" : "INELIGIBLE"} label={tenant.eligible ? copy.yes : copy.no} />,
    },
    {
      key: "rank",
      headerEn: copy.rank,
      headerAr: copy.rank,
      cell: (tenant) => tenant.deterministicRank,
    },
    // Only an UPDATE plan grows past its targets; every other operation's
    // rows carry no moves, so the column would only repeat "none".
    ...(preview?.operationType === "UPDATE"
      ? [{
          key: "movedComponents",
          headerEn: copy.movedComponents,
          headerAr: copy.movedComponents,
          cell: (tenant: FleetPreviewTenant) => <MovedComponents moves={tenant.movedComponents} copy={copy} />,
        }]
      : []),
    {
      key: "safeReason",
      headerEn: copy.safeReason,
      headerAr: copy.safeReason,
      cell: (tenant) => <FleetSafeReason code={tenant.safeReasonCode} copy={copy} />,
    },
    {
      key: "digest",
      headerEn: copy.eligibilityDigest,
      headerAr: copy.eligibilityDigest,
      cell: (tenant) => <span dir="ltr" className="text-start font-mono text-xs">{tenant.eligibilityDigest}</span>,
    },
  ];

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
          <PreviewSummary preview={preview} copy={copy} lang={lang} />
          {view.preview.data ? (
            <Card className="p-3 sm:p-3.5">
              <FleetMeta result={view.preview.data} copy={copy} lang={lang} />
            </Card>
          ) : null}
          <PreviewTargets preview={preview} copy={copy} />

          <Card className="space-y-3 p-3 sm:p-3.5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">{copy.tenantEvidence}</h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {copy.total}: {view.tenants.data?.total ?? 0}
              </span>
            </header>
            {preview.operationType === "UPDATE" ? (
              <p className="text-xs leading-5 text-muted-foreground">{copy.movedComponentsHint}</p>
            ) : null}
            <FleetStatePanel
              state={view.tenants.state}
              error={view.tenants.error}
              copy={copy}
              invalid={view.routeValid ? copy.contractError : copy.invalidRouteId}
              onRetry={view.refresh}
            />
            {view.tenants.state === "EMPTY" ? (
              <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
                {copy.emptyTenants}
              </p>
            ) : null}
            {view.tenants.data?.items.length ? (
              <DataTable
                labelEn="Fleet preview tenant evidence"
                labelAr="أدلة مستأجري معاينة الأسطول"
                columns={tenantColumns}
                data={view.tenants.data.items}
                isRefreshing={view.tenants.isRefreshing}
                getRowId={(row) => row.tenantId}
                pagination={{
                  page: view.tenants.data.page,
                  limit: view.tenants.data.limit,
                  totalItems: view.tenants.data.total,
                  totalPages: view.tenants.data.totalPages,
                  onPageChange: view.setPage,
                }}
              />
            ) : null}
            {view.tenants.data ? <FleetMeta result={view.tenants.data} copy={copy} lang={lang} /> : null}
          </Card>

          <Card className="space-y-3 border-destructive/30 p-3 sm:p-3.5">
            <header>
              <h2 className="text-lg font-semibold text-foreground">{copy.launchRollout}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.launchHint}</p>
            </header>
            {!view.permissions.canCreateRollout ? (
              <p role="note" className="rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs font-semibold text-warning-subtle-foreground">
                {copy.forbiddenRolloutCreate}
              </p>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField label={copy.canarySize} value={draft.canarySize} error={errors.canarySize} copy={copy} onChange={(canarySize) => setDraft((current) => ({ ...current, canarySize }))} />
                  <NumberField label={copy.batchSize} value={draft.batchSize} error={errors.batchSize} copy={copy} onChange={(batchSize) => setDraft((current) => ({ ...current, batchSize }))} />
                  <NumberField label={copy.maxParallel} value={draft.maxParallel} error={errors.maxParallel} copy={copy} onChange={(maxParallel) => setDraft((current) => ({ ...current, maxParallel }))} />
                  <NumberField label={copy.failureThreshold} value={draft.failureThreshold} error={errors.failureThreshold} copy={copy} onChange={(failureThreshold) => setDraft((current) => ({ ...current, failureThreshold }))} />
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
                      <Button asChild variant="primary" size="sm" className="mt-3">
                        <Link href={`/provisioning/fleet/rollouts/${view.rolloutCommand.result.data.rolloutId}`}>
                          {copy.open}
                        </Link>
                      </Button>
                    ) : null
                  }
                />
                <Button type="submit" variant="destructive" size="sm" disabled={pending} loading={pending}>
                  {pending ? copy.launching : copy.launch}
                </Button>
              </form>
            )}
          </Card>
        </>
      ) : null}

      <ConfirmActionModal
        isOpen={pendingCommand !== null}
        titleEn={copyEn.confirmLaunchTitle}
        titleAr={copyAr.confirmLaunchTitle}
        descriptionEn={copyEn.confirmLaunchBody}
        descriptionAr={copyAr.confirmLaunchBody}
        confirmTextEn={copyEn.confirm}
        confirmTextAr={copyAr.confirm}
        isLoading={pending}
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

function PreviewSummary({ preview, copy, lang }: { preview: FleetPreview; copy: ReturnType<typeof getProvisioningFleetCopy>; lang: "ar" | "en" }) {
  return (
    <Card className="space-y-3 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{copy.previewDetail}</h2>
          <code dir="ltr" className="mt-1 block break-all text-start text-xs text-muted-foreground">{preview.previewId}</code>
        </div>
        <Badge tone="neutral">{copy.operation[preview.operationType]}</Badge>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FleetDatum label={copy.eligible} value={preview.eligibleCount} />
        <FleetDatum label={copy.ineligible} value={preview.ineligibleCount} />
        <FleetDatum label={copy.createdAt} value={formatInstant(preview.createdAt, lang)} />
        <FleetDatum label={copy.expiresAt} value={formatInstant(preview.expiresAt, lang)} />
        <FleetDatum label={copy.targetSelectionDigest} value={preview.targetSelectionDigest} mono />
        <FleetDatum label={copy.selectionDigest} value={preview.selectionDigest} mono />
        <FleetDatum label={copy.operationCommand} value={JSON.stringify(preview.operationCommand)} mono />
        <FleetDatum label={copy.selection} value={JSON.stringify(preview.selectionFilter)} mono />
      </dl>
    </Card>
  );
}

function PreviewTargets({ preview, copy }: { preview: FleetPreview; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  return (
    <Card className="space-y-3 p-3 sm:p-3.5">
      <h2 className="text-lg font-semibold text-foreground">{copy.targets}</h2>
      {preview.targetSelection.length ? preview.targetSelection.map((target) => (
        <dl key={target.componentKey} className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-2 lg:grid-cols-4">
          <FleetDatum label={copy.componentKey} value={target.componentKey} mono />
          <FleetDatum label={copy.componentId} value={target.componentId} mono />
          <FleetDatum label={copy.targetReleaseId} value={target.targetReleaseId} mono />
          <FleetDatum label={copy.targetReleaseVersion} value={target.targetReleaseVersion} mono />
          <FleetDatum label={copy.targetManifestChecksum} value={target.targetManifestChecksum} mono />
          <FleetDatum label={copy.expectedCurrentReleaseId} value={target.expectedCurrentReleaseId ?? copy.none} mono />
          <FleetDatum label={copy.expectedCurrentManifestChecksum} value={target.expectedCurrentManifestChecksum ?? copy.none} mono />
        </dl>
      )) : <p className="text-xs text-muted-foreground">{copy.none}</p>}
    </Card>
  );
}

/**
 * What an eligible UPDATE row's plan moves, each as `componentKey from → to`.
 * A component the update pulled in because it was behind, rather than one the
 * operator selected, is labelled so; the label is text, not colour alone.
 */
function MovedComponents({ moves, copy }: { moves: FleetMovedComponent[] | null; copy: ReturnType<typeof getProvisioningFleetCopy> }) {
  if (!moves?.length) return <span dir="ltr" className="text-start font-mono text-xs">{copy.none}</span>;
  return (
    <ul className="space-y-1">
      {moves.map((move) => (
        <li key={move.componentKey} className="flex flex-wrap items-center gap-1.5">
          <span dir="ltr" className="text-start font-mono text-xs">
            {move.componentKey} {move.fromReleaseVersion}{" "}
            <span aria-hidden="true">→</span>
            <span className="sr-only">{copy.movesTo}</span>{" "}
            {move.toReleaseVersion}
          </span>
          {move.requested ? null : (
            <Badge tone="warn" className="whitespace-nowrap">{copy.pulledIn}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function NumberField({ label, value, error, copy, onChange }: { label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (value: string) => void }) {
  return (
    <Field label={label} hideLabel error={error ? (copy.validation[error as keyof typeof copy.validation] ?? copy.validationFailed) : undefined}>
      {(fieldProps) => (
        <Input {...fieldProps} size="sm" placeholder={`${label} *`} type="number" min={1} step={1} inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}
