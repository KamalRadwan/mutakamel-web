import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  ONBOARDING_PROBES,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_IDS,
  isZeroDataTenant,
  nextActionableStep,
  parseCatalogueOccupancy,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "./onboarding-contract";

function statuses(
  overrides: Partial<Record<OnboardingStepId, OnboardingStepStatus>> = {},
): Record<OnboardingStepId, OnboardingStepStatus> {
  return {
    ...(Object.fromEntries(
      ONBOARDING_STEP_IDS.map((id) => [id, "done" as OnboardingStepStatus]),
    ) as Record<OnboardingStepId, OnboardingStepStatus>),
    ...overrides,
  };
}

describe("catalogue occupancy", () => {
  it("reads a bare CRM array — there is no meta wrapper anywhere in crm-app", () => {
    expect(parseCatalogueOccupancy([{ id: "a" }])).toBe(true);
    expect(parseCatalogueOccupancy([])).toBe(false);
  });

  it("throws rather than reporting a wrapped payload as empty", () => {
    // A coerced `false` would read as "you still need to do this" and send the
    // user to create a duplicate of something that already exists.
    for (const payload of [{ items: [] }, { data: [] }, null, undefined, 0]) {
      expect(() => parseCatalogueOccupancy(payload)).toThrow(
        "Invalid onboarding catalogue response.",
      );
    }
  });
});

describe("step ordering", () => {
  it("puts every prerequisite before the step that needs it", () => {
    // The status pass walks this array once and reads `next[step.requires]`,
    // so a prerequisite declared later would be read before it was computed.
    const seen = new Set<OnboardingStepId>();
    for (const step of ONBOARDING_STEPS) {
      if (step.requires !== null) expect(seen.has(step.requires)).toBe(true);
      seen.add(step.id);
    }
  });

  it("covers every declared step id exactly once", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      ...ONBOARDING_STEP_IDS,
    ]);
  });

  it("names a branch as the prerequisite for a company, not the reverse", () => {
    // branches.company_id — a branch cannot exist before its company.
    const branch = ONBOARDING_STEPS.find((step) => step.id === "branch");
    expect(branch?.requires).toBe("company");
    expect(ONBOARDING_STEPS.find((step) => step.id === "company")?.requires).toBeNull();
  });

  it("gates opportunity stages on .manage, which is what its GET declares", () => {
    // Every /opportunity-stages route requires crm.pipelines.manage, its two
    // GETs included. Admitting on .read would land on a screen that 403s.
    expect(
      ONBOARDING_STEPS.find((step) => step.id === "opportunityStages")?.permission,
    ).toBe("crm.pipelines.manage");
  });
});

describe("probes", () => {
  it("only probes tenant-wide CRM routes that need no branch", () => {
    // LeadStagesController.findAll(), OpportunityStagesController.findAll() and
    // PipelinesController.findAll(actor) take no list query at all, so all three
    // answer before a branch exists. Anything branch-scoped is not probeable
    // here by definition.
    expect(Object.keys(ONBOARDING_PROBES).sort()).toEqual([
      "leadStages",
      "opportunityStages",
      "pipeline",
    ]);
    for (const path of Object.values(ONBOARDING_PROBES)) {
      expect(path.startsWith("/api/tenant/crm/v1/")).toBe(true);
      expect(path).not.toContain("branchId");
    }
  });
});

describe("nextActionableStep", () => {
  it("names the earliest outstanding step, in declared order", () => {
    expect(nextActionableStep(statuses({ company: "todo", branch: "blocked" }))).toBe(
      "company",
    );
    expect(nextActionableStep(statuses({ pipeline: "todo", items: "todo" }))).toBe(
      "pipeline",
    );
  });

  it("skips a step that is blocked or belongs to somebody else", () => {
    expect(
      nextActionableStep(statuses({ branch: "blocked", leadStages: "unauthorized" })),
    ).toBeNull();
  });

  it("returns null when everything is done", () => {
    expect(nextActionableStep(statuses())).toBeNull();
  });
});

describe("reachability — a screen is not delivered until something reaches it", () => {
  it("has a route constant and a sidebar entry, not just a page file", () => {
    // D22 / Q40: route admission and the sidebar live in different files from
    // the route, and no gate connects them.
    expect(TENANT_ROUTES.gettingStarted).toBe("/getting-started");

    const entries = NAV_SECTIONS.flatMap((section) => section.items).filter(
      (item) => item.href === TENANT_ROUTES.gettingStarted,
    );
    expect(entries).toHaveLength(1);
    // Reachable by everyone: each row gates itself, and hiding the checklist
    // from someone missing one permission would hide the five steps they can
    // do along with the one they cannot.
    expect(entries[0].hasAccess([])).toBe(true);
  });

  it("sends every step to a route the app actually defines", () => {
    const hrefs = Object.values(TENANT_ROUTES) as string[];
    for (const step of ONBOARDING_STEPS) {
      expect(hrefs).toContain(step.href);
    }
  });
});

describe("isZeroDataTenant", () => {
  it("is true while either scope step is unresolved", () => {
    expect(isZeroDataTenant(statuses({ company: "todo" }))).toBe(true);
    expect(isZeroDataTenant(statuses({ branch: "blocked" }))).toBe(true);
  });

  it("is false once a company and a branch both exist", () => {
    expect(isZeroDataTenant(statuses({ pipeline: "todo" }))).toBe(false);
  });
});
