"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import { record } from "../../trade-validation";
import { ITEM_NOT_FOUND_CODE, itemPath, parseItemResponse, type Item } from "../item-contract";
import {
  parseBranchProfileResponse,
  parseCompanyProfileResponse,
  type ItemBranchProfile,
  type ItemCompanyProfile,
} from "../item-profile-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 200_000;

export interface ItemDetail {
  item: Item;
  companyProfile: ItemCompanyProfile | null;
  branchProfile: ItemBranchProfile | null;
}

/**
 * `GET /items/:id`, target `OPERATING_CONTEXT`.
 *
 * `CatalogService.get` returns the item spread with `companyProfile` and
 * `branchProfile` alongside, both `null` when the context does not reach them.
 * It throws `TRADE.CATALOG.ITEM_NOT_FOUND` at **404** for a missing item and at
 * **404 again** when a company header is sent and the item has no profile in
 * that company — so "not found" here can mean "not in this company", which is
 * why the empty state names the operating context.
 */
export function useItemDetail(id: string) {
  const { t, lang } = useI18n();
  const { headers } = useTradeScopeRequest("OPERATING_CONTEXT");
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isMalformedId = !isUUIDv7(id);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isMalformedId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(itemPath(id), {
        signal: controller.signal,
        headers,
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const payload = record(result.data);
          setDetail({
            item: parseItemResponse(result.data),
            companyProfile: payload?.companyProfile
              ? parseCompanyProfileResponse(payload.companyProfile)
              : null,
            branchProfile: payload?.branchProfile
              ? parseBranchProfileResponse(payload.branchProfile)
              : null,
          });
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setDetail(null);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, headers, isMalformedId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const isGone =
    isMalformedId ||
    error?.status === 404 ||
    (error?.status === 422 && error.code === ITEM_NOT_FOUND_CODE);

  return { t, lang, detail, isLoading, error, isGone, reload };
}
