"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  CRM_CUSTOM_FIELDS_PATH,
  CRM_FIELD_REQUIREMENT_OPERATIONS,
  type CrmFieldRequirementOperation,
  type CustomFieldItem,
} from "../custom-field-contract";

const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 100_000,
  nonReplayable: true,
} as const;

export type RequirementFlags = Record<CrmFieldRequirementOperation, boolean>;

export interface RequirementsWriteResult {
  ok: boolean;
  error: NormalizedApiError | null;
}

/**
 * Reads the per-operation requirement flags off a definition and writes them
 * back through `POST /custom-fields/:id/requirements`.
 *
 * **One operation per request.** `SetFieldRequirementDto` is
 * `{ operation, entityScope?, isRequired }` — a single flag, not a set —
 * so three changed operations are three POSTs. docs/api/crm-catalogues.md
 * describes this route as setting all three "as one call", which the DTO does
 * not support; the DTO is the contract.
 *
 * `entityScope` is left off. The service keys each requirement on
 * `entityScope ?? null`, so omitting it addresses the definition's whole
 * scope, which is what a definition-level control means. A narrower per-scope
 * requirement is reachable from the API but has no screen asking for it.
 */
export function useCustomFieldRequirements() {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const readFlags = (field: CustomFieldItem): RequirementFlags => ({
    CREATE: isRequiredFor(field, "CREATE"),
    UPDATE: isRequiredFor(field, "UPDATE"),
    CONVERT: isRequiredFor(field, "CONVERT"),
  });

  const save = async (
    field: CustomFieldItem,
    next: RequirementFlags,
  ): Promise<RequirementsWriteResult> => {
    const current = readFlags(field);
    const changed = CRM_FIELD_REQUIREMENT_OPERATIONS.filter(
      (operation) => current[operation] !== next[operation],
    );
    if (changed.length === 0) return { ok: true, error: null };
    setIsSubmitting(true);
    try {
      // Sequential, not Promise.all: each POST takes an advisory lock keyed on
      // the definition, and firing three at once serialises on the database
      // anyway while making a partial failure harder to attribute.
      for (const operation of changed) {
        await axiosClient.post<unknown>(
          `${CRM_CUSTOM_FIELDS_PATH}/${encodeURIComponent(field.id)}/requirements`,
          { operation, isRequired: next[operation] },
          WRITE_CONFIG,
        );
      }
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { t, isSubmitting, readFlags, save };
}

function isRequiredFor(
  field: CustomFieldItem,
  operation: CrmFieldRequirementOperation,
): boolean {
  return field.requirements.some(
    (requirement) =>
      requirement.operation === operation &&
      requirement.entityScope === null &&
      requirement.isRequired,
  );
}
