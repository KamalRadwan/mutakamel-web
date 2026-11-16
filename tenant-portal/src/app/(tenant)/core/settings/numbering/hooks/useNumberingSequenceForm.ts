"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { NumberingFormValues, NumberingSequence } from "../numbering-contract";
import {
  NUMBERING_FIELD_ORDER,
  hasNumberingFieldErrors,
  validateNumberingFormFields,
  type NumberingFieldErrors,
  type NumberingFieldKey,
} from "../numbering-form-validation";

export interface NumberingSummaryErrorItem {
  readonly key: NumberingFieldKey;
  readonly label: string;
  readonly anchorId: string;
}

export interface UseNumberingSequenceFormOptions {
  readonly mode: "create" | "edit";
  readonly isOpen: boolean;
  readonly initialValues: NumberingFormValues;
  readonly current?: NumberingSequence;
  readonly tenantWideAllowed: boolean;
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly serverFieldErrors?: NumberingFieldErrors;
  readonly onClearServerError?: (key?: NumberingFieldKey) => void;
  readonly counterLabel: string;
  readonly onSubmit: (values: NumberingFormValues) => Promise<boolean>;
  readonly onClose: () => void;
}

export function useNumberingSequenceForm({
  mode, isOpen, initialValues, current, tenantWideAllowed,
  isSubmitting, error, serverFieldErrors, onClearServerError, counterLabel, onSubmit, onClose,
}: UseNumberingSequenceFormOptions) {
  const { t } = useI18n();
  const formId = useId();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const setBody = useCallback((node: HTMLDivElement | null) => {
    bodyRef.current = node;
  }, []);
  const [values, setValues] = useState<NumberingFormValues>(initialValues);
  const [revealedFields, setRevealedFields] = useState<Partial<Record<NumberingFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const isBusy = isSubmitting || localSubmitting;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setValues(initialValues);
      setRevealedFields({});
      setSubmitAttempted(false);
      setConfirmingDiscard(false);
      setLocalSubmitting(false);
    }
  }

  const resolvedValues: NumberingFormValues = useMemo(() => {
    if (
      mode === "create" && !tenantWideAllowed &&
      values.companyId === null && initialValues.companyId !== null
    ) {
      return { ...values, companyId: initialValues.companyId };
    }
    return values;
  }, [mode, tenantWideAllowed, values, initialValues.companyId]);

  const isDirty = useMemo(() => {
    if (mode === "edit") {
      return (
        resolvedValues.prefix !== initialValues.prefix ||
        resolvedValues.padding !== initialValues.padding ||
        resolvedValues.startValue !== initialValues.startValue
      );
    }
    return (
      resolvedValues.code !== initialValues.code ||
      resolvedValues.companyId !== initialValues.companyId ||
      resolvedValues.prefix !== initialValues.prefix ||
      resolvedValues.padding !== initialValues.padding ||
      resolvedValues.startValue !== initialValues.startValue
    );
  }, [mode, resolvedValues, initialValues]);

  // Locked edit fields (`code`, `companyId`) are never eligible for field-level errors.
  const effectiveServerFieldErrors = useMemo<NumberingFieldErrors>(() => {
    if (!serverFieldErrors) return {};
    if (mode === "edit") {
      return {
        prefix: serverFieldErrors.prefix,
        padding: serverFieldErrors.padding,
        startValue: serverFieldErrors.startValue,
      };
    }
    return serverFieldErrors;
  }, [mode, serverFieldErrors]);

  const allFieldErrors = useMemo(
    () => validateNumberingFormFields(resolvedValues, t, { mode, current, tenantWideAllowed }),
    [resolvedValues, t, mode, current, tenantWideAllowed],
  );

  const fieldErrors: NumberingFieldErrors = useMemo(() => {
    const visible: NumberingFieldErrors = {};
    for (const key of NUMBERING_FIELD_ORDER) {
      const clientMessage = allFieldErrors[key];
      const serverMessage = effectiveServerFieldErrors[key];
      if (clientMessage && (submitAttempted || revealedFields[key])) {
        visible[key] = clientMessage;
      } else if (serverMessage) {
        visible[key] = serverMessage;
      }
    }
    return visible;
  }, [allFieldErrors, effectiveServerFieldErrors, submitAttempted, revealedFields]);

  const fieldAnchorIds = useMemo<Record<NumberingFieldKey, string>>(
    () => ({
      code: `${formId}-field-code`,
      companyId: `${formId}-field-companyId`,
      prefix: `${formId}-field-prefix`,
      padding: `${formId}-field-padding`,
      startValue: `${formId}-field-startValue`,
    }),
    [formId],
  );

  const summaryItems = useMemo<readonly NumberingSummaryErrorItem[]>(() => {
    if (!submitAttempted) return [];
    const labels: Record<NumberingFieldKey, string> = {
      code: t.coreSettings.numberingCode,
      companyId: t.coreIdentity.cascade.company,
      prefix: t.coreSettings.numberingPrefix,
      padding: t.coreSettings.numberingPadding,
      startValue: counterLabel,
    };
    const items: NumberingSummaryErrorItem[] = [];
    for (const key of NUMBERING_FIELD_ORDER) {
      if (allFieldErrors[key] || effectiveServerFieldErrors[key]) {
        items.push({ key, label: labels[key], anchorId: fieldAnchorIds[key] });
      }
    }
    return items;
  }, [submitAttempted, allFieldErrors, effectiveServerFieldErrors, fieldAnchorIds, t, counterLabel]);

  useEffect(() => {
    if (!submitAttempted || isBusy || focusTick === 0) return;
    const firstInvalid = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!firstInvalid) return;
    firstInvalid.focus({ preventScroll: true });
    firstInvalid.scrollIntoView?.({ block: "nearest" });
  }, [submitAttempted, isBusy, focusTick, error, effectiveServerFieldErrors]);

  const handleOpenAutoFocus = useCallback(
    (event: Event) => {
      const targetKey: NumberingFieldKey = mode === "edit" ? "prefix" : "code";
      const target = bodyRef.current?.querySelector<HTMLElement>(
        `[data-numbering-field="${targetKey}"]`,
      );
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
    [mode],
  );

  const updateValues = useCallback(
    (patch: Partial<NumberingFormValues>) => {
      if (mode === "edit") {
        const mutablePatch: Partial<NumberingFormValues> = {};
        if (patch.prefix !== undefined) {
          mutablePatch.prefix = patch.prefix;
          onClearServerError?.("prefix");
        }
        if (patch.padding !== undefined) {
          mutablePatch.padding = patch.padding;
          onClearServerError?.("padding");
        }
        if (patch.startValue !== undefined) {
          mutablePatch.startValue = patch.startValue;
          onClearServerError?.("startValue");
        }
        setValues((prev) => ({ ...prev, ...mutablePatch }));
        return;
      }
      if (patch.code !== undefined) onClearServerError?.("code");
      if (patch.companyId !== undefined) {
        onClearServerError?.("companyId");
        onClearServerError?.("code");
      }
      if (patch.prefix !== undefined) onClearServerError?.("prefix");
      if (patch.padding !== undefined) onClearServerError?.("padding");
      if (patch.startValue !== undefined) onClearServerError?.("startValue");
      setValues((prev) => ({ ...prev, ...patch }));
    },
    [mode, onClearServerError],
  );

  const onBlurField = useCallback((key: NumberingFieldKey) => {
    setRevealedFields((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const focusField = useCallback((key: NumberingFieldKey) => {
    const target = bodyRef.current?.querySelector<HTMLElement>(`[data-numbering-field="${key}"]`);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest" });
  }, []);

  const resetLocalState = useCallback(() => {
    setValues(initialValues);
    setRevealedFields({});
    setSubmitAttempted(false);
    setConfirmingDiscard(false);
  }, [initialValues]);

  const requestClose = useCallback(() => {
    if (isBusy || inFlightRef.current) return;
    if (isDirty) return setConfirmingDiscard(true);
    resetLocalState();
    onClose();
  }, [isBusy, isDirty, resetLocalState, onClose]);

  const confirmDiscard = useCallback(() => {
    if (isBusy || inFlightRef.current) return;
    resetLocalState();
    onClose();
  }, [isBusy, resetLocalState, onClose]);

  const setConfirmingDiscardSafe = useCallback(
    (next: boolean) => {
      if (isBusy || inFlightRef.current) return;
      setConfirmingDiscard(next);
    },
    [isBusy],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isBusy || inFlightRef.current || (mode === "edit" && !isDirty)) return;

      const currentErrors = validateNumberingFormFields(resolvedValues, t, {
        mode, current, tenantWideAllowed,
      });
      setSubmitAttempted(true);
      if (hasNumberingFieldErrors(currentErrors)) {
        setFocusTick((tick) => tick + 1);
        return;
      }

      inFlightRef.current = true;
      setLocalSubmitting(true);
      try {
        const succeeded = await onSubmit(resolvedValues);
        if (!mountedRef.current) return;
        if (succeeded && mode === "create") resetLocalState();
        else if (!succeeded) setFocusTick((tick) => tick + 1);
      } catch {
        if (mountedRef.current) setFocusTick((tick) => tick + 1);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setLocalSubmitting(false);
      }
    },
    [isBusy, mode, isDirty, resolvedValues, t, current, tenantWideAllowed, onSubmit, resetLocalState],
  );

  return {
    setBody, handleOpenAutoFocus, values: resolvedValues, isBusy, isDirty,
    fieldErrors, fieldAnchorIds, summaryItems, confirmingDiscard,
    setConfirmingDiscard: setConfirmingDiscardSafe, updateValues, onBlurField,
    focusField, requestClose, confirmDiscard, handleSubmit,
  };
}
