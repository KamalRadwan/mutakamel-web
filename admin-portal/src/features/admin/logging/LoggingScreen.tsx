"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Edit3,
  FileClock,
  Filter,
  Gauge,
  Loader2,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { LOGGING_COPY, type LoggingCopy } from "./copy";
import { useLiveLogging } from "./useLiveLogging";
import { useLoggingConsole } from "./useLoggingConsole";
import {
  HISTORY_ACTIONS,
  LOGGING_APPS,
  LOGGING_SCOPES,
  LOG_LEVELS,
  OVERRIDE_LOG_LEVELS,
  type LoggingHistoryRow,
  type LoggingOverride,
  type ResourceView,
} from "./types";

type ConsoleView = ReturnType<typeof useLoggingConsole>;
type LiveView = ReturnType<typeof useLiveLogging>;

export function LoggingScreen() {
  const { lang } = useI18n();
  const copy = LOGGING_COPY[lang];
  const view = useLoggingConsole();
  const live = useLiveLogging();

  return (
    <div className="space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 px-4 py-4 text-white shadow-md sm:px-5">
        <div className="pointer-events-none absolute end-0 top-0 -me-12 -mt-16 size-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-600 shadow-sm">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black tracking-tight">{copy.title}</h1>
              <span className="rounded-md border border-amber-300/30 bg-amber-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100">
                {copy.critical}
              </span>
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-cyan-100/80">
              {copy.subtitle}
            </p>
          </div>
        </div>
      </header>

      {!view.canRead && view.directory.state === "FORBIDDEN" ? (
        <StatePanel
          icon={<ShieldAlert className="size-7" />}
          title={copy.forbidden}
          detail={copy.readPermission}
          tone="warning"
        />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
            <DirectoryPanel view={view} copy={copy} lang={lang} />
            <div className="space-y-4">
              <OverrideEditor view={view} copy={copy} />
              <EffectiveInspector view={view} copy={copy} />
            </div>
          </section>
          <HistoryPanel view={view} copy={copy} lang={lang} />
          <LivePanel live={live} copy={copy} lang={lang} />
        </>
      )}

      <MutationFeedback view={view} copy={copy} />
      <MutationConfirmation view={view} copy={copy} />
    </div>
  );
}

function DirectoryPanel({
  view,
  copy,
  lang,
}: {
  view: ConsoleView;
  copy: LoggingCopy;
  lang: "ar" | "en";
}) {
  const rows = view.directory.data;
  return (
    <section className={panelClass}>
      <PanelHeading
        icon={<Gauge className="size-4" />}
        title={copy.directory}
        help={copy.directoryHelp}
        action={
          rows ? (
            <div className="flex gap-2 text-[10px] font-black">
              <Metric label={copy.rowsOnPage} value={rows.length} />
              <Metric label={copy.activeOnPage} value={view.activeCount} />
            </div>
          ) : null
        }
      />
      <form
        className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          view.applyDirectoryFilters();
        }}
      >
        <SelectField
          label={copy.scope}
          value={view.directoryDraft.scope}
          onChange={(value) =>
            view.setDirectoryDraftField(
              "scope",
              value as ConsoleView["directoryDraft"]["scope"],
            )
          }
          options={[
            { value: "", label: copy.allScopes },
            ...LOGGING_SCOPES.map((scope) => ({ value: scope, label: scope })),
          ]}
        />
        <SelectField
          label={copy.app}
          value={view.directoryDraft.appName}
          onChange={(value) =>
            view.setDirectoryDraftField(
              "appName",
              value as ConsoleView["directoryDraft"]["appName"],
            )
          }
          options={[
            { value: "", label: copy.allApps },
            ...LOGGING_APPS.map((app) => ({ value: app, label: app })),
          ]}
        />
        <TextField
          label={copy.tenantId}
          value={view.directoryDraft.tenantId}
          onChange={(value) => view.setDirectoryDraftField("tenantId", value)}
          error={view.directoryErrors.tenantId ? copy.invalidUuid : undefined}
          mono
        />
        <SelectField
          label={copy.pageSize}
          value={String(view.directoryLimit)}
          onChange={(value) => view.setDirectoryLimit(Number(value))}
          options={[25, 50, 100].map((limit) => ({
            value: String(limit),
            label: String(limit),
          }))}
        />
        <label className="flex min-h-10 items-center gap-2 self-end rounded-xl border border-slate-300 px-3 text-xs font-bold dark:border-slate-700">
          <input
            type="checkbox"
            checked={view.directoryDraft.includeExpired}
            onChange={(event) =>
              view.setDirectoryDraftField("includeExpired", event.target.checked)
            }
            className="size-4 accent-cyan-600"
          />
          {copy.includeExpired}
        </label>
        <div className="flex items-end justify-end gap-2">
          <IconButton label={copy.reset} onClick={view.resetDirectoryFilters}>
            <RotateCcw className="size-3.5" />
          </IconButton>
          <IconButton label={copy.refresh} onClick={view.refreshDirectory}>
            <RefreshCw
              className={`size-3.5 ${view.directory.isRefreshing ? "animate-spin" : ""}`}
            />
          </IconButton>
          <button type="submit" className={primaryButtonClass}>
            <Filter className="size-3.5" /> {copy.apply}
          </button>
        </div>
      </form>

      {rows ? (
        <>
          <ResourceNotice resource={view.directory} copy={copy} />
          {rows.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[980px] text-xs">
                <thead className={tableHeadClass}>
                  <tr>
                    {[copy.scope, copy.target, copy.level, copy.reason, copy.expires, copy.updated, copy.actions].map(
                      (label) => (
                        <th key={label} scope="col" className={thClass}>
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <OverrideRow
                      key={row.id}
                      row={row}
                      view={view}
                      copy={copy}
                      lang={lang}
                      referenceTimestamp={view.directory.timestamp}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <InlineEmpty text={copy.emptyDirectory} />
          )}
          <footer className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-500">
              {copy.page} {view.directoryPage}
            </span>
            <div className="flex gap-2">
              <IconButton
                label={copy.previous}
                onClick={() => view.setDirectoryPage(view.directoryPage - 1)}
                disabled={view.directoryPage <= 1 || view.directory.isRefreshing}
              />
              <IconButton
                label={copy.next}
                onClick={() => view.setDirectoryPage(view.directoryPage + 1)}
                disabled={!view.directoryHasNext || view.directory.isRefreshing}
              />
            </div>
          </footer>
          <Correlation resource={view.directory} copy={copy} lang={lang} />
        </>
      ) : (
        <ResourceStatePanel
          resource={view.directory}
          copy={copy}
          empty={copy.emptyDirectory}
          retry={view.refreshDirectory}
        />
      )}
    </section>
  );
}

function OverrideRow({
  row,
  view,
  copy,
  lang,
  referenceTimestamp,
}: {
  row: LoggingOverride;
  view: ConsoleView;
  copy: LoggingCopy;
  lang: "ar" | "en";
  referenceTimestamp: string | null;
}) {
  const expired =
    row.expiresAt !== null &&
    referenceTimestamp !== null &&
    Date.parse(row.expiresAt) <= Date.parse(referenceTimestamp);
  return (
    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className={tdClass}>
        <p className="font-black">{row.scope}</p>
        <span
          suppressHydrationWarning
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
            expired
              ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          }`}
        >
          {expired ? copy.expired : copy.active}
        </span>
      </td>
      <td className={tdClass}>
        <p className="font-bold">{row.appName ?? copy.global}</p>
        {row.tenantId ? (
          <Link
            href={`/tenants/${row.tenantId}`}
            className="mt-1 block max-w-56 break-all font-mono text-[10px] text-cyan-700 hover:underline dark:text-cyan-300"
          >
            {row.tenantId}
          </Link>
        ) : null}
      </td>
      <td className={tdClass}>
        <LevelPill level={row.level} />
      </td>
      <td className={`${tdClass} max-w-64 whitespace-pre-wrap break-words`}>
        {row.reason ?? copy.notRecorded}
      </td>
      <td className={tdClass}>
        {row.expiresAt ? formatDate(row.expiresAt, lang, true) : copy.legacyPermanent}
      </td>
      <td className={tdClass}>{formatDate(row.updatedAt, lang, true)}</td>
      <td className={tdClass}>
        {view.canUpdate ? (
          <div className="flex gap-1">
            <IconButton label={copy.edit} onClick={() => view.editOverride(row)}>
              <Edit3 className="size-3.5" />
            </IconButton>
            <IconButton
              label={copy.remove}
              onClick={() => view.requestDelete(row)}
              danger
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">{copy.readOnlyEditor}</span>
        )}
      </td>
    </tr>
  );
}

function OverrideEditor({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  const draft = view.overrideDraft;
  const needsApp = draft.scope === "APP" || draft.scope === "TENANT_APP";
  const needsTenant = draft.scope === "TENANT" || draft.scope === "TENANT_APP";
  const busy = view.mutationState === "SAVING" || view.mutationState === "DELETING";
  return (
    <section className={panelClass}>
      <PanelHeading
        icon={<Save className="size-4" />}
        title={copy.editor}
        help={copy.editorHelp}
      />
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          view.requestUpsert();
        }}
      >
        <SelectField
          label={copy.scope}
          value={draft.scope}
          onChange={(value) =>
            view.setOverrideDraftField(
              "scope",
              value as ConsoleView["overrideDraft"]["scope"],
            )
          }
          options={LOGGING_SCOPES.map((scope) => ({ value: scope, label: scope }))}
          disabled={!view.canUpdate || busy}
        />
        {needsApp ? (
          <SelectField
            label={copy.app}
            value={draft.appName}
            onChange={(value) =>
              view.setOverrideDraftField(
                "appName",
                value as ConsoleView["overrideDraft"]["appName"],
              )
            }
            options={[
              { value: "", label: copy.allApps },
              ...LOGGING_APPS.map((app) => ({ value: app, label: app })),
            ]}
            error={view.overrideErrors.appName ? copy.appRequired : undefined}
            disabled={!view.canUpdate || busy}
          />
        ) : null}
        {needsTenant ? (
          <TextField
            label={copy.tenantId}
            value={draft.tenantId}
            onChange={(value) => view.setOverrideDraftField("tenantId", value)}
            error={view.overrideErrors.tenantId ? copy.tenantRequired : undefined}
            disabled={!view.canUpdate || busy}
            mono
          />
        ) : null}
        <SelectField
          label={copy.level}
          value={draft.level}
          onChange={(value) =>
            view.setOverrideDraftField(
              "level",
              value as ConsoleView["overrideDraft"]["level"],
            )
          }
          options={OVERRIDE_LOG_LEVELS.map((level) => ({ value: level, label: level }))}
          disabled={!view.canUpdate || busy}
        />
        <label className={labelClass}>
          <span>{copy.reason}</span>
          <textarea
            value={draft.reason}
            maxLength={255}
            rows={3}
            disabled={!view.canUpdate || busy}
            onChange={(event) => view.setOverrideDraftField("reason", event.target.value)}
            className={inputClass}
          />
          <span className="flex justify-between text-[10px] text-slate-400">
            <span className="text-rose-600 dark:text-rose-300">
              {view.overrideErrors.reason ? copy.reasonInvalid : ""}
            </span>
            <span>{draft.reason.length}/255</span>
          </span>
        </label>
        <TextField
          label={copy.expiresAt}
          type="datetime-local"
          value={draft.expiresAtLocal}
          onChange={(value) => view.setOverrideDraftField("expiresAtLocal", value)}
          error={view.overrideErrors.expiresAt ? copy.expiryInvalid : copy.expiryHelp}
          disabled={!view.canUpdate || busy}
        />
        {!view.canUpdate ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {copy.readOnlyEditor} {copy.updatePermission}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!view.canUpdate || busy || view.mutationState === "STALE"}
          className={`${primaryButtonClass} justify-center disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {copy.save}
        </button>
      </form>
    </section>
  );
}

function EffectiveInspector({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  return (
    <section className={panelClass}>
      <PanelHeading
        icon={<Gauge className="size-4" />}
        title={copy.effective}
        help={copy.effectiveHelp}
      />
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void view.resolveEffective();
        }}
      >
        <SelectField
          label={copy.app}
          value={view.effectiveDraft.appName}
          onChange={(value) =>
            view.setEffectiveDraftField(
              "appName",
              value as ConsoleView["effectiveDraft"]["appName"],
            )
          }
          options={LOGGING_APPS.map((app) => ({ value: app, label: app }))}
        />
        <TextField
          label={copy.tenantId}
          value={view.effectiveDraft.tenantId}
          onChange={(value) => view.setEffectiveDraftField("tenantId", value)}
          error={view.effectiveErrors.tenantId ? copy.invalidUuid : undefined}
          mono
        />
        <button type="submit" className={`${secondaryButtonClass} justify-center`}>
          <Gauge className="size-3.5" /> {copy.resolve}
        </button>
      </form>
      {view.effective.state === "LOADING" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="size-3.5 animate-spin" /> {copy.loading}
        </p>
      ) : view.effective.data ? (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/40">
          <div className="flex items-center justify-between gap-3">
            <LevelPill level={view.effective.data.level} />
            <span className="font-mono text-xs font-black">
              {copy.source}: {view.effective.data.source === "FALLBACK" ? copy.fallback : view.effective.data.source}
            </span>
          </div>
          <Correlation resource={view.effective} copy={copy} />
        </div>
      ) : view.effective.state !== "EMPTY" ? (
        <ResourceStatePanel
          resource={view.effective}
          copy={copy}
          empty=""
          retry={() => void view.resolveEffective()}
        />
      ) : null}
    </section>
  );
}

function HistoryPanel({
  view,
  copy,
  lang,
}: {
  view: ConsoleView;
  copy: LoggingCopy;
  lang: "ar" | "en";
}) {
  const rows = view.history.data;
  return (
    <section className={panelClass}>
      <PanelHeading
        icon={<FileClock className="size-4" />}
        title={copy.history}
        help={copy.history}
      />
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          view.applyHistoryFilters();
        }}
      >
        <TextField
          label={copy.overrideId}
          value={view.historyDraft.overrideId}
          onChange={(value) => view.setHistoryDraftField("overrideId", value)}
          error={view.historyErrors.overrideId ? copy.invalidUuid : undefined}
          mono
        />
        <SelectField
          label={copy.action}
          value={view.historyDraft.action}
          onChange={(value) =>
            view.setHistoryDraftField(
              "action",
              value as ConsoleView["historyDraft"]["action"],
            )
          }
          options={[
            { value: "", label: copy.allActions },
            ...HISTORY_ACTIONS.map((action) => ({ value: action, label: action })),
          ]}
        />
        <SelectField
          label={copy.scope}
          value={view.historyDraft.scope}
          onChange={(value) =>
            view.setHistoryDraftField(
              "scope",
              value as ConsoleView["historyDraft"]["scope"],
            )
          }
          options={[
            { value: "", label: copy.allScopes },
            ...LOGGING_SCOPES.map((scope) => ({ value: scope, label: scope })),
          ]}
        />
        <SelectField
          label={copy.app}
          value={view.historyDraft.appName}
          onChange={(value) =>
            view.setHistoryDraftField(
              "appName",
              value as ConsoleView["historyDraft"]["appName"],
            )
          }
          options={[
            { value: "", label: copy.allApps },
            ...LOGGING_APPS.map((app) => ({ value: app, label: app })),
          ]}
        />
        <TextField
          label={copy.tenantId}
          value={view.historyDraft.tenantId}
          onChange={(value) => view.setHistoryDraftField("tenantId", value)}
          error={view.historyErrors.tenantId ? copy.invalidUuid : undefined}
          mono
        />
        <SelectField
          label={copy.pageSize}
          value={String(view.historyLimit)}
          onChange={(value) => view.setHistoryLimit(Number(value))}
          options={[25, 50, 100, 200].map((limit) => ({
            value: String(limit),
            label: String(limit),
          }))}
        />
        <div className="flex gap-2 sm:col-span-2 xl:col-span-6 xl:justify-end">
          <IconButton label={copy.reset} onClick={view.resetHistoryFilters}>
            <RotateCcw className="size-3.5" />
          </IconButton>
          <IconButton label={copy.refresh} onClick={view.refreshHistory}>
            <RefreshCw className="size-3.5" />
          </IconButton>
          <button type="submit" className={primaryButtonClass}>
            <Filter className="size-3.5" /> {copy.apply}
          </button>
        </div>
      </form>
      {rows ? (
        <>
          <ResourceNotice resource={view.history} copy={copy} />
          {rows.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[1080px] text-xs">
                <thead className={tableHeadClass}>
                  <tr>
                    {[copy.timestamp, copy.action, copy.target, copy.previousValue, copy.newValue, copy.actor, copy.reason].map(
                      (label) => (
                        <th key={label} className={thClass} scope="col">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <HistoryRow key={row.id} row={row} copy={copy} lang={lang} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <InlineEmpty text={copy.emptyHistory} />
          )}
          <Correlation resource={view.history} copy={copy} lang={lang} />
        </>
      ) : (
        <ResourceStatePanel
          resource={view.history}
          copy={copy}
          empty={copy.emptyHistory}
          retry={view.refreshHistory}
        />
      )}
    </section>
  );
}

function HistoryRow({
  row,
  copy,
  lang,
}: {
  row: LoggingHistoryRow;
  copy: LoggingCopy;
  lang: "ar" | "en";
}) {
  return (
    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className={tdClass}>{formatDate(row.createdAt, lang, true)}</td>
      <td className={tdClass}>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black dark:bg-slate-800">
          {row.action}
        </span>
      </td>
      <td className={tdClass}>
        <p className="font-black">{row.scope} · {row.appName ?? copy.global}</p>
        {row.tenantId ? <p className="mt-1 break-all font-mono text-[10px]">{row.tenantId}</p> : null}
      </td>
      <td className={tdClass}>{row.previousLevel ? <LevelPill level={row.previousLevel} /> : copy.notRecorded}</td>
      <td className={tdClass}>{row.level ? <LevelPill level={row.level} /> : copy.notRecorded}</td>
      <td className={`${tdClass} max-w-52 break-all font-mono text-[10px]`}>{row.actorId ?? copy.notRecorded}</td>
      <td className={`${tdClass} max-w-72 whitespace-pre-wrap break-words`}>{row.reason ?? row.previousReason ?? copy.notRecorded}</td>
    </tr>
  );
}

function LivePanel({
  live,
  copy,
  lang,
}: {
  live: LiveView;
  copy: LoggingCopy;
  lang: "ar" | "en";
}) {
  const running = ["CONNECTING", "LIVE", "RECONNECTING", "STALE"].includes(
    live.connectionState,
  );
  return (
    <section className={panelClass}>
      <PanelHeading
        icon={<Radio className="size-4" />}
        title={copy.live}
        help={copy.liveHelp}
        action={<LiveStatus state={live.connectionState} copy={copy} />}
      />
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
        <ShieldAlert className="me-2 inline size-4" />
        {copy.privacy}
      </div>
      {live.canLive ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SelectField
            label={copy.app}
            value={live.draft.appName}
            onChange={(value) =>
              live.setDraftField("appName", value as LiveView["draft"]["appName"])
            }
            options={[
              { value: "", label: copy.allApps },
              ...LOGGING_APPS.map((app) => ({ value: app, label: app })),
            ]}
            disabled={running}
          />
          <TextField
            label={copy.tenantId}
            value={live.draft.tenantId}
            onChange={(value) => live.setDraftField("tenantId", value)}
            error={live.validationErrors.tenantId ? copy.invalidUuid : undefined}
            disabled={running}
            mono
          />
          <SelectField
            label={copy.minimumLevel}
            value={live.draft.minLevel}
            onChange={(value) =>
              live.setDraftField("minLevel", value as LiveView["draft"]["minLevel"])
            }
            options={LOG_LEVELS.map((level) => ({ value: level, label: level }))}
            disabled={running}
          />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {copy.forbidden} {copy.livePermission}
        </p>
      )}
      {live.canLive ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!running ? (
            <button type="button" onClick={live.start} className={primaryButtonClass}>
              <Radio className="size-3.5" /> {copy.start}
            </button>
          ) : (
            <button type="button" onClick={live.stop} className={dangerButtonClass}>
              <X className="size-3.5" /> {copy.stop}
            </button>
          )}
          <IconButton label={copy.clear} onClick={live.clear} disabled={!live.rows.length} />
          {["UNAVAILABLE", "ERROR", "STALE", "RECONNECTING"].includes(
            live.connectionState,
          ) ? (
            <IconButton label={copy.retryNow} onClick={live.retryNow}>
              <RefreshCw className="size-3.5" />
            </IconButton>
          ) : null}
          {live.reconnectAttempt ? (
            <span className="self-center text-xs text-slate-500">
              {copy.reconnectAttempt}: {live.reconnectAttempt}
            </span>
          ) : null}
          {live.lastActivityAt ? (
            <span className="self-center text-xs text-slate-500">
              {copy.receivedAt}: {formatDate(live.lastActivityAt, lang, true)}
            </span>
          ) : null}
        </div>
      ) : null}
      {live.controlError ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {live.controlError.message} · {copy.errorCode}: {live.controlError.code}
        </p>
      ) : null}
      {live.rows.length ? (
        <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[920px] text-xs">
            <thead className={`${tableHeadClass} sticky top-0`}>
              <tr>
                {[copy.timestamp, copy.level, copy.service, copy.tenantId, copy.message, copy.correlation].map(
                  (label) => (
                    <th key={label} className={thClass} scope="col">{label}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
              {live.rows.map((row) => (
                <tr key={row.sequence} className="align-top">
                  <td className={tdClass}>{formatDate(row.timestamp, lang, true)}</td>
                  <td className={tdClass}><LevelPill level={row.level} /></td>
                  <td className={tdClass}>{row.serviceName}</td>
                  <td className={`${tdClass} max-w-48 break-all text-[10px]`}>{row.tenantId ?? copy.notRecorded}</td>
                  <td className={`${tdClass} max-w-xl whitespace-pre-wrap break-words font-sans`}>{row.message ?? copy.notRecorded}</td>
                  <td className={`${tdClass} max-w-48 break-all text-[10px]`}>{row.correlationId ?? copy.notRecorded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-slate-500">
          {liveStateText(live.connectionState, copy)}
        </p>
      )}
    </section>
  );
}

function MutationFeedback({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  if (["IDLE", "CONFIRMING_UPSERT", "CONFIRMING_DELETE"].includes(view.mutationState)) return null;
  const titles: Partial<Record<ConsoleView["mutationState"], string>> = {
    SAVING: copy.saving,
    DELETING: copy.deleting,
    SUCCESS: copy.success,
    VALIDATION: copy.validationFailure,
    CONFLICT: copy.conflict,
    FORBIDDEN: copy.mutationForbidden,
    UNAVAILABLE: copy.mutationUnavailable,
    STALE: copy.unknownOutcome,
    ERROR: copy.mutationError,
  };
  const busy = view.mutationState === "SAVING" || view.mutationState === "DELETING";
  return (
    <aside
      role={view.mutationState === "SUCCESS" ? "status" : "alert"}
      className={`fixed bottom-4 end-4 z-40 w-[min(440px,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl ${
        view.mutationState === "SUCCESS"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {busy ? <Loader2 className="mt-0.5 size-5 animate-spin" /> : <AlertTriangle className="mt-0.5 size-5" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{titles[view.mutationState]}</p>
          {view.mutationError ? (
            <p className="mt-2 break-all text-xs">
              {view.mutationError.message} · {copy.errorCode}: {view.mutationError.errorCode}
            </p>
          ) : null}
          {view.mutationCorrelationId ? (
            <p className="mt-2 break-all font-mono text-[10px]">
              {copy.correlation}: {view.mutationCorrelationId}
            </p>
          ) : null}
          {!busy ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {view.mutationState === "STALE" && view.retryIntent ? (
                <>
                  <button type="button" onClick={view.retryExactMutation} className={primaryButtonClass}>{copy.retryExact}</button>
                  <button type="button" onClick={view.reconcileUnknownMutation} className={secondaryButtonClass}>{copy.reconcile}</button>
                </>
              ) : null}
              <button type="button" onClick={view.clearMutationOutcome} className={secondaryButtonClass}>{copy.dismiss}</button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function MutationConfirmation({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  const intent = view.pendingIntent;
  if (!intent || !["CONFIRMING_UPSERT", "CONFIRMING_DELETE"].includes(view.mutationState)) return null;
  const upsert = intent.kind === "UPSERT";
  const target = upsert
    ? `${intent.command.scope} · ${intent.command.appName ?? copy.global} · ${intent.command.tenantId ?? copy.noTenant}`
    : `${intent.row.scope} · ${intent.row.appName ?? copy.global} · ${intent.row.tenantId ?? copy.noTenant}`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="logging-confirm-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><ShieldAlert className="size-5" /></span>
          <div>
            <h2 id="logging-confirm-title" className="text-base font-black">{upsert ? copy.confirmUpsert : copy.confirmDelete}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{upsert ? copy.confirmUpsertDetail : copy.confirmDeleteDetail}</p>
          </div>
        </div>
        <p className="mt-4 break-all rounded-xl bg-slate-100 p-3 font-mono text-xs dark:bg-slate-900">{target}</p>
        {upsert ? <p className="mt-2 text-xs"><LevelPill level={intent.command.level} /> · {intent.command.expiresAt}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={view.closeConfirmation} className={secondaryButtonClass}>{copy.cancel}</button>
          <button type="button" onClick={view.confirmMutation} className={dangerButtonClass}><ShieldAlert className="size-3.5" />{copy.confirm}</button>
        </div>
      </section>
    </div>
  );
}

function ResourceStatePanel<T>({
  resource,
  copy,
  empty,
  retry,
}: {
  resource: ResourceView<T>;
  copy: LoggingCopy;
  empty: string;
  retry: () => void;
}) {
  if (resource.state === "LOADING") return <StatePanel icon={<Loader2 className="size-6 animate-spin" />} title={copy.loading} />;
  if (resource.state === "FORBIDDEN") return <StatePanel icon={<ShieldAlert className="size-6" />} title={copy.forbidden} detail={copy.readPermission} tone="warning" />;
  const title = resource.state === "EMPTY" ? empty : resource.state === "UNAVAILABLE" ? copy.unavailable : resource.state === "STALE" ? copy.stale : copy.error;
  return <StatePanel icon={<AlertTriangle className="size-6" />} title={title} detail={errorDetail(resource, copy)} tone={resource.state === "EMPTY" ? "neutral" : "danger"} action={resource.state === "EMPTY" ? undefined : <button type="button" onClick={retry} className={secondaryButtonClass}>{copy.retry}</button>} />;
}

function ResourceNotice<T>({ resource, copy }: { resource: ResourceView<T>; copy: LoggingCopy }) {
  if (resource.state !== "STALE" && !(resource.state === "LOADING" && resource.data)) return null;
  return <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{resource.state === "STALE" ? copy.stale : copy.loading} {errorDetail(resource, copy)}</p>;
}

function Correlation<T>({ resource, copy, lang = "en" }: { resource: ResourceView<T>; copy: LoggingCopy; lang?: "ar" | "en" }) {
  if (!resource.correlationId) return null;
  return <p className="mt-3 break-all font-mono text-[10px] text-slate-400">{copy.correlation}: {resource.correlationId}{resource.timestamp ? ` · ${copy.responseAt}: ${formatDate(resource.timestamp, lang, true)}` : ""}</p>;
}

function errorDetail<T>(resource: ResourceView<T>, copy: LoggingCopy): string {
  return [resource.error?.message, resource.error?.errorCode ? `${copy.errorCode}: ${resource.error.errorCode}` : undefined, resource.error?.correlationId ? `${copy.correlation}: ${resource.error.correlationId}` : undefined].filter(Boolean).join(" · ");
}

function LiveStatus({ state, copy }: { state: LiveView["connectionState"]; copy: LoggingCopy }) {
  const live = state === "LIVE";
  return <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black ${live ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}><span className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />{liveStateText(state, copy)}</span>;
}

function liveStateText(state: LiveView["connectionState"], copy: LoggingCopy): string {
  return {
    IDLE: copy.liveIdle,
    CONNECTING: copy.liveConnecting,
    LIVE: copy.liveReady,
    RECONNECTING: copy.liveReconnecting,
    PAUSED_PRIVACY: copy.livePaused,
    FORBIDDEN: copy.forbidden,
    UNAVAILABLE: copy.unavailable,
    STALE: copy.liveStale,
    ERROR: copy.error,
  }[state];
}

function LevelPill({ level }: { level: string }) {
  const tone = level === "fatal" || level === "error" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : level === "warn" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : level === "info" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  return <span className={`inline-flex rounded-full px-2 py-1 font-mono text-[10px] font-black ${tone}`}>{level}</span>;
}

function PanelHeading({ icon, title, help, action }: { icon: ReactNode; title: string; help: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100"><span className="text-cyan-600 dark:text-cyan-400">{icon}</span>{title}</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">{help}</p></div>{action}</div>;
}

function SelectField({ label, value, options, onChange, error, disabled }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; error?: string; disabled?: boolean }) {
  return <label className={labelClass}><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error ? <span role="alert" className="text-[10px] text-rose-600 dark:text-rose-300">{error}</span> : null}</label>;
}

function TextField({ label, value, onChange, error, mono, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; error?: string; mono?: boolean; disabled?: boolean; type?: string }) {
  return <label className={labelClass}><span>{label}</span><input dir={mono ? "ltr" : undefined} type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error && error !== "Required, future, and no more than 24 hours from now.")} className={`${inputClass} ${mono ? "font-mono" : ""}`} />{error ? <span className={`text-[10px] ${error.includes("24") || error.includes("24 ساعة") ? "text-slate-400" : "text-rose-600 dark:text-rose-300"}`}>{error}</span> : null}</label>;
}

function IconButton({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children?: ReactNode; disabled?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={danger ? dangerButtonClass : secondaryButtonClass}>{children}{label}</button>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{label}: <span className="font-mono">{value}</span></span>;
}

function InlineEmpty({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700">{text}</p>;
}

function StatePanel({ icon, title, detail, tone = "neutral", action }: { icon: ReactNode; title: string; detail?: string; tone?: "neutral" | "warning" | "danger"; action?: ReactNode }) {
  const colors = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  return <section className={`mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border p-5 text-center ${colors}`}><span className="mb-2 opacity-75">{icon}</span><h3 className="text-sm font-black">{title}</h3>{detail ? <p className="mt-2 max-w-3xl break-all text-xs opacity-85">{detail}</p> : null}{action ? <div className="mt-3">{action}</div> : null}</section>;
}

function formatDate(value: string, lang: "ar" | "en", time = false): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "2-digit", ...(time ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}), timeZone: "UTC" }).format(new Date(value));
}

const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950";
const labelClass = "grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300";
const inputClass = "min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal text-slate-950 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const primaryButtonClass = "inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-600 px-3 text-xs font-black text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";
const secondaryButtonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900";
const dangerButtonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40";
const tableHeadClass = "bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400";
const thClass = "px-3 py-2.5 text-start";
const tdClass = "px-3 py-3";
