"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, PlayCircle, ServerCog } from "lucide-react";
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
  migrationInputClass,
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
              <button
                type="button"
                onClick={openFleetStart}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-cyan-950"
              >
                <PlayCircle className="size-4" aria-hidden="true" />
                {copy.startRun}
              </button>
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
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <h2 className="font-black">{copy.projectionDegradedTitle}</h2>
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
      className="rounded-2xl border-2 border-fuchsia-500 bg-fuchsia-50 p-5 text-fuchsia-950 shadow-md dark:border-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-100"
    >
      <div className="flex items-start gap-3">
        <AlertOctagon className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-black">{copy.alarmTitle}</h2>
          <p className="mt-1 text-sm leading-6">{copy.alarmBody}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {affected.map((entry) => (
              <li
                key={entry.applicationKey}
                className="rounded-xl border border-fuchsia-400 bg-white/70 px-3 py-2 text-xs font-bold dark:border-fuchsia-700 dark:bg-fuchsia-950"
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-black text-slate-900 dark:text-slate-100">
          {copy.fleetTitle}
        </h2>
        <p className="mt-2">{copy.noFleet}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-black">{copy.fleetTitle}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{copy.fleetHelp}</p>
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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ServerCog className="size-5 text-cyan-700" aria-hidden="true" />
          <h3 className="font-black">
            <code dir="ltr" className="font-mono">
              {entry.applicationKey}
            </code>
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          {copy.availableVersion}:{" "}
          <code dir="ltr" className="font-mono font-bold">
            {entry.availableVersion || copy.none}
          </code>
        </p>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-800">
          <dt className="text-[11px] font-bold uppercase text-slate-500">
            {copy.tenantsTotal}
          </dt>
          <dd className="font-mono text-lg font-black">{health.total}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 p-2 dark:border-slate-800">
          <dt className="text-[11px] font-bold uppercase text-slate-500">
            {copy.behind}
          </dt>
          <dd className="font-mono text-lg font-black">{health.behind}</dd>
        </div>
        {counters
          .filter((counter) => counter.value > 0)
          .map((counter) => (
            <div
              key={counter.state}
              className="rounded-xl border border-slate-200 p-2 dark:border-slate-800"
            >
              <dt className="text-[11px] font-bold uppercase text-slate-500">
                {schemaStateLabel(counter.state, copy)}{" "}
                <code dir="ltr" className="font-mono normal-case">
                  {counter.state}
                </code>
              </dt>
              <dd className="font-mono text-lg font-black">{counter.value}</dd>
            </div>
          ))}
      </dl>

      {entry.activeRun ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold">{copy.activeRun}:</span>
          <RunStatusChip status={entry.activeRun.status} copy={copy} />
          <Link
            href={`/database-migrations/runs/${entry.activeRun.runId}`}
            className="font-mono font-bold text-cyan-700 underline dark:text-cyan-300"
          >
            {entry.activeRun.runId}
          </Link>
          <span className="font-mono">{entry.activeRun.progressPct}%</span>
        </p>
      ) : null}

      <section className="mt-3">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          {copy.distribution}
        </h4>
        {health.fragmented ? (
          <p className="mt-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <strong>{copy.fragmentedTitle}.</strong> {copy.fragmentedBody}
          </p>
        ) : null}
        <table className="mt-2 w-full text-xs">
          <caption className="sr-only">{copy.distribution}</caption>
          <thead className="text-[11px] font-black uppercase text-slate-500">
            <tr>
              <TableHeader>{copy.schemaVersion}</TableHeader>
              <TableHeader align="end">{copy.tenantCount}</TableHeader>
            </tr>
          </thead>
          <tbody>
            {entry.versionDistribution.map((slice) => (
              <tr
                key={slice.schemaVersion}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td dir="ltr" className="px-4 py-2 text-start font-mono">
                  {slice.schemaVersion}
                </td>
                <td className="px-4 py-2 text-end font-mono font-bold">
                  {slice.tenantCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className={migrationLabelClass}>{copy.filterApplication}</span>
          <select
            value={overview.applicationKey}
            onChange={(event) => overview.setApplicationKey(event.target.value)}
            className={migrationInputClass}
          >
            <option value="">{copy.allApplications}</option>
            {MIGRATION_APPLICATION_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={migrationLabelClass}>{copy.filterState}</span>
          <select
            value={overview.schemaState}
            onChange={(event) =>
              overview.setSchemaState(
                event.target.value as TenantSchemaVersionState | "",
              )
            }
            className={migrationInputClass}
          >
            <option value="">{copy.allStates}</option>
            {TENANT_SCHEMA_VERSION_STATES.map((state) => (
              <option key={state} value={state}>
                {`${schemaStateLabel(state, copy)} · ${state}`}
              </option>
            ))}
          </select>
        </label>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="px-4 py-3">
        <h2 className="font-black">{copy.tenantsTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{copy.tenantsHelp}</p>
      </header>
      {tenants.length === 0 ? (
        <p className="border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
          {copy.noTenants}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">{copy.tenantsTitle}</caption>
              <thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <TableHeader>{copy.tenant}</TableHeader>
                  <TableHeader>{copy.application}</TableHeader>
                  <TableHeader>{copy.state}</TableHeader>
                  <TableHeader>{copy.version}</TableHeader>
                  <TableHeader>{copy.observedAt}</TableHeader>
                  <TableHeader align="end">{copy.migrateTenant}</TableHeader>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={`${tenant.tenantId}:${tenant.applicationKey}`}
                    className="border-t border-slate-200 align-top dark:border-slate-800"
                  >
                    <td className="px-4 py-3 text-start">
                      <p className="font-bold">
                        {tenant.tenantName ?? tenant.tenantId}
                      </p>
                      <code
                        dir="ltr"
                        className="mt-1 block font-mono text-xs text-slate-500"
                      >
                        {tenant.tenantId}
                      </code>
                    </td>
                    <td dir="ltr" className="px-4 py-3 text-start font-mono text-xs">
                      {tenant.applicationKey}
                    </td>
                    <td className="px-4 py-3 text-start">
                      <SchemaStateChip state={tenant.state} copy={copy} />
                      {tenant.driftDetail ? (
                        <p className="mt-2 max-w-sm text-xs leading-5 text-fuchsia-800 dark:text-fuchsia-200">
                          <strong>{copy.driftDetail}:</strong>{" "}
                          <span dir="ltr" className="font-mono break-all">
                            {tenant.driftDetail}
                          </span>
                        </p>
                      ) : null}
                    </td>
                    <td dir="ltr" className="px-4 py-3 text-start font-mono text-xs">
                      {tenant.schemaVersion || copy.none}
                    </td>
                    <td className="px-4 py-3 text-start text-xs text-slate-500">
                      {formatMigrationDate(tenant.observedAt, lang)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {canExecute ? (
                        <button
                          type="button"
                          onClick={() => onMigrateTenant(tenant.tenantId)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300 px-3 text-xs font-bold text-cyan-800 dark:border-cyan-800 dark:text-cyan-200"
                        >
                          <PlayCircle className="size-4" aria-hidden="true" />
                          {copy.migrateTenant}
                        </button>
                      ) : (
                        <span className="text-slate-400">{copy.none}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="px-4 py-3">
        <h2 className="font-black">{copy.runsTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{copy.runsHelp}</p>
      </header>
      {runs.length === 0 ? (
        <p className="border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
          {copy.noRuns}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <caption className="sr-only">{copy.runsTitle}</caption>
            <thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <TableHeader>{copy.run}</TableHeader>
                <TableHeader>{copy.application}</TableHeader>
                <TableHeader>{copy.mode}</TableHeader>
                <TableHeader>{copy.status}</TableHeader>
                <TableHeader>{copy.progress}</TableHeader>
                <TableHeader>{copy.startedAt}</TableHeader>
                <TableHeader align="end">{copy.open}</TableHeader>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-slate-200 align-top dark:border-slate-800"
                >
                  <td className="px-4 py-3 text-start">
                    <code dir="ltr" className="font-mono text-xs font-bold">
                      {run.id}
                    </code>
                    <p className="mt-1 text-xs text-slate-500">
                      {run.tenantScope
                        ? copy.scopeTenantCount(run.tenantScope.length)
                        : copy.scopeFleet}
                    </p>
                  </td>
                  <td dir="ltr" className="px-4 py-3 text-start font-mono text-xs">
                    {run.applicationKey}
                    <span className="mt-1 block text-slate-500">
                      {run.targetVersion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <RunModeChip dryRun={run.progress.dryRun} copy={copy} />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <RunStatusChip status={run.status} copy={copy} />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <RunProgressBar run={run} copy={copy} />
                  </td>
                  <td className="px-4 py-3 text-start text-xs text-slate-500">
                    {formatMigrationDate(run.startedAt, lang)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/database-migrations/runs/${run.id}`}
                      className="inline-flex min-h-10 items-center rounded-xl border border-cyan-300 px-3 text-xs font-bold text-cyan-800 dark:border-cyan-800 dark:text-cyan-200"
                    >
                      {copy.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
