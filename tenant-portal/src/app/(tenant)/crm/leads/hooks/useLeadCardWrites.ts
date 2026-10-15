"use client";

import { useRef } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { isAmbiguousWriteFailure } from "@/lib/api/idempotent-write";
import { crmCapabilityAllowsOwner } from "../../shared/crm-capabilities";
import {
  BULK_WRITE_OPTIONS,
  LEADS_BULK_UPDATE_PATH,
  bulkLeadFields,
  leadIdBatches,
  type BulkLeadFieldsPatch,
} from "../lead-bulk-contract";
import { buildLeadCardPatchBody, type LeadCardPatch } from "../lead-card-contract";
import {
  leadCardFields,
  parseLeadResponse,
  type LeadItem,
} from "../lead-list-contract";
import type { UpdateLeadRequest } from "../lead-write-contract";
import {
  SINGLE_LEAD_WRITE_OPTIONS,
  eligibleLeads,
  leadPath,
  type LeadWriteContext,
} from "./useLeadMutations";

interface LeadCardWriteOptions extends LeadWriteContext {
  setItems: (update: (current: LeadItem[]) => LeadItem[]) => void;
}

/** Field edits made on the list itself: card stars and colour, inline cells, bulk fields. */
export function useLeadCardWrites(context: LeadCardWriteOptions) {
  const { t } = useI18n();
  const messages = t.crmLeads.messages;
  const { branchId, items, capabilities, setItems, setError, report, reconcile } = context;
  // Leads with a field write in flight. A ref, not state: it gates the next
  // click, and re-rendering every card while one saves a star is the jitter
  // the optimistic update exists to avoid.
  const writesRef = useRef<Set<string>>(new Set());

  const writableLead = (leadId: string, target?: LeadItem): LeadItem | null => {
    const lead = target ?? items.find(({ id }) => id === leadId);
    if (lead && crmCapabilityAllowsOwner(capabilities?.update, lead.ownerUserId)) return lead;
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
    const applyCardFields = (fields: LeadCardPatch) =>
      setItems((current) => current.map((item) => (item.id === leadId ? { ...item, ...fields } : item)));

    writesRef.current.add(leadId);
    setError(null);
    applyCardFields(patch);
    try {
      let response: AxiosResponse<unknown>;
      try {
        response = await axiosClient.patch<unknown>(leadPath(leadId), buildLeadCardPatchBody(patch), SINGLE_LEAD_WRITE_OPTIONS);
      } catch (caught) {
        applyCardFields(leadCardFields(patch, previous));
        if (isAmbiguousWriteFailure(caught)) {
          await reconcile();
          setError(messages.cardUpdateAmbiguous);
        } else {
          report(caught, messages.cardUpdateFailed);
        }
        return;
      }
      // Past this line the write applied. A body this client cannot read must
      // not revert a card the server already changed: reload and say so.
      try {
        applyCardFields(leadCardFields(patch, parseLeadResponse(response.data, branchId)));
      } catch {
        await reconcile();
        setError(messages.cardUpdateAmbiguous);
      }
    } finally {
      writesRef.current.delete(leadId);
    }
  };

  /** `PATCH /leads/:id` with already-validated changed keys; the reload is the confirmation. */
  const updateLeadInline = async (leadId: string, request: UpdateLeadRequest, target?: LeadItem): Promise<boolean> => {
    if (!branchId || Object.keys(request).length === 0 || writesRef.current.has(leadId)) return false;
    if (!writableLead(leadId, target)) return false;
    writesRef.current.add(leadId);
    setError(null);
    try {
      await axiosClient.patch<unknown>(leadPath(leadId), request, SINGLE_LEAD_WRITE_OPTIONS);
      await reconcile();
      return true;
    } catch (caught) {
      if (isAmbiguousWriteFailure(caught)) {
        await reconcile();
        setError(messages.cardUpdateAmbiguous);
      } else {
        report(caught, messages.cardUpdateFailed);
      }
      return false;
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
    const eligible = eligibleLeads(items, leadIds, capabilities?.update ?? null);
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
      report(caught, messages.cardUpdateFailed);
      return false;
    }
  };

  return { updateLeadCard, updateLeadInline, bulkUpdateLeads };
}
