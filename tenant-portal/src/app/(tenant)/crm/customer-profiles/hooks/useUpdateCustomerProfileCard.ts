"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/design-system";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useI18n } from "@/i18n/I18nContext";
import { isAmbiguousWriteFailure } from "@/lib/api/idempotent-write";
import {
  buildCustomerProfileCardPatchBody,
  parseCustomerProfileCardPatchResponse,
  type CustomerProfileCardPatch,
} from "../customer-profile-card-contract";
import type { CustomerProfileItem } from "./useCustomerProfiles";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";

export type CustomerCardUpdateResult =
  | { ok: true; patch: CustomerProfileCardPatch }
  | { ok: false; error?: NormalizedApiError };

export function useUpdateCustomerProfileCard({
  branchId,
  canUpdate,
  applyCardFields,
  reconcile,
}: {
  branchId: string | null;
  canUpdate: (item: CustomerProfileItem) => boolean;
  applyCardFields: (
    profileId: string,
    patch: CustomerProfileCardPatch,
  ) => void;
  reconcile: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useCrmErrorText();
  const pendingIds = useRef(new Set<string>());

  const updateCard = useCallback(
    async (item: CustomerProfileItem, patch: CustomerProfileCardPatch): Promise<CustomerCardUpdateResult> => {
      if (!branchId || pendingIds.current.has(item.id)) return { ok: false };
      if (!canUpdate(item)) {
        toast.errorFromApi(t.crmCustomerProfiles.cardNotPermitted, {
          status: 403,
        });
        return { ok: false, error: { status: 403 } };
      }

      const previous: CustomerProfileCardPatch = {
        ...(patch.rating !== undefined ? { rating: item.rating } : {}),
        ...(patch.cardColor !== undefined
          ? { cardColor: item.cardColor }
          : {}),
      };
      pendingIds.current.add(item.id);
      applyCardFields(item.id, patch);

      try {
        let response: AxiosResponse<unknown>;
        try {
          response = await axiosClient.patch<unknown>(
            `/api/tenant/crm/v1/customer-profiles/${encodeURIComponent(item.id)}`,
            buildCustomerProfileCardPatchBody(patch),
            {
              nonReplayable: true,
              skipAutoIdempotency: true,
              cache: "no-store",
              maxResponseBytes: 256 * 1024,
            },
          );
        } catch (caught) {
          const error = { ...normalizeApiError(caught), message: undefined };
          applyCardFields(item.id, previous);
          if (isAmbiguousWriteFailure(caught)) {
            reconcile();
            toast.errorFromApi(
              t.crmCustomerProfiles.cardUpdateAmbiguous,
              error,
            );
          } else {
            toast.errorFromApi(
              errorText(error) ?? t.crmCustomerProfiles.cardUpdateFailed,
              error,
            );
          }
          return { ok: false, error };
        }

        try {
          const confirmed = parseCustomerProfileCardPatchResponse(
            response.data,
            item.id,
            branchId,
          );
          const confirmedPatch: CustomerProfileCardPatch = {
            ...(patch.rating !== undefined
              ? { rating: confirmed.rating }
              : {}),
            ...(patch.cardColor !== undefined
              ? { cardColor: confirmed.cardColor }
              : {}),
          };
          applyCardFields(item.id, confirmedPatch);
          reconcile();
          return { ok: true, patch: confirmedPatch };
        } catch (caught) {
          const error = { ...normalizeApiError(caught), message: undefined };
          applyCardFields(item.id, previous);
          reconcile();
          toast.errorFromApi(
            t.crmCustomerProfiles.cardUpdateAmbiguous,
            error,
          );
          return { ok: false, error };
        }
      } finally {
        pendingIds.current.delete(item.id);
      }
    },
    [
      applyCardFields,
      branchId,
      canUpdate,
      errorText,
      reconcile,
      t.crmCustomerProfiles.cardNotPermitted,
      t.crmCustomerProfiles.cardUpdateAmbiguous,
      t.crmCustomerProfiles.cardUpdateFailed,
      toast,
    ],
  );

  return { updateCard };
}
