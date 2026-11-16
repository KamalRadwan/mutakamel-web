"use client";

import Link from "next/link";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Badge, Button, Card, CardContent, ConfirmActionModal,
  DegradedBanner, DetailHeader, ErrorState, IdentifierText, NotFoundState, PermissionGate, Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import { usePipelineConfiguration } from "../hooks/usePipelineConfiguration";
import { isUncertainPipelineWrite } from "../hooks/pipeline-uncertainty";
import { EditPipelineModal } from "./EditPipelineModal";
import { PipelineActionDialog } from "./PipelineActionDialog";
import { PipelineAssignmentsSection } from "./PipelineAssignmentsSection";
import { PipelineStagesSection } from "./PipelineStagesSection";

interface PipelineConfigurationProps {
  pipelineId: string;
}

export function PipelineConfiguration({ pipelineId }: PipelineConfigurationProps) {
  const { t, lang } = useI18n();
  const state = usePipelineConfiguration(pipelineId);
  const { detail, assignments, canManage } = state;
  const pipeline = detail.pipeline;
  const target = pipeline?.stages.find(({ id }) => id === state.detachStageId);
  const actions = <>
    <Button variant="outline" onClick={state.reload} disabled={detail.isLoading || detail.isSaving}>
      <RefreshCw className="size-4" aria-hidden="true" />{t.connectivity.reload}
    </Button>
    {canManage && pipeline?.isDefault && <Button variant="outline" onClick={state.openReset} disabled={detail.isSaving}>
      <RotateCcw className="size-4" aria-hidden="true" />{t.crmPipelines.reset}
    </Button>}
  </>;
  return (
    <PermissionGate require="crm.pipelines.read" denied={detail.queryError?.status === 403}>
      {detail.notFound ? <NotFoundState title={t.crmPipelines.notFoundTitle} description={t.crmPipelines.notFoundDescription} backLabel={t.crmPipelines.backToList} backHref="/crm/pipelines" />
        : detail.queryError && !pipeline ? <ErrorState title={t.crmPipelines.loadFailed} description={t.crmPipelines.loadFailedHint} retryLabel={t.common.retry} onRetry={state.reload} />
        : !pipeline ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
        : <Card>
          <div className="p-4 pb-0"><DetailHeader
            title={localizedName(pipeline, lang)} subtitle={alternateName(pipeline, lang)}
            backLabel={t.crmPipelines.backToList} backHref="/crm/pipelines"
            breadcrumbs={[{ label: t.crmPipelines.title, href: "/crm/pipelines" }, { label: localizedName(pipeline, lang) }]}
            primaryAction={canManage ? { label: t.crmPipelines.edit, onClick: state.openEdit } : undefined}
            secondaryActions={actions}
          /></div>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <IdentifierText className="text-xs">{pipeline.code}</IdentifierText>
              <Badge tone={pipeline.isActive ? "positive" : "neutral"}>{pipeline.isActive ? t.common.active : t.common.inactive}</Badge>
              <Badge tone="neutral">{t.crmPipelines.accessModeValues[pipeline.accessMode]}</Badge>
              {pipeline.isDefault && <Badge tone="brand">{t.crmPipelines.isDefault}</Badge>}
            </div>
            {pipeline.description && <p className="text-sm text-muted-foreground">{pipeline.description}</p>}
            {detail.queryError && <DegradedBanner message={t.crmPipelines.review.staleConfiguration} />}
            {detail.needsReconciliation && <div className="space-y-2"><DegradedBanner message={t.crmPipelines.review.uncertainWrite} />
              {detail.requiresCatalogue ? <Button variant="outline" asChild><Link href="/crm/pipelines">{t.crmPipelines.backToList}</Link></Button>
                : <Button variant="outline" onClick={() => void state.recover()}>{t.crmPipelines.review.checkCurrent}</Button>}
            </div>}
            {state.readOnly && <p role="note" className="text-sm text-muted-foreground">{t.crmPipelines.readOnlyReason}</p>}
            <div className="grid items-start gap-4 xl:grid-cols-3">
              <div className="min-w-0 xl:col-span-2"><PipelineStagesSection
                stages={pipeline.stages} attachableStages={detail.attachableStages}
                catalogueUnavailable={detail.catalogueError !== null} canManage={canManage}
                pendingStageId={detail.pendingStageId} onAttach={state.attach}
                onDetach={state.openDetach} onMove={(id, direction) => void state.move(id, direction)}
                onReloadCatalogue={() => void detail.reloadCatalogue()}
              /></div>
              <div className="min-w-0"><PipelineAssignmentsSection
                state={assignments} canManage={state.canManageAssignments} isDefault={pipeline.isDefault}
                onSave={() => void state.saveAssignments()}
                blocked={assignments.writeBlocked || !canManage} onReconcile={() => void state.reconcileAssignments()}
                error={isUncertainPipelineWrite(state.assignmentError) ? t.crmPipelines.review.uncertainWrite : state.assignmentError ? state.describeFailure(state.assignmentError) : undefined}
              /></div>
            </div>
          </CardContent>
          <EditPipelineModal key={`${pipeline.id}-${state.isEditOpen}`} open={state.isEditOpen} onOpenChange={state.setIsEditOpen}
            pipeline={pipeline} isSubmitting={detail.isSaving} error={state.editError} blocked={state.editUncertain || detail.needsReconciliation}
            onReconcile={() => void state.reconcileEdit()} onSubmit={(input) => void state.save(input)} />
          <PipelineActionDialog open={state.action !== null} onOpenChange={(open) => { if (!open) state.closeAction(); }}
            title={state.action === "reset" ? t.crmPipelines.resetTitle : t.crmPipelines.detachStage}
            description={state.action === "reset" ? t.crmPipelines.review.resetConsequences : formatTemplate(t.crmPipelines.detachStageDescription, { name: target ? localizedName(target, lang) : "" })}
            confirmLabel={state.action === "reset" ? t.crmPipelines.reset : t.crmPipelines.detachStage}
            pending={detail.isSaving || detail.pendingStageId !== null}
            error={isUncertainPipelineWrite(state.actionError) ? t.crmPipelines.review.uncertainWrite : state.actionError ? state.describeFailure(state.actionError) : undefined}
            blocked={state.actionError !== null} onConfirm={() => void state.confirmAction()} onReload={state.reloadAction}
          />
          <ConfirmActionModal open={state.guard.isDiscardOpen} onOpenChange={(open) => { if (!open) state.guard.cancelDiscard(); }}
            title={t.common.discardTitle} description={t.common.discardDescription} confirmLabel={t.common.discardConfirm} cancelLabel={t.common.cancel}
            onConfirm={state.guard.confirmDiscard} />
        </Card>}
    </PermissionGate>
  );
}
