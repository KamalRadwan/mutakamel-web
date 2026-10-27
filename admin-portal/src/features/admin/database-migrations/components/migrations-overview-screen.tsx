"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, PlayCircle, ServerCog } from "lucide-react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHeader as DsTableHeader,
  TableRow,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useMigrationsOverview } from "../hooks/use-migrations-overview";
import { isProjectionDegraded } from "../model/migration-errors";
import { missingExecutePermissions } from "../model/migration-permissions";
import { readFleetHealth } from "../model/migration-outcomes";
import {
  MIGRATION_APPLICATION_KEYS,
  TENANT_SCHEMA_VERSION_STATES,
  type FleetStatus,
  type MigrationRun,
  type StartMigrationRunDto,
  type TenantSchemaVersion,
  type TenantSchemaVersionState,
} from "../types/database-migrations";
import { StartMigrationDialog } from "./start-migration-dialog";
import {
  formatMigrationDate,
  MIGRATIONS_COPY,
  MigrationMutationNotice,
  MigrationPager,
  MigrationsHero,
  MigrationsPageFrame,
  MigrationsStatePanel,
  ReadOnlyNotice,
  RefreshMigrationsButton,
  RunModeChip,
  RunProgressBar,
  RunStatusChip,
  SchemaStateChip,
  TableHeader,
  migrationLabelClass,
  schemaStateLabel,
  type MigrationsCopy,
} from "./migrations-shared";

export function MigrationsOverviewScreen() {
  const { lang, dir } = useI18n();
  const copy = MIGRATIONS_COPY[lang];
  const overview = useMigrationsOverview();
  const [startOpen, setStartOpen] = useState(false);
  const [startTenantId, setStartTenantId] = useState<string | undefined>();

  const openFleetStart = () => {
    setStartTenantId(undefined);
    overview.resetMutation();
    setStartOpen(true);
  };
  const openTenantStart = (tenantId: string) => {
    setStartTenantId(tenantId);
    overview.resetMutation();
    setStartOpen(true);
  };
  const submitStart = (dto: StartMigrationRunDto) => {
    void overview.startRun(dto).then((run) => {
      if (run) setStartOpen(false);
    });
  };

  return (
    <MigrationsPageFrame dir={dir}>
      <MigrationsHero
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            <RefreshMigrationsButton
              label={copy.refresh}
              onClick={overview.refresh}
              pending={overview.isRefreshing}
            />
            {overview.permissions.canExecute ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openFleetStart}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-2.5 text-xs font-semibold text-primary"
              >
                <PlayCircle className="size-3.5" aria-hidden="true" />
                {copy.startRun}
              </Button>
            ) : null}
          </div>
        }
      />

      <OverviewBody
        overview={overview}
        copy={copy}
        lang={lang}
        onMigrateTenant={openTenantStart}
      />

      {/* Remounted per intent so the form never inherits a previous scope. */}
      {startOpen ? (
        <StartMigrationDialog
          key={startTenantId ?? "fleet"}
          open
          copy={copy}
          isSubmitting={overview.mutation.phase === "PENDING"}
          mutation={overview.mutation}
          fleet={overview.fleet}
          defaultApplicationKey={overview.applicationKey || undefined}
          defaultTenantId={startTenantId}
          defaultScope={startTenantId ? "SINGLE_TENANT" : "FLEET"}
          onClose={() => setStartOpen(false)}
          onStart={submitStart}
        />
      ) : null}
    </MigrationsPageFrame>
  );
}

function OverviewBody({
  overview,
  copy,
  lang,
  onMigrateTenant,
}: {
  overview: ReturnType<typeof useMigrationsOverview>;
  copy: MigrationsCopy;
  lang: "ar" | "en";
  onMigrateTenant: (tenantId: string) => void;
}) {
  if (overview.state === "LOADING") {
    return <MigrationsStatePanel kind="loading" title={copy.loading} copy={copy} />;
  }
  if (overview.state === "FORBIDDEN") {
    return (
      <MigrationsStatePanel
        kind="forbidden"
        title={copy.forbidden}
        detail={copy.readPermission}
        copy={copy}
      />
    );
  }
  if (overview.state === "UNAVAILABLE") {
    return (
      <MigrationsStatePanel
        kind="unavailable"
        title={copy.unavailable}
        detail={overview.error?.message}
        correlationId={overview.error?.correlationId}
        copy={copy}
        action={
          <RefreshMigrationsButton label={copy.retry} onClick={overview.refresh} />
        }
      />
    );
  }
  if (overview.state === "ERROR" || overview.state === "NOT_FOUND") {
    return (
      <MigrationsStatePanel
        kind="error"
        title={copy.error}
        detail={overview.error?.message}
        correlationId={overview.error?.correlationId}
        copy={copy}
        action={
          <RefreshMigrationsButton label={copy.retry} onClick={overview.refresh} />
        }
      />
    );
  }

  const missing = missingExecutePermissions(overview.permissions);

  return (
    <div className="space-y-4" aria-busy={overview.isRefreshing}>
      <ReadOnlyNotice missing={missing} copy={copy} />
      <MigrationMutationNotice mutation={overview.mutation} copy={copy} />
      <AlarmBanner fleet={overview.fleet} copy={copy} />

      {overview.projectionError ? (
        <section
          role="status"
          className="rounded-lg border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-subtle-foreground"
        >
          <h2 className="font-semibold">{copy.projectionDegradedTitle}</h2>
          <p className="mt-1 leading-6">{copy.projectionDegradedBody}</p>
          {!isProjectionDegraded(overview.projectionError) ? (
            <p className="mt-1">{overview.projectionError.message}</p>
          ) : null}
          <code dir="ltr" className="mt-2 block break-all font-mono text-xs">
            {overview.projectionError.errorCode}
          </code>
          {overview.projectionError.correlationId ? (
            <p className="mt-1 text-xs">
              <strong>{copy.correlation}:</strong>{" "}
              <code dir="ltr">{overview.projectionError.correlationId}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      <FleetSection fleet={overview.fleet} copy={copy} />

      <FilterBar overview={overview} copy={copy} />

      {overview.tenants ? (
        <TenantTable
          tenants={overview.tenants.items}
          copy={copy}
          lang={lang}
          canExecute={overview.permissions.canExecute}
          onMigrateTenant={onMigrateTenant}
          pager={
            <MigrationPager
              page={overview.page}
              pageSize={overview.pageSize}
              total={overview.tenants.meta.total}
              onPageChange={overview.setPage}
              lang={lang}
            />
          }
        />
      ) : null}

      <RunTable runs={overview.runs} copy={copy} lang={lang} />
    </div>
  );
}

/**
 * `DRIFTED` and `RESTORE_INCOMPLETE` describe a database nobody has explained.
 * They are raised here, above the fleet, rather than left to be spotted as one
 * row colour among seven.
 */
function AlarmBanner({
  fleet,
  copy,
}: {
  fleet: FleetStatus[] | null;
  copy: MigrationsCopy;
}) {
  if (!fleet) return null;
  const affected = fleet
    .map((entry) => ({
      applicationKey: entry.applicationKey,
      drifted: entry.counts.drifted,
      restoreIncomplete: entry.counts.restoreIncomplete,
    }))
    .filter((entry) => entry.drifted > 0 || entry.restoreIncomplete > 0);
  if (affected.length === 0) return null;

  return (
    <section
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive-subtle p-3 sm:p-3.5 text-destructive-subtle-foreground"
    >
      <div className="flex items-start gap-2.5">
        <AlertOctagon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{copy.alarmTitle}</h2>
          <p className="mt-0.5 text-xs leading-5">{copy.alarmBody}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {affected.map((entry) => (
              <li
                key={entry.applicationKey}
                className="rounded-xl border border-destructive/40 bg-card/70 px-3 py-2 text-xs font-semibold"
              >
                <code dir="ltr" className="font-mono">
                  {entry.applicationKey}
                </code>
                {entry.drifted > 0 ? (
                  <span className="ms-2">
                    {entry.drifted} {copy.alarmDrifted}{" "}
                    <code dir="ltr" className="font-mono opacity-70">
                      DRIFTED
                    </code>
                  </span>
                ) : null}
                {entry.restoreIncomplete > 0 ? (
                  <span className="ms-2">
                    {entry.restoreIncomplete} {copy.alarmRestoreIncomplete}{" "}
                    <code dir="ltr" className="font-mono opacity-70">
                      RESTORE_INCOMPLETE
                    </code>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FleetSection({
  fleet,
  copy,
}: {
  fleet: FleetStatus[] | null;
  copy: MigrationsCopy;
}) {
  if (!fleet) return null;
  if (fleet.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">
          {copy.fleetTitle}
        </h2>
        <p className="mt-2">{copy.noFleet}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{copy.fleetTitle}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.fleetHelp}</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {fleet.map((entry) => (
          <FleetCard key={entry.applicationKey} entry={entry} copy={copy} />
        ))}
      </div>
    </section>
  );
}

function FleetCard({
  entry,
  copy,
}: {
  entry: FleetStatus;
  copy: MigrationsCopy;
}) {
  const health = readFleetHealth(
    entry.counts,
    entry.versionDistribution.length,
  );
  const counters: Array<{ state: TenantSchemaVersionState; value: number }> = [
    { state: "UP_TO_DATE", value: entry.counts.upToDate },
    { state: "PENDING", value: entry.counts.pending },
    { state: "RUNNING", value: entry.counts.running },
    { state: "FAILED", value: entry.counts.failed },
    { state: "BLOCKED", value: entry.counts.blocked },
    { state: "RESTORE_INCOMPLETE", value: entry.counts.restoreIncomplete },
    { state: "DRIFTED", value: entry.counts.drifted },
  ];

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ServerCog className="size-5 text-primary" aria-hidden="true" />
          <h3 className="font-semibold">
            <code dir="ltr" className="font-mono">
              {entry.applicationKey}
            </code>
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {copy.availableVersion}:{" "}
          <code dir="ltr" className="font-mono font-semibold">
            {entry.availableVersion || copy.none}
          </code>
        </p>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-2">
          <dt className="text-xs font-semibold uppercase text-muted-foreground">
            {copy.tenantsTotal}
          </dt>
          <dd className="font-mono text-lg font-semibold">{health.total}</dd>
        </div>
        <div className="rounded-xl border border-border p-2">
          <dt className="text-xs font-semibold uppercase text-muted-foreground">
            {copy.behind}
          </dt>
          <dd className="font-mono text-lg font-semibold">{health.behind}</dd>
        </div>
        {counters
          .filter((counter) => counter.value > 0)
          .map((counter) => (
            <div
              key={counter.state}
              className="rounded-xl border border-border p-2"
            >
              <dt className="text-xs font-semibold uppercase text-muted-foreground">
                {schemaStateLabel(counter.state, copy)}{" "}
                <code dir="ltr" className="font-mono normal-case">
                  {counter.state}
                </code>
              </dt>
              <dd className="font-mono text-lg font-semibold">{counter.value}</dd>
            </div>
          ))}
      </dl>

      {entry.activeRun ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">{copy.activeRun}:</span>
          <RunStatusChip status={entry.activeRun.status} copy={copy} />
          <Link
            href={`/database-migrations/runs/${entry.activeRun.runId}`}
            className="font-mono font-semibold text-primary underline"
          >
            {entry.activeRun.runId}
          </Link>
          <span className="font-mono">{entry.activeRun.progressPct}%</span>
        </p>
      ) : null}

      <section className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.distribution}
        </h4>
        {health.fragmented ? (
          <p className="mt-1 rounded-xl border border-warning/30 bg-warning-subtle px-3 py-2 text-xs leading-5 text-warning-subtle-foreground">
            <strong>{copy.fragmentedTitle}.</strong> {copy.fragmentedBody}
          </p>
        ) : null}
        <Table className="mt-2 w-full text-xs">
          <TableCaption className="sr-only">{copy.distribution}</TableCaption>
          <DsTableHeader className="text-xs font-semibold uppercase text-muted-foreground">
            <TableRow>
              <TableHeader>{copy.schemaVersion}</TableHeader>
              <TableHeader align="end">{copy.tenantCount}</TableHeader>
            </TableRow>
          </DsTableHeader>
          <TableBody>
            {entry.versionDistribution.map((slice) => (
              <TableRow
                key={slice.schemaVersion}
                className="border-t border-border"
              >
                <TableCell dir="ltr" className="px-4 py-2 text-start font-mono">
                  {slice.schemaVersion}
                </TableCell>
                <TableCell className="px-4 py-2 text-end font-mono font-semibold">
                  {slice.tenantCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </article>
  );
}

function FilterBar({
  overview,
  copy,
}: {
  overview: ReturnType<typeof useMigrationsOverview>;
  copy: MigrationsCopy;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 sm:p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="block">
          <span className={migrationLabelClass}>{copy.filterApplication}</span>
          <Select
            value={overview.applicationKey || "__all__"}
            onValueChange={(value) =>
              overview.setApplicationKey(value === "__all__" ? "" : value)
            }
          >
            <SelectTrigger size="sm" aria-label={copy.filterApplication}>
              <SelectValue placeholder={copy.allApplications} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{copy.allApplications}</SelectItem>
              {MIGRATION_APPLICATION_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="block">
          <span className={migrationLabelClass}>{copy.filterState}</span>
          <Select
            value={overview.schemaState || "__all__"}
            onValueChange={(value) =>
              overview.setSchemaState(
                value === "__all__" ? "" : (value as TenantSchemaVersionState),
              )
            }
          >
            <SelectTrigger size="sm" aria-label={copy.filterState}>
              <SelectValue placeholder={copy.allStates} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{copy.allStates}</SelectItem>
              {TENANT_SCHEMA_VERSION_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {`${schemaStateLabel(state, copy)} · ${state}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

function TenantTable({
  tenants,
  copy,
  lang,
  canExecute,
  onMigrateTenant,
  pager,
}: {
  tenants: TenantSchemaVersion[];
  copy: MigrationsCopy;
  lang: "ar" | "en";
  canExecute: boolean;
  onMigrateTenant: (tenantId: string) => void;
  pager: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="px-4 py-3">
        <h2 className="font-semibold">{copy.tenantsTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.tenantsHelp}</p>
      </header>
      {tenants.length === 0 ? (
        <p className="border-t border-border p-5 text-sm text-muted-foreground">
          {copy.noTenants}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[900px] text-sm">
              <TableCaption className="sr-only">{copy.tenantsTitle}</TableCaption>
              <DsTableHeader className="bg-muted text-xs font-semibold uppercase text-muted-foreground">
                <TableRow>
                  <TableHeader>{copy.tenant}</TableHeader>
                  <TableHeader>{copy.application}</TableHeader>
                  <TableHeader>{copy.state}</TableHeader>
                  <TableHeader>{copy.version}</TableHeader>
                  <TableHeader>{copy.observedAt}</TableHeader>
                  <TableHeader align="end">{copy.migrateTenant}</TableHeader>
                </TableRow>
              </DsTableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow
                    key={`${tenant.tenantId}:${tenant.applicationKey}`}
                    className="border-t border-border align-top"
                  >
                    <TableCell className="px-3 py-2 text-start">
                      <p className="font-semibold text-xs">
                        {tenant.tenantName ?? tenant.tenantId}
                      </p>
                      <code
                        dir="ltr"
                        className="mt-0.5 block font-mono text-xs text-muted-foreground"
                      >
                        {tenant.tenantId}
                      </code>
                    </TableCell>
                    <TableCell dir="ltr" className="px-3 py-2 text-start font-mono text-xs">
                      {tenant.applicationKey}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-start">
                      <SchemaStateChip state={tenant.state} copy={copy} />
                      {tenant.driftDetail ? (
                        <p className="mt-1.5 max-w-sm text-xs leading-5 text-destructive">
                          <strong>{copy.driftDetail}:</strong>{" "}
                          <span dir="ltr" className="font-mono break-all">
                            {tenant.driftDetail}
                          </span>
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell dir="ltr" className="px-3 py-2 text-start font-mono text-xs">
                      {tenant.schemaVersion || copy.none}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-start text-xs text-muted-foreground">
                      {formatMigrationDate(tenant.observedAt, lang)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-end">
                      {canExecute ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onMigrateTenant(tenant.tenantId)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/40 px-2.5 text-xs font-semibold text-primary"
                        >
                          <PlayCircle className="size-3.5" aria-hidden="true" />
                          {copy.migrateTenant}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">{copy.none}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pager}
        </>
      )}
    </section>
  );
}

function RunTable({
  runs,
  copy,
  lang,
}: {
  runs: MigrationRun[];
  copy: MigrationsCopy;
  lang: "ar" | "en";
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="px-4 py-3">
        <h2 className="font-semibold">{copy.runsTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.runsHelp}</p>
      </header>
      {runs.length === 0 ? (
        <p className="border-t border-border p-5 text-sm text-muted-foreground">
          {copy.noRuns}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[1000px] text-sm">
            <TableCaption className="sr-only">{copy.runsTitle}</TableCaption>
            <DsTableHeader className="bg-muted text-xs font-semibold uppercase text-muted-foreground">
              <TableRow>
                <TableHeader>{copy.run}</TableHeader>
                <TableHeader>{copy.application}</TableHeader>
                <TableHeader>{copy.mode}</TableHeader>
                <TableHeader>{copy.status}</TableHeader>
                <TableHeader>{copy.progress}</TableHeader>
                <TableHeader>{copy.startedAt}</TableHeader>
                <TableHeader align="end">{copy.open}</TableHeader>
              </TableRow>
            </DsTableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="border-t border-border align-top"
                >
                  <TableCell className="px-3 py-2 text-start">
                    <code dir="ltr" className="font-mono text-xs font-semibold">
                      {run.id}
                    </code>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {run.tenantScope
                        ? copy.scopeTenantCount(run.tenantScope.length)
                        : copy.scopeFleet}
                    </p>
                  </TableCell>
                  <TableCell dir="ltr" className="px-3 py-2 text-start font-mono text-xs">
                    {run.applicationKey}
                    <span className="mt-0.5 block text-muted-foreground">
                      {run.targetVersion}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-start">
                    <RunModeChip dryRun={run.progress.dryRun} copy={copy} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-start">
                    <RunStatusChip status={run.status} copy={copy} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-start">
                    <RunProgressBar run={run} copy={copy} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-start text-xs text-muted-foreground">
                    {formatMigrationDate(run.startedAt, lang)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-end">
                    <Link
                      href={`/database-migrations/runs/${run.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-primary/40 px-2.5 text-xs font-semibold text-primary"
                    >
                      {copy.open}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
