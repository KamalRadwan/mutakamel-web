"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  FlaskConical,
  KeyRound,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Tags,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AmbiguousOutcomePanel,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@/design-system";
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

export function ProvisioningGovernanceScreen() {
  const { lang } = useI18n();
  const copy = COPY[lang];
  const view = useProvisioningGovernance();

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="mx-auto w-full max-w-[1500px]">
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        status={<Badge tone="neutral">{copy.readOnly}</Badge>}
      />

      <div className="space-y-4">
        <ProvisioningModuleLinks view={view} copy={copy} />

        <Tabs defaultValue="CATALOGUE">
          <TabsList>
            <TabsTrigger value="CATALOGUE">
              <Boxes className="me-1.5 size-4" aria-hidden="true" />
              {copy.catalogue}
            </TabsTrigger>
            <TabsTrigger value="DISCOVERY">
              <FlaskConical className="me-1.5 size-4" aria-hidden="true" />
              {copy.discovery}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="CATALOGUE">
            <CatalogueWorkspace view={view} copy={copy} lang={lang} />
          </TabsContent>
          <TabsContent value="DISCOVERY">
            <DiscoveryWorkspace view={view} copy={copy} lang={lang} />
          </TabsContent>
        </Tabs>
      </div>
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
        <Link key={module.href} href={module.href}>
          <Card className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand-400 dark:hover:border-brand-500">
            <span className="inline-flex items-center gap-2">
              {module.icon}
              {module.label}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {copy.openWorkspace}
            </span>
          </Card>
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
        <Card>
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
          >
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label={copy.search}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={view.componentDraft.search ?? ""}
                    onChange={(event) =>
                      view.setComponentDraft((current) => ({
                        ...current,
                        search: event.target.value || undefined,
                      }))
                    }
                    maxLength={100}
                  />
                )}
              </Field>
              <Field label={copy.componentKey} error={filterErrors.componentKey}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={view.componentDraft.componentKey ?? ""}
                    onChange={(event) =>
                      view.setComponentDraft((current) => ({
                        ...current,
                        componentKey: event.target.value || undefined,
                      }))
                    }
                    maxLength={96}
                    dir="ltr"
                  />
                )}
              </Field>
              <Field label={copy.ownerApp} error={filterErrors.ownerApp}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={view.componentDraft.ownerApp ?? ""}
                    onChange={(event) =>
                      view.setComponentDraft((current) => ({
                        ...current,
                        ownerApp: event.target.value || undefined,
                      }))
                    }
                    maxLength={32}
                    dir="ltr"
                  />
                )}
              </Field>
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
                  { value: "__any__", label: copy.allKinds },
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
              <div className="flex items-end justify-end gap-2 md:col-span-2 xl:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setValidateFilters(false);
                    view.resetComponentFilters();
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  {copy.reset}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={view.refreshComponents}
                  loading={catalogue.isRefreshing}
                >
                  <RefreshCw className="size-3.5" />
                  {copy.refresh}
                </Button>
                <Button type="submit" variant="primary">
                  {copy.apply}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
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
  const columns: ColumnDef<ProvisioningComponent>[] = [
    {
      key: "component",
      headerEn: COPY.en.component,
      headerAr: COPY.ar.component,
      cell: (component) => (
        <div>
          <p className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
            {component.key}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {component.isMandatory ? copy.mandatory : copy.optional} ·{" "}
            {copy.contract} {component.contractVersion}
          </p>
        </div>
      ),
    },
    {
      key: "ownerApp",
      headerEn: COPY.en.ownerApp,
      headerAr: COPY.ar.ownerApp,
      cell: (component) => <span className="font-mono text-xs">{component.ownerApp}</span>,
    },
    {
      key: "kind",
      headerEn: COPY.en.kind,
      headerAr: COPY.ar.kind,
      cell: (component) => <Badge tone="neutral">{component.kind}</Badge>,
    },
    {
      key: "latestRelease",
      headerEn: COPY.en.latestRelease,
      headerAr: COPY.ar.latestRelease,
      cell: (component) =>
        component.latestPublishedRelease ? (
          <div className="text-xs">
            <p className="font-mono font-semibold">
              {component.latestPublishedRelease.releaseVersion}
            </p>
            <p className="mt-1 text-muted-foreground">
              {component.latestPublishedRelease.riskLevel} ·{" "}
              {formatDate(component.latestPublishedRelease.publishedAt, lang)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">{copy.noRelease}</span>
        ),
    },
    {
      key: "updated",
      headerEn: COPY.en.updated,
      headerAr: COPY.ar.updated,
      cell: (component) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(component.updatedAt, lang, true)}
        </span>
      ),
    },
    {
      key: "actions",
      headerEn: "",
      headerAr: "",
      align: "end",
      cell: (component) => (
        <Button type="button" variant="outline" size="sm" onClick={() => onInspect(component)}>
          {copy.inspectReleases}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <DataTable
        columns={columns}
        data={data.items}
        getRowId={(row) => row.id}
        pagination={{
          page: data.page,
          limit: data.limit,
          totalItems: data.total,
          totalPages: data.totalPages,
          onPageChange: onPage,
        }}
      />
    </Card>
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
    <Dialog open onOpenChange={(open) => !open && view.selectComponent(null)}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {copy.releases}: {view.selectedComponent?.key}
          </DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">
            {view.selectedComponent?.id}
          </p>
        </DialogHeader>
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              view.applyReleaseFilters();
            }}
          >
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label={copy.search}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={view.releaseDraft.search ?? ""}
                    onChange={(event) =>
                      view.setReleaseDraft((current) => ({
                        ...current,
                        search: event.target.value || undefined,
                      }))
                    }
                    maxLength={100}
                  />
                )}
              </Field>
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
                  { value: "__any__", label: copy.allRisks },
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
                <Button type="submit" variant="primary">
                  {copy.apply}
                </Button>
                <Button type="button" variant="outline" onClick={view.resetReleaseFilters}>
                  <RotateCcw className="size-3.5" />
                  {copy.reset}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
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
      </DialogContent>
    </Dialog>
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
    <Card>
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {data.items.map((release) => (
          <Card key={release.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-mono text-sm font-semibold">
                  {release.releaseVersion}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.schema}: {release.schemaTarget}
                </p>
              </div>
              <Badge tone="neutral">{release.riskLevel}</Badge>
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
              <p className="mt-3 rounded-md bg-warn-50 p-2 text-xs text-warn-800 dark:bg-warn-950/40 dark:text-warn-200">
                {copy.manifestUnavailable}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
      <Pagination
        page={data.page}
        limit={data.limit}
        totalItems={data.total}
        totalPages={data.totalPages}
        onPageChange={onPage}
      />
    </Card>
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
  const { lang: currentLang } = useI18n();
  const toast = useToast();
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

  const submit = async () => {
    setConfirming(false);
    const result = await view.runDiscovery(command);
    if (result) {
      toast.success(
        currentLang === "ar" ? "تم إنشاء عملية الاكتشاف" : "Discovery run created",
        `${copy.created} ${result.runId}`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">{copy.startDiscovery}</h2>
              <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                {copy.permissionRun}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={view.refreshDiscovery}
              loading={view.discovery.isRefreshing}
            >
              <RefreshCw className="size-3.5" />
              {copy.refresh}
            </Button>
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
              <Field label={copy.cutoff}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="datetime-local"
                    step={1}
                    value={isoToLocalInput(command.cutoffAt)}
                    onChange={(event) =>
                      setCommand((current) => ({
                        ...current,
                        cutoffAt: localInputToIso(event.target.value),
                      }))
                    }
                  />
                )}
              </Field>
              <Field label={copy.maxTenants}>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
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
                  />
                )}
              </Field>
              <div className="flex justify-end md:col-span-3">
                <Button type="button" variant="primary" onClick={requestConfirmation}>
                  {copy.validate}
                </Button>
              </div>
            </div>
          ) : null}
          {validation ? (
            <p role="alert" className="mt-3 text-xs font-semibold text-danger-600 dark:text-danger-400">
              {validation}
            </p>
          ) : null}
          {view.mutation.error ? (
            <AmbiguousOutcomePanel
              className="mt-3"
              message={view.mutation.error.message}
              correlationId={view.mutation.error.correlationId}
              retrying={view.mutation.isPending}
              onRetryExact={
                view.mutation.exactRetryAvailable
                  ? () => void view.runDiscovery(command)
                  : undefined
              }
            />
          ) : null}
        </CardContent>
      </Card>

      <DiscoveryState view={view.discovery} copy={copy} retry={view.refreshDiscovery}>
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

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmationTitle}</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">{copy.confirmationText}</p>
          </AlertDialogHeader>
          <Field label={copy.confirmationToken}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.close}</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={confirmation !== "RUN" || view.mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirmation !== "RUN") return;
                void submit();
              }}
            >
              {view.mutation.isPending ? copy.running : copy.run}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const columns: ColumnDef<DiscoveryRun>[] = [
    {
      key: "mode",
      headerEn: COPY.en.mode,
      headerAr: COPY.ar.mode,
      cell: (run) => (
        <div>
          <Badge tone="neutral">{run.mode}</Badge>
          <p className="mt-2 max-w-44 break-all font-mono text-xs text-muted-foreground">
            {run.runId}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      headerEn: COPY.en.status,
      headerAr: COPY.ar.status,
      cell: (run) => (
        <div>
          <Badge tone="neutral">{run.status}</Badge>
          {run.safeErrorCode ? (
            <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">{run.safeErrorCode}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "scheduled",
      headerEn: COPY.en.scheduled,
      headerAr: COPY.ar.scheduled,
      cell: (run) => <span className="text-xs">{formatDate(run.scheduledAt, lang, true)}</span>,
    },
    {
      key: "scanned",
      headerEn: COPY.en.scanned,
      headerAr: COPY.ar.scanned,
      cell: (run) => (
        <div className="font-mono text-xs">
          {run.scannedCount} / {run.eligibleTenantCount}
          <p className="mt-1 text-muted-foreground">
            {copy.remaining}: {run.remainingTenantCount}
          </p>
        </div>
      ),
    },
    {
      key: "drifted",
      headerEn: COPY.en.drifted,
      headerAr: COPY.ar.drifted,
      cell: (run) => <span className="font-mono font-semibold">{run.driftedCount}</span>,
    },
    {
      key: "incompatible",
      headerEn: COPY.en.incompatible,
      headerAr: COPY.ar.incompatible,
      cell: (run) => <span className="font-mono font-semibold">{run.incompatibleCount}</span>,
    },
    {
      key: "actions",
      headerEn: "",
      headerAr: "",
      align: "end",
      cell: (run) => (
        <Button type="button" variant="outline" size="sm" onClick={() => onInspect(run.runId)}>
          {copy.inspect}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <DataTable columns={columns} data={runs} getRowId={(row) => row.runId} pagination={{ page: 1, limit: runs.length || 1, totalItems: runs.length, totalPages: 1, onPageChange: () => undefined }} />
      <p className="border-t border-border px-4 py-3 break-all font-mono text-xs text-muted-foreground">
        {copy.correlation}: {correlationId} · {copy.responseAt}: {formatDate(timestamp, lang, true)}
      </p>
    </Card>
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
    <Dialog open onOpenChange={(open) => !open && view.selectRun(null)}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.results}</DialogTitle>
          <p className="break-all font-mono text-xs text-muted-foreground">{view.selectedRunId}</p>
        </DialogHeader>
        <DetailState view={view.detail} copy={copy}>
          {(detail) => <DiscoveryResults detail={detail} copy={copy} lang={lang} />}
        </DetailState>
      </DialogContent>
    </Dialog>
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
  const columns: ColumnDef<DiscoveryRunDetail["results"][number]>[] = [
    {
      key: "tenant",
      headerEn: COPY.en.tenant,
      headerAr: COPY.ar.tenant,
      cell: (result) => <span className="break-all font-mono text-xs">{result.tenantId}</span>,
    },
    {
      key: "component",
      headerEn: COPY.en.component,
      headerAr: COPY.ar.component,
      cell: (result) => <span className="break-all font-mono text-xs">{result.componentId}</span>,
    },
    {
      key: "status",
      headerEn: COPY.en.status,
      headerAr: COPY.ar.status,
      cell: (result) => <Badge tone="neutral">{result.discoveredState}</Badge>,
    },
    {
      key: "observed",
      headerEn: COPY.en.observed,
      headerAr: COPY.ar.observed,
      cell: (result) => <span className="text-xs">{formatDate(result.observedAt, lang, true)}</span>,
    },
    {
      key: "safeCode",
      headerEn: COPY.en.safeCode,
      headerAr: COPY.ar.safeCode,
      cell: (result) => <span className="text-xs">{result.safeCode ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      {detail.resultsTruncated ? (
        <p role="status" className="rounded-md bg-warn-50 p-2 text-xs font-semibold text-warn-800 dark:bg-warn-950/40 dark:text-warn-200">
          {copy.truncated}
        </p>
      ) : null}
      {detail.results.length ? (
        <Card>
          <DataTable
            columns={columns}
            data={detail.results}
            getRowId={(row) => `${row.tenantId}:${row.componentId}`}
            pagination={{ page: 1, limit: detail.results.length || 1, totalItems: detail.results.length, totalPages: 1, onPageChange: () => undefined }}
          />
        </Card>
      ) : (
        <EmptyState title={copy.emptyRuns} />
      )}
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
  if (view.state === "LOADING") return <Skeleton className="h-48 w-full rounded-lg" />;
  if (view.state === "FORBIDDEN") return <PermissionRequiredPanel title={forbidden} />;
  if (view.state === "UNAVAILABLE" || view.state === "ERROR")
    return <ErrorState title={view.state === "UNAVAILABLE" ? copy.unavailable : copy.error} error={view.error} onRetry={retry} />;
  if (view.state === "EMPTY" || !view.data?.items.length) return <EmptyState title={empty} />;
  return <>{children(view.data)}</>;
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
  if (view.state === "LOADING") return <Skeleton className="h-48 w-full rounded-lg" />;
  if (view.state === "FORBIDDEN") return <PermissionRequiredPanel title={copy.forbiddenDiscovery} />;
  if (view.state === "UNAVAILABLE" || view.state === "ERROR")
    return <ErrorState title={view.state === "UNAVAILABLE" ? copy.unavailable : copy.error} error={view.error} onRetry={retry} />;
  if (view.state === "EMPTY" || !view.data) return <EmptyState title={copy.emptyRuns} />;
  return <>{children(view.data)}</>;
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
  if (view.state === "LOADING") return <Skeleton className="h-48 w-full rounded-lg" />;
  if (view.state === "FORBIDDEN") return <PermissionRequiredPanel title={copy.forbiddenDiscovery} />;
  if (view.state === "UNAVAILABLE" || view.state === "ERROR")
    return <ErrorState title={view.state === "UNAVAILABLE" ? copy.unavailable : copy.error} error={view.error} />;
  if (!view.data) return <EmptyState title={copy.emptyRuns} />;
  return <>{children(view.data)}</>;
}

function PermissionRequiredPanel({ title }: { title: string }) {
  return (
    <section role="alert" className="flex min-h-48 flex-col items-center justify-center gap-1 rounded-lg border border-border p-6 text-center">
      <ShieldAlert className="mb-2 size-8 text-ink-300 dark:text-ink-600" aria-hidden="true" />
      <h2 className="font-semibold text-foreground">{title}</h2>
    </section>
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
  const resolved = value === "" ? "__any__" : value;
  return (
    <Field label={label}>
      {(fieldProps) => (
        <Select
          value={resolved}
          onValueChange={(next) => onChange(next === "__any__" ? "" : next)}
        >
          <SelectTrigger id={fieldProps.id} aria-describedby={fieldProps["aria-describedby"]}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value === "" ? "__any__" : option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-100 p-2 dark:bg-ink-800">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
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
