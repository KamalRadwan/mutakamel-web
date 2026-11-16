import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import { isUuidV7 } from "../../core-validation";
import {
  counterWriteOrNull,
  isHigherOrEqualCounter,
  isValidNumberingCode,
  normalizeNumberingPrefix,
  paddingOrNull,
  type NumberingFormValues,
  type NumberingSequence,
} from "./numbering-contract";

export type NumberingFieldKey = "code" | "companyId" | "prefix" | "padding" | "startValue";
export type NumberingFieldErrors = Partial<Record<NumberingFieldKey, string>>;

export const NUMBERING_FIELD_ORDER: readonly NumberingFieldKey[] = [
  "code",
  "companyId",
  "prefix",
  "padding",
  "startValue",
];

export interface ValidateNumberingFormOptions {
  readonly mode: "create" | "edit";
  readonly current?: NumberingSequence;
  readonly tenantWideAllowed?: boolean;
}

export function validateNumberingFormFields(
  values: NumberingFormValues,
  t: Dictionary,
  options: ValidateNumberingFormOptions,
): NumberingFieldErrors {
  const errors: NumberingFieldErrors = {};

  if (options.mode === "create") {
    if (!isValidNumberingCode(values.code)) {
      errors.code = t.coreSettings.numberingFormCode;
    }
    if (values.companyId === null) {
      if (options.tenantWideAllowed === false) {
        errors.companyId = t.coreSettings.numberingFormCompany;
      }
    } else if (!isUuidV7(values.companyId)) {
      errors.companyId = t.coreSettings.numberingFormCompany;
    }
  }

  if (normalizeNumberingPrefix(values.prefix) === null) {
    errors.prefix = t.coreSettings.numberingFormPrefix;
  }

  if (paddingOrNull(values.padding) === null) {
    errors.padding = t.coreSettings.numberingFormPadding;
  }

  const trimmedCounter = values.startValue.trim();
  if (options.mode === "create") {
    if (counterWriteOrNull(trimmedCounter) === null) {
      errors.startValue = t.coreSettings.numberingFormValue;
    }
  } else if (!options.current || trimmedCounter !== options.current.nextValue) {
    if (!/^\d+$/u.test(trimmedCounter)) {
      errors.startValue = t.coreSettings.numberingFormValue;
    } else if (options.current && !isHigherOrEqualCounter(trimmedCounter, options.current.nextValue)) {
      errors.startValue = formatTemplate(t.coreSettings.numberingValueBackward, {
        current: options.current.nextValue,
      });
    } else if (counterWriteOrNull(trimmedCounter) === null) {
      errors.startValue = t.coreSettings.numberingFormValue;
    }
  }

  return errors;
}

export function hasNumberingFieldErrors(errors: NumberingFieldErrors): boolean {
  return NUMBERING_FIELD_ORDER.some((key) => Boolean(errors[key]));
}

export function numberingFormMessage(
  error: unknown,
  t: Dictionary,
  current?: NumberingSequence,
): string | null {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "NUMBERING_FORM_CODE") return t.coreSettings.numberingFormCode;
  if (reason === "NUMBERING_FORM_PREFIX") return t.coreSettings.numberingFormPrefix;
  if (reason === "NUMBERING_FORM_PADDING") return t.coreSettings.numberingFormPadding;
  if (reason === "NUMBERING_FORM_VALUE") return t.coreSettings.numberingFormValue;
  if (reason === "NUMBERING_FORM_COMPANY") return t.coreSettings.numberingFormCompany;
  if (reason === "NUMBERING_FORM_BACKWARD") {
    return formatTemplate(t.coreSettings.numberingValueBackward, {
      current: current?.nextValue ?? "",
    });
  }
  return null;
}
