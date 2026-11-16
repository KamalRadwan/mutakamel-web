"use client";

import { useMemo, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite, type AppliedUnreadable, type WriteAttempt } from "@/lib/api/idempotent-write";
import type { OpportunityPipeline } from "../../hooks/pipeline-types";
import { opportunityPath, opportunityPipelinePath, parseOpportunityDetailResponse, type OpportunityDetail } from "../../opportunity-contract";
import { buildTransferPipelineRequest, type TransferPipelineRequest } from "../../opportunity-write-contract";

export interface PipelineTransferAmbiguity { attempt: WriteAttempt; error: NormalizedApiError; replay: () => Promise<void> }
interface PendingTransfer { origin: OpportunityDetail; body: TransferPipelineRequest; attempt: WriteAttempt; applied: boolean; uncertain: boolean }

/** A transfer's identity survives unknown outcomes; every recovery reads the saved record first. */
export function usePipelineTransfer(item: OpportunityDetail | null, pipelines: OpportunityPipeline[], onReconcile: () => void) {
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipeline] = useState("");
  const [stageId, setStage] = useState("");
  const [reason, setReasonDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguity, setAmbiguity] = useState<PipelineTransferAmbiguity | null>(null);
  const [appliedUnreadable, setAppliedUnreadable] = useState<AppliedUnreadable | null>(null);
  const active = useRef<PendingTransfer | null>(null);
  const sending = useRef(false);
  const targetPipelines = useMemo(() => pipelines.filter((pipeline) => pipeline.id !== item?.pipelineId && pipeline.isActive), [item?.pipelineId, pipelines]);
  const targetStages = useMemo(() => (targetPipelines.find(({ id }) => id === pipelineId)?.stages ?? []).filter((stage) => stage.isActive && stage.flag !== "WON" && stage.flag !== "LOST"), [pipelineId, targetPipelines]);

  function completed() {
    active.current = null; setAmbiguity(null); setAppliedUnreadable(null); setError(null); setOpen(false); onReconcile();
  }

  async function readBack(retry: boolean): Promise<void> {
    const intent = active.current;
    if (!intent || sending.current) return;
    sending.current = true; setIsSubmitting(true);
    let resend = false;
    try {
      const response = await axiosClient.get<unknown>(opportunityPath(intent.origin.id), { cache: "no-store", maxResponseBytes: 512 * 1024 });
      const fresh = parseOpportunityDetailResponse(response.data);
      if (fresh.id !== intent.origin.id) throw new Error("Opportunity identity changed");
      if (intent.applied || fresh.pipelineId === intent.body.pipelineId) { completed(); return; }
      const unchanged = fresh.pipelineId === intent.origin.pipelineId && fresh.stageId === intent.origin.stageId && fresh.updatedAt === intent.origin.updatedAt;
      // Gateway marks pipeline PUT idempotent. Only an unchanged read permits
      // the exact original body/key to be replayed; never silently transfer a newer record.
      if (retry && unchanged) resend = true;
      else {
        active.current = null; setAmbiguity(null); setAppliedUnreadable(null);
        setError(unchanged ? null : { status: 409 });
        onReconcile();
      }
    } catch (caught) {
      const failure = normalizeApiError(caught);
      setError(failure);
      if (intent.applied) setAppliedUnreadable({ attempt: intent.attempt, error: failure });
      else setAmbiguity({ attempt: intent.attempt, error: failure, replay: () => readBack(true) });
    } finally { sending.current = false; setIsSubmitting(false); }
    if (resend && active.current === intent) await send(intent);
  }

  async function send(intent: PendingTransfer): Promise<void> {
    if (sending.current || active.current !== intent) return;
    sending.current = true; setIsSubmitting(true); setError(null);
    try {
      const outcome = await runIdempotentWrite({ attempt: intent.attempt, method: "put", path: opportunityPipelinePath(intent.origin.id), body: intent.body, parse: parseOpportunityDetailResponse, config: { maxResponseBytes: 512 * 1024 } });
      if (outcome.kind === "success") completed();
      else if (outcome.kind === "ambiguous") { intent.uncertain = true; setAmbiguity({ attempt: intent.attempt, error: outcome.error, replay: () => readBack(true) }); }
      else if (outcome.kind === "applied_unreadable") {
        intent.applied = true; setAmbiguity(null); setAppliedUnreadable({ attempt: intent.attempt, error: outcome.error });
        // Keep recovery reachable in this dialog until a valid read succeeds.
        setOpen(true); onReconcile();
      } else if (intent.uncertain) {
        setAmbiguity({ attempt: intent.attempt, error: outcome.error, replay: () => readBack(true) });
        setError(outcome.error);
      } else { active.current = null; setError(outcome.error); }
    } catch (caught) {
      intent.uncertain = true;
      setAmbiguity({ attempt: intent.attempt, error: normalizeApiError(caught), replay: () => readBack(true) });
    } finally { sending.current = false; setIsSubmitting(false); }
  }

  async function submit(): Promise<void> {
    if (!item || !pipelineId || sending.current || active.current) return;
    const intent: PendingTransfer = { origin: item, body: buildTransferPipelineRequest({ pipelineId, stageId, reason }), attempt: createWriteAttempt(), applied: false, uncertain: false };
    active.current = intent;
    await send(intent);
  }

  return {
    open, pipelineId, stageId, reason, targetPipelines, targetStages, isSubmitting, error, ambiguity, appliedUnreadable,
    locked: isSubmitting || ambiguity !== null || appliedUnreadable !== null,
    setPipelineId: (value: string) => { if (!active.current) { setPipeline(value); setStage(""); } },
    setStageId: (value: string) => { if (!active.current) setStage(value); },
    setReason: (value: string) => { if (!active.current) setReasonDraft(value); },
    openDialog: () => { if (!active.current) { setPipeline(""); setStage(""); setReasonDraft(""); setError(null); } setOpen(true); },
    closeDialog: () => { if (!active.current && !sending.current) { setOpen(false); setError(null); } },
    submit,
    reconcile: () => readBack(false),
    dismissAmbiguity: () => { void readBack(false); },
    dismissAppliedUnreadable: () => { void readBack(false); },
  };
}
