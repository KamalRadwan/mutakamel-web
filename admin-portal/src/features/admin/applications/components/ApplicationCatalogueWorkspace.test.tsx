// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useApplicationCatalogueMock = vi.hoisted(() => vi.fn());
const replaceGrants = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useApplicationCatalogue", () => ({
  useApplicationCatalogue: useApplicationCatalogueMock,
}));
vi.mock("./CatalogueResourceDialog", () => ({ CatalogueResourceDialog: () => null }));
vi.mock("@/components/shared/DestructiveActionModal", () => ({ DestructiveActionModal: () => null }));

import { ApplicationCatalogueWorkspace } from "./ApplicationCatalogueWorkspace";

const defaultConfig = '{"dailyQuota":1000,"rateLimitPerMin":30}';
const customConfig = '{"dailyQuota":2000,"rateLimitPerMin":50}';

describe("ApplicationCatalogueWorkspace entitlement defaults", () => {
  beforeEach(() => {
    replaceGrants.mockReset().mockResolvedValue(undefined);
    useApplicationCatalogueMock.mockReturnValue({
      tiers: [{ id: "tier-1", name: "Starter" }],
      features: [{ id: "feature-email", key: "crm.outbound_email", name: "Outbound email" }],
      grants: [],
      prices: [],
      audit: null,
      loadedTierId: "tier-1",
      selectedTierId: "tier-1",
      setSelectedTierId: vi.fn(),
      isLoading: false,
      isTierLoading: false,
      pendingAction: null,
      pendingCreateAttempt: null,
      catalogueError: null,
      tierDetailError: null,
      auditError: null,
      loadCatalogue: vi.fn(),
      loadAudit: vi.fn(),
      replaceGrants,
    });
  });

  afterEach(() => cleanup());

  it("adds the finite email limits when the CRM outbound email grant is checked", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Entitlements" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Outbound email/i }));

    expect(screen.getByLabelText("Outbound email configuration JSON")).toHaveValue(defaultConfig);

    fireEvent.click(screen.getByRole("button", { name: "Replace complete entitlement set" }));
    await waitFor(() => expect(replaceGrants).toHaveBeenCalledWith("tier-1", {
      features: [{
        featureId: "feature-email",
        config: { dailyQuota: 1000, rateLimitPerMin: 30 },
      }],
    }));
  });

  it("preserves a custom email policy when the grant is unchecked and checked again", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Entitlements" }));
    const checkbox = screen.getByRole("checkbox", { name: /Outbound email/i });
    fireEvent.click(checkbox);

    const config = screen.getByLabelText("Outbound email configuration JSON");
    fireEvent.change(config, { target: { value: customConfig } });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(config).toHaveValue(customConfig);
  });
});

function renderWorkspace() {
  render(
    <ApplicationCatalogueWorkspace
      applicationId="application-1"
      applicationKey="crm"
      canRead
      canCreate
      canMutate
    />,
  );
}
