"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TradeInlineScopeProvider } from "./TradeInlineScope";
import { TradeScopeBar } from "./TradeScopeBar";
import { useTradeScope } from "./useTradeScope";
import { PriceBookScopeBar } from "./price-books/components/PriceBookScopeBar";

function isPricingOrDocumentWorkspacePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/trade/price-books" ||
    pathname.startsWith("/trade/price-books/") ||
    pathname.startsWith("/trade/price-book-versions/") ||
    pathname === "/trade/pricing" ||
    pathname.startsWith("/trade/pricing/") ||
    pathname === "/trade/quotations" ||
    pathname.startsWith("/trade/quotations/") ||
    pathname === "/trade/sales-orders" ||
    pathname.startsWith("/trade/sales-orders/") ||
    pathname === "/trade/purchase-orders" ||
    pathname.startsWith("/trade/purchase-orders/") ||
    pathname === "/trade/purchase-quotations" ||
    pathname.startsWith("/trade/purchase-quotations/") ||
    pathname === "/trade/invoices" ||
    pathname.startsWith("/trade/invoices/")
  );
}

export function TradeLayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPriceBookList = pathname === "/trade/price-books";
  const isPriceBookDetail = Boolean(pathname?.startsWith("/trade/price-books/") || pathname?.startsWith("/trade/price-book-versions/"));
  const isPricingWorkbench = pathname === "/trade/pricing";
  const isItemsWorkspace = pathname === "/trade/items" || Boolean(pathname?.startsWith("/trade/items/"));
  const { context, companyIds, branchIds, contextLocked, selectCompany, selectBranch } = useTradeScope();
  // A screen that mounts its own exact context (the pinned saved-quotation editor) claims it; until then the
  // band stays so direct entry, missing/forbidden documents and cross-company selection keep a company picker.
  const [inlineClaims, setInlineClaims] = useState(0);
  const adjustInlineClaims = useCallback((delta: 1 | -1) => setInlineClaims((current) => Math.max(0, current + delta)), []);
  const hasInlineScope = inlineClaims > 0 || pathname === "/trade/quotations/new" || isItemsWorkspace || ["/trade/channels", "/trade/uoms", "/trade/commercial-accounts"]
    .some((route) => pathname === route || Boolean(pathname?.startsWith(`${route}/`)));
  const isCompanyBoundRoute = isPricingOrDocumentWorkspacePath(pathname);

  // Price Books, Pricing, and Commercial Documents require a concrete company scope (never __tenant__ item master).
  // Auto-resolve when the user belongs to a single company/branch so switching from Items never leaves
  // an empty "Select a company" combobox or redundant single-option UUID bars.
  useEffect(() => {
    if (contextLocked || !isCompanyBoundRoute || isPriceBookList || isPriceBookDetail || isPricingWorkbench) return;
    if (!context.companyId && companyIds.length === 1) {
      queueMicrotask(() => selectCompany(companyIds[0]));
      return;
    }
    if (context.companyId && !context.branchId && branchIds.length === 1) {
      queueMicrotask(() => selectBranch(branchIds[0]));
    }
  }, [contextLocked, isCompanyBoundRoute, isPriceBookList, isPriceBookDetail, isPricingWorkbench, context.companyId, context.branchId, companyIds, branchIds, selectCompany, selectBranch]);

  return (
    <TradeInlineScopeProvider value={adjustInlineClaims}>
      <div className="flex h-full min-h-0 flex-col gap-2.5">
        {isPriceBookList ? <PriceBookScopeBar /> : isPriceBookDetail ? (
          companyIds.length > 1 || !context.companyId ? <PriceBookScopeBar companyOnly /> : null
        ) : !isPricingWorkbench && !hasInlineScope ? <TradeScopeBar hideWhenSingleScope={isCompanyBoundRoute} /> : null}
        {children}
      </div>
    </TradeInlineScopeProvider>
  );
}
