"use client";

import { use } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, ConfirmActionModal, DateTime, DegradedBanner, DetailHeader, DetailSection, ErrorState, NotFoundState, PermissionGate, Skeleton, StatusBadge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { OpportunityStageDrawer } from "../components/OpportunityStageDrawer";
import { OpportunityStageRecovery } from "../components/OpportunityStageRecovery";
import { useOpportunityStageDetailScreen } from "../hooks/useOpportunityStageDetailScreen";

const STAGES_HREF = "/crm/opportunity-stages";

export default function OpportunityStageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const detail = useOpportunityStageDetailScreen(id);
  const { stage } = detail;
  return (
    <PermissionGate require="crm.pipelines.manage" denied={detail.queryError?.status === 403}>
      <div className="flex min-w-0 flex-col gap-3" aria-busy={detail.isLoading || detail.isSubmitting || undefined}>
        {detail.notFound ? <NotFoundState title={t.crmOpportunityStages.notFoundTitle} description={t.crmOpportunityStages.notFoundDescription} backLabel={t.crmOpportunityStages.backToList} backHref={STAGES_HREF} /> : detail.queryError && !stage ? <ErrorState title={t.crmOpportunityStages.loadFailed} description={t.crmOpportunityStages.loadFailedHint} retryLabel={t.common.retry} onRetry={() => void detail.reload()} /> : detail.isLoading && !stage ? <div className="flex flex-col gap-3"><Skeleton className="h-7 w-64" /><Skeleton className="h-32 w-full" /></div> : stage ? (
          <>
            <DetailHeader
              title={localizedName(stage, lang)} subtitle={alternateName(stage, lang)}
              status={<StatusBadge kind="OpportunityStageFlag" value={stage.flag} />}
              backLabel={t.crmOpportunityStages.backToList} backHref={STAGES_HREF}
              breadcrumbs={[{ label: t.nav.opportunityStages, href: STAGES_HREF }, { label: localizedName(stage, lang) }]}
              primaryAction={detail.canManage ? { label: t.crmOpportunityStages.edit, onClick: detail.openEdit, disabled: detail.isSubmitting } : undefined}
              secondaryActions={<><Button size="sm" variant="outline" onClick={() => void detail.reload()} loading={detail.isLoading} disabled={detail.isSubmitting}><RefreshCw className="size-4" aria-hidden="true" />{t.crmOpportunityStages.reload}</Button>{detail.canManage && !stage.isSystem && <Button size="sm" variant="outline" onClick={detail.openDelete} disabled={detail.isSubmitting || detail.feedback.blocked}><Trash2 className="size-4 text-destructive" aria-hidden="true" />{t.common.delete}</Button>}</>}
            />
            {detail.readOnly && <DegradedBanner message={t.crmOpportunityStages.readOnlyNotice} />}
            {!detail.isEditOpen && <OpportunityStageRecovery feedback={detail.feedback} />}
            {detail.queryError && <DegradedBanner message={t.crmOpportunityStages.refreshKept} />}
            <DetailSection title={t.crmOpportunityStages.summaryTitle} emptyValueLabel={t.common.noData} fields={[
              { label: t.crmOpportunityStages.nameAr, value: <bdi dir="rtl">{stage.nameAr}</bdi> },
              { label: t.crmOpportunityStages.nameEn, value: <bdi dir="ltr">{stage.nameEn}</bdi> },
              { label: t.crmOpportunityStages.category, value: <StatusBadge kind="StageCategory" value={stage.category} /> },
              { label: t.common.status, value: <div className="flex flex-wrap items-center gap-1.5"><Badge tone={stage.isActive ? "positive" : "neutral"}>{stage.isActive ? t.common.active : t.common.inactive}</Badge>{stage.isSystem && <Badge tone="neutral">{t.crmOpportunityStages.systemStage}</Badge>}</div> },
              { label: t.crmOpportunityStages.createdAt, value: <DateTime value={stage.createdAt} /> },
              { label: t.crmOpportunityStages.updatedAt, value: <DateTime value={stage.updatedAt} /> },
            ]} />
            <OpportunityStageDrawer key={`${stage.id}-${detail.isEditOpen}`} open={detail.isEditOpen && detail.canManage} onOpenChange={detail.changeEditOpen} stage={stage} isSubmitting={detail.isSubmitting} error={detail.feedback.message} submitBlocked={detail.feedback.blocked} assigned={detail.feedback.failure?.code === "OPPORTUNITY_STAGE_IN_USE"} recoveryActions={<OpportunityStageRecovery feedback={detail.feedback} actionsOnly />} onSubmit={(input) => void detail.save(input)} />
            <ConfirmActionModal open={detail.isDeleteOpen && detail.canManage} onOpenChange={detail.changeDeleteOpen} title={t.crmOpportunityStages.deleteTitle} description={formatTemplate(t.crmOpportunityStages.deleteDescription, { name: localizedName(stage, lang) })} confirmLabel={t.common.delete} cancelLabel={t.common.cancel} loading={detail.isSubmitting} onConfirm={() => void detail.confirmDelete()} />
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}
