"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  KeyRound,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  ShieldAlert,
  Tags,
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
import { COPY, type ProvisioningGovernanceCopy } from "./copy";
import type {
  AsyncView,
  CreateDiscoveryRunCommand,
  DiscoveryRun,
  DiscoveryRunDetail,
  Paginated,
  ProvisioningComponent,
  ProvisioningRelease,
} from "./types";
import {
  useProvisioningGovernance,
  type ProvisioningGovernanceView,
} from "./useProvisioningGovernance";

type Tab = "CATALOGUE" | "DISCOVERY";

export function ProvisioningGovernanceScreen() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const view = useProvisioningGovernance();
  const [tab, setTab] = useState<Tab>("CATALOGUE");

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-950 dark:bg-canvas dark:text-slate-100"
    >
      <Navbar />
      <main className="mx-auto w-full max-w-[1500px] space-y-4 px-4 py-5 sm:px-6">
        <header className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-5 py-4 text-white shadow-md">
          <div className="absolute end-0 top-0 size-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-indigo-400/15 blur-3xl rtl:-translate-x-1/3" />
          <div className="relative flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-indigo-300/30 bg-indigo-400/15 text-indigo-200">
              <Boxes className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {copy.title}
                </h1>
                <span className="rounded-md border border-indigo-300/30 bg-indigo-400/10 px-2 py-1 text-xs font-semibold text-indigo-100">
                  {copy.readOnly}
                </span>
              </div>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-indigo-100/80">
                {copy.subtitle}
              </p>
            </div>
          </div>
        </header>

        <nav
          role="tablist"
          aria-label={copy.title}
          className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950"
        >
          <TabButton
            selected={tab === "CATALOGUE"}
            onClick={() => setTab("CATALOGUE")}
            label={copy.catalogue}
            icon={<Boxes className="size-4" />}
          />
          <TabButton
            selected={tab === "DISCOVERY"}
            onClick={() => setTab("DISCOVERY")}
            label={copy.discovery}
            icon={<FlaskConical className="size-4" />}
          />
        </nav>

        <ProvisioningModuleLinks view={view} copy={copy} />

        {tab === "CATALOGUE" ? (
          <CatalogueWorkspace view={view} copy={copy} lang={lang} />
        ) : (
          <DiscoveryWorkspace view={view} copy={copy} lang={lang} />
        )}
      </main>
    </div>
  );
}

function ProvisioningModuleLinks({
  view,
  copy,
}: {
  view: ProvisioningGovernanceView;
  copy: ProvisioningGovernanceCopy;
}) {
  const modules = [
    {
      href: "/provisioning/fleet",
      label: copy.fleet,
      allowed: view.permissions.canReadFleet,
      icon: <Rocket className="size-4" />,
    },
    {
      href: "/provisioning/releases",
      label: copy.releaseGovernance,
      allowed: view.permissions.canReadReleases,
      icon: <Tags className="size-4" />,
    },
    {
      href: "/provisioning/publisher-keys",
      label: copy.publisherKeys,
      allowed: view.permissions.canReadPublisherKeys,
      icon: <KeyRound className="size-4" />,
    },
  ].filter((module) => module.allowed);
  if (!modules.length) return null;
  return (
    <nav aria-label={copy.openWorkspace} className="grid gap-2 md:grid-cols-3">
      {modules.map((module) => (
        <Link
          key={module.href}
          href={module.href}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
        >
          <span className="inline-flex items-center gap-2">
            {module.icon}
            {module.label}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {copy.openWorkspace}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function CatalogueWorkspace({
  view,
  copy,
  lang,
}: {
  view: ProvisioningGovernanceView;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
}) {
  const catalogue = view.catalogue;
  const [validateFilters, setValidateFilters] = useState(false);
  const filterErrors = validateFilters
    ? componentFilterErrors(view.componentDraft, copy)
    : {};
  return (
    <div className="space-y-4">
      {catalogue.state !== "FORBIDDEN" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setValidateFilters(true);
            if (
              Object.keys(componentFilterErrors(view.componentDraft, copy))
                .length
            ) {
              return;
            }
            view.applyComponentFilters();
          }}
          className={cardClass}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextField
              label={copy.search}
              value={view.componentDraft.search ?? ""}
              onChange={(search) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  search: search || undefined,
                }))
              }
              maxLength={100}
            />
            <TextField
              label={copy.componentKey}
              value={view.componentDraft.componentKey ?? ""}
              onChange={(componentKey) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  componentKey: componentKey || undefined,
                }))
              }
              maxLength={96}
              dir="ltr"
              error={filterErrors.componentKey}
            />
            <TextField
              label={copy.ownerApp}
              value={view.componentDraft.ownerApp ?? ""}
              onChange={(ownerApp) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  ownerApp: ownerApp || undefined,
                }))
              }
              maxLength={32}
              dir="ltr"
              error={filterErrors.ownerApp}
            />
            <SelectField
              label={copy.kind}
              value={view.componentDraft.kind ?? ""}
              onChange={(kind) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  kind:
                    kind === "FOUNDATION" || kind === "MODULE"
                      ? kind
                      : undefined,
                }))
              }
              options={[
                { value: "", label: copy.allKinds },
                { value: "FOUNDATION", label: "FOUNDATION" },
                { value: "MODULE", label: "MODULE" },
              ]}
            />
            <SelectField
              label={copy.sortBy}
              value={view.componentDraft.sortBy}
              onChange={(sortBy) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  sortBy:
                    sortBy === "ownerApp" ||
                    sortBy === "kind" ||
                    sortBy === "createdAt" ||
                    sortBy === "updatedAt"
                      ? sortBy
                      : "key",
                }))
              }
              options={[
                { value: "key", label: copy.componentKey },
                { value: "ownerApp", label: copy.ownerApp },
                { value: "kind", label: copy.kind },
                { value: "createdAt", label: copy.createdAt },
                { value: "updatedAt", label: copy.updated },
              ]}
            />
            <SelectField
              label={copy.sortDirection}
              value={view.componentDraft.sortDir}
              onChange={(sortDir) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  sortDir: sortDir === "DESC" ? "DESC" : "ASC",
                }))
              }
              options={[
                { value: "ASC", label: copy.ascending },
                { value: "DESC", label: copy.descending },
              ]}
            />
            <SelectField
              label={copy.pageSize}
              value={String(view.componentDraft.limit)}
              onChange={(limit) =>
                view.setComponentDraft((current) => ({
                  ...current,
                  limit: Number(limit),
                }))
              }
              options={[20, 50, 100].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <ActionButton
              onClick={() => {
                setValidateFilters(false);
                view.resetComponentFilters();
              }}
              label={copy.reset}
              icon={<RotateCcw className="size-3.5" />}
            />
            <ActionButton
              onClick={view.refreshComponents}
              label={copy.refresh}
              icon={
                <RefreshCw
                  className={`size-3.5 ${catalogue.isRefreshing ? "animate-spin" : ""}`}
                />
              }
            />
            <button type="submit" className={primaryButtonClass}>
              <Search className="size-3.5" />
              {copy.apply}
            </button>
          </div>
        </form>
      ) : null}

      <PagedState
        view={catalogue}
        copy={copy}
        empty={copy.emptyComponents}
        forbidden={copy.forbiddenCatalogue}
        retry={view.refreshComponents}
      >
        {(data) => (
          <ComponentTable
            data={data}
            copy={copy}
            lang={lang}
            onInspect={view.selectComponent}
            onPage={view.setComponentPage}
          />
        )}
      </PagedState>

      {view.selectedComponent ? (
        <ReleaseDialog view={view} copy={copy} lang={lang} />
      ) : null}
    </div>
  );
}

function ComponentTable({
  data,
  copy,
  lang,
  onInspect,
  onPage,
}: {
  data: Paginated<ProvisioningComponent>;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
  onInspect: (value: ProvisioningComponent) => void;
  onPage: (value: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {[
                copy.component,
                copy.ownerApp,
                copy.kind,
                copy.latestRelease,
                copy.updated,
                "",
              ].map((label, index) => (
                <th key={`${label}:${index}`} className="px-4 py-3 text-start">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map((component) => (
              <tr key={component.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {component.key}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {component.isMandatory ? copy.mandatory : copy.optional} ·{" "}
                    {copy.contract} {component.contractVersion}
                  </p>
                </td>
                <td className="px-4 py-4 font-mono text-xs">
                  {component.ownerApp}
                </td>
                <td className="px-4 py-4">
                  <Pill>{component.kind}</Pill>
                </td>
                <td className="px-4 py-4 text-xs">
                  {component.latestPublishedRelease ? (
                    <>
                      <p className="font-mono font-semibold">
                        {component.latestPublishedRelease.releaseVersion}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {component.latestPublishedRelease.riskLevel} ·{" "}
                        {formatDate(
                          component.latestPublishedRelease.publishedAt,
                          lang,
                        )}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-400">{copy.noRelease}</span>
                  )}
                </td>
                <td className="px-4 py-4 text-xs text-slate-500">
                  {formatDate(component.updatedAt, lang, true)}
                </td>
                <td className="px-4 py-4 text-end">
                  <button
                    type="button"
                    onClick={() => onInspect(component)}
                    className={secondaryButtonClass}
                  >
                    {copy.inspectReleases}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter data={data} copy={copy} lang={lang} onPage={onPage} />
    </section>
  );
}

function ReleaseDialog({
  view,
  copy,
  lang,
}: {
  view: ProvisioningGovernanceView;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provisioning-release-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="provisioning-release-dialog-title"
              className="text-lg font-semibold"
            >
              {copy.releases}: {view.selectedComponent?.key}
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {view.selectedComponent?.id}
            </p>
          </div>
          <button
            type="button"
            onClick={() => view.selectComponent(null)}
            aria-label={copy.close}
            className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            view.applyReleaseFilters();
          }}
          className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <TextField
            label={copy.search}
            value={view.releaseDraft.search ?? ""}
            onChange={(search) =>
              view.setReleaseDraft((current) => ({
                ...current,
                search: search || undefined,
              }))
            }
            maxLength={100}
          />
          <SelectField
            label={copy.risk}
            value={view.releaseDraft.riskLevel ?? ""}
            onChange={(riskLevel) =>
              view.setReleaseDraft((current) => ({
                ...current,
                riskLevel:
                  riskLevel === "LOW" ||
                  riskLevel === "MEDIUM" ||
                  riskLevel === "HIGH"
                    ? riskLevel
                    : undefined,
              }))
            }
            options={[
              { value: "", label: copy.allRisks },
              ...["LOW", "MEDIUM", "HIGH"].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
          <BooleanSelect
            label={copy.selfService}
            value={view.releaseDraft.selfServiceAllowed}
            onChange={(selfServiceAllowed) =>
              view.setReleaseDraft((current) => ({
                ...current,
                selfServiceAllowed,
              }))
            }
            copy={copy}
          />
          <BooleanSelect
            label={copy.backup}
            value={view.releaseDraft.requiresBackup}
            onChange={(requiresBackup) =>
              view.setReleaseDraft((current) => ({
                ...current,
                requiresBackup,
              }))
            }
            copy={copy}
          />
          <BooleanSelect
            label={copy.maintenance}
            value={view.releaseDraft.requiresMaintenance}
            onChange={(requiresMaintenance) =>
              view.setReleaseDraft((current) => ({
                ...current,
                requiresMaintenance,
              }))
            }
            copy={copy}
          />
          <SelectField
            label={copy.sortBy}
            value={view.releaseDraft.sortBy}
            onChange={(sortBy) =>
              view.setReleaseDraft((current) => ({
                ...current,
                sortBy:
                  sortBy === "releaseVersion" ||
                  sortBy === "manifestVersion" ||
                  sortBy === "riskLevel"
                    ? sortBy
                    : "publishedAt",
              }))
            }
            options={[
              { value: "publishedAt", label: copy.published },
              { value: "releaseVersion", label: copy.version },
              { value: "manifestVersion", label: copy.contract },
              { value: "riskLevel", label: copy.risk },
            ]}
          />
          <SelectField
            label={copy.sortDirection}
            value={view.releaseDraft.sortDir}
            onChange={(sortDir) =>
              view.setReleaseDraft((current) => ({
                ...current,
                sortDir: sortDir === "ASC" ? "ASC" : "DESC",
              }))
            }
            options={[
              { value: "ASC", label: copy.ascending },
              { value: "DESC", label: copy.descending },
            ]}
          />
          <SelectField
            label={copy.pageSize}
            value={String(view.releaseDraft.limit)}
            onChange={(limit) =>
              view.setReleaseDraft((current) => ({
                ...current,
                limit: Number(limit),
              }))
            }
            options={[20, 50, 100].map((value) => ({
              value: String(value),
              label: String(value),
            }))}
          />
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass}>
              {copy.apply}
            </button>
            <ActionButton
              label={copy.reset}
              onClick={view.resetReleaseFilters}
              icon={<RotateCcw className="size-3.5" />}
            />
          </div>
        </form>
        <div className="mt-4">
          <PagedState
            view={view.releases}
            copy={copy}
            empty={copy.emptyReleases}
            forbidden={copy.forbiddenCatalogue}
            retry={view.refreshReleases}
          >
            {(data) => (
              <ReleaseList
                data={data}
                copy={copy}
                lang={lang}
                onPage={view.setReleasePage}
              />
            )}
          </PagedState>
        </div>
      </div>
    </div>
  );
}

function ReleaseList({
  data,
  copy,
  lang,
  onPage,
}: {
  data: Paginated<ProvisioningRelease>;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
  onPage: (value: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {data.items.map((release) => (
          <article
            key={release.id}
            className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-mono text-sm font-semibold">
                  {release.releaseVersion}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {copy.schema}: {release.schemaTarget}
                </p>
              </div>
              <Pill>{release.riskLevel}</Pill>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Stat
                label={copy.selfService}
                value={release.selfServiceAllowed ? copy.yes : copy.no}
              />
              <Stat
                label={copy.backup}
                value={release.requiresBackup ? copy.yes : copy.no}
              />
              <Stat
                label={copy.maintenance}
                value={release.requiresMaintenance ? copy.yes : copy.no}
              />
              <Stat
                label={copy.published}
                value={formatDate(release.publishedAt, lang)}
              />
              <Stat
                label={copy.seedPacks}
                value={String(release.seedPacks.length)}
              />
              <Stat
                label={copy.compatibility}
                value={String(release.compatibility.requiredComponents.length)}
              />
            </dl>
            {!release.manifestSummaryAvailable ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {copy.manifestUnavailable}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <PaginationFooter data={data} copy={copy} lang={lang} onPage={onPage} />
    </section>
  );
}

function DiscoveryWorkspace({
  view,
  copy,
  lang,
}: {
  view: ProvisioningGovernanceView;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
}) {
  const [command, setCommand] = useState<CreateDiscoveryRunCommand>({
    mode: "DRY_RUN",
    cutoffAt: currentUtcMinute(),
    maxTenants: 100,
  });
  const [validation, setValidation] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const requestConfirmation = () => {
    const error = validateCommand(command, copy);
    setValidation(error);
    if (!error) {
      setConfirmation("");
      setConfirming(true);
    }
  };

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{copy.startDiscovery}</h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              {copy.permissionRun}
            </p>
          </div>
          <ActionButton
            onClick={view.refreshDiscovery}
            label={copy.refresh}
            icon={
              <RefreshCw
                className={`size-3.5 ${view.discovery.isRefreshing ? "animate-spin" : ""}`}
              />
            }
          />
        </div>
        {view.permissions.canRunDiscovery ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SelectField
              label={copy.mode}
              value={command.mode}
              onChange={(mode) =>
                setCommand((current) => ({
                  ...current,
                  mode: mode === "MANUAL" ? "MANUAL" : "DRY_RUN",
                }))
              }
              options={[
                { value: "DRY_RUN", label: copy.dryRun },
                { value: "MANUAL", label: copy.manual },
              ]}
            />
            <label className={labelClass}>
              <span>{copy.cutoff}</span>
              <input
                type="datetime-local"
                step="1"
                value={isoToLocalInput(command.cutoffAt)}
                onChange={(event) =>
                  setCommand((current) => ({
                    ...current,
                    cutoffAt: localInputToIso(event.target.value),
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span>{copy.maxTenants}</span>
              <input
                type="number"
                min={1}
                max={10_000}
                step={1}
                value={command.maxTenants}
                onChange={(event) =>
                  setCommand((current) => ({
                    ...current,
                    maxTenants: Number(event.target.value),
                  }))
                }
                className={inputClass}
              />
            </label>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={requestConfirmation}
                className={primaryButtonClass}
              >
                {copy.validate}
              </button>
            </div>
          </div>
        ) : null}
        {validation ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">
            {validation}
          </p>
        ) : null}
        {view.mutation.error ? (
          <ErrorCard
            error={view.mutation.error}
            copy={copy}
            action={
              view.mutation.exactRetryAvailable ? (
                <button
                  type="button"
                  onClick={() => void view.runDiscovery(command)}
                  className={dangerButtonClass}
                >
                  {copy.exactRetry}
                </button>
              ) : undefined
            }
          />
        ) : null}
        {view.mutation.result ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {copy.created}{" "}
            <span className="font-mono">{view.mutation.result.runId}</span>
          </p>
        ) : null}
      </section>

      <DiscoveryState
        view={view.discovery}
        copy={copy}
        retry={view.refreshDiscovery}
      >
        {(data) => (
          <DiscoveryTable
            runs={data.items}
            correlationId={data.correlationId}
            timestamp={data.timestamp}
            copy={copy}
            lang={lang}
            onInspect={view.selectRun}
          />
        )}
      </DiscoveryState>

      {view.selectedRunId ? (
        <DiscoveryDetailDialog view={view} copy={copy} lang={lang} />
      ) : null}

      {confirming ? (
        <ConfirmationDialog
          copy={copy}
          value={confirmation}
          onChange={setConfirmation}
          pending={view.mutation.isPending}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            if (confirmation !== "RUN") return;
            setConfirming(false);
            void view.runDiscovery(command);
          }}
        />
      ) : null}
    </div>
  );
}

function DiscoveryTable({
  runs,
  correlationId,
  timestamp,
  copy,
  lang,
  onInspect,
}: {
  runs: DiscoveryRun[];
  correlationId: string;
  timestamp: string;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
  onInspect: (runId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-slate-50 text-2xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {[
                copy.mode,
                copy.status,
                copy.scheduled,
                copy.scanned,
                copy.drifted,
                copy.incompatible,
                "",
              ].map((label, index) => (
                <th key={`${label}:${index}`} className="px-4 py-3 text-start">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {runs.map((run) => (
              <tr key={run.runId}>
                <td className="px-4 py-4">
                  <Pill>{run.mode}</Pill>
                  <p className="mt-2 max-w-44 break-all font-mono text-xs text-slate-500">
                    {run.runId}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Pill>{run.status}</Pill>
                  {run.safeErrorCode ? (
                    <p className="mt-2 text-xs text-rose-600">
                      {run.safeErrorCode}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-xs">
                  {formatDate(run.scheduledAt, lang, true)}
                </td>
                <td className="px-4 py-4 font-mono text-xs">
                  {run.scannedCount} / {run.eligibleTenantCount}
                  <p className="mt-1 text-slate-500">
                    {copy.remaining}: {run.remainingTenantCount}
                  </p>
                </td>
                <td className="px-4 py-4 font-mono font-semibold">
                  {run.driftedCount}
                </td>
                <td className="px-4 py-4 font-mono font-semibold">
                  {run.incompatibleCount}
                </td>
                <td className="px-4 py-4 text-end">
                  <button
                    type="button"
                    onClick={() => onInspect(run.runId)}
                    className={secondaryButtonClass}
                  >
                    {copy.inspect}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-200 px-4 py-3 break-all font-mono text-xs text-slate-500 dark:border-slate-800">
        {copy.correlation}: {correlationId} · {copy.responseAt}:{" "}
        {formatDate(timestamp, lang, true)}
      </p>
    </section>
  );
}

function DiscoveryDetailDialog({
  view,
  copy,
  lang,
}: {
  view: ProvisioningGovernanceView;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discovery-detail-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="discovery-detail-title" className="text-lg font-semibold">
              {copy.results}
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {view.selectedRunId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => view.selectRun(null)}
            aria-label={copy.close}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">
          <DetailState view={view.detail} copy={copy}>
            {(detail) => (
              <DiscoveryResults detail={detail} copy={copy} lang={lang} />
            )}
          </DetailState>
        </div>
      </div>
    </div>
  );
}

function DiscoveryResults({
  detail,
  copy,
  lang,
}: {
  detail: DiscoveryRunDetail;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
}) {
  return (
    <div className="space-y-3">
      {detail.resultsTruncated ? (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {copy.truncated}
        </p>
      ) : null}
      {detail.results.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900">
              <tr>
                {[
                  copy.tenant,
                  copy.component,
                  copy.status,
                  copy.observed,
                  copy.safeCode,
                ].map((label) => (
                  <th key={label} className="px-3 py-2 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detail.results.map((result) => (
                <tr key={`${result.tenantId}:${result.componentId}`}>
                  <td className="px-3 py-3 break-all font-mono">
                    {result.tenantId}
                  </td>
                  <td className="px-3 py-3 break-all font-mono">
                    {result.componentId}
                  </td>
                  <td className="px-3 py-3">
                    <Pill>{result.discoveredState}</Pill>
                  </td>
                  <td className="px-3 py-3">
                    {formatDate(result.observedAt, lang, true)}
                  </td>
                  <td className="px-3 py-3">{result.safeCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <StatePanel title={copy.emptyRuns} />
      )}
    </div>
  );
}

function ConfirmationDialog({
  copy,
  value,
  onChange,
  pending,
  onClose,
  onConfirm,
}: {
  copy: ProvisioningGovernanceCopy;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discovery-confirm-title"
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/75 p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-950">
        <h2 id="discovery-confirm-title" className="text-lg font-semibold">
          {copy.confirmationTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {copy.confirmationText}
        </p>
        <label className={`${labelClass} mt-4`}>
          <span>{copy.confirmationToken}</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            {copy.close}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={value !== "RUN" || pending}
            className={dangerButtonClass}
          >
            {pending ? copy.running : copy.run}
          </button>
        </div>
      </div>
    </div>
  );
}

function PagedState<T>({
  view,
  copy,
  empty,
  forbidden,
  retry,
  children,
}: {
  view: AsyncView<Paginated<T>>;
  copy: ProvisioningGovernanceCopy;
  empty: string;
  forbidden: string;
  retry: () => void;
  children: (data: Paginated<T>) => ReactNode;
}) {
  if (view.state === "LOADING")
    return (
      <StatePanel
        title={copy.loading}
        icon={<Loader2 className="size-6 animate-spin" />}
      />
    );
  if (view.state === "FORBIDDEN")
    return (
      <StatePanel
        title={forbidden}
        icon={<ShieldAlert className="size-6" />}
        tone="warning"
      />
    );
  if (view.state === "UNAVAILABLE")
    return (
      <StatePanel
        title={copy.unavailable}
        icon={<AlertTriangle className="size-6" />}
        tone="danger"
        action={
          <button type="button" onClick={retry} className={dangerButtonClass}>
            {copy.retry}
          </button>
        }
        detail={errorDetail(view.error, copy)}
      />
    );
  if (view.state === "ERROR")
    return (
      <StatePanel
        title={copy.error}
        icon={<AlertTriangle className="size-6" />}
        tone="danger"
        action={
          <button type="button" onClick={retry} className={dangerButtonClass}>
            {copy.retry}
          </button>
        }
        detail={errorDetail(view.error, copy)}
      />
    );
  if (view.state === "EMPTY" || !view.data?.items.length)
    return <StatePanel title={empty} />;
  return children(view.data);
}

function DiscoveryState<T>({
  view,
  copy,
  retry,
  children,
}: {
  view: AsyncView<T>;
  copy: ProvisioningGovernanceCopy;
  retry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (view.state === "LOADING")
    return (
      <StatePanel
        title={copy.loading}
        icon={<Loader2 className="size-6 animate-spin" />}
      />
    );
  if (view.state === "FORBIDDEN")
    return (
      <StatePanel
        title={copy.forbiddenDiscovery}
        icon={<ShieldAlert className="size-6" />}
        tone="warning"
      />
    );
  if (view.state === "UNAVAILABLE" || view.state === "ERROR")
    return (
      <StatePanel
        title={view.state === "UNAVAILABLE" ? copy.unavailable : copy.error}
        icon={<AlertTriangle className="size-6" />}
        tone="danger"
        action={
          <button type="button" onClick={retry} className={dangerButtonClass}>
            {copy.retry}
          </button>
        }
        detail={errorDetail(view.error, copy)}
      />
    );
  if (view.state === "EMPTY" || !view.data)
    return <StatePanel title={copy.emptyRuns} />;
  return children(view.data);
}

function DetailState<T>({
  view,
  copy,
  children,
}: {
  view: AsyncView<T>;
  copy: ProvisioningGovernanceCopy;
  children: (data: T) => ReactNode;
}) {
  if (view.state === "LOADING")
    return (
      <StatePanel
        title={copy.loading}
        icon={<Loader2 className="size-6 animate-spin" />}
      />
    );
  if (view.state === "FORBIDDEN")
    return <StatePanel title={copy.forbiddenDiscovery} tone="warning" />;
  if (view.state === "UNAVAILABLE" || view.state === "ERROR")
    return (
      <StatePanel
        title={view.state === "UNAVAILABLE" ? copy.unavailable : copy.error}
        detail={errorDetail(view.error, copy)}
        tone="danger"
      />
    );
  if (!view.data) return <StatePanel title={copy.emptyRuns} />;
  return children(view.data);
}

function ErrorCard({
  error,
  copy,
  action,
}: {
  error: { message: string; errorCode?: string; correlationId?: string };
  copy: ProvisioningGovernanceCopy;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <p>{error.message}</p>
      <p className="mt-1 break-all font-mono text-xs">
        {error.errorCode ? `${copy.errorCode}: ${error.errorCode}` : ""}
        {error.correlationId
          ? ` · ${copy.correlation}: ${error.correlationId}`
          : ""}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function PaginationFooter<T>({
  data,
  copy,
  lang,
  onPage,
}: {
  data: Paginated<T>;
  copy: ProvisioningGovernanceCopy;
  lang: "ar" | "en";
  onPage: (value: number) => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs dark:border-slate-800">
      <div className="text-slate-500">
        <p>
          {copy.page} {data.page} {copy.of} {Math.max(1, data.totalPages)} ·{" "}
          {data.total}
        </p>
        <p className="mt-1 break-all font-mono text-xs">
          {copy.correlation}: {data.correlationId} · {copy.responseAt}:{" "}
          {formatDate(data.timestamp, lang, true)}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!data.hasPrev}
          onClick={() => onPage(data.page - 1)}
          className={secondaryButtonClass}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {copy.previous}
        </button>
        <button
          type="button"
          disabled={!data.hasNext}
          onClick={() => onPage(data.page + 1)}
          className={secondaryButtonClass}
        >
          {copy.next}
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
      </div>
    </footer>
  );
}

function StatePanel({
  title,
  detail,
  icon,
  tone = "neutral",
  action,
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  action?: ReactNode;
}) {
  const colors =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300";
  return (
    <section
      role={tone === "danger" ? "alert" : undefined}
      className={`flex min-h-48 flex-col items-center justify-center rounded-xl border p-6 text-center ${colors}`}
    >
      {icon ? <span className="mb-3">{icon}</span> : null}
      <h2 className="font-semibold">{title}</h2>
      {detail ? (
        <p className="mt-2 max-w-3xl break-all text-xs">{detail}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function TabButton({
  selected,
  onClick,
  label,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold ${selected ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"}`}
    >
      {icon}
      {label}
    </button>
  );
}
function TextField({
  label,
  value,
  onChange,
  maxLength,
  dir,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  dir?: "ltr";
  error?: string;
}) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        dir={dir}
        aria-invalid={Boolean(error)}
        className={inputClass}
      />
      {error ? (
        <span
          role="alert"
          className="text-xs font-semibold text-rose-600 dark:text-rose-300"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function BooleanSelect({
  label,
  value,
  onChange,
  copy,
}: {
  label: string;
  value?: boolean;
  onChange: (value?: boolean) => void;
  copy: ProvisioningGovernanceCopy;
}) {
  return (
    <SelectField
      label={label}
      value={value === undefined ? "" : String(value)}
      onChange={(next) =>
        onChange(next === "true" ? true : next === "false" ? false : undefined)
      }
      options={[
        { value: "", label: copy.any },
        { value: "true", label: copy.yes },
        { value: "false", label: copy.no },
      ]}
    />
  );
}
function ActionButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={secondaryButtonClass}>
      {icon}
      {label}
    </button>
  );
}
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
      {children}
    </span>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
function formatDate(
  value: string,
  lang: "ar" | "en",
  includeTime = false,
): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(new Date(value));
}
function errorDetail(
  error: { message: string; errorCode?: string; correlationId?: string } | null,
  copy: ProvisioningGovernanceCopy,
): string | undefined {
  if (!error) return undefined;
  return [
    error.message,
    error.errorCode ? `${copy.errorCode}: ${error.errorCode}` : null,
    error.correlationId ? `${copy.correlation}: ${error.correlationId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
function currentUtcMinute(): string {
  const value = new Date(Date.now() - 60_000);
  value.setMilliseconds(0);
  return value.toISOString();
}
function isoToLocalInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 19);
}
function localInputToIso(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}
function validateCommand(
  command: CreateDiscoveryRunCommand,
  copy: ProvisioningGovernanceCopy,
): string | null {
  const cutoff = Date.parse(command.cutoffAt);
  if (!Number.isFinite(cutoff) || cutoff > Date.now())
    return copy.validationCutoff;
  if (
    !Number.isSafeInteger(command.maxTenants) ||
    command.maxTenants < 1 ||
    command.maxTenants > 10_000
  )
    return copy.validationMax;
  return null;
}
function componentFilterErrors(
  query: ProvisioningGovernanceView["componentDraft"],
  copy: ProvisioningGovernanceCopy,
): { componentKey?: string; ownerApp?: string } {
  const errors: { componentKey?: string; ownerApp?: string } = {};
  if (
    query.componentKey &&
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u.test(query.componentKey)
  )
    errors.componentKey = copy.validationComponentKey;
  if (query.ownerApp && !/^[a-z][a-z0-9_-]{0,31}$/u.test(query.ownerApp))
    errors.ownerApp = copy.validationOwnerApp;
  return errors;
}

const cardClass =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950";
const labelClass =
  "grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300";
const inputClass =
  "min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40";
const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-900";
const dangerButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40";
