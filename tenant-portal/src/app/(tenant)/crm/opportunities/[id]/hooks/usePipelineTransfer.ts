"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";
import {
  opportunityPipelinePath,
  parseOpportunityDetailResponse,
  type OpportunityDetail,
} from "../../opportunity-contract";
import { buildTransferPipelineRequest } from "../../opportunity-write-contract";

/**
 * Stage flags a transfer must not land on.
 *
 * The transfer itself is not a stage move, but it accepts an optional
 * `stageId`, and dropping an opportunity straight into a WON or LOST stage of
 * another pipeline would close it as a side effect of a reorganisation. The
 * selector offers only open stages; leaving it empty uses the target
 * pipeline's entry stage, which is what the confirmation warns about.
 */
const TERMINAL_STAGE_FLAGS = ["WON", "LOST"];

export interface PipelineTransferAmbiguity {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

/**
 * `PUT /opportunities/:id/pipeline` — MASTER-PLAN 8.12.
 *
 * Distinct from a stage move, and a `PUT` rather than a `POST`. It is
 * destructive to stage position: the opportunity lands in the target
 * pipeline's entry stage unless an explicit stage is chosen, so the dialog
 * confirms before sending.
 */
export function usePipelineTransfer(
  item: OpportunityDetail | null,
  pipelines: OpportunityPipeline[],
  onTransferred: (item: OpportunityDetail) => void,
) {
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<PipelineTransferAmbiguity | null>(
    null,
  );

  /** The opportunity's current pipeline is never a transfer target. */
  const targetPipelines = useMemo(
    () => pipelines.filter(({ id }) => id !== item?.pipelineId),
    [item?.pipelineId, pipelines],
  );

  const targetStages = useMemo(() => {
    const pipeline = targetPipelines.find(({ id }) => id === pipelineId);
    return (pipeline?.stages ?? []).filter(
      (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
    );
  }, [pipelineId, targetPipelines]);

  const openDialog = useCallback(() => {
    setPipelineId("");
    setStageId("");
    setReason("");
    setError(null);
    setAmbiguity(null);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!item || pipelineId.length === 0 || isSubmitting) return;
    const attempt = createCrmWriteAttempt();
    const body = buildTransferPipelineRequest({ pipelineId, stageId, reason });

    const send = async (): Promise<void> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const outcome = await runCrmWrite({
          attempt,
          method: "put",
          path: opportunityPipelinePath(item.id),
          body,
          parse: parseOpportunityDetailResponse,
          config: { maxResponseBytes: 512 * 1024 },
        });
        if (outcome.kind === "success") {
          setAmbiguity(null);
          onTransferred(outcome.value);
          setOpen(false);
          return;
        }
        if (outcome.kind === "ambiguous") {
          setAmbiguity({ attempt, error: outcome.error, replay: send });
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
  }, [isSubmitting, item, onTransferred, pipelineId, reason, stageId]);

  return {
    open,
    pipelineId,
    setPipelineId: (next: string) => {
      setPipelineId(next);
      setStageId("");
    },
    stageId,
    setStageId,
    reason,
    setReason,
    targetPipelines,
    targetStages,
    isSubmitting,
    error,
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    openDialog,
    closeDialog,
    submit,
  };
}
