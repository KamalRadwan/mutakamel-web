"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  OctagonX,
  PauseCircle,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useI18n } from "@/i18n/I18nContext";
import { useMigrationRunDetail } from "../hooks/use-migration-run-detail";
import { missingExecutePermissions } from "../model/migration-permissions";
import {
  describeTenantOutcome,
  readSkipDisclosure,
  summarizeTenantOutcomes,
  type OutcomeGroup,
} from "../model/migration-outcomes";
import {
  MIGRATION_TENANT_OUTCOMES,
  type MigrationRun,
  type MigrationTenantOutcome,
  type MigrationTenantResult,
} from "../types/database-migrations";
import {
  formatDuration,
  formatMigrationDate,
  MIGRATIONS_COPY,
  MigrationMutationNotice,
  MigrationPager,
  MigrationsHero,
  MigrationsPageFrame,
  MigrationsStatePanel,
  OutcomeChip,
  outcomeHelp,
  outcomeLabel,
  ReadOnlyNotice,
  RefreshMigrationsButton,
  RunModeChip,
  RunProgressBar,
  RunStatusChip,
  TableHeader,
  migrationInputClass,
  migrationLabelClass,
  type MigrationsCopy,
} from "./migrations-shared";

export function MigrationRunDetailScreen({ runId }: { runId: string }) {
  const { lang, dir } = useI18n();
  const copy = MIGRATIONS_COPY[lang];
  const detail = useMigrationRunDetail(runId);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <MigrationsPageFrame dir={dir}>
      <MigrationsHero
        title={copy.detailTitle}
        subtitle={runId}
        action={
          <div className="flex flex-wrap gap-2">
            <RefreshMigrationsButton
              label={copy.refresh}
              onClick={detail.refresh}
              pending={detail.isRefreshing}
            />
            <Link
              href="/database-migrations"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-cyan-950"
            >
              <BackIcon className="size-4" aria-hidden="true" />
              {copy.back}
            </Link>
          </div>
        }
      />
      <DetailBody detail={detail} copy={copy} lang={lang} />
    </MigrationsPageFrame>
  );
}

function DetailBody({
  detail,
  copy,
  lang,
}: {
  detail: ReturnType<typeof useMigrationRunDetail>;
  copy: MigrationsCopy;
  lang: "ar" | "en";
}) {
  if (detail.state === "LOADING") {
    return <MigrationsStatePanel kind="loading" title={copy.loading} copy={copy} />;
  }
  if (detail.state === "FORBIDDEN") {
    return (
      <MigrationsStatePanel
        kind="forbidden"
        title={copy.forbidden}
        detail={copy.readPermission}
        copy={copy}
      />
    );
  }
  if (detail.state === "NOT_FOUND") {
    return (
      <MigrationsStatePanel kind="notFound" title={copy.notFound} copy={copy} />
    );
  }
  if (detail.state === "UNAVAILABLE" || detail.state === "ERROR" || !detail.run) {
    return (
      <MigrationsStatePanel
        kind={detail.state === "UNAVAILABLE" ? "unavailable" : "error"}
        title={detail.state === "UNAVAILABLE" ? copy.unavailable : copy.error}
        detail={detail.error?.message}
        correlationId={detail.error?.correlationId}
        copy={copy}
        action={
          <RefreshMigrationsButton label={copy.retry} onClick={detail.refresh} />
        }
      />
    );
  }

  const run = detail.run;
  return (
    <div className="space-y-4" aria-busy={detail.isRefreshing}>
      <ReadOnlyNotice
        missing={missingExecutePermissions(detail.permissions)}
        copy={copy}
      />
      <MigrationMutationNotice mutation={detail.mutation} copy={copy} />
      <RunSummaryCard run={run} copy={copy} lang={lang} />
      <RunControls detail={detail} run={run} copy={copy} />
      <OutcomeSection detail={detail} run={run} copy={copy} lang={lang} />
    </div>
  );
}

function RunSummaryCard({
  run,
  copy,
  lang,
}: {
  run: MigrationRun;
  copy: MigrationsCopy;
  lang: "ar" | "en";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <RunStatusChip status={run.status} copy={copy} />
        <RunModeChip dryRun={run.progress.dryRun} copy={copy} />
        <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-bold dark:border-slate-700">
          {run.tenantScope
            ? copy.scopeTenantCount(run.tenantScope.length)
            : copy.scopeFleet}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={copy.application} value={run.applicationKey} mono />
        <Fact label={copy.targetVersion} value={run.targetVersion} mono />
        <Fact
          label={copy.startedAt}
          value={formatMigrationDate(run.startedAt, lang)}
        />
        <Fact
          label={copy.finishedAt}
          value={formatMigrationDate(run.finishedAt, lang)}
        />
        <Fact label={copy.triggeredBy} value={run.triggeredBy || copy.none} />
        <Fact label={copy.batchSizeLabel} value={String(run.batchSize)} mono />
        <Fact
          label={copy.duration}
          value={formatDuration(run.summary?.durationMs ?? null, lang)}
        />
        <Fact label={copy.strategyLabel} value={run.strategy} mono />
      </dl>

      <div className="mt-4">
        <RunProgressBar run={run} copy={copy} />
      </div>

      {run.error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          {run.error}
        </p>
      ) : null}
    </section>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        dir={mono ? "ltr" : undefined}
        className={`mt-1 break-words text-sm font-bold ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function RunControls({
  detail,
  run,
  copy,
}: {
  detail: ReturnType<typeof useMigrationRunDetail>;
  run: MigrationRun;
  copy: MigrationsCopy;
}) {
  const [reason, setReason] = useState("");
  const [aborting, setAborting] = useState(false);
  const pending = detail.mutation.phase === "PENDING";
  const reasonReady = reason.trim().length >= 3;

  if (!detail.permissions.canExecute && !detail.permissions.canDestroy) {
    return null;
  }

  const abortTenants = copy.confirmAbortTenants(
    run.progress.queuedTenants,
    run.progress.inFlightTenants,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-black">{copy.controlsTitle}</h2>

      <label className="mt-3 block">
        <span className={migrationLabelClass}>{copy.controlReasonLabel}</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          className={migrationInputClass}
        />
        <span className="mt-1 block text-xs text-slate-500">
          {copy.controlReasonHelp}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {detail.permissions.canExecute ? (
          <>
            <button
              type="button"
              disabled={!detail.availability.canPause || !reasonReady || pending}
              onClick={() => void detail.control("PAUSE", reason.trim())}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400 px-4 text-sm font-bold text-amber-800 disabled:opacity-40 dark:border-amber-700 dark:text-amber-200"
            >
              <PauseCircle className="size-4" aria-hidden="true" />
              {copy.pause}
            </button>
            <button
              type="button"
              disabled={!detail.availability.canResume || !reasonReady || pending}
              onClick={() => void detail.control("RESUME", reason.trim())}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400 px-4 text-sm font-bold text-cyan-800 disabled:opacity-40 dark:border-cyan-700 dark:text-cyan-200"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              {copy.resume}
            </button>
            <button
              type="button"
              disabled={
                !detail.availability.canRetryFailed || !reasonReady || pending
              }
              onClick={() => void detail.control("RETRY_FAILED", reason.trim())}
              title={copy.retryFailedHelp}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-400 px-4 text-sm font-bold disabled:opacity-40 dark:border-slate-600"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {copy.retryFailed}
            </button>
          </>
        ) : null}

        {detail.permissions.canDestroy ? (
          <button
            type="button"
            disabled={!detail.availability.canAbort || !reasonReady || pending}
            onClick={() => setAborting(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-black text-white hover:bg-rose-800 disabled:opacity-40"
          >
            <OctagonX className="size-4" aria-hidden="true" />
            {copy.abort}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-slate-500">{copy.retryFailedHelp}</p>

      <DestructiveActionModal
        isOpen={aborting}
        onClose={() => {
          if (!pending) setAborting(false);
        }}
        onConfirm={() => {
          void detail.control("ABORT", reason.trim()).then(() => {
            setAborting(false);
          });
        }}
        title={copy.confirmAbortTitle}
        description={copy.confirmAbortBody(run.id, abortTenants)}
        targetName={run.id}
        actionType="destroy"
        requireNameTyping
        isSubmitting={pending}
        confirmLabel={copy.abort}
      />
    </section>
  );
}

const GROUP_ORDER: OutcomeGroup[] = [
  "NEEDS_ATTENTION",
  "AT_TARGET",
  "IN_FLIGHT",
];

function OutcomeSection({
  detail,
  run,
  copy,
  lang,
}: {
  detail: ReturnType<typeof useMigrationRunDetail>;
  run: MigrationRun;
  copy: MigrationsCopy;
  lang: "ar" | "en";
}) {
  const results = detail.outcomes?.items ?? [];
  const summary = summarizeTenantOutcomes(results);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="px-4 py-3">
        <h2 className="font-black">{copy.outcomesTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{copy.outcomesHelp}</p>
      </header>

      {detail.outcomesError ? (
        <div
          role="status"
          className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="font-bold">{copy.outcomesUnavailable}</p>
          <p className="mt-1 text-xs leading-5">
            {copy.outcomesUnavailableBody}
          </p>
          <p className="mt-2 font-mono text-xs">
            {copy.groupAtTarget}: {run.progress.succeededTenants} ·{" "}
            {copy.groupNeedsAttention}: {run.progress.failedTenants} ·{" "}
            SKIPPED+SKIPPED_UP_TO_DATE: {run.progress.skippedTenants}
          </p>
          <code dir="ltr" className="mt-1 block break-all font-mono text-xs">
            {detail.outcomesError.errorCode}
          </code>
        </div>
      ) : null}

      {detail.outcomes ? (
        <div className="grid gap-3 px-4 pb-3 lg:grid-cols-3">
          {GROUP_ORDER.map((group) => (
            <OutcomeGroupCard
              key={group}
              group={group}
              summary={summary}
              copy={copy}
            />
          ))}
        </div>
      ) : null}

      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <label className="block max-w-xs">
          <span className={migrationLabelClass}>{copy.filterOutcome}</span>
          <select
            value={detail.outcomeFilter}
            onChange={(event) =>
              detail.setOutcomeFilter(
                event.target.value as MigrationTenantOutcome | "",
              )
            }
            className={migrationInputClass}
          >
            <option value="">{copy.allOutcomes}</option>
            {MIGRATION_TENANT_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {`${outcomeLabel(outcome, copy)} · ${outcome}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {results.length === 0 ? (
        <p className="border-t border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
          {copy.noOutcomes}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <caption className="sr-only">{copy.outcomesTitle}</caption>
              <thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <TableHeader>{copy.tenant}</TableHeader>
                  <TableHeader>{copy.status}</TableHeader>
                  <TableHeader>{copy.migration}</TableHeader>
                  <TableHeader align="end">{copy.appliedCount}</TableHeader>
                  <TableHeader align="end">{copy.duration}</TableHeader>
                  <TableHeader>{copy.finishedAt}</TableHeader>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <OutcomeRow
                    key={`${result.tenantId}:${result.migrationName ?? ""}`}
                    result={result}
                    copy={copy}
                    lang={lang}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <MigrationPager
            page={detail.page}
            pageSize={detail.pageSize}
            total={detail.outcomes?.meta.total ?? results.length}
            onPageChange={detail.setPage}
            lang={lang}
          />
        </>
      )}
    </section>
  );
}

function OutcomeGroupCard({
  group,
  summary,
  copy,
}: {
  group: OutcomeGroup;
  summary: ReturnType<typeof summarizeTenantOutcomes>;
  copy: MigrationsCopy;
}) {
  const title = {
    NEEDS_ATTENTION: copy.groupNeedsAttention,
    AT_TARGET: copy.groupAtTarget,
    IN_FLIGHT: copy.groupInFlight,
  }[group];
  const total = {
    NEEDS_ATTENTION: summary.needsAttention,
    AT_TARGET: summary.atTarget,
    IN_FLIGHT: summary.inFlight,
  }[group];
  const members = MIGRATION_TENANT_OUTCOMES.filter(
    (outcome) => describeTenantOutcome(outcome).group === group,
  );

  return (
    <article
      className={`rounded-2xl border p-3 ${
        group === "NEEDS_ATTENTION"
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-black">{title}</h3>
        <span className="font-mono text-lg font-black">{total}</span>
      </header>
      <dl className="mt-2 space-y-1.5">
        {members.map((outcome) => (
          <div
            key={outcome}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <dt className="min-w-0">
              <span className="font-bold">{outcomeLabel(outcome, copy)}</span>{" "}
              <code dir="ltr" className="font-mono text-[10px] text-slate-500">
                {outcome}
              </code>
            </dt>
            <dd className="font-mono font-black">{summary.tally[outcome]}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function OutcomeRow({
  result,
  copy,
  lang,
}: {
  result: MigrationTenantResult;
  copy: MigrationsCopy;
  lang: "ar" | "en";
}) {
  const disclosure = readSkipDisclosure(result);

  return (
    <tr className="border-t border-slate-200 align-top dark:border-slate-800">
      <td className="px-4 py-3 text-start">
        <p className="font-bold">{result.tenantName ?? result.tenantId}</p>
        <code dir="ltr" className="mt-1 block font-mono text-xs text-slate-500">
          {result.tenantId}
        </code>
      </td>
      <td className="px-4 py-3 text-start">
        <OutcomeChip outcome={result.outcome} copy={copy} />
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-600 dark:text-slate-300">
          {outcomeHelp(result.outcome, copy)}
        </p>

        {disclosure.kind === "EXCLUDED" ? (
          <p className="mt-2 max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <strong>{copy.skipReasonLabel}:</strong> {disclosure.reason}
          </p>
        ) : null}

        {disclosure.kind === "EXCLUDED_REASON_MISSING" ? (
          <p
            role="alert"
            className="mt-2 max-w-sm rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs leading-5 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
          >
            {copy.skipReasonMissing}
          </p>
        ) : null}

        {result.errorCode || result.errorDetail ? (
          <p className="mt-2 max-w-sm text-xs leading-5 text-rose-700 dark:text-rose-300">
            <strong>{copy.errorCode}:</strong>{" "}
            <code dir="ltr" className="font-mono">
              {result.errorCode ?? ""}
            </code>{" "}
            {result.errorDetail}
          </p>
        ) : null}
      </td>
      <td dir="ltr" className="px-4 py-3 text-start font-mono text-xs">
        {result.migrationName ?? copy.none}
        {result.migrationChecksum ? (
          <span className="mt-1 block break-all text-[10px] text-slate-500">
            {result.migrationChecksum}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-end font-mono text-xs">
        {result.appliedCount}
        {result.pendingCount > 0 ? (
          <span className="block text-slate-500">/{result.pendingCount}</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-end font-mono text-xs">
        {formatDuration(result.durationMs, lang)}
      </td>
      <td className="px-4 py-3 text-start text-xs text-slate-500">
        {formatMigrationDate(result.finishedAt, lang)}
      </td>
    </tr>
  );
}
