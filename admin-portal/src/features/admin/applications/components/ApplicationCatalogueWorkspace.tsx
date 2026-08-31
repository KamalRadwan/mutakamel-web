import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Boxes,
  DollarSign,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmActionModal,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useApplicationCatalogue } from "../hooks/useApplicationCatalogue";
import type {
  BillingCycle,
  CreateFeatureDto,
  CreateTierDto,
  FeatureView,
  PriceTierInput,
  TierView,
  UpdateFeatureDto,
  UpdateTierDto,
} from "../types";
import { CatalogueResourceDialog } from "./CatalogueResourceDialog";

type Tab = "tiers" | "features" | "grants" | "pricing" | "audit";

interface Props {
  applicationId: string;
  applicationKey: string;
  canRead: boolean;
  canCreate: boolean;
  canMutate: boolean;
}

const decimalPattern = /^\d{1,18}(?:\.\d{1,4})?$/;
const CRM_OUTBOUND_EMAIL_DEFAULT_CONFIG = JSON.stringify({ dailyQuota: 1000, rateLimitPerMin: 30 });

export function ApplicationCatalogueWorkspace({ applicationId, applicationKey, canRead, canCreate, canMutate }: Props) {
  const { lang, dir } = useI18n();
  const copy = catalogueCopy(lang);
  const catalogue = useApplicationCatalogue(canRead ? applicationId : null);
  const [tab, setTab] = useState<Tab>("tiers");
  const [dialog, setDialog] = useState<{ kind: "tier" | "feature"; resource?: TierView | FeatureView } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "tier" | "feature"; resource: TierView | FeatureView } | null>(null);
  const [grantConfig, setGrantConfig] = useState<Record<string, string>>({});
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [brackets, setBrackets] = useState<PriceTierInput[]>([{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }]);
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const selectedTier = catalogue.tiers.find((tier) => tier.id === catalogue.selectedTierId) ?? null;
  const tierContextReady = selectedTier !== null && catalogue.loadedTierId === selectedTier.id;
  const grantedIds = selectedGrantIds;
  const visibleError = formError || catalogue.catalogueError || catalogue.tierDetailError;

  useEffect(() => {
    queueMicrotask(() => {
      setDialog(null);
      setDeleteTarget(null);
      setFormError(null);
      setSelectedGrantIds(new Set());
      setGrantConfig({});
      setBrackets([{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }]);
    });
  }, [applicationId]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedGrantIds(new Set(catalogue.grants.map((grant) => grant.featureId)));
      setGrantConfig(Object.fromEntries(catalogue.grants.map((grant) => [grant.featureId, grant.config ? JSON.stringify(grant.config) : ""])));
    });
  }, [catalogue.grants]);

  useEffect(() => {
    queueMicrotask(() => {
      const rows = catalogue.prices.filter((row) => row.billingCycle === cycle);
      setBrackets(rows.length
        ? rows.map((row) => ({ minUsers: row.minUsers, maxUsers: row.maxUsers, unitPrice: row.unitPrice }))
        : [{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }]);
    });
  }, [catalogue.prices, cycle]);

  useEffect(() => {
    if (visibleError) requestAnimationFrame(() => errorRef.current?.focus());
  }, [visibleError]);

  if (!canRead) {
    return (
      <section className="rounded-lg border border-warning bg-warning-subtle p-5 text-sm text-warning-subtle-foreground">
        {copy.readPermission} <code dir="ltr">admin.catalog.read</code>.
      </section>
    );
  }

  const saveGrants = async () => {
    if (!selectedTier || !tierContextReady) return;
    setFormError(null);
    try {
      const features = catalogue.features
        .filter((feature) => grantedIds.has(feature.id))
        .map((feature) => {
          const raw = grantConfig[feature.id]?.trim();
          if (!raw) return { featureId: feature.id };
          const config = JSON.parse(raw) as Record<string, unknown>;
          if (feature.key === "crm.outbound_email") {
            const keys = Object.keys(config).sort().join(",");
            if (keys !== "dailyQuota,rateLimitPerMin") throw new Error(copy.emailConfigKeys);
            const dailyQuota = config.dailyQuota;
            const rateLimitPerMin = config.rateLimitPerMin;
            if (!Number.isInteger(dailyQuota) || Number(dailyQuota) < 1 || Number(dailyQuota) > 1_000_000) {
              throw new Error(copy.emailDailyQuota);
            }
            if (!Number.isInteger(rateLimitPerMin) || Number(rateLimitPerMin) < 1 || Number(rateLimitPerMin) > 10_000) {
              throw new Error(copy.emailRateLimit);
            }
          }
          return { featureId: feature.id, config };
        });
      await catalogue.replaceGrants(selectedTier.id, { features });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : copy.invalidGrantConfig);
    }
  };

  const toggleGrant = (feature: FeatureView, checked: boolean) => {
    setFormError(null);
    setSelectedGrantIds((current) => {
      const next = new Set(current);
      if (checked) next.add(feature.id);
      else next.delete(feature.id);
      return next;
    });
    if (checked && feature.key === "crm.outbound_email") {
      setGrantConfig((current) => current[feature.id]?.trim()
        ? current
        : { ...current, [feature.id]: CRM_OUTBOUND_EMAIL_DEFAULT_CONFIG });
    }
  };

  const validateAndSavePrices = async () => {
    if (!selectedTier || !tierContextReady) return;
    setFormError(null);
    for (let index = 0; index < brackets.length; index += 1) {
      const row = brackets[index];
      const expectedMin = index === 0 ? 1 : (brackets[index - 1].maxUsers ?? 0) + 1;
      if (row.minUsers !== expectedMin) return setFormError(copy.bracketStart(index + 1, expectedMin));
      if (!decimalPattern.test(row.unitPrice)) return setFormError(copy.bracketDecimal(index + 1));
      if (typeof row.maxUsers === "number" && row.maxUsers < row.minUsers) return setFormError(copy.bracketRange(index + 1));
      if (index < brackets.length - 1 && row.maxUsers === null) return setFormError(copy.onlyFinalOpen);
      if (index === brackets.length - 1 && row.maxUsers !== null) return setFormError(copy.finalMustOpen);
    }
    await catalogue.replacePrices(selectedTier.id, { billingCycle: cycle, brackets });
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Boxes }> = [
    { id: "tiers", label: copy.tiers, icon: Boxes },
    { id: "features", label: copy.features, icon: BookOpen },
    { id: "grants", label: copy.entitlements, icon: ShieldCheck },
    { id: "pricing", label: copy.pricing, icon: DollarSign },
    { id: "audit", label: copy.audit, icon: History },
  ];

  return (
    <section dir={dir} className="overflow-hidden rounded-lg border border-border bg-card">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as Tab);
          setFormError(null);
        }}
      >
        <header className="border-b border-border px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-semibold text-primary">{copy.controlRail}</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{copy.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={catalogue.isLoading}
              onClick={() => {
                void catalogue.loadCatalogue();
                void catalogue.loadAudit();
              }}
              className="self-start"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {copy.refresh}
            </Button>
          </div>
          <TabsList aria-label={copy.sectionsLabel} className="mt-4 flex w-full justify-start overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="min-w-fit gap-2 px-3">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </header>

        {visibleError ? (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="m-4 rounded-md border border-destructive bg-destructive-subtle px-4 py-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:m-5"
          >
            {visibleError}
          </div>
        ) : null}

        {catalogue.pendingCreateAttempt ? (
          <div role="status" className="m-4 rounded-md border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning-subtle-foreground sm:m-5">
            <p className="font-semibold">{copy.pendingCreate(catalogue.pendingCreateAttempt.kind)}</p>
            <p className="mt-1">{copy.pendingCreateDescription}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={Boolean(catalogue.pendingAction) && !catalogue.pendingCreateAttempt.absenceConfirmed}
                onClick={() => void catalogue.recoverPendingCreateAttempt()}
              >
                {copy.checkResult}
              </Button>
              {catalogue.pendingCreateAttempt.absenceConfirmed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(catalogue.pendingAction)}
                  onClick={catalogue.clearAbsentPendingCreateAttempt}
                >
                  {copy.acceptAbsence}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <TabsContent value={tab} className="mt-0 p-4 sm:p-5">
          {catalogue.isLoading ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {copy.loadingCatalogue}
            </div>
          ) : tab === "tiers" ? (
            <ResourceTable
              title={copy.subscriptionTiers}
              emptyText={copy.noTiers}
              configuredLabel={copy.configured}
              addLabel={copy.add}
              activeLabel={copy.active}
              inactiveLabel={copy.inactive}
              rankLabel={copy.rank}
              actionsLabel={copy.actionsFor}
              editLabel={copy.edit}
              deleteLabel={copy.delete}
              rows={catalogue.tiers}
              canCreate={canCreate}
              canMutate={canMutate}
              onCreate={() => setDialog({ kind: "tier" })}
              onEdit={(resource) => setDialog({ kind: "tier", resource })}
              onDelete={(resource) => setDeleteTarget({ kind: "tier", resource })}
            />
          ) : tab === "features" ? (
            <ResourceTable
              title={copy.applicationFeatures}
              emptyText={copy.noFeatures}
              configuredLabel={copy.configured}
              addLabel={copy.add}
              activeLabel={copy.active}
              inactiveLabel={copy.inactive}
              rankLabel={copy.rank}
              actionsLabel={copy.actionsFor}
              editLabel={copy.edit}
              deleteLabel={copy.delete}
              rows={catalogue.features}
              canCreate={canCreate}
              canMutate={canMutate}
              onCreate={() => setDialog({ kind: "feature" })}
              onEdit={(resource) => setDialog({ kind: "feature", resource })}
              onDelete={(resource) => setDeleteTarget({ kind: "feature", resource })}
            />
          ) : tab === "grants" ? (
            <div className="space-y-4">
              <TierSelector
                label={copy.tier}
                placeholder={copy.selectTier}
                tiers={catalogue.tiers}
                selected={catalogue.selectedTierId}
                onChange={catalogue.setSelectedTierId}
              />
              {!selectedTier ? (
                <EmptyState text={copy.createTierForFeatures} />
              ) : catalogue.isTierLoading ? (
                <Loading text={copy.loadingTier} />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {catalogue.features.map((feature) => {
                    const grant = catalogue.grants.find((item) => item.featureId === feature.id);
                    const isGranted = grantedIds.has(feature.id);
                    const checkboxId = `catalogue-grant-${feature.id}`;
                    return (
                      <div key={feature.id} className="rounded-md border border-border p-4">
                        <div className="flex min-h-11 items-start gap-3">
                          <Checkbox
                            id={checkboxId}
                            checked={isGranted}
                            onCheckedChange={(checked) => toggleGrant(feature, checked === true)}
                            disabled={!canMutate}
                            aria-describedby={`${checkboxId}-key`}
                            className="mt-1"
                          />
                          <label htmlFor={checkboxId} className="min-w-0 cursor-pointer text-sm font-semibold text-foreground">
                            <span className="block">{feature.name}</span>
                            <code id={`${checkboxId}-key`} dir="ltr" className="text-xs font-normal text-info-subtle-foreground">
                              {feature.key}
                            </code>
                          </label>
                        </div>
                        {isGranted ? (
                          <Field
                            className="mt-3"
                            label={copy.configurationJson(feature.name)}
                            hint={copy.configurationHint}
                          >
                            {(field) => (
                              <Textarea
                                {...field}
                                value={grantConfig[feature.id] ?? (grant?.config ? JSON.stringify(grant.config) : "")}
                                onChange={(event) => {
                                  setFormError(null);
                                  setGrantConfig((current) => ({ ...current, [feature.id]: event.target.value }));
                                }}
                                disabled={!canMutate}
                                rows={3}
                                dir="ltr"
                                className="font-mono text-sm"
                              />
                            )}
                          </Field>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedTier && canMutate ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={Boolean(catalogue.pendingAction)}
                  disabled={!tierContextReady}
                  onClick={() => void saveGrants()}
                  className="w-full sm:w-auto"
                >
                  {copy.replaceEntitlements}
                </Button>
              ) : null}
            </div>
          ) : tab === "pricing" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <TierSelector
                  label={copy.tier}
                  placeholder={copy.selectTier}
                  tiers={catalogue.tiers}
                  selected={catalogue.selectedTierId}
                  onChange={catalogue.setSelectedTierId}
                />
                <Field label={copy.billingCycle}>
                  {(field) => (
                    <Select value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)}>
                      <SelectTrigger {...field}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">{copy.monthly}</SelectItem>
                        <SelectItem value="ANNUAL">{copy.annual}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
              {!selectedTier ? (
                <EmptyState text={copy.createTierForPricing} />
              ) : !tierContextReady ? (
                <Loading text={copy.loadingTier} />
              ) : (
                <div className="space-y-3">
                  {brackets.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
                      <NumberField
                        label={copy.minimumUsers}
                        value={row.minUsers}
                        disabled={!canMutate}
                        onChange={(value) => {
                          setFormError(null);
                          setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, minUsers: value } : item));
                        }}
                      />
                      <Field label={copy.maximumUsers} hint={index === brackets.length - 1 ? copy.openEndedHint : undefined}>
                        {(field) => (
                          <Input
                            {...field}
                            value={row.maxUsers ?? ""}
                            disabled={!canMutate || index === brackets.length - 1}
                            placeholder={copy.openEnded}
                            onChange={(event) => {
                              setFormError(null);
                              setBrackets((current) => current.map((item, rowIndex) => rowIndex === index
                                ? { ...item, maxUsers: event.target.value ? Number(event.target.value) : null }
                                : item));
                            }}
                            type="number"
                            min={1}
                            className="font-mono"
                          />
                        )}
                      </Field>
                      <Field label={copy.usdPerUser}>
                        {(field) => (
                          <Input
                            {...field}
                            value={row.unitPrice}
                            disabled={!canMutate}
                            inputMode="decimal"
                            onChange={(event) => {
                              setFormError(null);
                              setBrackets((current) => current.map((item, rowIndex) => rowIndex === index
                                ? { ...item, unitPrice: event.target.value }
                                : item));
                            }}
                            dir="ltr"
                            className="font-mono"
                          />
                        )}
                      </Field>
                      {canMutate && brackets.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={copy.removeBracket(index + 1)}
                          onClick={() => {
                            setFormError(null);
                            setBrackets((current) => current.filter((_, rowIndex) => rowIndex !== index));
                          }}
                          className="self-end text-destructive"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {canMutate ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFormError(null);
                          setBrackets((current) => {
                            const previous = current[current.length - 1];
                            const previousMax = previous.maxUsers ?? previous.minUsers;
                            return [
                              ...current.map((item, itemIndex) => itemIndex === current.length - 1 ? { ...item, maxUsers: previousMax } : item),
                              { minUsers: previousMax + 1, maxUsers: null, unitPrice: previous.unitPrice },
                            ];
                          });
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        {copy.addBracket}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        loading={Boolean(catalogue.pendingAction)}
                        disabled={!tierContextReady}
                        onClick={() => void validateAndSavePrices()}
                      >
                        {copy.replaceLadder(cycle)}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {catalogue.auditError ? (
                <EmptyState text={catalogue.auditError} />
              ) : !catalogue.audit?.items.length ? (
                <EmptyState text={copy.noAuditEvents} />
              ) : catalogue.audit.items.map((event) => (
                <article key={event.id} className="rounded-md border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <code dir="ltr" className="text-sm font-semibold text-info-subtle-foreground">{event.action}</code>
                    <time dateTime={event.occurredAt} className="text-sm text-muted-foreground">
                      {new Date(event.occurredAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                    </time>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {event.actorLabel || event.actorAdminId || copy.system} · {event.entityType}
                  </p>
                  <p dir="ltr" className="mt-1 break-all font-mono text-sm text-muted-foreground">
                    {copy.correlation}: {event.correlationId || copy.notProvided}
                  </p>
                </article>
              ))}
              {catalogue.audit && catalogue.audit.totalPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>{copy.pageOf(catalogue.audit.page, catalogue.audit.totalPages)}</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={catalogue.audit.page <= 1}
                      onClick={() => void catalogue.loadAudit(catalogue.audit!.page - 1)}
                    >
                      {copy.previous}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={catalogue.audit.page >= catalogue.audit.totalPages}
                      onClick={() => void catalogue.loadAudit(catalogue.audit!.page + 1)}
                    >
                      {copy.next}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CatalogueResourceDialog
        kind={dialog?.kind ?? "tier"}
        applicationKey={applicationKey}
        resource={dialog?.resource}
        isOpen={Boolean(dialog)}
        isSubmitting={Boolean(catalogue.pendingAction)}
        onClose={() => setDialog(null)}
        onSubmit={async (dto) => {
          if (dialog?.kind === "tier") {
            if (dialog.resource) await catalogue.updateTier(dialog.resource.id, dto as UpdateTierDto);
            else await catalogue.createTier(dto as CreateTierDto);
          } else if (dialog?.resource) await catalogue.updateFeature(dialog.resource.id, dto as UpdateFeatureDto);
          else await catalogue.createFeature(dto as CreateFeatureDto);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "tier") await catalogue.deleteTier(deleteTarget.resource.id);
          else await catalogue.deleteFeature(deleteTarget.resource.id);
          setDeleteTarget(null);
        }}
        titleEn={`Delete ${deleteTarget?.kind ?? "resource"}`}
        titleAr={`حذف ${deleteTarget?.kind === "tier" ? "الباقة" : "الميزة"}`}
        descriptionEn="This removes the catalogue resource. Referenced tiers may need to be deactivated instead."
        descriptionAr="يؤدي هذا إلى إزالة مورد الكتالوج. قد يلزم تعطيل الباقات المرتبطة بدلاً من حذفها."
        confirmTextEn="Delete resource"
        confirmTextAr="حذف المورد"
        requiredConfirmationText={deleteTarget?.resource.name}
        isLoading={Boolean(catalogue.pendingAction)}
      />
    </section>
  );
}

interface ResourceTableProps<T extends TierView | FeatureView> {
  title: string;
  emptyText: string;
  configuredLabel: string;
  addLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  rankLabel: string;
  actionsLabel: (name: string) => string;
  editLabel: string;
  deleteLabel: string;
  rows: T[];
  canCreate: boolean;
  canMutate: boolean;
  onCreate: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
}

function ResourceTable<T extends TierView | FeatureView>({
  title,
  emptyText,
  configuredLabel,
  addLabel,
  activeLabel,
  inactiveLabel,
  rankLabel,
  actionsLabel,
  editLabel,
  deleteLabel,
  rows,
  canCreate,
  canMutate,
  onCreate,
  onEdit,
  onDelete,
}: ResourceTableProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{rows.length} {configuredLabel}</p>
        </div>
        {canCreate ? (
          <Button type="button" variant="primary" size="sm" onClick={onCreate} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {!rows.length ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <div key={row.id} className="flex min-w-0 items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{row.name}</span>
                  <Badge tone={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? activeLabel : inactiveLabel}
                  </Badge>
                </div>
                <code dir="ltr" className="break-all text-sm text-info-subtle-foreground">{row.key}</code>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rankLabel} {row.rank}{"color" in row ? ` · ${row.color}` : ""}
                </p>
              </div>
              {canMutate ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label={actionsLabel(row.name)}>
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(row)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {editLabel}
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => onDelete(row)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      {deleteLabel}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TierSelector({ label, placeholder, tiers, selected, onChange }: {
  label: string;
  placeholder: string;
  tiers: TierView[];
  selected: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} className="w-full sm:max-w-sm">
      {(field) => (
        <Select value={selected ?? undefined} onValueChange={onChange}>
          <SelectTrigger {...field}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {tiers.map((tier) => <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function NumberField({ label, value, disabled, onChange }: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      {(field) => (
        <Input
          {...field}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          type="number"
          min={1}
          className="font-mono"
        />
      )}
    </Field>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </div>
  );
}

function catalogueCopy(lang: "ar" | "en") {
  if (lang === "ar") {
    return {
      readPermission: "يتطلب الوصول إلى الكتالوج التجاري صلاحية",
      emailConfigKeys: "يتطلب إعداد بريد CRM الصادر الحقلين dailyQuota وrateLimitPerMin فقط.",
      emailDailyQuota: "يجب أن تكون dailyQuota عدداً صحيحاً من 1 إلى 1,000,000.",
      emailRateLimit: "يجب أن تكون rateLimitPerMin عدداً صحيحاً من 1 إلى 10,000.",
      invalidGrantConfig: "إعداد الميزة غير صالح.",
      bracketStart: (row: number, minimum: number) => `يجب أن تبدأ الشريحة ${row} عند ${minimum}.`,
      bracketDecimal: (row: number) => `سعر الشريحة ${row} العشري غير صالح.`,
      bracketRange: (row: number) => `يجب أن تنتهي الشريحة ${row} عند الحد الأدنى أو بعده.`,
      onlyFinalOpen: "يمكن أن تكون الشريحة الأخيرة فقط مفتوحة النهاية.",
      finalMustOpen: "يجب أن تكون الشريحة الأخيرة مفتوحة النهاية.",
      tiers: "الباقات",
      features: "الميزات",
      entitlements: "الاستحقاقات",
      pricing: "التسعير",
      audit: "التدقيق",
      controlRail: "مسار التحكم التجاري",
      title: "إعداد الكتالوج",
      description: "حدّد ما يمكن للمستأجرين الاشتراك فيه، وما تتيحه كل باقة، وكيف يعمل تسعير الدولار المتدرج.",
      refresh: "تحديث",
      sectionsLabel: "أقسام الكتالوج",
      pendingCreate: (kind: string) => `نتيجة إنشاء ${kind} السابق غير معروفة.`,
      pendingCreateDescription: "ستفحص البوابة الكتالوج الموثوق فقط، ولن تعيد تلقائياً طلب الإنشاء غير الآمن للتكرار.",
      checkResult: "فحص نتيجة الكتالوج",
      acceptAbsence: "قبول الغياب الموثوق",
      loadingCatalogue: "جارٍ تحميل الكتالوج…",
      subscriptionTiers: "باقات الاشتراك",
      applicationFeatures: "ميزات التطبيق",
      noTiers: "لا توجد باقات اشتراك مُعدّة.",
      noFeatures: "لا توجد ميزات تطبيق مُعدّة.",
      configured: "مُعدّ",
      add: "إضافة",
      active: "نشط",
      inactive: "غير نشط",
      rank: "الترتيب",
      actionsFor: (name: string) => `إجراءات ${name}`,
      edit: "تعديل",
      delete: "حذف",
      tier: "الباقة",
      selectTier: "اختر باقة",
      createTierForFeatures: "أنشئ باقة قبل تعيين الميزات.",
      createTierForPricing: "أنشئ باقة قبل تحديد التسعير.",
      loadingTier: "جارٍ تحميل إعداد الباقة…",
      configurationJson: (name: string) => `إعداد ${name} بصيغة JSON`,
      configurationHint: "إعداد JSON اختياري. تُطبق القيود الخاصة بالميزة عند الحفظ.",
      replaceEntitlements: "استبدال مجموعة الاستحقاقات كاملة",
      billingCycle: "دورة الفوترة",
      monthly: "شهري",
      annual: "سنوي",
      minimumUsers: "الحد الأدنى للمستخدمين",
      maximumUsers: "الحد الأقصى للمستخدمين",
      openEndedHint: "يجب أن تظل الشريحة الأخيرة مفتوحة النهاية.",
      openEnded: "مفتوحة النهاية",
      usdPerUser: "دولار لكل مستخدم",
      removeBracket: (row: number) => `إزالة الشريحة ${row}`,
      addBracket: "إضافة شريحة",
      replaceLadder: (billingCycle: BillingCycle) => `استبدال سلم ${billingCycle === "MONTHLY" ? "التسعير الشهري" : "التسعير السنوي"}`,
      noAuditEvents: "لا توجد أحداث تدقيق خاصة بالتطبيق.",
      system: "النظام",
      correlation: "معرّف الارتباط",
      notProvided: "غير متوفر",
      pageOf: (page: number, total: number) => `الصفحة ${page} من ${total}`,
      previous: "السابق",
      next: "التالي",
    };
  }

  return {
    readPermission: "Commercial catalogue access requires",
    emailConfigKeys: "CRM outbound email config requires exactly dailyQuota and rateLimitPerMin.",
    emailDailyQuota: "CRM outbound email dailyQuota must be an integer from 1 to 1,000,000.",
    emailRateLimit: "CRM outbound email rateLimitPerMin must be an integer from 1 to 10,000.",
    invalidGrantConfig: "Grant configuration is invalid.",
    bracketStart: (row: number, minimum: number) => `Bracket ${row} must begin at ${minimum}.`,
    bracketDecimal: (row: number) => `Bracket ${row} has an invalid decimal price.`,
    bracketRange: (row: number) => `Bracket ${row} must end at or after its minimum user count.`,
    onlyFinalOpen: "Only the final bracket may be open-ended.",
    finalMustOpen: "The final bracket must be open-ended.",
    tiers: "Tiers",
    features: "Features",
    entitlements: "Entitlements",
    pricing: "Pricing",
    audit: "Audit",
    controlRail: "Commercial control rail",
    title: "Catalogue configuration",
    description: "Define what tenants can subscribe to, what each tier unlocks, and how graduated USD pricing behaves.",
    refresh: "Refresh",
    sectionsLabel: "Catalogue sections",
    pendingCreate: (kind: string) => `Previous ${kind} create outcome is unknown.`,
    pendingCreateDescription: "The portal will only inspect the authoritative catalogue; it will not replay this non-idempotent create automatically.",
    checkResult: "Check catalogue result",
    acceptAbsence: "Accept authoritative absence",
    loadingCatalogue: "Loading catalogue…",
    subscriptionTiers: "Subscription tiers",
    applicationFeatures: "Application features",
    noTiers: "No subscription tiers configured.",
    noFeatures: "No application features configured.",
    configured: "configured",
    add: "Add",
    active: "Active",
    inactive: "Inactive",
    rank: "Rank",
    actionsFor: (name: string) => `Actions for ${name}`,
    edit: "Edit",
    delete: "Delete",
    tier: "Tier",
    selectTier: "Select tier",
    createTierForFeatures: "Create a tier before assigning features.",
    createTierForPricing: "Create a tier before defining pricing.",
    loadingTier: "Loading tier configuration…",
    configurationJson: (name: string) => `${name} configuration JSON`,
    configurationHint: "Optional JSON configuration. Feature-specific limits are enforced when you save.",
    replaceEntitlements: "Replace complete entitlement set",
    billingCycle: "Billing cycle",
    monthly: "Monthly",
    annual: "Annual",
    minimumUsers: "Minimum users",
    maximumUsers: "Maximum users",
    openEndedHint: "The final bracket must remain open-ended.",
    openEnded: "Open ended",
    usdPerUser: "USD per user",
    removeBracket: (row: number) => `Remove bracket ${row}`,
    addBracket: "Add bracket",
    replaceLadder: (billingCycle: BillingCycle) => `Replace ${billingCycle.toLowerCase()} ladder`,
    noAuditEvents: "No application-scoped audit events.",
    system: "System",
    correlation: "Correlation",
    notProvided: "not provided",
    pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
    previous: "Previous",
    next: "Next",
  };
}
