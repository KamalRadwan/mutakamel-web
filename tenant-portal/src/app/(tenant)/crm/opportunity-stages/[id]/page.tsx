"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DateTime,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  StatusBadge,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { alternateName, localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import { OpportunityStageDrawer } from "../components/OpportunityStageDrawer";
import { useOpportunityStageDetail } from "../hooks/useOpportunityStageDetail";
import type { StageWriteResult } from "../hooks/useOpportunityStages";

const STAGES_HREF = "/crm/opportunity-stages";

export default function OpportunityStageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const detail = useOpportunityStageDetail(id);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | undefined>(undefined);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function describeFailure(error: NormalizedApiError): string {
    return (
      t.crmOpportunityStages.errors[error.code ?? ""] ??
      t.crmOpportunityStages.actionFailed
    );
  }

  function report(result: StageWriteResult, successTitle: string): boolean {
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

  const { stage } = detail;

  return (
    <PermissionGate require="crm.pipelines.manage">
      <div className="flex flex-col gap-4">
        {detail.notFound ? (
          <NotFoundState
            title={t.crmOpportunityStages.notFoundTitle}
            description={t.crmOpportunityStages.notFoundDescription}
            backLabel={t.crmOpportunityStages.backToList}
            backHref={STAGES_HREF}
          />
        ) : detail.queryError ? (
          <ErrorState
            title={t.crmOpportunityStages.loadFailed}
            description={t.crmOpportunityStages.loadFailedHint}
            retryLabel={t.common.retry}
            onRetry={() => void detail.reload()}
          />
        ) : detail.isLoading && !stage ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : stage ? (
          <>
            <DetailHeader
              title={localizedName(stage, lang)}
              subtitle={alternateName(stage, lang)}
              status={
                <StatusBadge
                  kind="OpportunityStageFlag"
                  value={stage.flag}
                />
              }
              backLabel={t.crmOpportunityStages.backToList}
              backHref={STAGES_HREF}
              breadcrumbs={[
                { label: t.crmOpportunityStages.title, href: STAGES_HREF },
                { label: localizedName(stage, lang) },
              ]}
              primaryAction={
                detail.canManage
                  ? {
                      label: t.crmOpportunityStages.edit,
                      onClick: () => {
                        setEditError(undefined);
                        setIsEditOpen(true);
                      },
                    }
                  : undefined
              }
              secondaryActions={
                detail.canManage && !stage.isSystem ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteOpen(true)}
                    disabled={detail.isSubmitting}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t.common.delete}
                  </Button>
                ) : undefined
              }
            />

            <DetailSection
              title={t.crmOpportunityStages.summaryTitle}
              emptyValueLabel={t.common.noData}
              fields={[
                {
                  label: t.crmOpportunityStages.category,
                  value: (
                    <StatusBadge
                      kind="StageCategory"
                      value={stage.category}
                    />
                  ),
                },
                {
                  label: t.common.status,
                  value: (
                    <div className="flex items-center gap-1.5">
                      <Badge tone={stage.isActive ? "positive" : "neutral"}>
                        {stage.isActive ? t.common.active : t.common.inactive}
                      </Badge>
                      {stage.isSystem ? (
                        <Badge tone="neutral">
                          {t.crmOpportunityStages.systemStage}
                        </Badge>
                      ) : null}
                    </div>
                  ),
                },
                {
                  label: t.crmOpportunityStages.createdAt,
                  value: <DateTime value={stage.createdAt} />,
                },
                {
                  label: t.crmOpportunityStages.updatedAt,
                  value: <DateTime value={stage.updatedAt} />,
                },
              ]}
            />

            <OpportunityStageDrawer
              key={`${stage.id}-${stage.updatedAt}-${isEditOpen}`}
              open={isEditOpen}
              onOpenChange={(open) => {
                if (!open) setEditError(undefined);
                setIsEditOpen(open);
              }}
              stage={stage}
              isSubmitting={detail.isSubmitting}
              error={editError}
              onSubmit={(input) => {
                void detail.save(input).then((result) => {
                  if (result.ok) {
                    setIsEditOpen(false);
                    report(result, t.crmOpportunityStages.updated);
                    return;
                  }
                  setEditError(
                    result.error ? describeFailure(result.error) : undefined,
                  );
                  if (result.error) toast.outcomeFromApi(result.error);
                });
              }}
            />

            <ConfirmActionModal
              open={isDeleteOpen}
              onOpenChange={setIsDeleteOpen}
              title={t.crmOpportunityStages.deleteTitle}
              description={formatTemplate(
                t.crmOpportunityStages.deleteDescription,
                { name: localizedName(stage, lang) },
              )}
              confirmLabel={t.common.delete}
              cancelLabel={t.common.cancel}
              loading={detail.isSubmitting}
              onConfirm={() => {
                void detail.remove().then((result) => {
                  if (report(result, t.crmOpportunityStages.deleted)) {
                    setIsDeleteOpen(false);
                    router.push(STAGES_HREF);
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
