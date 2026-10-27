"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isAmbiguousWriteFailure } from "@/lib/api/idempotent-write";
import { crmCapabilityAllowsOwner } from "../../shared/crm-capabilities";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  BULK_WRITE_OPTIONS,
  LEADS_BULK_UPDATE_PATH,
  bulkLeadFields,
  leadIdBatches,
  type BulkLeadFieldsPatch,
} from "../lead-bulk-contract";
import { buildLeadCardPatchBody, type LeadCardPatch } from "../lead-card-contract";
import { leadPath } from "../lead-contract";
import {
  leadCardFields,
  parseLeadResponse,
  type LeadItem,
} from "../lead-list-contract";
import type { UpdateLeadRequest } from "../lead-write-contract";
import {
  SINGLE_LEAD_WRITE_OPTIONS,
  eligibleLeads,
  reportBulkLeadError,
  type LeadWriteContext,
  type LeadWriteOutcome,
} from "./useLeadMutations";

interface LeadCardWriteOptions extends LeadWriteContext {
  setItems: (update: (current: LeadItem[]) => LeadItem[]) => void;
}

/** Field edits made on the list itself: card stars and colour, inline cells, bulk fields. */
export function useLeadCardWrites(context: LeadCardWriteOptions) {
  const { t } = useI18n();
  const errorText = useCrmErrorText();
  const messages = t.crmLeads.messages;
  const { branchId, items, stages, capabilities, setItems, setError, report, reconcile } = context;
  // Leads with a field write in flight. A ref, not state: it gates the next
  // click, and re-rendering every card while one saves a star is the jitter
  // the optimistic update exists to avoid.
  const writesRef = useRef<Set<string>>(new Set());

  const writableLead = (leadId: string, target?: LeadItem): LeadItem | null => {
    const lead = target ?? items.find(({ id }) => id === leadId);
    if (
      lead &&
      stages.find(({ id }) => id === lead.stageId)?.flag !== "CONVERTED" &&
      crmCapabilityAllowsOwner(capabilities?.update, lead.ownerUserId)
    ) return lead;
    setError(messages.cardNotPermitted);
    return null;
  };

  /**
   * The card's rating and colour, applied on screen first — a star that does
   * nothing for a round trip reads as broken and gets clicked again. So every
   * exit either adopts the server-confirmed fields or puts the old ones back:
   *   - a definite answer, parsed   -> adopt the confirmed card fields
   *   - a definite rejection (<500) -> revert, and say why
   *   - anything else               -> revert and reload, asserting neither state
   * One write per lead at a time: a second click would capture an already
   * optimistic `previous`, and a later failure would "revert" to the new value.
   */
  const updateLeadCard = async (leadId: string, patch: LeadCardPatch, target?: LeadItem) => {
    if (!branchId || writesRef.current.has(leadId)) return;
    const previous = writableLead(leadId, target);
    if (!previous) return;
    const applyCardFields = (fields: LeadCardPatch & { updatedAt?: string }) =>
      setItems((current) => current.map((item) => (item.id === leadId ? { ...item, ...fields } : item)));

    writesRef.current.add(leadId);
    setError(null);
    applyCardFields(patch);
    try {
      let response: AxiosResponse<unknown>;
      try {
        response = await axiosClient.patch<unknown>(leadPath(leadId), { ...buildLeadCardPatchBody(patch), expectedUpdatedAt: previous.updatedAt }, SINGLE_LEAD_WRITE_OPTIONS);
      } catch (caught) {
        applyCardFields(leadCardFields(patch, previous));
        if (isAmbiguousWriteFailure(caught)) {
          await reconcile();
          setError(`${errorText(normalizeApiError(caught))} ${messages.cardUpdateAmbiguous}`);
        } else {
          report(caught, messages.cardUpdateFailed);
        }
        return;
      }
      // Past this line the write applied. A body this client cannot read must
      // not revert a card the server already changed: reload and say so.
      try {
        const saved = parseLeadResponse(response.data, branchId);
        applyCardFields({ ...leadCardFields(patch, saved), updatedAt: saved.updatedAt });
      } catch {
        await reconcile();
        setError(messages.cardUpdateAmbiguous);
      }
    } finally {
      writesRef.current.delete(leadId);
    }
  };

  /** `PATCH /leads/:id` with already-validated changed keys; the reload is the confirmation. */
  const updateLeadInline = async (leadId: string, request: UpdateLeadRequest, target?: LeadItem): Promise<LeadWriteOutcome> => {
    if (!branchId || Object.keys(request).length === 0 || writesRef.current.has(leadId)) {
      return { kind: "blocked", message: messages.cardUpdateFailed };
    }
    const previous = writableLead(leadId, target);
    if (!previous) return { kind: "blocked", message: messages.cardNotPermitted };
    writesRef.current.add(leadId);
    setError(null);
    try {
      await axiosClient.patch<unknown>(leadPath(leadId), { ...request, expectedUpdatedAt: request.expectedUpdatedAt ?? previous.updatedAt }, SINGLE_LEAD_WRITE_OPTIONS);
      await reconcile();
      return { kind: "success" };
    } catch (caught) {
      if (isAmbiguousWriteFailure(caught)) {
        await reconcile();
        setError(`${errorText(normalizeApiError(caught))} ${messages.cardUpdateAmbiguous}`);
      } else {
        report(caught, messages.cardUpdateFailed);
      }
      return { kind: isAmbiguousWriteFailure(caught) ? "ambiguous" : "failed", error: normalizeApiError(caught) };
    } finally {
      writesRef.current.delete(leadId);
    }
  };

  /**
   * One `POST /leads/bulk-update` per 100 eligible leads. Only the four
   * lead-owned bulk fields travel; identity and contact edits stay single-lead.
   */
  const bulkUpdateLeads = async (leadIds: readonly string[], patch: BulkLeadFieldsPatch): Promise<boolean> => {
    const fields = bulkLeadFields(patch);
    if (!branchId || Object.keys(fields).length === 0) return false;
    const eligible = eligibleLeads(
      items,
      leadIds,
      capabilities?.update ?? null,
      (lead) => stages.find(({ id }) => id === lead.stageId)?.flag !== "CONVERTED",
    );
    if (eligible.length === 0) return false;
    setError(null);
    try {
      for (const batch of leadIdBatches(eligible)) {
        await axiosClient.post<unknown>(LEADS_BULK_UPDATE_PATH, { branchId, leadIds: batch, ...fields }, BULK_WRITE_OPTIONS);
      }
      await reconcile();
      return true;
    } catch (caught) {
      // A refused batch rolls back but earlier batches stand: reload either way.
      await reconcile();
      reportBulkLeadError(caught, messages.cardUpdateFailed, report);
      return false;
    }
  };

  return { updateLeadCard, updateLeadInline, bulkUpdateLeads };
}

/** Serializes modal writes and discards feedback belonging to a previous selection. */
export function useLeadQuickEditWrites(lead: LeadItem | null, branchId: string | null) {
  const pending = useRef<symbol | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pending.current = null;
    queueMicrotask(() => {
      if (cancelled || pending.current !== null) return;
      setIsPending(false);
      setError(null);
      setMessage(null);
    });
    return () => {
      cancelled = true;
      pending.current = null;
    };
  }, [lead, branchId]);

  const runWrite = useCallback(async (write: () => Promise<LeadWriteOutcome>): Promise<LeadWriteOutcome | null> => {
    if (pending.current) return null;
    const token = Symbol();
    pending.current = token;
    setIsPending(true);
    setError(null);
    setMessage(null);
    try {
      let outcome: LeadWriteOutcome;
      try {
        outcome = await write();
      } catch (caught) {
        outcome = { kind: isAmbiguousWriteFailure(caught) ? "ambiguous" : "failed", error: normalizeApiError(caught) };
      }
      if (pending.current !== token) return null;
      if (outcome.kind === "blocked") setMessage(outcome.message);
      else if (outcome.kind !== "success") setError(outcome.error);
      return outcome;
    } finally {
      if (pending.current === token) {
        pending.current = null;
        setIsPending(false);
      }
    }
  }, []);

  return { runWrite, isPending, error, message };
}

interface LeadBulkDeleteOptions {
  scopeKey: string;
  items: readonly LeadItem[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: Set<string>) => void;
  canDeleteLead: (lead: LeadItem) => boolean;
  deleteLeads: (ids: readonly string[]) => Promise<boolean>;
  disabled: boolean;
}

/** The list's confirmation owns a snapshot, so changing results cannot delete stale selections. */
export function useLeadBulkDelete(options: LeadBulkDeleteOptions) {
  const { t } = useI18n();
  const toast = useToast();
  const { scopeKey, items, selectedIds, onSelectionChange, canDeleteLead, deleteLeads, disabled } = options;
  const [pending, setPending] = useState<{ scopeKey: string; ids: ReadonlySet<string> } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const inFlight = useRef(false);
  const currentScope = useRef(scopeKey);
  const scopeRevision = useRef(0);

  useEffect(() => {
    if (currentScope.current === scopeKey) return;
    currentScope.current = scopeKey;
    scopeRevision.current += 1;
    onSelectionChange(new Set());
    setPending(null);
  }, [onSelectionChange, scopeKey]);

  const selection = pending?.scopeKey === scopeKey ? pending.ids : selectedIds;
  const eligibleIds = items
    .filter((lead) => selection.has(lead.id) && canDeleteLead(lead))
    .map((lead) => lead.id);
  const skippedCount = selection.size - eligibleIds.length;
  const isOpen = pending !== null && pending.scopeKey === scopeKey;

  const request = () => {
    if (disabled || inFlight.current || eligibleIds.length === 0) return;
    setPending({ scopeKey, ids: new Set(selectedIds) });
  };
  const close = () => {
    if (!inFlight.current) setPending(null);
  };
  const confirm = async () => {
    if (!isOpen || disabled || inFlight.current || eligibleIds.length === 0) return;
    inFlight.current = true;
    const revision = scopeRevision.current;
    setIsPending(true);
    try {
      const succeeded = await deleteLeads(eligibleIds);
      if (succeeded) {
        if (scopeRevision.current === revision) {
          onSelectionChange(new Set());
          setPending(null);
        }
        toast.success(t.crmLeads.bulkDeleteCompleted(eligibleIds.length), t.crmLeads.bulkDeleteSkipped(skippedCount));
      } else if (skippedCount > 0) {
        toast.info(t.crmLeads.bulkDeleteSkipped(skippedCount));
      }
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  };

  return { isOpen, isPending, eligibleCount: eligibleIds.length, selectedCount: selection.size, skippedCount, request, close, confirm };
}
