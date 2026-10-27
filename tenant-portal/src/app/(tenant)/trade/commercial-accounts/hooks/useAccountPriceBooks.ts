"use client";

import { useEffect, useState } from "react";
import { tradeGet } from "../../trade-api";
import { useTradeScopeRequest } from "../../useTradeScope";
import { parsePriceBooksResponse, priceBooksListPath, type PriceBook } from "../../price-books/pricing-contract";
import type { AccountRole } from "../commercial-account-contract";

/** Supplemental suggestions; typed IDs remain subject to server validation. */
export function useAccountPriceBooks(role: AccountRole) {
  const { headers, gap } = useTradeScopeRequest("COMPANY");
  const purpose = role === "SUPPLIER" ? "PURCHASE" : "SALES";
  const [result, setResult] = useState<{
    headers: typeof headers;
    purpose: typeof purpose;
    books: PriceBook[];
    unavailable: boolean;
  } | null>(null);

  useEffect(() => {
    if (gap) return;
    const controller = new AbortController();
    // PriceBookListQueryDto supports purpose/status and caps each page at 100.
    void tradeGet(priceBooksListPath(1, purpose, "ACTIVE"), {
      headers,
      signal: controller.signal,
      maxResponseBytes: 400_000,
    }).then((response) => {
      if (controller.signal.aborted) return;
      const page = parsePriceBooksResponse(response.data);
      setResult({
        headers,
        purpose,
        books: page.items.filter((book) => book.purpose === purpose && book.status === "ACTIVE"),
        unavailable: false,
      });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ headers, purpose, books: [], unavailable: true });
    });
    return () => controller.abort();
  }, [headers, gap, purpose]);

  const current = !gap && result?.headers === headers && result.purpose === purpose ? result : null;
  return {
    books: current?.books ?? [],
    unavailable: Boolean(gap) || (current?.unavailable ?? false),
  };
}
