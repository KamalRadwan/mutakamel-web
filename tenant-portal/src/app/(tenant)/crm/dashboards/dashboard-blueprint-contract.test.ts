import { describe, expect, it } from "vitest";
import { buildDashboardBlueprintAdoption, dashboardBlueprintsPath, parseDashboardBlueprintReceipt, parseDashboardBlueprintsResponse } from "./dashboard-blueprint-contract";

const id = "01900300-0000-7000-8000-000000000001";
const base = "/api/tenant/crm/v1/dashboards/blueprints";
const candidate = { key: "pipeline", audience: "TEAM_LEADER", name: "مبيعات الفريق", description: "", definitionRevision: 7,
  widgetCount: 3, branchSelectionRequired: false, targets: [{ widgetName: "Win rate", target: 35 }], adoption: { state: "AVAILABLE" } };

describe("CRM dashboard blueprint contracts", () => {
  it("uses only the admitted branch query and exact revision/confirmation payload", () => {
    const [blueprint] = parseDashboardBlueprintsResponse({ items: [candidate] });
    expect(dashboardBlueprintsPath(null)).toBe(base);
    expect(dashboardBlueprintsPath(id)).toBe(`${base}?branchId=${id}`);
    expect(buildDashboardBlueprintAdoption(blueprint!, id, "  My team  ", true)).toEqual({
      path: `${base}/pipeline/adoption`, body: { definitionRevision: 7, branchId: id, name: "My team", confirmTargets: true },
    });
    expect(() => buildDashboardBlueprintAdoption(blueprint!, id, "", false)).toThrow("CRM_DASHBOARD_BLUEPRINT_TARGET_CONFIRMATION_REQUIRED");
    expect(buildDashboardBlueprintAdoption({ ...blueprint!, targets: [] }, null, "", false).body).toEqual({ definitionRevision: 7 });
    expect(() => dashboardBlueprintsPath("wrong")).toThrow();
  });

  it("requires a branch for partial eligibility and never exposes an elsewhere dashboard link", () => {
    const [partial] = parseDashboardBlueprintsResponse({ items: [{ ...candidate, branchSelectionRequired: true }] });
    expect(() => buildDashboardBlueprintAdoption(partial!, null, "", true)).toThrow("CRM_DASHBOARD_BLUEPRINT_BRANCH_REQUIRED");
    const [elsewhere] = parseDashboardBlueprintsResponse({ items: [{ ...candidate, adoption: { state: "ADOPTED_ELSEWHERE" } }] });
    expect(elsewhere?.adoption).toEqual({ state: "ADOPTED_ELSEWHERE" });
    expect(() => buildDashboardBlueprintAdoption(elsewhere!, id, "", true)).toThrow();
    expect(() => parseDashboardBlueprintsResponse({ items: [{ ...candidate, adoption: { state: "ADOPTED_ELSEWHERE", dashboardId: id } }] })).toThrow();
  });

  it.each([
    { key: "../../adoption" }, { audience: "ADMIN" }, { definitionRevision: "7" }, { widgetCount: 21 }, { branchSelectionRequired: "false" },
    { targets: [{ widgetName: "Rate", target: "0.2" }] }, { targets: [{ widgetName: "Rate", target: Infinity }] },
    { adoption: { state: "AVAILABLE", dashboardId: id } }, { adoption: { state: "ADOPTED", dashboardId: id } },
  ])("rejects malformed catalogue fields %j", patch => {
    expect(() => parseDashboardBlueprintsResponse({ items: [{ ...candidate, ...patch }] })).toThrow();
  });

  it("requires unique blueprint keys and a matching, typed adoption receipt", () => {
    expect(() => parseDashboardBlueprintsResponse({ items: [candidate, candidate] })).toThrow();
    expect(parseDashboardBlueprintReceipt({ dashboardId: id, definitionRevision: 7, created: false }, 7)).toEqual({ dashboardId: id, created: false });
    expect(() => parseDashboardBlueprintReceipt({ dashboardId: id, definitionRevision: 6, created: true }, 7)).toThrow();
    expect(() => parseDashboardBlueprintReceipt({ dashboardId: id, definitionRevision: 7, created: "false" }, 7)).toThrow();
  });
});
