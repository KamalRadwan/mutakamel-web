"use client";

import Link from "next/link";
import { Plus, RefreshCw, Search } from "lucide-react";
import { Button, ConfirmActionModal, DataTable, DegradedBanner, EmptyState, Input, PageActions, PageHeader, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { INTL_LOCALE } from "@/lib/format/locale";
import { OpportunityStageDrawer } from "./components/OpportunityStageDrawer";
import { OpportunityStageRecovery } from "./components/OpportunityStageRecovery";
import { useOpportunityStageColumns } from "./components/useOpportunityStageColumns";
import { useOpportunityStagesScreen } from "./hooks/useOpportunityStagesScreen";
import { OPPORTUNITY_STAGE_LIMIT } from "./opportunity-stage-contract";

export default function OpportunityStagesPage() {
  const { t, lang } = useI18n();
  const screen = useOpportunityStagesScreen();
  const columns = useOpportunityStageColumns({ canManage: screen.canManage, pendingId: screen.busy ? "pending" : null, onView: screen.openDetail, onEdit: screen.openEdit, onDelete: screen.openDelete });
  const denied = screen.queryError?.status === 403;
  return (
    <PermissionGate require="crm.pipelines.manage" denied={denied}>
      <div className="flex min-w-0 flex-col gap-3" aria-busy={screen.isLoading || screen.busy || undefined}>
        <PageHeader
          title={t.nav.opportunityStages}
          description={t.crmOpportunityStages.subtitle}
          primaryAction={screen.canManage ? { label: t.crmOpportunityStages.add, icon: <Plus className="size-4" aria-hidden="true" />, onClick: screen.openCreate, disabled: screen.busy || screen.feedback.blocked || screen.total >= OPPORTUNITY_STAGE_LIMIT } : undefined}
          secondaryActions={<Button variant="outline" size="sm" onClick={() => void screen.reload()} loading={screen.isLoading} disabled={screen.busy}><RefreshCw className="size-4" aria-hidden="true" />{t.crmOpportunityStages.reload}</Button>}
        />
        <PageActions slot="search">
          <div className="relative w-full min-w-40 max-w-72">
            <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input size="sm" className="ps-8" value={screen.searchQuery} onChange={(event) => screen.setSearchQuery(event.target.value)} aria-label={t.crmOpportunityStages.search} placeholder={t.crmOpportunityStages.search} />
          </div>
        </PageActions>
        {screen.readOnly && <DegradedBanner message={t.crmOpportunityStages.readOnlyNotice} />}
        {screen.hasLoaded && screen.queryError && <DegradedBanner message={t.crmOpportunityStages.refreshKept} />}
        {!screen.isDrawerOpen && <OpportunityStageRecovery feedback={screen.feedback} />}
        {screen.total >= OPPORTUNITY_STAGE_LIMIT && <DegradedBanner message={t.crmOpportunityStages.errors.OPPORTUNITY_STAGE_LIMIT_EXCEEDED} />}
        <DataTable
          columns={columns} rows={screen.items} showRowNumbers={false}
          isLoading={screen.isLoading && !screen.hasLoaded}
          error={screen.hasLoaded ? null : screen.queryError}
          onRetry={() => void screen.reload()}
          rowKey={(stage) => stage.id} onRowClick={screen.openDetail}
          emptyState={<EmptyState title={screen.searchQuery.trim() ? t.crmOpportunityStages.emptyFiltered : t.crmOpportunityStages.empty} action={screen.searchQuery.trim() ? { label: t.crmOpportunityStages.clearSearch, onClick: screen.clearSearch } : undefined} />}
          labels={{ retry: t.common.retry, errorTitle: t.crmOpportunityStages.loadFailed, emptyTitle: t.crmOpportunityStages.empty, selectAll: t.views.selectAll, selectRow: t.views.selectItem, sortAscending: t.views.sortAscending, sortDescending: t.views.sortDescending, notSorted: t.views.notSorted, pagination: { previous: t.common.previousPage, next: t.common.nextPage, summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }) } }}
        />
        {screen.hasLoaded && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{formatTemplate(t.crmOpportunityStages.count, { count: new Intl.NumberFormat(INTL_LOCALE[lang]).format(screen.total) })}</p><Button asChild variant="link" size="sm"><Link href="/crm/pipelines">{t.crmOpportunityStages.managePipelines}</Link></Button></div>}
        <OpportunityStageDrawer
          key={`${screen.drawerStage?.id ?? "new"}-${screen.isDrawerOpen}`}
          open={screen.isDrawerOpen && screen.canManage} onOpenChange={screen.changeDrawerOpen} stage={screen.drawerStage}
          isSubmitting={screen.isSubmitting} error={screen.feedback.message} submitBlocked={screen.feedback.blocked}
          assigned={screen.feedback.failure?.code === "OPPORTUNITY_STAGE_IN_USE"}
          recoveryActions={<OpportunityStageRecovery feedback={screen.feedback} actionsOnly />}
          onSubmit={(input) => void screen.submit(input)}
        />
        <ConfirmActionModal open={screen.pendingDelete !== null && screen.canManage} onOpenChange={screen.changeDeleteOpen} title={t.crmOpportunityStages.deleteTitle} description={formatTemplate(t.crmOpportunityStages.deleteDescription, { name: screen.pendingDelete ? localizedName(screen.pendingDelete, lang) : "" })} confirmLabel={t.common.delete} cancelLabel={t.common.cancel} loading={screen.pendingId !== null} onConfirm={() => void screen.confirmDelete()} />
      </div>
    </PermissionGate>
  );
}
