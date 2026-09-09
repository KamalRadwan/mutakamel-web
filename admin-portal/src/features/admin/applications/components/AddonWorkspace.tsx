"use client";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useAddonWorkspace } from "../hooks/useAddonWorkspace";
import type { AddonAction } from "../hooks/useAddonDefinitionDialog";
import { addonCopy, type AddonCopy } from "../lib/addon-copy";
import { addonActionLabel, addonAuditLabel, addonLifecycleLabel } from "../lib/addon-presentation";
import type { AddonDefinition } from "../lib/addon-contract";
import { AddonDefinitionDialog } from "./AddonDefinitionDialog";
import { AddonPricingEditor } from "./AddonPricingEditor";

interface Props {
  applicationKey: string; addonKey: string; actorId: string; canReadTiers?: boolean; canUpdate: boolean; canCritical: boolean; canDelete: boolean;
  onDeleted: () => void;
}
const ownerActions = ["PUBLISH", "FEATURE_GRANTS_REPLACE", "COMPONENT_BINDINGS_REPLACE", "CONFIGURATION_SCHEMA_REPLACE"];
export function AddonWorkspace(props: Props) {
  const { lang } = useI18n(); const copy = addonCopy(lang);
  const state = useAddonWorkspace(props.applicationKey, props.addonKey, props.actorId, props.onDeleted);
  const detail = state.detail;
  const needsUnavailableOwner = (kind: string) => ownerActions.includes(kind) && !detail?.ownerRegistrationAvailable;
  const pendingKind = state.mutation.pending?.resource.kind;
  const canRetry = pendingKind !== undefined && !needsUnavailableOwner(pendingKind) && (pendingKind === "DELETE" ? props.canDelete
    : ["UPDATE", "DRAFT_CREATE"].includes(pendingKind) ? props.canUpdate : props.canCritical);
  const action = (kind: AddonAction, allowed: boolean) => allowed && <Button key={kind} type="button" variant="outline" size="sm" disabled={!state.writable || needsUnavailableOwner(kind) || Boolean(pendingKind && pendingKind !== kind)}
    onClick={() => state.setAction(kind)}>{addonActionLabel(kind, copy)}</Button>;
  return <section aria-label={props.addonKey} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{detail?.name ?? props.addonKey}</h3>
      <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">{props.addonKey}</p></div>
      <Button type="button" variant="outline" size="sm" loading={state.loading} disabled={state.mutation.isSubmitting} onClick={() => void state.refresh()}><RefreshCw className="size-4" aria-hidden="true" />{copy.refresh}</Button></header>
    {state.error && <div role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"><p>{copy.failed}</p><p>{state.error.message}</p><p dir="ltr" className="break-all font-mono text-xs">{state.error.errorCode} {state.error.correlationId}</p></div>}
    {state.mutation.pending && !state.mutation.isSubmitting && <div role="status" className="space-y-2 rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
      <p>{state.mutation.canRetry ? copy.unknown : copy.recovered}</p><p dir="ltr" className="break-all font-mono text-xs">{state.mutation.pending.resource.kind} · {state.mutation.pending.idempotencyKey}</p>
      {state.mutation.canRetry && canRetry && <Button type="button" variant="outline" size="sm" loading={state.mutation.isSubmitting} onClick={() => void state.retry()}>{copy.retry}</Button>}</div>}
    {state.notice && <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">{copy[state.notice]}</p>}
    {!detail && state.loading && <p role="status" className="py-6 text-sm text-muted-foreground">{copy.loading}</p>}
    {detail && <>
      <dl className="flex flex-wrap gap-4 text-xs"><div><dt className="text-muted-foreground">{copy.lifecycle}</dt><dd className="mt-1"><Badge tone={detail.lifecycleStatus === "ACTIVE" ? "success" : detail.lifecycleStatus === "DISABLED" ? "danger" : "neutral"}>{addonLifecycleLabel(detail.lifecycleStatus, copy)}</Badge></dd></div>
        <div><dt className="text-muted-foreground">{copy.catalogueRevision}</dt><dd className="mt-1 font-mono">{detail.catalogueRevision}</dd></div><div><dt className="text-muted-foreground">{copy.operationalRevision}</dt><dd className="mt-1 font-mono">{detail.operationalRevision}</dd></div></dl>
      <p className="text-sm text-muted-foreground">{copy.boundary}</p>
      {!detail.ownerRegistrationAvailable && <p role="status" className="rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{copy.ownerUnavailable}</p>}
      <div className="flex flex-wrap gap-2">
        {action("UPDATE", props.canUpdate && !!detail.draft)}
        {action("DRAFT_CREATE", props.canUpdate && !detail.draft && !!detail.published && !detail.published.revokedAt)}
        {action("PUBLISH", props.canCritical && !!detail.draft && detail.lifecycleStatus !== "DISABLED")}
        {action("DEPRECATE", props.canCritical && detail.lifecycleStatus === "ACTIVE")}
        {action("DISABLE", props.canCritical && detail.lifecycleStatus !== "DISABLED")}
        {action("DELETE", props.canDelete && !detail.publishedVersionId)}
      </div>
      <Tabs value={state.panel} onValueChange={state.selectPanel}>
        <TabsList className="flex w-full justify-start overflow-x-auto overflow-y-hidden" aria-label={copy.title}>{(["definition", "pricing", "versions", "audit"] as const).map(panel => <TabsTrigger key={panel} value={panel} className="min-w-fit">{copy[panel]}</TabsTrigger>)}</TabsList>
        <TabsContent value="definition" className="space-y-4 pt-3">
          <h4 className="text-sm font-semibold">{copy.currentVsDraft}</h4><p className="text-xs text-muted-foreground">{copy.pendingDraft}</p>
          <DefinitionComparison draft={detail.draft} published={detail.published} copy={copy} />
          {detail.draft && <div className="flex flex-wrap gap-2">{action("COMPATIBILITY_REPLACE", props.canCritical)}
            {action("FEATURE_GRANTS_REPLACE", props.canCritical && !detail.draft.grants.some(item => item.config !== undefined || item.configSchemaRef !== undefined))}
            {action("COMPONENT_BINDINGS_REPLACE", props.canCritical)}{action("CONFIGURATION_SCHEMA_REPLACE", props.canCritical)}</div>}
          {detail.draft?.grants.some(item => item.config !== undefined) && <p className="text-xs text-muted-foreground">{copy.grantsOpaque}</p>}
        </TabsContent>
        <TabsContent value="pricing" forceMount hidden={state.panel !== "pricing"} className="pt-3">{state.prices ? <AddonPricingEditor
          prices={state.prices} acceptedReceipt={state.priceReceipt} initialCycle={state.pricingCycle} onCycleChange={state.setPricingCycle}
          canMutate={props.canCritical} readCurrent={state.pricesCurrent && !state.loading && !state.error}
          mutation={state.mutation} copy={copy} onAccepted={state.priceAccepted} /> : state.loading ? <p role="status">{copy.loading}</p> : null}</TabsContent>
        <TabsContent value="versions" className="space-y-4 pt-3">{state.versions && <>
          {state.versions.items.length ? <ul className="divide-y divide-border rounded-md border border-border">{state.versions.items.map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div><p>{copy.version} <bdi className="font-mono">{version.version}</bdi> · {version.name}</p><p dir="ltr" className="font-mono text-xs text-muted-foreground">{version.publishedAt}</p>{version.revokedAt && <Badge tone="danger">{copy.revoke}</Badge>}</div>
            <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void state.readVersion(version.id)}>{copy.view}</Button>
              {props.canCritical && !version.revokedAt && <Button type="button" variant="outline" size="sm" disabled={!state.writable} onClick={() => state.startRevoke(version)}>{copy.revoke}</Button>}</div></li>)}</ul> : <p className="text-sm text-muted-foreground">{copy.noHistory}</p>}
          <HistoryPaging page={state.historyPage} hasPrev={state.versions.meta.hasPrev} hasNext={state.versions.meta.hasNext} loading={state.loading} onPage={state.setHistoryPage} copy={copy} />
        </>}{state.version && <DefinitionComparison draft={null} published={state.version} copy={copy} />}</TabsContent>
        <TabsContent value="audit" className="space-y-4 pt-3">{state.audit && <>
          {state.audit.items.length ? <div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-start text-sm"><thead className="bg-muted text-xs"><tr>
            <th className="p-3 text-start font-medium">{copy.action}</th><th className="p-3 text-start font-medium">{copy.actor}</th><th className="p-3 text-start font-medium">{copy.occurred}</th></tr></thead>
            <tbody className="divide-y divide-border">{state.audit.items.map(event => <tr key={event.id}><td className="p-3"><span>{addonAuditLabel(event.action, copy)}</span><p className="font-mono text-xs text-muted-foreground" dir="ltr">{event.action} · {event.operationId}</p></td>
              <td className="p-3">{event.actorLabel ?? event.actorAdminId ?? copy.none}</td><td className="whitespace-nowrap p-3 font-mono text-xs"><bdi>{event.occurredAt}</bdi></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">{copy.noAudit}</p>}
          <HistoryPaging page={state.historyPage} hasPrev={state.audit.meta.hasPrev} hasNext={state.audit.meta.hasNext} loading={state.loading} onPage={state.setHistoryPage} copy={copy} />
        </>}</TabsContent>
      </Tabs>
      {state.action && !needsUnavailableOwner(state.action) && (state.action === "DELETE" ? props.canDelete : ["CREATE", "UPDATE", "DRAFT_CREATE"].includes(state.action) ? props.canUpdate : props.canCritical) && <AddonDefinitionDialog key={`${state.action}:${state.revokeVersion?.id ?? ""}`} applicationKey={props.applicationKey} action={state.action} detail={detail}
        version={state.revokeVersion} canReadTiers={props.canReadTiers} mutation={state.mutation} copy={copy} onAccepted={state.dialogAccepted} onClose={() => state.setAction(null)} />}
    </>}
  </section>;
}

function DefinitionComparison({ draft, published, copy }: { draft: AddonDefinition | null; published: AddonDefinition | null; copy: AddonCopy }) {
  const rows: Array<{ label: string; value: (definition: AddonDefinition) => string }> = [
    { label: copy.name, value: item => item.name }, { label: copy.descriptionLabel, value: item => item.description ?? copy.none },
    { label: copy.version, value: item => item.version }, { label: copy.definitionRevision, value: item => item.definitionRevision },
    { label: copy.compatibility, value: item => item.mode === "ALL_ACTIVE" ? copy.allActive : item.tierIds.join("\n") },
    { label: copy.grants, value: item => item.grants.map(grant => `${grant.featureId}${grant.configSchemaRef ? ` · ${grant.configSchemaRef.key}@${grant.configSchemaRef.version}` : ""}`).join("\n") || copy.none },
    { label: copy.bindings, value: item => item.bindings.map(binding => `${binding.capabilityKey} · ${binding.componentId} · ${binding.releaseId}`).join("\n") || copy.none },
    { label: copy.dependencies, value: item => item.dependencies.map(dependency => [dependency.applicationId, dependency.addonId, dependency.minimumDefinitionVersionId].filter(Boolean).join(" · ")).join("\n") || copy.none },
    { label: copy.schema, value: item => item.schemaRef ? `${item.schemaRef.key}@${item.schemaRef.version}\n${item.schemaRef.checksum}` : copy.none },
  ];
  return <div className="overflow-x-auto rounded-md border border-border"><table className="w-full table-fixed text-sm"><thead className="bg-muted text-xs"><tr><th className="w-1/5 p-3 text-start font-medium">{copy.definition}</th>
    <th className="p-3 text-start font-medium">{copy.published}</th><th className="p-3 text-start font-medium">{copy.draft}</th></tr></thead><tbody className="divide-y divide-border">{rows.map(row => {
      const before = published ? row.value(published) : copy.emptySnapshot; const after = draft ? row.value(draft) : copy.noDraft;
      return <tr key={row.label} className={draft && before !== after ? "bg-info-subtle/30" : undefined}><th className="p-3 text-start align-top text-xs font-medium text-muted-foreground">{row.label}{draft && before !== after && <span className="mt-1 block text-info-subtle-foreground">{copy.changed}</span>}</th>
        <td className="wrap-anywhere whitespace-pre-wrap p-3 align-top"><bdi>{before}</bdi></td><td className="wrap-anywhere whitespace-pre-wrap p-3 align-top"><bdi>{after}</bdi></td></tr>;
    })}</tbody></table></div>;
}
function HistoryPaging({ page, hasPrev, hasNext, loading, onPage, copy }: { page: number; hasPrev: boolean; hasNext: boolean; loading: boolean; onPage: (page: number) => void; copy: AddonCopy }) {
  return <div className="flex items-center justify-end gap-3 text-sm"><Button type="button" variant="outline" size="sm" disabled={!hasPrev || loading} onClick={() => onPage(page - 1)}>{copy.previous}</Button>
    <bdi>{page}</bdi><Button type="button" variant="outline" size="sm" disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>{copy.next}</Button></div>;
}
