"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  ConfirmActionModal,
  Field,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
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
  FleetDatum,
  FleetFieldError,
  FleetHero,
  FleetMeta,
  FleetPageFrame,
  FleetStatePanel,
  FleetStatusBadge,
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
  const copyEn = getProvisioningFleetCopy("en");
  const copyAr = getProvisioningFleetCopy("ar");
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
        <Card className="space-y-4 p-5">
          <header>
            <h2 className="text-xl font-semibold text-foreground">{copy.directory}</h2>
          </header>
          <FleetStatePanel
            state={view.authLoading ? "LOADING" : view.rollouts.state}
            error={view.rollouts.error}
            copy={copy}
            onRetry={view.refresh}
          />
          {view.rollouts.state === "EMPTY" ? (
            <p className="rounded-lg bg-muted p-5 text-center text-sm text-muted-foreground">
              {copy.emptyRollouts}
            </p>
          ) : null}
          {view.rollouts.data?.data.map((rollout) => (
            <Card key={rollout.rolloutId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {copy.operation[rollout.operationType]}
                  </p>
                  <code dir="ltr" className="mt-1 block break-all text-start text-xs text-muted-foreground">
                    {rollout.rolloutId}
                  </code>
                </div>
                <FleetStatusBadge status={rollout.status} label={copy.rolloutStatus[rollout.status]} />
              </div>
              <dl className="mt-4 grid gap-2 sm:grid-cols-4">
                <FleetDatum label={copy.total} value={rollout.totalCount} />
                <FleetDatum label={copy.completed} value={rollout.completedCount} />
                <FleetDatum label={copy.failed} value={rollout.failedCount} />
                <FleetDatum label={copy.revision} value={rollout.revision} />
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{formatInstant(rollout.createdAt, lang)}</span>
                <Button asChild variant="primary" size="sm">
                  <Link href={`/provisioning/fleet/rollouts/${rollout.rolloutId}`}>
                    {copy.open}
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
          {view.rollouts.data ? (
            <FleetMeta result={view.rollouts.data} copy={copy} lang={lang} />
          ) : null}
        </Card>

        <Card className="h-fit">
          <form aria-label={copy.lookupPreview} onSubmit={openLookup}>
            <CardContent className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{copy.lookupPreview}</h2>
              <Field label={copy.previewId} error={lookupError ? FleetFieldErrorText(lookupError, copy) : undefined}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    dir="ltr"
                    value={lookupId}
                    onChange={(event) => setLookupId(event.target.value)}
                    className="font-mono text-xs"
                  />
                )}
              </Field>
              <Button type="submit" variant="primary">
                {copy.openPreview}
              </Button>
            </CardContent>
          </form>
        </Card>
      </section>

      <Card className="p-5">
        <header>
          <h2 className="text-xl font-semibold text-foreground">{copy.previewBuilder}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {copy.previewBuilderHint}
          </p>
        </header>
        {view.authLoading ? (
          <FleetStatePanel state="LOADING" error={null} copy={copy} />
        ) : !view.permissions.canCreatePreview ? (
          <p role="note" className="mt-4 rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm font-semibold text-warning-subtle-foreground">
            {copy.forbiddenPreviewCreate}
          </p>
        ) : (
          <form onSubmit={submitPreview} noValidate className="mt-5 space-y-6">
            <fieldset disabled={pending} className="space-y-4">
              <legend className="sr-only">{copy.previewBuilder}</legend>
              <Field label={copy.operationType}>
                {(fieldProps) => (
                  <Select
                    value={draft.operationType}
                    onValueChange={(value) =>
                      changeOperation(value as FleetOperationType, draft, setDraft)
                    }
                  >
                    <SelectTrigger id={fieldProps.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(copy.operation).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              {draft.operationType === "ADD_APPLICATION" ? (
                <TextField label={copy.applicationKey} value={draft.applicationKey} error={errors.applicationKey} copy={copy} onChange={(applicationKey) => setDraft((current) => ({ ...current, applicationKey }))} />
              ) : null}
              {draft.operationType === "DECOMMISSION" ? (
                <div className="space-y-3">
                  <TextField label={copy.componentKey} value={draft.componentKey} error={errors.componentKey} copy={copy} onChange={(componentKey) => setDraft((current) => ({ ...current, componentKey }))} />
                  <CheckField id="fleet-retention" label={copy.retentionAcknowledged} checked={draft.retentionAcknowledged} error={errors.retentionAcknowledged} copy={copy} onChange={(retentionAcknowledged) => setDraft((current) => ({ ...current, retentionAcknowledged }))} />
                </div>
              ) : (
                <TargetEditor draft={draft} setDraft={setDraft} errors={errors} copy={copy} />
              )}

              <fieldset className="space-y-4 rounded-lg border border-border p-4">
                <legend className="px-2 text-sm font-semibold text-foreground">{copy.selection}</legend>
                <RadioGroup
                  value={draft.broadSelection ? "broad" : "explicit"}
                  onValueChange={(value) =>
                    setDraft((current) =>
                      value === "broad"
                        ? { ...current, broadSelection: true, tenantIdsText: "" }
                        : {
                            ...current,
                            broadSelection: false,
                            allEligibleTenantsAcknowledged: false,
                          },
                    )
                  }
                  className="flex flex-wrap gap-4"
                >
                  <RadioField id="fleet-explicit" value="explicit" label={copy.explicitSelection} />
                  <RadioField id="fleet-broad" value="broad" label={copy.broadSelection} />
                </RadioGroup>
                {draft.broadSelection ? (
                  <CheckField id="fleet-broad-ack" label={copy.broadAcknowledge} checked={draft.allEligibleTenantsAcknowledged} error={errors.allEligibleTenantsAcknowledged} copy={copy} onChange={(allEligibleTenantsAcknowledged) => setDraft((current) => ({ ...current, allEligibleTenantsAcknowledged }))} />
                ) : (
                  <Field label={copy.tenantIds} hint={copy.tenantIdsHint} error={errors.tenantIds ? FleetFieldErrorText(errors.tenantIds, copy) : undefined}>
                    {(fieldProps) => (
                      <Textarea
                        {...fieldProps}
                        dir="ltr"
                        spellCheck={false}
                        rows={5}
                        value={draft.tenantIdsText}
                        onChange={(event) => setDraft((current) => ({ ...current, tenantIdsText: event.target.value }))}
                        className="font-mono text-xs"
                      />
                    )}
                  </Field>
                )}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-foreground">{copy.tenantStatuses}</legend>
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
                  <Button asChild variant="primary" size="sm" className="mt-3">
                    <Link href={`/provisioning/fleet/previews/${view.previewCommand.result.data.previewId}`}>
                      {copy.openPreview}
                    </Link>
                  </Button>
                ) : null
              }
            />
            <Button type="submit" variant="primary" disabled={pending} loading={pending}>
              {pending ? copy.creatingPreview : copy.createPreview}
            </Button>
          </form>
        )}
      </Card>

      <ConfirmActionModal
        isOpen={pendingCommand !== null}
        titleEn={copyEn.confirmPreviewTitle}
        titleAr={copyAr.confirmPreviewTitle}
        descriptionEn={copyEn.confirmPreviewBody}
        descriptionAr={copyAr.confirmPreviewBody}
        confirmTextEn={copyEn.confirm}
        confirmTextAr={copyAr.confirm}
        isLoading={pending}
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
    <fieldset className="space-y-4 rounded-lg border border-border p-4">
      <legend className="px-2 text-sm font-semibold text-foreground">{copy.targets}</legend>
      <p className="text-xs text-muted-foreground">{copy.currentFenceHint}</p>
      <FleetFieldError id="fleet-targets-error" code={errors.targets} copy={copy} />
      {draft.targets.map((target, index) => (
        <Card key={index} className="space-y-3 bg-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{copy.targetNumber} {index + 1}</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.targets.length === 1 && draft.operationType === "REPAIR"}
              onClick={() => setDraft((current) => ({ ...current, targets: current.targets.filter((_, targetIndex) => targetIndex !== index) }))}
            >
              <Trash2 className="size-4" aria-hidden="true" />{copy.removeTarget}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => {
              const error = errors[`targets.${index}.${field.key}`];
              return <TextField key={field.key} label={field.label} value={target[field.key]} error={error} copy={copy} mono={field.key !== "targetReleaseVersion" && field.key !== "componentKey"} onChange={(value) => setDraft((current) => ({ ...current, targets: current.targets.map((item, targetIndex) => targetIndex === index ? { ...item, [field.key]: value } : item) }))} />;
            })}
          </div>
          <FleetFieldError id={`fleet-target-${index}-pair-error`} code={errors[`targets.${index}.currentPair`]} copy={copy} />
        </Card>
      ))}
      {draft.operationType !== "REPAIR" && draft.targets.length < 100 ? (
        <Button type="button" variant="outline" onClick={() => setDraft((current) => ({ ...current, targets: [...current.targets, emptyTargetDraft()] }))}>
          <Plus className="size-4" aria-hidden="true" />{copy.addTarget}
        </Button>
      ) : null}
    </fieldset>
  );
}

function TextField({ label, value, error, copy, onChange, mono }: { label: string; value: string; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (value: string) => void; mono?: boolean }) {
  return (
    <Field label={label} error={error ? FleetFieldErrorText(error, copy) : undefined}>
      {(fieldProps) => (
        <Input
          {...fieldProps}
          dir={mono ? "ltr" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={mono ? "text-start font-mono text-xs" : undefined}
        />
      )}
    </Field>
  );
}

function CheckField({ id, label, checked, error, copy, onChange }: { id: string; label: string; checked: boolean; error?: string; copy: ReturnType<typeof getProvisioningFleetCopy>; onChange: (checked: boolean) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-start gap-3 text-sm font-semibold text-foreground">
        <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="mt-0.5" />
        <span>{label}</span>
      </label>
      <FleetFieldError id={`${id}-error`} code={error} copy={copy} />
    </div>
  );
}

function RadioField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <RadioGroupItem id={id} value={value} />
      <span>{label}</span>
    </label>
  );
}

function FleetFieldErrorText(code: string, copy: ReturnType<typeof getProvisioningFleetCopy>): string {
  return copy.validation[code as keyof typeof copy.validation] ?? copy.validationFailed;
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
