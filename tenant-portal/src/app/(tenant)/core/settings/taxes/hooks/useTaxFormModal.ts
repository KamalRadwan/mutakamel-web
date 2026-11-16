"use client";

import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { CompanyOption } from "../../company-options";
import type { TaxFormValues } from "../tax-contract";
import {
  buildTaxErrorSummaryItems,
  resolveServerTaxFieldError,
  taxFieldAnchorId,
  validateTaxForm,
  type TaxErrorSummaryItem,
  type TaxFormFieldErrors,
  type TaxFormFieldKey,
  type TaxFormMode,
} from "../tax-validation";

export interface UseTaxFormModalOptions {
  mode: TaxFormMode;
  open: boolean;
  initialValues: TaxFormValues;
  companies: readonly CompanyOption[];
  tenantWideAllowed: boolean;
  isSubmitting: boolean;
  error: string | null;
  t: Dictionary;
  onClose: () => void;
  onSubmit: (values: TaxFormValues) => Promise<boolean>;
}

export interface TaxFormModalState {
  idPrefix: string;
  values: TaxFormValues;
  isBusy: boolean;
  modalIsDirty: boolean;
  fieldErrors: TaxFormFieldErrors;
  summaryItems: TaxErrorSummaryItem[];
  unmappedError: string | undefined;
  handleChange: (patch: Partial<TaxFormValues>) => void;
  handleBlur: (field: TaxFormFieldKey) => void;
  handleOpenChange: (nextOpen: boolean) => void;
  handleSubmit: () => void;
  handleSummaryNavigate: (
    event: React.MouseEvent<HTMLAnchorElement>,
    anchorId: string,
  ) => void;
}

const ORDERED_FIELDS: readonly TaxFormFieldKey[] = [
  "companyId",
  "code",
  "name",
  "rate",
  "status",
];

function areTaxFormValuesEqual(a: TaxFormValues, b: TaxFormValues): boolean {
  return (
    a.code === b.code &&
    a.name === b.name &&
    a.rate === b.rate &&
    a.isInclusive === b.isInclusive &&
    a.companyId === b.companyId &&
    (a.status ?? "ACTIVE") === (b.status ?? "ACTIVE")
  );
}

function focusFieldContainer(anchorId: string): void {
  const container = document.getElementById(anchorId);
  if (!container) return;
  const focusTarget = container.querySelector<HTMLElement>(
    'input, button, [role="combobox"], [tabindex]:not([tabindex="-1"])',
  );
  focusTarget?.focus({ preventScroll: true });
  (focusTarget ?? container).scrollIntoView?.({ block: "nearest" });
}

export function useTaxFormModal({
  mode,
  open,
  initialValues,
  companies,
  tenantWideAllowed,
  isSubmitting,
  error,
  t,
  onClose,
  onSubmit,
}: UseTaxFormModalOptions): TaxFormModalState {
  const idPrefix = mode === "create" ? "tax-create" : "tax-edit";
  const inFlightRef = useRef(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [localSubmitError, setLocalSubmitError] = useState<string | null>(null);
  const [values, setValues] = useState<TaxFormValues>(initialValues);
  const [baseline, setBaseline] = useState<TaxFormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<TaxFormFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const [trackedError, setTrackedError] = useState<string | null>(error);
  const [errorSnapshot, setErrorSnapshot] = useState<TaxFormValues | null>(
    error ? initialValues : null,
  );

  if (wasOpen !== open) {
    setWasOpen(open);
    setLocalSubmitting(false);
    setLocalSubmitError(null);
    setValues(initialValues);
    setBaseline(initialValues);
    setTouched({});
    setSubmitAttempted(false);
    setTrackedError(error);
    setErrorSnapshot(error ? initialValues : null);
  }

  const fallbackCompanyId = !tenantWideAllowed ? (companies[0]?.id ?? null) : null;
  if (
    mode === "create" &&
    !tenantWideAllowed &&
    baseline.companyId === null &&
    values.companyId === null &&
    fallbackCompanyId !== null
  ) {
    setValues({ ...values, companyId: fallbackCompanyId });
    setBaseline({ ...baseline, companyId: fallbackCompanyId });
  }

  if (trackedError !== error) {
    setTrackedError(error);
    if (error) setLocalSubmitError(null);
    setErrorSnapshot(error ? values : null);
  }

  const clientErrors = validateTaxForm(values, {
    mode,
    companies,
    tenantWideAllowed,
    t,
  });

  const effectiveError = error ?? localSubmitError;
  const serverResolution = resolveServerTaxFieldError(effectiveError, mode, t);
  const serverField = serverResolution.field;
  const isServerFieldErrorStale =
    Boolean(serverField && errorSnapshot) &&
    (values[serverField!] !== errorSnapshot![serverField!] ||
      (serverField === "code" && values.companyId !== errorSnapshot!.companyId));

  const activeServerField = !isServerFieldErrorStale ? serverField : undefined;
  const activeServerMessage = !isServerFieldErrorStale ? serverResolution.message : undefined;

  const fieldErrors: TaxFormFieldErrors = {};
  const summaryErrors: TaxFormFieldErrors = {};

  for (const field of ORDERED_FIELDS) {
    const clientMessage = clientErrors[field];
    if (clientMessage && (submitAttempted || touched[field])) {
      fieldErrors[field] = clientMessage;
    } else if (activeServerField === field && activeServerMessage) {
      fieldErrors[field] = activeServerMessage;
    }

    if (submitAttempted && clientMessage) {
      summaryErrors[field] = clientMessage;
    } else if (activeServerField === field && activeServerMessage) {
      summaryErrors[field] = activeServerMessage;
    }
  }

  const summaryItems = buildTaxErrorSummaryItems(summaryErrors, idPrefix, t);
  const isBusy = isSubmitting || localSubmitting;
  const isDirty = !areTaxFormValuesEqual(values, baseline);
  // Suppress the destructive discard prompt while a write is in flight so
  // Escape/backdrop/close neither drops the request nor wipes the draft.
  const modalIsDirty = !isBusy && isDirty;

  const resetToBaseline = (nextBaseline: TaxFormValues) => {
    setValues(nextBaseline);
    setTouched({});
    setSubmitAttempted(false);
    setLocalSubmitError(null);
    setErrorSnapshot(null);
  };

  const handleChange = (patch: Partial<TaxFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const handleBlur = (field: TaxFormFieldKey) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isBusy || inFlightRef.current) return;
    resetToBaseline(baseline);
    onClose();
  };

  const handleSubmit = () => {
    if (isBusy || inFlightRef.current) return;
    setSubmitAttempted(true);
    setLocalSubmitError(null);
    const firstInvalidField = ORDERED_FIELDS.find((field) => Boolean(clientErrors[field]));
    if (firstInvalidField) {
      queueMicrotask(() => {
        focusFieldContainer(taxFieldAnchorId(idPrefix, firstInvalidField));
      });
      return;
    }

    inFlightRef.current = true;
    setLocalSubmitting(true);
    setErrorSnapshot(values);
    void (async () => {
      try {
        const saved = await onSubmit(values);
        if (saved) {
          resetToBaseline(baseline);
        }
      } catch {
        setLocalSubmitError(
          mode === "create"
            ? t.coreSettings.taxCreateFailed
            : t.coreSettings.taxUpdateFailed,
        );
      } finally {
        inFlightRef.current = false;
        setLocalSubmitting(false);
      }
    })();
  };

  const handleSummaryNavigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    anchorId: string,
  ) => {
    event.preventDefault();
    focusFieldContainer(anchorId);
  };

  return {
    idPrefix,
    values,
    isBusy,
    modalIsDirty,
    fieldErrors,
    summaryItems,
    unmappedError: serverResolution.unmappedError,
    handleChange,
    handleBlur,
    handleOpenChange,
    handleSubmit,
    handleSummaryNavigate,
  };
}
