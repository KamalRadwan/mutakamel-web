import { TradeScopeProvider } from "./useTradeScope";

// The operating context is mounted for the whole route group, not per screen:
// Trade resolves a route's scope target — and therefore which permission is
// checked at all — from headers that must be identical across every screen the
// user moves between. A per-screen selector would let two Trade screens
// disagree about the company they are reading.
export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return <TradeScopeProvider>{children}</TradeScopeProvider>;
}
