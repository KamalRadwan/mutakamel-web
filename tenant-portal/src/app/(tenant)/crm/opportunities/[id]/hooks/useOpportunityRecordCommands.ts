"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, expectNoContent, runIdempotentWrite, type WriteAttempt, type WriteOptions } from "@/lib/api/idempotent-write";
import { useCreateLeadTags } from "../../../leads/hooks/useCreateLeadTags";
import { parseCrmTags } from "../../../shared/tag-contract";
import { opportunityPath, parseOpportunityDetailResponse, type OpportunityDetail } from "../../opportunity-contract";

export function useOpportunityRecordCommands(item: OpportunityDetail | null, reload: () => void, canUpdate: boolean, canDelete: boolean) {
  const { t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [feedback, setFeedback] = useState<{ attempt: WriteAttempt; error: NormalizedApiError; replay: () => Promise<void>; operation: string; kind: "ambiguous" | "applied_unreadable" } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const tags = useCreateLeadTags(Boolean(item));
  const write = async (options: Omit<WriteOptions<unknown>, "attempt">, operation: string, readBack: () => Promise<void>, onApplied?: () => void) => {
    if (sending.current || feedback) return;
    const attempt = createWriteAttempt();
    const reconcile = async () => {
      if (sending.current) return;
      sending.current = true; setSaving(true);
      try { await readBack(); setFeedback(null); setError(null); reload(); }
      catch (caught) { setError(normalizeApiError(caught)); }
      finally { sending.current = false; setSaving(false); }
    };
    const send = async (): Promise<void> => {
      if (sending.current) return;
      sending.current = true; setSaving(true); setError(null);
      try {
        const outcome = await runIdempotentWrite({ ...options, config: { ...options.config, nonReplayable: true }, attempt });
        if (outcome.kind === "failed") { setFeedback(null); setError(outcome.error); }
        else if (outcome.kind === "ambiguous") setFeedback({ operation, attempt, error: outcome.error, replay: reconcile, kind: "ambiguous" });
        else {
          setFeedback(outcome.kind === "applied_unreadable" ? { operation, attempt, error: outcome.error, replay: reconcile, kind: "applied_unreadable" } : null);
          if (outcome.kind === "success") onApplied?.();
          reload();
        }
      } finally { sending.current = false; setSaving(false); }
    };
    await send();
  };
  const toggleTag = async (tagId: string, attached: boolean) => {
    if (!item || !canUpdate) return;
    await write(attached ? { method: "delete", path: `${opportunityPath(item.id)}/tags/${encodeURIComponent(tagId)}`, parse: expectNoContent }
      : { method: "post", path: `${opportunityPath(item.id)}/tags`, body: { tagIds: [tagId] }, parse: (payload) => parseCrmTags(payload) }, t.crmOpportunityDetail.editOperation,
      async () => {
        const response = await axiosClient.get<unknown>(`${opportunityPath(item.id)}/tags`, { cache: "no-store", maxResponseBytes: 256 * 1024 });
        if (!Array.isArray(response.data)) throw new Error("Opportunity tags reconciliation returned no collection");
        parseCrmTags(response.data);
      });
  };
  const deleteRecord = async () => {
    if (!item || !canDelete) return;
    await write({ method: "delete", path: opportunityPath(item.id), parse: expectNoContent }, t.common.delete,
      async () => {
        try {
          const response = await axiosClient.get<unknown>(opportunityPath(item.id), { cache: "no-store", maxResponseBytes: 512 * 1024 });
          const latest = parseOpportunityDetailResponse(response.data);
          if (latest.id !== item.id) throw new Error("Opportunity reconciliation identity changed");
        } catch (caught) {
          // A missing record may be deleted or no longer visible; leave without claiming either.
          if (normalizeApiError(caught).status !== 404) throw caught;
          router.push("/crm/opportunities");
        }
      },
      () => router.push("/crm/opportunities"));
    setDeleteOpen(false);
  };
  return {
    saving, error, feedback, tags, deleteOpen, setDeleteOpen, tagMenuOpen, setTagMenuOpen, createTagOpen, setCreateTagOpen,
    toggleTag, deleteRecord,
    reconcile: () => { if (feedback) void feedback.replay(); },
  };
}
