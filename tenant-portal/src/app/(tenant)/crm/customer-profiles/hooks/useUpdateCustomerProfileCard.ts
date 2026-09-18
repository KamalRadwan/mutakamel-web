"use client";

import { useCallback, useRef } from "react";
import { useToast } from "@/design-system";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { useI18n } from "@/i18n/I18nContext";
import { isAmbiguousWriteFailure } from "../../shared/crm-write";
import {
  buildCustomerProfileCardPatchBody,
  parseCustomerProfileCardPatchResponse,
  type CustomerProfileCardPatch,
} from "../customer-profile-card-contract";
import type { CustomerProfileItem } from "./useCustomerProfiles";

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
  const pendingIds = useRef(new Set<string>());

  const updateCard = useCallback(
    async (item: CustomerProfileItem, patch: CustomerProfileCardPatch) => {
      if (!branchId || pendingIds.current.has(item.id)) return;
      if (!canUpdate(item)) {
        toast.errorFromApi(t.crmCustomerProfiles.cardNotPermitted, {
          status: 403,
        });
        return;
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
          applyCardFields(item.id, previous);
          if (isAmbiguousWriteFailure(caught)) {
            reconcile();
            toast.errorFromApi(
              t.crmCustomerProfiles.cardUpdateAmbiguous,
              normalizeApiError(caught),
            );
          } else {
            toast.errorFromApi(
              t.crmCustomerProfiles.cardUpdateFailed,
              normalizeApiError(caught),
            );
          }
          return;
        }

        try {
          const confirmed = parseCustomerProfileCardPatchResponse(
            response.data,
            item.id,
            branchId,
          );
          applyCardFields(item.id, {
            ...(patch.rating !== undefined
              ? { rating: confirmed.rating }
              : {}),
            ...(patch.cardColor !== undefined
              ? { cardColor: confirmed.cardColor }
              : {}),
          });
          reconcile();
        } catch (caught) {
          reconcile();
          toast.errorFromApi(
            t.crmCustomerProfiles.cardUpdateAmbiguous,
            normalizeApiError(caught),
          );
        }
      } finally {
        pendingIds.current.delete(item.id);
      }
    },
    [
      applyCardFields,
      branchId,
      canUpdate,
      reconcile,
      t.crmCustomerProfiles.cardNotPermitted,
      t.crmCustomerProfiles.cardUpdateAmbiguous,
      t.crmCustomerProfiles.cardUpdateFailed,
      toast,
    ],
  );

  return { updateCard };
}
