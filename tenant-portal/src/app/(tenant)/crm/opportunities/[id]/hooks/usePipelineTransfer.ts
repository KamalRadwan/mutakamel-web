"use client";

import { useCallback, useMemo, useState } from "react";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmAppliedUnreadable,
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
  /**
   * Re-read the record from the server — defect D2. Used when a write applied
   * but its response body could not be parsed: there is no value to hand the
   * success callback, the record has nonetheless changed, and the one thing
   * that must NOT happen is a form left open with a Save the user presses
   * again.
   */
  onReconcile: () => void,
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
  // D2: the write applied and its receipt could not be read. Its own state,
  // because `error` invites a second Save and that is exactly what a
  // non-idempotent route cannot take.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<CrmAppliedUnreadable | null>(null);

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
        if (outcome.kind === "applied_unreadable") {
          // A transfer moves the opportunity and writes stage history. Sending
          // it again is not a repeat of the same intent, so the dialog closes
          // and the screen re-reads where the record actually landed.
          setAmbiguity(null);
          setError(null);
          setOpen(false);
          setAppliedUnreadable({ attempt, error: outcome.error });
          onReconcile();
          return;
        }
        setError(outcome.error);
      } finally {
        setIsSubmitting(false);
      }
    };

    await send();
    // `onReconcile` is called on the applied_unreadable path and belongs here,
    // for the same reason it does in useLeadEdit: without it the callback keeps
    // the first one the parent passed and reconciles against a stale closure.
  }, [isSubmitting, item, onReconcile, onTransferred, pipelineId, reason, stageId]);

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
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openDialog,
    closeDialog,
    submit,
  };
}
