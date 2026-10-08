"use client";

import { Button, ConflictDialog, FilterBar, PageHeader, PermissionGate, ReadOnlyGate, SubNav, TRADE_FOUNDATION_NAV_ITEMS } from "@/design-system";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { formatNumber } from "@/lib/format/number";
import { useCategoryWorkspace } from "../hooks/useCategoryWorkspace";
import { CategoryDetailPanel } from "./CategoryDetailPanel";
import { CategoryEditor } from "./CategoryEditor";
import { CategoryListPanel } from "./CategoryListPanel";
import { CategoryTreePanel } from "./CategoryTreePanel";

export function CategoriesWorkspace({ initialId }: { initialId?: string }) {
  const state = useCategoryWorkspace(initialId);
  const { t } = state; const copy = t.trade.categories;
  return <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
    <ReadOnlyGate mode={state.access.mode} labels={{ blockedTitle: copy.blocked, blockedDescription: copy.readOnly,
      readOnlyNotice: copy.readOnly, dunningNotice: copy.readOnly }}>
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} headingRef={state.headingRef} description={copy.subtitle}
        primaryAction={state.canManage ? { label: copy.add, onClick: () => state.openEditor("create"), disabled: !state.canWrite || state.busy || state.uncertain || state.tree.treeVersion === null } : undefined}
        secondaryActions={<Button variant="outline" size="sm" onClick={() => void state.reload()}>{t.trade.reload}</Button>} />
      <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" aria-pressed={state.mode === "tree"} onClick={() => state.setMode("tree")}>{copy.tree}</Button>
        <Button variant="outline" size="sm" aria-pressed={state.mode === "list"} onClick={() => state.setMode("list")}>{copy.list}</Button>
        {state.selectedId ? <Button variant="ghost" size="sm" onClick={() => state.select(null)}>{copy.back}</Button> : null}
      </div>
      {state.savedRefreshFailed ? <div className="flex items-center gap-2 text-sm" role="status">
        <p>{copy.savedRefreshFailed}</p><Button variant="outline" size="sm" onClick={() => void state.reload()}>{t.common.retry}</Button>
      </div> : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className={state.selectedId && !state.mobileBrowse ? "hidden min-w-0 space-y-3 lg:block" : "min-w-0 space-y-3"}>
          <FilterBar filters={[{ id: "status", kind: "select", label: t.common.status, placeholder: t.trade.statusAny,
            options: [{ value: "ACTIVE", label: copy.status.ACTIVE }, { value: "INACTIVE", label: copy.status.INACTIVE }] }]}
            values={state.status ? { status: { kind: "select", value: state.status } } : {}}
            onChange={(next) => { const value = next.status; state.setStatus(value?.kind === "select" && (value.value === "ACTIVE" || value.value === "INACTIVE") ? value.value : undefined); }}
            onReset={() => state.setStatus(undefined)} searchValue={state.search} onSearchChange={state.setSearch}
            searchPlaceholder={copy.search} clearAllLabel={t.trade.clearFilters} filtersLabel={t.common.filter} />
          {state.mode === "tree" ? <CategoryTreePanel tree={state.tree} selectedId={state.selectedId} onSelect={state.select} />
            : <CategoryListPanel list={state.list} page={state.page} onPage={state.setPage} onSelect={state.select} />}
        </div>
        <div className={state.selectedId && !state.mobileBrowse ? "min-w-0" : "hidden min-w-0 lg:block"}><CategoryDetailPanel workspace={state} /></div>
      </div>
      {state.editor ? <CategoryEditor editor={state.editor} busy={state.busy} uncertain={state.uncertain} canWrite={state.canWrite}
        error={state.command.kind === "rejected" ? { ...state.command.error, message: state.command.error.message ?? copy.saveFailed } : undefined}
        onSubmit={state.submit} onClose={state.closeEditor} onRetry={() => void state.retry()} /> : null}
      <ConflictDialog open={state.conflict} onOpenChange={(open) => { if (!open) state.dismissConflict(); }}
        title={t.trade.conflictTitle} description={t.trade.conflictDescription}
        loading={state.reviewing}
        yourChanges={state.editor?.source ? `${state.editor.source.name} · ${formatNumber(state.editor.source.version, state.lang)}` : undefined}
        theirChanges={state.editor?.source ? state.conflictCurrent ? `${state.conflictCurrent.name} · ${formatNumber(state.conflictCurrent.version, state.lang)}` : t.common.loading : undefined}
        onReload={() => void state.reviewConflict()} onCancel={state.dismissConflict}
        labels={{ yourChanges: copy.versionStarted, theirChanges: copy.versionCurrent, reload: t.trade.conflictReload, overwrite: t.trade.conflictReload, cancel: t.common.cancel }} />
    </div>
    </ReadOnlyGate>
  </PermissionGate>;
}
