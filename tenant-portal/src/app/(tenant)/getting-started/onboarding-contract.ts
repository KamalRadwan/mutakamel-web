import type { CrmPath } from "@/lib/api/envelope";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

// First-run onboarding — MASTER-PLAN 13.23.
//
// What a genuinely new tenant lacks, and how the portal can know it:
//
// COMPANIES and BRANCHES come straight from `/auth/me` at no request cost.
// `TenantAuthService.resolveAccess` builds `accessibleCompanies` and
// `accessibleBranches` for a TENANT OWNER as `SELECT id FROM companies` and
// `SELECT id FROM branches` with no user join at all — so for an owner an
// empty array means the tenant genuinely has none. For a non-owner the same
// arrays come from `tenant_user_branch_roles`, where empty means "none is
// granted to you", which is a different sentence. The screen says which one it
// is rather than collapsing them.
//
// The consequence that makes this task exist: an owner of a fresh tenant gets
// the FULL permission set (`fetchPermissionKeys` selects every
// `tenant_permissions` row for an owner) and an EMPTY branch list. So every
// nav entry renders, every CRM list demands a `branchId` it cannot supply, and
// the user lands on empty lists with no path forward.
//
// LEAD STAGES, OPPORTUNITY STAGES and PIPELINES are probeable before a branch
// exists — all three list routes are tenant-wide with no `branchId` parameter
// (`LeadStagesController.findAll()`, `OpportunityStagesController.findAll()`,
// `PipelinesController.findAll(actor)` take no list query at all).
//
// TRADE ITEMS are deliberately NOT probed. `GET /trade/v1/items` needs a
// resolved `TradeRequestContext` and `GET /trade/v1/uoms` is BRANCH_REQUIRED at
// the Gateway, so neither can answer before a branch exists — and a step that
// reports "unknown" for a reason the user cannot act on is worse than a step
// that simply names the next action. Recorded as Q112.

export const ONBOARDING_STEP_IDS = [
  "company",
  "branch",
  "leadStages",
  "opportunityStages",
  "pipeline",
  "items",
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepStatus =
  /** Confirmed present. */
  | "done"
  /** Confirmed absent — this is the next action. */
  | "todo"
  /** An earlier step must land first; the action here would fail. */
  | "blocked"
  /** The actor holds no permission for this step; somebody else performs it. */
  | "unauthorized"
  /** Not asked, or asked and the answer did not arrive. Never guessed as "done". */
  | "unchecked"
  | "checking";

export interface OnboardingStepDefinition {
  id: OnboardingStepId;
  /** The permission its own route declares — copied from the controller. */
  permission: string;
  /** Where the user goes to perform it. */
  href: string;
  /** The step that must be `done` first, if any. */
  requires: OnboardingStepId | null;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = [
  // OrganizationController GET /organization/companies -> `org.company.read`.
  {
    id: "company",
    permission: "org.company.read",
    href: TENANT_ROUTES.coreCompanies,
    requires: null,
  },
  // A branch carries `company_id`, so it cannot exist before a company does.
  {
    id: "branch",
    permission: "org.branch.read",
    href: TENANT_ROUTES.coreBranches,
    requires: "company",
  },
  {
    id: "leadStages",
    permission: "crm.lead_stages.read",
    href: TENANT_ROUTES.crmLeadStages,
    requires: null,
  },
  // Every /opportunity-stages route requires `.manage`, including its GET —
  // admitting on `.read` would land an actor on a screen that answers 403.
  {
    id: "opportunityStages",
    permission: "crm.pipelines.manage",
    href: TENANT_ROUTES.crmOpportunityStages,
    requires: null,
  },
  {
    id: "pipeline",
    permission: "crm.pipelines.read",
    href: TENANT_ROUTES.crmPipelines,
    requires: "opportunityStages",
  },
  // Not probed — see the header. An item also needs a `baseUomId`
  // (`CreateItemDto.baseUomId` is required), so units of measure come first
  // and the copy says so.
  {
    id: "items",
    permission: "trade.items.read",
    href: TENANT_ROUTES.tradeItems,
    requires: "branch",
  },
];

/** The three catalogue probes, all tenant-wide and all safe without a branch. */
export const ONBOARDING_PROBES: Readonly<Record<"leadStages" | "opportunityStages" | "pipeline", CrmPath>> = {
  leadStages: "/api/tenant/crm/v1/lead-stages",
  opportunityStages: "/api/tenant/crm/v1/opportunity-stages",
  pipeline: "/api/tenant/crm/v1/pipelines",
};

export const ONBOARDING_PROBE_RESPONSE_LIMIT_BYTES = 256 * 1024;

/**
 * Whether a catalogue has anything in it.
 *
 * All three routes answer with a bare JSON array — crm-app returns the service
 * result directly and there is no `meta` wrapper anywhere in it (S1). The
 * contract this validates is exactly what is consumed: "the body is an array,
 * and here is whether it is empty". Anything else throws rather than being
 * coerced into a `false` that would read as "you still need to do this".
 */
export function parseCatalogueOccupancy(payload: unknown): boolean {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid onboarding catalogue response.");
  }
  return payload.length > 0;
}

/**
 * The first step a user should act on: the earliest one that is `todo` and not
 * waiting on something else. Returns null when nothing is actionable — either
 * everything is done, or every remaining step belongs to somebody else.
 */
export function nextActionableStep(
  statuses: Readonly<Record<OnboardingStepId, OnboardingStepStatus>>,
): OnboardingStepId | null {
  return ONBOARDING_STEPS.find((step) => statuses[step.id] === "todo")?.id ?? null;
}

/** True when the tenant has nothing at all — the case 13.23 exists for. */
export function isZeroDataTenant(
  statuses: Readonly<Record<OnboardingStepId, OnboardingStepStatus>>,
): boolean {
  return statuses.company !== "done" || statuses.branch !== "done";
}
