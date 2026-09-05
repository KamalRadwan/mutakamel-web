"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { invoicesApi } from "../api/invoices-api";
import {
  classifyInvoiceMutationError,
  classifyInvoiceReadError,
} from "../model/invoice-errors";
import {
  createInvoiceIntentStore,
  shouldRetainInvoiceIntent,
  stableInvoiceFingerprint,
} from "../model/invoice-intents";
import { readInvoicePermissions } from "../model/invoice-permissions";
import {
  buildIssueInvoiceDto,
  buildUpdateInvoiceDto,
  isoToLocalDateTime,
  validateCriticalInvoiceDraft,
  validateInvoiceEdit,
} from "../model/invoice-validation";
import type {
  CoreSnapshot,
  CriticalInvoiceDraft,
  Invoice,
  InvoiceEditDraft,
  InvoiceLineDraft,
  InvoiceMutationName,
  InvoiceMutationState,
  InvoiceResourceState,
  InvoiceValidationErrors,
} from "../types/invoices";

export type InvoiceDetailDialog = "EDIT" | "ISSUE" | "VOID" | null;

const EMPTY_MUTATION: InvoiceMutationState = {
  name: null,
  phase: "IDLE",
  error: null,
  correlationId: null,
};

const EMPTY_CRITICAL: CriticalInvoiceDraft = {
  dueAt: "",
  reason: "",
  confirmed: false,
};

export function useInvoiceDetail(invoiceId: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readInvoicePermissions(user), [user]);
  const [state, setState] = useState<InvoiceResourceState>("LOADING");
  const [snapshot, setSnapshot] = useState<CoreSnapshot<Invoice> | null>(null);
  const [error, setError] = useState<ReturnType<typeof normalizeApiError> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialogState] = useState<InvoiceDetailDialog>(null);
  const dialogRef = useRef<InvoiceDetailDialog>(null);
  const [editDraft, setEditDraft] = useState<InvoiceEditDraft>({ lines: [], dueAt: "" });
  const [issueDraft, setIssueDraft] = useState<CriticalInvoiceDraft>({ ...EMPTY_CRITICAL });
  const [voidDraft, setVoidDraft] = useState<CriticalInvoiceDraft>({ ...EMPTY_CRITICAL });
  const [validationErrors, setValidationErrors] = useState<InvoiceValidationErrors>({});
  const [mutation, setMutation] = useState<InvoiceMutationState>(EMPTY_MUTATION);
  const requestGeneration = useRef(0);
  const hasSnapshot = useRef(false);
  const intents = useRef(createInvoiceIntentStore());

  const setDialog = useCallback((next: InvoiceDetailDialog) => {
    dialogRef.current = next;
    setDialogState(next);
  }, []);

  const applySnapshot = useCallback((next: CoreSnapshot<Invoice>) => {
    hasSnapshot.current = true;
    setSnapshot(next);
    setState("READY");
    setEditDraft(invoiceToEditDraft(next.data));
    // FE-B01. Whoever delivers authoritative data owns the refresh flag.
    //
    // Only the generation-guarded `finally` in the read effect used to clear
    // it, and a successful command bumps that generation on purpose - so a GET
    // already in flight when the command landed failed the guard, skipped the
    // clear, and left the refresh button disabled for the rest of the page's
    // life. The command had just supplied a newer snapshot than the GET would
    // have, so there is nothing left to wait for.
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      intents.current.clearAll();
      hasSnapshot.current = false;
      setSnapshot(null);
      setError(null);
      setMutation(EMPTY_MUTATION);
      setValidationErrors({});
      setDialog(null);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, setDialog]);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++requestGeneration.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== requestGeneration.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });

    void invoicesApi
      .get(invoiceId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted || current !== requestGeneration.current) return;
        hasSnapshot.current = true;
        setSnapshot(next);
        setState("READY");
        const activeDialog = dialogRef.current;
        const dialogIsStillEligible =
          activeDialog === null ||
          (activeDialog === "EDIT" &&
            next.data.status === "DRAFT" &&
            next.data.purpose === "MANUAL") ||
          (activeDialog === "ISSUE" && next.data.status === "DRAFT") ||
          (activeDialog === "VOID" &&
            ["DRAFT", "ISSUED", "OVERDUE"].includes(next.data.status) &&
            isZeroDecimal(next.data.amountPaidUsd));
        if (!dialogIsStillEligible) setDialog(null);
        if (activeDialog === null) setEditDraft(invoiceToEditDraft(next.data));
      })
      .catch((caught) => {
        if (controller.signal.aborted || current !== requestGeneration.current || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setSnapshot(null);
        setError(normalized);
        setState(classifyInvoiceReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === requestGeneration.current) {
          setIsRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [invoiceId, isAuthLoading, permissions.canRead, revision, setDialog]);

  const invoice = snapshot?.data ?? null;
  const canEdit = Boolean(
    permissions.canUpdate &&
      invoice?.status === "DRAFT" &&
      invoice.purpose === "MANUAL",
  );
  const canIssue = Boolean(permissions.canIssue && invoice?.status === "DRAFT");
  const canVoid = Boolean(
    permissions.canVoid &&
      invoice &&
      ["DRAFT", "ISSUED", "OVERDUE"].includes(invoice.status) &&
      isZeroDecimal(invoice.amountPaidUsd),
  );
  const canRecordOfflinePayment = Boolean(
    permissions.canRecordOfflinePayment &&
      invoice &&
      ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status),
  );

  const openEdit = useCallback(() => {
    if (!canEdit || !invoice) return;
    setEditDraft(invoiceToEditDraft(invoice));
    setValidationErrors({});
    setMutation(EMPTY_MUTATION);
    setDialog("EDIT");
  }, [canEdit, invoice, setDialog]);

  const openIssue = useCallback(() => {
    if (!canIssue || !invoice) return;
    setIssueDraft({
      dueAt: isoToLocalDateTime(invoice.dueAt),
      reason: "",
      confirmed: false,
    });
    setValidationErrors({});
    setMutation(EMPTY_MUTATION);
    setDialog("ISSUE");
  }, [canIssue, invoice, setDialog]);

  const openVoid = useCallback(() => {
    if (!canVoid) return;
    setVoidDraft({ ...EMPTY_CRITICAL });
    setValidationErrors({});
    setMutation(EMPTY_MUTATION);
    setDialog("VOID");
  }, [canVoid, setDialog]);

  const closeDialog = useCallback(() => {
    if (mutation.phase === "PENDING") return;
    setValidationErrors({});
    setDialog(null);
  }, [mutation.phase, setDialog]);

  const updateEditLine = useCallback(
    (clientId: string, field: "description" | "quantity" | "unitPrice", value: string) => {
      setEditDraft((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.clientId === clientId ? { ...line, [field]: value } : line,
        ),
      }));
      setValidationErrors({});
    },
    [],
  );

  const addEditLine = useCallback(() => {
    setEditDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { clientId: generateUUIDv7(), description: "", quantity: "1.00", unitPrice: "0.0000" },
      ],
    }));
    setValidationErrors({});
  }, []);

  const removeEditLine = useCallback((clientId: string) => {
    setEditDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.clientId !== clientId),
    }));
    setValidationErrors({});
  }, []);

  const updateEditDueAt = useCallback((value: string) => {
    setEditDraft((current) => ({ ...current, dueAt: value }));
    setValidationErrors((current) => withoutKeys(current, ["dueAt"]));
  }, []);

  const updateIssueDraft = useCallback(
    <K extends keyof CriticalInvoiceDraft>(field: K, value: CriticalInvoiceDraft[K]) => {
      setIssueDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors((current) => withoutKeys(current, [field]));
    },
    [],
  );

  const updateVoidDraft = useCallback(
    <K extends keyof CriticalInvoiceDraft>(field: K, value: CriticalInvoiceDraft[K]) => {
      setVoidDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors((current) => withoutKeys(current, [field]));
    },
    [],
  );

  const runMutation = useCallback(
    async (
      name: InvoiceMutationName,
      scope: string,
      fingerprintValue: unknown,
      command: (key: string) => Promise<CoreSnapshot<Invoice>>,
    ) => {
      if (mutation.phase === "PENDING") return null;
      const key = intents.current.get(scope, stableInvoiceFingerprint(fingerprintValue));
      setMutation({ name, phase: "PENDING", error: null, correlationId: null });
      try {
        const result = await command(key);
        intents.current.clear(scope);
        // A GET started before this command must never overwrite the newer
        // authoritative command response when it eventually settles.
        requestGeneration.current += 1;
        applySnapshot(result);
        setDialog(null);
        setValidationErrors({});
        setMutation({
          name,
          phase: "SUCCEEDED",
          error: null,
          correlationId: result.correlationId,
        });
        return result;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (!shouldRetainInvoiceIntent(normalized)) intents.current.clear(scope);
        const phase = classifyInvoiceMutationError(caught, normalized);
        setMutation({
          name,
          phase,
          error: normalized,
          correlationId: normalized.correlationId ?? null,
        });
        if (phase === "CONFLICT" || phase === "IN_FLIGHT" || phase === "UNAVAILABLE") {
          setRevision((current) => current + 1);
        }
        return null;
      }
    },
    [applySnapshot, mutation.phase, setDialog],
  );

  const saveEdit = useCallback(async () => {
    if (!canEdit || !invoice) return null;
    const errors = validateInvoiceEdit(editDraft, invoice.dueAt !== null);
    setValidationErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildUpdateInvoiceDto(editDraft);
    return runMutation(
      "UPDATE",
      `invoice:update:${invoice.id}`,
      { invoiceId: invoice.id, dto },
      (key) => invoicesApi.update(invoice.id, dto, key),
    );
  }, [canEdit, editDraft, invoice, runMutation]);

  const issueInvoice = useCallback(async () => {
    if (!canIssue || !invoice) return null;
    const errors = validateCriticalInvoiceDraft(issueDraft, true);
    setValidationErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildIssueInvoiceDto(issueDraft);
    return runMutation(
      "ISSUE",
      `invoice:issue:${invoice.id}`,
      { invoiceId: invoice.id, dto, operatorReason: issueDraft.reason.trim() },
      (key) => invoicesApi.issue(invoice.id, dto, key),
    );
  }, [canIssue, invoice, issueDraft, runMutation]);

  const voidInvoice = useCallback(async () => {
    if (!canVoid || !invoice) return null;
    const errors = validateCriticalInvoiceDraft(voidDraft, false);
    setValidationErrors(errors);
    if (Object.keys(errors).length) return null;
    return runMutation(
      "VOID",
      `invoice:void:${invoice.id}`,
      { invoiceId: invoice.id, operatorReason: voidDraft.reason.trim() },
      (key) => invoicesApi.void(invoice.id, key),
    );
  }, [canVoid, invoice, runMutation, voidDraft]);

  const visibleState: InvoiceResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;

  return {
    permissions,
    state: visibleState,
    snapshot: visibleState === "READY" ? snapshot : null,
    error,
    isRefreshing,
    dialog,
    editDraft,
    issueDraft,
    voidDraft,
    validationErrors,
    mutation,
    canEdit,
    canIssue,
    canVoid,
    canRecordOfflinePayment,
    openEdit,
    openIssue,
    openVoid,
    closeDialog,
    updateEditLine,
    addEditLine,
    removeEditLine,
    updateEditDueAt,
    updateIssueDraft,
    updateVoidDraft,
    saveEdit,
    issueInvoice,
    voidInvoice,
    refresh: () => setRevision((current) => current + 1),
  };
}

function invoiceToEditDraft(invoice: Invoice): InvoiceEditDraft {
  return {
    lines: (invoice.lines ?? []).map<InvoiceLineDraft>((line) => ({
      clientId: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    dueAt: isoToLocalDateTime(invoice.dueAt),
  };
}

function withoutKeys(
  current: InvoiceValidationErrors,
  keys: Array<string | number | symbol>,
): InvoiceValidationErrors {
  const next = { ...current };
  keys.forEach((key) => delete next[String(key)]);
  return next;
}

function isZeroDecimal(value: string): boolean {
  return /^0(?:\.0+)?$/.test(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "AbortError");
}
