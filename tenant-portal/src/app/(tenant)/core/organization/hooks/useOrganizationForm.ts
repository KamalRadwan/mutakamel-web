"use client";

import { useCallback, useMemo, useState } from "react";
import { useBlurValidation, type BlurValidation } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { isUUIDv7 } from "@/lib/uuid";
import {
  ORG_ADDRESS_MAX_LENGTH,
  ORG_CODE_MAX_LENGTH,
  ORG_CURRENCY_CODE_LENGTH,
  ORG_LEGAL_NAME_MAX_LENGTH,
  ORG_NAME_MAX_LENGTH,
  ORG_PHONE_MAX_LENGTH,
  ORG_TAX_NUMBER_MAX_LENGTH,
  type OrgLevel,
  type OrgNodeOf,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG } from "../level-config";
import {
  EMPTY_ORG_NODE_FORM,
  hasSavedCompanyCurrency,
  nodeToFormValues,
  ORG_CODE_PATTERN,
  ORG_CURRENCY_PATTERN,
  resolveDirectParentId,
  type OrgNodeFormValues,
} from "../organization-payloads";

export interface OrgFormValidations {
  parent: BlurValidation;
  code: BlurValidation;
  name: BlurValidation;
  legalName: BlurValidation;
  taxNumber: BlurValidation;
  currencyCode: BlurValidation;
  address: BlurValidation;
  phone: BlurValidation;
  leadUser: BlurValidation;
}

export function useOrganizationForm<L extends OrgLevel>(level: L, mode: "create" | "edit") {
  const { t } = useI18n();
  const config = ORG_LEVEL_CONFIG[level];
  const [form, setForm] = useState<OrgNodeFormValues>(EMPTY_ORG_NODE_FORM);
  const [baseline, setBaseline] = useState<OrgNodeFormValues>(EMPTY_ORG_NODE_FORM);

  const patch = useCallback(
    (next: Partial<OrgNodeFormValues>) => {
      setForm((current) => {
        const merged = { ...current, ...next };
        if ("companyId" in next && level === "branches") merged.parentId = merged.companyId;
        if ("branchId" in next && level === "departments") merged.parentId = merged.branchId;
        if ("departmentId" in next && level === "teams") merged.parentId = merged.departmentId;
        if ("parentId" in next) {
          if (level === "branches" && !("companyId" in next)) merged.companyId = merged.parentId;
          if (level === "departments" && !("branchId" in next)) merged.branchId = merged.parentId;
          if (level === "teams" && !("departmentId" in next)) {
            merged.departmentId = merged.parentId;
          }
        }
        return merged;
      });
    },
    [level],
  );

  const directParentId = resolveDirectParentId(level, form);
  const hasSavedCurrency =
    mode === "edit" && hasSavedCompanyCurrency(baseline.currencyCode);

  const parent = useBlurValidation(directParentId, (val) => {
    if (mode !== "create" || !config.parent) return undefined;
    if (!val || !isUUIDv7(val)) return t.crmShared.fieldRequired;
    return undefined;
  });

  const code = useBlurValidation(form.code, (val) => {
    if (mode !== "create") return undefined;
    const trimmed = val.trim().toUpperCase();
    if (!trimmed) return t.crmShared.fieldRequired;
    if (trimmed.length > ORG_CODE_MAX_LENGTH) {
      return formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_CODE_MAX_LENGTH) });
    }
    if (!ORG_CODE_PATTERN.test(trimmed)) return t.coreIdentity.fields.codeHint;
    return undefined;
  });

  const name = useBlurValidation(form.name, (val) => {
    const trimmed = val.trim();
    if (!trimmed) return t.crmShared.fieldRequired;
    if (trimmed.length > ORG_NAME_MAX_LENGTH) {
      return formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_NAME_MAX_LENGTH) });
    }
    return undefined;
  });

  const legalName = useBlurValidation(form.legalName, (val) =>
    config.fields.includes("legalName") && val.trim().length > ORG_LEGAL_NAME_MAX_LENGTH
      ? formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_LEGAL_NAME_MAX_LENGTH) })
      : undefined,
  );

  const taxNumber = useBlurValidation(form.taxNumber, (val) =>
    config.fields.includes("taxNumber") && val.trim().length > ORG_TAX_NUMBER_MAX_LENGTH
      ? formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_TAX_NUMBER_MAX_LENGTH) })
      : undefined,
  );

  const currencyCode = useBlurValidation(form.currencyCode, (val) => {
    if (!config.fields.includes("currencyCode")) return undefined;
    const trimmed = val.trim().toUpperCase();
    if (hasSavedCurrency) {
      if (trimmed.length !== ORG_CURRENCY_CODE_LENGTH || !ORG_CURRENCY_PATTERN.test(trimmed)) {
        return t.coreIdentity.fields.currencyCodeRequiredHint;
      }
      return undefined;
    }
    if (!trimmed) return undefined;
    if (trimmed.length !== ORG_CURRENCY_CODE_LENGTH || !ORG_CURRENCY_PATTERN.test(trimmed)) {
      return t.coreIdentity.fields.currencyCodeHint;
    }
    return undefined;
  });

  const address = useBlurValidation(form.address, (val) =>
    config.fields.includes("address") && val.trim().length > ORG_ADDRESS_MAX_LENGTH
      ? formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_ADDRESS_MAX_LENGTH) })
      : undefined,
  );

  const phone = useBlurValidation(form.phone, (val) =>
    config.fields.includes("phone") && val.trim().length > ORG_PHONE_MAX_LENGTH
      ? formatTemplate(t.crmShared.fieldMaxLength, { max: String(ORG_PHONE_MAX_LENGTH) })
      : undefined,
  );

  const leadUser = useBlurValidation(form.leadUserId, (val) => {
    if (!config.fields.includes("leadUserId")) return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    return isUUIDv7(trimmed) ? undefined : t.coreIdentity.errors.ORG_LEAD_USER_NOT_FOUND;
  });

  const validations: OrgFormValidations = useMemo(
    () => ({ parent, code, name, legalName, taxNumber, currencyCode, address, phone, leadUser }),
    [address, code, currencyCode, leadUser, legalName, name, parent, phone, taxNumber],
  );

  const resetValidations = useCallback(() => {
    Object.values(validations).forEach((item) => item.reset());
  }, [validations]);

  const loadCreateDefaults = useCallback(() => {
    setForm(EMPTY_ORG_NODE_FORM);
    setBaseline(EMPTY_ORG_NODE_FORM);
    resetValidations();
  }, [resetValidations]);

  const loadEditRecord = useCallback(
    (node: OrgNodeOf<L>) => {
      const next = nodeToFormValues(node);
      setForm(next);
      setBaseline(next);
      resetValidations();
    },
    [resetValidations],
  );

  const validateForSubmit = useCallback((): boolean => {
    const all = Object.values(validations);
    all.forEach((item) => item.reveal());
    return all.every((item) => item.isValid);
  }, [validations]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [baseline, form],
  );

  return {
    form,
    patch,
    isDirty,
    hasSavedCurrency,
    validations,
    loadCreateDefaults,
    loadEditRecord,
    validateForSubmit,
  };
}
