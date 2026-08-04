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
  const grantedIds = useMemo(() => selectedGrantIds, [selectedGrantIds]);

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
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Commercial catalogue access requires <code>admin.catalog.read</code>.</section>;
  }

  const saveGrants = async () => {
    if (!selectedTier) return;
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

  const toggleGrant = (featureId: string) => {
    setSelectedGrantIds((current) => {
      const next = new Set(current);
      if (next.has(featureId)) next.delete(featureId); else next.add(featureId);
      return next;
    });
  };

  const validateAndSavePrices = async () => {
    if (!selectedTier) return;
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
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-slate-950 px-5 pt-5 text-white dark:border-slate-800">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Commercial control rail</p>
            <h2 className="mt-1 text-lg font-black">Catalogue configuration</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">Define what tenants can subscribe to, what each tier unlocks, and how graduated USD pricing behaves.</p>
          </div>
          <button type="button" onClick={() => { void catalogue.loadCatalogue(); void catalogue.loadAudit(); }} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <nav aria-label="Catalogue sections" className="mt-5 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex min-w-fit items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition ${tab === id ? "border-violet-400 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>
      </header>

      {(catalogue.catalogueError || catalogue.tierDetailError || formError) && (
        <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {formError || catalogue.catalogueError || catalogue.tierDetailError}
        </div>
      )}

      <div className="p-5">
        {catalogue.isLoading ? (
          <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading catalogue…</div>
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
                    <div key={feature.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={isGranted} onChange={() => toggleGrant(feature.id)} disabled={!canMutate} className="mt-1 h-4 w-4 accent-violet-600" />
                        <span><span className="block text-sm font-bold">{feature.name}</span><code className="text-[11px] text-violet-600 dark:text-violet-400">{feature.key}</code></span>
                      </label>
                      {isGranted && (
                        <textarea aria-label={`${feature.name} configuration JSON`} placeholder='Optional JSON configuration, for example {"dailyQuota":1000,"rateLimitPerMin":30}' value={grantConfig[feature.id] ?? (grant?.config ? JSON.stringify(grant.config) : "")} onChange={(event) => setGrantConfig((current) => ({ ...current, [feature.id]: event.target.value }))} disabled={!canMutate} rows={2} className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedTier && canMutate && <button type="button" onClick={() => void saveGrants()} disabled={Boolean(catalogue.pendingAction)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">Replace complete entitlement set</button>}
          </div>
        ) : tab === "pricing" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <TierSelector tiers={catalogue.tiers} selected={catalogue.selectedTierId} onChange={catalogue.setSelectedTierId} />
              <select value={cycle} onChange={(event) => setCycle(event.target.value as BillingCycle)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
            </div>
            {!selectedTier ? <EmptyState text="Create a tier before defining pricing." /> : (
              <div className="space-y-3">
                {brackets.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-slate-800">
                    <NumberField label="Minimum users" value={row.minUsers} disabled={!canMutate} onChange={(value) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, minUsers: value } : item))} />
                    <label className="text-[11px] font-bold text-slate-500">Maximum users<input value={row.maxUsers ?? ""} disabled={!canMutate || index === brackets.length - 1} placeholder="Open ended" onChange={(event) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, maxUsers: event.target.value ? Number(event.target.value) : null } : item))} type="number" min={1} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                    <label className="text-[11px] font-bold text-slate-500">USD per user<input value={row.unitPrice} disabled={!canMutate} inputMode="decimal" onChange={(event) => setBrackets((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, unitPrice: event.target.value } : item))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                    {canMutate && brackets.length > 1 && <button type="button" aria-label="Remove bracket" onClick={() => setBrackets((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="self-end rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {canMutate && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setBrackets((current) => { const previous = current[current.length - 1]; const previousMax = previous.maxUsers ?? previous.minUsers; return [...current.map((item, index) => index === current.length - 1 ? { ...item, maxUsers: previousMax } : item), { minUsers: previousMax + 1, maxUsers: null, unitPrice: previous.unitPrice }]; })} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Plus className="me-1 inline h-3.5 w-3.5" />Add bracket</button><button type="button" onClick={() => void validateAndSavePrices()} disabled={Boolean(catalogue.pendingAction)} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">Replace {cycle.toLowerCase()} ladder</button></div>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {catalogue.auditError ? <EmptyState text={catalogue.auditError} /> : !catalogue.audit?.items.length ? <EmptyState text="No application-scoped audit events." /> : catalogue.audit.items.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-black text-violet-600 dark:text-violet-400">{event.action}</span><time className="text-[11px] text-slate-500">{new Date(event.occurredAt).toLocaleString()}</time></div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{event.actorLabel || event.actorAdminId || "System"} · {event.entityType}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">Correlation: {event.correlationId || "not provided"}</p>
              </article>
            ))}
            {catalogue.audit && catalogue.audit.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <span>Page {catalogue.audit.page} of {catalogue.audit.totalPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={catalogue.audit.page <= 1} onClick={() => void catalogue.loadAudit(catalogue.audit!.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Previous</button>
                  <button type="button" disabled={catalogue.audit.page >= catalogue.audit.totalPages} onClick={() => void catalogue.loadAudit(catalogue.audit!.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 dark:border-slate-700">Next</button>
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
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-black">{title}</h3><p className="text-xs text-slate-500">{rows.length} configured</p></div>{canCreate && <button type="button" onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-500"><Plus className="h-3.5 w-3.5" />Add</button>}</div>{!rows.length ? <EmptyState text={`No ${title.toLowerCase()} configured.`} /> : <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{rows.map((row) => <div key={row.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-bold">{row.name}</span><span className={`h-2 w-2 rounded-full ${row.isActive ? "bg-emerald-500" : "bg-slate-400"}`} /></div><code className="text-[11px] text-violet-600 dark:text-violet-400">{row.key}</code><p className="mt-1 text-[11px] text-slate-500">Rank {row.rank}{"color" in row ? ` · ${row.color}` : ""}</p></div>{canMutate && <div className="flex gap-1"><button type="button" onClick={() => onEdit(row)} aria-label={`Edit ${row.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(row)} aria-label={`Delete ${row.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" /></button></div>}</div>)}</div>}</div>;
}

function TierSelector({ tiers, selected, onChange }: { tiers: TierView[]; selected: string | null; onChange: (value: string) => void }) {
  return <select aria-label="Tier" value={selected ?? ""} onChange={(event) => onChange(event.target.value)} className="min-w-56 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"><option value="" disabled>Select tier</option>{tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="text-[11px] font-bold text-slate-500">{label}<input value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} type="number" min={1} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" /></label>;
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-xs text-slate-500 dark:border-slate-700">{text}</div>; }
function Loading() { return <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading tier configuration…</div>; }
