"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import { resolveTradeScope } from "../../trade-scope";
import { isUuidV7 } from "../../trade-validation";
import { useTradeScope } from "../../useTradeScope";
import {
  UOM_PAGE_SIZE,
  catalogUomsPath,
  parseCatalogUomsResponse,
  parseUomResponse,
  parseUomsResponse,
  uomPath,
  uomsListPath,
  type Uom,
} from "../../uoms/uom-contract";

const PAGE_RESPONSE_LIMIT_BYTES = 400_000;
/** 20 pages of `UOM_PAGE_SIZE` — far above any tenant's unit master. */
const MAX_PAGES = 20;

function mapCatalogOptionsToUoms(
  options: ReturnType<typeof parseCatalogUomsResponse>,
): Uom[] {
  return options.map((option) => ({
    id: option.id,
    code: option.code,
    displayName: option.displayName,
    localizedNames: option.localizedNames ?? { en: option.displayName },
    status: "ACTIVE",
    version: option.version ?? 1,
    updatedAt: "1970-01-01T00:00:00.000Z",
  }));
}

/**
 * Every ACTIVE unit in the tenant's UOM master, for a new item's base-UOM
 * picker and item detail/edit UOM name resolution.
 *
 * The master list (`GET /uoms?status=ACTIVE`) requires a `BRANCH` header pair
 * on the Gateway even though UOMs are tenant-wide. When the current operating
 * context is in Item Master (`companyId: null`) or company-only (`branchId: null`)
 * mode, this falls back to the first accessible company and paired branch so
 * item screens can always resolve UOM names instead of showing raw UUIDs.
 */
export function useActiveUoms(isEnabled: boolean, includeUomId?: string) {
  const { user } = useTenantAuth();
  const { context, companyIds, branchIds } = useTradeScope();

  const { branchHeaders, companyHeaders, gap } = useMemo(() => {
    const effectiveCompanyId = context.companyId ?? companyIds[0] ?? null;
    const pairedBranchIds = effectiveCompanyId
      ? (user?.teamMemberships ?? [])
          .filter(
            (membership) =>
              membership.companyId === effectiveCompanyId && membership.branchId !== null,
          )
          .map((membership) => membership.branchId as string)
          .filter((id) => branchIds.includes(id))
      : [];
    const effectiveBranchId =
      (context.companyId === effectiveCompanyId && context.branchId ? context.branchId : null) ??
      pairedBranchIds[0] ??
      branchIds[0] ??
      null;

    const branchResolution = resolveTradeScope("BRANCH", {
      companyId: effectiveCompanyId,
      branchId: effectiveBranchId,
      channelId: null,
    });

    if (branchResolution.ok) {
      return {
        branchHeaders: branchResolution.headers,
        companyHeaders: effectiveCompanyId
          ? { [COMPANY_SCOPE_HEADER]: effectiveCompanyId }
          : null,
        gap: null,
      };
    }

    if (effectiveCompanyId) {
      return {
        branchHeaders: null,
        companyHeaders: { [COMPANY_SCOPE_HEADER]: effectiveCompanyId },
        gap: null,
      };
    }

    return {
      branchHeaders: null,
      companyHeaders: null,
      gap: branchResolution.gap,
    };
  }, [context.companyId, context.branchId, companyIds, branchIds, user?.teamMemberships]);

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
        if (branchHeaders) {
          try {
            const units: Uom[] = [];
            for (let page = 1; page <= MAX_PAGES; page += 1) {
              const result = await tradeGet(uomsListPath(page, "ACTIVE"), {
                signal: controller.signal,
                headers: branchHeaders,
                maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
              });
              const parsed = parseUomsResponse(result.data);
              units.push(...parsed.items);
              if (parsed.items.length < UOM_PAGE_SIZE || units.length >= parsed.total) break;
            }
            if (
              includeUomId &&
              isUuidV7(includeUomId) &&
              !units.some((uom) => uom.id === includeUomId)
            ) {
              try {
                const singleResult = await tradeGet(uomPath(includeUomId), {
                  signal: controller.signal,
                  headers: branchHeaders,
                  maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
                });
                units.push(parseUomResponse(singleResult.data));
              } catch {
                // Keep the loaded ACTIVE units if the single UOM lookup fails.
              }
            }
            return units;
          } catch (branchError) {
            if (!companyHeaders || controller.signal.aborted) {
              throw branchError;
            }
          }
        }
        if (companyHeaders) {
          const fallbackResult = await tradeGet(catalogUomsPath("ANY"), {
            signal: controller.signal,
            headers: companyHeaders,
            maxResponseBytes: PAGE_RESPONSE_LIMIT_BYTES,
          });
          return mapCatalogOptionsToUoms(parseCatalogUomsResponse(fallbackResult.data));
        }
        return [];
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
  }, [isEnabled, branchHeaders, companyHeaders, gap, includeUomId]);

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
