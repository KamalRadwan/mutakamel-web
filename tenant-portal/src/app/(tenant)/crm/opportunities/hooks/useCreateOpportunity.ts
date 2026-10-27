"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readCoreData } from "@/lib/api/envelope";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  createWriteAttempt,
  runIdempotentWrite,
  type AppliedUnreadable,
  type WriteAttempt,
} from "@/lib/api/idempotent-write";
import {
  OPPORTUNITIES_PATH,
  parseOpportunityDetailResponse,
} from "../opportunity-contract";
import { useCrmCreateForm } from "../../shared/hooks/useCrmCreateForm";
import {
  EMPTY_OPPORTUNITY_FORM,
  buildCreateOpportunityRequest,
  type OpportunityForm,
} from "../opportunity-write-contract";
import {
  opportunitySectionErrorCount,
  validateCreateOpportunity,
  type OpportunityCreateMessages,
  type OpportunitySectionId,
} from "../opportunity-create-validation";
import type { OpportunityPipeline } from "./pipeline-types";

/** `WON` and `LOST` are terminal; a new opportunity never starts closed. */
const TERMINAL_STAGE_FLAGS = ["WON", "LOST"];

export interface CreateOpportunityAmbiguity {
  attempt: WriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

export interface OpportunityTagRecovery {
  opportunityId: string;
  tagIds: string[];
  attempt: WriteAttempt;
  status: "failed" | "uncertain";
  error: NormalizedApiError;
}

/**
 * `POST /opportunities` — MASTER-PLAN 8.11 (create half).
 *
 * Until now the only route to a new opportunity was lead conversion. This is
 * the direct one, for a deal that arrives from an existing customer rather than
 * a lead — which is why `customerProfileId` is required and picked, never
 * typed.
 */
export function useCreateOpportunity(
  branchId: string | null,
  pipelines: OpportunityPipeline[],
  messages: OpportunityCreateMessages,
  requiredCustomFieldKeys: readonly string[],
  onCreated: (opportunityId: string) => void,
  /**
   * Re-read what the screen shows — defect D2. Called when a write applied but
   * its response body could not be parsed, and offered again as the panel's own
   * action, because refreshing is the only safe thing left to do.
   */
  onReconcile: () => void,
) {
  const [open, setOpen] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  // D2: the write applied and its receipt could not be read. Its own state,
  // because `error` invites a second Save and that is exactly what a
  // non-idempotent route cannot take.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<AppliedUnreadable | null>(null);
  const [ambiguity, setAmbiguity] = useState<CreateOpportunityAmbiguity | null>(
    null,
  );
  const [tagRecovery, setTagRecovery] = useState<OpportunityTagRecovery | null>(null);
  const [isRetryingTags, setIsRetryingTags] = useState(false);
  // Refs also protect same-tick submissions and callbacks from an older render.
  const activeAttempt = useRef<WriteAttempt | null>(null);
  const sending = useRef(false);

  const validate = useCallback(
    (candidate: OpportunityForm) =>
      validateCreateOpportunity(candidate, messages, requiredCustomFieldKeys),
    [messages, requiredCustomFieldKeys],
  );
  const createInitial = useCallback(() => ({ ...EMPTY_OPPORTUNITY_FORM }), []);
  const state = useCrmCreateForm({ createInitial, validate });
  const { form, setForm, errors, allErrors, revealAll, reset } = state;

  const selectableStages = useMemo(() => {
    const pipeline = pipelines.find(({ id }) => id === form.pipelineId);
    return (pipeline?.stages ?? []).filter(
      (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
    );
  }, [form.pipelineId, pipelines]);

  const sectionErrorCount = useCallback(
    (section: OpportunitySectionId) => opportunitySectionErrorCount(errors, section),
    [errors],
  );

  const openModal = useCallback(
    (
      initialStageId?: string | null,
      initialDraft?: Partial<OpportunityForm>,
      defaultPipelineId?: string | null,
    ) => {
      if (activeAttempt.current) {
        setOpen(true);
        return;
      }
      reset();
      setCustomerLabel("");
      setError(null);
      setAmbiguity(null);
      const fallbackPipeline =
        defaultPipelineId ||
        pipelines.find((p) => p.isDefault)?.id ||
        pipelines[0]?.id ||
        "";
      const targetPipelineId = initialDraft?.pipelineId || fallbackPipeline;
      const targetPipeline = pipelines.find((p) => p.id === targetPipelineId);
      const nonTerminal = (targetPipeline?.stages ?? []).filter(
        (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
      );
      const targetStageId =
        initialDraft?.stageId ||
        initialStageId ||
        nonTerminal[0]?.id ||
        "";

      setForm((prev) => ({
        ...prev,
        currencyCode: "",
        importance: "2",
        probabilityPercent: "50",
        ...initialDraft,
        pipelineId: targetPipelineId,
        stageId: targetStageId,
      }));
      setOpen(true);
    },
    [pipelines, reset, setForm],
  );

  const closeModal = useCallback(() => {
    if (!activeAttempt.current) {
      reset();
      setError(null);
    }
    setOpen(false);
  }, [reset]);

  // A stage belongs to exactly one pipeline — `where: { id, pipelineId }` — so
  // a stage chosen under the old pipeline is `404 PIPELINE_STAGE_NOT_FOUND`
  // against the new one. It is cleared rather than left to be rejected.
  const selectPipeline = useCallback(
    (pipelineId: string) => {
      const targetPipeline = pipelines.find((p) => p.id === pipelineId);
      const firstStage = (targetPipeline?.stages ?? []).find(
        (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
      );
      setForm((current) => ({
        ...current,
        pipelineId,
        stageId: firstStage?.id ?? "",
      }));
    },
    [pipelines, setForm],
  );

  const setCustomField = useCallback(
    (fieldKey: string, value: unknown) => {
      setForm((current) => ({
        ...current,
        customFields: { ...current.customFields, [fieldKey]: value },
      }));
    },
    [setForm],
  );

  const selectCustomer = useCallback(
    (id: string, label: string) => {
      setCustomerLabel(label);
      setForm((current) => ({ ...current, customerProfileId: id }));
    },
    [setForm],
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      setForm((current) => {
        const existing = current.tagIds ?? [];
        const next = existing.includes(tagId)
          ? existing.filter((id) => id !== tagId)
          : [...existing, tagId];
        return { ...current, tagIds: next };
      });
    },
    [setForm],
  );

  const submit = useCallback(
    async (options?: { keepOpenAfterSuccess?: boolean }): Promise<boolean> => {
      if (activeAttempt.current || sending.current || tagRecovery) return false;
      // Every field speaks now, including the ones never focused. Submit is not
      // disabled while the form is invalid: a disabled button gives a keyboard
      // user no way to ask what is wrong, so the press is what reveals it.
      revealAll();
      if (!branchId || isSubmitting || Object.keys(allErrors).length > 0) {
        return false;
      }
      let body;
      try {
        body = buildCreateOpportunityRequest(form, branchId);
      } catch (caught) {
        // The builder throws a code, not prose — `useCrmErrorText` owns the words.
        setError({
          status: 422,
          code: caught instanceof Error ? caught.message : undefined,
        });
        return false;
      }
      const attempt = createWriteAttempt();
      const selectedTagIds = form.tagIds ?? [];
      activeAttempt.current = attempt;
      let unresolved = false;

      const send = async (): Promise<boolean> => {
        if (sending.current || activeAttempt.current !== attempt) return false;
        sending.current = true;
        setIsSubmitting(true);
        setError(null);
        try {
          const outcome = await runIdempotentWrite({
            attempt,
            method: "post",
            path: OPPORTUNITIES_PATH,
            body,
            parse: parseOpportunityDetailResponse,
            config: { maxResponseBytes: 512 * 1024 },
          });
          if (outcome.kind === "success") {
            if (selectedTagIds.length > 0) {
              const tagAttempt = createWriteAttempt();
              try {
                const tagOutcome = await runIdempotentWrite({
                  attempt: tagAttempt,
                  method: "post",
                  path: `${OPPORTUNITIES_PATH}/${encodeURIComponent(outcome.value.id)}/tags`,
                  body: { tagIds: selectedTagIds },
                  parse: (payload) => payload,
                });
                if (tagOutcome.kind !== "success") {
                  const uncertain = tagOutcome.kind === "ambiguous" || tagOutcome.kind === "applied_unreadable";
                  setTagRecovery({
                    opportunityId: outcome.value.id,
                    tagIds: selectedTagIds,
                    attempt: tagAttempt,
                    status: uncertain ? "uncertain" : "failed",
                    error: tagOutcome.error,
                  });
                  activeAttempt.current = null;
                  setAmbiguity(null);
                  reset();
                  setCustomerLabel("");
                  setForm((prev) => ({
                    ...prev,
                    pipelineId: form.pipelineId,
                    stageId: form.stageId,
                    currencyCode: "",
                    importance: "2",
                    probabilityPercent: "50",
                  }));
                  setOpen(true);
                  onReconcile();
                  return true;
                }
              } catch {
                setTagRecovery({
                  opportunityId: outcome.value.id,
                  tagIds: selectedTagIds,
                  attempt: tagAttempt,
                  status: "uncertain",
                  error: { status: 0 },
                });
                activeAttempt.current = null;
                setAmbiguity(null);
                reset();
                setCustomerLabel("");
                setForm((prev) => ({
                  ...prev,
                  pipelineId: form.pipelineId,
                  stageId: form.stageId,
                  currencyCode: "",
                  importance: "2",
                  probabilityPercent: "50",
                }));
                setOpen(true);
                onReconcile();
                return true;
              }
            }
            activeAttempt.current = null;
            setAmbiguity(null);
            if (options?.keepOpenAfterSuccess) {
              const prevPipelineId = form.pipelineId;
              const prevStageId = form.stageId;
              reset();
              setCustomerLabel("");
              setForm((prev) => ({
                ...prev,
                pipelineId: prevPipelineId,
                stageId: prevStageId,
                currencyCode: "",
                importance: "2",
                probabilityPercent: "50",
              }));
              onReconcile();
            } else {
              setOpen(false);
              reset();
              onCreated(outcome.value.id);
            }
            return true;
          }
          if (outcome.kind === "ambiguous") {
            unresolved = true;
            setAmbiguity({
              attempt,
              error: outcome.error,
              replay: async () => {
                await send();
              },
            });
            return false;
          }
          if (outcome.kind === "applied_unreadable") {
            activeAttempt.current = null;
            setAmbiguity(null);
            setError(null);
            setOpen(false);
            reset();
            setAppliedUnreadable({ attempt, error: outcome.error });
            onReconcile();
            return true;
          }
          // A refused replay (for example, expired authentication) does not
          // prove that the original request failed to commit.
          if (unresolved) {
            setAmbiguity({
              attempt,
              error: outcome.error,
              replay: async () => {
                await send();
              },
            });
          } else {
            activeAttempt.current = null;
          }
          setError(outcome.error);
          return false;
        } finally {
          sending.current = false;
          setIsSubmitting(false);
        }
      };

      return send();
    },
    [
      allErrors,
      branchId,
      form,
      isSubmitting,
      onCreated,
      onReconcile,
      reset,
      revealAll,
      setForm,
      tagRecovery,
    ],
  );

  const retryTagAttachment = useCallback(async () => {
    if (!tagRecovery || sending.current) return;
    sending.current = true;
    setIsRetryingTags(true);
    const attempt = tagRecovery.status === "uncertain"
      ? tagRecovery.attempt
      : createWriteAttempt();
    try {
      const outcome = await runIdempotentWrite({
        attempt,
        method: "post",
        path: `${OPPORTUNITIES_PATH}/${encodeURIComponent(tagRecovery.opportunityId)}/tags`,
        body: { tagIds: tagRecovery.tagIds },
        parse: (payload) => payload,
      });
      if (outcome.kind === "success") {
        setTagRecovery(null);
        onReconcile();
      } else {
        setTagRecovery({
          ...tagRecovery,
          attempt,
          status: outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable"
            ? "uncertain"
            : "failed",
          error: outcome.error,
        });
        onReconcile();
      }
    } catch {
      setTagRecovery({ ...tagRecovery, attempt, status: "uncertain", error: { status: 0 } });
      onReconcile();
    } finally {
      sending.current = false;
      setIsRetryingTags(false);
    }
  }, [onReconcile, tagRecovery]);

  return {
    ...state,
    open,
    customerLabel,
    selectableStages,
    sectionErrorCount,
    isSubmitting,
    error,
    ambiguity,
    appliedUnreadable,
    tagRecovery,
    isRetryingTags,
    retryTagAttachment,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onReconcile,
    openModal,
    closeModal,
    selectPipeline,
    setCustomField,
    selectCustomer,
    toggleTag,
    submit,
  };
}

/** Active tenant currencies are advisory; omission leaves defaulting to CRM. */
export function useOpportunityCurrencyOptions(enabled: boolean) {
  const { user } = useTenantAuth();
  const canRead = user?.permissions.includes("currencies.currency.read") ?? false;
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || !canRead) return;
    const controller = new AbortController();
    void (async () => {
      const loaded: string[] = [];
      try {
        for (let page = 1; ; page += 1) {
          const payload = await readCoreData(
            `/api/tenant/core/v1/currencies?status=ACTIVE&limit=100&sortBy=code&sortDir=ASC&page=${page}`,
            { signal: controller.signal, maxResponseBytes: 200_000 },
          );
          const items: unknown = Array.isArray(payload)
            ? payload
            : payload && typeof payload === "object" && "items" in payload
              ? payload.items
              : null;
          if (!Array.isArray(items)) throw new Error("Invalid currency list");
          const entries: unknown[] = items;
          for (const item of entries) {
            if (
              !item || typeof item !== "object" || !("code" in item) ||
              typeof item.code !== "string" || !/^[A-Z]{3}$/.test(item.code)
            ) {
              throw new Error("Invalid currency code");
            }
            loaded.push(item.code);
          }
          if (controller.signal.aborted) return;
          if (items.length < 100) break;
        }
        setCodes([...new Set(loaded)]);
      } catch {
        // No fallback catalogue: free-text editors remain available, and new
        // opportunities can still inherit the workspace default without a read grant.
        if (!controller.signal.aborted) setCodes([]);
      }
    })();
    return () => controller.abort();
  }, [enabled, canRead]);

  return enabled && canRead ? codes : [];
}
