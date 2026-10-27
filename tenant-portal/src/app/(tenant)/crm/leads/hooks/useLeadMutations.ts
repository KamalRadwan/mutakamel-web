"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
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
import { LEADS_PATH, leadPath } from "../lead-contract";
import { buildCreateLeadRequest, type CreateLeadForm } from "../lead-create-contract";
import {
  parseLeadCapabilitiesResponse,
  parseLeadResponse,
  type LeadCapabilities,
  type LeadItem,
  type LeadStage,
} from "../lead-list-contract";
import { readAssignableLeadOwners } from "../[id]/hooks/readLeadOwnerOptions";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";

/** Refresh assignment authority when the bulk bar opens; never reuse another branch's owners. */
export function useLeadBulkOwnerOptions(branchId: string | null, enabled: boolean) {
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const request = useMemo(() => ({ branchId, enabled, scope }), [branchId, enabled, scope]);
  const [loaded, setLoaded] = useState<{
    request: typeof request;
    owners: Array<{ id: string; firstName: string; lastName: string }>;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!branchId || !enabled || !scope.ready) return;
    const controller = new AbortController();
    void Promise.all([
      readAssignableLeadOwners(branchId, "update", controller.signal, scope.headers),
      axiosClient.get<unknown>(`${LEADS_PATH}/capabilities?${new URLSearchParams({ branchId })}`, {
        signal: controller.signal, cache: "no-store", maxResponseBytes: 256 * 1024, headers: scope.headers,
      }),
    ]).then(([owners, response]) => {
      const capability = parseLeadCapabilitiesResponse(response.data, branchId).update;
      if (!controller.signal.aborted) setLoaded({
        request,
        owners: owners.filter((owner) => crmCapabilityAllowsOwner(capability, owner.id)),
        failed: false,
      });
    }).catch(() => {
      if (!controller.signal.aborted) setLoaded({ request, owners: [], failed: true });
    });
    return () => controller.abort();
  }, [branchId, enabled, request, scope]);

  const current = loaded?.request === request ? loaded : null;
  return {
    owners: current?.owners ?? [],
    isLoading: enabled && scope.ready && current === null,
    failed: enabled && (!scope.ready || current?.failed === true),
  };
}

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

export type LeadWriteOutcome =
  | { kind: "success" }
  | { kind: "failed" | "ambiguous"; error: NormalizedApiError }
  | { kind: "blocked"; message: string };

/** What the write hooks share with the list they change. */
export interface LeadWriteContext {
  branchId: string | null;
  items: readonly LeadItem[];
  stages: readonly LeadStage[];
  capabilities: LeadCapabilities | null;
  setError: (message: string | null) => void;
  /** Translated structured error, optionally identifying a refused bulk record. */
  report: (caught: unknown, fallback: string, leadId?: string) => void;
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

/** Keep the refused record visible when the server rejects an atomic bulk batch. */
export function reportBulkLeadError(
  caught: unknown,
  fallback: string,
  report: LeadWriteContext["report"],
): void {
  const details = caught instanceof TenantApiClientError ? caught.response.data.details : null;
  const leadId = details && typeof details === "object" && "leadId" in details
    ? details.leadId
    : null;
  if (typeof leadId === "string" && leadId.length > 0) {
    report(caught, fallback, leadId);
    return;
  }
  report(caught, fallback);
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
  const errorText = useCrmErrorText();
  const messages = t.crmLeads.messages;
  const { branchId, items, stages, capabilities, setError, report, reconcile } = context;
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteInFlightRef = useRef(false);
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

  const handleCreate = async (
    form: CreateLeadForm,
    initialRating?: number,
    onValidationError?: (error: NormalizedApiError) => void,
  ): Promise<boolean> => {
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
      onValidationError?.(outcome.error);
      setError(
        outcome.error.code === "CRM_TAG_UNKNOWN"
          ? messages.tagUnknown
          : errorText(outcome.error) ?? messages.createFailed,
      );
      return false;
    }
    // `ambiguous` and `applied_unreadable`: the lead may exist, so the filled
    // form must not stay open — the next Save would be a fresh key and a second
    // lead. The default first page is reloaded so the user can look for it.
    context.closeCreate();
    context.resetSearch();
    const reloaded = await reconcile(1);
    const notice = reloaded ? messages.createAmbiguousRefreshed : messages.createAmbiguousStale;
    setError(outcome.kind === "ambiguous" ? `${errorText(outcome.error)} ${notice}` : notice);
    return false;
  };

  const handleDelete = async () => {
    const target = context.selectedForDelete;
    if (!target || deleteInFlightRef.current) return;
    if (!crmCapabilityAllowsOwner(capabilities?.delete, target.ownerUserId)) {
      setError(messages.deleteNotPermitted);
      context.setSelectedForDelete(null);
      return;
    }
    deleteInFlightRef.current = true;
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
      deleteInFlightRef.current = false;
      setIsDeleting(false);
    }
  };

  /** One `POST /leads/bulk-delete` per 100 eligible leads, each batch all-or-nothing. */
  const bulkDeleteLeads = async (leadIds: readonly string[]): Promise<boolean> => {
    if (!branchId || deleteInFlightRef.current) return false;
    const eligible = eligibleLeads(items, leadIds, capabilities?.delete ?? null);
    if (eligible.length === 0) return false;
    deleteInFlightRef.current = true;
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
      reportBulkLeadError(caught, messages.deleteFailed, report);
      return false;
    } finally {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
    }
  };

  // Even a definite refusal can mean another user moved the lead first.
  const runMove = async (write: () => Promise<unknown>, bulk: boolean): Promise<LeadWriteOutcome> => {
    moveInFlightRef.current = true;
    setIsMovePending(true);
    setError(null);
    try {
      await write();
      await reconcile();
      return { kind: "success" };
    } catch (caught) {
      await reconcile();
      if (bulk) reportBulkLeadError(caught, messages.moveFailed, report);
      else report(caught, messages.moveFailed);
      return { kind: isAmbiguousWriteFailure(caught) ? "ambiguous" : "failed", error: normalizeApiError(caught) };
    } finally {
      moveInFlightRef.current = false;
      setIsMovePending(false);
    }
  };

  /** `target` carries a lead the list does not hold, such as a board card. */
  const moveLead = async (leadId: string, destinationStageId: string, target?: LeadItem): Promise<LeadWriteOutcome> => {
    if (moveInFlightRef.current) return { kind: "blocked", message: messages.moveFailed };
    if (!branchId) {
      setError(messages.selectBranchToMove);
      return { kind: "blocked", message: messages.selectBranchToMove };
    }
    const lead = target ?? items.find(({ id }) => id === leadId);
    if (!lead || !crmCapabilityAllowsOwner(capabilities?.update, lead.ownerUserId)) {
      setError(messages.moveNotPermitted);
      return { kind: "blocked", message: messages.moveNotPermitted };
    }
    if (isConverted(lead.stageId)) {
      setError(messages.convertedCannotMove);
      return { kind: "blocked", message: messages.convertedCannotMove };
    }
    if (!openStage(destinationStageId)) {
      setError(messages.stageUnavailable);
      return { kind: "blocked", message: messages.stageUnavailable };
    }
    // The 201 body is not read: the reload that follows is the confirmation.
    return runMove(
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
    const outcome = await runMove(async () => {
      for (const batch of leadIdBatches(eligible)) {
        await axiosClient.post<unknown>(
          LEADS_BULK_STAGE_PATH,
          buildBulkMoveLeadStageRequest(branchId, batch, destinationStageId),
          BULK_WRITE_OPTIONS,
        );
      }
    }, true);
    return outcome.kind === "success";
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

/** One write at a time across the selected-lead controls. */
export function useLeadBulkControls({ isDeleting, owners, onBulkMoveStage, onBulkSetRating, onBulkAssignOwner }: {
  isDeleting: boolean;
  owners: readonly { id: string }[];
  onBulkMoveStage: (stageId: string) => Promise<void>;
  onBulkSetRating: (rating: number) => Promise<void>;
  onBulkAssignOwner: (ownerUserId: string) => Promise<void>;
}) {
  const inFlight = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [stageSelect, setStageSelect] = useState("");
  const [ratingSelect, setRatingSelect] = useState("");
  async function handleMove(stageId: string) {
    if (!stageId || inFlight.current || isDeleting) return;
    inFlight.current = true;
    setIsBusy(true);
    try {
      await onBulkMoveStage(stageId);
    } finally {
      setStageSelect("");
      inFlight.current = false;
      setIsBusy(false);
    }
  }

  async function handleRating(value: string) {
    if (!value || inFlight.current || isDeleting) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    inFlight.current = true;
    setIsBusy(true);
    try {
      await onBulkSetRating(parsed);
    } finally {
      setRatingSelect("");
      inFlight.current = false;
      setIsBusy(false);
    }
  }

  async function handleOwner(ownerUserId: string) {
    if (inFlight.current || isDeleting || !owners.some((owner) => owner.id === ownerUserId)) return;
    inFlight.current = true;
    setIsBusy(true);
    try {
      await onBulkAssignOwner(ownerUserId);
    } finally {
      inFlight.current = false;
      setIsBusy(false);
    }
  }

  return { isBusy, stageSelect, ratingSelect, handleMove, handleRating, handleOwner };
}
