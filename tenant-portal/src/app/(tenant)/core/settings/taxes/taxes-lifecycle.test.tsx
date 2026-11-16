// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { COMPANY_INVALID_CODE, TAXES_PATH } from "./tax-contract";
import {
  TAXES_COMPANIES_PATH,
  installTaxesTestPolyfills,
  renderTaxesScreen,
  taxesApiError,
  taxesPageEnvelope,
  taxesRowEnvelope,
  type MockTaxesAuthUser,
} from "./taxes-test-helpers";

installTaxesTestPolyfills();

let currentUser: MockTaxesAuthUser;

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: currentUser,
    realtimeAuthGeneration: "gen-lifecycle",
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const companyAId = "01902001-3000-7000-8000-0000000000c1";
const companyBId = "01902001-3000-7000-8000-0000000000c2";
const activeTaxId = "01902001-3000-7000-8000-000000000021";
const inactiveTaxId = "01902001-3000-7000-8000-000000000022";
const outOfScopeInactiveId = "01902001-3000-7000-8000-000000000023";

const companyA = { id: companyAId, code: "ACME", name: "Acme Retail", status: "ACTIVE" };
const companyB = { id: companyBId, code: "GLOBEX", name: "Globex Logistics", status: "ACTIVE" };

const activeTax = {
  id: activeTaxId,
  code: "MUN25",
  name: "Municipality Levy",
  rate: "2.5000",
  isInclusive: true,
  companyId: companyAId,
  status: "ACTIVE",
  updatedAt: "2026-08-25T10:05:00.000Z",
};

const inactiveTax = {
  id: inactiveTaxId,
  code: "OLD5",
  name: "Legacy Duty",
  rate: "5.0000",
  isInclusive: false,
  companyId: companyAId,
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:10:00.000Z",
};

const outOfScopeInactiveTax = {
  id: outOfScopeInactiveId,
  code: "PORT1",
  name: "Port Duty",
  rate: "1.2500",
  isInclusive: false,
  companyId: companyBId,
  status: "INACTIVE",
  updatedAt: "2026-08-25T10:15:00.000Z",
};

beforeEach(() => {
  currentUser = {
    id: "01902001-3000-7000-8000-000000000001",
    isTenantOwner: false,
    permissions: ["taxes.tax.read", "taxes.tax.manage"],
    permissionScopes: {
      "taxes.tax.manage": { tenantWide: false, companyIds: [companyAId], branchIds: [] },
    },
  };
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

describe("TaxesPage lifecycle actions and write response guards", () => {
  it("rejects unreadable write payloads on create, update, and reactivate before success while retaining drafts and rows", async () => {
    let taxListReads = 0;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return taxesPageEnvelope([companyA], 100);
      taxListReads += 1;
      return taxesPageEnvelope([activeTax, inactiveTax]);
    });
    vi.spyOn(axiosClient, "post").mockResolvedValueOnce(taxesRowEnvelope({ malformed: true }, 201));
    vi.spyOn(axiosClient, "patch")
      .mockResolvedValueOnce(taxesRowEnvelope({ ...activeTax, rate: 15 }, 200))
      .mockResolvedValueOnce(taxesRowEnvelope(null, 200));

    await renderTaxesScreen("en");
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();
    expect(taxListReads).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.taxCreate }));
    const createDialog = await screen.findByRole("dialog");
    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`)), {
      target: { value: "bad201" },
    });
    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`)), {
      target: { value: "Draft Kept" },
    });
    fireEvent.change(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxRate}`)), {
      target: { value: "7.5" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    expect(
      await within(createDialog).findByText(en.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(within(createDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`))).toHaveValue(
      "Draft Kept",
    );
    expect(screen.queryByText(en.coreSettings.taxCreated)).toBeNull();
    expect(taxListReads).toBe(1);
    fireEvent.click(within(createDialog).getByRole("button", { name: en.common.cancel }));
    fireEvent.click(await screen.findByRole("button", { name: en.common.discardConfirm }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.taxEditTitle}: Municipality Levy (MUN25)` }),
    );
    const editDialog = await screen.findByRole("dialog");
    fireEvent.change(within(editDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`)), {
      target: { value: "Edited Levy Draft" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));

    expect(
      await within(editDialog).findByText(en.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(within(editDialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`))).toHaveValue(
      "Edited Levy Draft",
    );
    expect(screen.queryByText(en.coreSettings.taxUpdated)).toBeNull();
    expect(taxListReads).toBe(1);
    fireEvent.click(within(editDialog).getByRole("button", { name: en.common.cancel }));
    fireEvent.click(await screen.findByRole("button", { name: en.common.discardConfirm }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.reactivate}: Legacy Duty (OLD5)` }),
    );
    expect(await screen.findByText(en.coreSettings.invalidResponseDescription)).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.taxUpdated)).toBeNull();
    expect(taxListReads).toBe(1);
    expect(screen.getByText("Municipality Levy")).toBeInTheDocument();
    expect(screen.getByText("Legacy Duty")).toBeInTheDocument();
  });

  it("handles deactivate summary, confirm/cancel, pending duplicate/dismissal guard, and 204 empty-body success", async () => {
    let deactivated = false;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return taxesPageEnvelope([companyA, companyB], 100);
      return taxesPageEnvelope([deactivated ? { ...activeTax, status: "INACTIVE" } : activeTax]);
    });

    let resolveDelete: ((value: AxiosResponse<unknown>) => void) | undefined;
    const deleteSpy = vi.spyOn(axiosClient, "delete").mockImplementation(
      () =>
        new Promise<AxiosResponse<unknown>>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    await renderTaxesScreen("en");
    expect(await screen.findByText("Municipality Levy")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.deactivate}: Municipality Levy (MUN25)` }),
    );
    const firstModal = await screen.findByRole("alertdialog");
    expect(within(firstModal).getByText("Municipality Levy")).toBeInTheDocument();
    expect(within(firstModal).getByText("MUN25")).toBeInTheDocument();
    expect(within(firstModal).getByText("2.5%")).toBeInTheDocument();
    fireEvent.click(within(firstModal).getByRole("button", { name: en.common.cancel }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteSpy).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.deactivate}: Municipality Levy (MUN25)` }),
    );
    const confirmModal = await screen.findByRole("alertdialog");
    const confirmBtn = within(confirmModal).getByRole("button", { name: en.coreSettings.deactivate });

    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(`${TAXES_PATH}/${activeTaxId}`, expect.anything());

    await waitFor(() => expect(confirmModal).toHaveAttribute("aria-busy", "true"));
    expect(within(confirmModal).getByRole("button", { name: en.common.cancel })).toBeDisabled();
    fireEvent.keyDown(confirmModal, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    deactivated = true;
    await act(async () => {
      resolveDelete?.(taxesRowEnvelope(null, 204));
    });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(await screen.findByText(en.coreSettings.taxDeactivated)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: `${en.coreSettings.reactivate}: Municipality Levy (MUN25)`,
      }),
    ).toBeInTheDocument();
  });

  it("reactivates scoped INACTIVE rows via PATCH { status: ACTIVE } and handles 422 COMPANY_INVALID without losing row state", async () => {
    let reactivated = false;
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith(TAXES_COMPANIES_PATH)) return taxesPageEnvelope([companyA, companyB], 100);
      return taxesPageEnvelope([
        activeTax,
        reactivated ? { ...inactiveTax, status: "ACTIVE" } : inactiveTax,
        outOfScopeInactiveTax,
      ]);
    });

    const patchSpy = vi
      .spyOn(axiosClient, "patch")
      .mockRejectedValueOnce(taxesApiError(422, COMPANY_INVALID_CODE, "Company inactive"))
      .mockImplementationOnce(async () => {
        reactivated = true;
        return taxesRowEnvelope({ ...inactiveTax, status: "ACTIVE" });
      });

    await renderTaxesScreen("en");
    expect(await screen.findByText("Legacy Duty")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.reactivate}: Municipality Levy (MUN25)` }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.deactivate}: Legacy Duty (OLD5)` }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: `${en.coreSettings.reactivate}: Port Duty (PORT1)` }),
    ).toBeNull();

    const reactivateBtn = screen.getByRole("button", {
      name: `${en.coreSettings.reactivate}: Legacy Duty (OLD5)`,
    });
    fireEvent.click(reactivateBtn);
    fireEvent.click(reactivateBtn);
    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledWith(
      `${TAXES_PATH}/${inactiveTaxId}`,
      { status: "ACTIVE" },
      expect.anything(),
    );

    expect(await screen.findByText(en.coreSettings.taxCompanyInvalid)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${en.coreSettings.reactivate}: Legacy Duty (OLD5)` }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.reactivate}: Legacy Duty (OLD5)` }),
    );
    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("button", { name: `${en.coreSettings.deactivate}: Legacy Duty (OLD5)` }),
    ).toBeInTheDocument();
  });
});
