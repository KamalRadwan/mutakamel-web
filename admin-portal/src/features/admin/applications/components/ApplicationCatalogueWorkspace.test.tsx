// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useApplicationCatalogueMock = vi.hoisted(() => vi.fn());
const replaceGrants = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useApplicationCatalogue", () => ({
  useApplicationCatalogue: useApplicationCatalogueMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("./CatalogueResourceDialog", () => ({ CatalogueResourceDialog: () => null }));

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

    const checkbox = await activateEntitlements();
    fireEvent.click(checkbox);

    expect(screen.getByLabelText("Outbound email configuration JSON")).toHaveValue(defaultConfig);

    fireEvent.click(screen.getByRole("button", { name: "Replace complete entitlement set" }));
    await waitFor(() => expect(replaceGrants).toHaveBeenCalledWith("tier-1", {
      features: [{
        featureId: "feature-email",
        config: { dailyQuota: 1000, rateLimitPerMin: 30 },
      }],
    }));
  });

  it("preserves a custom email policy when the grant is unchecked and checked again", async () => {
    renderWorkspace();

    const checkbox = await activateEntitlements();
    fireEvent.click(checkbox);

    const config = screen.getByLabelText("Outbound email configuration JSON");
    fireEvent.change(config, { target: { value: customConfig } });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(config).toHaveValue(customConfig);
  });

  it("keeps grant validation visible and moves focus to the error", async () => {
    renderWorkspace();

    const checkbox = await activateEntitlements();
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText("Outbound email configuration JSON"), {
      target: { value: '{"dailyQuota":1000}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace complete entitlement set" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("requires exactly dailyQuota and rateLimitPerMin");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(replaceGrants).not.toHaveBeenCalled();
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

async function activateEntitlements() {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Entitlements" }), {
    button: 0,
    ctrlKey: false,
  });
  return screen.findByRole("checkbox", { name: /Outbound email/i });
}
