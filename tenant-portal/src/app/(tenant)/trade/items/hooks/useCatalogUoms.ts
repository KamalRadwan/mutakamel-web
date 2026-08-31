"use client";

import { useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import {
  catalogUomsPath,
  parseCatalogUomsResponse,
  type CatalogUomOption,
  type CatalogUomPurpose,
} from "../../uoms/uom-contract";

const RESPONSE_LIMIT_BYTES = 200_000;

/**
 * The UOMs authorised for the current operating context, for the company
 * profile's two default-UOM pickers.
 *
 * The path, the option shape and the parser come from the `uoms` screen, which
 * owns this backend resource — a shared vocabulary, not a shared hook
 * (`docs/architecture/file-architecture.md`, dependency direction).
 *
 * Failure is not fatal here: a 403 is the ordinary answer when no company is
 * selected, and the caller falls back to accepting a typed id rather than
 * blocking the form.
 */
export function useCatalogUoms(purpose: CatalogUomPurpose, isEnabled: boolean) {
  const { headers, gap } = useTradeScopeRequest("COMPANY_OR_BRANCH");
  const [options, setOptions] = useState<CatalogUomOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isEnabled || gap) {
        setOptions([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(catalogUomsPath(purpose), {
        signal: controller.signal,
        headers,
        maxResponseBytes: RESPONSE_LIMIT_BYTES,
      })
        .then((result) => setOptions(parseCatalogUomsResponse(result.data)))
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [purpose, isEnabled, headers, gap]);

  return { options, isLoading, isUnavailable: error !== null || gap !== null };
}
