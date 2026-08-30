"use client";

import {
  AlertCircle,
  Database,
  HardDrive,
  Loader2,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  ErrorState,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TenantStoragePlacementOption } from "../../lib/storage-placement";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  TenantDatabasePlacementOption,
  TenantRegistrationLoadState,
} from "../types";

interface TenantInfrastructureStepProps {
  headingRef?: React.Ref<HTMLHeadingElement>;
  databaseOptions: readonly TenantDatabasePlacementOption[];
  databaseState: TenantRegistrationLoadState;
  databaseError: NormalizedApiError | null;
  selectedDatabase: TenantDatabasePlacementOption | null;
  selectedDatabaseId: string;
  showDatabaseSelectionError: boolean;
  databaseSelectionError?: string;
  onDatabaseChange: (id: string) => void;
  onRetryDatabase: () => void;
  storageOptions: readonly TenantStoragePlacementOption[];
  storageState: TenantRegistrationLoadState;
  storageError: NormalizedApiError | null;
  selectedStorage: TenantStoragePlacementOption | null;
  selectedStorageId: string;
  showStorageSelectionError: boolean;
  storageSelectionError?: string;
  onStorageChange: (id: string) => void;
  onRetryStorage: () => void;
}

export function TenantInfrastructureStep({
  headingRef,
  databaseOptions,
  databaseState,
  databaseError,
  selectedDatabase,
  selectedDatabaseId,
  showDatabaseSelectionError,
  databaseSelectionError,
  onDatabaseChange,
  onRetryDatabase,
  storageOptions,
  storageState,
  storageError,
  selectedStorage,
  selectedStorageId,
  showStorageSelectionError,
  storageSelectionError,
  onStorageChange,
  onRetryStorage,
}: TenantInfrastructureStepProps) {
  const { t } = useI18n();
  const copy = t.tenants.wizard.infrastructureStep;
  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-5">
      <header className="border-b border-border pb-4">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 rounded-sm text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Server aria-hidden="true" className="size-4 text-primary" />
          {copy.stepHeading}
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
          {copy.stepDescription}
        </p>
      </header>

      <PlacementSection
        icon={<Database className="size-4" />}
        title={copy.databaseServerTitle}
        description={copy.databaseServerDescription}
        state={databaseState}
        error={databaseError}
        onRetry={onRetryDatabase}
        idleText={copy.completeApplicationsFirst}
        emptyText={copy.noCompatibleDatabaseServer}
      >
        <Field
          id="tenant-database-server"
          label={copy.databaseServerTitle}
          required
          error={
            showDatabaseSelectionError && !selectedDatabase
              ? databaseSelectionError ?? copy.selectDatabaseServerError
              : undefined
          }
        >
          {(field) => (
            <Select
              name="databaseServerId"
              value={selectedDatabaseId}
              onValueChange={onDatabaseChange}
              required
            >
              <SelectTrigger
                id={field.id}
                aria-describedby={field["aria-describedby"]}
                aria-invalid={field["aria-invalid"]}
              >
                <SelectValue placeholder={copy.selectDatabaseServerPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {databaseOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} · {option.currentTenants}/{option.maxTenants} {copy.tenantsSuffix}
                    {option.countryIsoCode ? ` · ${option.countryIsoCode}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {selectedDatabase ? (
          <dl className="grid gap-3 rounded-lg border border-border bg-card p-3 text-xs sm:grid-cols-4">
            <Metric label={copy.nameLabel} value={selectedDatabase.name} />
            <Metric label={copy.statusLabel} value={selectedDatabase.status} />
            <Metric label={copy.capacityLabel} value={`${selectedDatabase.currentTenants}/${selectedDatabase.maxTenants}`} />
            <Metric label={copy.countryLabel} value={selectedDatabase.countryName ?? selectedDatabase.countryIsoCode ?? "—"} />
          </dl>
        ) : null}
      </PlacementSection>

      <PlacementSection
        icon={<HardDrive className="size-4" />}
        title={copy.storageServerTitle}
        description={copy.storageServerDescription}
        state={storageState}
        error={storageError}
        onRetry={onRetryStorage}
        emptyText={copy.noEligibleStorageServer}
      >
        <Field
          id="tenant-storage-server"
          label={copy.storageServerTitle}
          required
          error={
            showStorageSelectionError && !selectedStorage
              ? storageSelectionError ?? copy.selectStorageServerError
              : undefined
          }
        >
          {(field) => (
            <Select
              name="storageServerId"
              value={selectedStorageId}
              onValueChange={onStorageChange}
              required
            >
              <SelectTrigger
                id={field.id}
                aria-describedby={field["aria-describedby"]}
                aria-invalid={field["aria-invalid"]}
              >
                <SelectValue placeholder={copy.selectStorageServerPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {storageOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name} · {option.region} · {option.assignedTenants}
                    {option.maxTenants ? `/${option.maxTenants}` : ""} {copy.tenantsSuffix}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {selectedStorage ? (
          <dl className="grid gap-3 rounded-lg border border-border bg-card p-3 text-xs sm:grid-cols-4">
            <Metric label={copy.nameLabel} value={selectedStorage.name} />
            <Metric label={copy.regionLabel} value={selectedStorage.region} />
            <Metric
              label={copy.capacityLabel}
              value={`${selectedStorage.assignedTenants} / ${selectedStorage.maxTenants ?? "∞"}`}
            />
            <Metric label={copy.statusLabel} value={selectedStorage.status} />
          </dl>
        ) : null}
      </PlacementSection>
    </section>
  );
}

function PlacementSection({
  icon,
  title,
  description,
  state,
  error,
  onRetry,
  idleText,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: TenantRegistrationLoadState;
  error: NormalizedApiError | null;
  onRetry: () => void;
  idleText?: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const copy = t.tenants.wizard.infrastructureStep;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span> {title}
        </h4>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {state === "idle" ? <PlacementNotice tone="neutral" text={idleText ?? ""} /> : null}
      {state === "loading" ? (
        <PlacementNotice tone="neutral" text={copy.loadingTargets} loading />
      ) : null}
      {state === "forbidden" ? (
        <PlacementNotice tone="amber" text={copy.permissionRequired} />
      ) : null}
      {state === "error" ? (
        <ErrorState
          title={error?.message ?? copy.targetsLoadError}
          error={error ? { ...error, message: "" } : null}
          onRetry={onRetry}
        />
      ) : null}
      {state === "empty" ? <PlacementNotice tone="amber" text={emptyText} /> : null}
      {state === "ready" ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}

function PlacementNotice({ tone, text, loading = false }: { tone: "neutral" | "amber"; text: string; loading?: boolean }) {
  const classes = {
    neutral: "border-border bg-card text-muted-foreground",
    amber: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${classes}`} role={loading ? "status" : "alert"}>
      {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : tone === "amber" ? <AlertCircle className="size-4" /> : <ShieldCheck className="size-4" />}
      <span>{text}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-semibold text-foreground" title={value}>{value}</dd></div>;
}
