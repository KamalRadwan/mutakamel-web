"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import type { NormalizedApiError } from "@/lib/api/errors";
import { parsePipelinesResponse } from "../../../opportunities/hooks/usePipelineWorkspace";
import type { OpportunityPipeline } from "../../../opportunities/hooks/pipeline-types";
import {
  createCrmWriteAttempt,
  runCrmWrite,
  type CrmWriteAttempt,
} from "../../../shared/crm-write";
import { leadConvertPath, type LeadDetail } from "../../lead-contract";
import {
  buildConvertLeadRequest,
  isValidConversionAmount,
  parseLeadConversionResponse,
  type LeadConversionForm,
  type LeadConversionResult,
} from "../../lead-write-contract";

export const CONVERSION_STEPS = ["profile", "contact", "opportunity", "review"] as const;
export type ConversionStep = (typeof CONVERSION_STEPS)[number];

/**
 * Stage flags that cannot receive a converted lead.
 *
 * `LeadsService.convert` answers `422
 * LEAD_CONVERSION_OPPORTUNITY_STAGE_TERMINAL` for a stage flagged `WON` or
 * `LOST`, so they are filtered out of the selector rather than offered and then
 * rejected. `ON_HOLD` is **not** terminal and stays selectable.
 */
const TERMINAL_STAGE_FLAGS = ["WON", "LOST"];

function emptyForm(lead: LeadDetail): LeadConversionForm {
  return {
    // Prefilled and changeable: a lead captured as an individual often
    // converts as a company (docs/design/detail-screens.md, step 1).
    profileType: lead.leadProfileType,
    displayName: lead.displayName,
    companyName: lead.companyName ?? "",
    contactFullName: lead.displayName,
    contactJobTitle: "",
    contactEmail: lead.email ?? "",
    contactMethods: buildPrefilledContactMethods(lead),
    createOpportunity: true,
    pipelineId: "",
    stageId: "",
    title: lead.displayName,
    amount: "",
    currencyCode: "",
    expectedCloseDate: "",
  };
}

function buildPrefilledContactMethods(lead: LeadDetail) {
  const methods: LeadConversionForm["contactMethods"] = [];
  if (lead.primaryMobile) {
    methods.push({ methodType: "MOBILE", value: lead.primaryMobile });
  }
  if (lead.email) {
    methods.push({ methodType: "EMAIL", value: lead.email });
  }
  return methods;
}

/**
 * The three-step conversion flow — MASTER-PLAN 8.2.
 *
 * **One idempotency key per attempt.** It is minted when the drawer opens and
 * reused by every retry, including the ambiguous-outcome replay. A fresh key on
 * retry converts the lead twice, creating a duplicate customer, its contacts
 * and an opportunity that a person then has to merge by hand — the single
 * highest-consequence failure in this module.
 */
export function useLeadConvert(lead: LeadDetail | null, onConverted: () => void) {
  const [form, setForm] = useState<LeadConversionForm | null>(null);
  const [step, setStep] = useState<ConversionStep>("profile");
  const [attempt, setAttempt] = useState<CrmWriteAttempt | null>(null);
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [pipelinesFailed, setPipelinesFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [ambiguous, setAmbiguous] = useState<NormalizedApiError | null>(null);
  // D2: the conversion applied and its receipt could not be read.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<NormalizedApiError | null>(null);
  const [result, setResult] = useState<LeadConversionResult | null>(null);

  const open = form !== null;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await axiosClient.get<unknown>(
          "/api/tenant/crm/v1/pipelines",
          {
            signal: controller.signal,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          },
        );
        setPipelines(parsePipelinesResponse(response.data));
        setPipelinesFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setPipelines([]);
        setPipelinesFailed(true);
      }
    })();
    return () => controller.abort();
  }, [open]);

  const selectedPipeline = useMemo(
    () => pipelines.find(({ id }) => id === form?.pipelineId) ?? null,
    [form?.pipelineId, pipelines],
  );

  const selectableStages = useMemo(
    () =>
      (selectedPipeline?.stages ?? []).filter(
        (stage) => !TERMINAL_STAGE_FLAGS.includes(stage.flag),
      ),
    [selectedPipeline],
  );

  const openDrawer = useCallback(() => {
    if (!lead) return;
    setForm(emptyForm(lead));
    setStep("profile");
    setAttempt(createCrmWriteAttempt());
    setError(null);
    setAmbiguous(null);
    setResult(null);
  }, [lead]);

  const closeDrawer = useCallback(() => {
    setForm(null);
    setAttempt(null);
    setError(null);
    setAmbiguous(null);
  }, []);

  const setField = useCallback(
    <K extends keyof LeadConversionForm>(key: K, value: LeadConversionForm[K]) => {
      setForm((current) => (current ? { ...current, [key]: value } : current));
    },
    [],
  );

  const stepValidity = useMemo(() => validateSteps(form), [form]);

  const submit = useCallback(async () => {
    // `appliedUnreadable` blocks the submit outright — D2. Once a conversion is
    // known to have applied, there is no second intent this drawer may send.
    if (!lead || !form || !attempt || isSubmitting || appliedUnreadable) return;
    let body;
    try {
      // Built before the request rather than inside its argument list: the
      // amount guard throws, and the block below has a `finally` but no
      // `catch`, so the rejection escaped `submit` and reached nobody.
      body = buildConvertLeadRequest(form);
    } catch (caught) {
      setError({
        status: 422,
        code: caught instanceof Error ? caught.message : undefined,
      });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const outcome = await runCrmWrite({
        attempt,
        method: "post",
        path: leadConvertPath(lead.id),
        body,
        parse: parseLeadConversionResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });
      if (outcome.kind === "success") {
        setAmbiguous(null);
        setResult(outcome.value);
        onConverted();
        return;
      }
      if (outcome.kind === "ambiguous") {
        setAmbiguous(outcome.error);
        return;
      }
      if (outcome.kind === "applied_unreadable") {
        // D2, and this is the write it matters most on: one conversion creates
        // a customer, its contacts and an opportunity. Reported as a plain
        // failure it invited a second conversion — three duplicate records a
        // person then merges by hand. The drawer stops accepting a submit and
        // the lead is refetched instead.
        setAmbiguous(null);
        setError(null);
        setAppliedUnreadable(outcome.error);
        onConverted();
        return;
      }
      setAmbiguous(null);
      setError(outcome.error);
      // A 409 means the lead changed underneath — most often it was already
      // converted — so the record on screen is refetched rather than left
      // showing a state the server has moved past.
      if (outcome.error.status === 409) onConverted();
    } finally {
      setIsSubmitting(false);
    }
  }, [appliedUnreadable, attempt, form, isSubmitting, lead, onConverted]);

  return {
    open,
    form,
    step,
    setStep,
    attempt,
    pipelines,
    pipelinesFailed,
    selectableStages,
    stepValidity,
    isSubmitting,
    error,
    ambiguous,
    dismissAmbiguous: () => setAmbiguous(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    reconcile: onConverted,
    result,
    openDrawer,
    closeDrawer,
    setField,
    submit,
  };
}

/**
 * Per-step validity, `review` included.
 *
 * Review carries no inputs of its own, so it is always valid — keeping it in
 * the record lets the drawer index by the current step instead of running a
 * ternary chain over four cases.
 */
export type ConversionStepValidity = Record<ConversionStep, boolean>;

function validateSteps(form: LeadConversionForm | null): ConversionStepValidity {
  if (!form) {
    return { profile: false, contact: false, opportunity: false, review: true };
  }
  // `LeadsService.convert` requires a company name for a CORPORATE conversion
  // (`LEAD_COMPANY_NAME_REQUIRED`) and a display name otherwise; a contact
  // without a full name is `LEAD_CONTACT_NAME_REQUIRED`.
  const profile =
    form.profileType === "CORPORATE"
      ? form.companyName.trim().length > 0
      : form.displayName.trim().length > 0;
  const contact = form.contactFullName.trim().length > 0;
  const opportunity =
    !form.createOpportunity ||
    (form.pipelineId.length > 0 &&
      form.stageId.length > 0 &&
      form.title.trim().length > 0 &&
      isValidConversionAmount(form.amount) &&
      (form.currencyCode.trim().length === 0 ||
        form.currencyCode.trim().length === 3));
  return { profile, contact, opportunity, review: true };
}
