"use client";

import { createContext, useContext, useEffect } from "react";

type InlineScopeAdjust = (delta: 1 | -1) => void;
const InlineScopeContext = createContext<InlineScopeAdjust | null>(null);

/** The Trade layout owns the claim count; `adjust` must be referentially stable. */
export const TradeInlineScopeProvider = InlineScopeContext.Provider;

/**
 * A mounted screen that already shows its own exact, resolved operating context (the pinned quotation
 * editor) claims it so the shared scope band is not repeated above it. Loading, missing, forbidden,
 * unresolved and read-only states never claim, so direct entry and cross-company selection stay possible.
 */
export function useTradeInlineScopeClaim(active: boolean) {
  const adjust = useContext(InlineScopeContext);
  useEffect(() => {
    if (!active || !adjust) return;
    adjust(1);
    return () => adjust(-1);
  }, [active, adjust]);
}
