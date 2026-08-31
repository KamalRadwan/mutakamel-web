import { isUUIDv7 } from "@/lib/uuid";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "./trade-api";

// Trade's operating context, and the one place a scope target becomes headers.
//
// This is NOT `lib/api/organization-scope.ts`. That module implements the
// GATEWAY's `organizationScopeMode` policy, which only 34 of the 231 Trade
// routes declare. What every Trade route has instead is a `@RequireTradeAccess`
// **scope target**, resolved inside trade-app by `TradeScopeGuard`
// (`trade-app/src/common/guards/trade-scope.guard.ts`), against a third header
// — `x-mutakamel-channel-id` — that Core and CRM do not have and the Gateway
// neither validates nor strips.
//
// The two policies are enforced by different components with different error
// shapes, and on `/uoms` they disagree: the Gateway declares `BRANCH_REQUIRED`
// on the two reads and `NONE` on the two writes, so read and write on the same
// resource take opposite headers. `TENANT` below therefore sends **nothing**,
// which satisfies both at once.

/**
 * The targets `@RequireTradeAccess` declares on the routes this route group
 * calls. `DASHBOARD_CONTEXT` behaves as `OPERATING_CONTEXT` and belongs to
 * Phase 12, so it is not modelled here.
 */
export type TradeScopeTarget =
  | "TENANT"
  | "COMPANY"
  | "BRANCH"
  | "COMPANY_OR_BRANCH"
  | "OPERATING_CONTEXT";

export interface TradeOperatingContext {
  companyId: string | null;
  branchId: string | null;
  channelId: string | null;
}

/** What the target needs that the current selection cannot supply. */
export type TradeScopeGap = "company-required" | "branch-required";

export type TradeScopeResolution =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; gap: TradeScopeGap };

function valid(value: string | null): value is string {
  return typeof value === "string" && isUUIDv7(value);
}

/**
 * Builds the scope headers a Trade route's target requires, or reports what is
 * missing so the screen can ask for it instead of firing a request the guard
 * will refuse.
 *
 * Three rules are load-bearing and each of them is a real 400 otherwise:
 *
 * 1. **`TENANT` sends nothing.** `validateShape` does not require a company
 *    there, and `POST`/`PATCH /uoms` are Gateway `NONE`, where sending one is
 *    itself the rejection.
 * 2. **A branch is never sent without a company.** `TradeScopeGuard` resolves
 *    a present branch header to target `BRANCH`, which then demands the
 *    company and answers `TRADE.CONTEXT.MISSING_COMPANY` without it.
 * 3. **A channel is never sent without a company**, for the same reason —
 *    it is an explicit third clause in `validateShape`.
 */
export function resolveTradeScope(
  target: TradeScopeTarget,
  context: TradeOperatingContext,
): TradeScopeResolution {
  const { companyId, branchId, channelId } = context;

  if (target === "TENANT") return { ok: true, headers: {} };

  if (!valid(companyId)) {
    // OPERATING_CONTEXT is the only target that admits a tenant-wide read, so
    // an unset company there is a narrower scope rather than a gap.
    if (target === "OPERATING_CONTEXT") return { ok: true, headers: {} };
    return { ok: false, gap: "company-required" };
  }

  if (target === "BRANCH" && !valid(branchId)) return { ok: false, gap: "branch-required" };

  const headers: Record<string, string> = { [COMPANY_SCOPE_HEADER]: companyId };
  if (valid(branchId) && target !== "COMPANY") headers[BRANCH_SCOPE_HEADER] = branchId;
  if (valid(channelId)) headers[CHANNEL_SCOPE_HEADER] = channelId;
  return { ok: true, headers };
}

export interface TradeActor {
  isTenantOwner: boolean;
  permissions: readonly string[];
}

/**
 * Advisory admission for one Trade action.
 *
 * **Trade exposes no capabilities endpoint** (Q30), so standing requirement S6
 * cannot be satisfied here and this is the substitute: the permission string
 * from `/auth/me`, plus the owner bypass `TradePermissionsGuard` implements as
 * its first branch.
 *
 * The owner clause is not redundant even though `/auth/me` already returns
 * every seeded key to an owner
 * (`core-app/src/tenant/tenant-auth/tenant-auth.service.ts`,
 * `fetchPermissionKeys`): that expansion depends on Trade's `trade.permissions`
 * seed pack having run for the tenant, and an owner is admitted by trade-app
 * either way.
 *
 * It stays advisory in a stronger sense than Core's: `TradePermissionsGuard`
 * matches `scope_target` **exactly**, so a grant held at `TENANT` does not
 * satisfy a `BRANCH`-target route and no permission string can predict that.
 * Enable optimistically, and render the 403 honestly when it comes.
 */
export function canPerformTradeAction(
  actor: TradeActor | null | undefined,
  permission: string,
): boolean {
  if (!actor) return false;
  return actor.isTenantOwner || actor.permissions.includes(permission);
}

export const TRADE_PERMISSIONS = {
  itemsRead: "trade.items.read",
  itemsManage: "trade.items.manage",
  catalogMasterManage: "trade.catalog_master.manage",
  commercialAccountsRead: "trade.commercial_accounts.read",
  commercialAccountsManage: "trade.commercial_accounts.manage",
  creditView: "trade.credit.view",
  configurationRead: "trade.configuration.read",
  configurationManage: "trade.configuration.manage",
  policyPublish: "trade.policy.publish",
} as const;

/**
 * The refusal `TradePermissionsGuard` raises. It carries no
 * `details.permissions` — unlike Core, the body never says which permission
 * was missing — so a screen has to name the route's own requirement.
 */
export const TRADE_TARGET_DENIED_CODE = "TRADE.AUTH.TARGET_DENIED";

/** `TradeScopeGuard` shape and binding failures, all reachable from a selector mistake. */
export const TRADE_CONTEXT_CODES = {
  missingCompany: "TRADE.CONTEXT.MISSING_COMPANY",
  missingBranch: "TRADE.CONTEXT.MISSING_BRANCH",
  invalidId: "TRADE.CONTEXT.INVALID_ID",
  branchCompanyMismatch: "TRADE.CONTEXT.BRANCH_COMPANY_MISMATCH",
  scopeInactive: "TRADE.CONTEXT.SCOPE_INACTIVE",
  executionTargetMismatch: "TRADE.CONTEXT.EXECUTION_TARGET_MISMATCH",
} as const;

/**
 * `TradeSubscriptionGuard` runs on all 231 routes, feature-gated or not. Both
 * of the first two are **string literals in the guard** and are absent from
 * `TRADE_ERROR_CODES`, so a code union built from that constant alone misses
 * the two most common Trade refusals a tenant will ever see.
 */
export const TRADE_ENTITLEMENT_CODES = {
  moduleDisabled: "TRADE.MODULE.DISABLED",
  featureRequired: "TRADE.ENTITLEMENT.FEATURE_REQUIRED",
  maintenanceActive: "TRADE.PROVISIONING.MAINTENANCE_ACTIVE",
  entitlementUnavailable: "TRADE.DEPENDENCY.ENTITLEMENT_UNAVAILABLE",
} as const;

/** True when the refusal is the tenant's entitlement, not the actor's grants. */
export function isTradeEntitlementRefusal(code: string | undefined): boolean {
  return (
    code === TRADE_ENTITLEMENT_CODES.moduleDisabled ||
    code === TRADE_ENTITLEMENT_CODES.featureRequired ||
    code === TRADE_ENTITLEMENT_CODES.maintenanceActive
  );
}

/** Optimistic-concurrency codes. Trade never answers 428 — see `tradeIfMatch`. */
export const TRADE_CONCURRENCY_CODES = {
  ifMatchRequired: "TRADE.CONCURRENCY.IF_MATCH_REQUIRED",
  staleVersion: "TRADE.CONCURRENCY.STALE_VERSION",
} as const;
