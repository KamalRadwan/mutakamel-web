import { useEffect, useMemo, useState } from "react";
import { BookOpen, Boxes, DollarSign, History, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { DestructiveActionModal } from "@/components/shared/DestructiveActionModal";
import { useApplicationCatalogue } from "../hooks/useApplicationCatalogue";
import type { BillingCycle, CreateFeatureDto, CreateTierDto, FeatureView, PriceTierInput, TierView, UpdateFeatureDto, UpdateTierDto } from "../types";
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
  const catalogue = useApplicationCatalogue(canRead ? applicationId : null);
  const [tab, setTab] = useState<Tab>("tiers");
  const [dialog, setDialog] = useState<{ kind: "tier" | "feature"; resource?: TierView | FeatureView } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "tier" | "feature"; resource: TierView | FeatureView } | null>(null);
  const [grantConfig, setGrantConfig] = useState<Record<string, string>>({});
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [brackets, setBrackets] = useState<PriceTierInput[]>([{ minUsers: 1, maxUsers: null, unitPrice: "0.0000" }]);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTier = catalogue.tiers.find((tier) => tier.id === catalogue.selectedTierId) ?? null;
  const tierContextReady =
    selectedTier !== null && catalogue.loadedTierId === selectedTier.id;
  const grantedIds = useMemo(() => selectedGrantIds, [selectedGrantIds]);

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

  if (!canRead) {
    return <section className="rounded-xl border border-warn-200 bg-warn-50 p-5 text-sm text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-200">Commercial catalogue access requires <code>admin.catalog.read</code>.</section>;
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
            if (keys !== "dailyQuota,rateLimitPerMin") throw new Error("CRM outbound email config requires exactly dailyQuota and rateLimitPerMin.");
            const dailyQuota = config.dailyQuota;
            const rateLimitPerMin = config.rateLimitPerMin;
            if (!Number.isInteger(dailyQuota) || Number(dailyQuota) < 1 || Number(dailyQuota) > 1_000_000) {
              throw new Error("CRM outbound email dailyQuota must be an integer from 1 to 1,000,000.");
            }
            if (!Number.isInteger(rateLimitPerMin) || Number(rateLimitPerMin) < 1 || Number(rateLimitPerMin) > 10_000) {
              throw new Error("CRM outbound email rateLimitPerMin must be an integer from 1 to 10,000.");
            }
          }
          return { featureId: feature.id, config };
        });
      await catalogue.replaceGrants(selectedTier.id, { features });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Grant configuration is invalid.");
    }
  };

  const toggleGrant = (feature: FeatureView, checked: boolean) => {
    setSelectedGrantIds((current) => {
      const next = new Set(current);
      if (checked) next.add(feature.id); else next.delete(feature.id);
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
      if (row.minUsers !== expectedMin) return setFormError(`Bracket ${index + 1} must begin at ${expectedMin}.`);
      if (!decimalPattern.test(row.unitPrice)) return setFormError(`Bracket ${index + 1} has an invalid decimal price.`);
      if (typeof row.maxUsers === "number" && row.maxUsers < row.minUsers) return setFormError(`Bracket ${index + 1} must end at or after its minimum user count.`);
      if (index < brackets.length - 1 && row.maxUsers === null) return setFormError("Only the final bracket may be open-ended.");
      if (index === brackets.length - 1 && row.maxUsers !== null) return setFormError("The final bracket must be open-ended.");
    }
    await catalogue.replacePrices(selectedTier.id, { billingCycle: cycle, brackets });
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Boxes }> = [
    { id: "tiers", label: "Tiers", icon: Boxes },
    { id: "features", label: "Features", icon: BookOpen },
    { id: "grants", label: "Entitlements", icon: ShieldCheck },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "audit", label: "Audit", icon: History },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 pt-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.22em] text-brand-700 dark:text-brand-400">Commercial control rail</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Catalogue configuration</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Define what tenants can subscribe to, what each tier unlocks, and how graduated USD pricing behaves.</p>
          </div>
          <button type="button" onClick={() => { void catalogue.loadCatalogue(); void catalogue.loadAudit(); }} className="inline-flex items-center gap-2 self-start rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <nav aria-label="Catalogue sections" className="mt-5 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex min-w-fit items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition ${tab === id ? "border-brand-600 text-brand-700 dark:text-brand-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>
      </header>

      {(catalogue.catalogueError || catalogue.tierDetailError || formError) && (
        <div role="alert" className="m-5 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-xs text-danger-700 dark:border-danger-800/60 dark:bg-danger-950/40 dark:text-danger-300">
          {formError || catalogue.catalogueError || catalogue.tierDetailError}
        </div>
      )}

      {catalogue.pendingCreateAttempt ? (
        <div role="status" className="m-5 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-xs text-warn-900 dark:border-warn-800/60 dark:bg-warn-950/40 dark:text-warn-200">
          <p className="font-semibold">Previous {catalogue.pendingCreateAttempt.kind} create outcome is unknown.</p>
          <p className="mt-1">The portal will only inspect the authoritative catalogue; it will not replay this non-idempotent create automatically.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void catalogue.recoverPendingCreateAttempt()} disabled={Boolean(catalogue.pendingAction)} className="rounded-lg border border-warn-300 bg-card px-3 py-2 font-semibold text-warn-900 disabled:opacity-50 dark:border-warn-800 dark:text-warn-200">Check catalogue result</button>
            {catalogue.pendingCreateAttempt.absenceConfirmed ? (
              <button type="button" onClick={catalogue.clearAbsentPendingCreateAttempt} disabled={Boolean(catalogue.pendingAction)} className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50">Accept authoritative absence</button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="p-5">
        {catalogue.isLoading ? (
          <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading catalogue…</div>
        ) : tab === "tiers" ? (
          <ResourceTable title="Subscription tiers" rows={catalogue.tiers} canCreate={canCreate} canMutate={canMutate} onCreate={() => setDialog({ kind: "tier" })} onEdit={(resource) => setDialog({ kind: "tier", resource })} onDelete={(resource) => setDeleteTarget({ kind: "tier", resource })} />
        ) : tab === "features" ? (
          <ResourceTable title="Application features" rows={catalogue.features} canCreate={canCreate} canMutate={canMutate} onCreate={() => setDialog({ kind: "feature" })} onEdit={(resource) => setDialog({ kind: "feature", resource })} onDelete={(resource) => setDeleteTarget({ kind: "feature", resource })} />
        ) : tab === "grants" ? (
          <div className="space-y-4">
            <TierSelector tiers={catalogue.tiers} selected={catalogue.selectedTierId} onChange={catalogue.setSelectedTierId} />
            {!selectedTier ? <EmptyState text="Create a tier before assigning features." /> : catalogue.isTierLoading ? <Loading /> : (
              <div className="grid gap-3 lg:grid-cols-2">
                {catalogue.features.map((feature) => {
                  const grant = catalogue.grants.find((item) => item.featureId === feature.id);
                  const isGranted = grantedIds.has(feature.id);
                  return (
                    <div key={feature.id} className="rounded-xl border border-border p-4">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={isGranted} onChange={(event) => toggleGrant(feature, event.target.checked)} disabled={!canMutate} className="mt-1 h-4 w-4 accent-brand-600" />
                        <span><span className="block text-sm font-semibold text-foreground">{feature.name}</span><code className="text-xs text-brand-700 dark:text-brand-400">{feature.key}</code></span>
                      </label>
                      {isGranted && (
                        <textarea aria-label={`${feature.name} configuration JSON`} placeholder='Optional JSON configuration, for example {"dailyQuota":1000,"rateLimitPerMin":30}' value={grantConfig[feature.id] ?? (grant?.config ? JSON.stringify(grant.config) : "")} onChange={(event) => setGrantConfig((current) => ({ ...current, [feature.id]: event.target.value }))} disabled={!canMutate} rows={2} className="mt-3 w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 font-mono text-xs outline-none focus:border-brand-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedTier && canMutate && <button type="button" onClick={() => void saveGrants()} disabled={Boolean(catalogue.pendingAction) || !tierContextReady} className="rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50">Replace complete entitlement set</button>}
          </div>
        ) : tab === "pricing" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <TierSelector tiers={catalogue.tiers} selected={catalogue.selectedTierId} onChange={catalogue.setSelectedTierId} />
              <select value={cycle} onChange={(event) => setCycle(event.target.value as BillingCycle)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
            </div>
            {!selectedTier ? <EmptyState text="Create a tier before defining pricing." /> : !tierContextReady ? <Loading /> : (
              <div className="space-y-3">
                {brackets.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <NumberField label="Minimum users" value={row.minUsers} disabled={!canMutate} onChange={(value) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, minUsers: value } : item))} />
                    <label className="text-xs font-semibold text-muted-foreground">Maximum users<input value={row.maxUsers ?? ""} disabled={!canMutate || index === brackets.length - 1} placeholder="Open ended" onChange={(event) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, maxUsers: event.target.value ? Number(event.target.value) : null } : item))} type="number" min={1} className="mt-1 block w-full rounded-lg border border-border bg-card px-2.5 py-2 font-mono text-xs text-foreground" /></label>
                    <label className="text-xs font-semibold text-muted-foreground">USD per user<input value={row.unitPrice} disabled={!canMutate} inputMode="decimal" onChange={(event) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, unitPrice: event.target.value } : item))} className="mt-1 block w-full rounded-lg border border-border bg-card px-2.5 py-2 font-mono text-xs text-foreground" /></label>
                    {canMutate && brackets.length > 1 && <button type="button" aria-label="Remove bracket" onClick={() => setBrackets((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="self-end rounded-lg p-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/30"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {canMutate && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setBrackets((current) => { const previous = current[current.length - 1]; const previousMax = previous.maxUsers ?? previous.minUsers; return [...current.map((item, index) => index === current.length - 1 ? { ...item, maxUsers: previousMax } : item), { minUsers: previousMax + 1, maxUsers: null, unitPrice: previous.unitPrice }]; })} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"><Plus className="me-1 inline h-3.5 w-3.5" />Add bracket</button><button type="button" onClick={() => void validateAndSavePrices()} disabled={Boolean(catalogue.pendingAction) || !tierContextReady} className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50">Replace {cycle.toLowerCase()} ladder</button></div>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {catalogue.auditError ? <EmptyState text={catalogue.auditError} /> : !catalogue.audit?.items.length ? <EmptyState text="No application-scoped audit events." /> : catalogue.audit.items.map((event) => (
              <article key={event.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-400">{event.action}</span><time className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</time></div>
                <p className="mt-2 text-xs text-foreground">{event.actorLabel || event.actorAdminId || "System"} · {event.entityType}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">Correlation: {event.correlationId || "not provided"}</p>
              </article>
            ))}
            {catalogue.audit && catalogue.audit.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Page {catalogue.audit.page} of {catalogue.audit.totalPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={catalogue.audit.page <= 1} onClick={() => void catalogue.loadAudit(catalogue.audit!.page - 1)} className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
                  <button type="button" disabled={catalogue.audit.page >= catalogue.audit.totalPages} onClick={() => void catalogue.loadAudit(catalogue.audit!.page + 1)} className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CatalogueResourceDialog kind={dialog?.kind ?? "tier"} applicationKey={applicationKey} resource={dialog?.resource} isOpen={Boolean(dialog)} isSubmitting={Boolean(catalogue.pendingAction)} onClose={() => setDialog(null)} onSubmit={async (dto) => {
        if (dialog?.kind === "tier") {
          if (dialog.resource) await catalogue.updateTier(dialog.resource.id, dto as UpdateTierDto); else await catalogue.createTier(dto as CreateTierDto);
        } else if (dialog?.resource) await catalogue.updateFeature(dialog.resource.id, dto as UpdateFeatureDto); else await catalogue.createFeature(dto as CreateFeatureDto);
      }} />

      <DestructiveActionModal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (!deleteTarget) return; const promise = deleteTarget.kind === "tier" ? catalogue.deleteTier(deleteTarget.resource.id) : catalogue.deleteFeature(deleteTarget.resource.id); void promise.then(() => setDeleteTarget(null)); }} title={`Delete ${deleteTarget?.kind ?? "resource"}`} description="This removes the catalogue resource. Referenced tiers may need to be deactivated instead." targetName={deleteTarget?.resource.name ?? ""} actionType="delete" requireNameTyping isSubmitting={Boolean(catalogue.pendingAction)} />
    </section>
  );
}

function ResourceTable<T extends TierView | FeatureView>({ title, rows, canCreate, canMutate, onCreate, onEdit, onDelete }: { title: string; rows: T[]; canCreate: boolean; canMutate: boolean; onCreate: () => void; onEdit: (row: T) => void; onDelete: (row: T) => void }) {
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="text-xs text-muted-foreground">{rows.length} configured</p></div>{canCreate && <button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-500"><Plus className="h-3.5 w-3.5" />Add</button>}</div>{!rows.length ? <EmptyState text={`No ${title.toLowerCase()} configured.`} /> : <div className="divide-y divide-border rounded-xl border border-border">{rows.map((row) => <div key={row.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-foreground">{row.name}</span><span className={`h-2 w-2 rounded-full ${row.isActive ? "bg-brand-500" : "bg-muted-foreground"}`} /></div><code className="text-xs text-brand-700 dark:text-brand-400">{row.key}</code><p className="mt-1 text-xs text-muted-foreground">Rank {row.rank}{"color" in row ? ` · ${row.color}` : ""}</p></div>{canMutate && <div className="flex gap-1"><button type="button" onClick={() => onEdit(row)} aria-label={`Edit ${row.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(row)} aria-label={`Delete ${row.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-950/30"><Trash2 className="h-4 w-4" /></button></div>}</div>)}</div>}</div>;
}

function TierSelector({ tiers, selected, onChange }: { tiers: TierView[]; selected: string | null; onChange: (value: string) => void }) {
  return <select aria-label="Tier" value={selected ?? ""} onChange={(event) => onChange(event.target.value)} className="min-w-56 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"><option value="" disabled>Select tier</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-muted-foreground">{label}<input value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} type="number" min={1} className="mt-1 block w-full rounded-lg border border-border bg-card px-2.5 py-2 font-mono text-xs text-foreground" /></label>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">{text}</div>; }
function Loading() { return <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading tier configuration…</div>; }
