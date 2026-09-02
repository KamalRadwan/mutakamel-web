"use client";

import {
  AmbiguousOutcomePanel,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  useAmbiguousOutcomeLabels,
  useAppliedUnreadableLabels,
} from "../../../shared/hooks/useAmbiguousOutcomeLabels";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { usePipelineTransfer } from "../hooks/usePipelineTransfer";

/** Sentinel for "use the target pipeline's entry stage". */
const ENTRY_STAGE_VALUE = "__entry__";

export interface PipelineTransferDialogProps {
  transfer: ReturnType<typeof usePipelineTransfer>;
}

/**
 * `PUT /opportunities/:id/pipeline` — MASTER-PLAN 8.12.
 *
 * A dialog rather than a drawer: the decision is short and the consequence
 * needs to be read before it is taken. The warning is not decoration — leaving
 * the stage unset moves the opportunity to the target pipeline's entry stage,
 * discarding its position in the current one.
 */
export function PipelineTransferDialog({ transfer }: PipelineTransferDialogProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const ambiguousLabels = useAmbiguousOutcomeLabels();
  const appliedLabels = useAppliedUnreadableLabels();
  const errorText = describeError(transfer.error);

  return (
    <Dialog
      open={transfer.open}
      onOpenChange={(open) => {
        if (!open) transfer.closeDialog();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.crmOpportunityDetail.transferTitle}</DialogTitle>
          <DialogDescription>
            {t.crmOpportunityDetail.transferDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {transfer.ambiguity && (
            <AmbiguousOutcomePanel
              operation={t.crmOpportunityDetail.transferOperation}
              idempotencyKey={transfer.ambiguity.attempt.idempotencyKey}
              description={t.crmOpportunityDetail.ambiguousDescription}
              correlationId={transfer.ambiguity.error.correlationId}
              onRetry={() => void transfer.ambiguity?.replay()}
              onDismiss={transfer.dismissAmbiguity}
              labels={ambiguousLabels}
            />
          )}

          {transfer.appliedUnreadable && (
            <AmbiguousOutcomePanel
              operation={t.crmOpportunityDetail.transferOperation}
              idempotencyKey={transfer.appliedUnreadable.attempt.idempotencyKey}
              description={t.crmShared.appliedUnreadableDescription}
              correlationId={transfer.appliedUnreadable.error.correlationId}
              onRetry={() => transfer.reconcile()}
              onDismiss={transfer.dismissAppliedUnreadable}
              labels={appliedLabels}
            />
          )}

          <Field
            label={t.crmOpportunityDetail.targetPipeline}
            required
            error={errorText ?? undefined}
          >
            <Select
              value={transfer.pipelineId}
              onValueChange={transfer.setPipelineId}
              disabled={transfer.isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmOpportunities.selectPipeline} />
              </SelectTrigger>
              <SelectContent>
                {transfer.targetPipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {localizedName(pipeline, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t.crmOpportunityDetail.targetStage}
            hint={t.crmOpportunityDetail.targetStageHint}
          >
            <Select
              value={transfer.stageId || ENTRY_STAGE_VALUE}
              onValueChange={(value) =>
                transfer.setStageId(value === ENTRY_STAGE_VALUE ? "" : value)
              }
              disabled={
                transfer.isSubmitting || transfer.targetStages.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmOpportunityDetail.entryStage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENTRY_STAGE_VALUE}>
                  {t.crmOpportunityDetail.entryStage}
                </SelectItem>
                {transfer.targetStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {localizedName(stage, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t.crmOpportunityDetail.transferReason}
            hint={t.crmOpportunityDetail.transferReasonHint}
          >
            <Textarea
              value={transfer.reason}
              onChange={(event) => transfer.setReason(event.target.value)}
              maxLength={1000}
              disabled={transfer.isSubmitting}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={transfer.closeDialog}
            disabled={transfer.isSubmitting}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => void transfer.submit()}
            disabled={transfer.pipelineId.length === 0}
            loading={transfer.isSubmitting}
          >
            {t.crmOpportunityDetail.transferConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
