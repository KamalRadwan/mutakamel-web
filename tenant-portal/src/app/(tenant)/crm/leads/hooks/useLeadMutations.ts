"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import {
  createWriteAttempt,
  isAmbiguousWriteFailure,
  runIdempotentWrite,
} from "@/lib/api/idempotent-write";
import {
  crmCapabilityAllowsOwner,
  type CrmActionCapability,
} from "../../shared/crm-capabilities";
import {
  BULK_WRITE_OPTIONS,
  LEADS_BULK_DELETE_PATH,
  LEADS_BULK_STAGE_PATH,
  buildBulkMoveLeadStageRequest,
  leadIdBatches,
} from "../lead-bulk-contract";
import { buildLeadCardPatchBody } from "../lead-card-contract";
import { buildCreateLeadRequest, type CreateLeadForm } from "../lead-create-contract";
import {
  parseLeadResponse,
  type LeadCapabilities,
  type LeadItem,
  type LeadStage,
} from "../lead-list-contract";

const LEADS_PATH = "/api/tenant/crm/v1/leads";

/**
 * The single-lead writes below are `idempotent: false` in the Gateway route
 * contract: no key to mint, and never replayed after a token refresh.
 */
export const SINGLE_LEAD_WRITE_OPTIONS = {
  nonReplayable: true,
  skipAutoIdempotency: true,
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;

export function leadPath(leadId: string): string {
  return `${LEADS_PATH}/${encodeURIComponent(leadId)}`;
}

/** What the write hooks share with the list they change. */
export interface LeadWriteContext {
  branchId: string | null;
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  capabilities: LeadCapabilities | null;
  setError: (message: string | null) => void;
  /** The server message of a definite rejection, else `fallback`. */
  report: (caught: unknown, fallback: string) => void;
  /** Reloads the list (from `page` when given) and refreshes the board and KPIs. */
  reconcile: (page?: number) => Promise<boolean>;
}

/** The selected leads this capability reaches; ids the list no longer has drop out. */
export function eligibleLeads(
  items: readonly LeadItem[],
  leadIds: readonly string[],
  capability: CrmActionCapability | null,
  keep: (lead: LeadItem) => boolean = () => true,
): LeadItem[] {
  return leadIds
    .map((id) => items.find((lead) => lead.id === id))
    .filter(
      (lead): lead is LeadItem =>
        lead !== undefined && crmCapabilityAllowsOwner(capability, lead.ownerUserId) && keep(lead),
    );
}

interface LeadMutationOptions extends LeadWriteContext {
  currentPage: number;
  closeCreate: () => void;
  resetSearch: () => void;
  selectedForDelete: LeadItem | null;
  setSelectedForDelete: (lead: LeadItem | null) => void;
}

/** Create, delete and stage moves — single-lead and bulk. */
export function useLeadMutations(context: LeadMutationOptions) {
  const { t } = useI18n();
  const messages = t.crmLeads.messages;
  const { branchId, items, stages, capabilities, setError, report, reconcile } = context;
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMovePending, setIsMovePending] = useState(false);
  // Gates the next move synchronously; the state above only renders it.
  const moveInFlightRef = useRef(false);

  const isConverted = (stageId: string) =>
    stages.find(({ id }) => id === stageId)?.flag === "CONVERTED";
  const openStage = (stageId: string) => {
    const stage = stages.find(({ id }) => id === stageId);
    return stage !== undefined && stage.flag !== "CONVERTED";
  };

  // The create DTO has no rating, so a rating chosen in the form follows as a
  // card PATCH once the lead exists. Its failure is reported, never hidden.
  const applyInitialRating = async (leadId: string, rating: number): Promise<unknown> => {
    try {
      await axiosClient.patch(leadPath(leadId), buildLeadCardPatchBody({ rating }), SINGLE_LEAD_WRITE_OPTIONS);
      return null;
    } catch (caught) {
      return caught;
    }
  };

  const handleCreate = async (form: CreateLeadForm, initialRating?: number): Promise<boolean> => {
    if (!branchId) {
      setError(messages.selectBranchToCreate);
      return false;
    }
    if (!capabilities?.create) {
      setError(messages.createNotPermitted);
      return false;
    }
    setError(null);
    // `POST /crm/leads` demands an idempotency key. One key per Save press,
    // reused across that attempt's retries, is what stops a retry from filing
    // a second lead — lib/api/idempotent-write.ts, rules 1 and 2.
    const outcome = await runIdempotentWrite({
      attempt: createWriteAttempt(),
      method: "post",
      path: LEADS_PATH,
      body: buildCreateLeadRequest(form, branchId),
      // Validated against the branch the lead was filed into, which may not
      // be the one on screen; a mismatch would report a created lead as failed.
      parse: (payload) => parseLeadResponse(payload, form.branchId || branchId),
      config: { maxResponseBytes: 256 * 1024 },
    });

    if (outcome.kind === "success") {
      const ratingFailure =
        initialRating !== undefined && initialRating > 0
          ? await applyInitialRating(outcome.value.id, initialRating)
          : null;
      context.closeCreate();
      await reconcile(1);
      if (ratingFailure) report(ratingFailure, messages.cardUpdateFailed);
      return true;
    }
    if (outcome.kind === "failed") {
      setError(
        outcome.error.code === "CRM_TAG_UNKNOWN"
          ? messages.tagUnknown
          : outcome.error.message || messages.createFailed,
      );
      return false;
    }
    // `ambiguous` and `applied_unreadable`: the lead may exist, so the filled
    // form must not stay open — the next Save would be a fresh key and a second
    // lead. The default first page is reloaded so the user can look for it.
    context.closeCreate();
    context.resetSearch();
    const reloaded = await reconcile(1);
    setError(reloaded ? messages.createAmbiguousRefreshed : messages.createAmbiguousStale);
    return false;
  };

  const handleDelete = async () => {
    const target = context.selectedForDelete;
    if (!target || isDeleting) return;
    if (!crmCapabilityAllowsOwner(capabilities?.delete, target.ownerUserId)) {
      setError(messages.deleteNotPermitted);
      context.setSelectedForDelete(null);
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await axiosClient.delete(leadPath(target.id), { ...SINGLE_LEAD_WRITE_OPTIONS, maxResponseBytes: 64 * 1024 });
      context.setSelectedForDelete(null);
      const { currentPage } = context;
      await reconcile(items.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage);
    } catch (caught) {
      if (isAmbiguousWriteFailure(caught)) {
        await reconcile();
        context.setSelectedForDelete(null);
      }
      report(caught, messages.deleteFailed);
    } finally {
      setIsDeleting(false);
    }
  };

  /** One `POST /leads/bulk-delete` per 100 eligible leads, each batch all-or-nothing. */
  const bulkDeleteLeads = async (leadIds: readonly string[]): Promise<boolean> => {
    if (!branchId || isDeleting) return false;
    const eligible = eligibleLeads(items, leadIds, capabilities?.delete ?? null);
    if (eligible.length === 0) return false;
    setIsDeleting(true);
    setError(null);
    try {
      for (const batch of leadIdBatches(eligible)) {
        await axiosClient.post<unknown>(LEADS_BULK_DELETE_PATH, { branchId, leadIds: batch }, BULK_WRITE_OPTIONS);
      }
      await reconcile();
      return true;
    } catch (caught) {
      // A refused batch rolls back but earlier batches stand: reload either way.
      await reconcile();
      report(caught, messages.deleteFailed);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  // A bulk batch refused part-way still leaves earlier batches applied, so a
  // bulk move reloads on any failure; a single move only when the outcome is unknown.
  const runMove = async (write: () => Promise<unknown>, reloadOnRefusal: boolean): Promise<boolean> => {
    moveInFlightRef.current = true;
    setIsMovePending(true);
    setError(null);
    try {
      await write();
      await reconcile();
      return true;
    } catch (caught) {
      if (reloadOnRefusal || isAmbiguousWriteFailure(caught)) await reconcile();
      report(caught, messages.moveFailed);
      return false;
    } finally {
      moveInFlightRef.current = false;
      setIsMovePending(false);
    }
  };

  /** `target` carries a lead the list does not hold, such as a board card. */
  const moveLead = async (leadId: string, destinationStageId: string, target?: LeadItem) => {
    if (moveInFlightRef.current) return;
    if (!branchId) {
      setError(messages.selectBranchToMove);
      return;
    }
    const lead = target ?? items.find(({ id }) => id === leadId);
    if (!lead || !crmCapabilityAllowsOwner(capabilities?.update, lead.ownerUserId)) {
      setError(messages.moveNotPermitted);
      return;
    }
    if (isConverted(lead.stageId)) {
      setError(messages.convertedCannotMove);
      return;
    }
    if (!openStage(destinationStageId)) {
      setError(messages.stageUnavailable);
      return;
    }
    // The 201 body is not read: the reload that follows is the confirmation.
    await runMove(
      () => axiosClient.post<unknown>(`${leadPath(leadId)}/stage`, { stageId: destinationStageId }, SINGLE_LEAD_WRITE_OPTIONS),
      false,
    );
  };

  /** One `POST /leads/bulk-stage` per 100 eligible leads; the list is reloaded either way. */
  const bulkMoveStage = async (leadIds: readonly string[], destinationStageId: string): Promise<boolean> => {
    if (!branchId || moveInFlightRef.current) return false;
    if (!openStage(destinationStageId)) {
      setError(messages.stageUnavailable);
      return false;
    }
    const eligible = eligibleLeads(
      items,
      leadIds,
      capabilities?.update ?? null,
      (lead) => !isConverted(lead.stageId) && lead.stageId !== destinationStageId,
    );
    if (eligible.length === 0) return false;
    return runMove(async () => {
      for (const batch of leadIdBatches(eligible)) {
        await axiosClient.post<unknown>(
          LEADS_BULK_STAGE_PATH,
          buildBulkMoveLeadStageRequest(branchId, batch, destinationStageId),
          BULK_WRITE_OPTIONS,
        );
      }
    }, true);
  };

  return {
    isDeleting,
    isMovePending,
    handleCreate,
    handleDelete,
    bulkDeleteLeads,
    moveLead,
    bulkMoveStage,
  };
}
