"use client";

import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { invoicesApi } from "../api/invoices-api";
import { classifyInvoiceMutationError } from "../model/invoice-errors";
import {
  createInvoiceIntentStore,
  shouldRetainInvoiceIntent,
  stableInvoiceFingerprint,
} from "../model/invoice-intents";
import { readInvoicePermissions } from "../model/invoice-permissions";
import {
  buildGenerateInvoiceDto,
  validateGenerateInvoice,
} from "../model/invoice-validation";
import type {
  CoreSnapshot,
  GenerateInvoiceDraft,
  Invoice,
  InvoiceMutationState,
  InvoiceValidationErrors,
} from "../types/invoices";

const EMPTY_MUTATION: InvoiceMutationState = {
  name: null,
  phase: "IDLE",
  error: null,
  correlationId: null,
};

const DEFAULT_DRAFT: GenerateInvoiceDraft = {
  tenantId: "",
  periodStart: "",
  periodEnd: "",
  purpose: "MANUAL",
};

export function useGenerateInvoice() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readInvoicePermissions(user), [user]);
  const [draft, setDraft] = useState<GenerateInvoiceDraft>({ ...DEFAULT_DRAFT });
  const [validationErrors, setValidationErrors] =
    useState<InvoiceValidationErrors>({});
  const [mutation, setMutation] = useState<InvoiceMutationState>(EMPTY_MUTATION);
  const [created, setCreated] = useState<CoreSnapshot<Invoice> | null>(null);
  const intents = useRef(createInvoiceIntentStore());

  const updateDraft = useCallback(
    <K extends keyof GenerateInvoiceDraft>(
      field: K,
      value: GenerateInvoiceDraft[K],
    ) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors((current) => {
        const next = { ...current };
        delete next[field];
        if (field === "periodStart" || field === "periodEnd") {
          delete next.periodRange;
        }
        return next;
      });
      if (mutation.phase !== "PENDING") setMutation(EMPTY_MUTATION);
    },
    [mutation.phase],
  );

  const submit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!permissions.canCreate || mutation.phase === "PENDING") return null;
      const errors = validateGenerateInvoice(draft);
      setValidationErrors(errors);
      if (Object.keys(errors).length) return null;
      const dto = buildGenerateInvoiceDto(draft);
      const scope = "invoice:generate";
      const fingerprint = stableInvoiceFingerprint(dto);
      const key = intents.current.get(scope, fingerprint);
      setMutation({ name: "GENERATE", phase: "PENDING", error: null, correlationId: null });
      try {
        const result = await invoicesApi.generate(dto, key);
        intents.current.clear(scope);
        setCreated(result);
        setMutation({
          name: "GENERATE",
          phase: "SUCCEEDED",
          error: null,
          correlationId: result.correlationId,
        });
        return result;
      } catch (caught) {
        const error = normalizeApiError(caught);
        if (!shouldRetainInvoiceIntent(error)) intents.current.clear(scope);
        setMutation({
          name: "GENERATE",
          phase: classifyInvoiceMutationError(caught, error),
          error,
          correlationId: error.correlationId ?? null,
        });
        return null;
      }
    },
    [draft, mutation.phase, permissions.canCreate],
  );

  const startAnother = useCallback(() => {
    intents.current.clearAll();
    setDraft({ ...DEFAULT_DRAFT });
    setValidationErrors({});
    setCreated(null);
    setMutation(EMPTY_MUTATION);
  }, []);

  return {
    permissions,
    isAuthLoading,
    draft,
    validationErrors,
    mutation,
    created,
    updateDraft,
    submit,
    startAnother,
  };
}
