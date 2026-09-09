"use client";
import { Plus, RefreshCw, Search } from "lucide-react";
import { Badge, Button, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useApplicationAddons } from "../hooks/useApplicationAddons";
import { useAddonMutation } from "../hooks/useAddonMutation";
import { addonCopy } from "../lib/addon-copy";
import { addonLifecycleLabel } from "../lib/addon-presentation";
import { AddonDefinitionDialog } from "./AddonDefinitionDialog";
import { AddonWorkspace } from "./AddonWorkspace";

export function ApplicationAddonsWorkspace({ applicationKey, supported }: { applicationKey: string; supported: boolean }) {
  const { lang, dir } = useI18n(); const copy = addonCopy(lang);
  const state = useApplicationAddons(applicationKey);
  const create = useAddonMutation(applicationKey, "CREATE", state.actorId);
  return <section dir={dir} className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl"><h2 className="text-lg font-semibold">{copy.title}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.description}</p></div>
      <div className="flex gap-2">{state.canRead && <Button type="button" variant="outline" size="sm" loading={state.isLoading} onClick={() => void state.refresh()}><RefreshCw className="size-4" aria-hidden="true" />{copy.refresh}</Button>}
        {supported && state.canRead && state.canCreate && <Button type="button" size="sm" onClick={() => state.setCreating(true)}><Plus className="size-4" aria-hidden="true" />{copy.create}</Button>}</div></header>
    {!supported && <p className="text-sm text-muted-foreground">{copy.systemBoundary}</p>}
    {!state.canRead ? <p role="alert" className="text-sm text-warning-subtle-foreground">{copy.forbidden} <code dir="ltr">admin.applications.read</code></p> : <>
      <form onSubmit={state.searchSubmit} role="search" className="flex max-w-md gap-2"><Input aria-label={copy.search} maxLength={128} value={state.search} onChange={event => state.setSearch(event.target.value)} />
        <Button type="submit" variant="outline" aria-label={copy.search}><Search className="size-4" aria-hidden="true" /></Button></form>
      {state.error && <div role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"><p>{copy.failed}</p><p>{state.error.message}</p><p dir="ltr" className="break-all font-mono text-xs">{state.error.errorCode} {state.error.correlationId}</p></div>}
      {create.pending && !create.isSubmitting && <p role="status" className="rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{create.canRetry ? copy.unknown : copy.recovered} <bdi className="font-mono">{create.pending.resource.id}</bdi></p>}
      {state.isLoading && <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p>}
      {state.result && !state.error && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{state.result.items.map(addon => <button key={addon.id} type="button" aria-pressed={state.selectedKey === addon.key}
        className={`space-y-2 rounded-md border p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring ${state.selectedKey === addon.key ? "border-primary bg-accent" : "border-border hover:bg-muted"}`} onClick={() => state.setSelectedKey(addon.key)}>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-semibold">{addon.name}</span><Badge tone={addon.lifecycleStatus === "ACTIVE" ? "success" : "neutral"}>{addonLifecycleLabel(addon.lifecycleStatus, copy)}</Badge></div>
        <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">{addon.key}</p><p className="text-xs text-muted-foreground">{addon.publishedVersionId ? copy.published : copy.unpublished}{addon.draftVersionId ? ` · ${copy.draft}` : ""}</p>
      </button>)}</div>{state.result.items.length === 0 && !state.isLoading && <p className="py-5 text-sm text-muted-foreground">{copy.empty}</p>}
        <div className="flex items-center justify-end gap-3 text-sm"><Button type="button" variant="outline" size="sm" disabled={!state.result.meta.hasPrev || state.isLoading} onClick={() => state.setPage(state.page - 1)}>{copy.previous}</Button><bdi>{state.result.meta.page}</bdi>
          <Button type="button" variant="outline" size="sm" disabled={!state.result.meta.hasNext || state.isLoading} onClick={() => state.setPage(state.page + 1)}>{copy.next}</Button></div></>}
      {state.selectedKey && <AddonWorkspace key={`${state.actorId}:${applicationKey}:${state.selectedKey}`} applicationKey={applicationKey} addonKey={state.selectedKey} actorId={state.actorId}
        canReadTiers={state.canReadTiers} canUpdate={supported && state.canUpdate} canCritical={supported && state.canCritical} canDelete={supported && state.canDelete}
        onDeleted={() => { state.setSelectedKey(null); void state.refresh(); }} />}
    </>}
    {state.creating && supported && state.canRead && state.canCreate && <AddonDefinitionDialog action="CREATE" applicationKey={applicationKey} mutation={create} copy={copy} onAccepted={state.created} onClose={() => state.setCreating(false)} />}
  </section>;
}
