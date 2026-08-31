"use client";

import { use, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import { EditPipelineDrawer } from "../components/EditPipelineDrawer";
import { PipelineAssignmentsSection } from "../components/PipelineAssignmentsSection";
import { PipelineStagesSection } from "../components/PipelineStagesSection";
import { usePipelineAssignments } from "../hooks/usePipelineAssignments";
import { usePipelineDetail } from "../hooks/usePipelineDetail";
import type { PipelineWriteResult } from "../hooks/usePipelines";

const PIPELINES_HREF = "/crm/pipelines";

export default function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const toast = useToast();
  const detail = usePipelineDetail(id);
  const assignments = usePipelineAssignments(id, detail.canManage);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | undefined>(undefined);
  const [isResetOpen, setIsResetOpen] = useState(false);

  function describeFailure(error: NormalizedApiError): string {
    return t.crmPipelines.errors[error.code ?? ""] ?? t.crmPipelines.actionFailed;
  }

  function report(
    result: PipelineWriteResult | null,
    successTitle: string,
  ): boolean {
    if (!result) return false;
    if (result.ok) {
      if (result.replayed) {
        toast.info(
          t.errors.idempotencyReplayedTitle,
          t.errors.idempotencyReplayedDescription,
        );
      } else {
        toast.success(successTitle);
      }
      return true;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) {
      toast.errorFromApi(describeFailure(result.error), result.error);
    }
    return false;
  }

  const { pipeline } = detail;

  return (
    <PermissionGate require="crm.pipelines.read">
      <div className="flex flex-col gap-4">
        {detail.notFound ? (
          <NotFoundState
            title={t.crmPipelines.notFoundTitle}
            description={t.crmPipelines.notFoundDescription}
            backLabel={t.crmPipelines.backToList}
            backHref={PIPELINES_HREF}
          />
        ) : detail.queryError ? (
          <ErrorState
            title={t.crmPipelines.loadFailed}
            description={t.crmPipelines.loadFailedHint}
            retryLabel={t.common.retry}
            onRetry={() => void detail.reload()}
          />
        ) : detail.isLoading && !pipeline ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : pipeline ? (
          <>
            <DetailHeader
              title={localizedName(pipeline, lang)}
              subtitle={alternateName(pipeline, lang)}
              status={
                <div className="flex items-center gap-1.5">
                  <Badge tone={pipeline.isActive ? "positive" : "neutral"}>
                    {pipeline.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                  {pipeline.isDefault ? (
                    <Badge tone="brand">{t.crmPipelines.isDefault}</Badge>
                  ) : null}
                </div>
              }
              backLabel={t.crmPipelines.backToList}
              backHref={PIPELINES_HREF}
              breadcrumbs={[
                { label: t.crmPipelines.title, href: PIPELINES_HREF },
                { label: localizedName(pipeline, lang) },
              ]}
              primaryAction={
                detail.canManage
                  ? {
                      label: t.crmPipelines.edit,
                      onClick: () => {
                        setEditError(undefined);
                        setIsEditOpen(true);
                      },
                    }
                  : undefined
              }
              secondaryActions={
                detail.canManage && pipeline.isDefault ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsResetOpen(true)}
                    disabled={detail.isSaving}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t.crmPipelines.reset}
                  </Button>
                ) : undefined
              }
            />

            <DetailSection
              title={t.crmPipelines.summaryTitle}
              emptyValueLabel={t.common.noData}
              fields={[
                {
                  label: t.crmPipelines.codeLabel,
                  value: (
                    <span className="font-mono text-xs">{pipeline.code}</span>
                  ),
                },
                {
                  label: t.crmPipelines.accessMode,
                  value: (
                    <Badge tone="neutral">
                      {t.crmPipelines.accessModeValues[pipeline.accessMode]}
                    </Badge>
                  ),
                },
                {
                  label: t.crmPipelines.description,
                  value: pipeline.description,
                  wide: true,
                },
              ]}
            />

            <PipelineStagesSection
              stages={pipeline.stages}
              attachableStages={detail.attachableStages}
              catalogueUnavailable={detail.catalogueError !== null}
              canManage={detail.canManage}
              pendingStageId={detail.pendingStageId}
              onAttach={(stageId) => {
                void detail
                  .attachStage(stageId)
                  .then((result) => report(result, t.crmPipelines.stageAttached));
              }}
              onDetach={(pipelineStageId) => {
                void detail
                  .detachStage(pipelineStageId)
                  .then((result) => report(result, t.crmPipelines.stageDetached));
              }}
              onMove={(pipelineStageId, direction) => {
                void detail
                  .moveStage(pipelineStageId, direction)
                  .then((result) =>
                    report(result, t.crmPipelines.stagesReordered),
                  );
              }}
            />

            <PipelineAssignmentsSection
              state={assignments}
              canManage={detail.canManage}
              onSave={() => {
                void assignments
                  .save()
                  .then((result) =>
                    report(result, t.crmPipelines.assignmentsSaved),
                  );
              }}
            />

            <EditPipelineDrawer
              key={`${pipeline.id}-${pipeline.updatedAt}-${isEditOpen}`}
              open={isEditOpen}
              onOpenChange={(open) => {
                if (!open) setEditError(undefined);
                setIsEditOpen(open);
              }}
              pipeline={pipeline}
              isSubmitting={detail.isSaving}
              error={editError}
              onSubmit={(input) => {
                void detail.save(input).then((result) => {
                  if (result.ok) {
                    setIsEditOpen(false);
                    report(result, t.crmPipelines.updated);
                    return;
                  }
                  setEditError(
                    result.error ? describeFailure(result.error) : undefined,
                  );
                  if (result.error) toast.outcomeFromApi(result.error);
                });
              }}
            />

            {/* POST /:id/reset restores the canonical stage set and drops
                everything that is not part of it.
                docs/api/crm-opportunities.md asks for a TYPED confirmation
                here, and no primitive in the design system provides one —
                ReasonDialog captures a reason this endpoint has no field for,
                and echoing it back would imply it was recorded. So this is a
                ConfirmActionModal whose description names every consequence,
                and the missing `TypedConfirmDialog` is reported rather than
                built: src/design-system/ is not this task's to change. */}
            <ConfirmActionModal
              open={isResetOpen}
              onOpenChange={setIsResetOpen}
              title={t.crmPipelines.resetTitle}
              description={formatTemplate(t.crmPipelines.resetDescription, {
                name: localizedName(pipeline, lang),
                code: pipeline.code,
              })}
              confirmLabel={t.crmPipelines.reset}
              cancelLabel={t.common.cancel}
              loading={detail.isSaving}
              onConfirm={() => {
                void detail.reset().then((result) => {
                  if (report(result, t.crmPipelines.resetDone)) {
                    setIsResetOpen(false);
                  }
                });
              }}
            />
          </>
        ) : null}
      </div>
    </PermissionGate>
  );
}
