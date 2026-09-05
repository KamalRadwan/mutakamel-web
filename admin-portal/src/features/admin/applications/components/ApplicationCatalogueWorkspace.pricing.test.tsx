// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useApplicationCatalogueMock = vi.hoisted(() => vi.fn());
const replacePrices = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useApplicationCatalogue", () => ({
  useApplicationCatalogue: useApplicationCatalogueMock,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("./CatalogueResourceDialog", () => ({ CatalogueResourceDialog: () => null }));

import { ApplicationCatalogueWorkspace } from "./ApplicationCatalogueWorkspace";

/**
 * A saved two-bracket monthly ladder: 1–10 users at $5, then everyone above
 * that at $3 with no upper bound.
 */
const SAVED_LADDER = [
  { billingCycle: "MONTHLY", minUsers: 1, maxUsers: 10, unitPrice: "5.0000" },
  { billingCycle: "MONTHLY", minUsers: 11, maxUsers: null, unitPrice: "3.0000" },
];

describe("ApplicationCatalogueWorkspace pricing ladder deletion", () => {
  beforeEach(() => {
    replacePrices.mockReset().mockResolvedValue(undefined);
    useApplicationCatalogueMock.mockReturnValue({
      tiers: [{ id: "tier-1", name: "Starter" }],
      features: [],
      grants: [],
      prices: SAVED_LADDER,
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
      replacePrices,
    });
  });

  afterEach(() => cleanup());

  /**
   * The last row's maximum input is disabled — the final bracket is the
   * open-ended one — and the validator refuses any finite bound on it. So a
   * deletion that leaves a finite bound behind is a dead end: the operator can
   * see the wrong value and cannot reach it.
   */
  it("re-opens the final bound when the open-ended bracket is deleted", async () => {
    await openPricingTab();

    fireEvent.click(screen.getByRole("button", { name: "Remove bracket 2" }));

    // What is actually on screen, not what the component believes it holds.
    expect(screen.getByLabelText("Maximum users")).toHaveValue(null);
    expect(screen.getByLabelText("Minimum users")).toHaveValue(1);

    fireEvent.click(screen.getByRole("button", { name: "Replace monthly ladder" }));

    await waitFor(() =>
      expect(replacePrices).toHaveBeenCalledWith("tier-1", {
        billingCycle: "MONTHLY",
        brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "5.0000" }],
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /**
   * Deleting the first bracket leaves the ladder starting above one user, which
   * the validator also refuses. Minimum is editable, so this was repairable by
   * hand — it should not need repairing.
   */
  it("re-seats the ladder start when the first bracket is deleted", async () => {
    await openPricingTab();

    fireEvent.click(screen.getByRole("button", { name: "Remove bracket 1" }));

    expect(screen.getByLabelText("Minimum users")).toHaveValue(1);
    expect(screen.getByLabelText("Maximum users")).toHaveValue(null);

    fireEvent.click(screen.getByRole("button", { name: "Replace monthly ladder" }));

    await waitFor(() =>
      expect(replacePrices).toHaveBeenCalledWith("tier-1", {
        billingCycle: "MONTHLY",
        brackets: [{ minUsers: 1, maxUsers: null, unitPrice: "3.0000" }],
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

async function openPricingTab() {
  render(
    <ApplicationCatalogueWorkspace
      applicationId="application-1"
      applicationKey="crm"
      canRead
      canCreate
      canMutate
    />,
  );
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Pricing" }), {
    button: 0,
    ctrlKey: false,
  });
  await screen.findByRole("button", { name: "Remove bracket 2" });
}
