"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import {
  AlertTriangle,
  Edit3,
  FileClock,
  Filter,
  Gauge,
  Loader2,
  MoreHorizontal,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  PageHeader,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Button,
  Badge,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ConfirmActionModal,
  AmbiguousOutcomePanel,
  useToast,
  type ColumnDef,
} from "@/design-system";
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
  type RuntimeLogRow,
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
      <PageHeader title={copy.title} />

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

  const columns: ColumnDef<LoggingOverride>[] = [
    {
      key: "scope",
      headerEn: copy.scope,
      headerAr: copy.scope,
      cell: (row) => {
        const expired =
          row.expiresAt !== null &&
          view.directory.timestamp !== null &&
          Date.parse(row.expiresAt) <= Date.parse(view.directory.timestamp);
        return (
          <div>
            <p className="font-semibold text-foreground">{row.scope}</p>
            <Badge tone={expired ? "neutral" : "success"} className="mt-1">
              {expired ? copy.expired : copy.active}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "target",
      headerEn: copy.target,
      headerAr: copy.target,
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground">{row.appName ?? copy.global}</p>
          {row.tenantId ? (
            <Link
              href={`/tenants/${row.tenantId}`}
              className="mt-1 block max-w-56 break-all font-mono text-sm text-action hover:underline"
            >
              {row.tenantId}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "level",
      headerEn: copy.level,
      headerAr: copy.level,
      cell: (row) => <LevelPill level={row.level} />,
    },
    {
      key: "reason",
      headerEn: copy.reason,
      headerAr: copy.reason,
      cell: (row) => (
        <span className="block max-w-64 whitespace-pre-wrap break-words">
          {row.reason ?? copy.notRecorded}
        </span>
      ),
    },
    {
      key: "expires",
      headerEn: copy.expires,
      headerAr: copy.expires,
      cell: (row) =>
        row.expiresAt ? formatDate(row.expiresAt, lang, true) : copy.legacyPermanent,
    },
    {
      key: "updated",
      headerEn: copy.updated,
      headerAr: copy.updated,
      cell: (row) => formatDate(row.updatedAt, lang, true),
    },
    {
      key: "actions",
      headerEn: copy.actions,
      headerAr: copy.actions,
      cell: (row) =>
        view.canUpdate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" aria-label={`${copy.actions}: ${row.appName || copy.global}`}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => view.editOverride(row)}>
                <Edit3 className="size-4" aria-hidden="true" />
                {copy.edit}
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => view.requestDelete(row)}>
                <Trash2 className="size-4" aria-hidden="true" />
                {copy.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm text-muted-foreground">{copy.readOnlyEditor}</span>
        ),
    },
  ];

  return (
    <Card className="p-4">
      <PanelHeading
        icon={<Gauge className="size-4" />}
        title={copy.directory}
        help={copy.directoryHelp}
        action={
          rows ? (
            <div className="flex gap-2 text-sm font-semibold">
              <Metric label={copy.rowsOnPage} value={rows.length} lang={lang} />
              <Metric label={copy.activeOnPage} value={view.activeCount} lang={lang} />
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
        <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-input px-3 text-sm font-semibold">
          <Checkbox
            checked={view.directoryDraft.includeExpired}
            onCheckedChange={(checked) =>
              view.setDirectoryDraftField("includeExpired", checked === true)
            }
          />
          {copy.includeExpired}
        </label>
        <div className="flex items-end justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={view.resetDirectoryFilters}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {copy.reset}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={view.refreshDirectory}>
            <RefreshCw
              className={`size-3.5 ${view.directory.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            {copy.refresh}
          </Button>
          <Button type="submit" variant="primary" size="sm">
            <Filter className="size-3.5" aria-hidden="true" />
            {copy.apply}
          </Button>
        </div>
      </form>

      {rows ? (
        <>
          <ResourceNotice resource={view.directory} copy={copy} />
          {rows.length ? (
            <div className="mt-4">
              <DataTable
                labelEn={LOGGING_COPY.en.directory}
                labelAr={LOGGING_COPY.ar.directory}
                columns={columns}
                data={rows}
                isRefreshing={view.directory.isRefreshing}
                getRowId={(row) => row.id}
                pagination={{
                  page: 1,
                  limit: Math.max(rows.length, 1),
                  totalItems: rows.length,
                  totalPages: 1,
                  onPageChange: () => {},
                }}
              />
              <footer className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-muted-foreground">
                  {copy.page} {formatInteger(view.directoryPage, lang)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => view.setDirectoryPage(view.directoryPage - 1)}
                    disabled={view.directoryPage <= 1 || view.directory.isRefreshing}
                  >
                    {copy.previous}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => view.setDirectoryPage(view.directoryPage + 1)}
                    disabled={!view.directoryHasNext || view.directory.isRefreshing}
                  >
                    {copy.next}
                  </Button>
                </div>
              </footer>
            </div>
          ) : (
            <InlineEmpty text={copy.emptyDirectory} />
          )}
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
    </Card>
  );
}

function OverrideEditor({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  const draft = view.overrideDraft;
  const needsApp = draft.scope === "APP" || draft.scope === "TENANT_APP";
  const needsTenant = draft.scope === "TENANT" || draft.scope === "TENANT_APP";
  const busy = view.mutationState === "SAVING" || view.mutationState === "DELETING";
  return (
    <Card className="p-4">
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
        <Field label={copy.reason} hint={`${draft.reason.length}/255`} error={view.overrideErrors.reason ? copy.reasonInvalid : undefined}>
          {(fp) => (
            <Textarea
              {...fp}
              value={draft.reason}
              maxLength={255}
              rows={3}
              disabled={!view.canUpdate || busy}
              invalid={Boolean(view.overrideErrors.reason)}
              onChange={(event) => view.setOverrideDraftField("reason", event.target.value)}
            />
          )}
        </Field>
        <TextField
          label={copy.expiresAt}
          type="datetime-local"
          value={draft.expiresAtLocal}
          onChange={(value) => view.setOverrideDraftField("expiresAtLocal", value)}
          error={view.overrideErrors.expiresAt ? copy.expiryInvalid : undefined}
          hint={copy.expiryHelp}
          disabled={!view.canUpdate || busy}
        />
        {!view.canUpdate ? (
          <p className="rounded-md border border-warning bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
            {copy.readOnlyEditor} {copy.updatePermission}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          disabled={!view.canUpdate || busy || view.mutationState === "STALE"}
          className="justify-center"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Save className="size-3.5" aria-hidden="true" />
          )}
          {copy.save}
        </Button>
      </form>
    </Card>
  );
}

function EffectiveInspector({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  return (
    <Card className="p-4">
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
        <Button type="submit" variant="secondary" className="justify-center">
          <Gauge className="size-3.5" aria-hidden="true" />
          {copy.resolve}
        </Button>
      </form>
      {view.effective.state === "LOADING" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {copy.loading}
        </p>
      ) : view.effective.data ? (
        <div className="mt-4 rounded-md border border-info/30 bg-info-subtle p-4">
          <div className="flex items-center justify-between gap-3">
            <LevelPill level={view.effective.data.level} />
            <span className="font-mono text-sm font-semibold">
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
    </Card>
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

  const columns: ColumnDef<LoggingHistoryRow>[] = [
    {
      key: "timestamp",
      headerEn: copy.timestamp,
      headerAr: copy.timestamp,
      cell: (row) => formatDate(row.createdAt, lang, true),
    },
    {
      key: "action",
      headerEn: copy.action,
      headerAr: copy.action,
      cell: (row) => <Badge tone="neutral">{row.action}</Badge>,
    },
    {
      key: "target",
      headerEn: copy.target,
      headerAr: copy.target,
      cell: (row) => (
        <div>
          <p className="font-semibold text-foreground">
            {row.scope} · {row.appName ?? copy.global}
          </p>
          {row.tenantId ? <p dir="ltr" className="mt-1 break-all text-start font-mono text-sm">{row.tenantId}</p> : null}
        </div>
      ),
    },
    {
      key: "previousValue",
      headerEn: copy.previousValue,
      headerAr: copy.previousValue,
      cell: (row) => (row.previousLevel ? <LevelPill level={row.previousLevel} /> : copy.notRecorded),
    },
    {
      key: "newValue",
      headerEn: copy.newValue,
      headerAr: copy.newValue,
      cell: (row) => (row.level ? <LevelPill level={row.level} /> : copy.notRecorded),
    },
    {
      key: "actor",
      headerEn: copy.actor,
      headerAr: copy.actor,
      cell: (row) => (
        <span dir="ltr" className="block max-w-52 break-all text-start font-mono text-sm">{row.actorId ?? copy.notRecorded}</span>
      ),
    },
    {
      key: "reason",
      headerEn: copy.reason,
      headerAr: copy.reason,
      cell: (row) => (
        <span className="block max-w-72 whitespace-pre-wrap break-words">
          {row.reason ?? row.previousReason ?? copy.notRecorded}
        </span>
      ),
    },
  ];

  return (
    <Card className="p-4">
      <PanelHeading icon={<FileClock className="size-4" />} title={copy.history} help={copy.history} />
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
          <Button type="button" variant="outline" size="sm" onClick={view.resetHistoryFilters}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {copy.reset}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={view.refreshHistory}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {copy.refresh}
          </Button>
          <Button type="submit" variant="primary" size="sm">
            <Filter className="size-3.5" aria-hidden="true" />
            {copy.apply}
          </Button>
        </div>
      </form>
      {rows ? (
        <>
          <ResourceNotice resource={view.history} copy={copy} />
          {rows.length ? (
            <div className="mt-4">
              <DataTable
                labelEn={LOGGING_COPY.en.history}
                labelAr={LOGGING_COPY.ar.history}
                columns={columns}
                data={rows}
                isRefreshing={view.history.isRefreshing}
                getRowId={(row) => row.id}
                pagination={{
                  page: 1,
                  limit: Math.max(rows.length, 1),
                  totalItems: rows.length,
                  totalPages: 1,
                  onPageChange: () => {},
                }}
              />
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
    </Card>
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
    <Card className="p-4">
      <PanelHeading
        icon={<Radio className="size-4" />}
        title={copy.live}
        help={copy.liveHelp}
        action={<LiveStatus state={live.connectionState} copy={copy} />}
      />
      <div className="mt-3 rounded-md border border-info/30 bg-info-subtle p-3 text-sm leading-5 text-info-subtle-foreground">
        <ShieldAlert className="me-2 inline size-4" aria-hidden="true" />
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
        <p className="mt-4 rounded-md border border-warning bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
          {copy.forbidden} {copy.livePermission}
        </p>
      )}
      {live.canLive ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!running ? (
            <Button type="button" variant="primary" size="sm" onClick={live.start}>
              <Radio className="size-3.5" aria-hidden="true" /> {copy.start}
            </Button>
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={live.stop}>
              <X className="size-3.5" aria-hidden="true" /> {copy.stop}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={live.clear} disabled={!live.rows.length}>
            {copy.clear}
          </Button>
          {["UNAVAILABLE", "ERROR", "STALE", "RECONNECTING"].includes(
            live.connectionState,
          ) ? (
            <Button type="button" variant="outline" size="sm" onClick={live.retryNow}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {copy.retryNow}
            </Button>
          ) : null}
          {live.reconnectAttempt ? (
            <span className="self-center text-sm text-muted-foreground">
              {copy.reconnectAttempt}: {formatInteger(live.reconnectAttempt, lang)}
            </span>
          ) : null}
          {live.lastActivityAt ? (
            <span className="self-center text-sm text-muted-foreground">
              {copy.receivedAt}: {formatDate(live.lastActivityAt, lang, true)}
            </span>
          ) : null}
        </div>
      ) : null}
      {live.controlError ? (
        <p role="alert" className="mt-3 rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground">
          {live.controlError.message} · {copy.errorCode}: {live.controlError.code}
        </p>
      ) : null}
      {live.rows.length ? (
        <LiveRowsTable rows={live.rows} copy={copy} lang={lang} />
      ) : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {liveStateText(live.connectionState, copy)}
        </p>
      )}
    </Card>
  );
}

function LiveRowsTable({ rows, copy, lang }: { rows: RuntimeLogRow[]; copy: LoggingCopy; lang: "ar" | "en" }) {
  const columns: ColumnDef<RuntimeLogRow>[] = [
    {
      key: "timestamp",
      headerEn: copy.timestamp,
      headerAr: copy.timestamp,
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.timestamp, lang, true)}</span>,
    },
    {
      key: "level",
      headerEn: copy.level,
      headerAr: copy.level,
      cell: (row) => <LevelPill level={row.level} />,
    },
    {
      key: "service",
      headerEn: copy.service,
      headerAr: copy.service,
      cell: (row) => <code dir="ltr" className="font-mono text-sm">{row.serviceName}</code>,
    },
    {
      key: "tenantId",
      headerEn: copy.tenantId,
      headerAr: copy.tenantId,
      cell: (row) => <code dir="ltr" className="block max-w-48 break-all text-start font-mono text-sm">{row.tenantId ?? copy.notRecorded}</code>,
    },
    {
      key: "message",
      headerEn: copy.message,
      headerAr: copy.message,
      cell: (row) => <span className="block max-w-xl whitespace-pre-wrap break-words">{row.message ?? copy.notRecorded}</span>,
    },
    {
      key: "correlation",
      headerEn: copy.correlation,
      headerAr: copy.correlation,
      cell: (row) => <code dir="ltr" className="block max-w-48 break-all text-start font-mono text-sm">{row.correlationId ?? copy.notRecorded}</code>,
    },
  ];

  return (
    <div className="mt-4 max-h-[520px] overflow-y-auto">
      <DataTable
        labelEn={LOGGING_COPY.en.live}
        labelAr={LOGGING_COPY.ar.live}
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.sequence)}
        responsiveMode="horizontal-scroll"
        pagination={{
          page: 1,
          limit: Math.max(rows.length, 1),
          totalItems: rows.length,
          totalPages: 1,
          onPageChange: () => {},
        }}
      />
    </div>
  );
}

function MutationFeedback({ view, copy }: { view: ConsoleView; copy: LoggingCopy }) {
  const toast = useToast();
  const succeeded = view.mutationState === "SUCCESS";
  const clearMutationOutcome = view.clearMutationOutcome;
  useEffect(() => {
    if (!succeeded) return;
    toast.success(copy.success);
    clearMutationOutcome();
  }, [succeeded, toast, copy.success, clearMutationOutcome]);

  if (["IDLE", "CONFIRMING_UPSERT", "CONFIRMING_DELETE", "SUCCESS"].includes(view.mutationState)) return null;

  if (view.mutationState === "STALE") {
    return (
      <AmbiguousOutcomePanel
        className="fixed bottom-4 end-4 z-40 w-[min(440px,calc(100vw-2rem))] shadow-pop"
        message={copy.unknownOutcome}
        correlationId={view.mutationCorrelationId ?? undefined}
        onRetryExact={view.retryIntent ? view.retryExactMutation : undefined}
        onReconcile={view.retryIntent ? view.reconcileUnknownMutation : undefined}
      />
    );
  }

  const titles: Partial<Record<ConsoleView["mutationState"], string>> = {
    SAVING: copy.saving,
    DELETING: copy.deleting,
    VALIDATION: copy.validationFailure,
    CONFLICT: copy.conflict,
    FORBIDDEN: copy.mutationForbidden,
    UNAVAILABLE: copy.mutationUnavailable,
    ERROR: copy.mutationError,
  };
  const busy = view.mutationState === "SAVING" || view.mutationState === "DELETING";
  return (
    <aside
      role="alert"
      className="fixed bottom-4 end-4 z-40 w-[min(440px,calc(100vw-2rem))] rounded-lg border border-warning bg-warning-subtle p-4 text-warning-subtle-foreground shadow-pop"
    >
      <div className="flex items-start gap-3">
        {busy ? (
          <Loader2 className="mt-0.5 size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{titles[view.mutationState]}</p>
          {view.mutationError ? (
            <p className="mt-2 break-all text-sm">
              {view.mutationError.message} · {copy.errorCode}: {view.mutationError.errorCode}
            </p>
          ) : null}
          {view.mutationCorrelationId ? (
            <p className="mt-2 break-all font-mono text-sm">
              {copy.correlation}: {view.mutationCorrelationId}
            </p>
          ) : null}
          {!busy ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={view.clearMutationOutcome}>
                {copy.dismiss}
              </Button>
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
  const detailEn = upsert
    ? `${copy.confirmUpsertDetail} ${target} · ${intent.command.level} · ${intent.command.expiresAt}`
    : `${copy.confirmDeleteDetail} ${target}`;
  return (
    <ConfirmActionModal
      isOpen
      onClose={view.closeConfirmation}
      onConfirm={() => view.confirmMutation()}
      titleEn={upsert ? copy.confirmUpsert : copy.confirmDelete}
      titleAr={upsert ? copy.confirmUpsert : copy.confirmDelete}
      descriptionEn={detailEn}
      descriptionAr={detailEn}
      confirmTextEn={copy.confirm}
      confirmTextAr={copy.confirm}
      variant={upsert ? "warning" : "danger"}
    />
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
  if (resource.state === "LOADING") return <StatePanel icon={<Loader2 className="size-6 animate-spin motion-reduce:animate-none" />} title={copy.loading} />;
  if (resource.state === "FORBIDDEN") return <StatePanel icon={<ShieldAlert className="size-6" />} title={copy.forbidden} detail={copy.readPermission} tone="warning" />;
  const title = resource.state === "EMPTY" ? empty : resource.state === "UNAVAILABLE" ? copy.unavailable : resource.state === "STALE" ? copy.stale : copy.error;
  return (
    <StatePanel
      icon={<AlertTriangle className="size-6" />}
      title={title}
      detail={errorDetail(resource, copy)}
      tone={resource.state === "EMPTY" ? "neutral" : "danger"}
      action={
        resource.state === "EMPTY" ? undefined : (
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            {copy.retry}
          </Button>
        )
      }
    />
  );
}

function ResourceNotice<T>({ resource, copy }: { resource: ResourceView<T>; copy: LoggingCopy }) {
  if (resource.state !== "STALE" && !(resource.state === "LOADING" && resource.data)) return null;
  return (
    <p role="status" className="mt-3 rounded-md border border-warning bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
      {resource.state === "STALE" ? copy.stale : copy.loading} {errorDetail(resource, copy)}
    </p>
  );
}

function Correlation<T>({ resource, copy, lang = "en" }: { resource: ResourceView<T>; copy: LoggingCopy; lang?: "ar" | "en" }) {
  if (!resource.correlationId) return null;
  return (
    <p className="mt-3 break-all text-sm text-muted-foreground">
      <strong className="font-semibold text-foreground">{copy.correlation}:</strong>{" "}
      <code dir="ltr" className="select-all font-mono">{resource.correlationId}</code>
      {resource.timestamp ? ` · ${copy.responseAt}: ${formatDate(resource.timestamp, lang, true)}` : ""}
    </p>
  );
}

function errorDetail<T>(resource: ResourceView<T>, copy: LoggingCopy): string {
  return [resource.error?.message, resource.error?.errorCode ? `${copy.errorCode}: ${resource.error.errorCode}` : undefined, resource.error?.correlationId ? `${copy.correlation}: ${resource.error.correlationId}` : undefined].filter(Boolean).join(" · ");
}

function LiveStatus({ state, copy }: { state: LiveView["connectionState"]; copy: LoggingCopy }) {
  const live = state === "LIVE";
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-sm px-2.5 py-1 text-sm font-semibold ${
        live
          ? "bg-success-subtle text-success-subtle-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span className={`size-2 rounded-full ${live ? "animate-pulse bg-success motion-reduce:animate-none" : "bg-muted-foreground"}`} aria-hidden="true" />
      {liveStateText(state, copy)}
    </span>
  );
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
  const tone =
    level === "fatal" || level === "error"
      ? "danger"
      : level === "warn"
        ? "warn"
        : level === "info"
          ? "info"
          : "neutral";
  return <Badge tone={tone} className="font-mono normal-case tracking-normal">{level}</Badge>;
}

function PanelHeading({ icon, title, help, action }: { icon: ReactNode; title: string; help: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{help}</p>
      </div>
      {action}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const toItemValue = (v: string) => (v === "" ? "__ANY__" : v);
  return (
    <Field label={label} error={error}>
      {(fp) => (
        <Select
          value={toItemValue(value)}
          onValueChange={(next) => onChange(next === "__ANY__" ? "" : next)}
          disabled={disabled}
        >
          <SelectTrigger id={fp.id} aria-describedby={fp["aria-describedby"]} aria-invalid={fp["aria-invalid"]}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={toItemValue(option.value)} value={toItemValue(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  mono,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  mono?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(fp) => (
        <Input
          {...fp}
          dir={mono ? "ltr" : undefined}
          type={type}
          value={value}
          disabled={disabled}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
          className={mono ? "font-mono" : undefined}
        />
      )}
    </Field>
  );
}

function Metric({ label, value, lang }: { label: string; value: number; lang: "ar" | "en" }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1">
      {label}: <span className="font-mono">{formatInteger(value, lang)}</span>
    </span>
  );
}

function InlineEmpty({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function StatePanel({ icon, title, detail, tone = "neutral", action }: { icon: ReactNode; title: string; detail?: string; tone?: "neutral" | "warning" | "danger"; action?: ReactNode }) {
  const colors =
    tone === "danger"
      ? "border-destructive bg-destructive-subtle text-destructive-subtle-foreground"
      : tone === "warning"
        ? "border-warning bg-warning-subtle text-warning-subtle-foreground"
        : "border-border bg-card text-muted-foreground";
  return (
    <section role={tone === "neutral" ? "status" : "alert"} className={`mt-4 flex min-h-36 flex-col items-center justify-center rounded-lg border p-5 text-center ${colors}`}>
      <span className="mb-2 opacity-75">{icon}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {detail ? <p className="mt-2 max-w-3xl break-all text-sm opacity-85">{detail}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

function formatDate(value: string, lang: "ar" | "en", time = false): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "2-digit", ...(time ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : {}), timeZone: "UTC" }).format(new Date(value));
}

function formatInteger(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
