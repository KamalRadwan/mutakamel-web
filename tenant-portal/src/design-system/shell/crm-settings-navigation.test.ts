import { describe, expect, it } from "vitest";
import { crmSettingsDestination, isCrmAnalyticsPath, isCrmSettingsPath } from "./crm-settings-navigation";
import { NAV_SECTIONS } from "./nav-config";

const settings = NAV_SECTIONS.find((section) => section.id === "crmSetup")!;

describe("CRM settings route ownership", () => {
  it.each(["/crm/dashboard", "/crm/dashboards", "/crm/dashboards/record", "/crm/dashboards/reports", "/crm/widgets", "/crm/widgets/record"])("uses analytics presentation for %s", (route) => {
    expect(isCrmAnalyticsPath(route)).toBe(true);
  });

  it.each(["/crm/dashboards-archive", "/crm/widgets-archive", "/crm/lead-stages", "/trade/dashboards"])("keeps analytics presentation outside %s", (route) => {
    expect(isCrmAnalyticsPath(route)).toBe(false);
  });
  it.each(settings.items.map((item) => [item.id, item.href]))("keeps %s and its detail routes in Settings", (_id, href) => {
    expect(isCrmSettingsPath(href)).toBe(true);
    expect(isCrmSettingsPath(`${href}/018f0000-0000-7000-8000-000000000001`)).toBe(true);
  });

  it.each(["/crm/leads", "/crm/customer-profiles", "/crm/opportunities", "/crm/activities", "/crm/dashboard", "/crm/dashboards", "/crm/dashboards/018f0000-0000-7000-8000-000000000001", "/crm/dashboards/reports", "/crm/dashboards/reports/lead-performance", "/crm/widgets", "/crm/widgets/018f0000-0000-7000-8000-000000000001", "/crm/lead-stages-archive", "/core/settings/workspace"])("does not add the Settings aside on %s", (pathname) => {
    expect(isCrmSettingsPath(pathname)).toBe(false);
  });

  it("opens lead stages when permitted, otherwise the first permitted section", () => {
    expect(crmSettingsDestination(settings.items)?.href).toBe("/crm/lead-stages");
    expect(crmSettingsDestination(settings.items.filter((item) => item.id !== "leadStages"))?.href).toBe("/crm/pipelines");
    expect(crmSettingsDestination(settings.items.filter((item) => item.id === "crmTags"))?.href).toBe("/crm/tags");
    expect(crmSettingsDestination([])).toBeUndefined();
  });

  it("keeps Settings after Analytics and preserves the nine configuration destinations", () => {
    const crm = NAV_SECTIONS.filter((section) => section.app === "crm");
    expect(crm.map((section) => section.id)).toEqual(["crm", "crmActivities", "crmAnalytics", "crmSetup"]);
    expect(settings.globalNavDisplay).toBe("settings");
    expect(settings.items.map((item) => item.id)).toEqual(["leadStages", "pipelines", "opportunityStages", "acquisitionSources", "crmTags", "customFields", "outboundEmails", "crmSettings", "staticData"]);
  });
});
