"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { readTradeData } from "@/lib/api/envelope";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  LEAD_RELATED_KINDS,
  LEAD_RELATED_PERMISSIONS,
  OPPORTUNITY_SEARCH_PATH,
  leadInvoicesCountPath,
  leadOpportunitySearch,
  leadQuotationsCountPath,
  leadSalesOrdersCountPath,
  parseRelatedTotal,
  type LeadRelatedKind,
} from "../lead-related-contract";

/** `null` = permitted but not answered yet, or answered with something unreadable. */
type LeadRelatedCounts = Record<LeadRelatedKind, number | null>;

export interface LeadRelatedCountsState {
  counts: LeadRelatedCounts;
  /** Which of the four this user may see at all. */
  permitted: Record<LeadRelatedKind, boolean>;
  isLoading: boolean;
}

const EMPTY_COUNTS: LeadRelatedCounts = {
  opportunities: null,
  quotations: null,
  salesOrders: null,
  invoices: null,
};

const RESPONSE_LIMIT_BYTES = 64 * 1024;

/**
 * Four counts for one lead: its opportunities, and its party's quotations,
 * sales orders and invoices.
 *
 * **Four independent reads, and one failing tells the others nothing.** They
 * are four services' worth of permissions — a CRM user with no Trade access is
 * the ordinary case, not an error — so each count settles on its own and a
 * rejected one stays `null`. `null` renders as a dash rather than a zero:
 * "no invoices" and "the count could not be read" are different sentences.
 *
 * Read-only, so no idempotency key travels with the opportunity search even
 * though it is a POST — `skipAutoIdempotency`, and `replayAfterRefresh`
 * because re-running it changes nothing. The same two flags the opportunities
 * screen sends on the same route.
 *
 * All three Trade counts require company + branch. QuotationsController.list
 * and SalesOrdersController.list declare TradeScopeTarget.BRANCH even though
 * their legacy Gateway rows omit organizationScopeMode. Omission leaves
 * validation to TradeScopeGuard; it is not the explicit NONE policy.
 */
export function useLeadRelatedCounts(
  leadId: string | null,
  partyId: string | null,
  branchId: string | null,
): LeadRelatedCountsState {
  const { user } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [counts, setCounts] = useState<LeadRelatedCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(false);

  const permissions = user?.permissions ?? [];
  const permitted = Object.fromEntries(
    LEAD_RELATED_KINDS.map((kind) => [kind, permissions.includes(LEAD_RELATED_PERMISSIONS[kind])]),
  ) as Record<LeadRelatedKind, boolean>;

  // The four flags as a string, so the effect re-runs when a permission
  // arrives with the profile rather than on every render of a fresh object.
  const permittedKey = LEAD_RELATED_KINDS.map((kind) => (permitted[kind] ? "1" : "0")).join("");
  const scopeHeaders = scope.headers;

  useEffect(() => {
    if (!isUUIDv7(leadId) || !isUUIDv7(partyId) || !isUUIDv7(branchId)) return;
    const controller = new AbortController();
    // Deferred past the effect body for the same reason every other loader in
    // this screen defers: a synchronous setState there cascades a render, which
    // is what `react-hooks/set-state-in-effect` rejects.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setCounts(EMPTY_COUNTS);
      setIsLoading(true);
      const config = {
        signal: controller.signal,
        cache: "no-store" as const,
        maxResponseBytes: RESPONSE_LIMIT_BYTES,
      };

      async function countOf(kind: LeadRelatedKind): Promise<number | null> {
        if (!permitted[kind]) return null;
        try {
          if (kind === "opportunities") {
            const response = await axiosClient.post<unknown>(
              OPPORTUNITY_SEARCH_PATH,
              leadOpportunitySearch(leadId as string, branchId as string),
              // A POST that READS: nothing to make idempotent, and safe to
              // replay after a token refresh for the same reason a GET is.
              { ...config, skipAutoIdempotency: true, replayAfterRefresh: true },
            );
            return parseRelatedTotal(response.data);
          }
          // Do not send a Trade read until the Lead branch has a verified
          // owning company. Bare reads fail TRADE.CONTEXT.MISSING_COMPANY.
          if (!scopeHeaders) return null;
          const path = kind === "quotations" ? leadQuotationsCountPath(partyId as string)
            : kind === "salesOrders" ? leadSalesOrdersCountPath(partyId as string)
              : leadInvoicesCountPath(partyId as string);
          return parseRelatedTotal(
            await readTradeData(path, {
              ...config,
              headers: scopeHeaders,
            }),
          );
        } catch {
          // Deliberately swallowed, per count. A 403 from Trade is the shape of
          // a CRM-only user's day, and a banner about it on a lead screen would
          // be noise about a capability they do not have.
          return null;
        }
      }

      void (async () => {
        const settled = await Promise.all(LEAD_RELATED_KINDS.map((kind) => countOf(kind)));
        if (controller.signal.aborted) return;
        setCounts(
          Object.fromEntries(
            LEAD_RELATED_KINDS.map((kind, index) => [kind, settled[index] ?? null]),
          ) as LeadRelatedCounts,
        );
        setIsLoading(false);
      })();
    });
    return () => controller.abort();
    // `permitted` is rebuilt every render; `permittedKey` is what actually
    // changes when a permission does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, partyId, branchId, permittedKey, scopeHeaders]);

  return { counts, permitted, isLoading };
}
