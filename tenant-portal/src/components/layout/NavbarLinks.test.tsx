// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreNavbarLinks } from "./CoreNavbarLinks";
import { CrmNavbarLinks } from "./CrmNavbarLinks";

const navigation = vi.hoisted(() => ({ pathname: "/core/authentication" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: "en",
    t: {
      nav: {
        leads: "Leads",
        customerProfiles: "Customers",
        salesPipelineWorkspace: "Pipeline",
        staticData: "Catalogue",
        leadStages: "Lead Stages",
        acquisitionSources: "Acquisition Sources",
        customFields: "Custom Fields",
        crmSettings: "CRM Settings",
      },
    },
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: {
      permissions: [
        "crm.leads.read.all",
        "crm.customer_profiles.read.all",
        "crm.opportunities.read.all",
        "crm.settings.read",
        "crm.lead_stages.read",
        "crm.acquisition_sources.read",
        "crm.custom_fields.read",
      ],
    },
  }),
}));

afterEach(() => {
  cleanup();
  navigation.pathname = "/core/authentication";
});

describe("Tenant Navbar active links", () => {
  it("marks the current Core link", () => {
    render(<CoreNavbarLinks />);
    expect(screen.getByRole("link", { name: "Sign-in sessions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks a nested customer-profile route as current", () => {
    navigation.pathname =
      "/crm/customer-profiles/0191e9a8-7f51-7b32-8d72-19f9217a41b3";
    render(<CrmNavbarLinks />);

    expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Leads" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
