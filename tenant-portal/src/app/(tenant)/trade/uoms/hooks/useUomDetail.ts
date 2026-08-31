"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import { parseUomResponse, uomPath, UOM_INVALID_CODE, type Uom } from "../uom-contract";

const ROW_RESPONSE_LIMIT_BYTES = 40_000;

/**
 * `GET /uoms/:id`.
 *
 * Two things the route table does not say. It is Gateway `BRANCH_REQUIRED`
 * like the list, so it needs the company and branch headers even though the
 * controller target is only `OPERATING_CONTEXT`. And a UOM that does not exist
 * is **422 `TRADE.CATALOG.UOM_INVALID`**, not a 404: `CatalogUomService.get`
 * throws `missingUom()`, which is an `UnprocessableEntityException`. A screen
 * that branches on 404 alone renders a retry button for a record that is gone.
 */
export function useUomDetail(id: string) {
  const { t, lang } = useI18n();
  const { headers, gap } = useTradeScopeRequest("BRANCH");
  const [uom, setUom] = useState<Uom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const isMalformedId = !isUUIDv7(id);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isMalformedId || gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(uomPath(id), {
        signal: controller.signal,
        headers,
        maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (!controller.signal.aborted) setUom(parseUomResponse(result.data));
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setUom(null);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, headers, gap, isMalformedId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const isGone =
    isMalformedId ||
    error?.status === 404 ||
    (error?.status === 422 && error.code === UOM_INVALID_CODE);

  return { t, lang, uom, isLoading, error, isGone, scopeGap: gap, reload };
}
