"use client";

import { useCallback, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useToast } from "@/design-system";
import { tradeGet } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  EMPTY_AVAILABILITY_FORM,
  INVENTORY_READ_PERMISSION,
  availabilityPath,
  buildAvailabilityRequest,
  parseInventoryAvailability,
  type AvailabilityFormValues,
  type InventoryAvailability,
} from "../inventory-contract";

const AVAILABILITY_RESPONSE_LIMIT_BYTES = 8_000;

/**
 * Availability is a **lookup**, not a list.
 *
 * `AvailabilityQueryDto` requires `nodeId` and `itemId`, so there is nothing to
 * load on mount: an unasked question is not an empty result. The screen starts
 * in its "nothing asked yet" state and only fetches on submit.
 */
export function useInventoryAvailability() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [values, setValues] = useState<AvailabilityFormValues>(EMPTY_AVAILABILITY_FORM);
  const [result, setResult] = useState<InventoryAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    INVENTORY_READ_PERMISSION,
  );

  const lookUp = useCallback(async (): Promise<void> => {
    if (isLoading) return;
    setFormError(null);
    let request: AvailabilityFormValues;
    try {
      request = buildAvailabilityRequest(values);
    } catch (error) {
      setFormError(availabilityFormMessage(error, t));
      return;
    }
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await tradeGet(availabilityPath(request), {
        headers: scope.headers,
        maxResponseBytes: AVAILABILITY_RESPONSE_LIMIT_BYTES,
      });
      setResult(parseInventoryAvailability(response.data));
    } catch (error) {
      const normalized = normalizeApiError(error);
      setResult(null);
      if (!toast.outcomeFromApi(normalized)) setQueryError(normalized);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, values, scope.headers, toast, t]);

  return {
    t,
    lang,
    canRead,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    values,
    result,
    isLoading,
    queryError,
    formError,
    setValue: (field: keyof AvailabilityFormValues, next: string) =>
      setValues((current) => ({ ...current, [field]: next })),
    reset: () => {
      setValues(EMPTY_AVAILABILITY_FORM);
      setResult(null);
      setQueryError(null);
      setFormError(null);
    },
    lookUp,
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function availabilityFormMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "INVENTORY_FORM_NODE") return t.tradeInventory.formNodeInvalid;
  if (reason === "INVENTORY_FORM_ITEM") return t.tradeInventory.formItemInvalid;
  if (reason === "INVENTORY_FORM_UOM") return t.tradeInventory.formUomInvalid;
  return t.tradeInventory.formTrackingInvalid;
}
