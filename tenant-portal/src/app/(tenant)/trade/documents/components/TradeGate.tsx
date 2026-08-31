"use client";

import { PermissionGate } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";

export interface TradeGateProps {
  require: string;
  children: React.ReactNode;
}

/**
 * Route admission for a Trade screen.
 *
 * **Standing requirement S6 cannot be satisfied here.** It says action
 * admission comes from a `capabilities` endpoint, because a permission string
 * does not account for branch and owner scope. CRM has three such endpoints;
 * **Trade has none** — sweeping `trade-app/src` for `capabilit` returns only
 * database provisioning probes and an unrelated `capabilitySet` field on an
 * item company profile (Q30). There is no per-record and no per-scope
 * capability route among the 231.
 *
 * That gap bites harder in Trade than in CRM, because `TradePermissionsGuard`
 * matches `scope_target` **exactly** — a TENANT grant does not satisfy a
 * BRANCH-target route, and every route behind this gate targets BRANCH — and
 * the only bypass is `tenant_users.is_tenant_owner`.
 *
 * So this gates on the permission string plus the owner flag, which is the
 * most the browser can know, and every screen behind it treats a 403 as an
 * authoritative refusal rather than a bug. Optimistic enabling, honest
 * failure.
 */
export function TradeGate({ require, children }: TradeGateProps) {
  const { user } = useTenantAuth();

  // `is_tenant_owner` short-circuits TradePermissionsGuard entirely, so an
  // owner with no Trade grants is still admitted by the server. Refusing them
  // here would be the client contradicting the authority.
  if (user?.isTenantOwner) return <>{children}</>;

  return <PermissionGate require={require}>{children}</PermissionGate>;
}
