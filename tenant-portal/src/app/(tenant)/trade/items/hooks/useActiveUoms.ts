"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import {
  UOM_PAGE_SIZE,
  parseUomsResponse,
  uomsListPath,
  type Uom,
} from "../../uoms/uom-contract";

const PAGE_RESPONSE_LIMIT_BYTES = 400_000;
/** 20 pages of `UOM_PAGE_SIZE` — far above any tenant's unit master. */
const MAX_PAGES = 20;

/**
 * Every ACTIVE unit in the tenant's UOM master, for a new item's base-UOM
 * picker.
 *
 * Not `GET /catalog/uoms`: that projection lists only units already referenced
 * by an existing item's base or default UOM, so a tenant with no items got an
 * empty picker and could never create its first item. The master list
 * (`GET /uoms?status=ACTIVE`) is what item creation validates against.
 *
 * The master list caps a page at `UOM_PAGE_SIZE`, so this reads every page
 * (the starter catalogue alone is 119 units). Read under the same `BRANCH`
 * target as the UOM screen.
 */
export function useActiveUoms(isEnabled: boolean) {
  const { headers, gap } = useTradeScopeRequest("BRANCH");
  const [options, setOptions] = useState<Uom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [query, setQuery] = useState("");

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
      void (async () => {
        const units: Uom[] = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const result = await tradeGet(uomsListPath(page, "ACTIVE"), {
            signal: controller.signal,
            headers,
            maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
          });
          const parsed = parseUomsResponse(result.data);
          units.push(...parsed.items);
          if (parsed.items.length < UOM_PAGE_SIZE || units.length >= parsed.total) break;
        }
        return units;
      })()
        .then((units) => setOptions(units))
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
  }, [isEnabled, headers, gap]);

  // The whole master is already loaded, so the picker's search filters it here
  // across the code and every localized name instead of re-querying: the
  // server's `search` only matches a code prefix.
  const matching = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((uom) =>
      [uom.code, uom.displayName, ...Object.values(uom.localizedNames)].some((text) =>
        text.toLocaleLowerCase().includes(needle),
      ),
    );
  }, [options, query]);

  return {
    options: matching,
    all: options,
    search: setQuery,
    isLoading,
    isUnavailable: error !== null || gap !== null,
  };
}
